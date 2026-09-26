"""ตัดคลิปสาธิตโมเดลเป็นวิดีโอสั้นตามตาราง src/data/tour.json → public/clips/tour.{webm,mp4}

ใช้:  python tools/build-tour.py "clips/<ไฟล์ที่อัด>.mp4"
      (ffmpeg: ใช้ตัวบน PATH หรือกำหนด FFMPEG=<path> — เครื่องนี้ใช้ตัวใน tmp/pyff ที่ติดตั้งผ่าน imageio-ffmpeg)

★ ตารางช่วง (from/to/speed) อยู่ใน tour.json ที่เดียว — หน้าเว็บ (src/tour/Tour.tsx) อ่านไฟล์เดียวกันแล้วคิดเวลาในวิดีโอที่ตัดแล้วเอง
  แก้ช่วง/ความเร็วแล้วต้องรันสคริปต์นี้ใหม่ คำอธิบายบนจอจะตรงกับภาพเสมอ
★ คลิปและผลลัพธ์อยู่นอก git (presentation/.gitignore: clips/ · public/clips/) — ไฟล์ใหญ่และอาจมีข้อมูลจริง
★ ทำสองไฟล์: WebM (VP9) ให้ Chromium ทุกตัว + MP4 (H.264) สำรองให้ Safari/เครื่องที่ไม่มี VP9 · ไม่มีเสียง
"""
import glob
import json
import os
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent.parent
OUT = HERE / "public" / "clips"


def ffmpeg() -> str:
    if os.environ.get("FFMPEG"):
        return os.environ["FFMPEG"]
    local = glob.glob(str(HERE.parent / "tmp" / "pyff" / "imageio_ffmpeg" / "binaries" / "ffmpeg*.exe"))
    return local[0] if local else "ffmpeg"


def main() -> None:
    if len(sys.argv) < 2:
        sys.exit("ต้องระบุไฟล์คลิปต้นฉบับ")
    src = sys.argv[1]
    tour = json.loads((HERE / "src" / "data" / "tour.json").read_text(encoding="utf-8"))
    parts, labels = [], []
    for i, s in enumerate(tour["segments"]):
        # ตัดช่วง → เร่งความเร็ว → 30 fps คงที่ (เฟรมเท่ากันทุกช่วง เล่นลื่นและกระโดดเวลาได้แม่น)
        parts.append(f"[0:v]trim=start={s['from']}:end={s['to']},setpts=(PTS-STARTPTS)/{s['speed']},fps=30,"
                     f"scale=1920:1080:flags=lanczos,setsar=1[v{i}]")
        labels.append(f"[v{i}]")
    graph = ";".join(parts) + f";{''.join(labels)}concat=n={len(labels)}:v=1:a=0[out]"
    OUT.mkdir(parents=True, exist_ok=True)
    base = [ffmpeg(), "-hide_banner", "-loglevel", "error", "-y", "-i", src, "-filter_complex", graph, "-map", "[out]", "-an"]
    # keyframe ทุก 1 วิ — กระโดดไปต้นช่วงด้วยปุ่ม → ได้ทันทีไม่ต้องถอดรหัสยาว
    subprocess.run(base + ["-c:v", "libvpx-vp9", "-crf", "34", "-b:v", "0", "-row-mt", "1", "-cpu-used", "4",
                           "-deadline", "good", "-g", "30", str(OUT / "tour.webm")], check=True)
    subprocess.run(base + ["-c:v", "libx264", "-crf", "24", "-preset", "medium", "-pix_fmt", "yuv420p", "-g", "30",
                           "-movflags", "+faststart", str(OUT / "tour.mp4")], check=True)
    total = sum((s["to"] - s["from"]) / s["speed"] for s in tour["segments"])
    for f in ("tour.webm", "tour.mp4"):
        print(f"{f}: {(OUT / f).stat().st_size / 1024 ** 2:.1f} MB")
    print(f"ความยาว {total:.1f} วินาที")


if __name__ == "__main__":
    main()
