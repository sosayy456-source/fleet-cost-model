/**
 * เทสต์การคำนวณอัตราค่าซ่อมจากข้อมูลดิบ — ตามเอกสาร "ค่าซ่อม.pdf"
 *
 * สูตรนี้ตัดสินต้นทุนค่าซ่อมของทุกใบในระบบ ถ้าแบ่งประเภทผิดหรือหารผิดตัว
 * ตัวเลขจะเพี้ยนทั้งกระดานโดยไม่มีอะไรฟ้อง จึงล็อกทุกเงื่อนไขไว้ที่นี่
 */
import { describe, expect, it } from "vitest";

import {
  AMORTIZE_DIVISOR, TRACTOR_KEY, classifyRow, computeRates, isTrailerTail,
  parseMaintenance, parseOperations, parseWeights,
} from "./rates";
import { parseDelimited, toBEYear, toNumber, toWeight } from "./parse";

/** สร้างข้อความแบบที่ได้จากการคัดลอก Excel (คั่นด้วยแท็บ) */
const tsv = (...lines: string[][]) => lines.map((l) => l.join("\t")).join("\n");

describe("parse — อ่านตารางที่คัดลอกมา", () => {
  it("อ่าน TSV ที่มีจุลภาคอยู่ในเซลล์ได้ ไม่หลงคิดว่าเป็น CSV", () => {
    const rows = parseDelimited(tsv(
      ["ชนิดรถ", "รายละเอียดการซ่อม", "จำนวนเงิน"],
      ["รถ 6 ล้อใหญ่", "เปลี่ยนยาง, ถ่วงล้อ", "1,500"],
    ));
    expect(rows[1]).toEqual(["รถ 6 ล้อใหญ่", "เปลี่ยนยาง, ถ่วงล้อ", "1,500"]);
  });

  it("อ่าน CSV ที่มีเครื่องหมายคำพูดครอบได้", () => {
    const rows = parseDelimited('ชนิดรถ,รายละเอียด\nรถ 6 ล้อใหญ่,"เปลี่ยนยาง, ถ่วงล้อ"');
    expect(rows[1]).toEqual(["รถ 6 ล้อใหญ่", "เปลี่ยนยาง, ถ่วงล้อ"]);
  });

  it("ตัวเลขแบบ Excel — จุลภาค วงเล็บติดลบ สัญลักษณ์เงิน", () => {
    expect(toNumber("1,234.56")).toBeCloseTo(1234.56);
    expect(toNumber("(1,500)")).toBe(-1500);
    expect(toNumber("฿2,000")).toBe(2000);
    expect(toNumber("")).toBe(0);
  });

  it("น้ำหนักรับได้ทั้ง 20% · 0.2 · 20", () => {
    expect(toWeight("20%")).toBeCloseTo(0.2);
    expect(toWeight("0.2")).toBeCloseTo(0.2);
    expect(toWeight("20")).toBeCloseTo(0.2);
  });

  it("ปีรับได้ทั้ง พ.ศ. ค.ศ. และวันที่หลายรูปแบบ", () => {
    expect(toBEYear("2567")).toBe(2567);
    expect(toBEYear("2024")).toBe(2567);       // ค.ศ. ต้องบวก 543
    expect(toBEYear("24/09/2567")).toBe(2567);
    expect(toBEYear("2024-09-24")).toBe(2567);
    expect(toBEYear("ไม่ใช่ปี")).toBeNull();
  });
});

describe("classifyRow — แบ่งประเภทค่าใช้จ่าย", () => {
  it("สินทรัพย์รอตัดบัญชี → ตามเวลา และหารด้วย 8", () => {
    const r = classifyRow({ account: "สินทรัพย์รอตัดบัญชี", detail: "เปลี่ยนเครื่อง", amount: 80_000 });
    expect(r.driver).toBe("ระยะเวลา");
    expect(r.amount).toBe(80_000 / AMORTIZE_DIVISOR);
    expect(r.amortized).toBe(true);
  });

  it("ชื่อบัญชีมีความสำคัญเหนือคำสำคัญในรายละเอียด", () => {
    // เข้าทั้งสองเงื่อนไข ต้องได้ผลของเงื่อนไขแรกคือหาร 8
    const r = classifyRow({ account: "สินทรัพย์รอตัดบัญชี", detail: "ค่าต่อภาษี", amount: 800 });
    expect(r.amount).toBe(100);
  });

  it("คำสำคัญในรายละเอียด → ตามเวลา เต็มจำนวน", () => {
    for (const d of ["ค่าต่อภาษี", "ค่าบริการ GPS รายเดือน", "ค่าบำรุงรักษายาง"]) {
      const r = classifyRow({ account: "ค่าซ่อมบำรุง", detail: d, amount: 500 });
      expect(r.driver).toBe("ระยะเวลา");
      expect(r.amount).toBe(500);
    }
  });

  it("เทียบคำสำคัญโดยไม่สนจุด — พ.ร.บ กับ พรบ ต้องตรงกัน", () => {
    expect(classifyRow({ account: "", detail: "ค่าเบี้ยประกันภัย พรบ", amount: 1 }).driver).toBe("ระยะเวลา");
  });

  it("รายการทั่วไป → ตามระยะทาง เต็มจำนวน", () => {
    const r = classifyRow({ account: "ค่าซ่อมบำรุง", detail: "เปลี่ยนผ้าเบรก", amount: 3000 });
    expect(r.driver).toBe("ระยะทาง");
    expect(r.amount).toBe(3000);
  });
});

