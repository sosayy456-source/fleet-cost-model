/**
 * ฟอร์มกรอกใบรายการเดินรถ — โครงตาม index.html บน branch main
 *
 * การ์ด 3 ใบมีเลขขั้นตอน (1 ข้อมูลการเดินทาง / 2 ค่าใช้จ่าย / 3 สรุปผล)
 * โซนของฝ่ายอื่น "ซ่อนทิ้ง" ไปเลยตามดีไซน์ของ main (ไม่ใช่แสดงแบบล็อก)
 * ยกเว้นฝ่ายบัญชีที่กดชิปในแถบความคืบหน้าเพื่อเปิดแก้โซนอื่นได้
 * และผู้ดูแลระบบที่เห็นทุกโซนตลอด
 *
 * ตารางราคาน้ำมัน / ค่าซ่อม / ทะเบียนรถ ย้ายไปหน้า "การตั้งค่า" แล้ว
 */
import { useEffect, useMemo, useState } from "react";
import { computeCost } from "../../lib/cost/computeCost";
import { applyFuelBills, ensureFuelBills } from "../../lib/cost/fuelBills";
import { applyOtherCosts, otherCostTotals, readyOtherCosts } from "../../lib/cost/otherCosts";
import { BRANCHES, DOC_TYPES, ORIGINS, REF, SERVICE_GROUPS, destsFor, distanceFor, vehicleOptions } from "../../lib/refdata";
import { custCode, ensureCustCount, ensureCustMap, isFullHash, peekCustCount, peekCustMap } from "../../lib/custmap/custmap";
import { nextNumber, registerBills, useNewCodes } from "../../lib/custmap/newCodes";
import { ROLES, ROLE_ORDER, canEditOthers, isEntryRole, roleDone } from "../../lib/record/roles";
import { recPayInfo } from "../../lib/record/payment";
import { thDateSafe } from "../../lib/record/date";
import { SaveAbortedError, saveRecord } from "../../lib/store/save";
import { getById } from "../../lib/store/records";
import { useOverrides } from "../../lib/store/overrides";
import { matchesKind, useRoster } from "../../lib/store/roster";
import { getUrl } from "../../lib/sheet/client";
import { emptyBill, emptyRecord } from "./emptyRecord";
import { randomFor } from "./randomRecord";
import ThaiDateInput from "./ThaiDateInput";
import FleetRoster from "./panels/FleetRoster";
import FuelBillTable from "./panels/FuelBillTable";
import FuelSummary from "./panels/FuelSummary";
import OtherCostTable from "./panels/OtherCostTable";
import PendingSlips from "./panels/PendingSlips";
import type { RecordsState } from "../../lib/store/useRecords";
import type { Bill, PayType, RoleKey, TripRecord } from "../../types/record";
import { PAY_TYPES, PRICE_BASIS } from "../../types/record";
import type { FleetType } from "../../lib/cost/types";

const baht = (n: number) =>
  n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const baht0 = (n: number) => n.toLocaleString("th-TH", { maximumFractionDigits: 0 });

/** ค่าแก๊สเป็นหัวข้อของตัวเอง แยกจากกลุ่มน้ำมัน (น้ำมัน = 1) แก๊ส = 2)) */
const GAS_FIELDS: [keyof TripRecord, string][] = [["gas", "2) ค่าแก๊ส"]];
const LABOR_FIELDS: [keyof TripRecord, string][] = [
  ["drv", "พนักงานขับ"],
  ["spare", "พนักงานสำรอง"],
  ["snd", "SND"],
];
const FEE_FIELDS: [keyof TripRecord, string][] = [
  ["feeTarp", "ค่าเปิดปิดผ้าใบ"],
  ["feePolice", "ค่าด่านตำรวจ"],
  ["feeCont", "ค่าธรรมเนียมคืนตู้"],
  ["feePort", "ค่าเข้าท่าเรือ"],
  ["feeDoc", "ค่าส่งเอกสาร"],
  ["feeToll", "ค่าทางด่วน"],
];
/** สูญเปล่าฝั่งน้ำมันย้ายเข้าไปเป็น "ประเภท" ในตารางบิลแล้ว เหลือแค่ค่าแรงที่ยังเป็นช่องเดี่ยว */
const WASTE_LABOR_FIELDS: [keyof TripRecord, string][] = [
  ["laborOff", "ค่าแรงวิ่งรถนอกเส้นทาง"],
];

/**
 * ตัดบิลแถวที่ว่างเปล่าทิ้งก่อนบันทึก และเติมเลขที่บิลจากเลขที่ใบรายการให้แถวที่เว้นว่าง
 * ยกจาก readBills() ของ main:2817 — ฟอร์มเปิดมาพร้อมแถวว่างเสมอ จึงต้องกรองตรงนี้
 * ไม่งั้นทุกใบจะได้บิลผีติดไปด้วยหนึ่งใบ
 */
function readyBills(rec: TripRecord): TripRecord {
  const filled = rec.bills.filter((b) =>
    b.no || b.sender || b.receiver || b.qty || b.unitPrice || b.total
    || b.payType || b.goodsType || b.origin || b.dest);
  const bills = filled.map((b) => ({ ...b, no: b.no || rec.docNo }));
  // main คงพฤติกรรมไว้ว่า ถ้าไม่มีบิลเลยแต่มีเลขที่ใบ ให้สร้างบิลเปล่าหนึ่งใบไว้ผูกกับใบรายการ
  if (!bills.length && rec.docNo) bills.push({ ...emptyBill(), no: rec.docNo });
  // รายได้ผูกกับบิลชุดที่กรองแล้วเสมอ — ต้องคิดหลังตัดแถวว่างทิ้ง ไม่ใช่จาก rec.bills ดิบ
  const out = { ...rec, bills, otherCosts: readyOtherCosts(rec.otherCosts) };
  return { ...out, revenue: billsRevenue(out) };
}

/**
 * ราคารวมของบิล = จำนวน/น้ำหนัก × ราคาต่อหน่วย
 * ใบเก่าที่กรอกราคารวมเองไว้ (ยังไม่มีราคาต่อหน่วย) ให้คงยอดเดิม ไม่ให้หายไป
 */
function billTotal(b: Bill): number {
  if (b.unitPrice == null) return Number(b.total) || 0;
  return Math.round((Number(b.qty) || 0) * (Number(b.unitPrice) || 0) * 100) / 100;
}

