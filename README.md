# โมเดลต้นทุนการเดินรถ

โมเดลคำนวณต้นทุนต่อเที่ยววิ่ง พร้อมระบบติดตามลูกหนี้รายบิล และแดชบอร์ดรวมรายได้เข้ากับต้นทุน

เว็บตัวอย่าง: **https://sosayy456-source.github.io/fleet-cost-model/** (ข้อมูลตัวอย่างเท่านั้น)

---

## ระบบทำงานยังไง

ข้อมูลแบ่งเป็น 2 เส้นทางที่ไม่ปนกัน

```
              ┌──────── เขียน (ข้อมูลใหม่) ────────┐
              │                                    ▼
┌─────────┐  ┌┴──────────────┐   HTTP POST   ┌──────────────────┐
│ ผู้ใช้กรอก│─▶│  React SPA    │◀─────────────│ Apps Script /exec│
│  ฟอร์ม   │  │  (Vite)       │     JSON      │  v10 → Google Sheet│
└─────────┘  └┬──────────────┘               └──────────────────┘
              │
              │ fetch() ไฟล์ static
              ▼
       ┌──────────────────┐      ┌────────────┐      ┌───────────┐
       │ public/data/*.json│◀────│ ETL (pandas)│◀────│ Excel บิล │
       │  (cube สรุปแล้ว)  │ build└────────────┘ read └───────────┘
       └──────────────────┘
```

| | ข้อมูล**ใหม่** | ข้อมูล**เก่า** |
|---|---|---|
| ลักษณะ | กรอกเข้ามาทีละใบ แก้ไขได้ | นิ่งแล้ว อ่านอย่างเดียว |
| เก็บที่ | Google Sheet (ผ่าน Apps Script) | ไฟล์ JSON ที่ ETL สร้างตอน build |
| ปริมาณ | หลักพันใบ | 144,993 แถว → ยุบเป็น cube 2,916 แถว |
| ในเบราว์เซอร์ | IndexedDB (สำเนา + ใช้ตอนออฟไลน์) | โหลด JSON ตรง กรองในเครื่อง |

**ทำไมข้อมูลเก่าต้องสรุปก่อน** — ส่งแถวดิบแสนกว่าแถวเข้าเบราว์เซอร์ไม่ไหว แต่ถ้าเก็บแค่ผลรวมสำเร็จรูปก็กรองอะไรไม่ได้เลย (จุดอ่อนของ Streamlit เดิม) ทางออกคือ cube ที่ grain หยาบพอจะเล็ก แต่ละเอียดพอจะ re-aggregate ในเบราว์เซอร์ได้

---

## โครงสร้างโปรเจกต์

```
app/                    React + TypeScript + Vite  ← แอปหลัก
├─ src/lib/cost/        ★ สูตรต้นทุน — pure function มี golden test
├─ src/lib/refdata/     ราคาน้ำมัน · อัตราสิ้นเปลือง · ระยะทาง · ค่าซ่อม (JSON)
├─ src/lib/sheet/       ตัวเชื่อม Apps Script
├─ src/lib/store/       IndexedDB · ทะเบียนรถ · ค่าที่ผู้ใช้แก้เอง
├─ src/features/        หน้าจอทั้ง 8 หน้า
├─ public/data/sample/  ข้อมูลตัวอย่าง (commit ขึ้น repo — Pages ใช้ตัวนี้)
├─ public/data/real/    ★ gitignore — สร้างในเครื่องเท่านั้น
└─ tools/               สคริปต์ดึงข้อมูลออกจากไฟล์ v5 เดิม

etl/                    Python + pandas
├─ build_json.py        entry point
├─ src/loaders/         revenue.py (ใช้แล้ว) · repair.py · travel.py (รอข้อมูล)
├─ sample_data/         ไฟล์ตัวอย่าง commit ได้
└─ data/                ★ gitignore — วางไฟล์ Excel จริงที่นี่

apps-script/Code.gs     ★ โค้ดที่ deploy จริง (v10) — ตัวนี้เท่านั้นที่ใช้ได้
.github/workflows/      deploy ขึ้น GitHub Pages
```

