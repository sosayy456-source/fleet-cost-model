// ตรวจว่า costrev/trips.json รุ่นใหม่ (คอลัมน์) แปลงกลับได้เท่ารุ่นเดิม (แถว) ทุกเที่ยวทุกฟิลด์
// ★ พิมพ์แค่จำนวนและชื่อฟิลด์ที่ไม่ตรง ไม่พิมพ์ค่าในไฟล์ — ใช้กับข้อมูลจริงได้โดยไม่เปิดเผยตัวเลข
//
// ใช้ (ใน app/):
//   node tools/verify-trips.mjs --dataset real            เทียบ public/data/real/costrev/trips.old.json กับ trips.json
//   node tools/verify-trips.mjs <ไฟล์เดิม> <ไฟล์ใหม่>
//
// ขั้นตอนกับข้อมูลจริง: คัดลอก trips.json เดิมเป็น trips.old.json → รัน ETL ใหม่ → รันสคริปต์นี้ → ลบ trips.old.json
// ต้องใช้ node ≥ 22.18 (อ่านไฟล์ .ts ได้เอง)
import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { decodeTripColumns, isTripColumns } from "../src/lib/data/tripCols.ts";

const args = process.argv.slice(2);
let oldPath, newPath;
if (args[0] === "--dataset") {
  const dir = resolve(import.meta.dirname, "..", "public", "data", args[1] ?? "real", "costrev");
  oldPath = resolve(dir, "trips.old.json");
  newPath = resolve(dir, "trips.json");
} else if (args.length === 2) {
  [oldPath, newPath] = args;
} else {
  console.error("ใช้: node tools/verify-trips.mjs --dataset real|sample  หรือ  node tools/verify-trips.mjs <เดิม> <ใหม่>");
  process.exit(2);
}

const load = (p) => {
  const t0 = performance.now();
  const raw = JSON.parse(readFileSync(p, "utf8"));
  const rows = isTripColumns(raw) ? decodeTripColumns(raw) : raw;
  return { rows, cols: isTripColumns(raw), mb: statSync(p).size / 1e6, ms: performance.now() - t0 };
};

const a = load(oldPath);
const b = load(newPath);
console.log(`ไฟล์เดิม ${a.cols ? "คอลัมน์" : "แถว"} ${a.mb.toFixed(1)} MB · อ่าน+แปลง ${a.ms.toFixed(0)} ms`);
console.log(`ไฟล์ใหม่ ${b.cols ? "คอลัมน์" : "แถว"} ${b.mb.toFixed(1)} MB · อ่าน+แปลง ${b.ms.toFixed(0)} ms`);

// เทียบตามเลขที่ใบรายการ + ลำดับที่ซ้ำ (ใบเดียวมีได้หลายแถว) — ETL เขียนลำดับเดิมอยู่แล้ว แต่ไม่พึ่งลำดับ
const keyed = (rows) => {
  const seen = new Map();
  const m = new Map();
  for (const r of rows) {
    const n = (seen.get(r.id) ?? 0) + 1;
    seen.set(r.id, n);
    m.set(`${r.id}#${n}`, r);
  }
  return m;
};
const A = keyed(a.rows);
const B = keyed(b.rows);

let bad = 0;
const fields = new Map();
const onlyOld = [...A.keys()].filter((k) => !B.has(k)).length;
const onlyNew = [...B.keys()].filter((k) => !A.has(k)).length;
for (const [k, x] of A) {
  const y = B.get(k);
  if (!y) continue;
  if (isDeepStrictEqual(x, y)) continue;
  bad++;
  for (const f of new Set([...Object.keys(x), ...Object.keys(y)])) {
    if (!isDeepStrictEqual(x[f], y[f])) fields.set(f, (fields.get(f) ?? 0) + 1);
  }
}

console.log(`เที่ยว: เดิม ${a.rows.length} · ใหม่ ${b.rows.length} · มีแต่ในไฟล์เดิม ${onlyOld} · มีแต่ในไฟล์ใหม่ ${onlyNew}`);
if (!bad && !onlyOld && !onlyNew && a.rows.length === b.rows.length) {
  console.log("PASS  ตรงกันทุกเที่ยวทุกฟิลด์");
} else {
  console.log(`FAIL  ไม่ตรง ${bad} เที่ยว · ฟิลด์: ${[...fields].map(([f, n]) => `${f} (${n})`).join(", ") || "-"}`);
  process.exit(1);
}
