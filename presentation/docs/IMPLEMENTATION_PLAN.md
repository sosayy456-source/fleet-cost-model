# IMPLEMENTATION PLAN — สำหรับ Codex

> **★ v3 (25 ก.ย. 2569): เว็บเปลี่ยนเป็น "เดินชมโมเดลตาม flow การกรอกข้อมูล" — อ่านข้อ 11 ท้ายไฟล์ก่อน** ข้อ 11 ทับข้ออื่นทุกจุดที่ขัดกัน ·
> ข้อ 0 (กติกา) · 1 (architecture) · 3 (engine) · 9–10 (งบ/checklist) ยังใช้ · ข้อ 4.1–4.2 · 6.1 (ภาพหน้าจอ) · 7 (แผนที่) · 8 (Phase P0–P5) เป็นของเดิม

> อ่าน `PRESENTATION_BRIEF.md` (ข้อบังคับ) และ `STORYBOARD.md` (ฉาก) ก่อนเริ่ม
> ทำทีละ Phase · จบแต่ละ Phase ต้องผ่าน "เกณฑ์ผ่าน" และจด `CHANGELOG.md` ก่อนขึ้น Phase ถัดไป

---

## 0. กติกาการทำงานของ Codex

1. **เขียนได้เฉพาะใน `presentation/`** — นอกนั้นอ่าน/import ได้อย่างเดียว (ดู BRIEF ข้อ 5)
   ถ้าจำเป็นต้องแก้นอกโฟลเดอร์ ให้หยุดแล้วเขียนเหตุผลลง CHANGELOG ใต้หัว "รอเจ้าของงานตัดสิน" ห้ามแก้เอง
2. คอมเมนต์ · ข้อความบนจอ · ข้อความ commit เป็นภาษาไทย (ชื่อส่วนภาษาอังกฤษตามแอปหลักได้)
3. ห้ามพิมพ์ตัวเลขข้อมูลลงในโค้ดฉาก — ทุกตัวเลขมาจาก `story.json` ผ่าน type `Story` (ข้อ 5)
4. ห้าม commit `story.real.json` / ตัวเลขจริง / ชื่อลูกค้าจริง / ทะเบียนจริง
5. จบ Phase = อัปเดต `CHANGELOG.md` (ทำอะไร · ไฟล์ไหน · อะไรที่ยังค้าง · คำถามถึงเจ้าของงาน)
6. อย่าเพิ่มไลบรารีนอกรายการข้อ 1 / 1.1 โดยไม่เขียนเหตุผลใน CHANGELOG
7. **จบงานทุกครั้งต้องส่งไม้ต่อ** ตาม `HANDOFF.md` — บอกเจ้าของงานว่าให้ไปสั่ง Claude ต่อ พร้อมข้อความสั่งงานที่คัดลอกไปวางได้เลย

## 1. Architecture (เจ้าของงานอนุมัติ 25 ก.ย. 2569)

**หลักข้อแรก: แยกขาดจากแอปเดิมตอนรัน** — เว็บนี้ไม่ import อะไรจาก `app/` ตอนทำงาน · มี `package.json` + lockfile ของตัวเอง ·
build แล้วเป็นไฟล์ static ที่เปิดได้เองทั้งหมด (`npm run preview` หรือ `dist/index.html` ตรง ๆ) · **ไม่มีการประมวลผลข้อมูลในเบราว์เซอร์**
ที่เดียวที่แตะของเดิมคือสคริปต์ออฟไลน์ `tools/build-story.ts` (ข้อ 5.3) ซึ่งไม่อยู่ในเว็บ

| เรื่อง | ตัดสินแล้ว | ห้าม |
|---|---|---|
| Framework | Vite + React 19 + TypeScript (package แยก) | Next.js / Astro / SSR |
| Routing | **ไม่มี router** — หน้าเดียวเลื่อนยาว · hash `#s05-3` (ฉาก-step) ไว้กลับจุดเดิม | React Router |
| State | **ไม่มีไลบรารี** — `engine/store.ts` ตัวเดียวด้วย `useSyncExternalStore` ถือ ฉาก/step ปัจจุบัน + โหมดผู้นำเสนอ · ข้อมูล `story` ส่งผ่าน Context อ่านอย่างเดียว | Redux / Zustand / Jotai |
| Animation | GSAP + ScrollTrigger (pin · scrub · snap) + Lenis · 1 ฉาก = 1 timeline | Motion/framer-motion เป็นตัวหลัก · CSS scroll-driven animation (Firefox ไม่รองรับ) |
| กราฟ/ภาพเคลื่อนไหว | **SVG เขียนเองเป็น component** · ของจำนวนมากวาดบน `<canvas>` | Recharts · Three.js/WebGL |
| ภาพหน้าจอแอปจริง | **รูป WebP** เฉพาะฉากที่บอกว่า "นี่คือระบบจริง" (ข้อ 6.1) · ท่าได้แค่ เลื่อน/จาง/ซูม ทั้งรูป | ใช้รูปแทนกราฟที่ต้องขยับเป็นท่อน ๆ |
| สไตล์ | **CSS Modules ต่อ component** (`X.module.css`) + `styles/tokens.css` กลาง | CSS ไฟล์เดียวชื่อคลาสสากล (แอปเดิมเคยชนกันจริง) · Tailwind |
| ข้อมูล | `story.json` **import ตอน build** (รวมเข้า bundle) · type `Story` เป็นสัญญากลาง | `fetch` ข้อมูลตอนรัน · โหลดไฟล์ใด ๆ จาก `app/public/data/` |
| ตัวเลขจริง | **ข้อ 1: สคริปต์ออฟไลน์เรียกสูตรจาก `app/src/lib/`** (เจ้าของงานเลือก — ตัวเลขตรงกับแอปหลัก) · กรอกเองเป็นทางสำรอง | คัดลอกสูตรมาเขียนใหม่ |
| ฟอนต์/รูป/แผนที่ | อยู่ในโฟลเดอร์ทั้งหมด | CDN ใด ๆ ตอนรัน |

**กติกาชั้น:** `scenes/` ใช้ `components/` + `engine/` + `data/` ได้ · `components/` ห้ามรู้จักฉากและห้าม import `data/` (รับค่าผ่าน props) ·
`engine/` ห้ามรู้จักเนื้อหาฉาก · ห้ามพิมพ์ตัวเลขข้อมูลลงใน `scenes/` หรือ `components/`

