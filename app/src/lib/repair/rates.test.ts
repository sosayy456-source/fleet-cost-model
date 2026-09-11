/**
 * เทสต์การคำนวณอัตราค่าซ่อมจากข้อมูลดิบ — ตามเอกสาร "ค่าซ่อม.pdf"
 * และรูปแบบไฟล์จริงจาก "รายงานค่าซ่อมตามงวด"
 *
 * สูตรนี้ตัดสินต้นทุนค่าซ่อมของทุกใบในระบบ ถ้าแบ่งประเภทผิดหรือหารผิดตัว
 * ตัวเลขจะเพี้ยนทั้งกระดานโดยไม่มีอะไรฟ้อง จึงล็อกทุกเงื่อนไขไว้ที่นี่
 */
import { describe, expect, it } from "vitest";

import {
  AMORTIZE_DIVISOR, ANY_FLEET, TRACTOR_KEY, canonVehicle, classifyRow, computeRates,
  isTrailerTail, parseMaintenance, parseOperations, parseWeights,
} from "./rates";
import { parseDelimited, toBEYear, toNumber, toWeight } from "./parse";
import type { MaintRow, OpRow } from "./rates";

/** สร้างข้อความแบบที่ได้จากการคัดลอก Excel (คั่นด้วยแท็บ) */
const tsv = (...lines: string[][]) => lines.map((l) => l.join("\t")).join("\n");

const m = (over: Partial<MaintRow>): MaintRow => ({
  year: 2567, vehicle: "รถ 6 ล้อใหญ่", fleet: "", account: "", detail: "", amount: 0, ...over,
});
const op = (over: Partial<OpRow>): OpRow => ({
  year: 2567, vehicle: "รถ 6 ล้อใหญ่", fleet: "รถบริษัท", km: 0, days: 0, ...over,
});

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
    const r = classifyRow({ account: "สินทรัพย์รอตัดบัญชี", detail: "ค่าต่อภาษี", amount: 800 });
    expect(r.amount).toBe(100);
  });

  it("คำสำคัญที่พบจริงในรายงาน → ตามเวลา เต็มจำนวน", () => {
    const real = [
      "ค่าบริการตรวจเช็ค 68 จุด เดือนมีนาคม 2567",
      "ค่าบำรุงรักษายาง เดือนมีนาคม 2567",
      "ค่าบริการ GPS เดือน มีนาคม 2567",
      "ค่าบริการบำรุงรักษา เดือนมีนาคม 2567",
    ];
    for (const d of real) {
      const r = classifyRow({ account: "ค่าบำรุงรักษารถใหญ่", detail: d, amount: 500 });
      expect(r.driver).toBe("ระยะเวลา");
      expect(r.amount).toBe(500);
    }
  });

  it("ค่าบำรุงรักษารถใหญ่ ไม่ใช่คำสำคัญ — ต้องเป็นตามระยะทาง", () => {
    // ชื่อคล้ายกับ "ค่าบริการบำรุงรักษา" แต่คนละรายการ ห้ามจับผิดตัว
    const r = classifyRow({ account: "", detail: "ค่าบำรุงรักษารถใหญ่ เดือนมีนาคม 2567", amount: 900 });
    expect(r.driver).toBe("ระยะทาง");
  });

  it("เทียบคำสำคัญโดยไม่สนจุด — พ.ร.บ กับ พรบ ต้องตรงกัน", () => {
    expect(classifyRow({ account: "", detail: "ค่าเบี้ยประกันภัย พรบ", amount: 1 }).driver).toBe("ระยะเวลา");
  });

  it("รายการทั่วไป → ตามระยะทาง เต็มจำนวน", () => {
    const r = classifyRow({ account: "ค่าซ่อมแซมรถใหญ่", detail: "เปลี่ยนผ้าเบรก", amount: 3000 });
    expect(r.driver).toBe("ระยะทาง");
    expect(r.amount).toBe(3000);
  });
});