### ไฟล์เก่าที่เก็บไว้อ้างอิง (ไม่ใช้แล้ว)

- `โมเดลเดินรถ-gsheet-v5.html` — ไฟล์เดียว 4.96 MB ที่ใช้งานจริงก่อนรื้อ **หน้าตาของแอปปัจจุบันยกมาจากไฟล์นี้ทั้งหมด**
- `AppsScript-โค้ด.gs` — สคริปต์ **v9** ใช้กับแอปปัจจุบันไม่ได้ (ไม่มี action `loadTrips` และไม่มีคอลัมน์ workflow 3 ฝ่าย)
- `AppsScript-โมเดลเดินรถ/` — รุ่นที่รัน UI บน Apps Script โดยตรง เลิกใช้แล้ว
- `RevenueDashboard/` — แดชบอร์ด Streamlit เดิม ยุบเข้า React หมดแล้ว

> ⚠️ **เวอร์ชันต้องตรงกัน** — `apps-script/Code.gs` มี `VERSION = 10` และ frontend เช็ค `GS_VERSION = 10` ถ้าไม่ตรงจะบันทึกไม่ได้และขึ้นข้อความบอกให้ Deploy ใหม่

---

## วิธีรัน

### แอป

```bash
cd app
npm install
npm run dev          # ข้อมูลตัวอย่าง → http://localhost:5173/fleet-cost-model/
```

ข้อมูลจริง (ต้องรัน ETL ก่อน):

```bash
VITE_DATASET=real npm run dev
```

> **Windows PowerShell** ถ้าขึ้น `npm.ps1 cannot be loaded because running scripts is disabled`
> ให้ใช้ `npm.cmd run dev` แทน (ไม่ต้องไปแก้ ExecutionPolicy ของเครื่อง)

### ETL

```bash
cd etl
pip install -r requirements.txt
python build_json.py --dataset sample     # ใช้ etl/sample_data/
python build_json.py --dataset real       # ใช้ etl/data/revenue/
python build_json.py --inspect data/revenue       # ดูว่าไฟล์มีคอลัมน์อะไรบ้าง
```

ผลลัพธ์ลงที่ `app/public/data/<dataset>/`

### เทสต์

```bash
cd app && npm test          # 20 ตัว — golden test สูตรต้นทุน + schema ของชีต
cd etl && python -m pytest  # snapshot test บน sample_data
```

`npm test` เทียบผลของ `computeCost` กับค่าที่ได้จากการรัน **โค้ด v5 ตัวจริง** ในแซนด์บ็อกซ์ 400 เคส ต้องตรงกันทุกฟิลด์ ถ้าสูตรเพี้ยนจะจับได้ทันที

---

## Deploy

push ขึ้น branch `โมเดล-Anda` แล้ว [workflow](.github/workflows/deploy.yml) จะ build และ deploy ให้อัตโนมัติ

workflow **บังคับ `VITE_DATASET=sample` เสมอ** และมีขั้นตอนที่ fail ทันทีถ้าเจอไฟล์ใน `public/data/real/` — Pages เป็นเว็บสาธารณะ ข้อมูลจริงขึ้นไม่ได้

ตั้งค่าที่ต้องทำครั้งเดียว (ต้องเป็นเจ้าของ repo):
- Settings → Pages → Source = **GitHub Actions**
- Settings → Environments → `github-pages` → Deployment branches ต้องอนุญาต `โมเดล-Anda`

---

## เชื่อม Google Sheet

1. เปิด Google Sheet → **ส่วนขยาย → Apps Script**
2. วางโค้ดจาก `apps-script/Code.gs` ทับของเดิม → บันทึก
3. **Deploy → New deployment** → Web app · Execute as **Me** · Who has access **Anyone**
4. คัดลอก URL ที่ลงท้าย `/exec` มาวางในแอป (หน้า “รายการทั้งหมด” → ⚙ ตั้งค่าการเชื่อม Google Sheet)