### 1.1 เทคโนโลยี

| ส่วน | เลือก | เหตุผล |
|---|---|---|
| โครง | **Vite + React 19 + TypeScript** (package แยกของตัวเอง) | ชุดเดียวกับ `app/` คนดูแลคุ้นเคย · build เป็นไฟล์ static |
| แอนิเมชันผูกการเลื่อน | **GSAP + ScrollTrigger** (pin · scrub · snap) | จัดการ pin + scrub ได้เสถียรที่สุด timeline ต่อฉากเขียนง่าย |
| smooth scroll | **Lenis** (เชื่อมกับ ScrollTrigger ผ่าน `lenis.on('scroll', ScrollTrigger.update)` + `gsap.ticker`) | ได้ความลื่นแบบวิดีโอ ปิดได้เมื่อ reduced-motion |
| กราฟ | **SVG เขียนเอง** (ไม่ใช้ Recharts) | คุมทุกท่อนด้วย GSAP ได้ ข้อมูลน้อยอยู่แล้ว |
| แผนที่ | **SVG นิ่งที่สร้างล่วงหน้า** (ข้อ 7) · `d3-geo` เป็น devDependency ของสคริปต์เท่านั้น | ไม่ลาก d3 เข้า bundle · ไม่พึ่งเน็ต |
| QR | สร้างเป็น SVG ตอน build (`qrcode` devDependency) | ไม่ใช้บริการภายนอก |
| ทดสอบ | **Vitest** (schema/formatter) + สคริปต์ตรวจขนาด build | |

ห้ามใช้: Three.js / WebGL / วิดีโอไฟล์ใหญ่ / ฟอนต์จาก Google Fonts / CDN ใด ๆ ตอน runtime

## 2. โครงสร้างโฟลเดอร์

```
presentation/
├─ docs/                     ← เอกสารกลาง 4 ไฟล์นี้
├─ package.json              ← แยกจาก app/ (มี lockfile ของตัวเอง ใช้ npm ci)
├─ vite.config.ts            ← base: "./" (เปิดจาก dist/ ตรง ๆ ได้)
├─ .gitignore                ← node_modules/ · dist/ · src/data/story.real.json · src/assets/shots/real/ · tools/.cache/
├─ index.html
├─ tools/                    ← สคริปต์ออฟไลน์ ไม่อยู่ในเว็บ
│  ├─ build-story.ts         ← สร้าง story.real.json จากผลของ ETL (ข้อ 5.3)
│  ├─ build-map.ts           ← สร้าง src/assets/thailand.svg + src/data/cities.json (ข้อ 7)
│  └─ check-size.mjs         ← ตรวจขนาด dist + ขนาดรูป (ข้อ 9)
└─ src/
   ├─ main.tsx · App.tsx     ← เรียงฉาก + ใส่ StoryProvider
   ├─ engine/
   │  ├─ scroll.ts           ← Lenis + ScrollTrigger + reduced-motion/?lite
   │  ├─ steps.ts            ← ตำแหน่ง step ทุกฉาก + ปุ่มพรีเซนเตอร์ + hash
   │  ├─ store.ts            ← ฉาก/step ปัจจุบัน + โหมดผู้นำเสนอ (useSyncExternalStore)
   │  └─ Scene.tsx (+ .module.css) ← ห่อฉาก (pin, ความยาว, สีหมวด, id)
   ├─ data/
   │  ├─ story.ts            ← type Story + StoryProvider/useStory() (real ถ้ามี ไม่งั้น sample · import ตอน build)
   │  ├─ shots.ts            ← รายการภาพหน้าจอ + เลือก real/sample (ข้อ 6.1)
   │  ├─ story.sample.json   ← commit ได้ (ตัวเลขชุดตัวอย่าง/สมมติ)
   │  ├─ story.real.json     ← gitignore
   │  └─ cities.json         ← จาก build-map
   ├─ components/            ← ของที่ใช้ซ้ำ โฟลเดอร์ละตัว: X/X.tsx + X/X.module.css
   │                            CountUp · Truck · StackBar · Ring · Sankey · HBar · Histogram · RouteMap · ScreenShot · Chip · ProgressRail · PresenterPanel
   ├─ scenes/                ← S00Cover … S15Thanks (ไฟล์ละฉาก + .module.css ชื่อตาม STORYBOARD)
   ├─ styles/                ← tokens.css · fonts.css · global.css (reset + body เท่านั้น)
   └─ assets/
      ├─ fonts/              ← LINESeedSansTH_W_{Rg,Bd,XBd}.woff2 + OFL.txt (คัดลอกจาก app/src/assets/fonts/)
      ├─ thailand.svg
      └─ shots/
         ├─ sample/          ← ภาพหน้าจอจากข้อมูลตัวอย่าง (commit ได้)
         └─ real/            ← ภาพหน้าจอจากข้อมูลจริง (gitignore)
```

## 3. ตัวคุมการเลื่อน (engine)

**`<Scene>`** รับ `{ id, pinVh, steps, tone, build(tl, ctx) }`
- สร้าง ScrollTrigger หนึ่งตัวต่อฉาก: `pin: true`, `scrub: 0.6`, `end: "+=" + pinVh + "%"` แล้วเรียก `build()` ให้ฉากใส่ท่าลง timeline
- timeline ยาว 1 หน่วยต่อฉาก · ท่าในฉากวางตาม `p` ใน STORYBOARD (`tl.to(el, {...}, 0.2)` = เริ่มที่ p 0.2)
- ฉากที่ไม่ pin (S14) ใช้ `ScrollTrigger` แบบ `once: true` เล่น timeline เองเมื่อเข้าจอ
- ทุกท่าใช้เฉพาะ **transform / opacity / stroke-dashoffset** (ห้ามแอนิเมต width/height/top/left/filter:blur)
- Lenis + GSAP ticker ต้องเรียก `gsap.ticker.lagSmoothing(0)` (ตามเอกสาร Lenis) ไม่งั้นสลับแท็บ/สลับจอพรีเซนต์แล้วกลับมา scroll กับ timeline หลุดจังหวะกัน
- ตัวเลขสะสมตาม step (S05 ยอดต้นทุน · S13 คะแนน PI) = ผลรวมของค่าใน `story.json` ที่ขึ้นจอแล้ว (บวกเลขเพื่อแสดง ไม่ใช่สูตรธุรกิจ)
  · เทสต์ต้องยืนยันว่าค่าสะสมที่ step สุดท้าย **เท่ากับ** `costPerTrip.total` / `pi.total` ไม่งั้นแปลว่าข้อมูลกับจอขัดกัน

