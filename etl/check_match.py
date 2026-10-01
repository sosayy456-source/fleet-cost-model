"""
ตรวจว่าทำไมเที่ยวในไฟล์ต้นทุนจับคู่กับไฟล์รายได้ไม่ได้ — แยกรายเดือน + รายไฟล์รายได้

    python check_match.py --dataset real      (ข้อมูลจริงใน etl/data/ · เจ้าของงานรันเอง)
    python check_match.py --dataset sample

★ พิมพ์แค่จำนวน · ชื่อไฟล์ · ชื่อชีต · ชื่อคอลัมน์ · รูปแบบของเลข (ความยาว/มีอักขระที่ไม่ใช่ตัวเลข)
  ไม่พิมพ์ค่าในเซลล์ใด ๆ (เลขที่ใบรายการ · ยอดเงิน · ชื่อลูกค้า) — ส่งผลให้คนอื่นดูได้
★ อ่านไฟล์ด้วยฟังก์ชันชุดเดียวกับ build_costrev.py (text · iter_sheet · ชีตแรก · หัวแถวแรก) ผลจึงตรงกับ ETL จริง

ใช้ตอบ: เดือนไหนจับคู่ได้น้อย · ไฟล์รายได้ไหนถูก ETL ข้าม (ขาดคอลัมน์ / ชีตแรกไม่ใช่ข้อมูล) ·
เลขที่ใบรายการต่างรูปแบบกันไหม (ถ้าตัดอักขระที่ไม่ใช่ตัวเลขแล้วจับคู่ได้ = ปัญหารูปแบบ ไม่ใช่ไม่มีบิล)
"""
from __future__ import annotations

import argparse
import re
from collections import Counter, defaultdict

import build_costrev as bc

NEED = ["เลขที่ใบรายการ", "เลขที่บิล", "วันที่", "ราคารวม", "สถานะการชำระเงิน"]
digits = lambda s: re.sub(r"\D", "", s).lstrip("0")  # noqa: E731


def shape(s: str) -> str:
    """รูปแบบของเลข ไม่ใช่ค่า — เช่น "13 หลัก" · "14 ตัว มีอักขระอื่น" """
    return f"{len(s)} หลัก" if s.isdigit() else f"{len(s)} ตัว มีอักขระอื่น"


def sheet_names(p) -> list[str]:
    try:
        if bc._calamine is not None:
            return list(bc._calamine.CalamineWorkbook.from_path(str(p)).sheet_names)
        wb = bc.openpyxl.load_workbook(p, read_only=True)
        names = wb.sheetnames
        wb.close()
        return names
    except Exception as e:  # noqa: BLE001
        return [f"(อ่านชื่อชีตไม่ได้: {type(e).__name__})"]


