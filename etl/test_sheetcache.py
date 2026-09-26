"""แคชแถวของ .xlsx (src/sheetcache.py) — ต้องคืนค่าเดิมทุกชนิด และอ่านใหม่เมื่อไฟล์เปลี่ยน"""
import os
from datetime import datetime

from src import sheetcache


def test_cache_hit_returns_same_values_and_skips_reader(tmp_path, monkeypatch):
    monkeypatch.setattr(sheetcache, "CACHE_DIR", tmp_path / "cache")
    src = tmp_path / "a.xlsx"
    src.write_bytes(b"x" * 10)
    rows = [["เลขที่", 6250753132426.0, None, datetime(2026, 3, 1, 8, 30), True, ""]]
    calls = []

    def read():
        calls.append(1)
        return rows

    assert sheetcache.cached_rows(src, "r1", read) == rows
    again = sheetcache.cached_rows(src, "r1", read)
    assert again == rows and len(calls) == 1
    assert type(again[0][1]) is float and type(again[0][3]) is datetime


def test_changed_file_or_reader_reads_again(tmp_path, monkeypatch):
    monkeypatch.setattr(sheetcache, "CACHE_DIR", tmp_path / "cache")
    src = tmp_path / "a.xlsx"
    src.write_bytes(b"x" * 10)
    n = []
    sheetcache.cached_rows(src, "r1", lambda: n.append(1) or [[1]])
    src.write_bytes(b"y" * 11)                       # ขนาดเปลี่ยน
    assert sheetcache.cached_rows(src, "r1", lambda: n.append(1) or [[2]]) == [[2]]
    st = src.stat()
    os.utime(src, ns=(st.st_atime_ns, st.st_mtime_ns + 10**9))   # ขนาดเท่าเดิมแต่แก้ไฟล์
    assert sheetcache.cached_rows(src, "r1", lambda: n.append(1) or [[3]]) == [[3]]
    assert sheetcache.cached_rows(src, "r2", lambda: n.append(1) or [[4]]) == [[4]]   # เปลี่ยนตัวอ่าน
    assert len(n) == 4
    # แคชรุ่นก่อนของไฟล์เดียวกันถูกลบ เหลือไฟล์เดียว
    assert len(list((tmp_path / "cache").glob("*.pkl.z"))) == 1


def test_broken_cache_falls_back_to_reader(tmp_path, monkeypatch):
    monkeypatch.setattr(sheetcache, "CACHE_DIR", tmp_path / "cache")
    src = tmp_path / "a.xlsx"
    src.write_bytes(b"x")
    sheetcache.cached_rows(src, "r1", lambda: [[1]])
    for f in (tmp_path / "cache").glob("*.pkl.z"):
        f.write_bytes(b"garbage")
    assert sheetcache.cached_rows(src, "r1", lambda: [[9]]) == [[9]]