ระบบสร้าง 2 ชีตให้เอง: `บันทึกเดินรถ` (1 แถว = 1 ใบรายการ) และ `รายการลูกหนี้` (1 แถว = ลูกหนี้ 1 ราย)

> ลิงก์ `/exec` เก็บใน localStorage ของเครื่องเท่านั้น **ไม่ commit ขึ้น repo**

---

## เรื่องที่ต้องรู้ก่อนแก้โค้ด

**สูตรต้นทุนอยู่ที่เดียว** — `app/src/lib/cost/computeCost.ts` ของเดิมเขียนซ้ำ 3 ที่แล้วต้องให้ผลตรงกันตลอดไปโดยไม่มีอะไรบังคับ

**`normal` กับ `sheetTotal` ไม่สมมาตรกัน — ตั้งใจ ไม่ใช่บั๊ก**
```
normal     = แก๊ส + น้ำมัน + ค่าแรง + ค่าธรรมเนียม + ค่าซ่อม     (ไม่รวมสูญเปล่า)
sheetTotal = แก๊ส + น้ำมัน + ค่าแรง + ค่าธรรมเนียม + สูญเปล่า   (ไม่รวมค่าซ่อม)
```
`sheetTotal` มีไว้ให้ตรงกับคอลัมน์ 9–28 ของชีตเดิมเท่านั้น อย่า "แก้ให้เหมือนกัน"

**การบันทึกเป็น read-modify-write** — โหลดใบล่าสุดจากชีต → ทับเฉพาะฟิลด์ของฝ่ายตัวเอง → เขียนกลับ **ถ้าอ่านชีตไม่สำเร็จต้องยกเลิกการบันทึก** ไม่ใช่เขียนทับ ไม่งั้นงานฝ่ายอื่นหาย

**Content-Type ต้องเป็น `text/plain`** — ถ้าเปลี่ยนเป็น `application/json` เบราว์เซอร์จะยิง CORS preflight ซึ่ง Apps Script ไม่มี `doOptions` รองรับ แล้วจะพังทันที

**แกนกราฟต้องเขียน `<XAxis>` ตรง ๆ** — Recharts หาลูกของกราฟจาก `displayName` ถ้าห่อไว้ในคอมโพเนนต์ของเราเอง แกนกับกริดจะหายทั้งใบโดยไม่มี error

---

## ข้อจำกัดที่รู้อยู่

| เรื่อง | รายละเอียด |
|---|---|
| ไม่มีระบบล็อกอิน | ใครมีลิงก์ `/exec` ก็เขียน/ลบข้อมูลได้ — รับได้ในงานสัมมนา |
| เขียนทับด้วยข้อมูลเก่าได้ | ระหว่าง `loadTrips()` กับ `pushRecords()` ถ้าฝ่ายอื่นบันทึกแทรก งานจะหายเงียบ (Apps Script ล็อกแค่ตอนเขียน) |
| ค่าที่แก้เองอยู่แยกเครื่อง | ราคาน้ำมัน/ค่าซ่อมที่ผู้ใช้แก้เก็บใน localStorage ของแต่ละเครื่อง 3 ฝ่ายจึงคำนวณไม่ตรงกันได้ |
| เพดาน Google Sheet | 10 ล้านเซลล์ ที่ ~60 คอลัมน์ ≈ 166,000 ใบ และทุกครั้งที่บันทึกจะอ่านคอลัมน์ id ของทุกแถว |
| `custmap.bin` ไม่อยู่ใน repo | มาจากข้อมูลลูกค้าจริง สร้างในเครื่องด้วย `python etl/build_custmap.py "แปลงรหัสลูกหนี้รวม.xlsx"` |

---

## ประวัติเวอร์ชัน

ดูที่ Git commit log — ทุกจุดแก้ไขมีข้อความอธิบายว่าเปลี่ยนอะไรและทำไม
