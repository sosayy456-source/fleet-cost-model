#!/usr/bin/env python
"""
build_json.py
=============
แปลงไฟล์ Excel -> ไฟล์ JSON ให้ frontend อ่าน

    python build_json.py --dataset sample     # ข้อมูลตัวอย่าง (ตัวที่ deploy ขึ้น Pages)
    python build_json.py --dataset real       # ข้อมูลจริงจาก etl/data/revenue/
    python build_json.py --inspect repair     # ดูชื่อคอลัมน์จริงในไฟล์ ตอนจะเขียน loader ใหม่

ผลลัพธ์ลงที่ app/public/data/<dataset>/
โดย real/ ติด .gitignore ไว้แล้ว — ข้อมูลจริงจะไม่มีทางขึ้น GitHub Pages
"""

from __future__ import annotations

import argparse
import gc
import logging
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src import insights as ins  # noqa: E402
from src import kpi  # noqa: E402
from src.cleaning import clean_data, validation_report  # noqa: E402
from src.cube import build_cube, cube_stats, dimension_values  # noqa: E402
from src.custcodes import resolve_codes  # noqa: E402
from src.emit import write_json  # noqa: E402
from src.loaders import revenue as revenue_loader  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

# ไฟล์ตัวอย่างยังอยู่ที่เดิมของแอป Streamlit — ไม่ก็อปมาซ้ำเพราะรวมกันเกือบ 30 MB
SAMPLE_DIR = os.path.join(ROOT, "RevenueDashboard", "RevenueDashboard", "sample_data")
REAL_DIRS = {
    "revenue": os.path.join(HERE, "data", "revenue"),
    "repair": os.path.join(HERE, "data", "repair"),
    "travel": os.path.join(HERE, "data", "travel"),
}
OUT_ROOT = os.path.join(ROOT, "app", "public", "data")

log = logging.getLogger("build_json")


def inspect(folder: str) -> int:
    """พิมพ์ชื่อคอลัมน์จริงในไฟล์ ใช้ตอนจะเขียน loader ให้ข้อมูลชุดใหม่"""
    data_dir = REAL_DIRS.get(folder)
    if not data_dir:
        log.error("ไม่รู้จักโฟลเดอร์ %r — ใช้ได้: %s", folder, ", ".join(REAL_DIRS))
        return 2

    files = revenue_loader.discover_files(data_dir)
    if not files:
        log.warning("ยังไม่มีไฟล์ .xlsx ใน %s", data_dir)
        return 0

    for f in files:
        df = revenue_loader.read_one_file(f.path)
        print(f"\n=== {f.name} — {len(df):,} แถว × {len(df.columns)} คอลัมน์ ===")
        for c in df.columns:
            if c == "source_file":
                continue
            sample = df[c].dropna().head(2).tolist()
            print(f"  {c!r:45} ตัวอย่าง: {sample}")
    return 0


def merge_validation(parts: list[dict]) -> dict:
    """รวมรายงานคุณภาพข้อมูลรายไฟล์เข้าด้วยกัน — ตัวเลขทุกตัวเป็นผลรวมจึงบวกกันตรง ๆ ได้"""
    out: dict = {"bad_date_samples": [], "bad_date_rows": 0,
                 "numeric_unparseable": {}, "comma_numbers": {}}
    for p in parts:
        out["bad_date_rows"] += int(p.get("bad_date_rows", 0))
        for s in p.get("bad_date_samples", []):
            if s not in out["bad_date_samples"] and len(out["bad_date_samples"]) < 10:
                out["bad_date_samples"].append(s)
        for key in ("numeric_unparseable", "comma_numbers"):
            for col, n in p.get(key, {}).items():
                out[key][col] = out[key].get(col, 0) + int(n)
    return out