**Step & ปุ่มพรีเซนเตอร์ (`steps.ts`)**
- ทุกฉากประกาศ step เป็นค่า `p` (เช่น S05: `[0.18, 0.36, 0.54, 0.72, 0.95]`) → แปลงเป็นตำแหน่ง scroll จริงหลัง `ScrollTrigger.refresh()`
- คีย์ `→ ↓ Space PageDown` = step ถัดไป · `← ↑ PageUp` = step ก่อน · `Home/End` = ต้น/ท้าย · `1–9` = ข้ามไปฉาก · `F` = เต็มจอ ·
  `P` = โหมดผู้นำเสนอ (ข้อ 3.1) — เลื่อนไป step ด้วย `lenis.scrollTo(y, { duration: 1.1, easing })` ผู้ชมจึงเห็นแอนิเมชันเล่นเหมือนวิดีโอ
- ล้อเมาส์/ทัชแพดยังเลื่อนอิสระได้ · `ScrollTrigger.snap` ไปที่ step ใกล้สุดเมื่อหยุดเลื่อน (ปรับ/ปิดได้ใน config)
- URL hash = `#s05-3` (ฉาก-step) · refresh แล้วกลับไป step เดิม
- แถบความคืบหน้าบางด้านล่าง (`ProgressRail`) มีจุดแบ่งตามองก์

### 3.1 โหมดผู้นำเสนอ (กด `P`)
- มุมล่างขวาเป็นกล่องเล็ก: ฉาก/step ปัจจุบัน · เวลาที่ใช้ไป · โน้ต "พูด" ของฉากจาก `story.json` (`notes[sceneId]`) · ตัวถัดไป
- ไม่มีระบบหลายจอ (ไม่ต้องทำ) — ซ่อนได้ด้วย `P` อีกครั้ง

### 3.2 reduced-motion และเครื่องช้า
- `prefers-reduced-motion: reduce` หรือ `?lite` ใน URL → ปิด Lenis · ไม่ pin · ทุกฉากแสดงสถานะสุดท้ายนิ่ง ๆ พร้อมเฟดเข้า · count-up แสดงเลขจริงทันที
- ปุ่ม step ยังใช้ได้ (เลื่อนไปทีละฉาก)

## 4. คอมโพเนนต์ที่ใช้ซ้ำ (`src/components/`)

| ชื่อ | ใช้ที่ | หมายเหตุ |
|---|---|---|
| `CountUp` | ทุกฉาก | รับ `to`, `format`, `trigger` (step/p) · ฟอนต์ไม่มี tabular-nums → ตั้ง `min-width` ตามความยาวเลขสุดท้ายกันตัวหนังสือกระตุก |
| `Truck` | S00 S04 S10 S15 | SVG ด้านข้าง · ล้อหมุน · ตู้เติมได้ (`fill` 0–1, `tone`) · ใช้ตัวเดียวกันทุกฉาก |
| `StackBar` | S05 | ท่อนแนวตั้ง · ข้ามค่าติดลบ (แสดงเป็นตัวเลขแยก) |
| `Sankey` | S07 | 1 → n สายไหล ความกว้างตามสัดส่วน (path cubic) |
| `HBar` / `DivergingBar` | S11 | ยืดด้วย scaleX จากจุดยึด |
| `Histogram` | S12 | 8 ช่วง morph ความสูงได้ |
| `Ring` | S13 | 5 ส่วน stroke-dasharray · สีหมวด |
| `Chip` | ทุกฉาก | ป้ายสี / ป้าย "ข้อมูลตัวอย่าง" |
| `RouteMap` | S09 | วาง `thailand.svg` + เส้นทางจาก `cities.json` |
| `DashFrame` | ปก · องก์ III | **dashboard ตัวละครหลัก** (DESIGN_DIRECTION ข้อ 6) · ขนาดอ้างอิง 1440×900 วาดครั้งเดียว · props `widgets: Record<WidgetId, 'skeleton'\|'gray'\|'live'>` · ฉากคุมกล้องด้วย transform บน wrapper · export ตำแหน่ง widget (`getWidgetRect(id)`) ให้ท่า B2/B5 |
| `KpiChip` | ทุกฉาก | การ์ด KPI สไตล์ Pulse: ป้าย mono + ตัวเลข Inter `tnum` + delta · ใช้ทั้งในกรอบและแบบลอย (floating) |
| `Highlight` | ทุกพาดหัว | แคปซูล accent/leak หลังคำ (B1) · `scaleX` จาก `transform-origin: left` |
| `ScreenShot` | S04 S08 S13 S15 | ภาพหน้าจอในกรอบแล็ปท็อป/เบราว์เซอร์ (วาดกรอบเป็น CSS) · ท่า: เลื่อนเข้า · ซูมช้า (Ken Burns) · เลื่อนภาพในกรอบ (translateY) · รับ `shot` จาก `data/shots.ts` |

### 4.1 ชุดท่า (beats) — `src/engine/beats.ts`

ท่า B1–B9 ของ `DESIGN_DIRECTION.md` ข้อ 5 เขียนเป็นฟังก์ชันที่รับ `(tl, elements, at)` แล้วใส่ท่าลง timeline ของฉาก เช่น
`statement(tl, root, 0)` · `kpiPop(tl, chip, target, at)` · `grayToInsight(tl, parts, highlightIds, at)` · `camera(tl, frame, widgetId, at)` · `pullBack(tl, frame, at)`
ฉากเรียกใช้ beat แทนการเขียน `tl.to()` เอง — ท่าจะเหมือนกันทั้งเรื่อง และแก้ความรู้สึกได้ที่เดียว

### 4.2 ฟอนต์ (แก้ตาม DESIGN_DIRECTION ข้อ 4)