describe("isTrailerTail", () => {
  it("จับหางเทรลเลอร์ได้ทั้งสองการสะกด", () => {
    expect(isTrailerTail("หางเทรเลอร์")).toBe(true);
    expect(isTrailerTail("หางเทรลเลอร์")).toBe(true);
  });

  it("ไม่จับหางพ่วง ซึ่งเป็นคนละอย่าง", () => {
    expect(isTrailerTail("หางพ่วงคอก")).toBe(false);
    expect(isTrailerTail("หางพ่วงตู้เย็น")).toBe(false);
  });
});

describe("computeRates — อัตรารายปี", () => {
  const maint = [
    // รถ 6 ล้อใหญ่ ปี 2567 — ตามเวลา 2,000 · ตามระยะทาง 9,000
    { year: 2567, vehicle: "รถ 6 ล้อใหญ่", account: "", detail: "ค่าต่อภาษี", amount: 2000 },
    { year: 2567, vehicle: "รถ 6 ล้อใหญ่", account: "", detail: "เปลี่ยนผ้าเบรก", amount: 9000 },
  ];
  const ops = [
    { year: 2567, vehicle: "รถ 6 ล้อใหญ่", fleet: "รถบริษัท", km: 90_000, days: 200 },
  ];

  it("หารด้วยตัวหารที่ถูกต้องของแต่ละฐาน", () => {
    const r = computeRates(maint, ops);
    const v = r.vehicles[0]!;

    expect(v.time[2567]).toBeCloseTo(2000 / 200);    // 10 บาท/วัน
    expect(v.dist[2567]).toBeCloseTo(9000 / 90_000); // 0.1 บาท/กม.
    expect(v.fleets).toEqual(["รถบริษัท"]);
  });

  it("รวมตัวหารของทุกประเภทรถในชนิดเดียวกัน แล้วลงอัตราให้ทั้งสองประเภท", () => {
    const r = computeRates(maint, [
      ...ops,
      { year: 2567, vehicle: "รถ 6 ล้อใหญ่", fleet: "รถร่วม", km: 10_000, days: 50 },
    ]);
    const v = r.vehicles[0]!;

    expect(v.time[2567]).toBeCloseTo(2000 / 250);
    expect(v.dist[2567]).toBeCloseTo(9000 / 100_000);
    expect(v.fleets).toEqual(["รถบริษัท", "รถร่วม"]);
  });

  it("ยุบค่าซ่อมหางเข้าหัวลากตาม Step 2", () => {
    const r = computeRates(
      [
        { year: 2567, vehicle: "รถเทรเล่อร์ (แม่)", account: "", detail: "ซ่อมเครื่อง", amount: 6000 },
        { year: 2567, vehicle: "หางเทรเลอร์", account: "", detail: "ซ่อมแหนบ", amount: 4000 },
      ],
      [{ year: 2567, vehicle: "รถเทรเล่อร์ (แม่)", fleet: "รถบริษัท", km: 100_000, days: 300 }],
    );

    expect(r.vehicles).toHaveLength(1);
    expect(r.vehicles[0]!.vehicle).toBe(TRACTOR_KEY);
    expect(r.vehicles[0]!.dist[2567]).toBeCloseTo(10_000 / 100_000);
    expect(r.mergedTrailer[2567]).toBe(4000);
  });

  it("ปิดการยุบแล้วหางต้องแยกเป็นคนละชนิด", () => {
    const r = computeRates(
      [
        { year: 2567, vehicle: "รถเทรเล่อร์ (แม่)", account: "", detail: "ซ่อมเครื่อง", amount: 6000 },
        { year: 2567, vehicle: "หางเทรเลอร์", account: "", detail: "ซ่อมแหนบ", amount: 4000 },
      ],
      [
        { year: 2567, vehicle: "รถเทรเล่อร์ (แม่)", fleet: "รถบริษัท", km: 100_000, days: 300 },
        { year: 2567, vehicle: "หางเทรเลอร์", fleet: "รถบริษัท", km: 100_000, days: 300 },
      ],
      [],
      { mergeTrailer: false },
    );

    expect(r.vehicles).toHaveLength(2);
    expect(r.mergedTrailer).toEqual({});
  });

  it("ตัวหารเป็น 0 ต้องไม่ได้ Infinity แต่ต้องเตือน", () => {
    const r = computeRates(maint, [
      { year: 2567, vehicle: "รถ 6 ล้อใหญ่", fleet: "รถบริษัท", km: 0, days: 0 },
    ]);

    expect(r.vehicles[0]!.time[2567]).toBeUndefined();
    expect(r.vehicles[0]!.dist[2567]).toBeUndefined();
    expect(r.warnings.join(" ")).toMatch(/จำนวนวันรวมเป็น 0/);
    expect(r.warnings.join(" ")).toMatch(/ระยะทางรวมเป็น 0/);
  });

  it("มีค่าซ่อมแต่ไม่มีข้อมูลการปฏิบัติงาน ต้องข้ามและเตือน ไม่ใช่คิดมั่ว", () => {
    const r = computeRates(maint, []);

    expect(r.vehicles[0]!.time).toEqual({});
    expect(r.warnings.join(" ")).toMatch(/ไม่มีข้อมูลการปฏิบัติงาน/);
  });

  it("ชื่อชนิดรถที่มีช่องว่างต้องไม่ถูกตัดตอนอ่านกลับจากกุญแจของก้อนต้นทุน", () => {
    // มีข้อมูลการปฏิบัติงานแต่ไม่มีค่าซ่อม — ข้อความเตือนต้องมีชื่อเต็ม ไม่ใช่แค่ "รถ"
    const r = computeRates([], [
      { year: 2567, vehicle: "รถ 10 ล้อตู้เย็น", fleet: "รถบริษัท", km: 1000, days: 10 },
    ]);

    expect(r.warnings.join(" ")).toContain("รถ 10 ล้อตู้เย็น");
  });

  it("แยกก้อนต้นทุนตามปี ไม่ปนกัน", () => {
    const r = computeRates(
      [
        { year: 2567, vehicle: "รถ 6 ล้อใหญ่", account: "", detail: "ซ่อม", amount: 1000 },
        { year: 2568, vehicle: "รถ 6 ล้อใหญ่", account: "", detail: "ซ่อม", amount: 4000 },
      ],
      [
        { year: 2567, vehicle: "รถ 6 ล้อใหญ่", fleet: "รถบริษัท", km: 10_000, days: 100 },
        { year: 2568, vehicle: "รถ 6 ล้อใหญ่", fleet: "รถบริษัท", km: 10_000, days: 100 },
      ],
    );
    const v = r.vehicles[0]!;

    expect(v.dist[2567]).toBeCloseTo(0.1);
    expect(v.dist[2568]).toBeCloseTo(0.4);
    expect(r.years).toEqual([2567, 2568]);
  });
});

