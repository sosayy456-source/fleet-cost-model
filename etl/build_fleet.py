"""สร้างทะเบียนรถในกองรถ (refdata/fleet.json) จาก ทะเบียนในกองรถ.xlsx

ไฟล์ต้นทางเป็น "บันทึกการปล่อยรถรายเที่ยว" (81,619 แถว) ไม่ใช่ทะเบียน 1 แถวต่อคัน
คอลัมน์: สาขา · วันที่ปล่อยรถ (dd/mm/พ.ศ.) · ประเภทรถ · ชนิดรถ · ทะเบียนรถ
สคริปต์นี้ยุบเหลือ 1 ระเบียนต่อทะเบียน (274 คัน) แล้วเขียนเป็น JSON ให้แอปใช้เป็นฐานกลาง

กติกา (ตกลงกับเจ้าของข้อมูล 13 ก.ย. 2569):
  วันที่เริ่มใช้งาน   ถ้าวิ่งครั้งแรกใน ม.ค. 2567 (เดือนแรกของข้อมูล) → 2024-01-01
                     ไม่งั้นใช้วันที่ปล่อยรถครั้งแรกจริง
  วันที่ปล่อยรถว่าง  เติมจากแถวบนที่ใกล้ที่สุด "ตามลำดับแถวในไฟล์" (ไฟล์ไม่ได้เรียงตามวันที่
                     แต่แถวที่ว่างจะตามหลังแถวที่มีวันที่ของชุดเดียวกัน)
  ชนิดรถ             แมปชื่อเก่าในไฟล์เข้ากับชื่อมาตรฐานที่แอปใช้ (KIND_MAP)
  คันที่เปลี่ยนชนิด   เก็บทุกคู่ (ประเภทรถ, ชนิดรถ) ที่เคยวิ่งไว้ใน kinds ให้ตัวกรองทะเบียน
                     ในฟอร์มโชว์คันนั้นทุกชนิด ส่วน fleetType/vehicle หลักคือคู่ที่วิ่งบ่อยสุด
  สาขา               รวมเข้ากับ enums.json (เพิ่มเฉพาะที่ยังไม่มี ไม่ลบของเดิม)

    python etl/build_fleet.py "ทะเบียนในกองรถ.xlsx"

ไฟล์ต้นทางติด .gitignore (*.xlsx) ส่วน fleet.json commit ขึ้น repo — เจ้าของข้อมูลยืนยันว่า
ทะเบียนรถไม่ใช่ความลับ
"""
from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from datetime import date
from pathlib import Path

import pandas as pd

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
REFDATA = ROOT / "app" / "src" / "lib" / "refdata"

# ชื่อชนิดรถในไฟล์ → ชื่อที่แอปใช้ (ต้องมีใน vehicles.json) · ชนิดที่ไม่อยู่ในนี้ใช้ชื่อเดิม
KIND_MAP = {
    "รถ 10 ล้อช่วงยาว": "รถ 10 ล้อยาว",
    "รถเทรเล่อร์ (แม่)": "รถเทรเลอร์",
}

# เดือนแรกของข้อมูล — คันที่วิ่งครั้งแรกในเดือนนี้ถือว่าใช้งานมาก่อนหน้าแล้ว ให้เริ่มที่วันที่ 1
FIRST_MONTH = (2024, 1)


def parse_thai_date(s: str) -> date | None:
    """'01/02/2567' → date(2024, 2, 1) · คืน None ถ้าอ่านไม่ออก"""
    try:
        d, m, y = (int(x) for x in str(s).strip().split("/"))
        if y > 2400:
            y -= 543
        return date(y, m, d)
    except (ValueError, AttributeError):
        return None


def thai_sort_key(s: str) -> str:
    """เรียงแบบพจนานุกรมไทยคร่าว ๆ — สระหน้า (เ แ โ ใ ไ) ย้ายไปหลังพยัญชนะตัวแรก
    และตัดวรรณยุกต์ทิ้ง ให้ได้ลำดับเดียวกับรายการสาขาเดิมใน enums.json"""
    if s and s[0] in "เแโใไ" and len(s) > 1:
        s = s[1] + s[0] + s[2:]
    return "".join(ch for ch in s if ch not in "่้๊๋")