- ค่าตั้งต้น: ไทย **Anuphan** · ตัวเลข/ละติน **Inter** (`font-feature-settings: "tnum"`) · ป้าย **JetBrains Mono** — woff2 subset ไทย+ละตินใน `src/assets/fonts/` + สัญญาอนุญาต OFL ของแต่ละตัว
  (ดาวน์โหลดครั้งเดียวตอนพัฒนา · ห้ามโหลดจาก Google Fonts ตอนรัน) · งบฟอนต์รวม ≤ 400 KB
- LINE Seed Sans TH ยังเก็บไว้เป็นทางเลือก
- **หน้าเทียบฟอนต์ `?fonts`** — พาดหัว "รู้ต้นทุนจริง ทุกเที่ยว" · ตัวเลข "6,000" · ป้าย "COST STRUCTURE" ใน 3 ชุดไทย (Anuphan · LINE Seed · IBM Plex Sans Thai)
  เรียงบนลงล่าง ให้เจ้าของงานเลือก · ชุดที่เลือกตั้งด้วยโทเคน `--font-thai` ตัวเดียว

## 5. ข้อมูล: `story.json`

### 5.1 type (ใน `src/data/story.ts` — ถือเป็นสัญญาระหว่างสคริปต์กับฉาก)

```ts
export interface Story {
  source: "real" | "sample";          // sample = ขึ้นชิป "ข้อมูลตัวอย่าง"
  generatedAt: string;
  meta: { presenter: string; event: string; org: string; period: string };   // period เช่น "ม.ค. 2567 – พ.ค. 2569"
  scale: { fleet: number; revenueRows: number; excelFiles: number };
  kpi: { trips: number; revenue: number; cost: number; profit: number; margin: number;   // margin เป็น %
         monthly: { mo: string; revenue: number; cost: number }[] };                     // 12 เดือนล่าสุด — กราฟรายเดือนใน DashFrame (เพิ่ม 25 ก.ย. 2569)
  costPerTrip: { fuel: number; allow: number; fee: number; repair: number; dep: number; rent: number;
                 other: number; waste: number; total: number };                          // บาท/เที่ยว เฉลี่ย
  routes: { count: number; below5: number; lossShare: number;
            top: RouteItem[]; bottom: RouteItem[] };                                   // top/bottom อย่างละ 3–5
  lf: { avg: number; idleShare: number; idle: number; recoverable: number };           // avg/idleShare เป็นสัดส่วน 0–1
  empty: { trips: number; tripShare: number; cost: number };
  vehicle: { kinds: { name: string; perTkm: number | null; coverage: number | null }[] };
  customers: { bands: { label: string; n: number; loss: boolean }[]; profitN: number; lossN: number };
  dso: { days: number | null; buckets: { label: string; amount: number }[] };
  pi: { total: number; max: number;                                                   // max < 100 = คิดได้ไม่ครบ
        categories: { id: "route" | "fleet" | "cost" | "cust" | "service"; title: string; score: number | null;
                      metrics: { label: string; score: number | null; g: number; y: number; r: number; n: number }[] }[];
        serviceStatus: "pass" | "watch" | "fail" | null };
  demo: { dispatchLf: number; repair: { perKm: number; km: number; perDay: number; days: number };
          cts: { name: string; kg: number; cbm: number; km: number; revenue: number }[] };   // ตัวอย่างสมมติ ไม่ใช่ข้อมูลจริง
  notes: Record<string, string>;      // โน้ตผู้นำเสนอรายฉาก key = "S05"
}
interface RouteItem { from: string; to: string; perTrip: number; margin: number | null }
```

`story.ts`: `import.meta.glob("./story.real.json", { eager: true })` — มีไฟล์ = ใช้ real ไม่งั้นใช้ sample (build ไม่พังเมื่อไม่มีไฟล์ real)
ข้อมูลถูกรวมเข้า bundle ตอน build **ไม่มี `fetch`** · ส่งให้ฉากผ่าน `StoryProvider` / `useStory()`
+ เทสต์ Vitest ตรวจว่า `story.sample.json` ผ่าน type/ค่าไม่ติดลบในช่องที่ห้ามติดลบ/สัดส่วนอยู่ 0–1

### 5.2 `story.sample.json` (Phase 1)
- ใช้ตัวเลขจาก `app/public/data/sample/` (ชุดตัวอย่างที่ commit อยู่แล้ว) หรือตัวเลขกลม ๆ สมมติ — **ต้องไม่ใช่ตัวเลขจริง**
- `source: "sample"` เสมอ

### 5.3 `story.real.json` — สร้างด้วย `tools/build-story.ts` (Phase 3)
- รันบนเครื่องเจ้าของงานหลังแอปหลักแปลงข้อมูลจริงเสร็จ: `npx tsx tools/build-story.ts` → เขียน `src/data/story.real.json`
- **อ่าน:** `../app/public/data/real/{costrev,alloc,loadfactor,debtors}/` (ผลของ ETL) + `../app/src/lib/refdata/fleet.json`
- **คำนวณ:** `import` ฟังก์ชันจาก `../app/src/lib/` ตรง ๆ **ห้ามคัดลอกสูตรมาเขียนใหม่** — จุดที่ต้องใช้:
  - ชุดเที่ยว: `inProfitScope()` (`lib/data/useCostRev.ts`)
  - กลุ่มต้นทุน: `variableOf` `semiOf` `fixedOf` `otherOf` (`lib/data/useCostRev.ts`)
  - เส้นทาง: `routeMargin` `routeMarginValues` (`lib/pi/route.ts`)
  - Load Factor: `lib/loadfactor/calc.ts` · เที่ยวเปล่า: `lib/empty/*` · รายคัน: `vehicleRows` `depreciation` (`lib/detail3/calc.ts`)
  - PI: `lib/pi/score.ts` `lib/pi/route.ts` `lib/pi/empty.ts` `lib/pi/damage.ts` · DSO: `ageBills` (`lib/debtors/aging.ts`)
  - ลูกค้า: `rollupCustomers` **อยู่ใน `features/dash-demo/CustomerProfitTab.tsx` ไม่ใช่ `lib/`** — import ไฟล์หน้าจอจะลาก React/CSS มาด้วย
    ให้ลอง import ก่อน ถ้าไม่ได้ **ห้ามคัดลอก** ให้จดใน CHANGELOG ว่า "ต้องย้าย `rollupCustomers` ไป `lib/`" (เป็นงานแก้แอปหลัก ต้องให้เจ้าของงานอนุมัติ)
    ระหว่างนั้นใช้ตัวเลขลูกค้าจากการกรอกเอง (ทางเลือกสำรองข้างล่าง)
  - ถ้า import ไฟล์ไหนไม่ได้ในสภาพ Node (เช่นติด API เบราว์เซอร์) **ให้หยุดแล้วจดใน CHANGELOG** ห้ามคัดลอกสูตรมาแก้ปัญหา
