/**
 * แปลง TripRecord เป็นแถวของชีต — ยกจาก recordToRow() / recordBillRows() ใน v5:1713-1810
 *
 * ลำดับคอลัมน์ต้องตรงกับ HEADERS / DEBT_HEADERS ใน apps-script/Code.gs เป๊ะ ๆ
 * ถ้าสลับกันแม้ช่องเดียว ข้อมูลจะลงผิดคอลัมน์โดยไม่มี error ให้เห็น
 * จึงมีเทสต์คุมทั้งจำนวนช่องและตำแหน่งของช่องสำคัญ
 */
import { r2, thDateSafe, thSlashSafe } from "../record/date";
import { billIsPaid, billPayDate, recBills, recPayInfo } from "../record/payment";
import { roleAllDone, roleDone } from "../record/roles";
import type { TripRecord } from "../../types/record";

/** จำนวนช่องที่ฝั่งเราส่ง — คอลัมน์ที่ 61 (_DATA) Apps Script เติมเอง */
export const TRIP_ROW_LENGTH = 60;
/** ชีต "ลูกหนี้" มี 20 คอลัมน์ */
export const BILL_ROW_LENGTH = 20;

export type Cell = string | number | "";

export function recordToRow(r: TripRecord): Cell[] {
  const p = recPayInfo(r);
  const bs = recBills(r);

  // ใบเก่าที่ยังไม่ผ่าน computeCost อาจไม่มียอดรวม จึงคำนวณสำรองให้
  const fuelSum = r.fuelSum != null ? r.fuelSum
    : (+r.fuelCash || 0) + (+r.fuelDownBill || 0) + (+r.fuelFleet || 0)
      + (+r.fuelPickup || 0) + (+r.fuelUpBill || 0) + (+r.fuelCallTruck || 0);

  const sheetTotal = r.sheetTotal != null ? r.sheetTotal
    : (+r.gas || 0) + fuelSum + (+r.drv || 0) + (+r.spare || 0) + (+r.snd || 0)
      + (+r.fuelDetour || 0) + (+r.fuelOffFleet || 0) + (+r.laborOff || 0)
      + (+r.fuelOff || 0) + (+r.fees || 0);

  return [
    /*  1 ลำดับ */ "",                       // Apps Script ใส่เลขลำดับตามตำแหน่งแถวเอง
    /*  2 สาขา */ r.branch || "",
    /*  3 วันที่ตัดจ่าย */ thSlashSafe(r.date),
    /*  4 เลขที่ใบรายการ */ r.docNo || "",
    /*  5 ประเภทใบรายการ */ r.docType || "",
    /*  6 ประเภทรถ */ r.fleetType || "",
    /*  7 ชนิดรถ */ r.vehicle || "",
    /*  8 ทะเบียนรถ */ r.plate || "",
    /*  9 ค่าแก๊สเดินทาง */ r2(r.gas),
    /* 10 ค่าน้ำมันเดินทาง(เงินสด) */ r2(r.fuelCash),
    /* 11 ขาล่อง(บิลน้ำมัน) */ r2(r.fuelDownBill),
    /* 12 ค่าน้ำมัน(Fleet Card) */ r2(r.fuelFleet),
    /* 13 ค่าน้ำมันไปเก็บสินค้า */ r2(r.fuelPickup),
    /* 14 ขาขึ้น(บิลน้ำมัน) */ r2(r.fuelUpBill),
    /* 15 ค่าเรียกรถไปขึ้นของ(บิลน้ำมัน) */ r2(r.fuelCallTruck),
    /* 16 ค่าเบี้ยเลี้ยงพขร. */ r2(r.drv),
    /* 17 ค่าเบี้ยเลี้ยงพขร.สำรอง */ r2(r.spare),
    /* 18 เบี้ยเลี้ยง SND */ r2(r.snd),
    /* 19 ค่าน้ำมันรถวิ่งอ้อม */ r2(r.fuelDetour),
    /* 20 ค่าน้ำมันนอกเส้นทาง(Fleet Card) */ r2(r.fuelOffFleet),
    /* 21 เบี้ยเลี้ยงนอกเส้นทาง */ r2(r.laborOff),
    /* 22 น้ำมันนอกเส้นทาง */ r2(r.fuelOff),
    /* 23 ค่าธรรมเนียมคืนตู้ */ r2(r.feeCont),
    /* 24 ค่าเข้าท่าเรือ */ r2(r.feePort),
    /* 25 ค่าส่งเอกสาร */ r2(r.feeDoc),
    /* 26 ค่าทางด่วน */ r2(r.feeToll),
    /* 27 ค่าปิดเปิดผ้าใบรถเทเลอร์ */ r2(r.feeTarp),
    /* 28 ค่าตำรวจ */ r2(r.feePolice),
    /* 29 Rev ค่าบรรทุกทั้งใบรายการ */ r2(r.revenue),
    /* 30 จุดขึ้น-จุดลง */ r.origin && r.dest ? `${r.origin}-${r.dest}` : "-",
    /* 31 ปี */ r.date ? +r.date.slice(0, 4) + 543 : "",
    /* 32 รวมค่าใช้จ่าย */ r2(sheetTotal),
    /* 33 ค่าน้ำมันเหมา */ r2(fuelSum),
    /* 34 ค่าซ่อมแซม */ r2(r.repTotal),
    // ───── ส่วนเสริมของโมเดล ─────
    /* 35 ID */ r.id,
    /* 36 ประเภทเส้นทาง */ r.routeType || "",
    /* 37 ระยะทาง(กม.) */ r2(r.dist),
    /* 38 ราคาน้ำมัน(บาท/ลิตร) */ r2(r.price),
    /* 39 น้ำมัน(ลิตร) */ r2(r.liters),
    /* 40 น้ำมันเดินทาง(คำนวณอัตโนมัติ) */ r2(r.fuelAuto),
    /* 41 ค่าซ่อมตามเวลา */ r2(r.repFix),
    /* 42 ค่าซ่อมตามระยะทาง */ r2(r.repVar),
    /* 43 ต้นทุนปกติรวม */ r2(r.normal),
    /* 44 ต้นทุนสูญเปล่า */ r2(r.waste),
    /* 45 กำไร/ขาดทุน */ r2(r.profit),
    /* 46 สถานะชำระ */ p.status,
    /* 47 จำนวนลูกหนี้ */ p.count,
    /* 48 ชำระแล้ว(ราย) */ p.paidCount,
    /* 49 ยอดรวมบิล */ r2(p.total),
    /* 50 วันที่ชำระครบ */ thSlashSafe(p.payDate),
    /* 51 จำนวนวันชำระ */ p.daysToPay != null ? p.daysToPay : "",
    /* 52 รายการลูกหนี้ */ bs.map((b) =>
      [b.no || "-", `${b.sender || ""}→${b.receiver || ""}`, b.qty || 0, b.total || 0,
       b.payType || "-",
       billIsPaid(b) ? "จ่ายแล้ว " + thDateSafe(billPayDate(b, r)) : "ค้างชำระ",
      ].join("|")).join(" ; "),
    // ───── workflow 3 ฝ่าย ─────
    /* 53 วันที่ปล่อยรถ */ thSlashSafe(r.releaseDate),
    /* 54 สถานะฝ่ายบริการลูกค้า */ roleDone(r, "cs") ? "กรอกแล้ว" : "ยังไม่กรอก",
    /* 55 เวลาบริการลูกค้ากรอก */ r._csAt || "",
    /* 56 สถานะฝ่ายจัดรถ */ roleDone(r, "dispatch") ? "กรอกแล้ว" : "ยังไม่กรอก",
    /* 57 เวลาจัดรถกรอก */ r._dispatchAt || "",
    /* 58 สถานะฝ่ายบัญชี */ roleDone(r, "account") ? "กรอกแล้ว" : "ยังไม่กรอก",
    /* 59 เวลาบัญชีกรอก */ r._accountAt || "",
    /* 60 ความครบถ้วน */ roleAllDone(r) ? "ครบทั้ง 3 ฝ่าย" : "ยังไม่ครบ",
    /* 61 _DATA — Apps Script เติมเอง */
  ];
}