def merge_id_formats(parts: list[dict]) -> dict:
    """รวมผลตรวจรูปแบบรหัสลูกค้า — by_file แยกตามไฟล์อยู่แล้วจึงไม่มีทางชนกัน"""
    out: dict = {"by_file": {}, "formats_seen": set(), "mixed": False}
    for p in parts:
        out["by_file"].update(p.get("by_file", {}))
        out["formats_seen"].update(p.get("formats_seen", []))
    out["formats_seen"] = sorted(out["formats_seen"])
    out["mixed"] = len([f for f in out["formats_seen"] if f in ("sha256", "cus")]) > 1
    return out


def build(dataset: str, out_dir: str | None = None) -> int:
    data_dir = SAMPLE_DIR if dataset == "sample" else REAL_DIRS["revenue"]
    out_dir = out_dir or os.path.join(OUT_ROOT, dataset)

    log.info("อ่านข้อมูลจาก %s", data_dir)
    found = revenue_loader.discover_files(data_dir)

    # ★ อ่าน → ตรวจ → ล้าง → ยุบชนิดข้อมูล ทีละไฟล์ แล้วค่อยต่อกันตอนท้าย
    #   ของเดิมอ่านครบทุกไฟล์ก่อนแล้วค่อย clean_data ทำให้ชุดดิบกับชุดที่ล้างแล้ว
    #   อยู่ในหน่วยความจำพร้อมกัน ข้อมูลจริง 29 ไฟล์กินเกิน 10 GB แล้วถูก OS ฆ่าทิ้ง
    #   พร้อม dev server ที่เป็นแม่ของมัน (ดู CATEGORICAL_COLUMNS ใน loaders/revenue.py)
    frames: list = []
    files: list = []
    val_parts: list[dict] = []
    fmt_parts: list[dict] = []
    for f in found:
        try:
            one = revenue_loader.read_one_file(f.path)
        except Exception as e:
            # ไฟล์เสียหรือรูปแบบไม่ตรง -> ข้ามแต่บอกให้รู้ ไม่ทำให้ทั้ง build ล่ม
            log.error("ข้ามไฟล์ %s อ่านไม่สำเร็จ: %s", f.name, e)
            continue

        lacks = revenue_loader.missing_required(one)
        if lacks:
            log.warning("ข้ามไฟล์ %s ไม่ใช่ไฟล์บิล (ขาดคอลัมน์ %s)", f.name, ", ".join(lacks))
            continue

        # ตรวจคุณภาพจากข้อมูลดิบ ก่อนที่ค่าที่อ่านไม่ออกจะกลายเป็น NaN
        val_parts.append(validation_report(one))
        fmt_parts.append(revenue_loader.customer_id_formats(one))

        frames.append(revenue_loader.shrink(clean_data(one)))
        files.append(f)
        log.info("อ่าน %s — %s แถว (%.1f MB)", f.name, f"{len(frames[-1]):,}", f.size / 1048576)
        del one
        gc.collect()

    if not frames:
        log.error("ไม่มีข้อมูลให้ประมวลผล — วางไฟล์ .xlsx ใน %s ก่อน", data_dir)
        return 1

    df = revenue_loader.concat_shared(frames)
    frames.clear()
    gc.collect()

    missing_cols = [c for c in revenue_loader.EXPECTED_COLUMNS if c not in df.columns]
    if missing_cols:
        log.warning("ไฟล์ข้อมูลขาดคอลัมน์: %s — บางส่วนของแดชบอร์ดจะไม่ครบ", ", ".join(missing_cols))

    log.info("รวมได้ %s แถว จาก %d ไฟล์", f"{len(df):,}", len(files))

    validation = merge_validation(val_parts)
    id_formats = merge_id_formats(fmt_parts)
    if id_formats.get("mixed"):
        log.warning(
            "รหัสลูกค้าปนกันหลายรูปแบบ (%s) — ลูกค้าคนเดียวจะถูกนับเป็นหลายคน "
            "ทำให้จำนวนลูกค้าและ Pareto เพี้ยน ดูรายละเอียดใน dq.json",
            ", ".join(id_formats["formats_seen"]),
        )

    # ---- ตัวเลขสรุป (คำนวณจากแถวดิบ จึงเป็นค่าที่เชื่อได้เป๊ะ) ----
    overview = kpi.overview_kpis(df)
    monthly = kpi.monthly_trend(df)
    payment = kpi.payment_method_summary(df)
    payment_monthly = kpi.payment_method_monthly(df)
    product = kpi.product_type_summary(df)
    pricing = kpi.pricing_type_summary(df)
    bill_status = kpi.top_by_column(df, "สถานะบิล", n=20)
    routes = kpi.top_routes(df, n=20)
    distline = kpi.top_by_column(df, "สายกระจาย", n=20)
    dow = kpi.day_of_week_summary(df)
    customer = kpi.customer_summary(df)
    pareto = kpi.pareto_analysis(customer)
    dq = kpi.data_quality_report(df)

    # ── เส้นทางรายเดือน ── กุญแจสำหรับ join รายได้เข้ากับต้นทุนฝั่งโมเดลเดินรถ
    # ตรวจแล้วว่า "ต้นทาง → ปลายทาง" ตรงกับตารางระยะทางฝั่งต้นทุน 20/20 เส้นทางแรก
    # ส่วน "สายกระจาย" ตรงแค่ 0.8% เพราะเป็นสายส่งย่อยในเมือง คนละระดับกับเส้นทางวิ่งไกล
    route_month = (
        df.groupby(["route", "month"], dropna=False, observed=True)
        .agg(revenue=("ราคารวม", "sum"), bills=("เลขที่บิล", "nunique"),
             lines=("เลขที่บิล", "count"))
        .reset_index()
        .sort_values("revenue", ascending=False)
    ) if "route" in df.columns else None

    # ---- cube สำหรับกรองในเบราว์เซอร์ ----
    cube = build_cube(df)
    stats = cube_stats(df, cube)
    log.info(
        "cube: %s แถว จาก %s แถว (ยุบ %sx)",
        f"{stats['cube_rows']:,}", f"{stats['source_rows']:,}", stats["compression"],
    )

    # ---- insight อัตโนมัติ ----
    all_insights = {
        "revenue": ins.revenue_insights(monthly, overview["total_revenue"]),
        "payment": ins.payment_insights(payment, overview["total_revenue"]),
        "customer": ins.customer_insights(pareto),
        "quality": ins.quality_insights(dq),
    }

    is_sample = dataset == "sample"
    manifest = {
        "dataset": dataset,
        "isSample": is_sample,
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "sourceFiles": [{"name": f.name, "sizeBytes": f.size} for f in files],
        "rowCount": int(len(df)),
        "dateRange": {
            "min": overview["date_min"],
            "max": overview["date_max"],
        },
        "missingColumns": missing_cols,
        "cube": stats,
        # bills ใน cube เป็น nunique จึงบวกข้ามเซลล์แล้วนับเกิน
        # ยอดที่เป๊ะอยู่ใน overview.json / monthly.json
        "billsExactIn": ["overview.json", "monthly.json", "payment.json"],
    }

    log.info("เขียนไฟล์ลง %s", out_dir)
    total = 0
    total += write_json(out_dir, "manifest.json", manifest)
    total += write_json(out_dir, "overview.json", overview)
    total += write_json(out_dir, "monthly.json", monthly)
    total += write_json(out_dir, "payment.json", payment)
    total += write_json(out_dir, "payment_monthly.json", payment_monthly)
    total += write_json(out_dir, "product.json", product)
    total += write_json(out_dir, "pricing.json", pricing)
    total += write_json(out_dir, "bill_status.json", bill_status)
    total += write_json(out_dir, "routes.json", routes)
    total += write_json(out_dir, "distline.json", distline)
    total += write_json(out_dir, "dow.json", dow)
    # แปลงรหัสต้นฉบับเป็นเลข CUS ตั้งแต่ตอน ETL — แดชบอร์ดจะได้ไม่ต้องโหลด custmap.bin 18 MB
    # ทำเฉพาะ 200 อันดับแรกที่ส่งออกจริง ไม่ใช่ลูกค้าทั้งชุด (หน่วยความจำตอนนี้ตึงอยู่แล้ว)
    top_cust = customer.head(200).copy()
    col = "ผู้รับ_encoded" if "ผู้รับ_encoded" in top_cust.columns else top_cust.columns[0]
    codes = resolve_codes(Path(ROOT), set(top_cust[col].astype(str)))
    top_cust["n"] = [codes.get(str(h), 0) for h in top_cust[col]]
    log.info("แปลงรหัสลูกค้าเป็น CUS ได้ %s จาก %s ราย", f"{sum(1 for v in top_cust['n'] if v):,}", f"{len(top_cust):,}")
    total += write_json(out_dir, "customer_top.json", top_cust)
    total += write_json(out_dir, "pareto.json", pareto)
    total += write_json(out_dir, "insights.json", all_insights)
    total += write_json(out_dir, "cube.json", cube)
    if route_month is not None:
        log.info("เส้นทางรายเดือน: %s แถว (%s เส้นทาง)",
                 f"{len(route_month):,}", f"{route_month['route'].nunique():,}")
        total += write_json(out_dir, "route_month.json", route_month)
    total += write_json(out_dir, "dimensions.json", dimension_values(cube))
    total += write_json(out_dir, "dq.json", {
        **dq,
        "validation": validation,
        "customerIdFormats": id_formats,
        "duplicateSample": df[df["flag_duplicate_row"]].head(50)[
            [c for c in ["source_file", "เลขที่บิล", "วันที่", "ราคารวม"] if c in df.columns]
        ],
    })

    log.info("เสร็จแล้ว รวม %.1f KB", total / 1024)
    if is_sample:
        log.info("ชุดนี้เป็นข้อมูลตัวอย่าง — หน้าเว็บจะขึ้นแถบเตือนสีแดงให้อัตโนมัติ")
    else:
        log.warning("ชุดนี้เป็นข้อมูลจริง — อยู่ใน .gitignore ห้าม commit เด็ดขาด")
    return 0


