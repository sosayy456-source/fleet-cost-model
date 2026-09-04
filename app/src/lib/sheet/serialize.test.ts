/**
 * เทสต์การเรียงคอลัมน์ — อ่าน HEADERS จาก apps-script/Code.gs ตัวจริง
 * แล้วเทียบกับสิ่งที่ฝั่ง TypeScript ส่งไป
 *
 * ทำแบบนี้เพราะสองไฟล์นี้ต้องตรงกันเป๊ะ แต่คนละภาษาคนละที่ ถ้าใครแก้ข้างเดียว
 * ข้อมูลจะลงผิดคอลัมน์โดยไม่มี error ให้เห็นเลย เทสต์นี้จับได้ทันที
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  BILL_ROW_LENGTH, TRIP_ROW_LENGTH, recordBillRows, recordToRow,
} from "./serialize";
import { recPayInfo } from "../record/payment";
import { stampRole } from "../record/roles";
import type { Bill, TripRecord } from "../../types/record";
import { CASH_ORIGIN, ST_PAID, ST_PARTIAL, ST_UNPAID } from "../../types/record";

const HERE = dirname(fileURLToPath(import.meta.url));
const CODE_GS = resolve(HERE, "../../../../apps-script/Code.gs");

/** ดึง array ของ header ออกจากไฟล์ .gs (มีคอมเมนต์แทรกจึงใช้ eval ไม่ใช่ JSON.parse) */
function headersFromAppsScript(name: string): string[] {
  const src = readFileSync(CODE_GS, "utf8");
  const dataColName = /var DATA_COL_NAME\s*=\s*'([^']+)'/.exec(src)?.[1] ?? "_DATA";
  const start = src.indexOf(`var ${name} = [`);
  if (start < 0) throw new Error(`ไม่พบ ${name} ใน Code.gs`);
  const end = src.indexOf("];", start);
  const literal = src.slice(start + `var ${name} = `.length, end + 1);
  return new Function("DATA_COL_NAME", `return ${literal};`)(dataColName) as string[];
}

const bill = (over: Partial<Bill> = {}): Bill => ({
  no: "B1", goodsType: "ของย่อย", sender: "S", receiver: "R",
  origin: "เชียงใหม่", dest: "ตลาดไท", qty: 2, total: 500,
  payType: "เชื่อปลายทาง", paid: false, payDate: null, ...over,
});

const rec = (over: Partial<TripRecord> = {}): TripRecord => ({
  id: "R123", docNo: "DOC-1", source: "ใหม่", synced: false,
  date: "2025-07-17", routeType: "ขาขึ้น", branch: "เชียงใหม่", docType: "ของย่อย",
  origin: "เชียงใหม่", dest: "ตลาดไท", dist: 720, serviceGroup: "สินค้าทั่วไป (General Cargo)",
  revenue: 60000, bills: [bill()],
  plate: "70-1234", fleetType: "รถบริษัท", vehicle: "รถเทรเลอร์",
  releaseDate: "2025-07-16", capacity: 25000, loadActual: 20000, emptyLeg: false,
  gas: 0, fuelCash: 3000, fuelDownBill: 0, fuelFleet: 5000, fuelPickup: 0,
  fuelUpBill: 0, fuelCallTruck: 0, fuelSum: 8000, fuelAutoOn: true,
  fuelAuto: 1234.5, liters: 249.1, price: 42.03,
  fuelOff: 0, fuelDetour: 1200, fuelOffFleet: 0,
  drv: 1500, spare: 0, snd: 0, laborOff: 300,
  feeTarp: 200, feePolice: 0, feeCont: 0, feePort: 0, feeDoc: 100, feeToll: 450,
  repVeh: "รถเทรเล่อร์ (แม่)", repFix: 2100, repRate: 2.0, repVar: 1440, repTotal: 3540,
  fees: 750, labor: 1500, normal: 13790, waste: 1500, sheetTotal: 11750, profit: 44710,
  ...over,
});

/** จับคู่ชื่อคอลัมน์กับค่าที่ส่งไป เพื่อตรวจตำแหน่งโดยอ้างชื่อ ไม่ใช่เลข index */
function labelled(row: unknown[], headers: string[]): Record<string, unknown> {
  return Object.fromEntries(row.map((v, i) => [headers[i]!, v]));
}

