"""
emit.py
=======
เขียนผลลัพธ์เป็นไฟล์ JSON ให้ frontend อ่าน

pandas/numpy มีชนิดข้อมูลที่ json มาตรฐานเขียนไม่ได้ (Timestamp, NaT, int64, NA)
ไฟล์นี้แปลงให้หมดก่อนเขียน และใช้ NaN -> null เสมอ เพื่อไม่ให้ JSON.parse ฝั่ง JS พัง
(json.dumps ปกติจะเขียน NaN ออกมาดื้อ ๆ ซึ่งไม่ใช่ JSON ที่ถูกต้อง)
"""

from __future__ import annotations

import json
import logging
import math
import os
from typing import Any

import numpy as np
import pandas as pd

log = logging.getLogger(__name__)


def to_jsonable(obj: Any) -> Any:
    """แปลงค่าจาก pandas/numpy ให้เป็นชนิดที่ json เขียนได้"""
    if obj is None or obj is pd.NaT:
        return None
    if isinstance(obj, (str, bool)):
        return obj
    if isinstance(obj, (np.bool_,)):
        return bool(obj)
    if isinstance(obj, (int, np.integer)):
        return int(obj)
    if isinstance(obj, (float, np.floating)):
        f = float(obj)
        return None if math.isnan(f) or math.isinf(f) else f
    if isinstance(obj, (pd.Timestamp,)):
        return None if pd.isna(obj) else obj.strftime("%Y-%m-%d")
    if isinstance(obj, pd.Period):
        return str(obj)
    if isinstance(obj, pd.DataFrame):
        return [to_jsonable(r) for r in obj.to_dict(orient="records")]
    if isinstance(obj, pd.Series):
        return to_jsonable(obj.to_dict())
    if isinstance(obj, dict):
        return {str(k): to_jsonable(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple, set, np.ndarray)):
        return [to_jsonable(v) for v in obj]
    # pd.NA และเพื่อน ๆ
    try:
        if pd.isna(obj):
            return None
    except (TypeError, ValueError):
        pass
    return str(obj)


def write_json(out_dir: str, name: str, payload: Any) -> int:
    """เขียนไฟล์เดียว คืนขนาดเป็นไบต์"""
    os.makedirs(out_dir, exist_ok=True)
    path = os.path.join(out_dir, name)
    text = json.dumps(to_jsonable(payload), ensure_ascii=False, separators=(",", ":"))
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(text)
    size = len(text.encode("utf-8"))
    log.info("  %-22s %8.1f KB", name, size / 1024)
    return size
