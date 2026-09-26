"""trips.json แบบคอลัมน์ต้องย้อนกลับได้เท่าแบบแถวทุกฟิลด์ (src/tripcols.py)"""
import json

from src.tripcols import decode, encode


def _trip(**kw):
    base = {
        "id": "6250753132426", "d": "2026-03-01", "y": 2026, "br": "เชียงใหม่", "km": None,
        "rev": 1200.5, "cost": 800.0, "empty": False, "m": True, "bn": 2,
        "cus": ["a" * 64, "b" * 64], "wt": 0.0,
        "vs": [{"pl": "70-1234", "vk": "รถ 10 ล้อ", "ft": "รถบริษัท", "c": 800.0, "d": 12.5}],
        "serviceRevenue": {"สินค้าทั่วไป": 1200.5},
    }
    base.update(kw)
    return base


def _roundtrip(trips):
    enc = encode(trips)
    assert enc is not None
    # ผ่าน JSON เหมือนของจริง (tuple/float ต้องไม่เพี้ยน)
    return decode(json.loads(json.dumps(enc, ensure_ascii=False)))


def test_roundtrip_equal():
    trips = [
        _trip(),
        _trip(id="6250753132427", km=512, empty=True, m=False, cus=[], vs=[], serviceRevenue={}),
        _trip(id="6250753132428", br="ลำปาง", cus=["b" * 64],
              vs=[{"pl": "1", "vk": "หัวลาก", "ft": "รถร่วม", "c": 1.0, "d": 0.0},
                  {"pl": "2", "vk": "หางพ่วง", "ft": "รถร่วม", "c": 2.0, "d": 1.0}]),
    ]
    assert _roundtrip(trips) == trips


def test_bool_stays_bool():
    out = _roundtrip([_trip(), _trip(id="x", empty=True)])
    assert out[1]["empty"] is True and out[0]["empty"] is False


def test_strings_shared_in_table():
    trips = [_trip(id=str(i)) for i in range(10)]
    enc = encode(trips)
    assert enc["str"].count("a" * 64) == 1
    assert enc["cols"]["id"]["t"] == "r"      # เลขที่ใบไม่ซ้ำ ไม่เข้าตาราง
    assert enc["cols"]["br"]["t"] == "s"


def test_unknown_shape_falls_back():
    assert encode([_trip(), {**_trip(), "extra": 1}]) is None              # คีย์ไม่เท่ากัน
    assert encode([_trip(), _trip(id="y", br=5)]) is None                   # ชนิดปนกัน
    assert encode([_trip(vs=[{"pl": "1"}]), _trip(id="z")]) is None         # object ใน list คีย์ไม่ตรง
    assert encode([]) is None
