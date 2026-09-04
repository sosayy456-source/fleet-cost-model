// ดึงข้อมูลอ้างอิงออกจาก โมเดลเดินรถ-gsheet-v5.html แล้วเขียนเป็น JSON
// อ่านบล็อก const ตรง ๆ แล้ว eval แทนการพิมพ์ตามมือ เพื่อไม่ให้ตัวเลขเพี้ยน
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const HTML = process.argv[2];
const OUT = process.argv[3];

const lines = readFileSync(HTML, "utf8").split(/\r?\n/);
// บรรทัด 1160-1245 (1-indexed) = BASE_PRICES .. REPAIR_ALIAS
// หยุดก่อน 1247 เพราะจากตรงนั้นเริ่มแตะ localStorage ซึ่ง Node ไม่มี
const block = lines.slice(1159, 1245).join("\n");

const names = [
  "BASE_PRICES", "DOC_TYPES", "BRANCHES", "RATES", "VEHICLE_CAPACITY",
  "SERVICE_GROUPS", "ROUTES", "REPAIR_YEARS", "REPAIR_BASE", "REPAIR_ALIAS",
];

const extract = new Function(`${block}\nreturn {${names.join(",")}};`);
const ref = extract();

for (const n of names) {
  if (ref[n] === undefined) throw new Error(`ไม่พบ ${n} ในบล็อกที่ดึงมา`);
}

mkdirSync(OUT, { recursive: true });

const write = (file, obj) => {
  writeFileSync(join(OUT, file), JSON.stringify(obj, null, 2) + "\n", "utf8");
  console.log(`  ${file}`);
};

console.log("เขียนไฟล์:");
write("fuelPrices.json", ref.BASE_PRICES.map(([date, price]) => ({ date, price })));
write("vehicles.json", ref.RATES.map(([name, litrePerKm]) => ({
  name,
  litrePerKm,
  capacityKg: ref.VEHICLE_CAPACITY[name] ?? null,
  repairKey: ref.REPAIR_ALIAS[name] ?? name,
})));
write("routes.json", ref.ROUTES);
write("repair.json", {
  years: ref.REPAIR_YEARS,
  weights: ref.REPAIR_BASE.weights,
  time: ref.REPAIR_BASE.time,
  dist: ref.REPAIR_BASE.dist,
});
write("enums.json", {
  docTypes: ref.DOC_TYPES,
  branches: ref.BRANCHES,
  serviceGroups: ref.SERVICE_GROUPS,
  fleetTypes: Object.keys(ref.REPAIR_BASE.time),
});

// ---- รายงานช่องโหว่: ชนิดรถที่ไม่มีอัตราค่าซ่อม จะได้ 0 แบบเงียบ ๆ ในโค้ดเดิม ----
console.log("\nตรวจความครบของตารางค่าซ่อม (ค่าที่ขาด = คิดเป็น 0 ในโมเดลเดิม):");
const fleetTypes = Object.keys(ref.REPAIR_BASE.time);
for (const [name] of ref.RATES) {
  const key = ref.REPAIR_ALIAS[name] ?? name;
  const missingTime = fleetTypes.filter((ft) => !(key in ref.REPAIR_BASE.time[ft]));
  const missingDist = key in ref.REPAIR_BASE.dist ? [] : ["dist"];
  if (missingTime.length || missingDist.length) {
    const parts = [];
    if (missingTime.length) parts.push(`time: ${missingTime.join(", ")}`);
    if (missingDist.length) parts.push("dist");
    console.log(`  ${name}  →  ${key}   ขาด ${parts.join(" | ")}`);
  }
}

const counts = {
  fuelPrices: ref.BASE_PRICES.length,
  vehicles: ref.RATES.length,
  routeOrigins: Object.keys(ref.ROUTES).length,
  routePairs: Object.values(ref.ROUTES).reduce((s, d) => s + Object.keys(d).length, 0),
  branches: ref.BRANCHES.length,
  docTypes: ref.DOC_TYPES.length,
};
console.log("\nสรุปจำนวน:", JSON.stringify(counts));
