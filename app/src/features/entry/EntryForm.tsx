/**
 * ฟอร์มกรอกใบรายการเดินรถ — โครงตรงตาม v5:674-931
 *
 * การ์ด 3 ใบมีเลขขั้นตอนสีส้ม (1 ข้อมูลการเดินทาง / 2 ค่าใช้จ่าย / 3 สรุปผล)
 * ภายในการ์ดแบ่งเป็น "โซน" ตามฝ่าย โซนของฝ่ายอื่นแสดงแบบอ่านอย่างเดียว
 * (v5 ซ่อนโซนฝ่ายอื่นทิ้งไปเลย ที่นี่แสดงแบบล็อกไว้ เพื่อให้เห็นภาพรวมทั้งใบ)
 *
 * ยอดต้นทุนคำนวณสดจาก computeCost ทุกครั้งที่พิมพ์ และเคารพค่าที่ผู้ใช้แก้เอง
 * (ราคาน้ำมัน / อัตราค่าซ่อม) ผ่าน RefOverrides
 */
import { useEffect, useMemo, useState } from "react";
import { computeCost } from "../../lib/cost/computeCost";
import { BRANCHES, DOC_TYPES, ORIGINS, REF, SERVICE_GROUPS, destsFor, distanceFor } from "../../lib/refdata";
import { ROLES, ROLE_ORDER, roleDone } from "../../lib/record/roles";
import { recPayInfo } from "../../lib/record/payment";
import { SaveAbortedError, saveRecord } from "../../lib/store/save";
import { getById } from "../../lib/store/records";
import { useOverrides } from "../../lib/store/overrides";
import { useRoster } from "../../lib/store/roster";
import { getUrl } from "../../lib/sheet/client";
import { emptyBill, emptyRecord } from "./emptyRecord";
import ThaiDateInput from "./ThaiDateInput";
import FleetRoster from "./panels/FleetRoster";
import PriceTable from "./panels/PriceTable";
import RepairTable from "./panels/RepairTable";
import type { Bill, PayType, RoleKey, TripRecord } from "../../types/record";
import { PAY_TYPES } from "../../types/record";
import type { FleetType } from "../../lib/cost/types";

const baht = (n: number) =>
  n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const baht0 = (n: number) => n.toLocaleString("th-TH", { maximumFractionDigits: 0 });

/** ค่าน้ำมัน — ต้นทุนปกติ (v5 หัวข้อ 2) */
const FUEL_FIELDS: [keyof TripRecord, string][] = [
  ["gas", "ค่าแก๊สเดินทาง"],
  ["fuelCash", "ค่าน้ำมัน (เงินสด)"],
  ["fuelDownBill", "ขาล่อง (บิลน้ำมัน)"],
  ["fuelUpBill", "ขาขึ้น (บิลน้ำมัน)"],
  ["fuelFleet", "ค่าน้ำมัน (Fleet Card)"],
  ["fuelPickup", "ค่าน้ำมันไปเก็บสินค้า"],
  ["fuelCallTruck", "ค่าเรียกรถไปขึ้นของ"],
];
const FUEL_WASTE: [keyof TripRecord, string][] = [
  ["fuelOff", "น้ำมันนอกเส้นทาง"],
  ["fuelDetour", "ค่าน้ำมันรถวิ่งอ้อม"],
  ["fuelOffFleet", "นอกเส้นทาง (Fleet Card)"],
];
/** ค่าแรงพนักงาน (v5 หัวข้อ 3) */
const LABOR_FIELDS: [keyof TripRecord, string][] = [
  ["drv", "ค่าเบี้ยเลี้ยง พขร."],
  ["spare", "ค่าเบี้ยเลี้ยง พขร. สำรอง"],
  ["snd", "เบี้ยเลี้ยง SND"],
];
const LABOR_WASTE: [keyof TripRecord, string][] = [["laborOff", "เบี้ยเลี้ยงนอกเส้นทาง"]];
/** ค่าธรรมเนียม (v5 หัวข้อ 4) */
const FEE_FIELDS: [keyof TripRecord, string][] = [
  ["feeTarp", "ค่าปิดเปิดผ้าใบ"],
  ["feePolice", "ค่าตำรวจ"],
  ["feeCont", "ค่าธรรมเนียมคืนตู้"],
  ["feePort", "ค่าเข้าท่าเรือ"],
  ["feeDoc", "ค่าส่งเอกสาร"],
  ["feeToll", "ค่าทางด่วน"],
];

