/**
 * สุ่มข้อมูลใบรายการ — ใช้ตอนเทสต์เท่านั้น (ปุ่ม "🎲 สุ่มข้อมูล" คู่กับ "เริ่มใบใหม่")
 *
 * สุ่มเฉพาะโซนของฝ่ายที่กำลังกรอก ทับบนใบที่เปิดอยู่ (randomFor) — ไม่สร้างใบใหม่
 *   ★ ของเดิมสุ่มทุกโซนเป็นใบใหม่ทุกครั้ง: ฝ่าย cs กดแล้วช่องของฝ่ายจัดรถ/บัญชีถูกเขียนขึ้นชีต
 *     ทั้งที่ไม่ได้ประทับว่าฝ่ายนั้นกรอกแล้ว · ฝ่ายจัดรถกดแล้วได้ใบใหม่ เลขที่ใบ/วันที่ไม่ตรงกับใบของ cs
 *   ตอนนี้ฝ่ายจัดรถ/บัญชีเปิดใบที่ cs บันทึกไว้แล้วกดสุ่ม จะได้ค่าเฉพาะช่องของตัวเอง
 *   เลขที่ใบกับวันที่ (ช่องของ cs) ไม่ถูกแตะ · ผู้ดูแลระบบสุ่มครบทุกโซน (และ saveRecord ประทับครบทั้งสามฝ่าย)
 * ค่าที่สุ่มอิงข้อมูลอ้างอิงจริง (เส้นทาง/ชนิดรถ) ให้พอเดาได้ ไม่ใช่ตัวเลขมั่ว ๆ ล้วน
 * ★ 24 ก.ย. 2569 (เจ้าของงานสั่ง): บิลใช้แบบสินค้าจริงจาก lib/sim/cargo.ts · น้ำหนักบรรทุกจริง = ผลรวมน้ำหนักบิล
 *   ตั้งเป้า Load Factor 50–95% ของความจุรถ · รายได้ = Σ จำนวน × ราคาต่อชิ้น (ค่าขนส่งต่อ กก. ตามระยะทาง)
 *   · ลิตรน้ำมันตามระยะทาง ÷ อัตราสิ้นเปลืองของขนาดรถ · เบี้ยเลี้ยงคนขับตามจำนวนวันวิ่ง (500 กม./วัน)
 */
import { BRANCHES, DOC_TYPES, ORIGINS, SERVICE_GROUPS, destsFor, distanceFor, vehicleByName } from "../../lib/refdata";
import { genId, todayISO } from "../../lib/record/date";
import { fieldsOwnedBy } from "../../lib/store/save";
import { kindsOf, loadRoster } from "../../lib/store/roster";
import { FUEL_CATS, FUEL_PAYS, PAY_TYPES } from "../../types/record";
import { emptyFuelBill, fuelBillsToTotals } from "../../lib/cost/fuelBills";
import type { FuelBill, RoleKey, TripRecord } from "../../types/record";
import type { FleetType } from "../../lib/cost/types";
import { emptyBill } from "./emptyRecord";
import { randomCargo } from "../../lib/sim/cargo";

const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)]!;
const int = (min: number, max: number) => Math.floor(min + Math.random() * (max - min + 1));

/**
 * บิลหนึ่งใบของใบรายการ — ใบรายการไม่มีช่องน้ำหนัก/ขนาดของบิล จึงคิดราคาต่อชิ้นเสมอ (รายได้ = จำนวน × ราคาต่อชิ้น)
 * คืนน้ำหนักรวมแยกออกมาให้ตัวเรียกเอาไปรวมเป็นน้ำหนักบรรทุกจริงของรถ
 */
function randomBill(origin: string, dest: string, dist: number, targetKg?: number) {
  const n = int(1000, 9999);
  const c = randomCargo({ distKm: dist, targetKg });
  return {
    weight: c.weight,
    bill: {
      ...emptyBill(),
      no: `ทดสอบ${n}`,
      goodsType: c.kind,
      sender: `ลูกค้าทดสอบ ${int(1, 99)}`,
      receiver: `ผู้รับทดสอบ ${int(1, 99)}`,
      origin, dest,
      payType: pick(PAY_TYPES),
      qty: c.qty,
      unitPrice: c.perUnit,
      pricingType: "คิดตามหน่วย",
    },
  };
}

/** บิลทั้งใบรายการ — แบ่งน้ำหนักเป้าหมาย (Load Factor 50–95% ของความจุ) ให้ทุกบิลพอ ๆ กัน */
function randomBills(n: number, origin: string, dest: string, dist: number, capacityKg: number) {
  const target = capacityKg * (0.5 + Math.random() * 0.45);
  const out = Array.from({ length: n }, () => randomBill(origin, dest, dist, (target / n) * (0.7 + Math.random() * 0.6)));
  return { bills: out.map((o) => o.bill), weight: out.reduce((s, o) => s + o.weight, 0) };
}

