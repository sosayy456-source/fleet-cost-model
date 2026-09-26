"""บอกความคืบหน้าของ ETL เป็น % ให้ plugin autoEtl (app/vite.config.ts) ส่งต่อไปแถบสถานะบนหน้าเว็บ

พิมพ์บรรทัด `##ETL## <เปอร์เซ็นต์> <ขั้นที่ทำอยู่>` — plugin ดักบรรทัดนี้ออกจาก log แล้วส่งเป็น pct/step
พิมพ์เฉพาะเมื่อ plugin ตั้ง ETL_PROGRESS=1 · รันเองใน terminal จะไม่เห็นบรรทัดพวกนี้

% คิดจากจำนวนไฟล์ที่ทำเสร็จในแต่ละช่วง (แต่ละสคริปต์กำหนดช่วงเอง) — ไม่ใช่เวลาที่เหลือจริง
ไฟล์ใหญ่เล็กไม่เท่ากัน และรอบที่อ่านจากแคช (src/sheetcache.py) เร็วกว่ารอบแรกมาก
"""
from __future__ import annotations

import os

_ON = os.environ.get("ETL_PROGRESS") == "1"
_last: tuple[int, str] | None = None


def report(pct: float, step: str = "") -> None:
    global _last
    if not _ON:
        return
    p = max(0, min(100, int(pct)))
    if (p, step) == _last:
        return
    _last = (p, step)
    print(f"##ETL## {p} {step}", flush=True)


def span(lo: float, hi: float, i: int, n: int, step: str) -> None:
    """ช่วง lo–hi % แบ่งตามจำนวน n ชิ้น — เรียกก่อนเริ่มชิ้นที่ i (นับจาก 0)"""
    report(lo + (hi - lo) * (i / n if n else 1), step)