def utf8_stdout() -> None:
    """บังคับ stdout/stderr เป็น UTF-8 — คอนโซลไทยบน Windows เป็น cp874 ซึ่งไม่มีตัว "·"
    ที่ log ใช้คั่นข้อความ พิมพ์แล้วจะ UnicodeEncodeError ตายกลางทางทั้งที่แปลงไฟล์ไปได้แล้ว
    (plugin autoEtl ตั้ง PYTHONUTF8=1 ให้อยู่แล้ว ที่นี่กันเคสผู้ใช้รันเองใน terminal)
    """
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except (AttributeError, OSError):   # stdout ถูก redirect ไปที่อื่น — ปล่อยไป
            pass


def main() -> int:
    utf8_stdout()
    p = argparse.ArgumentParser(description="แปลง Excel เป็น JSON ให้ frontend")
    p.add_argument("--dataset", choices=["sample", "real"], default="sample")
    p.add_argument("--out", help="โฟลเดอร์ปลายทาง (ปกติไม่ต้องระบุ)")
    p.add_argument("--inspect", metavar="FOLDER",
                   help="พิมพ์ชื่อคอลัมน์จริงในไฟล์ (revenue/repair/travel) แทนการ build")
    p.add_argument("-v", "--verbose", action="store_true")
    args = p.parse_args()

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(levelname)-8s %(message)s",
    )

    if args.inspect:
        return inspect(args.inspect)
    return build(args.dataset, args.out)


if __name__ == "__main__":
    raise SystemExit(main())
