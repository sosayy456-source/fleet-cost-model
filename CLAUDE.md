# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

โค้ดคอมเมนต์ เอกสาร และข้อความ commit ในโปรเจกต์นี้เป็นภาษาไทยทั้งหมด — เขียนของใหม่ให้เข้าชุดกัน

## คำสั่ง

```bash
cd app
npm ci                    # lockfile commit ไว้แล้ว ใช้ ci ไม่ใช่ install
npm run dev               # → http://localhost:5173/fleet-cost-model/  (ต้องมี path ย่อยด้วย)
npm run build             # tsc -b แล้วค่อย vite build
npm test                  # vitest run — 20 ตัว
npm test -- src/lib/cost/computeCost.test.ts     # เฉพาะไฟล์เดียว
npm test -- -t "ชื่อเทส"                          # เฉพาะเคสเดียว
npx tsc -b --force        # เช็ค type อย่างเดียว ไม่ build
```

`VITE_DATASET=real npm run dev` เพื่อใช้ข้อมูลจริง (ต้องรัน ETL ก่อน) — ค่าเริ่มต้นคือ `sample`

Windows PowerShell: ถ้า `npm.ps1 cannot be loaded` ให้ใช้ `npm.cmd run dev`

```bash
cd etl
python build_json.py --dataset sample    # → app/public/data/sample/
python -m pytest
```

สคริปต์ครั้งเดียวใน `app/tools/`: `extract-refdata.mjs` (ดึงตารางอ้างอิงออกจาก v5), `gen-golden.mjs` (สร้าง fixture ของ golden test), `extract-custmap.mjs` (สร้าง `custmap.bin` จากไฟล์ลูกค้าจริง — ไม่อยู่ใน repo)

## สถาปัตยกรรม

ข้อมูลเดินสองทางที่ไม่เกี่ยวกันเลย และเป็นกุญแจของทั้งระบบ:

```
ข้อมูลใหม่ (transactional)   ฟอร์ม → lib/sheet/client.ts → Apps Script /exec → Google Sheet
ข้อมูลเก่า (analytical)      Excel → etl/build_json.py → app/public/data/<dataset>/*.json → fetch
```

ทางแรกเขียนได้ ทางที่สองอ่านอย่างเดียวและแปลงล่วงหน้าตอน build — อย่าเอามาปนกัน

**`app/src/lib/` = ตรรกะ · `app/src/features/` = หน้าจอ** ฟีเจอร์ห้ามมีสูตรของตัวเอง

### สูตรต้นทุนมีที่เดียว

`lib/cost/computeCost.ts` เป็นแหล่งเดียว ของเดิมเขียนซ้ำ 3 ที่แล้วต้องให้ผลตรงกันตลอดโดยไม่มีอะไรบังคับ

`lib/cost/recCost.ts` ต่างออกไป — ทำงานกับ "ใบที่บันทึกแล้ว" ซึ่งอาจมาจากชีตเก่าที่มีแต่ยอดรวม จึงอ่านค่าที่เก็บไว้เป็นหลัก ส่วนแถวจากชีตเก่าที่ใช้สูตรคนละตัวอยู่ใน `lib/cost/adapters/oldRow.ts` แยกไว้ไม่ให้ปนกับสูตรหลัก

`npm test` เทียบ `computeCost` กับผลจากการรัน **โค้ด v5 ตัวจริง** ในแซนด์บ็อกซ์ 400 เคส ต้องตรงทุกฟิลด์ — เทสต์นี้คือ gate ของการแก้สูตร

### ข้อมูลอ้างอิง = ฐานกลาง + ค่าที่แก้เอง

`lib/refdata/*.json` คือฐานกลางที่ commit ขึ้น repo ส่วนที่ผู้ใช้แก้เอง (ราคาน้ำมัน/อัตราค่าซ่อม) อยู่ใน localStorage ผ่าน `lib/store/overrides.ts` และต้อง **ส่งเข้า `computeCost` อย่างชัดเจน** เป็นพารามิเตอร์ ไม่ใช่อ่านเองข้างใน

`refdata/repair.json` เก็บปีเป็น **เลขสองหลักของ ค.ศ.** — `"24"` = ค.ศ. 2024 = **พ.ศ. 2567** แปลงด้วย `2000 + Number(y) + 543` เท่านั้น อย่าเติม `"25"` ไปข้างหน้า

### workflow 3 ฝ่าย

`lib/record/roles.ts` ถือทั้งหมด: `ROLE_ORDER` (cs/dispatch/account — สามฝ่ายที่ต้องกรอกครบใบถึงจะสมบูรณ์), `ROLE_VIEWS` (แต่ละตำแหน่งเห็นเมนูไหน), `manager`/`admin` เป็นตำแหน่งดูอย่างเดียว/ดูแลระบบ **ไม่นับ**ในความครบถ้วน

การบันทึก (`lib/store/save.ts`) เป็น **read-modify-write ข้าม HTTP สองครั้ง** — โหลดใบล่าสุดจากชีต → ทับเฉพาะฟิลด์ของฝ่ายตัวเอง → เขียนกลับ **ถ้าอ่านชีตไม่สำเร็จต้องโยน `SaveAbortedError` ไม่ใช่เขียนทับ** ไม่งั้นงานฝ่ายอื่นหาย