describe("ตัวอ่านตารางทั้งสามชุด", () => {
  it("ตารางค่าซ่อมดิบ — อ่านปีจากวันที่ซ่อมได้", () => {
    const t = parseMaintenance(tsv(
      ["วันที่ซ่อม", "เลขที่ใบสั่งซ่อม", "ทะเบียนรถ", "ชนิดรถ", "ชื่อบัญชี", "รายละเอียดการซ่อม", "จำนวนเงิน (บาท)"],
      ["15/03/2567", "WO-1", "70-1234", "รถ 6 ล้อใหญ่", "ค่าซ่อมบำรุง", "เปลี่ยนผ้าเบรก", "3,000"],
    ));

    expect(t.missing).toEqual([]);
    expect(t.rows[0]).toMatchObject({ year: 2567, vehicle: "รถ 6 ล้อใหญ่", amount: 3000 });
  });

  it("ตารางค่าซ่อมดิบ — บอกว่าขาดคอลัมน์ไหน", () => {
    const t = parseMaintenance(tsv(["ทะเบียนรถ", "หมายเหตุ"], ["70-1234", "x"]));
    expect(t.missing).toContain("ชนิดรถ");
    expect(t.missing).toContain("จำนวนเงิน");
  });

  it("ตารางการปฏิบัติงาน — หัวคอลัมน์มีหน่วยต่อท้ายก็ยังหาเจอ", () => {
    const t = parseOperations(tsv(
      ["ปี", "ชนิดรถ", "ประเภทรถ (บริษัท/รถร่วม)", "ระยะทางรวม (กม.)", "จำนวนวันรวม (วัน)"],
      ["2567", "รถ 10 ล้อตู้เย็น", "รถบริษัท", "120,000", "280"],
    ));

    expect(t.missing).toEqual([]);
    expect(t.rows[0]).toEqual({
      year: 2567, vehicle: "รถ 10 ล้อตู้เย็น", fleet: "รถบริษัท", km: 120_000, days: 280,
    });
  });

  it("ตารางน้ำหนัก — เตือนเมื่อรวมไม่ได้ 1.00", () => {
    const ok = parseWeights(tsv(["ปี พ.ศ.", "น้ำหนักPOR"], ["2567", "20%"], ["2568", "30%"], ["2569", "50%"]));
    expect(ok.rows.map((r) => r.weight)).toEqual([0.2, 0.3, 0.5]);
    expect(ok.warnings).toEqual([]);

    const bad = parseWeights(tsv(["ปี", "น้ำหนัก"], ["2567", "20%"], ["2568", "30%"]));
    expect(bad.warnings.join(" ")).toMatch(/ไม่ใช่ 1.00/);
  });
});
