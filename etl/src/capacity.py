"""
ความจุรถ → Conversion Factor ของการปันส่วนต้นทุนเข้าบิล (เจ้าของงานสั่ง 27 ก.ย. 2569 · ใช้ใน build_alloc.py)

    CF (กก./ลบ.ม.) = Σ ความจุน้ำหนัก (กก.) ÷ Σ ความจุปริมาตร (ลบ.ม.) ของทุกคันในใบรายการ
                     (คันที่ 1 + คันที่ 2 + พ่วง — เจ้าของงานเลือก "หัว + หาง รวมกัน")

ความจุมาจาก app/src/lib/refdata/vehicles.json (capacityKg · volumeM3) ฐานเดียวกับหน้าจัดรถ
★ ค่าที่ผู้ใช้แก้ในหน้าตั้งค่าอยู่ใน localStorage ของเครื่องนั้น ETL อ่านไม่ได้ — จะให้ ETL ใช้ค่าใหม่ต้องแก้ vehicles.json แล้ว commit
★ ชนิดรถที่หาความจุไม่เจอ (ชื่อไม่ตรงตาราง/ชนิดเลิกใช้ที่ไม่มีปริมาตร) → ใช้ค่ากลาง CF ของรถในตาราง (เจ้าของงานเลือก)
  ไม่ใช่ตัวเลขตายตัว · ใบที่ใช้ค่ากลางนับไว้ใน manifest ให้ตามแก้ชื่อ/ความจุได้
"""
from __future__ import annotations

import json
import statistics
from pathlib import Path

from .alloc import conversion_factor

#: ชื่อชนิดรถในไฟล์ → ชื่อในตารางรถ — ต้องตรงกับ KIND_MAP (build_fleet.py) และ VEHICLE_ALIASES (app/src/lib/refdata/index.ts)
KIND_ALIASES = {
    "รถ 10 ล้อช่วงยาว": "รถ 10 ล้อยาว",
    "รถเทรเล่อร์ (แม่)": "รถเทรเลอร์",
    "รถ 10 ล้อพ่วง(ลูก)": "หางพ่วงคอก",
    "รถปิกอัพ": "รถปิกอัพ 3 ตัน",
}


def _key(name: str) -> str:
    """เทียบชื่อโดยไม่สนช่องว่าง — ไฟล์จริงมี "รถเทรเล่อร์(แม่)" กับ "รถเทรเล่อร์ (แม่)" ปนกัน"""
    return "".join(name.split())


class Capacity:
    """ตารางความจุรถ + ค่ากลาง CF สำหรับใบที่หาความจุไม่เจอ"""

    def __init__(self, vehicles_json: Path) -> None:
        rows = json.loads(vehicles_json.read_text(encoding="utf-8"))
        self.by_name: dict[str, tuple[float, float]] = {}
        for v in rows:
            kg, m3 = v.get("capacityKg"), v.get("volumeM3")
            if isinstance(kg, (int, float)) and isinstance(m3, (int, float)) and kg > 0 and m3 > 0:
                self.by_name[_key(v["name"])] = (float(kg), float(m3))
        cfs = [kg / m3 for kg, m3 in self.by_name.values()]
        #: ค่ากลาง CF ของรถทุกชนิดในตารางที่มีความจุครบ — ใช้แทนเมื่อหาความจุของใบไม่เจอ
        self.median_cf = statistics.median(cfs) if cfs else None
        self._aliases = {_key(k): _key(v) for k, v in KIND_ALIASES.items()}

    def of(self, kind: str) -> tuple[float, float] | None:
        k = _key(kind)
        return self.by_name.get(self._aliases.get(k, k))

    def trip_cf(self, kinds: list[str]) -> tuple[float | None, str, list[str]]:
        """(CF ของใบ, ที่มา "รถในใบ" / "ค่ากลาง", ชื่อชนิดที่หาไม่เจอ) — รวมความจุเฉพาะคันที่รู้"""
        kg = m3 = 0.0
        unknown: list[str] = []
        for kind in kinds:
            cap = self.of(kind)
            if cap is None:
                unknown.append(kind)
                continue
            kg += cap[0]
            m3 += cap[1]
        cf = conversion_factor(kg, m3)
        if cf is not None:
            return cf, CF_VEHICLE, unknown
        return self.median_cf, CF_MEDIAN, unknown


CF_VEHICLE = "รถในใบ"
CF_MEDIAN = "ค่ากลางของตารางรถ"