- **ตรวจ:** ตัวเลข PI รวม / Load Factor เฉลี่ย / จำนวนเที่ยว ต้องตรงกับที่แอปหลักแสดง (เจ้าของงานเปิดแอปเทียบ) — จดผลเทียบใน CHANGELOG
- ไฟล์นี้อ่านไฟล์เที่ยวทั้งก้อนใน Node ครั้งเดียวได้ (เครื่องมีหน่วยความจำพอ ต่างจากแท็บเบราว์เซอร์) · ถ้าไฟล์ใหญ่มากใช้ `--max-old-space-size=4096`
- **ทางเลือกสำรอง:** เจ้าของงานกรอก `story.real.json` เองจากตัวเลขบนหน้าแอปหลัก (คัดลอก `story.sample.json` แล้วแก้)

## 6. รูปภาพ

### 6.1 ภาพหน้าจอแอปจริง (เจ้าของงานอนุมัติ 25 ก.ย. 2569)

ใช้เฉพาะฉากที่อยากบอกผู้ชมว่า "นี่คือระบบจริง" — **ไม่ใช้รูปแทนกราฟที่ต้องขยับเป็นท่อน** (กราฟเป็น SVG เสมอ)

| id | ฉาก | ภาพ | ท่า |
|---|---|---|---|
| `dispatch` | S04 step 2 | หน้า "จัดรถ" (ตารางบิล + รูปรถสถานะการบรรทุก) | เลื่อนเข้าจากขวาในกรอบแล็ปท็อป คู่กับรถ SVG |
| `exec` | S08 step 2 | หน้า Executive Dashboard ส่วนบน (การ์ดเด่น) | ซูมช้า อยู่หลังการ์ด 4 ใบ (จาง 30%) |
| `exec-long` | S08 ท้ายฉาก | หน้า Executive Dashboard ทั้งหน้า (ภาพยาว) | เลื่อนภาพในกรอบจากบนลงล่างตาม p (translateY) |
| `pi-detail` | S13 ท้ายฉาก | ป็อบอัพ "ที่มาของคะแนน Performance Index" | เฟดเข้าข้างวงแหวน |
| `montage` | S15 step 1 | 3–4 หน้า (จัดรถ · Overall Dashboard · Cost to Serve) | การ์ดเรียงเอียงซ้อน เลื่อนผ่านช้า ๆ |

**กติการูป**
- รูปแบบ **WebP** (คุณภาพ ~80) · กว้างสูงสุด **1920 px** (ภาพยาว `exec-long` สูงได้ถึง 4000 px) · ขนาด **≤ 300 KB ต่อรูป** (`exec-long` ≤ 600 KB)
- แคปจากตัว build ของแอปหลัก ที่ซูมเบราว์เซอร์ 100% หน้าต่าง 1920×1080 ไม่มีเมาส์ชี้/ป็อบอัพ tooltip ค้าง
- **รูปจากข้อมูลจริงอยู่ใน `src/assets/shots/real/` (gitignore)** · รูปจากข้อมูลตัวอย่างอยู่ `shots/sample/` (commit ได้)
  `data/shots.ts` ใช้ `import.meta.glob` เลือก real ถ้ามี ไม่งั้น sample — ชื่อไฟล์ = id ในตาราง (`dispatch.webp` …)
- ใส่ `width`/`height` จริงทุกรูป (กันหน้ากระโดด) · `decoding="async"` · รูปของฉากถัดไปโหลดล่วงหน้าเมื่อเข้าฉากก่อนหน้า (`<link rel="preload">` หรือ `new Image()`)
- ท่าได้แค่ transform/opacity ทั้งรูป · ห้าม `filter: blur()` บนรูป
- ภาพที่มีชื่อลูกค้า/ทะเบียนจริง → ต้องอยู่ใน `real/` เท่านั้น
- ยังไม่มีรูป = `ScreenShot` **ไม่แสดงอะไรบนจอผู้ชม** (แก้หลังรีวิว P0) · กรอบว่าง "ภาพหน้าจอ: {id}" เห็นเฉพาะเมื่อมี `?debug` · ห้ามทำให้ build พัง

### 6.2 อื่น ๆ
- ภาพประกอบ (รถ ไอคอน ไฟล์ Excel) เป็น SVG เขียนเองทั้งหมด
- ไม่มีวิดีโอในรอบนี้ — ถ้าเจ้าของงานอยากได้คลิปเดโมภายหลัง ใช้ MP4 H.264 ≤ 5 MB ต่อคลิป `muted playsinline` เล่นเมื่อเข้าฉาก

## 7. แผนที่ (Phase 4)

- `tools/build-map.ts` รันครั้งเดียวตอนพัฒนา (ต่อเน็ตได้): ดาวน์โหลด **GeoJSON ขอบเขตจังหวัด** จาก URL เดียวกับแผนที่แอปหลัก
  (`DATA_PROVINCES` ใน `map/src/data.js`) → รวมจังหวัดเป็นรูปประเทศ (หรือเก็บเส้นจังหวัดจาง ๆ ไว้ด้วยก็ได้)
  → projection `geoMercator().fitSize([800, 1100], ...)` → ลดความละเอียด (`d3-geo` precision / ปัดทศนิยมพิกัด) → เขียน `src/assets/thailand.svg` (เป้าหมาย < 150 KB)
  · ไฟล์ GeoJSON ต้นทางเก็บไว้นอก git (`tools/.cache/` ใน `.gitignore`) — commit แค่ SVG ผลลัพธ์
