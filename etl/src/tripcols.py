"""เก็บ costrev/trips.json เป็นคอลัมน์ + ตารางข้อความ — ไฟล์เล็กลงและเบราว์เซอร์ใช้หน่วยความจำน้อยลง

ของเดิมเก็บ 1 แถว = 1 เที่ยว (object ~50 คีย์) ชื่อคีย์ซ้ำทุกแถว และข้อความที่ซ้ำกันเยอะ
(สาขา ชนิดรถ เส้นทาง รหัสลูกค้า hash 64 ตัว) ถูกเขียนซ้ำทุกเที่ยว — ข้อมูลจริงหลายหมื่นเที่ยว
ทำให้แท็บเบราว์เซอร์หน่วยความจำหมด ("แย่จัง!") · ดู docs/แผนแก้-ข้อมูลจริงช้า.md ข้อ 1

★ เปลี่ยนแค่วิธีเก็บ ไม่เปลี่ยนค่า — แอปแปลงกลับเป็น Trip[] ที่เท่ากับของเดิมทุกฟิลด์
  (app/src/lib/data/tripCols.ts · ตรวจด้วย app/tools/verify-trips.mjs)
★ ถ้าเจอรูปข้อมูลที่ไม่รู้จัก encode() คืน None แล้ว ETL เขียนแบบแถวเหมือนเดิม — แอปอ่านได้ทั้งสองแบบ

รูปไฟล์ {"format": "cols-1", "n": จำนวนเที่ยว, "str": [ตารางข้อความ], "cols": {คีย์: คอลัมน์}}
ชนิดคอลัมน์ ("t"):
    n   ตัวเลข/null ตรง ๆ            b   true/false เก็บเป็น 0/1
    s   ข้อความ → ลำดับในตาราง        r   ข้อความตรง ๆ (ค่าแทบไม่ซ้ำ เช่นเลขที่ใบรายการ)
    ls  list ของข้อความ → list ของลำดับ (cus)
    lo  list ของ object คีย์ชุดเดียวกัน → list ของ array ตามลำดับ "k" (vs) · "kt" = ชนิดของแต่ละคีย์ (s/n)
    do  dict ข้อความ → ตัวเลข → [ลำดับ, ค่า, ลำดับ, ค่า, …] (serviceRevenue)
"""
from __future__ import annotations

from typing import Any

FORMAT = "cols-1"


def _is_num(v: Any) -> bool:
    return v is None or (isinstance(v, (int, float)) and not isinstance(v, bool))


class _Strings:
    def __init__(self) -> None:
        self.index: dict[str, int] = {}
        self.table: list[str] = []

    def __call__(self, s: str) -> int:
        i = self.index.get(s)
        if i is None:
            i = self.index[s] = len(self.table)
            self.table.append(s)
        return i


def _kind(values: list[Any]) -> str | None:
    """ชนิดคอลัมน์จากค่าทุกแถว — None = ไม่รู้จัก (ให้ถอยไปเขียนแบบแถว)"""
    if all(isinstance(v, bool) for v in values):
        return "b"
    if all(_is_num(v) for v in values):
        return "n"
    if all(isinstance(v, str) for v in values):
        # ค่าเกือบไม่ซ้ำ (เลขที่ใบรายการ) ใส่ตารางแล้วไม่ได้อะไร
        return "r" if len(set(values)) > len(values) // 2 else "s"
    if all(isinstance(v, list) and all(isinstance(x, str) for x in v) for v in values):
        return "ls"
    if all(isinstance(v, dict) and all(isinstance(k, str) and _is_num(x) for k, x in v.items()) for v in values):
        return "do"
    if all(isinstance(v, list) and all(isinstance(x, dict) for x in v) for v in values):
        return "lo"
    return None


def _lo_spec(values: list[list[dict]]) -> tuple[list[str], list[str]] | None:
    """คีย์และชนิดของ object ใน list — ทุก object ต้องมีคีย์ชุดเดียวกันเรียงเหมือนกัน"""
    keys: list[str] | None = None
    types: list[str] = []
    for lst in values:
        for o in lst:
            ks = list(o.keys())
            if keys is None:
                keys = ks
                types = ["s" if isinstance(o[k], str) else "n" for k in ks]
            if ks != keys:
                return None
            for k, t in zip(ks, types):
                v = o[k]
                if (t == "s" and not isinstance(v, str)) or (t == "n" and not _is_num(v)):
                    return None
    return (keys or [], types)


def encode(trips: list[dict]) -> dict | None:
    """แปลง list ของเที่ยวเป็นรูปคอลัมน์ · None = มีรูปข้อมูลที่ไม่รู้จัก ให้เขียนแบบแถวแทน"""
    if not trips:
        return None
    keys = list(trips[0].keys())
    kset = set(keys)
    if any(set(t.keys()) != kset for t in trips):
        return None
    st = _Strings()
    cols: dict[str, dict] = {}
    for k in keys:
        values = [t[k] for t in trips]
        kind = _kind(values)
        if kind is None:
            return None
        if kind == "b":
            cols[k] = {"t": "b", "v": [1 if v else 0 for v in values]}
        elif kind in ("n", "r"):
            cols[k] = {"t": kind, "v": values}
        elif kind == "s":
            cols[k] = {"t": "s", "v": [st(v) for v in values]}
        elif kind == "ls":
            cols[k] = {"t": "ls", "v": [[st(x) for x in v] for v in values]}
        elif kind == "do":
            cols[k] = {"t": "do", "v": [[y for g, x in v.items() for y in (st(g), x)] for v in values]}
        else:  # lo
            spec = _lo_spec(values)
            if spec is None:
                return None
            ks, kt = spec
            cols[k] = {"t": "lo", "k": ks, "kt": kt, "v": [
                [[st(o[f]) if t == "s" else o[f] for f, t in zip(ks, kt)] for o in v] for v in values]}
    return {"format": FORMAT, "n": len(trips), "str": st.table, "cols": cols}


def decode(obj: dict) -> list[dict]:
    """ย้อนกลับเป็น list ของเที่ยว — ใช้ในเทสต์ (แอปมีตัวเดียวกันใน app/src/lib/data/tripCols.ts)"""
    s = obj["str"]
    out: list[dict] = [{} for _ in range(obj["n"])]
    for k, c in obj["cols"].items():
        t, v = c["t"], c["v"]
        for i, x in enumerate(v):
            if t == "b":
                out[i][k] = bool(x)
            elif t in ("n", "r"):
                out[i][k] = x
            elif t == "s":
                out[i][k] = s[x]
            elif t == "ls":
                out[i][k] = [s[j] for j in x]
            elif t == "do":
                out[i][k] = {s[x[j]]: x[j + 1] for j in range(0, len(x), 2)}
            else:
                out[i][k] = [{f: (s[a] if ft == "s" else a) for f, ft, a in zip(c["k"], c["kt"], arr)} for arr in x]
    return out