export default function EntryForm({ role }: { role: RoleKey }) {
  const [rec, setRec] = useState<TripRecord>(emptyRecord);
  const [msg, setMsg] = useState<{ text: string; tone: "ok" | "err" | "info" } | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [ovr] = useOverrides();
  const [roster] = useRoster();

  /* เปิดใบที่กดแก้ไขมาจากหน้า “รายการทั้งหมด” หรือ “ใบที่ยังไม่ครบ” */
  useEffect(() => {
    const id = sessionStorage.getItem("editRecordId");
    if (!id) return;
    sessionStorage.removeItem("editRecordId");
    getById(id).then((r) => {
      if (!r) return;
      setRec(r);
      setEditing(id);
      setMsg({ text: `กำลังแก้ไขใบ ${r.docNo || "–"}`, tone: "info" });
    }).catch(() => { /* เปิดไม่ได้ก็เริ่มใบใหม่ตามปกติ */ });
  }, []);

  const set = <K extends keyof TripRecord>(k: K, v: TripRecord[K]) =>
    setRec((r) => ({ ...r, [k]: v }));

  const num = (k: keyof TripRecord) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setRec((r) => ({ ...r, [k]: parseFloat(e.target.value) || 0 }));

  const calc = useMemo(
    () => computeCost(
      {
        date: rec.date, vehicle: rec.vehicle, fleetType: rec.fleetType,
        distance: rec.dist, revenue: rec.revenue,
        gas: rec.gas, fuelCash: rec.fuelCash, fuelDownBill: rec.fuelDownBill,
        fuelFleet: rec.fuelFleet, fuelPickup: rec.fuelPickup, fuelUpBill: rec.fuelUpBill,
        fuelCallTruck: rec.fuelCallTruck, fuelAutoOn: rec.fuelAutoOn,
        fuelOff: rec.fuelOff, fuelDetour: rec.fuelDetour, fuelOffFleet: rec.fuelOffFleet,
        drv: rec.drv, spare: rec.spare, snd: rec.snd, laborOff: rec.laborOff,
        feeTarp: rec.feeTarp, feePolice: rec.feePolice, feeCont: rec.feeCont,
        feePort: rec.feePort, feeDoc: rec.feeDoc, feeToll: rec.feeToll,
      },
      REF, ovr,
    ),
    [rec, ovr],
  );

  const pay = recPayInfo(rec);
  const mine = (zone: RoleKey) => zone === role;

  const setBill = (i: number, patch: Partial<Bill>) =>
    setRec((r) => ({ ...r, bills: r.bills.map((b, j) => (j === i ? { ...b, ...patch } : b)) }));

  const loadFactor = rec.capacity > 0 && !rec.emptyLeg
    ? Math.min(100, rec.loadActual / rec.capacity * 100) : null;

  async function onSave() {
    setBusy(true);
    setMsg({ text: "กำลังบันทึก...", tone: "info" });
    try {
      const offline = !getUrl();
      const res = await saveRecord(rec, { role, offline });
      setRec(res.record);
      setEditing(null);
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

  return (
    <>
      {editing && (
        <div className="edit-banner">
          ✏ กำลังแก้ไขใบ <b>{rec.docNo || "–"}</b> — กดบันทึกเพื่อทับใบเดิม
          <button type="button" className="x"
            onClick={() => { setRec(emptyRecord()); setEditing(null); setMsg(null); }}>
            ยกเลิกการแก้ไข
          </button>
        </div>
      )}

      {/* ความคืบหน้า 3 ฝ่าย */}
      <div className="prog">
        {ROLE_ORDER.map((k) => (
          <span key={k} className={"pchip " + (roleDone(rec, k) ? "done" : "wait") + (k === role ? " mine" : "")}>
            {ROLES[k].icon} {ROLES[k].label} · {roleDone(rec, k) ? "กรอกแล้ว" : "ยังไม่กรอก"}
          </span>
        ))}
      </div>

      {/* ═════ การ์ด 1 — ข้อมูลการเดินทาง ═════ */}
      <div className="card">
        <div className="card-h"><span className="step">1</span><h2>ข้อมูลการเดินทาง</h2></div>

        <Zone role="cs" mine={mine("cs")}>
          <div className="grid3">
            <div className="field"><label>วันที่ · วัน / เดือน / ปี (พ.ศ.)</label>
              <ThaiDateInput value={rec.date} onChange={(v) => set("date", v)} disabled={!mine("cs")} /></div>
            <F label="เลขที่ใบรายการ">
              <input value={rec.docNo} disabled={!mine("cs")} placeholder="เช่น INV-2569-001"
                onChange={(e) => set("docNo", e.target.value)} /></F>
            <F label="ประเภทเส้นทาง">
              <Sel value={rec.routeType} disabled={!mine("cs")} options={["ขาขึ้น", "ขาล่อง"]}
                onChange={(v) => set("routeType", v)} /></F>
          </div>
          <div className="grid3">
            <F label="สาขา">
              <Sel value={rec.branch} disabled={!mine("cs")} options={BRANCHES} onChange={(v) => set("branch", v)} /></F>
            <F label="ประเภทใบรายการ">
              <Sel value={rec.docType} disabled={!mine("cs")} options={DOC_TYPES} onChange={(v) => set("docType", v)} /></F>
            <div className="field">
              <label>ระยะทาง <span style={{ color: "var(--ink-faint)", fontWeight: 400 }}>· เติมอัตโนมัติ/แก้เองได้</span></label>
              <div className="input-suffix">
                <input type="number" min={0} placeholder="0" disabled={!mine("cs")}
                  value={rec.dist || ""} onChange={num("dist")} />
                <span className="unit">กม.</span>
              </div>
            </div>
          </div>
          <div className="grid3">
            <F label="เส้นทาง · ต้นทาง">
              <Sel value={rec.origin} disabled={!mine("cs")} options={ORIGINS}
                onChange={(v) => setRec((r) => ({ ...r, origin: v, dest: "", dist: 0 }))} /></F>
            <F label="ปลายทาง">
              <Sel value={rec.dest} disabled={!mine("cs")} options={destsFor(rec.origin)}
                onChange={(v) => setRec((r) => ({ ...r, dest: v, dist: distanceFor(r.origin, v) ?? r.dist }))} /></F>
            <F label="กลุ่มบริการ / ประเภทงานขนส่ง">
              <Sel value={rec.serviceGroup} disabled={!mine("cs")} options={SERVICE_GROUPS}
                onChange={(v) => set("serviceGroup", v)} /></F>
          </div>
          <div className="route-line">
            <span className="pin from" />
            <span className="txt">
              {rec.origin && rec.dest
                ? `${rec.origin} → ${rec.dest}${rec.dist ? ` · ${baht0(rec.dist)} กม.` : ""}`
                : "–"}
            </span>
            <span className="pin to" />
          </div>
          <F label="รายได้ค่าบรรทุก (บาท)">
            <input type="number" disabled={!mine("cs")} value={rec.revenue || ""} onChange={num("revenue")} /></F>
        </Zone>

        <Zone role="dispatch" mine={mine("dispatch")}>
          <div className="grid3">
            <F label="เลขทะเบียนรถ">
              <input list="plateList" disabled={!mine("dispatch")} placeholder="เช่น ชม.70-0820"
                value={rec.plate} onChange={(e) => set("plate", e.target.value)} />
              <datalist id="plateList">
                {roster.map((f) => <option key={f.plate} value={f.plate} />)}
              </datalist>
            </F>
            <F label="ประเภทรถ">
              <Sel value={rec.fleetType} disabled={!mine("dispatch")} options={["รถบริษัท", "รถร่วม"]}
                onChange={(v) => set("fleetType", v as FleetType)} /></F>
            <F label="ชนิดรถ">
              <Sel value={rec.vehicle} disabled={!mine("dispatch")} options={REF.vehicles.map((v) => v.name)}
                onChange={(v) => setRec((r) => ({
                  ...r, vehicle: v,
                  capacity: REF.vehicles.find((x) => x.name === v)?.capacityKg ?? r.capacity,
                }))} /></F>
          </div>
          <div className="grid3">
            <div className="field"><label>วันที่ปล่อยรถ · วัน / เดือน / ปี (พ.ศ.)</label>
              <ThaiDateInput value={rec.releaseDate} onChange={(v) => set("releaseDate", v)} disabled={!mine("dispatch")} /></div>
          </div>

          <h3 className="grp"><span className="dot" />6) การใช้ประโยชน์กองรถ &amp; อัตราการบรรทุก{" "}
            <span style={{ fontWeight: 400, color: "var(--ink-faint)" }}>(ใช้คำนวณ Fleet Utilization และ Load Factor)</span>
          </h3>
          <div className="grid2">
            <div className="field">
              <label>ความจุรถสูงสุด <span style={{ color: "var(--ink-faint)", fontWeight: 400 }}>· เติมอัตโนมัติ/แก้เองได้</span></label>
              <div className="input-suffix">
                <input type="number" min={0} placeholder="0" disabled={!mine("dispatch")}
                  value={rec.capacity || ""} onChange={num("capacity")} />
                <span className="unit">กก.</span>
              </div>
            </div>
            <div className="field">
              <label>น้ำหนัก/ปริมาณบรรทุกจริง</label>
              <div className="input-suffix">
                <input type="number" min={0} placeholder="0" disabled={!mine("dispatch")}
                  value={rec.loadActual || ""} onChange={num("loadActual")} />
                <span className="unit">กก.</span>
              </div>
            </div>
          </div>
          <label className="chk">
            <input type="checkbox" checked={rec.emptyLeg} disabled={!mine("dispatch")}
              onChange={(e) => set("emptyLeg", e.target.checked)} />
            <span>เที่ยวนี้เป็นเที่ยวเปล่า (Empty Leg) — วิ่งโดยไม่มีสินค้า/ไม่ได้บรรทุก</span>
          </label>
          <div className="price-note" style={{ marginTop: 0 }}>
            {rec.emptyLeg
              ? "เที่ยวเปล่า — ต้นทุนทั้งเที่ยวจะถูกนับเป็นมูลค่าที่สูญเสียในแดชบอร์ด"
              : loadFactor != null
                ? <>Load Factor = <b>{loadFactor.toFixed(1)}%</b> ({baht0(rec.loadActual)} ÷ {baht0(rec.capacity)} กก.)</>
                : "เลือกชนิดรถ + กรอกน้ำหนักบรรทุกจริง เพื่อคำนวณ Load Factor (% การใช้ประโยชน์ความจุ)"}
          </div>
        </Zone>
      </div>

      {mine("dispatch") && <FleetRoster />}

      {/* ═════ การ์ด 2 — ค่าใช้จ่าย ═════ */}
      <div className="card">
        <div className="card-h">
          <span className="step">2</span><h2>ค่าใช้จ่าย</h2>
          <span className="hint">ทุกช่องเลือกกรอกหรือเว้นว่างได้ (ว่าง = 0)</span>
        </div>

        <Zone role="account" mine={mine("account")}>
          <h3 className="grp"><span className="dot" />2) ค่าน้ำมัน — ต้นทุนปกติ{" "}
            <span style={{ fontWeight: 400, color: "var(--ink-faint)" }}>(แยกตามวิธีจ่าย ตามรูปแบบชีต + รวมค่าคำนวณอัตโนมัติ)</span>
          </h3>
          <label className="chk">
            <input type="checkbox" checked={rec.fuelAutoOn} disabled={!mine("account")}
              onChange={(e) => set("fuelAutoOn", e.target.checked)} />
            <span>บวกค่าน้ำมันที่คำนวณอัตโนมัติ</span>
          </label>
          <div className="price-note" style={{ marginTop: 0, marginBottom: 12 }}>
            {baht0(rec.dist || 0)} กม. × {calc.auto.rate.toFixed(5)} ล./กม. × {calc.auto.price.toFixed(2)} บ./ล.
            = <b>{baht(calc.auto.cost)}</b> บาท
          </div>
          <Grid3 fields={FUEL_FIELDS} rec={rec} num={num} disabled={!mine("account")} />

          <h3 className="grp waste"><span className="dot" />ค่าน้ำมัน — ต้นทุนสูญเปล่า</h3>
          <Grid3 fields={FUEL_WASTE} rec={rec} num={num} disabled={!mine("account")} />

          <h3 className="grp"><span className="dot" />3) ค่าแรงพนักงาน — ต้นทุนปกติ</h3>
          <Grid3 fields={LABOR_FIELDS} rec={rec} num={num} disabled={!mine("account")} />

          <h3 className="grp waste"><span className="dot" />ค่าแรง — ต้นทุนสูญเปล่า</h3>
          <Grid3 fields={LABOR_WASTE} rec={rec} num={num} disabled={!mine("account")} />

          <h3 className="grp"><span className="dot" />4) ค่าธรรมเนียม{" "}
            <span style={{ fontWeight: 400, color: "var(--ink-faint)" }}>(นับเป็นต้นทุนปกติ)</span>
          </h3>
          <Grid3 fields={FEE_FIELDS} rec={rec} num={num} disabled={!mine("account")} />

          <h3 className="grp"><span className="dot" />5) ค่าซ่อมแซม{" "}
            <span style={{ fontWeight: 400, color: "var(--ink-faint)" }}>
              (นับเป็นต้นทุนปกติ · อิงประเภทรถ + ชนิดรถ จากข้อ 1 · ไม่มีข้อมูลในตาราง = 0)
            </span>
          </h3>
          <div className="price-note" style={{ marginTop: 0 }}>
            ตามเวลา <b>{baht(calc.repair.fixed)}</b>{!calc.repair.hasFix && " (ไม่มีในตาราง)"}
            {" + "}ตามระยะทาง <b>{baht(calc.repair.varCost)}</b>{!calc.repair.hasVar && " (ไม่มีในตาราง)"}
            {" = "}<b>{baht(calc.repair.total)}</b> บาท
          </div>
        </Zone>
      </div>

      {mine("account") && <><PriceTable /><RepairTable /></>}

      {/* ═════ การ์ด 3 — สรุปผล ═════ */}
      <div className="card">
        <div className="card-h"><span className="step">3</span><h2>สรุปผล</h2></div>

        <div className="kpis">
          <div className="kpi rev"><div className="lab">รายได้ค่าบรรทุก</div>
            <div className="big">{baht(rec.revenue)}<small>บาท</small></div></div>
          <div className="kpi normal"><div className="lab">ต้นทุนปกติ</div>
            <div className="big">{baht(calc.normal)}<small>บาท</small></div></div>
          <div className="kpi waste"><div className="lab">ต้นทุนสูญเปล่า</div>
            <div className="big">{baht(calc.waste)}<small>บาท</small></div></div>
          <div className={"kpi profit" + (profitLoss ? " loss" : "")}>
            <div className="lab">{profitLoss ? "ขาดทุน" : "กำไร"}</div>
            <div className="big">{baht(calc.profit)}<small>บาท</small></div></div>
        </div>

        <div className="result">
          <div className="result-row"><span className="k">ค่าน้ำมันรวม (รวมค่าคำนวณอัตโนมัติ)</span><span className="v">{baht(calc.fuelSum)}</span></div>
          <div className="result-row"><span className="k">ค่าแรงพนักงาน</span><span className="v">{baht(calc.labor)}</span></div>
          <div className="result-row"><span className="k">ค่าธรรมเนียม</span><span className="v">{baht(calc.fees)}</span></div>
          <div className="result-row"><span className="k">ค่าซ่อมแซม</span><span className="v">{baht(calc.repair.total)}</span></div>
          <div className="result-row"><span className="k">ต้นทุนสูญเปล่า</span><span className="v">{baht(calc.waste)}</span></div>
          <div className="result-row">
            <span className="k">รวมค่าใช้จ่ายตามคอลัมน์ของชีต <span className="locknote">(ไม่รวมค่าซ่อม)</span></span>
            <span className="v">{baht(calc.sheetTotal)}</span>
          </div>
        </div>

        {/* ───── รายการลูกหนี้ / บิล ───── */}
        <Zone role="cs" mine={mine("cs")}>
          <h3 className="grp"><span className="dot" />รายการลูกหนี้ / บิล{" "}
            <span style={{ fontWeight: 400, color: "var(--ink-faint)" }}>
              · {pay.count} ราย · ชำระแล้ว {pay.paidCount}/{pay.count} · สถานะ {pay.status}
            </span>
          </h3>

          {rec.bills.length > 0 && (
            <div className="bill-head">
              <span>เลขที่บิล</span><span>ประเภทสินค้า</span><span>ผู้ส่ง</span><span>ผู้รับ</span>
              <span>จำนวน</span><span>ราคารวม</span><span>ราคา/หน่วย</span><span>เกณฑ์</span>
              <span>ประเภทการชำระ</span><span />
            </div>
          )}

          {rec.bills.map((b, i) => (
            <div key={i} className="bill-block">
              <div className="bill-row">
                <input placeholder="เลขที่บิล" value={b.no} disabled={!mine("cs")}
                  onChange={(e) => setBill(i, { no: e.target.value })} />
                <input placeholder="ประเภทสินค้า" value={b.goodsType} disabled={!mine("cs")}
                  onChange={(e) => setBill(i, { goodsType: e.target.value })} />
                <input placeholder="ผู้ส่ง" value={b.sender} disabled={!mine("cs")}
                  onChange={(e) => setBill(i, { sender: e.target.value })} />
                <input placeholder="ผู้รับ" value={b.receiver} disabled={!mine("cs")}
                  onChange={(e) => setBill(i, { receiver: e.target.value })} />
                <input type="number" placeholder="จำนวน" value={b.qty || ""} disabled={!mine("cs")}
                  onChange={(e) => setBill(i, { qty: parseFloat(e.target.value) || 0 })} />
                <input type="number" placeholder="ราคารวม" value={b.total || ""} disabled={!mine("cs")}
                  onChange={(e) => setBill(i, { total: parseFloat(e.target.value) || 0 })} />
                <input type="number" placeholder="ราคา/หน่วย" value={b.unitPrice ?? ""} disabled={!mine("cs")}
                  onChange={(e) => setBill(i, { unitPrice: parseFloat(e.target.value) || null })} />
                <input placeholder="เกณฑ์" value={b.pricingType ?? ""} disabled={!mine("cs")}
                  onChange={(e) => setBill(i, { pricingType: e.target.value })} />
                <select value={b.payType} disabled={!mine("cs")}
                  onChange={(e) => setBill(i, { payType: e.target.value as PayType })}>
                  <option value="">— ชำระ —</option>
                  {PAY_TYPES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
                <button className="bill-x" type="button" title="ลบบิลนี้" disabled={!mine("cs")}
                  onClick={() => setRec((r) => ({ ...r, bills: r.bills.filter((_, j) => j !== i) }))}>✕</button>
              </div>
              <div className="bill-sp">
                <div className="spf"><label>กำหนดส่ง</label>
                  <input type="date" value={b.plannedDate ?? ""} disabled={!mine("cs")}
                    onChange={(e) => setBill(i, { plannedDate: e.target.value || null })} /></div>
                <div className="spf"><label>ส่งจริง</label>
                  <input type="date" value={b.actualDate ?? ""} disabled={!mine("cs")}
                    onChange={(e) => setBill(i, { actualDate: e.target.value || null })} /></div>
                <div className="spf"><label>สถานะสินค้า</label>
                  <select value={b.damageStatus ?? ""} disabled={!mine("cs")}
                    onChange={(e) => setBill(i, { damageStatus: e.target.value })}>
                    <option value="">— ไม่ระบุ —</option>
                    <option>ปกติ</option><option>เสียหายบางส่วน</option><option>เสียหายทั้งหมด</option><option>สูญหาย</option>
                  </select></div>
                <div className="spf"><label>ชิ้นที่เสียหาย</label>
                  <input type="number" value={b.damageQty ?? ""} disabled={!mine("cs")}
                    onChange={(e) => setBill(i, { damageQty: parseFloat(e.target.value) || 0 })} /></div>
              </div>
            </div>
          ))}

          <button className="btn-add" type="button" disabled={!mine("cs")}
            onClick={() => setRec((r) => ({ ...r, bills: [...r.bills, emptyBill()] }))}>
            + เพิ่มบิลลูกหนี้
          </button>
        </Zone>

        <div className="save-row">
          <button className="btn btn-save" type="button" onClick={onSave} disabled={busy}>
            💾 บันทึกในฐานะ {ROLES[role].label}
          </button>
          <button className="btn-ghost" type="button"
            onClick={() => { setRec(emptyRecord()); setEditing(null); setMsg(null); }}>
            เริ่มใบใหม่
          </button>
          {msg && <span className="msg" style={{ color: tone[msg.tone] }}>{msg.text}</span>}
        </div>
      </div>
    </>
  );
}

/* ---------- ชิ้นส่วนย่อย ---------- */

/** โซนของแต่ละฝ่าย — มีป้ายกำกับและไฮไลต์เมื่อเป็นโซนของฝ่ายที่ล็อกอินอยู่ */
function Zone({ role, mine, children }: { role: RoleKey; mine: boolean; children: React.ReactNode }) {
  return (
    <div className={mine ? "zone-mine" : undefined}>
      <div className="zone-tag">
        {ROLES[role].icon} {ROLES[role].label}
        {!mine && <span style={{ fontWeight: 500 }}> · อ่านอย่างเดียว</span>}
      </div>
      {children}
    </div>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="field"><label>{label}</label>{children}</div>;
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

function Grid3({ fields, rec, num, disabled }: {
  fields: [keyof TripRecord, string][];
  rec: TripRecord;
  num: (k: keyof TripRecord) => (e: React.ChangeEvent<HTMLInputElement>) => void;
  disabled: boolean;
}) {
  return (
    <div className="grid3">
      {fields.map(([k, label]) => (
        <F key={String(k)} label={label}>
          <input type="number" placeholder="0" disabled={disabled}
            value={(rec[k] as number) || ""} onChange={num(k)} />
        </F>
      ))}
    </div>
  );
}