- พิกัดเมือง: อ่าน `STOPS` จาก `map/src/network.js` (import อ่านอย่างเดียว) ฉายด้วย projection เดียวกัน → `src/data/cities.json` `{ name: [x, y] }`
- เส้นทางใน S09 = เส้นตรงโค้งเล็กน้อย (quadratic) ระหว่างสองเมือง — ไม่ต้องเดินตามถนน (ฉากนำเสนอ ไม่ใช่แผนที่นำทาง)
- ต้นทาง/ปลายทางใน `story.json` ที่ไม่มีใน `cities.json` → ไม่วาดเส้นนั้น แต่ยังแสดงในรายการขวา

## 8. Phase และเกณฑ์ผ่าน

| Phase | งาน | เกณฑ์ผ่าน |
|---|---|---|
| **P0 ต้นแบบโชว์ฝีมือ** (เจ้าของงานขอ 25 ก.ย. 2569 — อยากเห็นก่อนว่าทำได้ประมาณไหน ลำดับเรื่องจริงจะส่งมาทีหลัง) | scaffold ตาม architecture ข้อ 1 ครบ (engine · store · `<Scene>` · tokens · ฟอนต์ · `story.ts` + `story.sample.json` เฉพาะคีย์ที่ 3 ฉากใช้ · ProgressRail · ปุ่มพรีเซนเตอร์ · `.gitignore`) + **3 ฉากเต็มรูปแบบพร้อมแอนิเมชัน**: **S00 ปก** (ตัวอักษรขึ้นทีละคำ + รถวิ่ง) · **S05 ต้นทุน 1 เที่ยว** (แท่งซ้อนเติมทีละท่อนตาม step + ตัวเลขนับขึ้น) · **S13 Performance Index** (วงแหวน 5 สีเติมทีละหมวด + คะแนนรวมนับขึ้น) · ระหว่างฉากใช้ transition ตาม STORYBOARD ข้อ 2 · ตัวเลขใช้ชุดตัวอย่าง (ขึ้นชิป "ข้อมูลตัวอย่าง") | `npm run build` ผ่าน · เปิด `npm run preview` แล้วเลื่อนครบ 3 ฉากลื่น (≥ 55 fps) · ปุ่ม →/← ไปทีละ step · refresh กลับ step เดิม · `?lite` ใช้ได้ · ปิดเน็ตแล้วฟอนต์ยังขึ้น · **ส่งไม้ให้เจ้าของงานเปิดดูเอง** พร้อมคำสั่งเปิด |
| **P0.5 โครงครบทุกฉาก** (หลังเจ้าของงานส่งลำดับเรื่องจริง และ Claude แก้ STORYBOARD แล้ว) | ฉากที่เหลือเป็นฉากว่าง (ชื่อ + สีหมวด + ความยาว pin ถูก) | เลื่อนครบทุกฉาก pin ถูกความยาว |
| **P1 ข้อมูล + เนื้อหานิ่ง** | `story.ts` + `story.sample.json` + เทสต์ · ทุกฉากวางเนื้อหา/ตัวเลขครบตาม STORYBOARD แบบนิ่ง (ยังไม่มีแอนิเมชัน) | ทุกฉากอ่านรู้เรื่องที่ 1280×720 และ 1920×1080 · ไม่มีตัวเลขพิมพ์ในโค้ดฉาก (`grep` ตัวเลข ≥ 3 หลักใน `src/scenes/` ต้องว่าง ยกเว้นขนาด layout) |
| **P2 แอนิเมชัน** | ท่าของทุกฉากตาม STORYBOARD · transition ระหว่างฉาก/องก์ · reduced-motion | Chrome Performance: ไม่มี long task > 50 ms ระหว่างเลื่อน · ≥ 55 fps ทุกฉาก · `?lite` ครบทุกฉาก |
| **P3 ตัวเลขจริง** | `tools/build-story.ts` (ข้อ 5.3) · โหมดผู้นำเสนอ + โน้ต | เจ้าของงานรันได้บนเครื่องตัวเอง · ตัวเลขตรงกับแอปหลัก · `git status` ไม่มี `story.real.json` |
| **P4 แผนที่ + QR + ภาพหน้าจอ** | `tools/build-map.ts` · `RouteMap` · QR ฉากท้าย · `ScreenShot` + `data/shots.ts` · รูป sample 5 รูป (เจ้าของงานแคปรูป real เอง) | แผนที่ขึ้นโดยไม่ต่อเน็ต · svg < 150 KB · รูปผ่านกติกาข้อ 6.1 · ไม่มีรูปก็ build ผ่าน |
| **P5 ขัดเกลา + ซ้อม** | ตรวจขนาด · checklist ข้อ 10 · แก้ตามที่เจ้าของงานซ้อมแล้วติ | ผ่าน checklist ข้อ 10 ทั้งหมด |

แนะนำให้เจ้าของงานดูผลหลัง P0 (ทำได้ประมาณไหน) · P1 (เนื้อเรื่องถูกไหม) · P2 (ความรู้สึกแอนิเมชัน) ก่อนไปต่อ
ทุก Phase จบด้วยบล็อกส่งไม้ตาม `HANDOFF.md`

## 9. งบประสิทธิภาพ

- JS gzip < 300 KB · รูปทั้งหมดรวม < 2.5 MB · ทั้ง `dist/` < 6 MB · `tools/check-size.mjs` fail ถ้าเกิน (ตรวจรูปรายไฟล์ตามข้อ 6.1 ด้วย)
- DOM ทั้งหน้า < 3,000 โหนด (จุด 899 คันใน S01 วาดบน `<canvas>`)
- `will-change` ใส่เฉพาะตอนฉากกำลังเล่น ถอดออกเมื่อจบฉาก
- กราฟ/ภาพประกอบเป็น SVG · รูป bitmap มีเฉพาะภาพหน้าจอตามข้อ 6.1
- ฉากที่อยู่ห่างจากจอเกิน 1 ฉาก ซ่อนด้วย `content-visibility: auto`

## 10. Checklist ก่อนวันนำเสนอ (P5)

