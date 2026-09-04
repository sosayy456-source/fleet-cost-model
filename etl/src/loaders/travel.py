"""
loaders/travel.py — ค่าเดินทาง (ยังไม่มีข้อมูลจริง)

โครงรอไว้เฉย ๆ ยังเขียน loader ไม่ได้เพราะยังไม่เห็นไฟล์
เมื่อได้ไฟล์มา: วางใน etl/data/travel/ แล้วรัน

    python build_json.py --inspect travel

จะพิมพ์ชื่อคอลัมน์จริงออกมา เอามาเติมใน EXPECTED_COLUMNS แล้วเขียน load_raw()
โดยลอกโครงจาก loaders/revenue.py ได้เลย (discover_files กับ read_one_file ใช้ร่วมกันได้)
"""

from __future__ import annotations

# TODO: เติมเมื่อรู้ schema จริง
EXPECTED_COLUMNS: list[str] = []



# หมายเหตุ: ชื่อ "ค่าเดินทาง" ซ้ำกับแท็บใน Google Sheet ที่เก็บใบรายการเดินรถ
# ถ้าไฟล์ที่ได้เป็นข้อมูลชุดเดียวกัน อาจไม่ต้องมี loader นี้เลย
# ให้ดึงผ่าน action loadOld ของ Apps Script แทน
LIKELY_USEFUL = ["เลขที่ใบรายการ", "วันที่", "ทะเบียนรถ", "ต้นทาง", "ปลายทาง"]