def build(src: Path) -> None:
    df = pd.read_excel(src, dtype=str)
    df.columns = [str(c).strip() for c in df.columns]
    need = ["สาขา", "วันที่ปล่อยรถ", "ประเภทรถ", "ชนิดรถ", "ทะเบียนรถ"]
    missing = [c for c in need if c not in df.columns]
    if missing:
        sys.exit(f"ไฟล์ขาดคอลัมน์ {missing} — เจอ {list(df.columns)}")

    for c in need:
        df[c] = df[c].map(lambda v: str(v).strip() if pd.notna(v) and str(v).strip().lower() != "nan" else None)

    # วันที่ว่าง → เติมจากแถวบนที่ใกล้ที่สุด (ffill ตามลำดับแถวในไฟล์)
    blank = df["วันที่ปล่อยรถ"].isna().sum()
    df["วันที่ปล่อยรถ"] = df["วันที่ปล่อยรถ"].ffill()
    df["d"] = df["วันที่ปล่อยรถ"].map(parse_thai_date)
    bad_dates = df["d"].isna().sum()
    df = df[df["d"].notna() & df["ทะเบียนรถ"].notna()].copy()

    df["vehicle"] = df["ชนิดรถ"].map(lambda k: KIND_MAP.get(k, k))

    # ตรวจว่าชนิดรถทุกตัว (หลังแมป) มีใน vehicles.json — ไม่งั้นฟอร์มเลือกไม่ได้และคำนวณต้นทุนไม่ได้
    vehicles = json.loads((REFDATA / "vehicles.json").read_text(encoding="utf-8"))
    known = {v["name"] for v in vehicles}
    unknown = sorted(set(df["vehicle"].dropna()) - known)
    if unknown:
        sys.exit(f"ชนิดรถเหล่านี้ยังไม่มีใน vehicles.json: {unknown} — เพิ่มก่อน หรือแมปใน KIND_MAP")

    out = []
    for plate, g in df.groupby("ทะเบียนรถ", sort=False):
        g = g.sort_values("d", kind="stable")
        first: date = g["d"].iloc[0]
        start = date(*FIRST_MONTH, 1) if (first.year, first.month) == FIRST_MONTH else first

        combos = Counter(zip(g["ประเภทรถ"].fillna(""), g["vehicle"].fillna("")))
        (main_ft, main_veh), _ = combos.most_common(1)[0]
        kinds = [{"fleetType": ft, "vehicle": veh, "trips": n}
                 for (ft, veh), n in combos.most_common() if ft and veh]

        out.append({
            "plate": plate,
            "fleetType": main_ft,
            "vehicle": main_veh,
            "start": start.isoformat(),
            "status": "ใช้งาน",
            "trips": int(len(g)),
            "firstTrip": first.isoformat(),
            "lastTrip": g["d"].iloc[-1].isoformat(),
            "kinds": kinds,
            "branches": sorted(set(g["สาขา"].dropna()), key=thai_sort_key),
        })
    out.sort(key=lambda r: r["plate"])

    fleet_path = REFDATA / "fleet.json"
    fleet_path.write_text(json.dumps({
        "source": src.name,
        "rows": int(len(df)),
        "vehicles": out,
    }, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")

    # สาขา → รวมเข้ากับ enums.json (เพิ่มเฉพาะที่ยังไม่มี)
    enums_path = REFDATA / "enums.json"
    enums = json.loads(enums_path.read_text(encoding="utf-8"))
    have = set(enums["branches"])
    new_br = sorted(set(df["สาขา"].dropna()) - have, key=thai_sort_key)
    if new_br:
        enums["branches"] = sorted(have | set(new_br), key=thai_sort_key)
        enums_path.write_text(json.dumps(enums, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    multi = [r for r in out if len(r["kinds"]) > 1]
    print(f"เขียน {fleet_path.relative_to(ROOT)}")
    print(f"  {len(out):,} คัน จาก {len(df):,} เที่ยว / วันที่ว่างที่เติมให้ {blank:,} แถว / อ่านวันที่ไม่ออก {bad_dates:,} แถว")
    print(f"  เริ่มใช้งาน 2024-01-01 (วิ่งครั้งแรกใน ม.ค. 2567): {sum(1 for r in out if r['start'] == '2024-01-01'):,} คัน")
    print(f"  คันที่เคยวิ่งมากกว่า 1 ชนิด: {len(multi):,} คัน")
    print(f"  สาขาใหม่ที่เพิ่มเข้า enums.json: {new_br or '-'}")
    print(f"  ชนิดรถที่แมป: {KIND_MAP}")


def main() -> None:
    ap = argparse.ArgumentParser(description="สร้าง refdata/fleet.json จากไฟล์ทะเบียนในกองรถ")
    ap.add_argument("src", type=Path, nargs="?", default=ROOT / "ทะเบียนในกองรถ.xlsx")
    a = ap.parse_args()
    if not a.src.exists():
        sys.exit(f"ไม่พบไฟล์ {a.src}")
    build(a.src)


if __name__ == "__main__":
    main()