- [ ] `npm ci && npm run build` บนเครื่องที่ใช้นำเสนอ · เปิด `npm run preview` หรือ `dist/index.html`
- [ ] ปิด Wi-Fi แล้วเลื่อนครบทุกฉาก — ฟอนต์ แผนที่ QR ขึ้นครบ
- [ ] ชิป "ข้อมูลตัวอย่าง" ไม่ขึ้น (แปลว่าใช้ `story.real.json` จริง) — หรือขึ้น ถ้าตั้งใจใช้ตัวอย่าง
- [ ] ตัวเลขหลัก (เที่ยว · กำไร · LF · PI) ตรงกับแอปหลัก
- [ ] ภาพหน้าจอเป็นชุด `real/` ครบ 5 รูป และตัวเลขในภาพตรงกับ `story.real.json` (แคปหลังรัน ETL รอบเดียวกัน)
- [ ] รีโมตพรีเซนเตอร์ (ส่งปุ่ม PageDown/PageUp) กดแล้วไปทีละ step
- [ ] ทดสอบที่ 1280×720 (โปรเจกเตอร์เก่า) และซูมเบราว์เซอร์ 100%
- [ ] ซ้อมเต็มรอบจับเวลา ≤ เวลาที่ได้ · ถ้าเกินตัดฉากตามลำดับใน STORYBOARD ข้อ 1
- [ ] `git status` สะอาด ไม่มีไฟล์ข้อมูลจริงค้าง

---

## 11. v3 — เดินชมโมเดลตาม flow การกรอกข้อมูล (เจ้าของงานสั่ง 25 ก.ย. 2569 · ทับข้อก่อนหน้าทุกจุดที่ขัดกัน)

อ่านคู่ `STORYBOARD.md` v3 และ `DESIGN_DIRECTION.md` v3 · architecture ข้อ 1 ยังใช้ทั้งหมด (แยกขาดจากแอปตอนรัน · ไม่มี router/state lib · GSAP+Lenis · CSS Modules · ข้อมูล import ตอน build)

### 11.1 เก็บ / ทิ้ง จากต้นแบบ P0-R2
- **เก็บ:** `engine/` ทั้งหมด (scroll · steps · store · hash · ปุ่มพรีเซนเตอร์ · `?lite`) · `PresenterPanel` · `ProgressRail` · `CountUp` · ฟอนต์ LINE Seed · tools build/size/offline
- **ทิ้ง:** ฉาก S00/S05/S13 · `DashFrame` `KpiChip` `Highlight` `Ring` `StackBar` `Truck` `FontComparison` · ฟอนต์ Anuphan/Inter/JetBrains Mono/IBM Plex · หน้า `?fonts` · โทเคน v2
  (ลบโค้ดได้ ไม่ต้องเก็บไว้ — ประวัติอยู่ใน git/CHANGELOG)
- `engine/beats.ts` (B1–B9) เลิกใช้ → แทนด้วย primitive ข้อ 11.3

### 11.2 โครงไฟล์ใหม่
```
src/
├─ mock/                  ← หน้าจอจำลองของแอป (ธีมเดียวกับแอป · ขนาดอ้างอิง 1440×900)
│  ├─ theme.module.css    ← โทเคน DESIGN_DIRECTION v3 ข้อ 2 (คัดลอกค่า ห้าม import CSS ของ app/)
│  ├─ AppWindow.tsx       ← กรอบหน้าต่าง + แถบเมนูซ้ายชมพู (เมนูตาม ROLE_VIEWS ของ Role นั้น) + พื้นที่หน้า
│  ├─ RolePickerMock.tsx · BillEntryMock.tsx · DispatchMock.tsx (+ LoadTruckMock) · DriverMock.tsx
│  ├─ DraftsMock.tsx · AccountMock.tsx (+ FuelBillTableMock · FuelSummaryMock)
│  └─ ExecMock.tsx · FleetStatusMock.tsx · LfSimMock.tsx · ManagerMock.tsx
├─ primitives/            ← Cursor · Type · Select · Check · AutoCalc · Spotlight · Camera · Modal · Toast · NumberRoll · PageSwitch
│                           แต่ละตัวมีฟังก์ชันใส่ท่าลง timeline เช่น click(tl, cursor, target, at) · type(tl, input, text, at, dur)
├─ narration/             ← แผงคำอธิบาย (Role · ขั้น x/y · พาดหัว · คำอธิบาย) + เส้นสถานะใบรายการ
├─ scenes/                ← R0Home · R1CustomerService · R2Dispatch · R3Driver · R4Accounting · A0Exec · A1Fleet · A2Manager · End
└─ data/
   ├─ scenario.json       ← เที่ยวสมมติ (commit ได้) — สร้างด้วย tools/build-scenario.ts
   └─ story.sample.json / story.real.json ← ตัวเลขของส่วน Admin (A1 · A2)
```
- **หนึ่ง Role = หนึ่ง `<Scene>` pin ยาว** (หน้าจอจำลองอยู่ตลอด Role ไม่ unmount) · step ของ Role = จุด snap ใน timeline เดียว
- หน้าจอจำลองรับ state เป็น props (ช่องไหนมีค่า · บิลไหนติ๊ก · ป็อบอัพเปิดไหม) แต่**ท่าเคลื่อนไหวทั้งหมดทำด้วย GSAP บน DOM** ไม่ใช่ React re-render ทุกเฟรม
  (ค่าที่พิมพ์ทีละตัวเขียนลง `textContent` ผ่าน GSAP `onUpdate` — ห้าม setState ทุกเฟรม)
- ทุก element ที่เมาส์/กล้องต้องไปหา ใส่ `data-target="r1.sender"` ฯลฯ — ชื่อ target ของแต่ละ step เขียนเป็นตารางในไฟล์ฉาก

### 11.3 Primitive (ตาม DESIGN_DIRECTION v3 ข้อ 4)
- `Cursor`: element เดียวทั้งเว็บ (fixed) · หาพิกัดเป้าจาก `getBoundingClientRect()` **ของหน้าจอจำลองที่ผ่าน scale แล้ว** → ต้องคิดใหม่ทุกครั้งที่ `ScrollTrigger.refresh()`
  (ใช้ function-based values ของ GSAP `x: () => …` + `invalidateOnRefresh: true`)
