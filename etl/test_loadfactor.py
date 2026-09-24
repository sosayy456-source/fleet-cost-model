"""เติมระยะทางให้ไฟล์ Load Factor จากตารางระยะทางของโมเดล (build_loadfactor.route_km · 24 ก.ย. 2569)

แถวที่ไฟล์ไม่มีระยะทาง (ว่าง/0) เติมจาก routes.json ด้วย "เส้นทางมาตรฐาน" · แถวที่มีระยะทางอยู่แล้วต้องใช้ค่าในไฟล์ต่อ
"""
import json
from pathlib import Path

from build_loadfactor import ROUTES_JSON, SAMPLE_DIR, read_file, route_km

ROUTES = {"เชียงใหม่": {"ปากคลองตลาด": 720}, "พุทธมณฑลสาย 5": {"เถิน": 500}}


def test_ค้นได้ทั้งสองทิศและชื่อที่มีเว้นวรรค():  # noqa: N802
    assert route_km("เชียงใหม่-ปากคลองตลาด", ROUTES) == 720
    assert route_km("ปากคลองตลาด-เชียงใหม่", ROUTES) == 720
    assert route_km("พุทธมณฑลสาย  5-เถิน", ROUTES) == 500   # เว้นวรรคซ้อนยุบเป็นช่องเดียว
    assert route_km("เถิน-ร่มเกล้า", ROUTES) is None
    assert route_km("", ROUTES) is None


def test_ไฟล์ตัวอย่าง_เติมเฉพาะแถวที่ไม่มีระยะทาง():  # noqa: N802
    routes = json.loads(Path(ROUTES_JSON).read_text(encoding="utf-8"))
    path = next(Path(SAMPLE_DIR).glob("*.xlsx"))
    fill = {"filled": 0, "missing": 0, "missingRoutes": {}}
    trips, _ = read_file(path, routes, fill)
    raw, _ = read_file(path)                       # ไม่ส่งตาราง = ไม่เติม (พฤติกรรมเดิม)
    by_id = {t["id"]: t["km"] for t in raw}
    # ชุดตัวอย่างมี 14 แถวที่ไม่มีระยะทาง (เส้นทางของเถิน) ซึ่งเพิ่มลง routes.json แล้ว 24 ก.ย. 2569
    assert fill["filled"] == 14 and fill["missing"] == 0
    for t in trips:
        if by_id[t["id"]] and by_id[t["id"]] > 0:
            assert t["km"] == by_id[t["id"]]         # มีในไฟล์ → ใช้ค่าในไฟล์
        else:
            assert t["km"] and t["km"] > 0            # ไม่มีในไฟล์ → เติมแล้ว