/** กม./ลิตร ตามขนาดรถ (ดูจากความจุ) — ปิกอัพ ~9 · 6 ล้อ ~6 · 10 ล้อ ~4 · 12 ล้อ/เทรเลอร์ ~3 */
const kmPerL = (capacityKg: number): number =>
  capacityKg <= 3000 ? 9 : capacityKg <= 7000 ? 6 : capacityKg <= 12000 ? 4 : 3;

/**
 * สุ่มบิลน้ำมัน 2-4 ใบ คละวิธีจ่าย/ประเภท ให้พอเห็นป้ายสถานะครบ ๆ ตอนทดสอบ
 * ลิตรรวม ≈ ระยะทาง ÷ กม./ลิตร (±10%) แบ่งลงแต่ละใบ — เดิมสุ่ม 20–150 ลิตรต่อใบโดยไม่ดูระยะทาง
 */
function randomFuelBills(totalLitres: number): FuelBill[] {
  const pumps = ["ปั๊มเชียงใหม่", "ปั๊มนครสวรรค์", "ปั๊มลำปาง", "อื่น ๆ"];
  const out: FuelBill[] = [];
  const count = int(2, 4);
  for (let i = 0, n = count; i < n; i++) {
    const pay = pick(FUEL_PAYS);
    const b = { ...emptyFuelBill(todayISO()), pay, cat: pick(FUEL_CATS), pump: pick(pumps) };
    if (pay === "est") {
      out.push({ ...b, km: int(10, 120), ratePerKm: 0.25, pricePerL: 42.03, reason: "บิลหาย" });
      continue;
    }
    const litres = Math.max(10, Math.round((totalLitres / count) * (0.8 + Math.random() * 0.4)));
    out.push({
      ...b,
      no: pay === "cash" ? `บก.111-${int(100, 999)}` : `INV-${int(1000, 9999)}`,
      txnId: pay === "fleet" ? `FC-${int(10000, 99999)}` : "",
      liters: litres, amount: Math.round(litres * 42.03), proof: Math.random() < 0.7,
      src: pay === "fleet" ? "fleet" : "manual",
    });
  }
  return out;
}

/**
 * สุ่มคันจากทะเบียนในกองรถจริงเท่านั้น (loadRoster()) — ห้ามสุ่มทะเบียนสมมติขึ้นมาเอง
 * เลือกคู่ (ประเภทรถ, ชนิดรถ) จาก kindsOf() เพราะคันเดียวอาจวิ่งได้หลายคู่ (เช่นหางพ่วงเปลี่ยนตู้)
 * แล้วค่อยหาความจุจริงของชนิดรถนั้นจาก refdata — กองรถว่างเปล่า (ผู้ใช้ลบทิ้งหมด) ค่อยถอยไปสุ่มแบบเดิม
 */
function pickRosterVehicle() {
  const roster = loadRoster();
  if (roster.length === 0) return null;
  const active = roster.filter((f) => f.status === "ใช้งาน");
  const v = pick(active.length ? active : roster);
  const kind = pick(kindsOf(v));
  return { plate: v.plate, fleetType: kind.fleetType, vehicle: kind.vehicle };
}

/** สุ่มใบรายการหนึ่งใบ เริ่มจากค่าเปล่าแล้วเติมทุกช่องที่ฟอร์มให้กรอกได้ */
export function randomRecord(): TripRecord {
  const origin = pick(ORIGINS);
  const dest = pick(destsFor(origin));
  const dist = distanceFor(origin, dest) ?? int(50, 500);
  const roster = pickRosterVehicle();
  const plate = roster?.plate ?? `ทด.${int(10, 99)}-${int(1000, 9999)}`;
  const fleetType = (roster?.fleetType ?? pick(["รถบริษัท", "รถร่วม"])) as FleetType;
  const vehicleName = roster?.vehicle ?? "";
  const capacity = vehicleByName(vehicleName)?.capacityKg ?? pick([3000, 7000, 12000, 15000]);
  const days = Math.max(1, Math.ceil(dist / 500));
  const fuelBillsRnd = randomFuelBills((dist / kmPerL(capacity)) * (0.9 + Math.random() * 0.2));
  const load = randomBills(1, origin, dest, dist, capacity);
  const fuelTotals = fuelBillsToTotals(fuelBillsRnd);

  return {
    id: genId(), docNo: `ทดสอบ${Date.now().toString().slice(-6)}`, source: "ใหม่", synced: false,
    date: todayISO(), routeType: pick(["ขาขึ้น", "ขาล่อง"]), branch: pick(BRANCHES), docType: pick(DOC_TYPES),
    origin, dest, dist, serviceGroup: pick(SERVICE_GROUPS),
    // รายได้ = Σ บิล (EntryForm คิดจากบิลอยู่แล้ว ช่องนี้เป็นค่าสำรองเมื่อไม่มีบิล)
    revenue: load.bills.reduce((s, b) => s + b.qty * (b.unitPrice ?? 0), 0),
    bills: load.bills,
    plate,
    fleetType,
    vehicle: vehicleName, releaseDate: todayISO(),
    capacity, loadActual: Math.min(capacity, load.weight), emptyLeg: false,
    gas: int(0, 500),
    // ค่าน้ำมันสุ่มเป็น "รายการบิล" แล้วสรุปลง 9 ช่องด้วยฟังก์ชันจริง ไม่สุ่มยอดลงช่องตรง ๆ
    // ไม่งั้นตัวเลขในช่องกับตารางบิลจะไม่ตรงกัน (และ applyFuelBills จะล้างทิ้งตอนบันทึกอยู่ดี)
    ...fuelTotals, fuelBills: fuelBillsRnd,
    fuelSum: 0, fuelAutoOn: false, fuelAuto: 0, liters: 0, price: 0,
    // เบี้ยเลี้ยงคนขับวันละ 300–450 ตามจำนวนวันวิ่ง · สำรอง/นอกเส้นทางมีบ้างไม่มีบ้าง
    drv: days * int(300, 450), spare: Math.random() < 0.3 ? days * int(200, 300) : 0,
    snd: Math.random() < 0.3 ? int(100, 400) : 0, laborOff: Math.random() < 0.15 ? int(100, 400) : 0,
    feeTarp: int(0, 300), feePolice: int(0, 300), feeCont: int(0, 500), feePort: int(0, 500),
    feeDoc: int(0, 300), feeToll: int(0, 500),
    repVeh: "", repFix: 0, repRate: 0, repVar: 0, repTotal: 0,
    fees: 0, labor: 0, normal: 0, waste: 0, sheetTotal: 0, profit: 0,
    _v2: true, _v3: true, _v4: true, _v5: true,
  };
}