### ที่เก็บในเครื่อง

IndexedDB (`lib/store/records.ts`, db `fleet-cost-model`) เป็นหลัก มี migration จาก localStorage ของ v5 ครั้งเดียว `migrateSchema()` ยกระดับใบเก่าเป็น `_v2/_v3/_v4` — **ธงพวกนี้ต้องถูกเขียนลงที่เก็บจริง** ไม่งั้นรอบหน้าขั้น `_v4done` จะประทับว่าฝ่ายนั้นกรอกแล้วทั้งที่ยังไม่ได้กรอก

`_v4` ยังเป็นตัวกรองของส่วน Load Factor ในแดชบอร์ด — ใบก่อนหน้านั้นไม่มีช่องความจุ ถ้าไม่กรองออกจะถูกอ่านว่า "ความจุ 0" แล้วโผล่เป็นเที่ยวเสียโอกาสทั้งหมด

`useRecords()` ต้องรอ migration ให้จบก่อนอ่าน IndexedDB ไม่งั้นรอบแรกได้ลิสต์ว่าง

## กติกาที่พลาดแล้วพัง

**`index.css` ส่วนที่ 1 คัดลอกมาจาก `<style>` ของ `index.html` บน branch `main` ทั้งดุ้น ห้ามแก้** ของใหม่ให้เติมในส่วนที่ 2 ท้ายไฟล์ (มีคอมเมนต์คั่นไว้) — เทียบความตรงด้วยการ diff กับต้นฉบับได้

**โทเคนสีของแดชบอร์ด (`--d-card`, `--d-ink`, ฟอนต์ Anuphan) ประกาศไว้ใต้ `#view-dash` เท่านั้น** ทุกหน้าจึงต้องถูกครอบด้วย `<section class="view active" id="view-...">` ใน `App.tsx` ถ้าลืม ตัวแปรจะเป็นค่าว่าง กราฟกับตัวกรองกลายเป็นพื้นใสโดยไม่มี error

**`normal` กับ `sheetTotal` ไม่สมมาตรกัน — ตั้งใจ ไม่ใช่บั๊ก**

```
normal     = แก๊ส + น้ำมัน + ค่าแรง + ค่าธรรมเนียม + ค่าซ่อม     (ไม่รวมสูญเปล่า)
sheetTotal = แก๊ส + น้ำมัน + ค่าแรง + ค่าธรรมเนียม + สูญเปล่า   (ไม่รวมค่าซ่อม)
```

`sheetTotal` มีไว้ให้ตรงกับคอลัมน์ 9–28 ของชีตเดิมเท่านั้น อย่า "แก้ให้เหมือนกัน"

**`Content-Type` ต้องเป็น `text/plain;charset=utf-8`** ถ้าเปลี่ยนเป็น `application/json` เบราว์เซอร์จะยิง CORS preflight ซึ่ง Apps Script ไม่มี `doOptions` รองรับ แล้วพังทันที · `redirect: "follow"` ก็จำเป็นเพราะ `/exec` ตอบ 302 ก่อนเสมอ · `GS_VERSION` ใน `lib/sheet/client.ts` ต้องตรงกับ `apps-script/Code.gs`

**แกนกราฟต้องเขียน `<XAxis>` `<YAxis>` `<CartesianGrid>` ตรง ๆ เป็นลูกของกราฟ** Recharts หาลูกจาก `displayName` ถ้าห่อไว้ในคอมโพเนนต์ของเราเอง แกนกับกริดจะหายทั้งใบโดยไม่มี error — ห่อ**ทั้งกราฟ**ได้ (`lib/chart/dcharts.tsx` ทำแบบนั้น) แต่ห่อลูกไม่ได้

**วันที่ต้องใช้ `todayISO()` จาก `lib/record/date.ts` เสมอ** ห้ามใช้ `new Date().toISOString().slice(0,10)` เพราะเป็น UTC — ผู้ใช้ในไทย (UTC+7) ที่เปิดแอปก่อนเจ็ดโมงเช้าจะได้วันที่ของเมื่อวาน

## branch และ deploy

`main` กับ `โมเดล-Anda` **แยกกันคนละสายโดยตั้งใจ** — `main` คือไฟล์ HTML เดี่ยวเวอร์ชันเก่า ใช้เป็น**ต้นแบบดีไซน์อ่านอย่างเดียว** (`git show origin/main:index.html`) **ห้าม merge เข้ามา**

push ขึ้น `โมเดล-Anda` = deploy ขึ้น GitHub Pages อัตโนมัติ workflow บังคับ `VITE_DATASET=sample` เสมอ และ fail ทันทีถ้าเจอไฟล์ใน `app/public/data/real/`

`base: "/fleet-cost-model/"` ใน `app/vite.config.ts` ต้องตรงกับชื่อ repo ตั้งผิดแล้ว asset 404 ทั้งหน้า

## ห้าม commit

repo นี้เป็น **public** — `.gitignore` กัน `*.xlsx`, `etl/data/`, `app/public/data/real/`, `custmap.bin` ไว้แล้ว ทั้งหมดมาจากข้อมูลลูกค้าจริง (แม้จะ hash แล้ว) · ลิงก์ `/exec` ให้กรอกในแอปตอนใช้งาน เก็บใน localStorage เท่านั้น
