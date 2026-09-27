// ตรวจก่อน `npm run build:real` ว่ามีข้อมูลจริงครบให้คัดลอกลง dist-real/
// ไม่มี manifest.json ของชุดไหน = แอปเลือกชุดตัวอย่างให้ชุดนั้นเองตอนรัน (ดู lib/dataset.ts · useDebtors.ts)
// ★ ไม่อ่านเนื้อหาไฟล์ ดูแค่ว่ามีไฟล์อยู่
import { existsSync } from "node:fs";

const SETS = ["costrev", "loadfactor", "alloc", "debtors"];
const missing = SETS.filter((s) => !existsSync(`public/data/real/${s}/manifest.json`));

if (missing.includes("costrev")) {
  console.error("✗ ไม่พบ public/data/real/costrev/manifest.json — ยังไม่มีข้อมูลจริง หรือ ETL กำลังแปลงอยู่");
  console.error("  รอให้แถบ \"กำลังแปลง…\" ใน npm run dev หายก่อน แล้วค่อยรันใหม่");
  process.exit(1);
}
if (missing.length) console.warn(`! ชุดที่ยังไม่มีข้อมูลจริง (จะแสดงข้อมูลตัวอย่าง): ${missing.join(", ")}`);
else console.log("✓ ข้อมูลจริงครบทั้ง 4 ชุด");
