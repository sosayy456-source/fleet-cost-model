"""แคชแถวของชีตแรกในไฟล์ .xlsx ที่อ่านแล้ว — อ่าน .xlsx ครั้งเดียว รอบต่อไปอ่านจากแคช

ไฟล์รายได้จริง 29 ไฟล์เกือบ 2 ล้านแถว ถูกอ่านซ้ำ 4 รอบต่อการวางไฟล์ครั้งเดียว
(build_costrev 1 · build_alloc 3 — ตัวหาร · ปัน · บิล Top 10) แต่ละรอบต้องแตก zip + XML ใหม่หมด
ดู docs/แผนแก้-ข้อมูลจริงช้า.md ข้อ 4

★ เก็บแถวดิบตามที่ตัวอ่าน (calamine) คืนมาทุกค่า ผ่าน pickle ซึ่งคืน float/str/datetime/None ได้ตรงตัว
  ผลของ ETL จึงเท่าเดิมทุกค่า — แคชเปลี่ยนแค่ความเร็ว
★ คีย์ = ที่อยู่ไฟล์ + ขนาด + เวลาแก้ไข (ns) + รุ่นของตัวอ่าน → แก้/แทนไฟล์ = คีย์ใหม่ อ่านจาก .xlsx ใหม่เอง
★ อยู่ใน etl/.cache/sheets/ (ติด .gitignore — เป็นข้อมูลดิบของลูกค้า ห้ามขึ้น repo · ห้ามอยู่ใต้ app/public/)
  ลบทั้งโฟลเดอร์ได้ทุกเมื่อ รอบหน้าแค่ช้าเท่าเดิม
★ เขียน/อ่านแคชพังด้วยเหตุใดก็ตาม = อ่าน .xlsx ตามปกติ ไม่ล้ม ETL
"""
from __future__ import annotations

import hashlib
import pickle
import zlib
from pathlib import Path
from typing import Callable

CACHE_DIR = Path(__file__).resolve().parents[1] / ".cache" / "sheets"
#: เพิ่มเลขนี้เมื่อรูปของสิ่งที่เก็บเปลี่ยน — แคชเก่าทั้งหมดจะไม่ถูกใช้
VERSION = 1


def _names(path: Path, reader: str) -> tuple[str, str]:
    st = path.stat()
    who = hashlib.sha1(str(path.resolve()).encode("utf-8")).hexdigest()[:16]
    sig = hashlib.sha1(f"{VERSION}|{reader}|{st.st_size}|{st.st_mtime_ns}".encode()).hexdigest()[:16]
    return who, sig


def cached_rows(path: Path, reader: str, read: Callable[[], list]) -> list:
    """แถวทั้งชีตของ path — มีในแคชใช้แคช ไม่มีเรียก read() แล้วเก็บ

    reader = ชื่อ+รุ่นของตัวอ่าน (เปลี่ยนตัวอ่าน = ค่าอาจต่างชนิด ต้องไม่ใช้แคชร่วมกัน)
    """
    try:
        who, sig = _names(path, reader)
        f = CACHE_DIR / f"{who}-{sig}.pkl.z"
        if f.exists():
            return pickle.loads(zlib.decompress(f.read_bytes()))
    except Exception:  # noqa: BLE001 — แคชเสีย/อ่านไม่ได้ = อ่านไฟล์จริง
        who = sig = ""
    rows = read()
    if who:
        try:
            CACHE_DIR.mkdir(parents=True, exist_ok=True)
            tmp = CACHE_DIR / f"{who}-{sig}.tmp"
            tmp.write_bytes(zlib.compress(pickle.dumps(rows, protocol=pickle.HIGHEST_PROTOCOL), 1))
            # แคชรุ่นก่อนของไฟล์เดียวกันไม่มีทางถูกใช้อีก — ลบทิ้งกันโฟลเดอร์บวม
            for old in CACHE_DIR.glob(f"{who}-*.pkl.z"):
                old.unlink(missing_ok=True)
            tmp.replace(CACHE_DIR / f"{who}-{sig}.pkl.z")
        except Exception:  # noqa: BLE001 — ดิสก์เต็ม/ไฟล์ล็อก ข้ามการแคชรอบนี้
            pass
    return rows
