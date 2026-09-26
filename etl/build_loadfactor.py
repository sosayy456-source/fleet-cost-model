"""แปลงไฟล์ Load Factor รายเที่ยว → JSON ให้แท็บ "ต้นทุนที่จมกับที่ว่าง" ของ Executive Dashboard

    python etl/build_loadfactor.py --dataset sample
        etl/sample_data/LoadFactor/*.xlsx          (ExampleLoadfactor.xlsx — 5,709 เที่ยว 2024–2026)
    python etl/build_loadfactor.py --dataset real
        etl/data/Loadfactor/*.xlsx                 (ทุกไฟล์ในโฟลเดอร์รวมกัน ข้ามไฟล์ที่ไม่มีคอลัมน์ที่ต้องใช้)

ผลลัพธ์ app/public/data/<dataset>/loadfactor/
    manifest.json   จำนวน/ยอดรวม/ช่วงเวลา/แถวที่ตัดทิ้ง + ค่าตรวจสอบ
    trips.json      1 ระเบียน = 1 เที่ยว **เก็บเป็นคอลัมน์** (array ต่อฟิลด์ แบบเดียวกับ alloc/customers.json)
                    เพราะข้อมูลจริง ~50,000 เที่ยว ถ้าเก็บเป็น object ชื่อคีย์ซ้ำทุกแถวไฟล์โตเกือบเท่าตัว
                    ความหมายของแต่ละฟิลด์ดู interface LfTrip ใน app/src/lib/data/useLoadFactor.ts
                    ทุกส่วนของแท็บคิดสดในเบราว์เซอร์จากไฟล์นี้ (จัดอันดับ · คุ้มทุน · 4 กลุ่ม · what-if)
                    เพราะต้องตอบสนองตัวกรองและการกดข้ามส่วน — เจ้าของงานเคาะ 22 ก.ย. 2569

ที่มาของสเปก: lf_executive_dashboard.html (รายงานผู้บริหารเรื่อง Load Factor) ส่วน "ข้อมูลสำหรับทีมโมเดล"
ไฟล์ต้นทางคือ Book1.xlsx ที่เอกสารอ้างตัวอักษรคอลัมน์ไว้ (A–AV) ไฟล์ตัวอย่างมีคอลัมน์ครบชุดนั้น
ETL อ่านด้วย **ชื่อคอลัมน์** ไม่ใช่ตำแหน่ง เผื่อไฟล์จริงเรียงต่างกัน

คอลัมน์ที่ใช้ (ชื่อต้องตรง — ตัดช่องว่างซ้ำก่อนเทียบ):
    ปี · เดือน                       A, B     ปี ค.ศ. · เดือน 1–12
    เลขที่ใบรายการ                   C        คีย์ของเที่ยว (สตริง ห้ามแปลงเป็นตัวเลข)
    ประเภทรถ                         D        รถบริษัท / รถร่วม — ตัวกรองในแถบหัว
    ประเภทใบรายการ                   E
    ทะเบียนรถ · ชนิดรถ               G, H
    เส้นทางมาตรฐาน                   L        ★ ใช้ L ไม่ใช่ K (K เป็นเส้นทางดิบ มีทิศกลับ) ตามเอกสาร
    สถานะข้อมูล                      W        ★ ใช้เฉพาะ "ปกติ" + "เฝ้าระวัง" (เอกสารส่วนที่ 1) แถวอื่นตัดทิ้งและนับไว้ใน manifest
    (Max LF)                         Z        สัดส่วนบรรทุกจริง (ค่าที่เต็มกว่าระหว่างปริมาตรกับน้ำหนัก) — ใช้ค่าจากไฟล์
    ข้อจำกัดหลัก                     AB       ปริมาตร / น้ำหนัก
    เป้าของกลุ่ม                     AC       LF เป้าหมายของกลุ่ม ชนิดรถ × เส้นทาง — ใช้ค่าจากไฟล์ (ฝ่ายปฏิบัติการกำหนด)
    ต้นทุนรวม · รายได้                AL, AM   ★ ต้นทุนรวม = FC + VC ใช้เป็นฐานของทุกสูตร
    ระยะทาง · น้ำหนักจริง · VC       M, V, AI  ★ เพิ่ม 23 ก.ย. 2569 ให้แท็บ "กำไรส่วนเกิน/ตัน-กม." (lib/tonkm/calc.ts)
                                              น้ำหนักจริงเป็น **ตัน** · VC = ต้นทุนรวม − FC (FC = ค่าซ่อมตามเวลา + ค่าเสื่อม)
                                              ไม่บังคับ — ไฟล์ที่ไม่มีคอลัมน์เหล่านี้ได้ null แท็บนั้นขึ้นข้อความให้รัน ETL ใหม่
    (คอลัมน์อื่น เช่น ความจุ ปริมาตรจริง FC ไม่เก็บ — แท็บไม่ได้ใช้ และข้อมูลจริง 50,000 เที่ยว
     ทุกฟิลด์ที่เพิ่มคือไฟล์โตขึ้นราว 0.5 MB)

สูตรที่ **คำนวณใหม่ในแอป** ไม่อ่านจากไฟล์ (เจ้าของงานเคาะ 22 ก.ย. 2569 ตามข้อแก้ 6 จุดในเอกสาร):
    Idle Cost        = ต้นทุนรวม × MAX(0, 1 − Max LF)        ← คอลัมน์ AP ในไฟล์ติดลบได้เมื่อ LF > 100% ห้ามใช้
    Recoverable Cost = ต้นทุนรวม × MAX(0, เป้า − Max LF)
    กำไร             = รายได้ − ต้นทุนรวม
    Break-even LF    = Σต้นทุนรวม ÷ Σ(รายได้ ÷ Max LF)         (c = 0 ตามเอกสารส่วนที่ 3)
ETL คำนวณยอดรวมชุดเดียวกันใส่ manifest ไว้เป็นค่าตรวจสอบ — หน้าเว็บตอนไม่กรองต้องได้เท่านี้

★ ข้อมูลจริงอาจถึง 50,000 เที่ยว ≈ 5 MB — trips.json ยังโหลดไหว แต่กราฟจุดฝั่งแอปวาดเป็นรายกลุ่มเป็นค่าเริ่มต้น
  (รายเที่ยวเปิดได้เฉพาะตอนกรองจนเหลือไม่เกินหลักพัน) ดู LoadFactorTab.tsx
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path

from build_costrev import iter_sheet, num, text as txt, utf8_stdout, xlsx_files
from src.progress import report, span

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
OUT_ROOT = ROOT / "app" / "public" / "data"
#: ตารางระยะทางของโมเดล — ใช้เติมระยะทางให้แถวที่ไฟล์ LF ไม่มี (ดู route_km)
ROUTES_JSON = ROOT / "app" / "src" / "lib" / "refdata" / "routes.json"
SAMPLE_DIR = HERE / "sample_data" / "LoadFactor"
REAL_DIR = HERE / "data" / "Loadfactor"

#: ชื่อคอลัมน์ในไฟล์ → คีย์สั้นใน trips.json (ตัวอักษรคอลัมน์ของ Book1 ไว้ในคอมเมนต์ข้างบน)
COLS = {
    "ปี": "y", "เดือน": "m", "เลขที่ใบรายการ": "id", "ประเภทรถ": "ft",
    "ทะเบียนรถ": "pl", "ชนิดรถ": "vk", "เส้นทางมาตรฐาน": "rt",
    "สถานะข้อมูล": "st", "(Max LF)": "lf", "ข้อจำกัดหลัก (ปริมาตรหรือน้ำหนักเต็มก่อน)": "bind",
    "เป้าของกลุ่ม": "tg", "ต้นทุนรวม": "cost", "รายได้": "rev",
    "ระยะทาง": "km", "น้ำหนักจริง": "wt", "VC": "vc",
}
#: ไฟล์ที่ไม่มีคอลัมน์เหล่านี้ = ไม่ใช่ไฟล์ Load Factor → ข้ามทั้งไฟล์
REQUIRED = ("เลขที่ใบรายการ", "(Max LF)", "ต้นทุนรวม", "รายได้", "เป้าของกลุ่ม", "ชนิดรถ", "เส้นทางมาตรฐาน")
#: สถานะข้อมูลที่นับ — เอกสารส่วนที่ 1: ปกติ (≤110%) + เฝ้าระวัง (110–130%) · Outlier/ผิดพลาด/ไม่นับ ตัดทิ้ง
KEEP_STATUS = {"ปกติ", "เฝ้าระวัง"}


def norm(v) -> str:
    return " ".join(txt(v).split())


def route_km(route: str, routes: dict[str, dict[str, float]]) -> float | None:
    """
    ระยะทางของ "เส้นทางมาตรฐาน" (เช่น "เชียงใหม่-ปากคลองตลาด") จากตารางระยะทางของโมเดล — ไม่เจอ = None

    ลองแบ่งที่ขีดทุกตำแหน่ง เผื่อชื่อสถานที่มีขีดเอง · ค้นได้ทั้งสองทิศ (ตารางเก็บทิศเดียว กติกาเดียวกับ
    distance() ใน build_costrev.py)
    """
    route = " ".join(route.split())
    for i, ch in enumerate(route):
        if ch != "-":
            continue
        o, d = route[:i].strip(), route[i + 1:].strip()
        v = routes.get(o, {}).get(d)
        if v is None:
            v = routes.get(d, {}).get(o)
        if v is not None:
            return float(v)
    return None


def read_file(path: Path, routes: dict[str, dict[str, float]] | None = None,
              fill: dict[str, object] | None = None) -> tuple[list[dict], dict[str, int]]:
    """คืน (เที่ยวที่นับ, จำนวนที่ตัดทิ้งแยกเหตุผล) — คืน ([], {}) ถ้าไฟล์ไม่ใช่ไฟล์ Load Factor

    routes = ตารางระยะทางของโมเดล · fill = ตัวนับการเติมระยะทาง (filled / missing / missingRoutes) — ดู build()
    """
    hdr, body = iter_sheet(path, 0)
    col = {norm(h): i for i, h in enumerate(hdr)}
    # ชื่อคอลัมน์ข้อจำกัดหลักยาวและมีวงเล็บ — รับแบบสั้นด้วยเผื่อไฟล์จริงตัดวงเล็บทิ้ง
    if "ข้อจำกัดหลัก (ปริมาตรหรือน้ำหนักเต็มก่อน)" not in col and "ข้อจำกัดหลัก" in col:
        col["ข้อจำกัดหลัก (ปริมาตรหรือน้ำหนักเต็มก่อน)"] = col["ข้อจำกัดหลัก"]
    missing = [c for c in REQUIRED if c not in col]
    if missing:
        print(f"  [!] ข้าม {path.name}: ไม่มีคอลัมน์ {', '.join(missing)}")
        return [], {}
    idx = {k: col.get(name, -1) for name, k in COLS.items()}

    def g(row, key: str):
        i = idx[key]
        return row[i] if 0 <= i < len(row) else None

    def opt(row, key: str, digits: int) -> float | None:
        """คอลัมน์ไม่บังคับ — ไฟล์ไม่มีคอลัมน์นี้ = None"""
        return round(num(g(row, key)), digits) if idx[key] >= 0 else None

    out: list[dict] = []
    dropped: dict[str, int] = {}

    def drop(reason: str) -> None:
        dropped[reason] = dropped.get(reason, 0) + 1

    for r in body:
        doc = txt(g(r, "id"))
        if not doc:
            drop("ไม่มีเลขที่ใบรายการ"); continue
        st = txt(g(r, "st"))
        if st not in KEEP_STATUS:
            drop(f"สถานะข้อมูล={st or '(ว่าง)'}"); continue
        lf = num(g(r, "lf")); cost = num(g(r, "cost"))
        if lf <= 0 or cost <= 0:
            drop("LF หรือต้นทุนรวมเป็น 0"); continue
        y, m = int(num(g(r, "y"))), int(num(g(r, "m")))
        # ไฟล์ตัวอย่าง/ไฟล์จริงเป็นปี ค.ศ. (แอปบวก 543 ตอนแสดงเอง) — กันไว้เผื่อไฟล์ไหนกรอก พ.ศ.
        # ไม่งั้นได้ปี 2567 ปนกับ 2024 แล้วฐานของแท็บตัน-กม. (ปี Y−1, Y−2) หาไม่เจอ · กติกาเดียวกับ parse_date ใน build_costrev
        if y > 2400:
            y -= 543
        if not (1 <= m <= 12) or y < 2000:
            drop("ปี/เดือนอ่านไม่ออก"); continue
        # ★ เติมระยะทางจากตารางของโมเดลเฉพาะแถวที่ไฟล์ไม่มี (ว่าง/0) — ไม่ต้องแก้ไฟล์ LF (เจ้าของงานสั่ง 24 ก.ย. 2569)
        #   แถวที่มีระยะทางใช้ค่าในไฟล์ต่อ · ไฟล์ที่ไม่มีคอลัมน์ระยะทางเลย (รุ่นเก่า) ไม่เติม ยังเป็น null เหมือนเดิม
        #   ต้นทุนรวม/VC/LF ในไฟล์ไม่ได้คิดจากระยะทาง (ตรวจแล้ว) จึงเติมแค่ระยะทางได้โดยไม่ต้องคิดอย่างอื่นใหม่
        km = opt(r, "km", 1)
        rt = txt(g(r, "rt"))
        if km is not None and km <= 0 and routes is not None and fill is not None:
            hit = route_km(rt, routes)
            if hit is not None:
                km = round(hit, 1)
                fill["filled"] += 1          # type: ignore[operator]
            else:
                fill["missing"] += 1         # type: ignore[operator]
                fill["missingRoutes"][rt or "(ไม่ระบุ)"] = fill["missingRoutes"].get(rt or "(ไม่ระบุ)", 0) + 1  # type: ignore[index,union-attr]
        out.append({
            "id": doc, "y": y, "mo": f"{y:04d}-{m:02d}",
            "ft": txt(g(r, "ft")), "pl": txt(g(r, "pl")),
            "vk": txt(g(r, "vk")) or "(ไม่ระบุ)", "rt": txt(g(r, "rt")) or "(ไม่ระบุ)",
            "st": st, "lf": round(lf, 4), "tg": round(num(g(r, "tg")), 4),
            "bind": txt(g(r, "bind")),
            "cost": round(cost, 2), "rev": round(num(g(r, "rev")), 2),
            # ตัน-กม. — ไม่มีคอลัมน์ = null (ไม่ใช่ 0) แอปจะได้แยกออกว่า "ไฟล์รุ่นเก่า" กับ "เที่ยวที่ไม่มีน้ำหนัก"
            "km": km, "wt": opt(r, "wt", 4), "vc": opt(r, "vc", 2),
        })
    return out, dropped


def build(dataset: str) -> None:
    folder = SAMPLE_DIR if dataset == "sample" else REAL_DIR
    files = xlsx_files(folder) if folder.exists() else []
    if not files:
        sys.exit(f"ไม่พบไฟล์ Load Factor ใน {folder}")

    routes = json.loads(ROUTES_JSON.read_text(encoding="utf-8"))
    fill: dict[str, object] = {"filled": 0, "missing": 0, "missingRoutes": {}}
    trips: list[dict] = []
    dropped: dict[str, int] = {}
    used: list[str] = []
    for fi, f in enumerate(files):
        span(0, 90, fi, len(files), f"อ่านไฟล์ Load Factor {fi + 1}/{len(files)}")
        got, dr = read_file(f, routes, fill)
        if not got and not dr:
            continue
        used.append(f.name)
        trips.extend(got)
        for k, v in dr.items():
            dropped[k] = dropped.get(k, 0) + v
        print(f"  {f.name}: นับ {len(got):,} เที่ยว" + (f" · ตัดทิ้ง {sum(dr.values()):,}" if dr else ""))
    if not trips:
        sys.exit("ไม่มีเที่ยวที่ใช้ได้เลย — ตรวจชื่อคอลัมน์และค่าสถานะข้อมูล")

    # เลขที่ใบรายการซ้ำข้ามไฟล์ → เก็บแถวแรก (ไฟล์จริงรายเดือนไม่ควรซ้ำ แต่กันไว้)
    seen: set[str] = set()
    uniq: list[dict] = []
    dup = 0
    for t in trips:
        if t["id"] in seen:
            dup += 1; continue
        seen.add(t["id"]); uniq.append(t)
    trips = sorted(uniq, key=lambda t: (t["mo"], t["id"]))

    # ค่าตรวจสอบ — สูตรชุดเดียวกับฝั่งแอป (LoadFactorTab.tsx) ตอนไม่กรองต้องได้ตรงกัน
    cost = sum(t["cost"] for t in trips)
    idle = sum(t["cost"] * max(0.0, 1 - t["lf"]) for t in trips)
    recov = sum(t["cost"] * max(0.0, t["tg"] - t["lf"]) for t in trips)
    below = sum(1 for t in trips if t["lf"] < t["tg"])
    rev_full = sum(t["rev"] / t["lf"] for t in trips)
    months = sorted({t["mo"] for t in trips})
    # กำไรส่วนเกิน/ตัน-กม. ทั้งชุด = ΣContribution ÷ Σตัน-กม. (ห้ามเฉลี่ยอัตรารายเที่ยว) — สูตรเดียวกับ lib/tonkm/calc.ts
    # นับเฉพาะเที่ยวที่ตัน-กม. > 0 (ขนของจริง) · ไฟล์ไม่มีคอลัมน์ = None
    has_tk = all(t["km"] is not None and t["wt"] is not None and t["vc"] is not None for t in trips)
    tk_rows = [t for t in trips if has_tk and t["km"] * t["wt"] > 0]
    tk = sum(t["km"] * t["wt"] for t in tk_rows)
    contrib = sum(t["rev"] - t["vc"] for t in tk_rows)

    manifest = {
        "dataset": dataset,
        "isSample": dataset == "sample",
        "generatedAt": datetime.now().replace(microsecond=0).isoformat(),
        "sourceFiles": used,
        "rows": len(trips),
        "duplicates": dup,
        "dropped": dropped,
        "years": sorted({t["y"] for t in trips}),
        "months": months,
        "dateRange": {"min": months[0], "max": months[-1]},
        "vehicleKinds": len({t["vk"] for t in trips}),
        # เติมระยะทางจาก routes.json ให้แถวที่ไฟล์ไม่มี — missingRoutes = เส้นทางที่ยังหาระยะทางไม่เจอ (ให้เพิ่มลงตาราง)
        "distanceFill": {"filled": fill["filled"], "missing": fill["missing"],
                         "missingRoutes": dict(sorted(fill["missingRoutes"].items(), key=lambda kv: -kv[1]))},  # type: ignore[union-attr]
        "routes": len({t["rt"] for t in trips}),
        "check": {
            "cost": round(cost, 2),
            "idle": round(idle, 2),
            "idleShare": round(idle / cost, 6) if cost else None,
            "recoverable": round(recov, 2),
            "belowTarget": below,
            "avgLf": round(sum(t["lf"] for t in trips) / len(trips), 6),
            "avgTarget": round(sum(t["tg"] for t in trips) / len(trips), 6),
            "breakEven": round(cost / rev_full, 6) if rev_full else None,
            "tonKm": {
                "trips": len(tk_rows), "noWeight": len(trips) - len(tk_rows),
                "contribution": round(contrib, 2), "tonKm": round(tk, 2),
                "rate": round(contrib / tk, 6) if tk else None,
            } if has_tk else None,
        },
    }

    out = OUT_ROOT / dataset / "loadfactor"
    out.mkdir(parents=True, exist_ok=True)
    report(95, "เขียนไฟล์ผลลัพธ์")
    columns = {k: [t[k] for t in trips] for k in trips[0]}
    for name, obj in (("manifest.json", manifest), ("trips.json", columns)):
        p = out / name
        p.write_text(json.dumps(obj, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        print(f"  {name:14} {p.stat().st_size / 1024:>9,.1f} KB")

    c = manifest["check"]
    print(f"เขียน {out.relative_to(ROOT)}")
    print(f"  เที่ยว {len(trips):,} ({months[0]} → {months[-1]}) · ตัดทิ้ง {sum(dropped.values()):,} · ซ้ำ {dup:,}")
    print(f"  ต้นทุนรวม {c['cost']:,.0f} · จม {c['idle']:,.0f} ({c['idleShare'] * 100:.1f}%) · "
          f"กู้คืนได้ {c['recoverable']:,.0f} · ต่ำกว่าเป้า {below:,} เที่ยว · "
          f"LF เฉลี่ย {c['avgLf'] * 100:.1f}% เป้า {c['avgTarget'] * 100:.1f}% · คุ้มทุน {c['breakEven'] * 100:.1f}%")
    k = c["tonKm"]
    if k:
        print(f"  กำไรส่วนเกิน/ตัน-กม. {k['rate']:.4f} บาท · {k['trips']:,} เที่ยว (ไม่มีน้ำหนัก/ระยะทาง {k['noWeight']:,})")
    else:
        print("  [!] ไฟล์ไม่มีคอลัมน์ ระยะทาง/น้ำหนักจริง/VC ครบ — แท็บกำไรส่วนเกิน/ตัน-กม. จะไม่มีข้อมูล")
    # ★ พิมพ์ท้ายสุด — plugin autoEtl โชว์เฉพาะท้าย log
    df = manifest["distanceFill"]
    print(f"  เติมระยะทางจาก routes.json {df['filled']:,} แถว (ไฟล์ไม่มีระยะทาง)")
    if df["missing"]:
        top = " · ".join(f"{k} ({v})" for k, v in list(df["missingRoutes"].items())[:5])
        print(f"  [!] ยังไม่มีระยะทาง {df['missing']:,} แถว {len(df['missingRoutes'])} เส้นทาง — เพิ่มลง routes.json: {top}")


def main() -> None:
    utf8_stdout()
    ap = argparse.ArgumentParser(description="Load Factor รายเที่ยว → JSON")
    ap.add_argument("--dataset", choices=["sample", "real"], default="sample")
    build(ap.parse_args().dataset)


if __name__ == "__main__":
    main()
