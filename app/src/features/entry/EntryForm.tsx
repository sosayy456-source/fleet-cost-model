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
import { BRANCHES, DOC_TYPES, ORIGINS, REF, SERVICE_GROUPS, destsFor, distanceFor } from "../../lib/refdata";
import { ROLES, ROLE_ORDER, canEditOthers, isEntryRole, roleDone } from "../../lib/record/roles";
import { recPayInfo } from "../../lib/record/payment";
import { thDateSafe } from "../../lib/record/date";
import { SaveAbortedError, saveRecord } from "../../lib/store/save";
import { getById } from "../../lib/store/records";
import { useOverrides } from "../../lib/store/overrides";
import { useRoster } from "../../lib/store/roster";
import { getUrl } from "../../lib/sheet/client";
import { emptyBill, emptyRecord } from "./emptyRecord";
import ThaiDateInput from "./ThaiDateInput";
import type { Bill, PayType, RoleKey, TripRecord } from "../../types/record";
import { PAY_TYPES } from "../../types/record";
import type { FleetType } from "../../lib/cost/types";

const baht = (n: number) =>
  n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const baht0 = (n: number) => n.toLocaleString("th-TH", { maximumFractionDigits: 0 });

const FUEL_FIELDS: [keyof TripRecord, string][] = [
  ["gas", "ค่าแก๊สเดินทาง"],
  ["fuelCash", "ค่าน้ำมัน (เงินสด)"],
  ["fuelDownBill", "ขาล่อง (บิลน้ำมัน)"],
  ["fuelUpBill", "ขาขึ้น (บิลน้ำมัน)"],
  ["fuelFleet", "ค่าน้ำมัน (Fleet Card)"],
  ["fuelPickup", "ค่าน้ำมันไปเก็บสินค้า"],
  ["fuelCallTruck", "ค่าเรียกรถไปขึ้นของ"],
];
const LABOR_FIELDS: [keyof TripRecord, string][] = [
  ["drv", "ค่าเบี้ยเลี้ยง พขร."],
  ["spare", "ค่าเบี้ยเลี้ยง พขร. สำรอง"],
  ["snd", "เบี้ยเลี้ยง SND"],
];
const FEE_FIELDS: [keyof TripRecord, string][] = [
  ["feeTarp", "ค่าปิดเปิดผ้าใบ"],
  ["feePolice", "ค่าตำรวจ"],
  ["feeCont", "ค่าธรรมเนียมคืนตู้"],
  ["feePort", "ค่าเข้าท่าเรือ"],
  ["feeDoc", "ค่าส่งเอกสาร"],
  ["feeToll", "ค่าทางด่วน"],
];
/** ต้นทุนสูญเปล่าทั้งหมดอยู่ในกล่องเดียวกัน (.wastebox) */
const WASTE_FIELDS: [keyof TripRecord, string][] = [
  ["fuelOff", "น้ำมันนอกเส้นทาง"],
  ["fuelDetour", "ค่าน้ำมันรถวิ่งอ้อม"],
  ["fuelOffFleet", "นอกเส้นทาง (Fleet Card)"],
  ["laborOff", "เบี้ยเลี้ยงนอกเส้นทาง"],
];

