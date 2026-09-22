# etl/data/Loadfactor/

วางไฟล์ **Load Factor รายเที่ยว** (`.xlsx`) ไว้ที่นี่ แล้ว dev server จะแปลงให้เองภายใน 2-3 วินาที
(plugin `autoEtl` ใน `app/vite.config.ts` → `python etl/build_loadfactor.py --dataset real`)
ผลลัพธ์ไปที่ `app/public/data/real/loadfactor/` ซึ่งแท็บ "ต้นทุนที่จมกับที่ว่าง" ใน Executive Dashboard อ่านอยู่

โครงคอลัมน์ต้องเหมือนไฟล์ตัวอย่าง `etl/sample_data/LoadFactor/ExampleLoadfactor.xlsx` (Book1 A–AV)
ETL อ่านด้วยชื่อคอลัมน์ ไม่ใช่ตำแหน่ง — คอลัมน์ที่ต้องมี: `เลขที่ใบรายการ` · `(Max LF)` · `ต้นทุนรวม` · `รายได้` ·
`เป้าของกลุ่ม` · `ชนิดรถ` · `เส้นทางมาตรฐาน` (รายละเอียดใน docstring ของ `etl/build_loadfactor.py`)
วางหลายไฟล์ได้ ระบบรวมให้ (เลขที่ใบรายการซ้ำเก็บแถวแรก) และข้ามไฟล์ที่ไม่มีคอลัมน์ข้างต้น

นับเฉพาะแถวที่ `สถานะข้อมูล` เป็น **ปกติ** หรือ **เฝ้าระวัง** — Outlier/ผิดพลาด/ไม่นับ ถูกตัดทิ้งและนับไว้ใน `manifest.json`

ไฟล์ในโฟลเดอร์นี้ไม่ขึ้น repo (`.gitignore` กัน `etl/data/*` ไว้แล้ว ยกเว้น README)