/**
 * สุ่มเฉพาะช่องของฝ่ายใน zones แล้วทับลงบน base — ช่องของฝ่ายอื่น รวมถึง id ธง workflow
 * และสถานะซิงก์ คงค่าจาก base ทั้งหมด
 *
 * วันปล่อยรถ (ช่องของฝ่ายจัดรถ) = วันที่ในใบเป๊ะ ไม่สุ่มเหลื่อมวัน — ใบที่สุ่มจะได้ขึ้นสถานะ
 * "กำลังเดินทาง" ในหน้าสถานะกองรถทันทีโดยไม่ต้องรอข้ามวัน (tripEta ถือว่ายังไม่ถึงวันปล่อยรถ
 * = ยังไม่ออกวิ่ง ถ้าวันปล่อยรถล้ำไปในอนาคตกว่าวันที่ในใบ)
 */
export function randomFor(base: TripRecord, zones: RoleKey[]): TripRecord {
  const full = randomRecord();
  const out = { ...base } as unknown as Record<string, unknown>;
  for (const f of zones.flatMap(fieldsOwnedBy)) {
    out[f] = (full as unknown as Record<string, unknown>)[f];
  }
  // บิล (ช่องของ cs) สุ่มเท่าจำนวนแถวที่มีในฟอร์ม — มีลูกหนี้ 3 ราย กด "เพิ่มรายการลูกหนี้" ให้ครบ 3 แถว
  // ก่อนแล้วค่อยกดสุ่ม ได้ 3 บิล · ใบเปล่ามีแถวว่างอยู่แล้ว 1 แถว (emptyRecord) จึงได้อย่างน้อย 1 บิลเสมอ
  if (zones.includes("cs")) {
    const n = Math.max(1, base.bills?.length ?? 0);
    const cap = Number(out.capacity) || vehicleByName(String(out.vehicle ?? ""))?.capacityKg || 12000;
    const load = randomBills(n, out.origin as string, out.dest as string, Number(out.dist) || 500, cap);
    out.bills = load.bills;
    // น้ำหนักบรรทุกจริงเป็นช่องของฝ่ายจัดรถ — ตามบิลที่สุ่มใหม่เฉพาะตอนสุ่มโซนนั้นด้วย ไม่งั้นทับงานฝ่ายอื่น
    if (zones.includes("dispatch")) out.loadActual = Math.min(cap, load.weight);
  }
  if (zones.includes("dispatch")) {
    out.releaseDate = (out.date as string) || todayISO();
  }
  // บิลน้ำมันที่สุ่มมาลงวันที่ "วันนี้" เสมอ — ถ้าไปสุ่มทับใบเก่าที่ลงวันอื่น ทุกแถวจะติดป้าย
  // "นอกช่วงเดินทาง" ทั้งที่ข้อมูลทดสอบไม่ได้ผิดอะไร ย้ายมาลงวันเดียวกับใบให้เลย
  if (Array.isArray(out.fuelBills)) {
    const d = (out.date as string) || todayISO();
    out.fuelBills = (out.fuelBills as FuelBill[]).map((b) => ({ ...b, date: d }));
  }
  return out as unknown as TripRecord;
}
