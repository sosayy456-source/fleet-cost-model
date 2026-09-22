/**
 * หน้า "จัดรถ" ของฝ่ายเจ้าหน้าที่จัดรถ — สเปก "ปรับปรุงโมเดล" (22 ก.ย. 2569)
 *
 * รับบิลที่ฝ่ายบริการลูกค้ากรอกไว้ (สถานะ "รอจัดรถ") มารวมเข้ารถคันเดียวกัน
 *   1. ตารางบิลรอจัดรถ + ตัวกรอง วันที่รับสินค้า · สาขา · ต้นทาง · ปลายทาง · กลุ่มบริการ
 *   2. ติ๊กเลือกบิล → ระบบรวม น้ำหนัก/ปริมาตร/รายได้/จำนวนลูกค้า ให้เอง
 *   3. เลือกรถ (ทะเบียนที่สถานะ "ใช้งาน" เท่านั้น) → น้ำหนัก/ปริมาณบรรทุกจริงมาจากบิลที่เลือก
 *      **ใช้ฝั่งที่เต็มกว่า** ระหว่างน้ำหนักกับปริมาตรในการคิด Load Factor
 *   4. เกินความจุรถ = กดยืนยันไม่ได้ (บล็อกทั้งสองฝั่ง)
 *   5. กด "ยืนยันการจัดรถ" → ออกเลขที่ใบรายการ 13 หลัก สร้างใบรายการให้ แล้วประทับเลขกลับลงบิล
 *
 * กล่องสรุปแสดง กำไร · รายได้ (รวมทุกบิล) · ต้นทุนพยากรณ์ — กรอบเขียวเมื่อกำไร แดงเมื่อขาดทุน
 * (ต้นทุนพยากรณ์ = ค่าเฉลี่ยข้อมูลเก่า N เดือนล่าสุด ตามเส้นทาง × ชนิดรถ ดู lib/forecast/)
 */
import { useEffect, useMemo, useState } from "react";
import { REF, canonicalVehicleName, distanceFor } from "../../lib/refdata";
import { vehicleSpec } from "../../lib/refdata/vehicleSpecs";
import { useOverrides } from "../../lib/store/overrides";
import { useRoster } from "../../lib/store/roster";
import { useBills } from "../../lib/store/bills";
import { loadCostRev } from "../../lib/data/useCostRev";
import { buildForecast, forecastFor } from "../../lib/forecast/forecast";
import type { ForecastResult, ForecastTable } from "../../lib/forecast/forecast";
import { newDocNo } from "../../lib/bill/number";
import { genId, nowStamp, thDateSafe, todayISO } from "../../lib/record/date";
import { emptyRecord } from "../entry/emptyRecord";
import { saveRecord } from "../../lib/store/save";
import { stampRole } from "../../lib/record/roles";
import GrowBox from "../../lib/ui/GrowBox";
import type { RecordsState } from "../../lib/store/useRecords";
import type { FleetType } from "../../lib/cost/types";
import type { RoleKey } from "../../types/record";

const baht = (v: number): string => Math.round(v).toLocaleString("th-TH");
const num3 = (v: number): string => v.toLocaleString("th-TH", { maximumFractionDigits: 3 });

interface Filter { date: string; branch: string; origin: string; dest: string; group: string }
const F0: Filter = { date: "", branch: "", origin: "", dest: "", group: "" };

const uniq = (xs: string[]): string[] => [...new Set(xs.filter(Boolean))].sort((a, b) => a.localeCompare(b, "th"));