describe("แถวชีต ค่าเดินทาง ต้องตรงกับ HEADERS ใน Code.gs", () => {
  const headers = headersFromAppsScript("HEADERS");

  it("Code.gs มี 61 คอลัมน์ และช่องสุดท้ายคือ _DATA", () => {
    expect(headers.length).toBe(61);
    expect(headers.at(-1)).toBe("_DATA");
  });

  it("ฝั่งเราส่ง 60 ช่อง — ช่องที่ 61 ให้ Apps Script เติมเอง", () => {
    const row = recordToRow(rec());
    expect(row.length).toBe(TRIP_ROW_LENGTH);
    expect(row.length).toBe(headers.length - 1);
  });

  it("ค่าลงตรงคอลัมน์ตามชื่อ", () => {
    const r = rec();
    const row = labelled(recordToRow(r), headers);

    expect(row["ลำดับ"]).toBe("");                    // Apps Script ใส่เอง
    expect(row["สาขา"]).toBe("เชียงใหม่");
    expect(row["วันที่ตัดจ่าย"]).toBe("17/07/2568");   // พ.ศ. แบบ dd/mm/yyyy
    expect(row["เลขที่ใบรายการ"]).toBe("DOC-1");
    expect(row["ID"]).toBe("R123");
    expect(row["ค่าซ่อมแซม"]).toBe(3540);
    expect(row["ค่าน้ำมันเหมา"]).toBe(8000);
    expect(row["รวมค่าใช้จ่าย"]).toBe(11750);
    expect(row["ต้นทุนปกติรวม"]).toBe(13790);
    expect(row["กำไร/ขาดทุน"]).toBe(44710);
    expect(row["จุดขึ้น-จุดลง"]).toBe("เชียงใหม่-ตลาดไท");
    expect(row["ปี"]).toBe(2568);
    expect(row["ระยะทาง(กม.)"]).toBe(720);
  });

  it("ช่อง workflow 3 ฝ่ายสะท้อนสถานะจริง", () => {
    const headersNoData = headers;
    const empty = labelled(recordToRow(rec()), headersNoData);
    expect(empty["สถานะฝ่ายบริการลูกค้า"]).toBe("ยังไม่กรอก");
    expect(empty["ความครบถ้วน"]).toBe("ยังไม่ครบ");
    expect(empty["วันที่ปล่อยรถ"]).toBe("16/07/2568");

    let r = rec();
    for (const k of ["cs", "dispatch", "account"] as const) r = stampRole(r, k);
    const done = labelled(recordToRow(r), headersNoData);
    expect(done["สถานะฝ่ายจัดรถ"]).toBe("กรอกแล้ว");
    expect(done["ความครบถ้วน"]).toBe("ครบทั้ง 3 ฝ่าย");
    expect(String(done["เวลาบัญชีกรอก"])).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  });

  it("ค่าที่ไม่ใช่ตัวเลขส่งเป็นช่องว่าง ไม่ใช่ 0", () => {
    const row = labelled(recordToRow(rec({ dist: NaN as unknown as number })), headers);
    expect(row["ระยะทาง(กม.)"]).toBe("");
  });
});

describe("แถวชีต ลูกหนี้ ต้องตรงกับ DEBT_HEADERS", () => {
  const headers = headersFromAppsScript("DEBT_HEADERS");

  it("มี 20 คอลัมน์ และฝั่งเราส่งครบทั้ง 20", () => {
    expect(headers.length).toBe(BILL_ROW_LENGTH);
    const rows = recordBillRows(rec());
    expect(rows).toHaveLength(1);
    expect(rows[0]!.length).toBe(headers.length);
  });

  it("สองช่องท้ายที่ v5 ไม่เคยส่ง ตอนนี้ส่งได้แล้ว", () => {
    const r = rec({ bills: [bill({ unitPrice: 250, pricingType: "ตามน้ำหนัก" })] });
    const row = labelled(recordBillRows(r)[0]!, headers);
    expect(row["ราคา/หน่วย"]).toBe(250);
    expect(row["เกณฑ์คิดราคา"]).toBe("ตามน้ำหนัก");
  });

  it("BillID ผูกกับ id ของใบรายการ", () => {
    const r = rec({ bills: [bill({ no: "B1" }), bill({ no: "B2" })] });
    const rows = recordBillRows(r).map((x) => labelled(x, headers));
    expect(rows[0]!["BillID"]).toBe("R123#0");
    expect(rows[1]!["BillID"]).toBe("R123#1");
    expect(rows[1]!["ID ใบรายการ"]).toBe("R123");
  });
});

describe("สถานะการชำระ — สดต้นทางถือว่าจ่ายแล้วทันที", () => {
  it("บิลสดต้นทางไม่ต้องกดชำระ ก็นับว่าชำระแล้ว", () => {
    const r = rec({ bills: [bill({ payType: CASH_ORIGIN, paid: false })] });
    const p = recPayInfo(r);
    expect(p.status).toBe(ST_PAID);
    expect(p.paidCount).toBe(1);
    // วันที่ชำระของบิลสดต้นทาง = วันที่ของใบรายการ
    expect(p.payDate).toBe("2025-07-17");
    expect(p.daysToPay).toBe(0);
  });

  it("จ่ายบางบิล = ยังชำระไม่ครบ และยังไม่มีวันที่ชำระครบ", () => {
    const r = rec({ bills: [bill({ paid: true, payDate: "2025-08-01" }), bill({ paid: false })] });
    const p = recPayInfo(r);
    expect(p.status).toBe(ST_PARTIAL);
    expect(p.payDate).toBeNull();
    expect(p.total).toBe(1000);
  });

  it("ไม่มีบิลเลย = ยังไม่ได้ชำระ", () => {
    expect(recPayInfo(rec({ bills: [] })).status).toBe(ST_UNPAID);
  });

  it("จ่ายครบ วันที่ชำระครบคือวันล่าสุด", () => {
    const r = rec({
      bills: [
        bill({ paid: true, payDate: "2025-08-01" }),
        bill({ paid: true, payDate: "2025-08-20" }),
      ],
    });
    const p = recPayInfo(r);
    expect(p.status).toBe(ST_PAID);
    expect(p.payDate).toBe("2025-08-20");
    expect(p.daysToPay).toBe(34);
  });
});