- `Type`: scrub ได้ — ความยาวข้อความ = `Math.round(progress × text.length)` · เลื่อนกลับ = ลบกลับ · ตัวเลขจัดรูปแบบเมื่อครบ
- `Camera`: transform บน wrapper ของหน้าจอจำลอง · คำนวณ scale/translate จากกรอบของ `data-target`
- `NumberRoll`: 13 หลัก แต่ละหลักเป็นคอลัมน์ 0–9 เลื่อน translateY แล้วหยุดที่หลักจริง (stagger ซ้ายไปขวา)
- ทั้งหมดต้องใช้ใน `?lite` ได้: lite = แสดงสถานะสุดท้ายของ step ทันที (ช่องเต็ม · ป็อบอัพเปิด/ปิดตามสถานะปลาย step) ไม่มีเมาส์

### 11.4 ข้อมูลเที่ยวสมมติ — `tools/build-scenario.ts` (ออฟไลน์ แบบเดียวกับ build-story)
- ไฟล์ต้นทาง `tools/scenario.input.json` (Codex แต่งตามข้อ 2 ของ STORYBOARD — ชื่อ/ทะเบียน/เลขเอกสารสมมติทั้งหมด)
- สคริปต์ **import สูตรจาก `app/`** มาคิดค่าที่ระบบคำนวณ แล้วเขียน `src/data/scenario.json` พร้อมผลลัพธ์:
  ราคารวมบิล `billTotalOf` (`app/src/types/bill.ts`) · ปริมาตร (กว้าง×ยาว×สูง÷1,000,000×จำนวน ตามหน้าบันทึกบิล — ถ้ามีฟังก์ชันใน `lib/` ให้ import) ·
  Load Factor ฝั่งที่เต็มกว่า (ฟังก์ชันที่หน้าจัดรถใช้) · ระยะทาง `distanceFor()` · ค่าน้ำมันมาตรฐาน (ฟังก์ชันที่ `FuelSummary` ใช้) ·
  ต้นทุนพยากรณ์แยกกลุ่ม — ใช้ `lib/forecast/forecast.ts` กับ `app/public/data/sample/costrev/trips.json` (ชุดตัวอย่าง) ถ้าเรียกได้ ไม่งั้นแต่งตัวเลขแล้วติดธง `forecastIsFictional: true`
- เว็บอ่าน `scenario.json` อย่างเดียว **ไม่คำนวณสูตรธุรกิจในเบราว์เซอร์** (Auto-calc แค่นับจากค่าเดิมไปค่าใน JSON)
- เทสต์: ผลรวมต้นทุนแยกกลุ่ม = ต้นทุนรวม · ราคารวมบิลรวม = รายได้ใบรายการ · เลขที่ใบรายการตรงกันทุก Role

### 11.5 สัญญา `Story` สำหรับส่วน Admin (แทนคีย์ของ v1/v2 ที่ไม่ใช้แล้ว)
```ts
fleet:   { ready: number; moving: number; down: number;                    // จาก "สถานะกองรถ" (tripEta)
           dots: { plate: string; from: string; to: string; status: "moving" | "ready" | "down" }[] };   // ≤ 40 จุด ทะเบียนสมมติใน sample
lf:      { avg: number; idle: number; sim: { delta: number; saved: number }[] };   // delta = +5,+10 จุด% · saved = ต้นทุนที่จมลดลง (บาท)
manager: { date: string; branches: { name: string; trips: number; goodTrips: number; lossTrips: number;
                                     forgotten: number; late: number }[];
           lossTrips: { docNo: string; route: string; profit: number }[];      // ตัวอย่าง 3 แถวของสาขาที่ขาดทุนมากสุด
           lateBills: { billNo: string; due: string; actual: string; days: number }[] };
```
- นิยาม "เที่ยวกำไรดี" = เที่ยวที่ %Margin ≥ 10% (เกณฑ์เดียวกับ Performance Index) · ขาดทุน = กำไร < 0 — ถ้าเจ้าของงานกำหนดอื่นให้แก้ที่นี่
- `build-story.ts` (Phase ตัวเลขจริง) ต้อง import สูตรจาก: `tripProgress`/สถานะรายคัน (`lib/record/tripEta.ts` + ที่ FleetStatusPage ใช้) ·
  จำลอง LF (`lib/loadfactor/calc.ts`) · ส่งช้า/ของตกค้าง (ที่ FleetDash ใช้ — ถ้าอยู่ใน features ให้ทำตามกติกาข้อ 5.3: ห้ามคัดลอก จด CHANGELOG)

### 11.6 Phase ของ v3
| Phase | งาน | เกณฑ์ผ่าน |
|---|---|---|
| **V1 โครง + R0 + R1** | ล้างของ v2 · `mock/` ธีม + AppWindow + RolePickerMock + BillEntryMock · primitive ทั้งชุด · narration · scenario (บิล) · ฉาก R0 + R1 ครบ 7 step | เลื่อน/กด → ครบ 7 step ลื่น · เลื่อนกลับแล้วตัวหนังสือลบกลับ · หน้าจำลองตรงกับหน้าจริง (เทียบภาพกับแอปที่รัน `npm run dev` ใน `app/` แบบอ่านอย่างเดียว) · `?lite` ครบ · **ส่งไม้ให้เจ้าของงานดูก่อนทำต่อ** |
| **V2 R2–R4** | DispatchMock + LoadTruckMock · DriverMock · DraftsMock + AccountMock · scenario ครบ · เส้นสถานะใบรายการ | เลขที่ใบรายการ/ทะเบียนตรงกันทุก Role · ผลรวมตามเทสต์ 11.4 |
| **V3 Admin + END** | ExecMock · FleetStatusMock · LfSimMock · ManagerMock · story.sample ตาม 11.5 · ฉากปิด | ไม่มีคำว่า real-time/GPS/กำไรเพิ่ม ในข้อความ LF/ตำแหน่ง (เทสต์ grep) |
| **V4 ตัวเลขจริง + ซ้อม** | `build-story.ts` ส่วน Admin · checklist ข้อ 10 | ตามข้อ 10 |

แต่ละ Phase ปิดด้วยบล็อกส่งไม้ตาม `HANDOFF.md` · V1 ให้เจ้าของงานเปิดดูเอง (Claude รีวิวต่อเมื่อเจ้าของงานสั่ง)
