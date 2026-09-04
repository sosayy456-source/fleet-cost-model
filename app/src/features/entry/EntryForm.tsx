/**
 * ฟอร์มกรอกใบรายการเดินรถ — แทน view-form ของ v5
 *
 * แต่ละฝ่ายเห็นเฉพาะโซนของตัวเอง (โซนฝ่ายอื่นแสดงแบบอ่านอย่างเดียว ไม่ซ่อนทิ้ง
 * เพื่อให้เห็นภาพรวมของใบ ต่างจาก v5 ที่ซ่อนหายไปเลย)
 * ยอดต้นทุนคำนวณสดจาก computeCost ทุกครั้งที่พิมพ์
 */
import { useMemo, useState } from "react";
import { computeCost } from "../../lib/cost/computeCost";
import { BRANCHES, DOC_TYPES, ORIGINS, REF, SERVICE_GROUPS, destsFor, distanceFor } from "../../lib/refdata";
import { ROLES, ROLE_ORDER, roleDone } from "../../lib/record/roles";
import { recPayInfo } from "../../lib/record/payment";
import { SaveAbortedError, saveRecord } from "../../lib/store/save";
import { getUrl } from "../../lib/sheet/client";
import { emptyBill, emptyRecord } from "./emptyRecord";
import ThaiDateInput from "./ThaiDateInput";
import type { Bill, PayType, RoleKey, TripRecord } from "../../types/record";
import { PAY_TYPES } from "../../types/record";
import type { FleetType } from "../../lib/cost/types";