/**
 * รายได้ของใบ = ผลรวมราคารวมของทุกบิล — ไม่ให้กรอกเอง กรอกแค่รายการลูกหนี้ / บิล
 * ใบเก่าที่กรอกรายได้เองไว้ตอนยังไม่มีบิล (หรือบิลไม่มียอดสักใบ) ให้คงยอดเดิม ไม่ให้หายไป
 * เหตุผลเดียวกับ billTotal() ที่คงยอดของบิลรุ่นที่ยังไม่มีราคาต่อหน่วย
 */
function billsRevenue(rec: TripRecord): number {
  const sum = rec.bills.reduce((s, b) => s + billTotal(b), 0);
  if (!sum) return Number(rec.revenue) || 0;
  return Math.round(sum * 100) / 100;
}

export default function EntryForm({ role, state }: { role: RoleKey; state: RecordsState }) {
  const [rec, setRec] = useState<TripRecord>(emptyRecord);
  const [msg, setMsg] = useState<{ text: string; tone: "ok" | "err" | "info" } | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  /** โซนของฝ่ายอื่นที่เปิดแก้ไว้ — เปิดใบใหม่ = เริ่มจากดูอย่างเดียวเสมอ */
  const [editZones, setEditZones] = useState<Set<RoleKey>>(new Set());
  const [ovr] = useOverrides();
  const [roster] = useRoster();
  const newCodes = useNewCodes();
  /** รู้จำนวนระเบียนในไฟล์แล้วหรือยัง — พอสำหรับพรีวิวรหัสลูกค้าใหม่ เหมือน CUST_READY ของ main */
  const [custReady, setCustReady] = useState(() => !!peekCustCount());
  /** ตารางเต็มโหลดแล้วหรือยัง — ต้องใช้เฉพาะตอนมีรหัสต้นฉบับในช่องผู้ส่ง/ผู้รับ */
  const [tableReady, setTableReady] = useState(() => !!peekCustMap());

  // ★ หน้านี้ไม่โหลดตารางเต็ม 18 MB อีกแล้ว — ขอแค่จำนวนระเบียนผ่าน HEAD
  //   เพราะสิ่งเดียวที่ต้องใช้จริงคือ "ไฟล์มีถึงเลขไหน" เพื่อออกรหัสลูกค้าใหม่ต่อท้าย
  //   ฝ่ายบริการลูกค้ากับฝ่ายจัดรถเปิดหน้านี้เป็นหน้าแรก จะให้รอโหลด 18 MB ก่อนกรอกไม่ไหว
  useEffect(() => {
    let alive = true;
    ensureCustCount().then(() => { if (alive) setCustReady(true); }).catch(() => { /* ไม่มีไฟล์ตาราง */ });
    return () => { alive = false; };
  }, []);

  /** ช่องผู้ส่ง/ผู้รับที่เป็นรหัสต้นฉบับ (hex 64 ตัว) — มีเมื่อไหร่ถึงค่อยโหลดตารางเต็ม */
  const hasHash = rec.bills.some((b) => isFullHash(String(b.sender ?? "")) || isFullHash(String(b.receiver ?? "")));

  // ชื่อบริษัทที่พิมพ์เองไม่มีทางตรงกับไฟล์อยู่แล้ว (codeFor รับเฉพาะ hex 64 ตัวเป๊ะ)
  // จึงโหลดตารางเฉพาะตอนที่มีรหัสต้นฉบับจริง ๆ ในใบ — ไม่งั้นเสียเน็ต 18 MB ฟรี
  useEffect(() => {
    if (!hasHash || tableReady) return;
    let alive = true;
    ensureCustMap().then(() => { if (alive) setTableReady(true); }).catch(() => { /* ไม่มีไฟล์ตาราง */ });
    return () => { alive = false; };
  }, [hasHash, tableReady]);

  useEffect(() => {
    // ทำซ้ำใบ — หน้ารายการส่งใบที่คัดลอกแล้วมาทั้งก้อน ไม่ได้ส่งแค่ id
    // เพราะใบที่อยู่บนชีตอย่างเดียว (ยังไม่เคยเปิดในเครื่องนี้) getById หาไม่เจอ
    const dup = sessionStorage.getItem("duplicateRecord");
    if (dup) {
      sessionStorage.removeItem("duplicateRecord");
      try {
        const r = JSON.parse(dup) as TripRecord;
        setRec(ensureFuelBills(r));
        setEditing(null); // เป็นใบใหม่ ไม่ใช่การแก้ใบเดิม
        setEditZones(new Set());
        setMsg({ text: "ทำซ้ำใบรายการแล้ว — ใส่เลขที่ใบใหม่และตรวจวันที่ก่อนบันทึก", tone: "info" });
        return;
      } catch { /* ข้อมูลเสีย — เริ่มใบเปล่าตามปกติ */ }
    }

    const id = sessionStorage.getItem("editRecordId");
    if (!id) return;
    sessionStorage.removeItem("editRecordId");
    getById(id).then((r) => {
      if (!r) return;
      setRec(ensureFuelBills(r));
      setEditing(id);
      setEditZones(new Set());
      setMsg({ text: `กำลังแก้ไขใบ ${r.docNo || "–"}`, tone: "info" });
    }).catch(() => { /* เปิดไม่ได้ก็เริ่มใบใหม่ตามปกติ */ });
  }, []);

  const set = <K extends keyof TripRecord>(k: K, v: TripRecord[K]) =>
    setRec((r) => ({ ...r, [k]: v }));

  const num = (k: keyof TripRecord) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setRec((r) => ({ ...r, [k]: parseFloat(e.target.value) || 0 }));

  /** รายได้คิดจากบิลอย่างเดียว — ช่องในการ์ดสรุปเป็นแค่ตัวแสดงผล */
  const revenue = billsRevenue(rec);

  /**
   * ★ ต้องสรุปยอดจากตารางบิลก่อนคำนวณ ให้ใช้เส้นทางเดียวกับ recomputeTotals() ตอนบันทึก
   *   ไม่งั้นตัวเลขบนจอกับตัวเลขที่ถูกบันทึกจะไม่ตรงกัน
   */
  const recCalc = useMemo(() => {
    const f = rec.fuelBills ? applyFuelBills(rec) : rec;
    return applyOtherCosts(f);
  }, [rec]);

  const calc = useMemo(
    () => computeCost(
      {
        date: recCalc.date, vehicle: recCalc.vehicle, fleetType: recCalc.fleetType,
        distance: recCalc.dist, revenue,
        gas: recCalc.gas, fuelCash: recCalc.fuelCash, fuelDownBill: recCalc.fuelDownBill,
        fuelFleet: recCalc.fuelFleet, fuelPickup: recCalc.fuelPickup, fuelUpBill: recCalc.fuelUpBill,
        fuelCallTruck: recCalc.fuelCallTruck, fuelAutoOn: recCalc.fuelAutoOn,
        fuelOff: recCalc.fuelOff, fuelDetour: recCalc.fuelDetour, fuelOffFleet: recCalc.fuelOffFleet,
        drv: recCalc.drv, spare: recCalc.spare, snd: recCalc.snd, laborOff: recCalc.laborOff,
        feeTarp: recCalc.feeTarp, feePolice: recCalc.feePolice, feeCont: recCalc.feeCont,
        feePort: recCalc.feePort, feeDoc: recCalc.feeDoc, feeToll: recCalc.feeToll,
        otherNormal: recCalc.otherNormal,
      },
      REF, ovr,
    ),
    [recCalc, revenue, ovr],
  );

  const pay = recPayInfo(rec);

  /**
   * รหัสย่อที่ผู้ส่ง/ผู้รับแต่ละรายจะได้ — updateBillCustNotes() ของ main:2783
   * คิดรวมทั้งใบเพราะลูกค้าใหม่หลายรายในใบเดียวกันต้องได้เลขไล่กัน ไม่ใช่เลขเดียวกันหมด
   * ★ ตรงนี้เป็นแค่การพรีวิว ยังไม่จองเลข — รหัสจริงออกตอนกดบันทึกเท่านั้น
   */
  const custPreview = useMemo(() => {
    const out = new Map<string, { code: string; kind: "file" | "own" | "pending" }>();
    if (!custReady) return out;
    let next = nextNumber(newCodes);
    for (const b of rec.bills) {
      for (const raw of [b.sender, b.receiver]) {
        const s = String(raw ?? "").trim();
        if (!s || out.has(s)) continue;
        const own = newCodes[s];
        if (own) { out.set(s, { code: custCode(own), kind: "own" }); continue; }
        // รหัสต้นฉบับที่ยังรอตารางเต็มอยู่ ต้องไม่ถูกพรีวิวว่าเป็นลูกค้าใหม่
        // ไม่งั้นตัวเลขจะกระพริบเปลี่ยนตอนตารางโหลดเสร็จ
        if (isFullHash(s) && !tableReady) continue;
        const fromFile = peekCustMap()?.codeFor(s) ?? null;
        if (fromFile) { out.set(s, { code: fromFile, kind: "file" }); continue; }
        out.set(s, { code: custCode(next++), kind: "pending" });
      }
    }
    return out;
  }, [rec.bills, newCodes, custReady, tableReady]);

  /** ช่องหนึ่งของโน้ตใต้แถวบิล */
  const CustCell = ({ label, raw }: { label: string; raw: string }) => {
    const s = String(raw ?? "").trim();
    if (!s) return <span className="cx"><b>{label}:</b> <span className="wait">— ยังไม่ได้กรอก —</span></span>;
    if (!custReady || (isFullHash(s) && !tableReady)) {
      return <span className="cx"><b>{label}:</b> <span className="wait">กำลังเตรียมฐานข้อมูลรหัส…</span></span>;
    }
    const hit = custPreview.get(s);
    if (!hit) return <span className="cx"><b>{label}:</b> <span className="wait">—</span></span>;
    const isNew = hit.kind !== "file";
    return (
      <span className="cx"><b>{label}:</b> <span className="arrow">→</span>{" "}
        <span className={"cuscode" + (isNew ? " isnew" : "")} title={s}>{hit.code}</span>{" "}
        <span className={isNew ? "tagnew" : "tagold"}>
          {hit.kind === "file" ? "มีอยู่ในไฟล์แปลงรหัส"
            : hit.kind === "own" ? "ลูกค้าใหม่ (ออกรหัสแล้ว)"
              : "ลูกค้าใหม่ · จะได้รหัสนี้เมื่อกดบันทึก"}
        </span>
      </span>
    );
  };

  /** โซนที่ปุ่มสุ่มเติมให้ — ชุดเดียวกับที่ saveRecord() จะเขียนและประทับตอนบันทึก */
  const randomZones: RoleKey[] = role === "admin" ? ROLE_ORDER : ROLE_ORDER.filter((k) => k === role || editZones.has(k));

  /** โซนนี้เปิดให้กรอกไหม — ผู้ดูแลระบบเปิดทุกโซน */
  const zoneOpen = (k: RoleKey) => role === "admin" || k === role || editZones.has(k);
  /** โซนนี้แสดงไหม — main ซ่อนโซนที่กรอกไม่ได้ทิ้งไปเลย */
  const zoneShow = (k: RoleKey) => zoneOpen(k);

  const toggleZone = (k: RoleKey) => {
    if (!canEditOthers(role) || k === role) return;
    setEditZones((s) => {
      const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n;
    });
  };

  const setBill = (i: number, patch: Partial<Bill>) =>
    setRec((r) => ({
      ...r,
      bills: r.bills.map((b, j) => {
        if (j !== i) return b;
        const next = { ...b, ...patch };
        // ราคารวมคำนวณให้เสมอเมื่อมีราคาต่อหน่วย — ตรงกับ recalcTotal() ของ main
        return { ...next, total: billTotal(next) };
      }),
    }));

  const openDoc = (r: TripRecord) => {
    setRec(ensureFuelBills(r));
    setEditing(r.id);
    setEditZones(new Set());
    setMsg(null);
  };

  /**
   * ทะเบียนที่เลือกได้ = คันที่เคยวิ่งเป็นคู่ (ประเภทรถ, ชนิดรถ) ที่เลือกไว้
   * ยังไม่เลือกอะไร = ทั้งกองรถ · ยังพิมพ์ทะเบียนนอกรายการได้เสมอ (รถใหม่ที่ยังไม่อยู่ในไฟล์)
   */
  const platesForForm = useMemo(
    () => roster.filter((f) => matchesKind(f, rec.fleetType, rec.vehicle))
      .sort((a, b) => a.plate.localeCompare(b.plate, "th")),
    [roster, rec.fleetType, rec.vehicle],
  );
  const plateHint = !rec.fleetType && !rec.vehicle ? "· ทั้งกองรถ"
    : platesForForm.length ? `· ${platesForForm.length} คันที่ตรงกับที่เลือก`
      : "· ไม่มีคันไหนเคยวิ่งเป็นชนิดนี้ พิมพ์ทะเบียนเองได้";
  /** ชนิดที่เพิ่มจากไฟล์ทะเบียนในกองรถ ยืมอัตราน้ำมัน/ความจุมาจากชนิดอื่น — บอกไว้ให้รู้ */
  const approxNote = (() => {
    const v = REF.vehicles.find((x) => x.name === rec.vehicle);
    return v?.approxFrom ? `· ใช้อัตราน้ำมัน/ความจุของ ${v.approxFrom} ไปก่อน` : undefined;
  })();

  const loadFactor = rec.capacity > 0 && !rec.emptyLeg
    ? Math.min(100, rec.loadActual / rec.capacity * 100) : null;

  async function onSave() {
    /**
     * ★ ไม่มีเลขที่ใบรายการ = บันทึกไม่ได้ ทุกตำแหน่ง
     *
     * เลขที่ใบเป็นช่องของฝ่ายบริการลูกค้า ซึ่งเป็นฝ่ายที่ "เปิดใบ" — ถ้าฝ่ายจัดรถหรือบัญชี
     * เปิดฟอร์มเปล่าแล้วกดบันทึกได้ จะเกิดใบผีที่ไม่มีเลขที่ ไปโผล่ในคิวของฝ่ายอื่นตลอดไป
     * และผูกกลับเข้าใบจริงไม่ได้ (saveRecord จับคู่ด้วย id แล้ว docNo)
     */
    if (!rec.docNo.trim()) {
      setMsg({
        text: role === "cs" || role === "admin"
          ? "ยังไม่ได้กรอกเลขที่ใบรายการ — กรอกก่อนจึงจะบันทึกได้"
          : "ใบนี้ยังไม่มีเลขที่ใบรายการ — ต้องให้ฝ่ายบริการลูกค้าเปิดใบก่อน แล้วค่อยเปิดใบนั้นมากรอกต่อ",
        tone: "err",
      });
      return;
    }
    setBusy(true);
    setMsg({ text: "กำลังบันทึก...", tone: "info" });
    try {
      const offline = !getUrl();
      const ready = readyBills(rec);

      // ออกรหัสให้ลูกค้าที่ไม่มีในไฟล์แปลงรหัส — v5:2549 ทำเฉพาะตอนโซนของฝ่ายบริการลูกค้าเปิด
      // เพราะช่องผู้ส่ง/ผู้รับเป็นของฝ่ายนั้น ฝ่ายอื่นกดบันทึกไม่ควรไปกินเลขรหัส
      if (role === "cs" || role === "admin" || editZones.has("cs")) {
        try {
          // รู้จำนวนระเบียนก่อนเสมอ ไม่งั้นเลขที่ออกจะทับของในไฟล์
          await ensureCustCount();
          // ตารางเต็มต้องใช้เฉพาะตอนมีรหัสต้นฉบับในใบ — เพื่อไม่ให้ออกรหัสซ้อนรายที่มีอยู่แล้ว
          const needTable = ready.bills.some(
            (b) => isFullHash(String(b.sender ?? "")) || isFullHash(String(b.receiver ?? "")),
          );
          if (needTable) await ensureCustMap();
          registerBills(ready.bills);
        } catch { /* ไม่มีไฟล์ตาราง — ข้ามการออกรหัส ไม่งั้นจะออกเลขทับของไฟล์ */ }
      }

      const res = await saveRecord(ready, {
        role, offline, overrides: ovr,
        alsoRoles: role === "admin" ? ROLE_ORDER : [...editZones],
      });
      setRec(res.record);
      setEditing(null);
      // ให้รายการ/ชิปใบที่รอกรอกเห็นใบนี้ทันที (เดิมต้องกดรีเฟรชเอง)
      state.refresh();
      setMsg({
        text: offline
          ? "บันทึกลงเครื่องแล้ว (ยังไม่ได้ตั้งค่า Google Sheet จึงยังไม่ส่งขึ้นชีต)"
          : `บันทึกและส่งขึ้นชีตแล้ว${res.mergedFromSheet ? " · รวมกับข้อมูลฝ่ายอื่นที่มีอยู่แล้ว" : ""}`,
        tone: "ok",
      });
    } catch (e) {
      setMsg({
        text: e instanceof SaveAbortedError
          ? (e as Error).message
          : "บันทึกไม่สำเร็จ: " + (e as Error).message,
        tone: "err",
      });
    } finally { setBusy(false); }
  }

  const tone = { ok: "var(--green)", err: "var(--red)", info: "var(--ink-soft)" };
  const profitLoss = calc.profit < 0;

  /** สรุปบริบทของใบ — ช่องของฝ่ายอื่นถูกซ่อน จึงต้องบอกไว้ตรงนี้แทน */
  const ctx = [
    rec.date ? thDateSafe(rec.date) : "",
    rec.origin && rec.dest ? `${rec.origin}→${rec.dest}` : "",
    rec.plate, rec.vehicle,
  ].filter(Boolean).join(" · ");

  if (!isEntryRole(role) && role !== "admin") {
    return (
      <div className="card">
        <h2>ตำแหน่งนี้ไม่ได้กรอกใบรายการ</h2>
        <p className="muted">
          {ROLES[role].label} เป็นตำแหน่งดูอย่างเดียว — ดูสรุปได้ที่หน้าแดชบอร์ดและรายการทั้งหมด
        </p>
      </div>
    );
  }

  return (
    <>
      {editing && (
        <div className="edit-banner" style={{ display: "flex" }}>
          กำลังแก้ไขใบ <b>{rec.docNo || "–"}</b> — กดบันทึกเพื่อทับใบเดิม
          <button type="button" className="x"
            onClick={() => { setRec(emptyRecord()); setEditing(null); setEditZones(new Set()); setMsg(null); }}>
            ยกเลิกการแก้ไข
          </button>
        </div>
      )}

      {/* แผง "ใบที่ยังรอ…กรอก" — รายละเอียดอยู่ใน panels/PendingSlips.tsx
          ★ ฝ่ายบริการลูกค้าไม่เห็นแผงนี้ เพราะเป็นฝ่ายที่ "เปิดใบ" เอง ไม่มีคิวรอจากใคร
          (ตรงกับ main เดิม) · ฝ่ายจัดรถ/บัญชี/ผู้ดูแลระบบเห็น */}
      {role !== "cs" && <PendingSlips role={role} state={state} onOpen={openDoc} />}

      {/* แถบความคืบหน้า — main โชว์เฉพาะตอนเปิดใบที่บันทึกไว้แล้ว ใบใหม่จะว่างเปล่า
          ฝ่ายบัญชีกดชิปของฝ่ายอื่นเพื่อเปิด/ปิดการแก้ไขส่วนนั้นได้ */}
      {editing && (
      <div className="prog">
        <span className="pchip done" style={{ background: "var(--accent-tint)", color: "var(--accent)" }}>
          📄 ใบ {rec.docNo || "–"}
        </span>
        {ctx && (
          <span className="pchip" style={{ background: "#F2EFEA", color: "var(--ink-soft)" }}>{ctx}</span>
        )}
        {ROLE_ORDER.map((k) => {
          const done = roleDone(rec, k);
          const isMine = k === role;
          const open = editZones.has(k);
          const txt = `${ROLES[k].icon} ${ROLES[k].label} ${done ? "✓ กรอกแล้ว" : "— ยังไม่กรอก"}`;
          if (canEditOthers(role) && !isMine && role !== "admin") {
            return (
              <button key={k} type="button"
                className={"pchip " + (open ? "editing" : done ? "done" : "wait")}
                onClick={() => toggleZone(k)}>
                {txt} <span className="pen">{open ? "✕ ปิดการแก้ไข" : "✎ แก้ไข"}</span>
              </button>
            );
          }
          return (
            <span key={k} className={"pchip " + (done ? "done" : "wait") + (isMine ? " mine" : "")}>
              {txt}
            </span>
          );
        })}
      </div>
      )}

      {/* ═════ การ์ด 1 — ข้อมูลการเดินทาง ═════ */}
      {(zoneShow("cs") || zoneShow("dispatch")) && (
        <div className="card">
          <div className="card-h"><span className="step">1</span><h2>ข้อมูลการเดินทาง</h2></div>

          {zoneShow("cs") && (
            <div>
              <div className="grid3">
                <div className="field"><label>วันที่ <span className="hint">· วัน / เดือน / ปี (พ.ศ.)</span></label>
                  <ThaiDateInput value={rec.date} onChange={(v) => set("date", v)} disabled={!zoneOpen("cs")} /></div>
                <F label="เลขที่ใบรายการ">
                  <input value={rec.docNo} disabled={!zoneOpen("cs")} placeholder="เช่น INV-2569-001"
                    onChange={(e) => set("docNo", e.target.value)} /></F>
                <F label="ประเภทเส้นทาง">
                  <Seg value={rec.routeType} options={["ขาขึ้น", "ขาล่อง"]}
                    disabled={!zoneOpen("cs")} onChange={(v) => set("routeType", v)} /></F>
              </div>
              <div className="grid3">
                <F label="สาขา">
                  <Sel value={rec.branch} disabled={!zoneOpen("cs")} options={BRANCHES} onChange={(v) => set("branch", v)} /></F>
                <F label="ประเภทใบรายการ">
                  <Sel value={rec.docType} disabled={!zoneOpen("cs")} options={DOC_TYPES} onChange={(v) => set("docType", v)} /></F>
                <F label="ระยะทาง" hint="· เติมอัตโนมัติ/แก้เองได้">
                  <div className="input-suffix">
                    <input type="number" min={0} placeholder="0" disabled={!zoneOpen("cs")}
                      value={rec.dist || ""} onChange={num("dist")} />
                    <span className="unit">กม.</span>
                  </div></F>
              </div>
              <div className="grid3">
                <F label="เส้นทาง · ต้นทาง">
                  <Sel value={rec.origin} disabled={!zoneOpen("cs")} options={ORIGINS}
                    onChange={(v) => setRec((r) => ({ ...r, origin: v, dest: "", dist: 0 }))} /></F>
                <F label="ปลายทาง">
                  <Sel value={rec.dest} disabled={!zoneOpen("cs")} options={destsFor(rec.origin)}
                    onChange={(v) => setRec((r) => ({ ...r, dest: v, dist: distanceFor(r.origin, v) ?? r.dist }))} /></F>
                <F label="กลุ่มบริการ / ประเภทงานขนส่ง">
                  <Sel value={rec.serviceGroup} disabled={!zoneOpen("cs")} options={SERVICE_GROUPS}
                    onChange={(v) => set("serviceGroup", v)} /></F>
              </div>
              <div className="route-line">
                <span className="pin from" />
                <span style={{ flex: 1 }}>
                  {rec.origin && rec.dest
                    ? `${rec.origin} → ${rec.dest}${rec.dist ? ` · ${baht0(rec.dist)} กม.` : ""}`
                    : "–"}
                </span>
                <span className="pin to" />
              </div>
            </div>
          )}

          {zoneShow("dispatch") && (
            <div>
              {/* ลำดับ ประเภทรถ → ชนิดรถ → ทะเบียนรถ: สองช่องแรกเป็นตัวกรองให้ช่องทะเบียน
                  เหลือเฉพาะคันที่เคยวิ่งเป็นคู่นั้น (จาก kinds ใน refdata/fleet.json) */}
              <div className="grid3">
                <F label="ประเภทรถ">
                  <Seg value={rec.fleetType} options={["รถบริษัท", "รถร่วม"]}
                    disabled={!zoneOpen("dispatch")} onChange={(v) => set("fleetType", v as FleetType)} /></F>
                <F label="ชนิดรถ" hint={approxNote}>
                  <Sel value={rec.vehicle} disabled={!zoneOpen("dispatch")} options={vehicleOptions(rec.vehicle)}
                    onChange={(v) => setRec((r) => ({
                      ...r, vehicle: v,
                      capacity: REF.vehicles.find((x) => x.name === v)?.capacityKg ?? r.capacity,
                    }))} /></F>
                <F label="เลขทะเบียนรถ" hint={plateHint}>
                  <input list="plateList" disabled={!zoneOpen("dispatch")}
                    placeholder={platesForForm.length ? `เลือกจาก ${platesForForm.length} คัน หรือพิมพ์เอง` : "เช่น ชม.70-0820"}
                    value={rec.plate} onChange={(e) => set("plate", e.target.value)} />
                  <datalist id="plateList">
                    {platesForForm.map((f) => <option key={f.plate} value={f.plate}>{f.vehicle}</option>)}
                  </datalist>
                </F>
              </div>
              <div className="grid3">
                <div className="field"><label>วันที่ปล่อยรถ <span className="hint">· วัน / เดือน / ปี (พ.ศ.)</span></label>
                  <ThaiDateInput value={rec.releaseDate} onChange={(v) => set("releaseDate", v)} disabled={!zoneOpen("dispatch")} /></div>
              </div>

              <h3 className="grp"><span className="dot" />การใช้ประโยชน์กองรถ &amp; อัตราการบรรทุก</h3>
              <div className="grid2">
                <F label="ความจุรถสูงสุด" hint="· เติมอัตโนมัติ/แก้เองได้">
                  <div className="input-suffix">
                    <input type="number" min={0} placeholder="0" disabled={!zoneOpen("dispatch")}
                      value={rec.capacity || ""} onChange={num("capacity")} />
                    <span className="unit">กก.</span>
                  </div></F>
                <F label="น้ำหนัก/ปริมาณบรรทุกจริง">
                  <div className="input-suffix">
                    <input type="number" min={0} placeholder="0" disabled={!zoneOpen("dispatch")}
                      value={rec.loadActual || ""} onChange={num("loadActual")} />
                    <span className="unit">กก.</span>
                  </div></F>
              </div>
              <div className="loadbar">
                <div className="track"><i style={{ width: `${loadFactor ?? 0}%` }} /></div>
                <span className="pct">{loadFactor != null ? `${loadFactor.toFixed(0)}%` : "–"}</span>
              </div>
              <label className="chk">
                <input type="checkbox" checked={rec.emptyLeg} disabled={!zoneOpen("dispatch")}
                  onChange={(e) => set("emptyLeg", e.target.checked)} />
                <span>เที่ยวนี้เป็นเที่ยวเปล่า (Empty Leg) — วิ่งโดยไม่มีสินค้า/ไม่ได้บรรทุก</span>
              </label>
              <div className="price-note">
                {rec.emptyLeg
                  ? "เที่ยวเปล่า — ต้นทุนทั้งเที่ยวจะถูกนับเป็นมูลค่าที่สูญเสียในแดชบอร์ด"
                  : loadFactor != null
                    ? <>Load Factor = <b>{loadFactor.toFixed(1)}%</b> ({baht0(rec.loadActual)} ÷ {baht0(rec.capacity)} กก.)</>
                    : "เลือกชนิดรถ + กรอกน้ำหนักบรรทุกจริง เพื่อคำนวณ Load Factor (% การใช้ประโยชน์ความจุ)"}
              </div>
            </div>
          )}
        </div>
      )}

      {/* main วางแผงทะเบียนรถไว้ในโซนฝ่ายจัดรถของฟอร์ม (index.html:903) ไม่ใช่หน้าการตั้งค่า */}
      {zoneShow("dispatch") && <FleetRoster />}

      {/* ═════ การ์ด 2 — ค่าใช้จ่าย ═════ */}
      {zoneShow("account") && (
        <div className="card">
          <div className="card-h">
            <span className="step">2</span><h2>ค่าใช้จ่าย</h2>
            <span className="hint">ทุกช่องเลือกกรอกหรือเว้นว่างได้ (ว่าง = 0)</span>
          </div>

          <h3 className="grp"><span className="dot" />1) ค่าน้ำมัน — บันทึกตามบิล{" "}
            <span style={{ fontWeight: 400, color: "var(--ink-faint)" }}>
              (ต้นทุนปกติและสูญเปล่าแยกด้วยช่อง "ประเภท" ในแต่ละแถว)
            </span>
          </h3>
          {/* ★ ช่องยอดรวม 6+3 ช่องเดิมถูกแทนด้วยตารางนี้ตั้งแต่ _v5 — ยอดถูกสรุปกลับลงช่องเดิม
              ให้อัตโนมัติด้วย applyFuelBills() สูตร/คอลัมน์ชีต 9-28/แดชบอร์ด จึงไม่ต้องรู้เรื่องบิลเลย
              checkbox "ไม่ต้องคำนวณค่าน้ำมันอัตโนมัติ" ถูกตัดออก เพราะใบที่มีบิลต้องปิดออโต้เสมอ
              ไม่งั้นค่าน้ำมันทั้งเที่ยวจะถูกบวกทับยอดบิลอีกชั้น · ยอดอัตโนมัติย้ายไปเป็น
              "เทียบต้นทุนมาตรฐาน" ในส่วนสรุปด้านล่างแทน ตรงตามดีไซน์ */}
          <FuelBillTable
            rec={rec} role={role} disabled={!zoneOpen("account")}
            refPrice={calc.auto.price} autoRate={calc.auto.rate}
            onChange={(bills) => set("fuelBills", bills)} />

          <FuelSummary
            bills={rec.fuelBills ?? []} dist={rec.dist || 0}
            rate={calc.auto.rate} price={calc.auto.price} />

          <Money fields={GAS_FIELDS} rec={rec} num={num} disabled={!zoneOpen("account")} />

          <h3 className="grp"><span className="dot" />3) ค่าแรงพนักงาน — ต้นทุนปกติ</h3>
          <Money fields={LABOR_FIELDS} rec={rec} num={num} disabled={!zoneOpen("account")} />

          <div className="wastebox">
            <h3 className="grp waste"><span className="dot" />ค่าแรง — ต้นทุนสูญเปล่า</h3>
            <Money fields={WASTE_LABOR_FIELDS} rec={rec} num={num} disabled={!zoneOpen("account")} />
          </div>

          <h3 className="grp"><span className="dot" />4) ค่าธรรมเนียม{" "}
            <span style={{ fontWeight: 400, color: "var(--ink-faint)" }}>(นับเป็นต้นทุนปกติ)</span>
          </h3>
          <Money fields={FEE_FIELDS} rec={rec} num={num} disabled={!zoneOpen("account")} />

          <h3 className="grp"><span className="dot" />5) ค่าซ่อมแซม{" "}
            <span style={{ fontWeight: 400, color: "var(--ink-faint)" }}>
              (นับเป็นต้นทุนปกติ · อิงประเภทรถ + ชนิดรถ + ระยะทาง ไม่ต้องกรอก)
            </span>
          </h3>
          <div className="price-note" style={{ marginTop: 0 }}>
            ตามเวลา <b>{baht(calc.repair.fixed)}</b>{!calc.repair.hasFix && " (ไม่มีในตาราง)"}
            {" + "}ตามระยะทาง <b>{baht(calc.repair.varCost)}</b>{!calc.repair.hasVar && " (ไม่มีในตาราง)"}
            {" = "}<b>{baht(calc.repair.total)}</b> บาท
          </div>

          <h3 className="grp"><span className="dot" />6) ค่าใช้จ่ายอื่นๆ{" "}
            <span style={{ fontWeight: 400, color: "var(--ink-faint)" }}>
              (พิมพ์ชื่อรายการเอง · เลือกทางตรง/ทางอ้อม · นับเป็นต้นทุนปกติ)
            </span>
          </h3>
          <OtherCostTable items={rec.otherCosts ?? []} disabled={!zoneOpen("account")}
            onChange={(items) => set("otherCosts", items)} />
        </div>
      )}

      {/* ═════ การ์ด 3 — สรุปผล ═════ */}
      <div className="card">
        <div className="card-h"><span className="step">3</span><h2>สรุปผล</h2></div>

        {/* main วางช่องรายได้ไว้ในการ์ดสรุป ไม่ใช่การ์ดข้อมูลการเดินทาง
            ★ คิดจากผลรวมราคารวมของรายการลูกหนี้ / บิล ไม่ให้กรอกเอง — แบบเดียวกับช่องราคารวมของบิล */}
        {zoneShow("cs") && (
          <div className="grid3">
            <F label="รายได้" hint="(อัตโนมัติ · รวมจากรายการลูกหนี้ / บิล)">
              <div className="input-suffix">
                <input className="b-total-auto" type="number" placeholder="0" readOnly tabIndex={-1}
                  value={revenue || ""} />
                <span className="unit">บาท</span>
              </div></F>
          </div>
        )}

        <div className="kpis">
          <div className="kpi rev"><div className="lab">รายได้</div>
            <div className="big">{baht(revenue)}<small>บาท</small></div></div>
          <div className="kpi normal"><div className="lab">ต้นทุนเดินทางรวม (ปกติ)</div>
            <div className="big">{baht(calc.normal)}<small>บาท</small></div></div>
          <div className="kpi waste"><div className="lab">ต้นทุนสูญเปล่า</div>
            <div className="big">{baht(calc.waste)}<small>บาท</small></div></div>
          <div className={"kpi profit" + (profitLoss ? " loss" : "")}>
            <div className="lab">กำไร / ขาดทุน</div>
            <div className="big">{baht(calc.profit)}<small>บาท</small></div></div>
        </div>

        <div className="result">
          <div className="result-row"><span className="k">ค่าแก๊ส</span><span className="v">{baht(rec.gas)}</span></div>
          <div className="result-row"><span className="k">ค่าน้ำมันรวม (ค่าน้ำมันเหมา)</span><span className="v">{baht(calc.fuelSum)}</span></div>
          <div className="result-row"><span className="k">ค่าแรง (ขับ+สำรอง+SND)</span><span className="v">{baht(calc.labor)}</span></div>
          <div className="result-row"><span className="k">ค่าธรรมเนียมรวม</span><span className="v">{baht(calc.fees)}</span></div>
          <div className="result-row"><span className="k">ค่าซ่อมตามระยะเวลา (คงที่)</span><span className="v">{baht(calc.repair.fixed)}</span></div>
          <div className="result-row"><span className="k">ค่าซ่อมตามระยะทาง (ตาม กม.)</span><span className="v">{baht(calc.repair.varCost)}</span></div>
          {(rec.otherCosts?.length ?? 0) > 0 && (() => {
            const t = otherCostTotals(rec.otherCosts);
            return (
              <div className="result-row"><span className="k">ค่าใช้จ่ายอื่นๆ (ตรง {baht(t.direct)} · อ้อม {baht(t.indirect)})</span>
                <span className="v">{baht(t.total)}</span></div>
            );
          })()}
          <div className="result-row">
            <span className="k" style={{ color: "#4A453F" }}>สูญเปล่า: น้ำมัน (นอกเส้นทาง + วิ่งอ้อม + Fleet Card)</span>
            <span className="v">{baht((rec.fuelOff || 0) + (rec.fuelDetour || 0) + (rec.fuelOffFleet || 0))}</span>
          </div>
          <div className="result-row">
            <span className="k" style={{ color: "#4A453F" }}>สูญเปล่า: เบี้ยเลี้ยงนอกเส้นทาง</span>
            <span className="v">{baht(rec.laborOff)}</span>
          </div>
          <div className="result-row">
            <span className="k" style={{ fontWeight: 700 }}>รวมค่าใช้จ่าย{" "}
              <span style={{ fontWeight: 400, color: "var(--ink-faint)" }}>(ตามสูตรชีต · ไม่รวมค่าซ่อม)</span>
            </span>
            <span className="v">{baht(calc.sheetTotal)}</span>
          </div>
        </div>

        {zoneShow("cs") && (
          <>
            <h3 className="grp"><span className="dot" />รายการลูกหนี้ / บิล</h3>

            <div className="price-note" style={{ marginTop: 0, marginBottom: 12 }}>
              เว้น “เลขที่บิล” ว่าง = ใช้เลขที่ใบรายการ (ส่วนที่ 1) อัตโนมัติ ·
              ประเภท <b>สดต้นทาง</b> = ถือว่าชำระแล้ว · <b>เชื่อต้นทาง / เชื่อปลายทาง / สดปลายทาง</b> = ยังไม่ได้ชำระ ·
              <b> ราคารวม</b> คำนวณจาก จำนวน/น้ำหนัก × ราคาต่อหน่วย อัตโนมัติ ·
              <b> รายได้</b> ในสรุปผลคือผลรวมราคารวมของทุกแถวในตารางนี้
            </div>

            <div className="bill-head">
              <span>เลขที่บิล</span><span>ประเภทสินค้า</span><span>ผู้ส่ง</span><span>ผู้รับ</span>
              <span>ต้นทาง</span><span>ปลายทาง</span><span>ประเภทการชำระ</span>
              <span>จำนวน / น้ำหนัก</span><span>ราคา/หน่วย · กก.</span><span>เกณฑ์คิดราคา</span>
              <span>ราคารวม (อัตโนมัติ)</span><span />
            </div>

            {rec.bills.map((b, i) => (
              <div key={i} className="bill-block">
                <div className="bill-row">
                  <input placeholder="เลขที่บิล" value={b.no} disabled={!zoneOpen("cs")}
                    onChange={(e) => setBill(i, { no: e.target.value })} />
                  <input list="goodsTypes" placeholder="ประเภทสินค้า" value={b.goodsType} disabled={!zoneOpen("cs")}
                    onChange={(e) => setBill(i, { goodsType: e.target.value })} />
                  <input placeholder="ผู้ส่ง" value={b.sender} disabled={!zoneOpen("cs")}
                    onChange={(e) => setBill(i, { sender: e.target.value })} />
                  <input placeholder="ผู้รับ" value={b.receiver} disabled={!zoneOpen("cs")}
                    onChange={(e) => setBill(i, { receiver: e.target.value })} />
                  <select value={b.origin} disabled={!zoneOpen("cs")}
                    onChange={(e) => setBill(i, { origin: e.target.value, dest: "" })}>
                    <option value="">— ต้นทาง —</option>
                    {ORIGINS.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                  <select value={b.dest} disabled={!zoneOpen("cs")}
                    onChange={(e) => setBill(i, { dest: e.target.value })}>
                    <option value="">— ปลายทาง —</option>
                    {destsFor(b.origin).map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                  <select value={b.payType} disabled={!zoneOpen("cs")}
                    onChange={(e) => setBill(i, { payType: e.target.value as PayType })}>
                    <option value="">เลือกประเภท</option>
                    {PAY_TYPES.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <input type="number" min={0} step="any" placeholder="น้ำหนัก/จำนวน"
                    value={b.qty || ""} disabled={!zoneOpen("cs")}
                    onChange={(e) => setBill(i, { qty: parseFloat(e.target.value) || 0 })} />
                  <input type="number" min={0} step="any" placeholder="ราคาต่อหน่วย"
                    value={b.unitPrice ?? ""} disabled={!zoneOpen("cs")}
                    onChange={(e) => setBill(i, { unitPrice: e.target.value === "" ? null : parseFloat(e.target.value) })} />
                  <select value={b.pricingType || PRICE_BASIS[0]} disabled={!zoneOpen("cs")}
                    onChange={(e) => setBill(i, { pricingType: e.target.value })}>
                    {PRICE_BASIS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  {/* ราคารวมคำนวณให้ ไม่ให้กรอกเอง — ตรงตาม b-total-auto ของ main */}
                  <input className="b-total-auto" type="number" placeholder="อัตโนมัติ" readOnly tabIndex={-1}
                    value={billTotal(b) || ""} />
                  <button className="bill-x" type="button" title="ลบลูกหนี้รายนี้" disabled={!zoneOpen("cs")}
                    onClick={() => setRec((r) => ({ ...r, bills: r.bills.filter((_, j) => j !== i) }))}>✕</button>
                </div>
                <div className="bill-cust">
                  <CustCell label="ผู้ส่ง" raw={b.sender} />
                  <CustCell label="ผู้รับ" raw={b.receiver} />
                </div>
              </div>
            ))}

            <datalist id="goodsTypes" />
            <button className="btn-add" type="button" disabled={!zoneOpen("cs")}
              onClick={() => setRec((r) => ({ ...r, bills: [...r.bills, emptyBill()] }))}>
              + เพิ่มรายการลูกหนี้
            </button>
            <div className="price-note" style={{ marginTop: 12 }}>
              สถานะการชำระ: {pay.count ? `${pay.status} · ชำระแล้ว ${pay.paidCount}/${pay.count} ราย` : "–"}
            </div>
          </>
        )}

        <div className="save-row">
          <button className="btn btn-save" type="button" onClick={onSave} disabled={busy}>
            💾 บันทึกข้อมูล
          </button>
          <button className="btn-ghost" type="button"
            onClick={() => { setRec(emptyRecord()); setEditing(null); setEditZones(new Set()); setMsg(null); }}>
            เริ่มใบใหม่
          </button>
          {/* สำหรับเทสต์เท่านั้น — สุ่มเฉพาะโซนที่ฝ่ายนี้กรอกได้ ทับบนใบที่เปิดอยู่ (ไม่สร้างใบใหม่)
              ต้องคง editing/editZones ไว้ ไม่งั้นฝ่ายจัดรถที่เปิดใบของ cs มาสุ่มจะหลุดจากใบนั้น */}
          <button className="btn-ghost" type="button" title={`สุ่มเฉพาะช่องของ${randomZones.map((k) => ROLES[k].label).join(" / ")}`}
            onClick={() => { setRec((r) => randomFor(r, randomZones)); setMsg(null); }}>
            🎲 สุ่มข้อมูล{role === "admin" ? "" : ` (${ROLES[role].label})`}
          </button>
          {msg && <span className="msg" style={{ color: tone[msg.tone] }}>{msg.text}</span>}
        </div>
      </div>
    </>
  );
}

/* ---------- ชิ้นส่วนย่อย ---------- */

function F({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="field">
      <label>{label}{hint && <span className="hint"> {hint}</span>}</label>
      {children}
    </div>
  );
}

function Sel({ value, options, onChange, disabled }: {
  value: string; options: readonly string[]; onChange: (v: string) => void; disabled?: boolean;
}) {
  return (
    <select value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
      <option value="">— เลือก —</option>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

/** ตัวเลือกแบบปุ่มคู่ — main ใช้แทน <select> เมื่อมีแค่ 2 ตัวเลือก */
function Seg({ value, options, onChange, disabled }: {
  value: string; options: readonly string[]; onChange: (v: string) => void; disabled?: boolean;
}) {
  return (
    <div className={"seg" + (disabled ? " disabled" : "")}>
      {options.map((o) => (
        <button key={o} type="button" className={value === o ? "on" : ""}
          onClick={() => onChange(value === o ? "" : o)}>{o}</button>
      ))}
    </div>
  );
}

/** ช่องกรอกเงินพร้อมหน่วยบาทในเซลล์ขวา */
function Money({ fields, rec, num, disabled }: {
  fields: [keyof TripRecord, string][];
  rec: TripRecord;
  num: (k: keyof TripRecord) => (e: React.ChangeEvent<HTMLInputElement>) => void;
  disabled: boolean;
}) {
  return (
    <div className="grid3">
      {fields.map(([k, label]) => (
        <F key={String(k)} label={label}>
          <div className="input-suffix">
            <input type="number" placeholder="0" disabled={disabled}
              value={(rec[k] as number) || ""} onChange={num(k)} />
            <span className="unit">บาท</span>
          </div>
        </F>
      ))}
    </div>
  );
}