export default function EntryForm({ role }: { role: RoleKey }) {
  const [rec, setRec] = useState<TripRecord>(emptyRecord);
  const [msg, setMsg] = useState<{ text: string; tone: "ok" | "err" | "info" } | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  /** โซนของฝ่ายอื่นที่เปิดแก้ไว้ — เปิดใบใหม่ = เริ่มจากดูอย่างเดียวเสมอ */
  const [editZones, setEditZones] = useState<Set<RoleKey>>(new Set());
  const [ovr] = useOverrides();
  const [roster] = useRoster();

  useEffect(() => {
    const id = sessionStorage.getItem("editRecordId");
    if (!id) return;
    sessionStorage.removeItem("editRecordId");
    getById(id).then((r) => {
      if (!r) return;
      setRec(r);
      setEditing(id);
      setEditZones(new Set());
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
    setRec((r) => ({ ...r, bills: r.bills.map((b, j) => (j === i ? { ...b, ...patch } : b)) }));

  const loadFactor = rec.capacity > 0 && !rec.emptyLeg
    ? Math.min(100, rec.loadActual / rec.capacity * 100) : null;

  async function onSave() {
    setBusy(true);
    setMsg({ text: "กำลังบันทึก...", tone: "info" });
    try {
      const offline = !getUrl();
      const res = await saveRecord(rec, {
        role, offline, overrides: ovr,
        alsoRoles: role === "admin" ? ROLE_ORDER : [...editZones],
      });
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

      {/* แถบความคืบหน้า — ฝ่ายบัญชีกดชิปของฝ่ายอื่นเพื่อเปิด/ปิดการแก้ไขส่วนนั้น */}
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
              <F label="รายได้ค่าบรรทุก">
                <div className="input-suffix">
                  <input type="number" disabled={!zoneOpen("cs")} value={rec.revenue || ""} onChange={num("revenue")} />
                  <span className="unit">บาท</span>
                </div></F>
            </div>
          )}

          {zoneShow("dispatch") && (
            <div>
              <div className="grid3">
                <F label="เลขทะเบียนรถ">
                  <input list="plateList" disabled={!zoneOpen("dispatch")} placeholder="เช่น ชม.70-0820"
                    value={rec.plate} onChange={(e) => set("plate", e.target.value)} />
                  <datalist id="plateList">
                    {roster.map((f) => <option key={f.plate} value={f.plate} />)}
                  </datalist>
                </F>
                <F label="ประเภทรถ">
                  <Seg value={rec.fleetType} options={["รถบริษัท", "รถร่วม"]}
                    disabled={!zoneOpen("dispatch")} onChange={(v) => set("fleetType", v as FleetType)} /></F>
                <F label="ชนิดรถ">
                  <Sel value={rec.vehicle} disabled={!zoneOpen("dispatch")} options={REF.vehicles.map((v) => v.name)}
                    onChange={(v) => setRec((r) => ({
                      ...r, vehicle: v,
                      capacity: REF.vehicles.find((x) => x.name === v)?.capacityKg ?? r.capacity,
                    }))} /></F>
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

      {/* ═════ การ์ด 2 — ค่าใช้จ่าย ═════ */}
      {zoneShow("account") && (
        <div className="card">
          <div className="card-h">
            <span className="step">2</span><h2>ค่าใช้จ่าย</h2>
            <span className="hint">ทุกช่องเลือกกรอกหรือเว้นว่างได้ (ว่าง = 0)</span>
          </div>

          <h3 className="grp"><span className="dot" />ค่าน้ำมัน — ต้นทุนปกติ</h3>
          <label className="chk">
            <input type="checkbox" checked={rec.fuelAutoOn} disabled={!zoneOpen("account")}
              onChange={(e) => set("fuelAutoOn", e.target.checked)} />
            <span>
              บวกค่าน้ำมันที่คำนวณอัตโนมัติ — {baht0(rec.dist || 0)} กม. × {calc.auto.rate.toFixed(5)} ล./กม.
              × {calc.auto.price.toFixed(2)} บ./ล. = <b>{baht(calc.auto.cost)}</b> บาท
            </span>
          </label>
          <Money fields={FUEL_FIELDS} rec={rec} num={num} disabled={!zoneOpen("account")} />

          <h3 className="grp"><span className="dot" />ค่าแรงพนักงาน — ต้นทุนปกติ</h3>
          <Money fields={LABOR_FIELDS} rec={rec} num={num} disabled={!zoneOpen("account")} />

          <h3 className="grp"><span className="dot" />ค่าธรรมเนียม</h3>
          <Money fields={FEE_FIELDS} rec={rec} num={num} disabled={!zoneOpen("account")} />

          <div className="wastebox">
            <h3 className="grp waste"><span className="dot" />ต้นทุนสูญเปล่า</h3>
            <Money fields={WASTE_FIELDS} rec={rec} num={num} disabled={!zoneOpen("account")} />
          </div>

          <h3 className="grp"><span className="dot" />ค่าซ่อมแซม</h3>
          <div className="price-note" style={{ marginTop: 0 }}>
            คิดจากประเภทรถ + ชนิดรถ + ระยะทาง ไม่ต้องกรอก —
            ตามเวลา <b>{baht(calc.repair.fixed)}</b>{!calc.repair.hasFix && " (ไม่มีในตาราง)"}
            {" + "}ตามระยะทาง <b>{baht(calc.repair.varCost)}</b>{!calc.repair.hasVar && " (ไม่มีในตาราง)"}
            {" = "}<b>{baht(calc.repair.total)}</b> บาท
          </div>
        </div>
      )}

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

        {zoneShow("cs") && (
          <>
            <h3 className="grp"><span className="dot" />รายการลูกหนี้ / บิล{" "}
              <span style={{ fontWeight: 400, color: "var(--ink-faint)" }}>
                · {pay.count} ราย · ชำระแล้ว {pay.paidCount}/{pay.count} · {pay.status}
              </span>
            </h3>

            {rec.bills.length > 0 && (
              <div className="bill-head">
                <span>เลขที่บิล</span><span>ประเภทสินค้า</span><span>ผู้ส่ง</span><span>ผู้รับ</span>
                <span>จำนวน</span><span>ราคา/หน่วย</span><span>ราคารวม</span><span>เกณฑ์</span>
                <span>ชำระ</span><span>กำหนดส่ง</span><span>ส่งจริง</span><span />
              </div>
            )}

            {rec.bills.map((b, i) => (
              <div key={i} className="bill-block">
                <div className="bill-row">
                  <input placeholder="เลขที่บิล" value={b.no} disabled={!zoneOpen("cs")}
                    onChange={(e) => setBill(i, { no: e.target.value })} />
                  <input placeholder="ประเภทสินค้า" value={b.goodsType} disabled={!zoneOpen("cs")}
                    onChange={(e) => setBill(i, { goodsType: e.target.value })} />
                  <input placeholder="ผู้ส่ง" value={b.sender} disabled={!zoneOpen("cs")}
                    onChange={(e) => setBill(i, { sender: e.target.value })} />
                  <input placeholder="ผู้รับ" value={b.receiver} disabled={!zoneOpen("cs")}
                    onChange={(e) => setBill(i, { receiver: e.target.value })} />
                  <input type="number" placeholder="จำนวน" value={b.qty || ""} disabled={!zoneOpen("cs")}
                    onChange={(e) => setBill(i, { qty: parseFloat(e.target.value) || 0 })} />
                  <input type="number" placeholder="ราคา/หน่วย" value={b.unitPrice ?? ""} disabled={!zoneOpen("cs")}
                    onChange={(e) => setBill(i, { unitPrice: parseFloat(e.target.value) || null })} />
                  <input type="number" placeholder="ราคารวม" value={b.total || ""} disabled={!zoneOpen("cs")}
                    onChange={(e) => setBill(i, { total: parseFloat(e.target.value) || 0 })} />
                  <input placeholder="เกณฑ์" value={b.pricingType ?? ""} disabled={!zoneOpen("cs")}
                    onChange={(e) => setBill(i, { pricingType: e.target.value })} />
                  <select value={b.payType} disabled={!zoneOpen("cs")}
                    onChange={(e) => setBill(i, { payType: e.target.value as PayType })}>
                    <option value="">— ชำระ —</option>
                    {PAY_TYPES.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <input type="date" value={b.plannedDate ?? ""} disabled={!zoneOpen("cs")}
                    onChange={(e) => setBill(i, { plannedDate: e.target.value || null })} />
                  <input type="date" value={b.actualDate ?? ""} disabled={!zoneOpen("cs")}
                    onChange={(e) => setBill(i, { actualDate: e.target.value || null })} />
                  <button className="bill-x" type="button" title="ลบบิลนี้" disabled={!zoneOpen("cs")}
                    onClick={() => setRec((r) => ({ ...r, bills: r.bills.filter((_, j) => j !== i) }))}>✕</button>
                </div>
                <div className="bill-sp">
                  <div className="spf"><label>สถานะสินค้า</label>
                    <select value={b.damageStatus ?? ""} disabled={!zoneOpen("cs")}
                      onChange={(e) => setBill(i, { damageStatus: e.target.value })}>
                      <option value="">— ไม่ระบุ —</option>
                      <option>ปกติ</option><option>เสียหายบางส่วน</option>
                      <option>เสียหายทั้งหมด</option><option>สูญหาย</option>
                    </select></div>
                  <div className="spf"><label>ชิ้นที่เสียหาย</label>
                    <input type="number" value={b.damageQty ?? ""} disabled={!zoneOpen("cs")}
                      onChange={(e) => setBill(i, { damageQty: parseFloat(e.target.value) || 0 })} /></div>
                </div>
              </div>
            ))}

            <button className="btn-add" type="button" disabled={!zoneOpen("cs")}
              onClick={() => setRec((r) => ({ ...r, bills: [...r.bills, emptyBill()] }))}>
              + เพิ่มบิลลูกหนี้
            </button>
          </>
        )}

        <div className="save-row">
          <button className="btn btn-save" type="button" onClick={onSave} disabled={busy}>
            บันทึกในฐานะ {ROLES[role].label}
          </button>
          <button className="btn-ghost" type="button"
            onClick={() => { setRec(emptyRecord()); setEditing(null); setEditZones(new Set()); setMsg(null); }}>
            เริ่มใบใหม่
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