describe("ชื่อชนิดรถ", () => {
  it("จับหางเทรลเลอร์ได้ทั้งสองการสะกด แต่ไม่จับหางพ่วง", () => {
    expect(isTrailerTail("หางเทรเลอร์")).toBe(true);
    expect(isTrailerTail("หางเทรลเลอร์")).toBe(true);
    expect(isTrailerTail("หางพ่วงคอก")).toBe(false);
    expect(isTrailerTail("หางพ่วงตู้เย็น")).toBe(false);
  });

  it("ปรับชื่อให้ตรงคีย์ในตารางโดยไม่สนช่องว่าง", () => {
    const known = ["รถเทรเล่อร์ (แม่)", "รถ 10 ล้อตู้เย็น"];
    expect(canonVehicle("รถเทรเล่อร์(แม่)", known)).toBe("รถเทรเล่อร์ (แม่)");
    expect(canonVehicle("รถ10ล้อตู้เย็น", known)).toBe("รถ 10 ล้อตู้เย็น");
    expect(canonVehicle("รถแปลก", known)).toBe("รถแปลก");
  });
});

describe("computeRates — อัตรารายปี", () => {
  const maint = [
    m({ detail: "ค่าต่อภาษี", amount: 2000 }),          // ตามเวลา
    m({ detail: "เปลี่ยนผ้าเบรก", amount: 9000 }),      // ตามระยะทาง
  ];
  const ops = [op({ km: 90_000, days: 200 })];

  it("หารด้วยตัวหารที่ถูกต้องของแต่ละฐาน", () => {
    const r = computeRates(maint, ops);
    const v = r.vehicles[0]!;

    expect(v.time[ANY_FLEET]?.[2567]).toBeCloseTo(2000 / 200);  // 10 บาท/วัน
    expect(v.dist[2567]).toBeCloseTo(9000 / 90_000);            // 0.1 บาท/กม.
    expect(v.fleets).toEqual(["รถบริษัท"]);
    expect(r.fleetSplit).toBe(false);
  });

  it("ไฟล์ไม่บอกประเภทรถ — รวมตัวหารทุกประเภทเป็นก้อนเดียว", () => {
    const r = computeRates(maint, [...ops, op({ fleet: "รถร่วม", km: 10_000, days: 50 })]);
    const v = r.vehicles[0]!;

    expect(v.time[ANY_FLEET]?.[2567]).toBeCloseTo(2000 / 250);
    expect(v.dist[2567]).toBeCloseTo(9000 / 100_000);
    expect(v.fleets).toEqual(["รถบริษัท", "รถร่วม"]);
  });

  it("★ ไฟล์บอกประเภทรถ — อัตราตามเวลาต้องแยกคนละประเภท", () => {
    const r = computeRates(
      [
        m({ fleet: "รถบริษัท", detail: "ค่าต่อภาษี", amount: 2000 }),
        m({ fleet: "รถร่วม", detail: "ค่าต่อภาษี", amount: 600 }),
      ],
      [op({ fleet: "รถบริษัท", days: 200 }), op({ fleet: "รถร่วม", days: 50 })],
    );
    const v = r.vehicles[0]!;

    expect(r.fleetSplit).toBe(true);
    expect(v.time["รถบริษัท"]?.[2567]).toBeCloseTo(2000 / 200);  // 10
    expect(v.time["รถร่วม"]?.[2567]).toBeCloseTo(600 / 50);      // 12
  });

  it("★ อัตราตามระยะทางรวมทุกประเภทเสมอ เพราะตารางมีแถวเดียว", () => {
    const r = computeRates(
      [
        m({ fleet: "รถบริษัท", detail: "เปลี่ยนยาง", amount: 8000 }),
        m({ fleet: "รถร่วม", detail: "เปลี่ยนยาง", amount: 2000 }),
      ],
      [
        op({ fleet: "รถบริษัท", km: 80_000, days: 200 }),
        op({ fleet: "รถร่วม", km: 20_000, days: 50 }),
      ],
    );

    expect(r.vehicles[0]!.dist[2567]).toBeCloseTo(10_000 / 100_000);
  });

  it("ประเภทรถที่มีช่องว่างแทรกต้องถือเป็นตัวเดียวกัน", () => {
    const r = computeRates(
      [m({ fleet: "รถ บริษัท", detail: "ค่าต่อภาษี", amount: 2000 })],
      [op({ fleet: "รถบริษัท", days: 200 })],
    );

    expect(r.vehicles[0]!.time["รถบริษัท"]?.[2567]).toBeCloseTo(10);
  });

  it("ยุบค่าซ่อมหางเข้าหัวลากตาม Step 2", () => {
    const r = computeRates(
      [
        m({ vehicle: "รถเทรเล่อร์ (แม่)", detail: "ซ่อมเครื่อง", amount: 6000 }),
        m({ vehicle: "หางเทรเลอร์", detail: "ซ่อมแหนบ", amount: 4000 }),
      ],
      [op({ vehicle: "รถเทรเล่อร์ (แม่)", km: 100_000, days: 300 })],
    );

    expect(r.vehicles).toHaveLength(1);
    expect(r.vehicles[0]!.vehicle).toBe(TRACTOR_KEY);
    expect(r.vehicles[0]!.dist[2567]).toBeCloseTo(10_000 / 100_000);
    expect(r.mergedTrailer[2567]).toBe(4000);
  });

  it("ปิดการยุบแล้วหางต้องแยกเป็นคนละชนิด", () => {
    const r = computeRates(
      [
        m({ vehicle: "รถเทรเล่อร์ (แม่)", detail: "ซ่อมเครื่อง", amount: 6000 }),
        m({ vehicle: "หางเทรเลอร์", detail: "ซ่อมแหนบ", amount: 4000 }),
      ],
      [
        op({ vehicle: "รถเทรเล่อร์ (แม่)", km: 100_000, days: 300 }),
        op({ vehicle: "หางเทรเลอร์", km: 100_000, days: 300 }),
      ],
      [],
      { mergeTrailer: false },
    );

    expect(r.vehicles).toHaveLength(2);
    expect(r.mergedTrailer).toEqual({});
  });

  it("ตัวหารเป็น 0 ต้องไม่ได้ Infinity แต่ต้องเตือน", () => {
    const r = computeRates(maint, [op({ km: 0, days: 0 })]);
    const v = r.vehicles[0]!;

    expect(v.time[ANY_FLEET]).toBeUndefined();
    expect(v.dist[2567]).toBeUndefined();
    expect(r.warnings.join(" ")).toMatch(/จำนวนวันรวมเป็น 0/);
    expect(r.warnings.join(" ")).toMatch(/ระยะทางรวมเป็น 0/);
  });

  it("มีค่าซ่อมแต่ไม่มีข้อมูลการปฏิบัติงาน ต้องข้ามและเตือน ไม่ใช่คิดมั่ว", () => {
    const r = computeRates(maint, []);

    expect(r.vehicles[0]!.time).toEqual({});
    expect(r.warnings.join(" ")).toMatch(/ไม่มีข้อมูลการปฏิบัติงาน/);
  });

  it("ชื่อชนิดรถที่มีช่องว่างต้องไม่ถูกตัดตอนอ่านกลับจากกุญแจของก้อนต้นทุน", () => {
    const r = computeRates([], [op({ vehicle: "รถ 10 ล้อตู้เย็น", km: 1000, days: 10 })]);
    expect(r.warnings.join(" ")).toContain("รถ 10 ล้อตู้เย็น");
  });

  it("แยกก้อนต้นทุนตามปี ไม่ปนกัน", () => {
    const r = computeRates(
      [
        m({ year: 2567, detail: "ซ่อม", amount: 1000 }),
        m({ year: 2568, detail: "ซ่อม", amount: 4000 }),
      ],
      [op({ year: 2567, km: 10_000, days: 100 }), op({ year: 2568, km: 10_000, days: 100 })],
    );
    const v = r.vehicles[0]!;

    expect(v.dist[2567]).toBeCloseTo(0.1);
    expect(v.dist[2568]).toBeCloseTo(0.4);
    expect(r.years).toEqual([2567, 2568]);
  });

  it("ปรับชื่อชนิดรถให้ตรงคีย์ในตาราง แล้วยุบเป็นตัวเดียว", () => {
    const r = computeRates(
      [
        m({ vehicle: "รถเทรเล่อร์(แม่)", detail: "ซ่อม", amount: 3000 }),
        m({ vehicle: "รถเทรเล่อร์ (แม่)", detail: "ซ่อม", amount: 7000 }),
      ],
      [op({ vehicle: "รถเทรเล่อร์ (แม่)", km: 100_000, days: 300 })],
      [],
      { knownVehicles: ["รถเทรเล่อร์ (แม่)"] },
    );

    expect(r.vehicles).toHaveLength(1);
    expect(r.vehicles[0]!.dist[2567]).toBeCloseTo(0.1);
  });
});