export function recordBillRows(r: TripRecord): Cell[][] {
  const today = new Date().toISOString().slice(0, 10);

  return recBills(r).map((b, i) => {
    const pd = billPayDate(b, r);
    const aging = billIsPaid(b) ? "" : daysOrBlank(r.date, today);
    return [
      /*  1 วันที่ */ thSlashSafe(r.date),
      /*  2 เลขที่ใบรายการ */ r.docNo || "",
      /*  3 เลขที่บิล */ b.no || "",
      /*  4 ประเภทสินค้า */ b.goodsType || "",
      /*  5 ต้นทาง */ b.origin || r.origin || "",
      /*  6 ปลายทาง */ b.dest || r.dest || "",
      /*  7 ผู้ส่ง */ b.sender || "",
      /*  8 ผู้รับ */ b.receiver || "",
      /*  9 ประเภทการชำระเงิน */ b.payType || "",
      /* 10 สถานะการชำระเงิน */ billIsPaid(b) ? "ชำระแล้ว" : "ยังไม่ได้ชำระ",
      /* 11 จำนวน */ r2(b.qty),
      /* 12 ราคารวม */ r2(b.total),
      /* 13 จำนวนวันค้างชำระ */ aging,
      // ───── ส่วนเสริมของโมเดล ─────
      /* 14 BillID */ `${r.id}#${i}`,
      /* 15 ID ใบรายการ */ r.id,
      /* 16 สาขา */ r.branch || "",
      /* 17 วันที่ชำระ */ thSlashSafe(pd),
      /* 18 จำนวนวันชำระ */ pd ? daysOrBlank(r.date, pd) : "",
      // สองช่องนี้ v5 ไม่เคยส่ง ทำให้ว่างมาตลอด — ตรงกับ ราคาต่อหน่วย /
      // ประเภทการคิดราคา ในไฟล์บิล จึงเป็นกุญแจ join ต้นทุนกับรายได้
      /* 19 ราคา/หน่วย */ r2(b.unitPrice),
      /* 20 เกณฑ์คิดราคา */ b.pricingType || "",
    ];
  });
}

function daysOrBlank(a: string | null | undefined, b: string | null | undefined): number | "" {
  if (!a || !b) return "";
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000);
}

/** route ถูกคำนวณไว้แต่ชีตลูกหนี้ไม่มีคอลัมน์นี้แล้ว เก็บ export ไว้ให้หน้าจออื่นใช้ */
export const tripRoute = (r: Pick<TripRecord, "origin" | "dest">): string =>
  r.origin && r.dest ? `${r.origin}-${r.dest}` : "-";
