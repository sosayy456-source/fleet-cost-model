/**
 * การบันทึกใบรายการ — ยกตรรกะจาก v5:2178-2229
 *
 * ปัญหาที่ต้องกัน: สามฝ่ายกรอกใบเดียวกันคนละเวลา ถ้าต่างคนต่างเขียนทับทั้งใบ
 * งานของฝ่ายที่กรอกก่อนจะหายไปเงียบ ๆ
 *
 * วิธีแก้ (read-modify-write):
 *   1. โหลดใบล่าสุดจากชีตก่อนเสมอ
 *   2. เอาเฉพาะฟิลด์ของฝ่ายตัวเองทับลงไป
 *   3. คำนวณยอดใหม่จากข้อมูลที่รวมแล้ว
 *   4. เขียนกลับ
 *
 * ★ ถ้าอ่านชีตไม่สำเร็จ ให้ "ยกเลิกการบันทึก" ไม่ใช่เขียนทับ
 *   เพราะเราไม่รู้ว่าฝ่ายอื่นกรอกอะไรไว้แล้วบ้าง (v5:2194 ก็ทำแบบนี้)
 */
import { computeCost } from "../cost/computeCost";
import { REF } from "../refdata";
import { loadTrips, pushRecords } from "../sheet/client";
import { ROLES, isEntryRole, stampRole } from "../record/roles";
import { put } from "./records";
import type { RefOverrides } from "../cost/types";
import type { RoleKey, TripRecord } from "../../types/record";

export class SaveAbortedError extends Error {}

/** ฟิลด์ที่ฝ่ายนี้เป็นเจ้าของ — ฝ่ายอื่นห้ามแตะ */
export function fieldsOwnedBy(role: RoleKey): string[] {
  if (role === "account") {
    // ฝ่ายบัญชีเป็นเจ้าของ "ทุกช่องต้นทุน" ซึ่ง ROLES เขียนย่อไว้เป็น "cost"
    return [
      "gas", "fuelCash", "fuelDownBill", "fuelFleet", "fuelPickup", "fuelUpBill",
      "fuelCallTruck", "fuelAutoOn", "fuelOff", "fuelDetour", "fuelOffFleet",
      "drv", "spare", "snd", "laborOff",
      "feeTarp", "feePolice", "feeCont", "feePort", "feeDoc", "feeToll",
    ];
  }
  return ROLES[role].fields;
}

/** คำนวณยอดทั้งหมดใหม่จากข้อมูลในใบ (แทน recomputeTotals() เดิม) */
export function recomputeTotals(rec: TripRecord, ovr?: RefOverrides): TripRecord {
  const r = computeCost(
    {
      date: rec.date, vehicle: rec.vehicle, fleetType: rec.fleetType,
      distance: rec.dist, revenue: rec.revenue,
      gas: rec.gas, fuelCash: rec.fuelCash, fuelDownBill: rec.fuelDownBill,
      fuelFleet: rec.fuelFleet, fuelPickup: rec.fuelPickup, fuelUpBill: rec.fuelUpBill,
      fuelCallTruck: rec.fuelCallTruck,
      // ใบเก่าก่อน v4 ไม่มีฟิลด์นี้ ถือว่าเปิดออโต้ไว้ตามพฤติกรรมเดิม
      fuelAutoOn: rec.fuelAutoOn !== false,
      fuelOff: rec.fuelOff, fuelDetour: rec.fuelDetour, fuelOffFleet: rec.fuelOffFleet,
      drv: rec.drv, spare: rec.spare, snd: rec.snd, laborOff: rec.laborOff,
      feeTarp: rec.feeTarp, feePolice: rec.feePolice, feeCont: rec.feeCont,
      feePort: rec.feePort, feeDoc: rec.feeDoc, feeToll: rec.feeToll,
    },
    REF,
    ovr,
  );

  return {
    ...rec,
    fuelSum: r.fuelSum, fuelAuto: r.fuelAuto, liters: r.litres, price: r.price,
    repVeh: r.repair.vehicle, repFix: r.repair.fixed, repRate: r.repair.rate,
    repVar: r.repair.varCost, repTotal: r.repair.total,
    fees: r.fees, labor: r.labor,
    normal: r.normal, waste: r.waste, sheetTotal: r.sheetTotal, profit: r.profit,
  };
}

export interface SaveOptions {
  role: RoleKey;
  /**
   * โซนของฝ่ายอื่นที่เปิดแก้ไขไว้ (ฝ่ายบัญชีกดชิปเปิด / ผู้ดูแลระบบเปิดทุกโซน)
   * ช่องในโซนเหล่านี้จะถูกบันทึกด้วย และประทับว่าฝ่ายนั้นกรอกแล้ว
   */
  alsoRoles?: RoleKey[];
  overrides?: RefOverrides;
  /** ปิดการคุยกับชีต ใช้ตอนเทสต์หรือทำงานออฟไลน์แบบตั้งใจ */
  offline?: boolean;
}

export interface SaveResult {
  record: TripRecord;
  pushed: boolean;
  mergedFromSheet: boolean;
}

/**
 * บันทึกใบรายการหนึ่งใบ
 * @throws SaveAbortedError ถ้าอ่านใบล่าสุดจากชีตไม่ได้ (กันเขียนทับงานฝ่ายอื่น)
 */
export async function saveRecord(draft: TripRecord, opts: SaveOptions): Promise<SaveResult> {
  const { role, overrides, offline, alsoRoles = [] } = opts;
  // ฝ่ายที่กำลังกรอกจริง = ฝ่ายตัวเอง + โซนอื่นที่เปิดแก้ไว้ (ไม่ซ้ำ)
  const acting = [...new Set([role, ...alsoRoles])].filter(isEntryRole);
  const mine = acting.flatMap(fieldsOwnedBy);

  let base: TripRecord = draft;
  let mergedFromSheet = false;

  if (!offline) {
    let latest: TripRecord[] | null = null;
    try {
      latest = await loadTrips();
    } catch (err) {
      throw new SaveAbortedError(
        "อ่านใบล่าสุดจากชีตไม่สำเร็จ จึงยังไม่บันทึก เพื่อไม่ให้เขียนทับงานของฝ่ายอื่น · " +
        (err as Error).message,
      );
    }

    const onSheet = latest.find((r) => r.id === draft.id)
      ?? latest.find((r) => draft.docNo && r.docNo === draft.docNo);

    if (onSheet) {
      // เริ่มจากของบนชีต แล้วทับเฉพาะช่องของฝ่ายเรา
      base = { ...onSheet } as TripRecord;
      for (const f of mine) {
        (base as unknown as Record<string, unknown>)[f] =
          (draft as unknown as Record<string, unknown>)[f];
      }
      // สถานะ workflow ของฝ่ายอื่นต้องคงไว้ตามที่ชีตบอก
      base.id = onSheet.id;
      mergedFromSheet = true;
    }
  }

  let stamped = base;
  for (const k of acting) stamped = stampRole(stamped, k);
  const rec = recomputeTotals(stamped, overrides);
  rec.synced = false;

  await put(rec);

  if (offline) return { record: rec, pushed: false, mergedFromSheet };

  await pushRecords([rec]);
  const synced = { ...rec, synced: true };
  await put(synced);
  return { record: synced, pushed: true, mergedFromSheet };
}
