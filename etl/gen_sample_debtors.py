"""สร้างไฟล์ลูกหนี้ตัวอย่างแบบสุ่มล้วน → etl/sample_data/ExampleDebtors_Randomed.xlsx

    python etl/gen_sample_debtors.py
    python etl/build_debtors.py --dataset sample

★ ไม่ได้อ่านหรือสุ่มต่อจากไฟล์จริงเลย — รหัสลูกหนี้ = SHA-1 ของข้อความ "SAMPLE-CUST-<n>" ·
  ยอดเงิน/วันที่/พฤติกรรมจ่ายเงินสุ่มจาก seed ตายตัว · สาขาเอาจาก refdata/enums.json ที่ commit อยู่แล้ว
  จึง commit ได้ทั้งไฟล์นี้และผลใน app/public/data/sample/debtors/ ให้ส่วน DSO ขึ้นบน GitHub Pages
  (ไฟล์ตัวอย่างเดิม ExampleDebtors.xlsx ถอดจากรายงานจริง ยังติด .gitignore และ ETL เลิกใช้แล้ว)

รูปแบบคอลัมน์ตาม build_debtors.py (Sheet1 + ชีต "สรุปวิเคราะห์" ที่มีวันที่อ้างอิง)
"""
from __future__ import annotations

import hashlib
import json
import random
from datetime import date, timedelta
from pathlib import Path

import openpyxl

HERE = Path(__file__).resolve().parent
OUT = HERE / "sample_data" / "ExampleDebtors_Randomed.xlsx"
ENUMS = HERE.parent / "app" / "src" / "lib" / "refdata" / "enums.json"

SEED = 2569
START = date(2026, 1, 5)
CUTOFF = date(2026, 7, 17)      # วันตัดยอดของไฟล์ — ใบที่จ่ายหลังวันนี้ = ยังค้าง
REF_DATE = date(2026, 5, 31)    # ตรงกับ DEFAULT_AS_OF ใน OverdueSection.tsx
N_CUST = 80
N_BILLS = 1500

# พฤติกรรมจ่ายเงินของลูกค้า: (สัดส่วนลูกค้า, วันที่จ่ายช้ากว่ากำหนดต่ำสุด–สูงสุด, โอกาสค้างนานไม่จ่าย)
PROFILES = [
    (0.45, (-5, 3), 0.00),      # จ่ายตรง
    (0.30, (0, 20), 0.02),      # ช้านิดหน่อย
    (0.17, (10, 50), 0.08),     # ช้าบ่อย
    (0.08, (30, 110), 0.25),    # ช้ามาก ค้างนาน
]


def main() -> None:
    rnd = random.Random(SEED)
    branches = json.loads(ENUMS.read_text(encoding="utf-8"))["branches"]

    custs = []
    for i in range(1, N_CUST + 1):
        h = hashlib.sha1(f"SAMPLE-CUST-{i}".encode()).hexdigest()
        r = rnd.random()
        acc = 0.0
        for share, delay, stuck in PROFILES:
            acc += share
            if r <= acc:
                break
        custs.append({
            "h": h, "br": rnd.choice(branches), "term": rnd.choice([7, 15, 15, 30, 30]),
            "delay": delay, "stuck": stuck,
            "size": rnd.lognormvariate(9.3, 0.9),      # ยอดต่อใบเฉลี่ยของรายนี้ (~11,000 บาท)
            "weight": rnd.paretovariate(1.3),          # รายใหญ่วางบิลบ่อยกว่า
        })

    span = (CUTOFF - START).days
    rows = []
    seq: dict[str, int] = {}
    for _ in range(N_BILLS):
        c = rnd.choices(custs, weights=[x["weight"] for x in custs])[0]
        issue = START + timedelta(days=rnd.randrange(span - 3))
        ym = f"{issue.year % 100:02d}{issue.month:02d}"
        seq[ym] = seq.get(ym, 0) + 1
        doc = f"99{ym}{seq[ym]:05d}{rnd.randrange(100):02d}"   # 13 หลัก ขึ้นต้น 99 = ชุดสุ่ม
        due = issue + timedelta(days=c["term"])
        if rnd.random() < c["stuck"]:
            close = None
        else:
            close = due + timedelta(days=rnd.randint(*c["delay"]))
            if close < issue:
                close = issue
            if close > CUTOFF:
                close = None
        amount = round(max(300.0, c["size"] * rnd.lognormvariate(0, 0.5)), 2)
        rows.append([c["h"], c["br"], c["term"], doc, issue, close or "(ว่าง)", amount])

    rows.sort(key=lambda r: (r[4], r[3]))
    wb = openpyxl.Workbook()
    summ = wb.active
    summ.title = "สรุปวิเคราะห์"
    summ["J1"] = "วันที่อ้างอิง (แทนวันนี้)"
    summ["J2"] = "ค่า:"
    summ["K2"] = REF_DATE
    ws = wb.create_sheet("Sheet1")
    ws.append(["ชื่อลูกหนี้", "สาขา", "ระยะเวลาเครดิต", "เลขที่ใบวางบิล", "วันที่วางบิลได้", "วันที่จบ", "จำนวนเงิน"])
    for r in rows:
        ws.append(r)
    for row in ws.iter_rows(min_row=2):
        row[3].number_format = "@"
        for c in (row[4], row[5]):
            if isinstance(c.value, date):
                c.number_format = "dd/mm/yyyy"
    OUT.parent.mkdir(parents=True, exist_ok=True)
    wb.save(OUT)
    unpaid = sum(1 for r in rows if r[5] == "(ว่าง)")
    print(f"เขียน {OUT.name}: {len(rows):,} ใบ · ลูกหนี้ {N_CUST} ราย · ยังค้าง {unpaid:,} ใบ")


if __name__ == "__main__":
    main()