def main() -> None:
    bc.utf8_stdout()
    ap = argparse.ArgumentParser()
    ap.add_argument("--dataset", choices=["sample", "real"], default="real")
    a = ap.parse_args()
    cost_files = [bc.SAMPLE_COST] if a.dataset == "sample" else bc.xlsx_files(bc.REAL_COST_DIR)
    rev_dir = bc.SAMPLE_REV_DIR if a.dataset == "sample" else bc.REAL_REV_DIR
    if not cost_files or not cost_files[0].exists():
        raise SystemExit(f"ไม่พบไฟล์ต้นทุน — วาง .xlsx ใน {bc.REAL_COST_DIR}")

    # ---------- ไฟล์ต้นทุน: เลขที่ใบรายการ → เดือนปล่อยรถ ----------
    doc_month: dict[str, str] = {}
    cost_shape = Counter()
    print("== ไฟล์ต้นทุน")
    for cf in cost_files:
        hrow = bc.find_header_row(cf, "เลขที่ใบรายการ")
        hdr, rows = bc.read_sheet(cf, hrow)
        col = {h: i for i, h in enumerate(hdr)}
        n = 0
        for r in rows:
            doc = bc.text(r[col["เลขที่ใบรายการ"]])
            d = bc.parse_date(r[col["วันที่ปล่อยรถ"]]) if "วันที่ปล่อยรถ" in col else None
            if not doc or not d:
                continue
            n += 1
            doc_month.setdefault(doc, f"{d.year}-{d.month:02d}")
            cost_shape[shape(doc)] += 1
        print(f"  {cf.name}: {n:,} แถว · ชีต {sheet_names(cf)}")
    print(f"  รูปแบบเลขที่ใบรายการ: {dict(cost_shape.most_common(5))}")
    want = set(doc_month)
    want_norm = defaultdict(set)
    for d in want:
        want_norm[digits(d)].add(d)

    # ---------- ไฟล์รายได้ ----------
    found_in: dict[str, Counter] = defaultdict(Counter)   # เลขที่ใบในไฟล์ต้นทุน → ไฟล์รายได้ที่เจอ
    norm_hit: set[str] = set()                              # เจอเมื่อตัดอักขระที่ไม่ใช่ตัวเลข
    files = bc.xlsx_files(rev_dir)
    if rev_dir == bc.SAMPLE_REV_DIR:
        files = [p for p in files if p.name.startswith("bill_")]
    print(f"\n== ไฟล์รายได้ ({len(files)} ไฟล์ใน {rev_dir})")
    for p in files:
        names = sheet_names(p)
        hdr, rows = bc.iter_sheet(p, 0)
        col = {h: i for i, h in enumerate(hdr)}
        missing = [c for c in NEED if c not in col]
        head = f"  {p.name} · ชีต {names}"
        if missing:
            near = [h for h in hdr if h and any(k in h for k in ("ใบรายการ", "บิล", "วันที่", "ราคา", "สถานะ"))][:8]
            print(f"{head}\n     ★ ETL ข้ามทั้งไฟล์: ขาดคอลัมน์ {missing} (ชีตแรก แถวแรก) · คอลัมน์ใกล้เคียงที่เจอ {near}")
            continue
        n = 0
        docs = set()
        shp = Counter()
        months = Counter()
        for r in rows:
            n += 1
            doc = bc.text(r[col["เลขที่ใบรายการ"]])
            if not doc:
                continue
            docs.add(doc)
            shp[shape(doc)] += 1
            d = bc.parse_date(r[col["วันที่"]])
            if d:
                months[f"{d.year}-{d.month:02d}"] += 1
        hit = docs & want
        for doc in hit:
            found_in[doc][p.name] += 1
        for doc in docs - want:
            for w in want_norm.get(digits(doc), ()):
                norm_hit.add(w)
        mo = ", ".join(f"{m}:{c:,}" for m, c in sorted(months.items()))
        print(f"{head}\n     {n:,} แถว · เลขที่ใบไม่ซ้ำ {len(docs):,} · ตรงกับไฟล์ต้นทุน {len(hit):,}"
              f"\n     รูปแบบเลข {dict(shp.most_common(4))}\n     เดือนตามคอลัมน์วันที่ {mo}")

    # ---------- รายเดือนของไฟล์ต้นทุน ----------
    print("\n== รายเดือน (เดือนปล่อยรถในไฟล์ต้นทุน)")
    print("  เดือน     เที่ยว   จับคู่ได้     %   เจอถ้าตัดอักขระอื่น   ไฟล์รายได้ที่เจอบ่อยสุด")
    by_mo: dict[str, list[str]] = defaultdict(list)
    for doc, mo in doc_month.items():
        by_mo[mo].append(doc)
    for mo in sorted(by_mo):
        ds = by_mo[mo]
        hit = [d for d in ds if d in found_in]
        nh = sum(1 for d in ds if d not in found_in and d in norm_hit)
        src = Counter()
        for d in hit:
            src.update(found_in[d].keys())
        top = " · ".join(f"{k} {v:,}" for k, v in src.most_common(2))
        print(f"  {mo}  {len(ds):7,}  {len(hit):8,}  {100 * len(hit) / len(ds):5.1f}%  {nh:12,}        {top}")


if __name__ == "__main__":
    main()