export default function DispatchPage({ state, role }: { state: RecordsState; role: RoleKey }) {
  const bills = useBills();
  const [roster] = useRoster();
  const [ovr] = useOverrides();
  const [f, setF] = useState<Filter>(F0);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [plate, setPlate] = useState("");
  const [releaseDate, setReleaseDate] = useState(todayISO());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; tone: "ok" | "err" } | null>(null);
  /** ตารางค่าเฉลี่ยต้นทุนจากข้อมูลเก่า — โหลดครั้งเดียวตอนเปิดหน้า */
  const [fc, setFc] = useState<ForecastTable | null>(null);

  useEffect(() => {
    let alive = true;
    loadCostRev()
      .then((d) => { if (alive) setFc(buildForecast(d.trips)); })
      .catch(() => { /* ไม่มีไฟล์ต้นทุนก็แค่ไม่มีตัวเลขพยากรณ์ ไม่ใช่ข้อผิดพลาดของการจัดรถ */ });
    return () => { alive = false; };
  }, []);

  const waiting = useMemo(() => bills.bills.filter((b) => b.status === "รอจัดรถ"), [bills.bills]);
  const rows = useMemo(() => waiting.filter((b) =>
    (!f.date || b.date === f.date) && (!f.branch || b.branch === f.branch)
    && (!f.origin || b.origin === f.origin) && (!f.dest || b.dest === f.dest)
    && (!f.group || b.serviceGroup === f.group)), [waiting, f]);

  const chosen = useMemo(() => waiting.filter((b) => picked.has(b.id)), [waiting, picked]);
  const sum = useMemo(() => ({
    bills: chosen.length,
    customers: new Set(chosen.flatMap((b) => [b.sender, b.receiver]).filter(Boolean)).size,
    weight: Math.round(chosen.reduce((s, b) => s + b.weight, 0) * 100) / 100,
    volume: Math.round(chosen.reduce((s, b) => s + b.volume, 0) * 10_000) / 10_000,
    revenue: Math.round(chosen.reduce((s, b) => s + b.total, 0) * 100) / 100,
  }), [chosen]);

  /* ---------- รถที่เลือก ---------- */
  const usable = useMemo(() => roster.filter((v) => v.status === "ใช้งาน"), [roster]);
  const truck = usable.find((v) => v.plate === plate) ?? null;
  const kind = truck ? canonicalVehicleName(truck.vehicle) : "";
  const spec = vehicleSpec(REF.vehicles.find((v) => v.name === kind), ovr.vehicleSpecs);
  const capKg = spec?.capacityKg ?? 0;
  const capM3 = spec?.volumeM3 ?? 0;

  /** ฝั่งที่เต็มกว่า — ใช้คิด Load Factor และใช้บล็อกการยืนยัน */
  const useWeight = capKg > 0 ? sum.weight / capKg : 0;
  const useVolume = capM3 > 0 ? sum.volume / capM3 : 0;
  const binding = useWeight >= useVolume ? "น้ำหนัก" : "ปริมาตร";
  const loadFactor = Math.max(useWeight, useVolume) * 100;
  const overWeight = capKg > 0 && sum.weight > capKg;
  const overVolume = capM3 > 0 && sum.volume > capM3;

  /* ---------- เส้นทางของเที่ยว ---------- */
  const origins = uniq(chosen.map((b) => b.origin));
  const dests = uniq(chosen.map((b) => b.dest));
  const origin = origins[0] ?? "";
  const dest = dests[dests.length - 1] ?? "";
  const mixedRoute = origins.length > 1 || dests.length > 1;

  const forecast: ForecastResult | null = fc && origin && dest && kind
    ? forecastFor(fc, origin, dest, kind) : null;
  const profit = forecast ? sum.revenue - forecast.cost : null;

  const blocked = !chosen.length ? "ยังไม่ได้เลือกบิล"
    : !truck ? "ยังไม่ได้เลือกทะเบียนรถ"
    : overWeight ? `น้ำหนักรวม ${baht(sum.weight)} กก. เกินความจุรถ ${baht(capKg)} กก.`
    : overVolume ? `ปริมาตรรวม ${num3(sum.volume)} ลบ.ม. เกินความจุรถ ${num3(capM3)} ลบ.ม.`
    : !releaseDate ? "ยังไม่ได้เลือกวันปล่อยรถ"
    : "";

  const toggle = (id: string) => setPicked((s) => {
    const next = new Set(s);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const allShown = rows.length > 0 && rows.every((b) => picked.has(b.id));

  async function confirmDispatch() {
    if (blocked || !truck) return;
    setBusy(true);
    setMsg(null);
    try {
      // เลขที่ใบรายการ 13 หลัก — กันซ้ำกับใบที่มีอยู่ทั้งในเครื่องและบนชีต รวมถึงบิลที่จัดรถไปแล้ว
      const used = [...state.records.map((r) => r.docNo), ...bills.bills.map((b) => b.docNo)].filter(Boolean);
      const docNo = newDocNo(releaseDate, used);

      const rec = {
        ...emptyRecord(),
        id: genId(), docNo,
        date: chosen[0]!.date, branch: chosen[0]!.branch,
        origin, dest,
        dist: distanceFor(origin, dest) ?? 0,
        serviceGroup: chosen[0]!.serviceGroup,
        revenue: sum.revenue,
        // บิลของใบนี้ — แปลงจากบิลที่เลือกให้ตรงกับรูปแบบเดิมของ TripRecord.bills
        bills: chosen.map((b) => ({
          no: b.no, goodsType: b.serviceGroup, sender: b.sender, receiver: b.receiver,
          origin: b.origin, dest: b.dest, qty: b.qty, total: b.total,
          payType: b.payType as never, paid: false, payDate: null,
          unitPrice: b.unitPrice, pricingType: b.pricingType,
        })),
        plate: truck.plate,
        fleetType: (truck.fleetType || "") as FleetType | "",
        vehicle: kind,
        releaseDate,
        // ความจุกับน้ำหนักบรรทุกจริงมาจากบิลที่เลือก ไม่ต้องกรอกเอง (สเปกข้อ "แก้ น้ำหนัก/ปริมาณบรรทุกจริง")
        capacity: capKg,
        loadActual: sum.weight,
      };
      stampRole(rec, "cs");        // ข้อมูลฝั่งลูกค้ามาจากบิลที่ CS กรอกไว้แล้ว
      stampRole(rec, "dispatch");
      rec._v2 = true; rec._v3 = true; rec._v4 = true; rec._v5 = true;

      await saveRecord(rec as never, { role, overrides: ovr });
      // ประทับเลขที่ใบรายการกลับลงบิลทุกใบที่เลือก แล้วเปลี่ยนสถานะ
      await bills.save(chosen.map((b) => ({ ...b, status: "จัดรถแล้ว" as const, docNo, updatedAt: nowStamp() })));
      state.reload();
      setPicked(new Set());
      setMsg({ text: `จัดรถแล้ว — ใบรายการ ${docNo} · ${chosen.length} บิล · ${truck.plate}`, tone: "ok" });
    } catch (e) {
      setMsg({ text: `จัดรถไม่สำเร็จ: ${(e as Error).message}`, tone: "err" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {!bills.connected && (
        <div className="banner">
          ยังไม่ได้เชื่อม Google Sheet — เห็นเฉพาะบิลที่กรอกจากเครื่องนี้
        </div>
      )}

      <div className="card">
        <div className="card-h">
          <span className="step">1</span><h2>บิลที่รอจัดรถ</h2>
          <span className="hint">{rows.length} บิล{rows.length !== waiting.length ? ` จากทั้งหมด ${waiting.length}` : ""} · ติ๊กเลือกบิลที่จะไปด้วยกัน</span>
        </div>

        <div className="dz-filters">
          <div className="ff"><label>วันที่รับสินค้า</label>
            <select value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })}>
              <option value="">ทุกวัน</option>
              {uniq(waiting.map((b) => b.date)).map((d) => <option key={d} value={d}>{thDateSafe(d)}</option>)}
            </select></div>
          <div className="ff"><label>สาขา</label>
            <select value={f.branch} onChange={(e) => setF({ ...f, branch: e.target.value })}>
              <option value="">ทุกสาขา</option>
              {uniq(waiting.map((b) => b.branch)).map((x) => <option key={x} value={x}>{x}</option>)}
            </select></div>
          <div className="ff"><label>ต้นทาง</label>
            <select value={f.origin} onChange={(e) => setF({ ...f, origin: e.target.value })}>
              <option value="">ทุกต้นทาง</option>
              {uniq(waiting.map((b) => b.origin)).map((x) => <option key={x} value={x}>{x}</option>)}
            </select></div>
          <div className="ff"><label>ปลายทาง</label>
            <select value={f.dest} onChange={(e) => setF({ ...f, dest: e.target.value })}>
              <option value="">ทุกปลายทาง</option>
              {uniq(waiting.map((b) => b.dest)).map((x) => <option key={x} value={x}>{x}</option>)}
            </select></div>
          <div className="ff"><label>ประเภทสินค้า</label>
            <select value={f.group} onChange={(e) => setF({ ...f, group: e.target.value })}>
              <option value="">ทุกกลุ่มบริการ</option>
              {uniq(waiting.map((b) => b.serviceGroup)).map((x) => <option key={x} value={x}>{x}</option>)}
            </select></div>
          <button type="button" className="dh-clear" onClick={() => setF(F0)}>↺ ล้างตัวกรอง</button>
        </div>

        {bills.loading ? <p className="muted">กำลังโหลดบิล…</p>
          : rows.length === 0 ? <p className="muted">ไม่มีบิลที่รอจัดรถตามตัวกรองที่เลือก</p>
          : (
            <GrowBox rows={rows} render={(shown) => (
              <table className="tbl dispatch-tbl">
                <thead><tr>
                  <th><input type="checkbox" checked={allShown} title="เลือกทั้งหมดที่เห็น"
                    onChange={() => setPicked((s) => {
                      const next = new Set(s);
                      if (allShown) rows.forEach((b) => next.delete(b.id));
                      else rows.forEach((b) => next.add(b.id));
                      return next;
                    })} /></th>
                  <th>วันที่บิล</th><th>เลขที่บิล</th><th>ลูกค้า</th><th>ต้นทาง</th><th>ปลายทาง</th>
                  <th>กลุ่มบริการ</th><th className="n">น้ำหนัก (กก.)</th><th className="n">ปริมาตร (ลบ.ม.)</th>
                  <th className="n">ราคารวม</th>
                </tr></thead>
                <tbody>
                  {shown.map((b) => (
                    <tr key={b.id} className={picked.has(b.id) ? "on" : undefined} onClick={() => toggle(b.id)}>
                      <td><input type="checkbox" checked={picked.has(b.id)} onChange={() => toggle(b.id)}
                        onClick={(e) => e.stopPropagation()} /></td>
                      <td>{thDateSafe(b.date)}</td>
                      <td><b>{b.no}</b></td>
                      <td>{b.sender} → {b.receiver}</td>
                      <td>{b.origin}</td>
                      <td>{b.dest}</td>
                      <td>{b.serviceGroup}</td>
                      <td className="n">{baht(b.weight)}</td>
                      <td className="n">{num3(b.volume)}</td>
                      <td className="n">{baht(b.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )} />
          )}
      </div>

      <div className="card">
        <div className="card-h">
          <span className="step">2</span><h2>เลือกรถและยืนยัน</h2>
          <span className="hint">เลือกได้เฉพาะทะเบียนที่สถานะ "ใช้งาน" ({usable.length} คัน)</span>
        </div>

        <div className="bill-grid">
          <div className="f"><label>ทะเบียนรถ</label>
            <select value={plate} onChange={(e) => setPlate(e.target.value)}>
              <option value="">เลือกทะเบียน</option>
              {usable.map((v) => (
                <option key={v.plate} value={v.plate}>{v.plate} · {v.vehicle} ({v.fleetType})</option>
              ))}
            </select></div>
          <div className="f"><label>ชนิดรถ</label>
            <input value={kind || "—"} readOnly tabIndex={-1} /></div>
          <div className="f"><label>ประเภทรถ</label>
            <input value={truck?.fleetType || "—"} readOnly tabIndex={-1} /></div>
          <div className="f"><label>วันปล่อยรถ</label>
            <input type="date" value={releaseDate} onChange={(e) => setReleaseDate(e.target.value)} /></div>
        </div>

        <div className="dispatch-sum">
          <div><span>จำนวนบิล</span><b>{sum.bills}</b></div>
          <div><span>จำนวนลูกค้า</span><b>{sum.customers}</b></div>
          <div><span>น้ำหนักรวม</span><b>{baht(sum.weight)} <small>กก.</small></b></div>
          <div><span>ปริมาตรรวม</span><b>{num3(sum.volume)} <small>ลบ.ม.</small></b></div>
          <div><span>รายได้รวม</span><b>{baht(sum.revenue)} <small>บาท</small></b></div>
        </div>

        {truck && (
          <div className={"dispatch-load" + (overWeight || overVolume ? " over" : "")}>
            <div className="lf">Load Factor <b>{loadFactor.toFixed(1)}%</b>
              <small> คิดจากฝั่ง{binding} (ฝั่งที่เต็มกว่า)</small></div>
            <div className="cap">
              น้ำหนัก {baht(sum.weight)} / {baht(capKg)} กก. ({(useWeight * 100).toFixed(1)}%) ·
              ปริมาตร {num3(sum.volume)} / {num3(capM3)} ลบ.ม. ({(useVolume * 100).toFixed(1)}%)
            </div>
            {(overWeight || overVolume) && <div className="bill-bad">⚠ เกินความจุรถ — เอาบิลออกหรือเปลี่ยนคันก่อนจึงจะยืนยันได้</div>}
            {capKg === 0 && capM3 === 0 && (
              <div className="bill-bad">⚠ ยังไม่มีสเปกความจุของ "{kind}" ในระบบ — ตั้งค่าได้ที่หน้าการตั้งค่า</div>
            )}
          </div>
        )}

        {/* กล่องสรุปผล — แทนกล่องต้นทุนเดิม ใช้ต้นทุนพยากรณ์จากข้อมูลเก่า */}
        <div className={"dispatch-result " + (profit == null ? "" : profit >= 0 ? "good" : "bad")}>
          <div className="box"><span>กำไร (ประมาณการ)</span>
            <b>{profit == null ? "—" : `${baht(profit)} บาท`}</b></div>
          <div className="box"><span>รายได้ (รวมทุกบิล)</span><b>{baht(sum.revenue)} บาท</b></div>
          <div className="box"><span>ต้นทุนพยากรณ์</span>
            <b>{forecast ? `${baht(forecast.cost)} บาท` : "—"}</b></div>
        </div>
        <div className="price-note">
          {forecast
            ? <>ต้นทุนพยากรณ์จากค่าเฉลี่ยข้อมูลเก่า <b>{forecast.n}</b> เที่ยว ({forecast.note}) ·
                ช่วง {forecast.from} – {forecast.to} · ตั้งจำนวนเดือนได้ที่หน้าการตั้งค่า</>
            : "เลือกบิลและรถให้ครบเพื่อคำนวณต้นทุนพยากรณ์ (ใช้ค่าเฉลี่ยข้อมูลเก่าตามเส้นทางและชนิดรถ)"}
          {mixedRoute && <> · <b>บิลที่เลือกมีหลายเส้นทาง</b> — ใบรายการจะใช้ {origin}–{dest} เป็นเส้นทางหลัก</>}
        </div>

        {msg && <div className={"save-msg " + (msg.tone === "ok" ? "ok" : "err")}>{msg.text}</div>}

        <div className="bill-actions">
          {blocked && <span className="muted">{blocked}</span>}
          <button type="button" className="btn-primary" disabled={!!blocked || busy} onClick={confirmDispatch}>
            {busy ? "กำลังสร้างใบรายการ…" : "ยืนยันการจัดรถ"}
          </button>
        </div>
      </div>
    </>
  );
}