const baht = (n: number) =>
  n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const COST_FIELDS: [keyof TripRecord, string][] = [
  ["gas", "ค่าแก๊สเดินทาง"],
  ["fuelCash", "ค่าน้ำมัน (เงินสด)"],
  ["fuelDownBill", "ขาล่อง (บิลน้ำมัน)"],
  ["fuelUpBill", "ขาขึ้น (บิลน้ำมัน)"],
  ["fuelFleet", "ค่าน้ำมัน (Fleet Card)"],
  ["fuelPickup", "ค่าน้ำมันไปเก็บสินค้า"],
  ["fuelCallTruck", "ค่าเรียกรถไปขึ้นของ"],
  ["drv", "ค่าเบี้ยเลี้ยง พขร."],
  ["spare", "ค่าเบี้ยเลี้ยง พขร. สำรอง"],
  ["snd", "เบี้ยเลี้ยง SND"],
  ["feeTarp", "ค่าปิดเปิดผ้าใบ"],
  ["feePolice", "ค่าตำรวจ"],
  ["feeCont", "ค่าธรรมเนียมคืนตู้"],
  ["feePort", "ค่าเข้าท่าเรือ"],
  ["feeDoc", "ค่าส่งเอกสาร"],
  ["feeToll", "ค่าทางด่วน"],
];

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

  const set = <K extends keyof TripRecord>(k: K, v: TripRecord[K]) =>
    setRec((r) => ({ ...r, [k]: v }));

  const num = (k: keyof TripRecord) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setRec((r) => ({ ...r, [k]: parseFloat(e.target.value) || 0 }));

  const calc = useMemo(
    () =>
      computeCost(
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
        REF,
      ),
    [rec],
  );

  const pay = recPayInfo(rec);
  const canEdit = (zone: RoleKey) => zone === role;

  const setBill = (i: number, patch: Partial<Bill>) =>
    setRec((r) => ({ ...r, bills: r.bills.map((b, j) => (j === i ? { ...b, ...patch } : b)) }));

  async function onSave() {
    setBusy(true);
    setMsg({ text: "กำลังบันทึก...", tone: "info" });
    try {
      const offline = !getUrl();
      const res = await saveRecord(rec, { role, offline });
      setRec(res.record);
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
    } finally {
      setBusy(false);
    }
  }

  const tone = { ok: "var(--green)", err: "var(--red)", info: "var(--ink-soft)" };

  return (
    <>
      <div className="card">
        <h2>ความคืบหน้าของใบนี้</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {ROLE_ORDER.map((k) => (
            <span key={k} className={"chip" + (roleDone(rec, k) ? " chip-done" : "")}>
              {ROLES[k].icon} {ROLES[k].label} · {roleDone(rec, k) ? "กรอกแล้ว" : "ยังไม่กรอก"}
            </span>
          ))}
        </div>
      </div>

      {/* ───── โซนฝ่ายบริการลูกค้า ───── */}
      <fieldset className={"card zone" + (canEdit("cs") ? " zone-mine" : "")} disabled={!canEdit("cs")}>
        <h2>👤 ข้อมูลการเดินทาง <span className="muted">· ฝ่ายบริการลูกค้า</span></h2>
        <div className="grid">
          <Field label="วันที่" wide>
            <ThaiDateInput value={rec.date} onChange={(v) => set("date", v)} />
          </Field>
          <Field label="เลขที่ใบรายการ">
            <input value={rec.docNo} onChange={(e) => set("docNo", e.target.value)} />
          </Field>
          <Field label="สาขา">
            <Select value={rec.branch} onChange={(v) => set("branch", v)} options={BRANCHES} />
          </Field>
          <Field label="ประเภทใบรายการ">
            <Select value={rec.docType} onChange={(v) => set("docType", v)} options={DOC_TYPES} />
          </Field>
          <Field label="ประเภทเส้นทาง">
            <Select value={rec.routeType} onChange={(v) => set("routeType", v)} options={["ขาขึ้น", "ขาล่อง"]} />
          </Field>
          <Field label="กลุ่มบริการ">
            <Select value={rec.serviceGroup} onChange={(v) => set("serviceGroup", v)} options={SERVICE_GROUPS} />
          </Field>
          <Field label="ต้นทาง">
            <Select
              value={rec.origin} options={ORIGINS}
              onChange={(v) => setRec((r) => ({ ...r, origin: v, dest: "", dist: 0 }))}
            />
          </Field>
          <Field label="ปลายทาง">
            <Select
              value={rec.dest} options={destsFor(rec.origin)}
              onChange={(v) =>
                setRec((r) => ({ ...r, dest: v, dist: distanceFor(r.origin, v) ?? r.dist }))}
            />
          </Field>
          <Field label="ระยะทาง (กม.)">
            <input type="number" value={rec.dist || ""} onChange={num("dist")} />
          </Field>
          <Field label="รายได้ค่าบรรทุก (บาท)">
            <input type="number" value={rec.revenue || ""} onChange={num("revenue")} />
          </Field>
        </div>
      </fieldset>

      {/* ───── โซนฝ่ายจัดรถ ───── */}
      <fieldset
        className={"card zone" + (canEdit("dispatch") ? " zone-mine" : "")}
        disabled={!canEdit("dispatch")}
      >
        <h2>🚚 ข้อมูลรถ <span className="muted">· ฝ่ายเจ้าหน้าที่จัดรถ</span></h2>
        <div className="grid">
          <Field label="ทะเบียนรถ">
            <input value={rec.plate} onChange={(e) => set("plate", e.target.value)} />
          </Field>
          <Field label="ประเภทรถ">
            <Select
              value={rec.fleetType} options={["รถบริษัท", "รถร่วม"]}
              onChange={(v) => set("fleetType", v as FleetType)}
            />
          </Field>
          <Field label="ชนิดรถ">
            <Select
              value={rec.vehicle} options={REF.vehicles.map((v) => v.name)}
              onChange={(v) =>
                setRec((r) => ({
                  ...r, vehicle: v,
                  capacity: REF.vehicles.find((x) => x.name === v)?.capacityKg ?? r.capacity,
                }))}
            />
          </Field>
          <Field label="วันที่ปล่อยรถ" wide>
            <ThaiDateInput value={rec.releaseDate} onChange={(v) => set("releaseDate", v)} />
          </Field>
          <Field label="ความจุ (กก.)">
            <input type="number" value={rec.capacity || ""} onChange={num("capacity")} />
          </Field>
          <Field label="น้ำหนักบรรทุกจริง (กก.)">
            <input type="number" value={rec.loadActual || ""} onChange={num("loadActual")} />
          </Field>
          <Field label="เที่ยวเปล่า">
            <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input
                type="checkbox" checked={rec.emptyLeg}
                onChange={(e) => set("emptyLeg", e.target.checked)}
              />
              <span className="muted">วิ่งเที่ยวเปล่า ไม่มีสินค้า</span>
            </label>
          </Field>
        </div>
      </fieldset>

      {/* ───── โซนฝ่ายบัญชี ───── */}
      <fieldset
        className={"card zone" + (canEdit("account") ? " zone-mine" : "")}
        disabled={!canEdit("account")}
      >
        <h2>🧾 ค่าใช้จ่าย <span className="muted">· ฝ่ายบัญชีการเงิน</span></h2>

        <label style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
          <input
            type="checkbox" checked={rec.fuelAutoOn}
            onChange={(e) => set("fuelAutoOn", e.target.checked)}
          />
          <span>
            บวกค่าน้ำมันที่คำนวณอัตโนมัติ{" "}
            <span className="muted">
              ({rec.dist || 0} กม. × {calc.auto.rate.toFixed(5)} × {calc.auto.price.toFixed(2)} บ./ล.
              = <b>{baht(calc.auto.cost)}</b> บาท)
            </span>
          </span>
        </label>

        <div className="grid">
          {COST_FIELDS.map(([k, label]) => (
            <Field key={String(k)} label={label}>
              <input type="number" value={(rec[k] as number) || ""} onChange={num(k)} />
            </Field>
          ))}
        </div>

        <h3 style={{ fontSize: 14, marginTop: 18, marginBottom: 8, color: "var(--red)" }}>
          ต้นทุนสูญเปล่า
        </h3>
        <div className="grid">
          {WASTE_FIELDS.map(([k, label]) => (
            <Field key={String(k)} label={label}>
              <input type="number" value={(rec[k] as number) || ""} onChange={num(k)} />
            </Field>
          ))}
        </div>

        <p className="muted" style={{ fontSize: 12, marginBottom: 0, marginTop: 12 }}>
          ค่าซ่อมแซมคิดจากประเภทรถ × ชนิดรถ × ระยะทาง ไม่ต้องกรอก —{" "}
          ตามเวลา {baht(calc.repair.fixed)}
          {!calc.repair.hasFix && <span> (ไม่มีในตาราง)</span>} + ตามระยะทาง{" "}
          {baht(calc.repair.varCost)}
          {!calc.repair.hasVar && <span> (ไม่มีในตาราง)</span>}
        </p>
      </fieldset>

      {/* ───── ลูกหนี้ (ฝ่ายบริการลูกค้าเปิด ฝ่ายบัญชีดูแลต่อ) ───── */}
      <fieldset
        className={"card zone" + (canEdit("cs") ? " zone-mine" : "")}
        disabled={!canEdit("cs")}
      >
        <h2>รายการลูกหนี้ <span className="muted">· {pay.count} ราย · {pay.status}</span></h2>

        {rec.bills.map((b, i) => (
          <div key={i} className="grid" style={{ borderTop: i ? "1px solid var(--line)" : "none", paddingTop: i ? 12 : 0, marginBottom: 12 }}>
            <Field label="เลขที่บิล">
              <input value={b.no} onChange={(e) => setBill(i, { no: e.target.value })} />
            </Field>
            <Field label="ประเภทสินค้า">
              <input value={b.goodsType} onChange={(e) => setBill(i, { goodsType: e.target.value })} />
            </Field>
            <Field label="ผู้ส่ง">
              <input value={b.sender} onChange={(e) => setBill(i, { sender: e.target.value })} />
            </Field>
            <Field label="ผู้รับ">
              <input value={b.receiver} onChange={(e) => setBill(i, { receiver: e.target.value })} />
            </Field>
            <Field label="จำนวน">
              <input type="number" value={b.qty || ""} onChange={(e) => setBill(i, { qty: parseFloat(e.target.value) || 0 })} />
            </Field>
            <Field label="ราคารวม">
              <input type="number" value={b.total || ""} onChange={(e) => setBill(i, { total: parseFloat(e.target.value) || 0 })} />
            </Field>
            <Field label="ราคา/หน่วย">
              <input type="number" value={b.unitPrice ?? ""} onChange={(e) => setBill(i, { unitPrice: parseFloat(e.target.value) || null })} />
            </Field>
            <Field label="เกณฑ์คิดราคา">
              <input value={b.pricingType ?? ""} onChange={(e) => setBill(i, { pricingType: e.target.value })} />
            </Field>
            <Field label="ประเภทการชำระเงิน">
              <Select
                value={b.payType} options={[...PAY_TYPES]}
                onChange={(v) => setBill(i, { payType: v as PayType })}
              />
            </Field>
            <Field label=" ">
              <button
                type="button"
                onClick={() => setRec((r) => ({ ...r, bills: r.bills.filter((_, j) => j !== i) }))}
              >
                ลบบิลนี้
              </button>
            </Field>
          </div>
        ))}

        <button type="button" onClick={() => setRec((r) => ({ ...r, bills: [...r.bills, emptyBill()] }))}>
          + เพิ่มบิล
        </button>
      </fieldset>

      {/* ───── สรุป ───── */}
      <div className="card">
        <h2>สรุปผล</h2>
        <div className="grid">
          <Stat label="รายได้" value={baht(rec.revenue)} />
          <Stat label="ต้นทุนปกติ" value={baht(calc.normal)} />
          <Stat label="ต้นทุนสูญเปล่า" value={baht(calc.waste)} tone="var(--red)" />
          <Stat
            label="กำไร/ขาดทุน" value={baht(calc.profit)}
            tone={calc.profit >= 0 ? "var(--green)" : "var(--red)"}
          />
        </div>

        <table style={{ marginTop: 14 }}>
          <tbody>
            <tr><td>ค่าน้ำมันเหมา</td><td className="n">{baht(calc.fuelSum)}</td></tr>
            <tr><td>ค่าแรง</td><td className="n">{baht(calc.labor)}</td></tr>
            <tr><td>ค่าธรรมเนียม</td><td className="n">{baht(calc.fees)}</td></tr>
            <tr><td>ค่าซ่อมแซม</td><td className="n">{baht(calc.repair.total)}</td></tr>
            <tr><td className="muted">รวมค่าใช้จ่าย (คอลัมน์ของชีต ไม่รวมค่าซ่อม)</td><td className="n muted">{baht(calc.sheetTotal)}</td></tr>
          </tbody>
        </table>

        <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 16, flexWrap: "wrap" }}>
          <button type="button" onClick={onSave} disabled={busy}>
            บันทึกในฐานะ {ROLES[role].label}
          </button>
          <button type="button" onClick={() => { setRec(emptyRecord()); setMsg(null); }}>
            เริ่มใบใหม่
          </button>
          {msg && <span style={{ color: tone[msg.tone] }}>{msg.text}</span>}
        </div>
      </div>
    </>
  );
}

function Field({ label, children, wide }: {
  label: string; children: React.ReactNode; wide?: boolean;
}) {
  return (
    <label className={"field" + (wide ? " field-wide" : "")}>
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}

function Select({ value, options, onChange }: {
  value: string; options: readonly string[]; onChange: (v: string) => void;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">— เลือก —</option>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="stat">
      <div className="label">{label}</div>
      <div className="value" style={tone ? { color: tone } : undefined}>{value}</div>
    </div>
  );
}
