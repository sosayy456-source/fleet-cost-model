"""
loaders/repair.py — ค่าซ่อมแซม (ยังไม่มีข้อมูลจริง)

โครงรอไว้เฉย ๆ ยังเขียน loader ไม่ได้เพราะยังไม่เห็นไฟล์
เมื่อได้ไฟล์มา: วางใน etl/data/repair/ แล้วรัน

    python build_json.py --inspect repair

จะพิมพ์ชื่อคอลัมน์จริงออกมา เอามาเติมใน EXPECTED_COLUMNS แล้วเขียน load_raw()
โดยลอกโครงจาก loaders/revenue.py ได้เลย (discover_files กับ read_one_file ใช้ร่วมกันได้)
"""

from __future__ import annotations

# TODO: เติมเมื่อรู้ schema จริง
EXPECTED_COLUMNS: list[str] = []

# ถ้ามีสามอย่างนี้ครบจะใช้แทนตารางค่าซ่อมถัวเฉลี่ย 3 ปีใน
# app/src/lib/refdata/repair.json ได้ (ตอนนี้ 9 จาก 12 ชนิดรถข้อมูลไม่ครบ)
LIKELY_USEFUL = ["ทะเบียนรถ", "วันที่ซ่อม", "ประเภทการซ่อม", "ค่าใช้จ่าย"]
