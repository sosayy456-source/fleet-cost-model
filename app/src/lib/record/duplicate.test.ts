/**
 * เทสต์การทำซ้ำใบรายการ
 *
 * จุดที่พลาดแล้วเสียหายจริงมีสองอย่าง — เลขที่ใบซ้ำจะทำให้ใบใหม่ไปทับใบเดิมบนชีต
 * (save.ts จับคู่ด้วย docNo เมื่อ id ไม่ตรง) และบิลที่ติดสถานะชำระแล้วมาจะกลายเป็น
 * หนี้ที่ไม่มีใครตามเก็บ เทสต์นี้ล็อกทั้งสองข้อไว้
 */
import { describe, expect, it } from "vitest";

import { duplicateRecord } from "./duplicate";
import { todayISO } from "./date";
import { emptyRecord } from "../../features/entry/emptyRecord";
import { CASH_ORIGIN } from "../../types/record";
import type { TripRecord } from "../../types/record";

const src = (): TripRecord => ({
  ...emptyRecord(),
  id: "R-เดิม",
  docNo: "IV-2568-001",
  date: "2026-09-01",
  releaseDate: "2026-09-01",
  origin: "กรุงเทพ", dest: "เชียงใหม่", dist: 690,
  plate: "70-1234", fleetType: "รถบริษัท", vehicle: "รถพ่วง",
  gas: 1200, drv: 800, feeToll: 150, revenue: 25_000,
  source: "ใหม่", synced: true,
  _csDone: true, _csAt: "2026-09-01 09:00",
  _dispatchDone: true, _dispatchAt: "2026-09-01 10:00",
  _accountDone: true, _accountAt: "2026-09-01 17:00",
  bills: [
    { no: "B1", goodsType: "ข้าวสาร", sender: "ก", receiver: "ข", origin: "กรุงเทพ", dest: "เชียงใหม่",
      qty: 10, total: 25_000, unitPrice: 2500, pricingType: "คิดตามหน่วย",
      payType: "เชื่อปลายทาง", paid: true, payDate: "2026-09-05" },
  ],
});

describe("duplicateRecord", () => {
  it("เก็บเนื้องานไว้ครบ — เส้นทาง รถ ต้นทุน ลูกค้า", () => {
    const d = duplicateRecord(src());

    expect(d.origin).toBe("กรุงเทพ");
    expect(d.dest).toBe("เชียงใหม่");
    expect(d.dist).toBe(690);
    expect(d.plate).toBe("70-1234");
    expect(d.gas).toBe(1200);
    expect(d.drv).toBe(800);
    expect(d.bills[0]!.sender).toBe("ก");
    expect(d.bills[0]!.unitPrice).toBe(2500);
  });

  it("ล้างเลขที่ใบ ไม่งั้นใบใหม่จะไปทับใบเดิมบนชีต", () => {
    expect(duplicateRecord(src()).docNo).toBe("");
  });

  it("ได้ id ใหม่ ไม่ซ้ำของเดิม", () => {
    const s = src();
    const a = duplicateRecord(s);
    const b = duplicateRecord(s);

    expect(a.id).not.toBe(s.id);
    expect(a.id).not.toBe(b.id);
  });

  it("วันที่เป็นวันนี้ และล้างวันปล่อยรถของเที่ยวเดิม", () => {
    const d = duplicateRecord(src());

    expect(d.date).toBe(todayISO());
    expect(d.releaseDate).toBe("");
  });

  it("บิลต้องไม่ติดสถานะชำระแล้วมาด้วย ไม่งั้นได้หนี้ที่ไม่มีใครตามเก็บ", () => {
    const b = duplicateRecord(src()).bills[0]!;

    expect(b.paid).toBe(false);
    expect(b.payDate).toBeNull();
    expect(b.no).toBe("");
  });

  it("ล้างธงว่าฝ่ายไหนกรอกแล้ว — ใบใหม่ต้องเริ่มนับความครบถ้วนใหม่", () => {
    const d = duplicateRecord(src());

    expect(d._csDone).toBeUndefined();
    expect(d._dispatchDone).toBeUndefined();
    expect(d._accountDone).toBeUndefined();
    expect(d._csAt).toBeUndefined();
    expect(d._accountAt).toBeUndefined();
  });

  it("นับเป็นใบที่ยังไม่ได้ซิงก์เสมอ", () => {
    expect(duplicateRecord(src()).synced).toBe(false);
  });

  it("ไม่แก้ใบต้นฉบับ", () => {
    const s = src();
    duplicateRecord(s);

    expect(s.docNo).toBe("IV-2568-001");
    expect(s.bills[0]!.paid).toBe(true);
    expect(s._csDone).toBe(true);
  });

  it("บิลสดต้นทางก็ต้องถูกล้างสถานะ — ระบบถือว่าชำระแล้วจากประเภท ไม่ใช่จากธง paid", () => {
    const s = src();
    s.bills = [{ ...s.bills[0]!, payType: CASH_ORIGIN, paid: true }];

    const b = duplicateRecord(s).bills[0]!;
    // ประเภทการชำระคงไว้ (เป็นข้อตกลงกับลูกค้ารายนั้น) แต่ธงกับวันที่ต้องล้าง
    expect(b.payType).toBe(CASH_ORIGIN);
    expect(b.paid).toBe(false);
    expect(b.payDate).toBeNull();
  });

  it("ใบที่ไม่มีบิลเลยก็ทำซ้ำได้ ไม่พัง", () => {
    const s = src();
    (s as { bills: unknown }).bills = undefined;

    expect(duplicateRecord(s).bills).toEqual([]);
  });
});