describe("ตัวอ่านตารางทั้งสามชุด", () => {
  /** หัวตารางชุดเดียวกับรายงานค่าซ่อมตามงวดของจริง */
  const REPORT_HEAD = [
    "ลำดับ", "สาขา", "ผู้บันทึก", "เลขที่ใบสั่งซ่อม", "วันที่ซ่อม", "วันที่ในใบซ่อม", "วันที่ตามงวด",
    "ประเภทรถ", "ชนิดรถ", "ทะเบียนรถ", "ชื่ออู่", "รายละเอียดการซ่อม", "จำนวนงวด", "รหัสบัญชี",
    "ชื่อบัญชี", "จำนวนเงิน", "หมายเหตุ",
  ];

  it("อ่านรายงานค่าซ่อมตามงวดของจริงได้ครบทุกคอลัมน์ที่ใช้", () => {
    const t = parseMaintenance(tsv(
      REPORT_HEAD,
      ["1", "เชียงใหม่", "180", "67019/046", "01/03/2567", "01/03/2567", "01/03/2567",
       "รถบริษัท", "รถ 12 ล้อตู้เย็น", "ชม.70-7820", "นิ่มคาร์วอช", "ค่าล้างรถตู้เย็น ครึ่ง คัน",
       "1", "501010916", "ค่าล้างรถ", "125.00", "ยานยนต์"],
    ));

    expect(t.missing).toEqual([]);
    expect(t.rows[0]).toEqual({
      year: 2567, vehicle: "รถ 12 ล้อตู้เย็น", fleet: "รถบริษัท",
      account: "ค่าล้างรถ", detail: "ค่าล้างรถตู้เย็น ครึ่ง คัน", amount: 125,
    });
  });

  it("★ ใช้วันที่ตามงวดก่อนวันที่ซ่อม — วันที่ซ่อมในรายงานจริงมีปีพิมพ์ผิดปนอยู่", () => {
    const t = parseMaintenance(tsv(
      ["วันที่ซ่อม", "วันที่ตามงวด", "ชนิดรถ", "จำนวนเงิน"],
      ["09/03/2556", "22/03/2567", "รถ 12 ล้อตู้เย็น", "500"],   // 2556 คือพิมพ์ผิด
    ));

    expect(t.rows[0]!.year).toBe(2567);
  });

  it("ข้ามแถวหัวตารางที่พิมพ์ซ้ำทุกหน้าของรายงาน", () => {
    const t = parseMaintenance(tsv(
      ["ชนิดรถ", "วันที่ตามงวด", "จำนวนเงิน"],
      ["รถ 6 ล้อใหญ่", "01/03/2567", "100"],
      ["ชนิดรถ", "วันที่ตามงวด", "จำนวนเงิน"],   // หัวตารางซ้ำ
      ["รถ 6 ล้อใหญ่", "02/03/2567", "200"],
    ));

    expect(t.rows).toHaveLength(2);
  });

  it("เตือนเมื่อไม่มีคอลัมน์ประเภทรถในตารางค่าซ่อม", () => {
    const t = parseMaintenance(tsv(
      ["ชนิดรถ", "ปี", "จำนวนเงิน"],
      ["รถ 6 ล้อใหญ่", "2567", "100"],
    ));

    expect(t.warnings.join(" ")).toMatch(/ประเภทรถ/);
    expect(t.rows[0]!.fleet).toBe("");
  });

  it("บอกว่าขาดคอลัมน์ไหน", () => {
    const t = parseMaintenance(tsv(["ทะเบียนรถ", "หมายเหตุ"], ["ชม.70-1234", "x"]));
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
