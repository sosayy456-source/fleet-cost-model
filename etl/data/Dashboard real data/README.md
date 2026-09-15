# ไฟล์ต้นทุน+รายได้รายเที่ยว (realalldata)

วางไฟล์ `RealCostandRevenue.xlsx` ไว้ที่นี่ — คอลัมน์ต้องเหมือน `etl/sample_data/ExampleCostandRevenue.xlsx`
ทุกประการ (64 คอลัมน์ มีแถวหัวกลุ่มอยู่เหนือหัวคอลัมน์จริง สคริปต์หาแถวหัวเอง)

**ทุกอย่างในโฟลเดอร์นี้ติด .gitignore ยกเว้น README นี้** — ข้อมูลจริงไม่ขึ้น GitHub

## ทำงานคู่กับข้อมูลรายได้จริง

`etl/build_costrev.py` จับคู่ `เลขที่ใบรายการ` ในไฟล์นี้กับไฟล์รายได้ใน `etl/data/revenue/`
(ข้อมูลรายได้จริง 29 ไฟล์) เที่ยวที่จับคู่ได้เท่านั้นที่ไปโชว์ใน **Executive Dashboard**
ส่วน **Dashboard รวม** ใช้ทุกแถวในไฟล์นี้ — ต้องวางไฟล์รายได้ก่อนหรือพร้อมกัน ไม่งั้น Executive จะว่าง

## วิธีใช้

1. วาง `.xlsx` ที่นี่ (ตอน `npm run dev` รันอยู่ก็ได้)
2. dev server รัน `build_costrev.py --dataset real` ให้เอง (ดู `[etl]` ใน terminal) และรันซ้ำเองเมื่อไฟล์รายได้เปลี่ยน
3. หน้า Executive / Dashboard รวม ขึ้น "กำลังแปลง…" แล้วรีเฟรชเองเมื่อเสร็จ

รันเองได้ด้วย `python etl/build_costrev.py --dataset real` → `app/public/data/real/costrev/`
