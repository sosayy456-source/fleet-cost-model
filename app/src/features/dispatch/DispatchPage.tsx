/**
 * หน้า "จัดรถ" ของฝ่ายเจ้าหน้าที่จัดรถ — สเปก "ปรับปรุงโมเดล" (22 ก.ย. 2569)
 *
 * รับบิลที่ฝ่ายบริการลูกค้ากรอกไว้ (สถานะ "รอจัดรถ") มารวมเข้ารถคันเดียวกัน
 *   1. ตารางบิลรอจัดรถ + ตัวกรอง วันที่รับสินค้า · สาขา · ต้นทาง · ปลายทาง · กลุ่มบริการ
 *   2. ติ๊กเลือกบิล → ระบบรวม น้ำหนัก/ปริมาตร/รายได้/จำนวนลูกค้า ให้เอง
 *      ติ๊กบิลแรกแล้ว ตารางเหลือเฉพาะบิลต้นทางเดียวกัน ปลายทางเดียวกันหรืออยู่ระหว่างทาง (lib/route/enRoute.ts)
 *      ข้างตารางบิลมีกล่อง "สถานะการบรรทุก" (LoadTruck.tsx) รูปรถเติมของตามบิลที่ติ๊ก + หลอด Load Factor
 *   3. เลือกรถ ประเภทรถ → ชนิดรถ → ทะเบียน (ทะเบียนที่สถานะ "ใช้งาน" เท่านั้น · ชุดช่องเดียวกับหางพ่วง)
 *      → น้ำหนัก/ปริมาณบรรทุกจริงมาจากบิลที่เลือก
 *      **ใช้ฝั่งที่เต็มกว่า** ระหว่างน้ำหนักกับปริมาตรในการคิด Load Factor
 *   4. เกินความจุรถ = กดยืนยันไม่ได้ (บล็อกทั้งสองฝั่ง)
 *      หางพ่วง (ทะเบียนรถคันที่ 2) เลือกเพิ่มได้ ไม่บังคับ — ความจุ = หัว + หาง รวมกัน (เจ้าของงานเคาะ 24 ก.ย. 2569)
 *      ช่องหางแสดงเฉพาะชนิดรถที่เป็นหาง ส่วนช่องหัวไม่มีหางให้เลือก · ต้นทุนพยากรณ์ยังคิดตามชนิดรถของหัว
 *   5. กด "ยืนยันการจัดรถ" → ออกเลขที่ใบรายการ 13 หลัก สร้างใบรายการให้ แล้วประทับเลขกลับลงบิล
 *
 * กล่องสรุปแสดง กำไร · รายได้ (รวมทุกบิล) · ต้นทุนพยากรณ์ — กรอบเขียวเมื่อกำไร แดงเมื่อขาดทุน
 * (ต้นทุนพยากรณ์ = ค่าเฉลี่ยข้อมูลเก่า N เดือนล่าสุด ตามเส้นทาง × ชนิดรถ ดู lib/forecast/)
 * ต้นทุนพยากรณ์แยกรายบิล (27 ก.ย. 2569 เจ้าของงานสั่ง) = ปันต้นทุนพยากรณ์ของเที่ยวเข้าบิลที่ติ๊ก ด้วยสูตรเดียวกับ ETL ปันส่วน
 *   (lib/alloc/tripAlloc.ts · CF จากความจุหัว + หางที่เลือก) — แสดงอย่างเดียว ไม่บันทึกลงใบ
 *
 * ★ การจัดรถต้องไม่ค้างครึ่งทาง (แก้ 23 ก.ย. 2569 — เดิมสร้างใบในเครื่องแล้วพังตอนส่งชีต
 *   บิลยังรอจัดรถ กดซ้ำได้ใบซ้ำ คนขับเห็นงานเกิน) กันไว้สามชั้น:
 *     1. ยังไม่เชื่อมชีต = กดยืนยันไม่ได้ (ฝ่ายอื่นต้องเห็นใบ และบิลต้องไม่ถูกเครื่องอื่นจัดซ้ำ)
 *     2. สร้างใบรายการไม่สำเร็จ = ลบใบที่ saveRecord เขียนลงเครื่องไปแล้วทิ้ง บิลคงสถานะเดิม กดใหม่ได้
 *     3. ใบสร้างแล้วแต่สถานะบิลไปไม่ถึงชีต = splitStuckBills() ซ่อนบิลนั้นจากรายการที่จัดได้
 *        แล้วมีแถบให้กดอัปเดตสถานะ (useBills ก็ลองส่งบิลที่ค้างให้เองทุกครั้งที่เปิดหน้า)
 */
import { useEffect, useMemo, useState } from "react";
import { ACTIVE_VEHICLE_NAMES, REF, TRAILER_VEHICLE_NAMES, costFleetType, distanceFor } from "../../lib/refdata";
import { vehicleSpec } from "../../lib/refdata/vehicleSpecs";
import { useOverrides } from "../../lib/store/overrides";
import { useRoster } from "../../lib/store/roster";
import { loadStats } from "../../lib/dispatch/load";
import { onRouteOf, stopsFor, useEnRoute } from "../../lib/route/enRoute";
import { LoadTruckPanel } from "./LoadTruck";
import { DEFAULT_PICTURE_KIND } from "./TruckPicture";
import { P0, VehiclePickFields, roleKind } from "./VehiclePick";
import type { VehiclePick } from "./VehiclePick";
import { useBills } from "../../lib/store/bills";
import { loadCostRev } from "../../lib/data/useCostRev";
import { COST_PART_LABELS, buildForecast, forecastFor } from "../../lib/forecast/forecast";
import { allocateTrip, conversionFactor } from "../../lib/alloc/tripAlloc";
import type { AllocResult } from "../../lib/alloc/tripAlloc";
import { pendingAllocItems } from "../../lib/alloc/recordAlloc";
import type { ForecastResult, ForecastTable } from "../../lib/forecast/forecast";
import { newDocNo } from "../../lib/bill/number";
import { genId, nowStamp, thDateSafe, todayISO } from "../../lib/record/date";
import { emptyRecord } from "../entry/emptyRecord";
import { saveRecord } from "../../lib/store/save";
import { remove as removeRecord } from "../../lib/store/records";
import { splitStuckBills } from "../../lib/bill/reconcile";
import { stampRole } from "../../lib/record/roles";
import GrowBox from "../../lib/ui/GrowBox";
import TruckLoader from "../../lib/ui/TruckLoader";
import type { RecordsState } from "../../lib/store/useRecords";
import type { RoleKey } from "../../types/record";
import type { PendingBill } from "../../types/bill";
import { randomDispatch } from "./randomDispatch";

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
  const [releaseDate, setReleaseDate] = useState(todayISO());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; tone: "ok" | "warn" | "err" } | null>(null);
  /** ตารางค่าเฉลี่ยต้นทุนจากข้อมูลเก่า — โหลดครั้งเดียวตอนเปิดหน้า */
  const [fc, setFc] = useState<ForecastTable | null>(null);

  useEffect(() => {
    let alive = true;
    loadCostRev()
      .then((d) => { if (alive) setFc(buildForecast(d.trips)); })
      .catch(() => { /* ไม่มีไฟล์ต้นทุนก็แค่ไม่มีตัวเลขพยากรณ์ ไม่ใช่ข้อผิดพลาดของการจัดรถ */ });
    return () => { alive = false; };
  }, []);

  /** บิลรอจัดรถ แยกออกเป็นที่จัดได้จริง กับที่อยู่ในใบรายการแล้ว (จัดรถค้างครึ่งทาง — ดูหัวไฟล์ข้อ 3) */
  const { free: waiting, stuck } = useMemo(() => splitStuckBills(
    bills.bills.filter((b) => b.status === "รอจัดรถ"), state.records), [bills.bills, state.records]);
  /* ---------- ล็อกเส้นทางตามบิลแรก (เจ้าของงานสั่ง 24 ก.ย. 2569) ----------
     ติ๊กบิลแรกแล้ว ตารางเหลือเฉพาะบิลต้นทางเดียวกัน ที่ปลายทางเดียวกันหรืออยู่ระหว่างทาง (lib/route/enRoute.ts)
     บิลแรก = บิลที่ติ๊กก่อนสุดที่ยังติ๊กอยู่ (Set เก็บตามลำดับที่ใส่) · เอาติ๊กออกหมด = กลับมาเห็นทุกบิล */
  const [enRoute] = useEnRoute();
  const anchor = useMemo(() => {
    for (const id of picked) {
      const b = waiting.find((x) => x.id === id);
      if (b) return b;
    }
    return null;
  }, [picked, waiting]);
  const rows = useMemo(() => waiting.filter((b) =>
    (!f.date || b.date === f.date) && (!f.branch || b.branch === f.branch)
    && (!f.origin || b.origin === f.origin) && (!f.dest || b.dest === f.dest)
    && (!f.group || b.serviceGroup === f.group)
    && (!anchor || onRouteOf(anchor, b, enRoute))), [waiting, f, anchor, enRoute]);
  const anchorStops = anchor ? stopsFor(anchor.origin, anchor.dest, enRoute) : [];

  const chosen = useMemo(() => waiting.filter((b) => picked.has(b.id)), [waiting, picked]);
  const sum = useMemo(() => ({
    bills: chosen.length,
    customers: new Set(chosen.flatMap((b) => [b.sender, b.receiver]).filter(Boolean)).size,
    /** จำนวนสินค้า (ชิ้น) = ช่อง "จำนวน" ของบิลที่ CS กรอก */
    qty: Math.round(chosen.reduce((s, b) => s + b.qty, 0) * 100) / 100,
    weight: Math.round(chosen.reduce((s, b) => s + b.weight, 0) * 100) / 100,
    volume: Math.round(chosen.reduce((s, b) => s + b.volume, 0) * 10_000) / 10_000,
    revenue: Math.round(chosen.reduce((s, b) => s + b.total, 0) * 100) / 100,
  }), [chosen]);

  /* ---------- รถที่เลือก ---------- */
  const usable = useMemo(() => roster.filter((v) => v.status === "ใช้งาน"), [roster]);
  /* ---------- รถหัว — เลือก ประเภท → ชนิด → ทะเบียน (แทนกล่องค้นหารถเดิม · เจ้าของงานสั่ง 24 ก.ย. 2569) ---------- */
  const [hp, setHp] = useState<VehiclePick>(P0);
  const [tp, setTp] = useState<VehiclePick>(P0);
  /** ช่องหางพ่วงซ่อนไว้จนกว่าจะกด "+ เพิ่มหางพ่วง" (เจ้าของงานขอ 27 ก.ย. 2569 — เดิมโชว์ตลอดแล้วเกะกะ) */
  const [trailerOpen, setTrailerOpen] = useState(false);
  const closeTrailer = () => { setTp(P0); setTrailerOpen(false); };
  /** รถที่เป็นหัวได้ — ตัดคันที่เป็นหางล้วน และคันที่เลือกเป็นหางอยู่ */
  const heads = useMemo(() => usable.filter((v) => roleKind(v, false) && v.plate !== tp.plate), [usable, tp.plate]);
  const truck = heads.find((v) => v.plate === hp.plate) ?? null;
  const kind = truck ? hp.vehicle : "";
  const spec = vehicleSpec(REF.vehicles.find((v) => v.name === kind), ovr.vehicleSpecs);

  /* ---------- หางพ่วง (ทะเบียนรถคันที่ 2) — ชุดช่องเดียวกับหัว · ไม่บังคับ ---------- */
  const trailersAll = useMemo(() => usable.filter((v) => roleKind(v, true) && v.plate !== hp.plate), [usable, hp.plate]);
  const trailer = trailersAll.find((v) => v.plate === tp.plate) ?? null;
  const tSpec = trailer ? vehicleSpec(REF.vehicles.find((v) => v.name === tp.vehicle), ovr.vehicleSpecs) : null;
  // เลือกทะเบียนหัวเป็นคันเดียวกับหาง (คันที่วิ่งได้ทั้งสองแบบ) = ปลดหางออก
  useEffect(() => { if (tp.plate && tp.plate === hp.plate) setTp((t) => ({ ...t, plate: "" })); }, [hp.plate, tp.plate]);

  /** ความจุ = หัว + หาง รวมกัน แล้วยังใช้ฝั่งที่เต็มกว่าเหมือนเดิม (lib/dispatch/load.ts) */
  const headCap = { kg: spec?.capacityKg ?? 0, m3: spec?.volumeM3 ?? 0 };
  const tailCap = trailer ? { kg: tSpec?.capacityKg ?? 0, m3: tSpec?.volumeM3 ?? 0 } : null;
  const stats = truck ? loadStats(sum, headCap, tailCap) : null;
  const capKg = stats?.capKg ?? 0;
  const capM3 = stats?.capM3 ?? 0;
  const overWeight = !!stats?.overWeight;
  const overVolume = !!stats?.overVolume;

  /* ---------- เส้นทางของเที่ยว ---------- */
  const origins = uniq(chosen.map((b) => b.origin));
  const dests = uniq(chosen.map((b) => b.dest));
  const origin = origins[0] ?? "";
  const dest = dests[dests.length - 1] ?? "";
  const mixedRoute = origins.length > 1 || dests.length > 1;

  const forecast: ForecastResult | null = fc && origin && dest && kind
    ? forecastFor(fc, origin, dest, kind) : null;
  const profit = forecast ? sum.revenue - forecast.cost : null;
  /** ปันต้นทุนพยากรณ์เข้าบิลที่ติ๊ก — CF จากความจุรวมหัว + หาง (ตัวเดียวกับ Load Factor) */
  const billSplit = useMemo<AllocResult | null>(() => (forecast && chosen.length && truck
    ? allocateTrip(pendingAllocItems(chosen), forecast.cost, conversionFactor(capKg, capM3)) : null),
  [forecast, chosen, truck, capKg, capM3]);

  const blocked = !bills.connected ? "ยังไม่ได้เชื่อม Google Sheet — จัดรถได้เมื่อเชื่อมแล้วเท่านั้น"
    : !chosen.length ? "ยังไม่ได้เลือกบิล"
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
  const fillRandom = () => {
    const choice = randomDispatch(waiting.filter((b) => b.synced !== false), roster, ovr);
    if (!choice) {
      setMsg({ text: "ยังไม่มีบิลรอจัดรถที่จับคู่กับรถซึ่งบรรทุกได้ไม่เกิน 85%", tone: "warn" });
      return;
    }
    setF(F0);
    setPicked(new Set(choice.bills.map((b) => b.id)));
    setHp(choice.vehicle);
    closeTrailer();
    setReleaseDate(choice.bills[0]!.date > todayISO() ? choice.bills[0]!.date : todayISO());
    setMsg({ text: `สุ่มเลือก ${choice.bills.length} บิล · รถ ${choice.vehicle.plate} · Load Factor ${Math.round(choice.loadFactor)}% — ตรวจแล้วกดยืนยันการจัดรถ`, tone: "ok" });
  };
  const allShown = rows.length > 0 && rows.every((b) => picked.has(b.id));

  async function confirmDispatch() {
    if (blocked || !truck) return;
    setBusy(true);
    setMsg(null);
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
      // รถร่วมนอกพิเศษคิดต้นทุนแบบรถร่วม (costFleetType) — ใบรายการเก็บฝั่งของตารางต้นทุน
      fleetType: costFleetType(hp.fleetType),
      vehicle: kind,
      // หางพ่วงเก็บประเภทตามทะเบียนจริง (ไม่ผ่าน costFleetType) — ไม่ได้เข้าสูตรต้นทุน ใช้แสดง/ดูย้อนหลัง
      ...(trailer ? { trailerPlate: trailer.plate, trailerFleetType: tp.fleetType, trailerVehicle: tp.vehicle } : {}),
      releaseDate,
      // ความจุกับน้ำหนักบรรทุกจริงมาจากบิลที่เลือก ไม่ต้องกรอกเอง (สเปกข้อ "แก้ น้ำหนัก/ปริมาณบรรทุกจริง")
      // มีหางพ่วง = ความจุหัว + หาง
      capacity: capKg,
      loadActual: sum.weight,
    };
    stampRole(rec, "cs");        // ข้อมูลฝั่งลูกค้ามาจากบิลที่ CS กรอกไว้แล้ว
    stampRole(rec, "dispatch");
    rec._v2 = true; rec._v3 = true; rec._v4 = true; rec._v5 = true;

    // ขั้น 1: ใบรายการ — saveRecord เขียนลงเครื่องก่อนแล้วค่อยส่งชีต ถ้าล้ม ต้องลบใบในเครื่องทิ้ง
    // ไม่งั้นใบค้างอยู่ทั้งที่บิลยังรอจัดรถ กดซ้ำแล้วได้ใบซ้ำ (หัวไฟล์ข้อ 2)
    try {
      await saveRecord(rec as never, { role, overrides: ovr });
    } catch (e) {
      await removeRecord(rec.id).catch(() => { /* ไม่มีในเครื่องอยู่แล้ว */ });
      state.reload();
      setMsg({ text: `จัดรถไม่สำเร็จ — ยังไม่ได้สร้างใบรายการ บิลยังรอจัดรถเหมือนเดิม กดยืนยันใหม่ได้ · ${(e as Error).message}`, tone: "err" });
      setBusy(false);
      return;
    }

    // ขั้น 2: ประทับเลขที่ใบรายการลงบิล — saveBills ไม่โยน error ตอนส่งชีตไม่ผ่าน แต่คืน synced=false
    let billsOnSheet = false;
    try {
      const saved = await bills.save(chosen.map((b) => ({ ...b, status: "จัดรถแล้ว" as const, docNo, updatedAt: nowStamp() })));
      billsOnSheet = saved.every((b) => b.synced !== false);
    } catch {
      /* เขียนลงเครื่องก็ไม่ได้ — ใบรายการสร้างแล้ว แถบ "บิลค้าง" จะขึ้นให้ซ่อมหลังโหลดใหม่ */
    }
    state.reload();
    setPicked(new Set());
    closeTrailer();
    const done = `จัดรถแล้ว — ใบรายการ ${docNo} · ${chosen.length} บิล · ${truck.plate}${trailer ? ` + หาง ${trailer.plate}` : ""}`;
    setMsg(billsOnSheet
      ? { text: done, tone: "ok" }
      : { text: `${done} · แต่ยังส่งสถานะบิลขึ้นชีตไม่สำเร็จ — ระบบจะส่งให้อีกครั้งเมื่อเปิดหน้านี้ครั้งถัดไป เครื่องอื่นจะไม่จัดบิลนี้ซ้ำเพราะอยู่ในใบรายการแล้ว`, tone: "warn" });
    setBusy(false);
  }

  /** อัปเดตสถานะบิลที่ค้างครึ่งทางให้ตรงกับใบรายการที่บิลนั้นอยู่ */
  async function fixStuck() {
    setBusy(true);
    try {
      const saved = await bills.save(stuck.map(({ bill, docNo }) => ({ ...bill, status: "จัดรถแล้ว" as const, docNo, updatedAt: nowStamp() })));
      const ok = saved.every((b) => b.synced !== false);
      setMsg(ok ? { text: `อัปเดตสถานะบิลแล้ว ${saved.length} บิล`, tone: "ok" }
        : { text: "อัปเดตในเครื่องแล้ว แต่ยังส่งขึ้นชีตไม่สำเร็จ — ลองใหม่เมื่อเน็ตกลับมา", tone: "warn" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {!bills.connected && (
        <div className="banner">
          ยังไม่ได้เชื่อม Google Sheet — เห็นเฉพาะบิลที่กรอกจากเครื่องนี้ และยังยืนยันการจัดรถไม่ได้
          (ใบรายการต้องขึ้นชีตให้ฝ่ายอื่นเห็น และกันไม่ให้เครื่องอื่นจัดบิลเดียวกันซ้ำ)
        </div>
      )}
      {stuck.length > 0 && (
        <div className="stuck-bar">
          <span>
            มี <b>{stuck.length}</b> บิลที่อยู่ในใบรายการแล้ว แต่สถานะยังเป็น “รอจัดรถ”
            (การจัดรถครั้งก่อนบันทึกไม่ครบ) — ซ่อนไว้ไม่ให้จัดซ้ำ ·
            ใบรายการ {[...new Set(stuck.map((x) => x.docNo))].join(", ")}
          </span>
          <button type="button" className="btn-mini" disabled={busy || !bills.connected} onClick={fixStuck}>
            อัปเดตสถานะบิล
          </button>
        </div>
      )}

      {/* เลย์เอาต์หน้าจัดรถ (เจ้าของงานสั่ง 27 ก.ย. 2569 รอบสอง) — ช่องกรอก/ตัวกรอง/ตรรกะเหมือนเดิมทุกตัว
            แถว 1  ขั้นที่ 1 ตัวกรองบิล แนวยาวเต็มหน้า
            แถว 2  ซ้าย = ตารางบิล · ขวา = สถานะการบรรทุก: หัว + Load Factor → ขั้นที่ 2 เลือกรถแนวยาว → รูปรถ → มิเตอร์
            แถว 3  การ์ดสรุป 6 ช่อง
            แถว 4  ขั้นที่ 3 ต้นทุนพยากรณ์ + ปุ่มยืนยัน (ล่างสุด) */}
      {/* ทั้งหน้ารวมอยู่ในกรอบขาวกรอบเดียว (เจ้าของงานสั่ง 27 ก.ย. 2569) — ส่วนย่อยข้างในไม่มีกรอบ คั่นด้วยเส้น */}
      <div className="card dp-shell">
        <div className="card dp-filtercard">
          <div className="dp-step-h"><span className="step">1</span><h3>เลือกบิล</h3>
            <span className="hint">{rows.length} บิล{rows.length !== waiting.length ? ` จาก ${waiting.length}` : ""}</span></div>
          {/* ★ ใช้ dh-filters ไม่ใช่ dz-filters — สไตล์ของ dz-* ประกาศใต้ #view-dash เท่านั้น
              หน้านี้เป็นหน้าฟอร์ม ถ้าใช้ dz-filters ช่องกรองจะกลายเป็น select เปล่าไม่มีกรอบ */}
          <div className="dh-filters dp-filterbar">
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
        </div>

        <div className="dp-row">
            <div className="card dp-bills">
              <div className="card-h">
                <h2>บิลที่รอจัดรถ</h2>
                <span className="hint">{rows.length} บิล{rows.length !== waiting.length ? ` จากทั้งหมด ${waiting.length}` : ""} · ติ๊กเลือกบิลที่จะไปด้วยกัน</span>
              </div>

          {anchor && (
            <div className="dispatch-lock">
              แสดงเฉพาะบิลที่ไปทางเดียวกับ <b>{anchor.origin} → {anchor.dest}</b>
              {anchorStops.length ? <> · ปลายทางระหว่างทาง: {anchorStops.join(" · ")}</> : <> · ไม่มีจุดระหว่างทาง</>}
              <span> — เอาติ๊กออกทุกบิลเพื่อดูบิลทั้งหมด</span>
            </div>
          )}

          {bills.loading ? <p className="muted">กำลังโหลดบิล… <TruckLoader label={null} /></p>
            : rows.length === 0 ? <p className="muted">ไม่มีบิลที่รอจัดรถตามตัวกรองที่เลือก</p>
            : (
              <GrowBox rows={rows} maxHeight="none" render={(shown) => (
                <table className="tbl dispatch-tbl">
                  <thead><tr>
                    {/* เลือกทั้งหมดได้หลังติ๊กบิลแรกแล้วเท่านั้น — ก่อนนั้นจะได้บิลทุกเส้นทางปนกัน */}
                    <th>{anchor && <input type="checkbox" checked={allShown} title="เลือกทุกบิลที่ไปทางเดียวกัน"
                      onChange={() => setPicked((s) => {
                        const next = new Set(s);
                        if (allShown) rows.forEach((b) => next.delete(b.id));
                        else rows.forEach((b) => next.add(b.id));
                        return next;
                      })} />}</th>
                    <th>วันที่บิล</th><th>เลขที่บิล</th><th>ลูกค้า</th><th>ต้นทาง</th><th>ปลายทาง</th>
                    <th>กลุ่มบริการ</th><th className="n">จำนวน (ชิ้น)</th><th className="n">น้ำหนัก (กก.)</th><th className="n">ปริมาตร (ลบ.ม.)</th>
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
                        <td className="n">{num3(b.qty)}</td>
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

          <div className="dp-right">
            <LoadTruckPanel stats={stats} load={sum} headCap={headCap} tailCap={tailCap}
              truckPlate={truck?.plate ?? ""} trailerPlate={trailer?.plate ?? ""} kind={kind} fleetType={hp.fleetType}
              trailerKind={tp.vehicle} hasLoad={chosen.length > 0}
              noTruckText="เลือกประเภทรถ ชนิดรถ และทะเบียนในขั้นที่ 2" noLoadText="ยังไม่ได้เลือกบิล"
              overText="เกินความจุรถ — เอาบิลออกหรือเปลี่ยนคันก่อนจึงจะยืนยันได้"
              title={origin && dest ? `${origin} → ${dest}` : "สถานะการบรรทุก"}
              sub={<>{releaseDate ? thDateSafe(releaseDate) : "ยังไม่ได้เลือกวันปล่อยรถ"} · {sum.bills} บิล จาก {waiting.length} ·
                {" "}{baht(sum.weight)} กก.</>}
              pictureKind={hp.vehicle || DEFAULT_PICTURE_KIND}
            picker={<>
              <div className="dp-step-h"><span className="step">2</span><h3>เลือกรถ</h3>
                <span className="hint">สถานะ "ใช้งาน" {usable.length} คัน</span></div>
              <div className="bill-grid dp-grid4">
                <VehiclePickFields pick={hp} setPick={setHp} pool={heads} trailer={false}
                  kindNames={ACTIVE_VEHICLE_NAMES} anyKind="ทุกชนิดรถ" plateLabel="ทะเบียนรถ"
                  noneLabel={(n) => (n ? "เลือกทะเบียน" : "ไม่พบรถตามที่เลือก")} />
                <div className="f"><label>วันปล่อยรถ</label>
                  <input type="date" value={releaseDate} onChange={(e) => setReleaseDate(e.target.value)} /></div>
              </div>
              {!trailerOpen ? (
                <button type="button" className="dp-add-trailer" onClick={() => setTrailerOpen(true)}>
                  <span>+</span> เพิ่มหางพ่วง (ทะเบียนรถคันที่ 2)
                </button>
              ) : (
                <div className="dispatch-trailer">
                  <div className="dispatch-trailer-h">
                    หางพ่วง (ทะเบียนรถคันที่ 2)
                    <button type="button" className="dh-clear" onClick={closeTrailer}>✕ ไม่มีหางพ่วง</button>
                  </div>
                  <div className="bill-grid dp-grid4">
                    <VehiclePickFields pick={tp} setPick={setTp} pool={trailersAll} trailer
                      kindNames={TRAILER_VEHICLE_NAMES} anyKind="ทุกชนิดหาง" plateLabel="ทะเบียนหางพ่วง"
                      noneLabel={(n) => (n ? `ไม่มีหางพ่วง (มีให้เลือก ${n} คัน)` : "ไม่พบหางตามที่เลือก")} />
                  </div>
                </div>
              )}
              </>} />

          </div>
        </div>

            <div className="dispatch-sum">
              <div><span>จำนวนบิล</span><b>{sum.bills}</b></div>
              <div><span>จำนวนลูกค้า</span><b>{sum.customers}</b></div>
              <div><span>จำนวนสินค้า</span><b>{num3(sum.qty)} <small>ชิ้น</small></b></div>
              <div><span>น้ำหนักรวม</span><b>{baht(sum.weight)} <small>กก.</small></b></div>
              <div><span>ปริมาตรรวม</span><b>{num3(sum.volume)} <small>ลบ.ม.</small></b></div>
              <div><span>รายได้รวม</span><b>{baht(sum.revenue)} <small>บาท</small></b></div>
            </div>

        <div className="card dp-final">
          <div className="dp-step-h"><span className="step">3</span><h3>ต้นทุนพยากรณ์</h3></div>
          <div className="dp-final-grid">
            <div className="dp-final-cost">
              <div className="dp-cost">
                <b>{forecast ? baht(forecast.cost) : "—"} <small>บาท</small></b>
                <span>รายได้ {baht(sum.revenue)}</span>
              </div>
              {forecast && forecast.n > 0 && <ForecastParts fc={forecast} />}
              <div className={"dp-profit " + (profit == null ? "" : profit >= 0 ? "good" : "bad")}>
                <span>กำไรประมาณการ</span>
                <b>{profit == null ? "—" : `${profit < 0 ? "−" : ""}${baht(Math.abs(profit))} บาท`}</b>
              </div>
              <div className="price-note">
                {forecast
                  ? <>ต้นทุนพยากรณ์จากค่าเฉลี่ยข้อมูลเก่า <b>{forecast.n}</b> เที่ยว ({forecast.note}) ·
                      ช่วง {forecast.from} – {forecast.to} · ตั้งจำนวนเดือนได้ที่หน้าการตั้งค่า</>
                  : "เลือกบิลและรถให้ครบเพื่อคำนวณต้นทุนพยากรณ์ (ใช้ค่าเฉลี่ยข้อมูลเก่าตามเส้นทางและชนิดรถ)"}
                {mixedRoute && <> · <b>บิลที่เลือกมีหลายเส้นทาง</b> — ใบรายการจะใช้ {origin}–{dest} เป็นเส้นทางหลัก</>}
              </div>
            </div>
            <div className="dp-final-act">
            {msg && <div className={"save-msg " + msg.tone}>{msg.text}</div>}
            <div className="dp-confirm">
              {busy ? <TruckLoader label="กำลังสร้างใบรายการ…" /> : blocked && <span className="muted">{blocked}</span>}
              {role === "admin" && <button type="button" className="btn-ghost" onClick={fillRandom}
                disabled={busy || bills.loading || waiting.length === 0} title="สุ่มบิลรอจัดรถและเลือกรถที่บรรทุกได้ โดยยังไม่บันทึก">
                🎲 สุ่มข้อมูล
              </button>}
              <button type="button" className="btn btn-save" disabled={!!blocked || busy} onClick={confirmDispatch}>
                ยืนยันการจัดรถ
              </button>
            </div>
            </div>
          </div>
          {billSplit && <BillSplit res={billSplit} bills={chosen} />}
        </div>
      </div>
    </>
  );
}

/**
 * ต้นทุนพยากรณ์แยกรายบิล — ปันด้วย Metric = MAX(น้ำหนัก, ปริมาตร × CF) × ระยะทางของบิล (lib/alloc/tripAlloc.ts)
 * ตัวเลขเป็นพยากรณ์ของบิลที่ติ๊กอยู่ เปลี่ยนตามบิล/รถที่เลือก ไม่บันทึกลงใบ
 */
function BillSplit({ res, bills }: { res: AllocResult; bills: PendingBill[] }) {
  const n = (v: number, d = 0) => v.toLocaleString("th-TH", { minimumFractionDigits: d, maximumFractionDigits: d });
  return (
    <div className="dp-split">
      <h4>ต้นทุนพยากรณ์แยกรายบิล</h4>
      {res.error ? <div className="banner">{res.error}</div> : <>
        <p className="price-note" style={{ margin: "0 0 8px" }}>
          Conversion Factor = ความจุน้ำหนัก ÷ ความจุปริมาตร ของรถหัว + หาง = <b>{n(res.cf ?? 0, 2)} กก./ลบ.ม.</b> ·
          น้ำหนักเทียบเท่า = MAX(น้ำหนัก, ปริมาตร × CF) · Metric = น้ำหนักเทียบเท่า × ระยะทางของบิล ·
          ต้นทุนบิล = ต้นทุนพยากรณ์ × Metric ÷ Metric รวม · บิลที่น้ำหนัก/ขนาดเชื่อไม่ได้ปันตามรายได้
        </p>
        <div className="dp-split-box">
          <table className="tbl ta-tbl">
            <thead><tr>
              <th>เลขที่บิล</th><th>ผู้ส่ง → ผู้รับ</th><th>เส้นทาง</th>
              <th className="n">น้ำหนัก (กก.)</th><th className="n">ปริมาตร (ลบ.ม.)</th><th className="n">ระยะทาง (กม.)</th>
              <th className="n">น้ำหนักเทียบเท่า (กก.)</th><th className="n">Metric (กก.-กม.)</th><th className="n">สัดส่วน</th>
              <th className="n">ต้นทุนพยากรณ์</th><th className="n">รายได้</th><th className="n">กำไรประมาณการ</th>
            </tr></thead>
            <tbody>{res.rows.map((r, i) => {
              const b = bills[i]!;
              const p = r.revenue - r.cost;
              return (
                <tr key={b.id}>
                  <td><b>{b.no || "–"}</b></td>
                  <td>{b.sender || "–"} → {b.receiver || "–"}</td>
                  <td>{b.origin || "–"}–{b.dest || "–"}</td>
                  <td className="n">{n(r.weightKg)}</td>
                  <td className="n">{n(r.volumeM3, 3)}</td>
                  <td className="n" title={r.distSource}>{n(r.dist)}{r.distSource !== "ตารางระยะทาง" && " *"}</td>
                  <td className="n">{r.byRevenue ? <span title={r.flag}>ตามรายได้</span> : n(r.eqKg, 1)}</td>
                  <td className="n">{r.byRevenue ? "–" : n(r.metric)}</td>
                  <td className="n">{n(r.share * 100, 2)}%</td>
                  <td className="n"><b>{n(r.cost, 2)}</b></td>
                  <td className="n">{n(r.revenue, 2)}</td>
                  <td className="n" style={{ fontWeight: 700, color: p < 0 ? "var(--red)" : "var(--green)" }}>
                    {p < 0 ? "−" : "+"}{n(Math.abs(p), 2)}</td>
                </tr>
              );
            })}</tbody>
            <tfoot><tr>
              <td colSpan={7}>รวม</td>
              <td className="n"><b>{n(res.totalMetric)}</b></td>
              <td className="n"><b>{n(res.rows.reduce((s, r) => s + r.share, 0) * 100, 2)}%</b></td>
              <td className="n"><b>{n(res.rows.reduce((s, r) => s + r.cost, 0), 2)}</b></td>
              <td className="n"><b>{n(res.rows.reduce((s, r) => s + r.revenue, 0), 2)}</b></td>
              <td className="n"><b>{n(res.rows.reduce((s, r) => s + r.revenue - r.cost, 0), 2)}</b></td>
            </tr></tfoot>
          </table>
        </div>
        <p className="price-note" style={{ marginTop: 6 }}>* = ไม่มีระยะทางในตาราง ใช้ค่ากลางของบิลอื่นในเที่ยว</p>
      </>}
    </div>
  );
}

/** สีท่อนของแถบต้นทุนพยากรณ์ — ไล่โทนสีหลักของโมเดลตามภาพที่เจ้าของงานส่ง */
const PART_COLORS = ["var(--accent)", "#B0506A", "#D98BA0", "#E8B7C4", "#C9A27E", "#8E7F87", "#CFC6CB", "#E6DFE2"];

/**
 * รายละเอียดต้นทุนพยากรณ์แยกตามกลุ่มต้นทุน (เฉลี่ยต่อเที่ยว) — ชื่อกลุ่มมาจาก COST_PART_LABELS
 * ชุดเดียวกับป็อบอัพ "จริงเทียบพยากรณ์" ของฝ่ายบัญชี · แถบซ้อน + รายการสองคอลัมน์ (แถบซ้ายของหน้าจัดรถ)
 * "อื่น ๆ" = ต้นทุนรวมหักกลุ่มที่แยกได้ จึงติดลบได้ — แถบวาดเฉพาะค่าบวก
 */
function ForecastParts({ fc }: { fc: ForecastResult }) {
  const rows = COST_PART_LABELS
    .map(({ key, label }, i) => ({ key, label, v: fc.parts[key], c: PART_COLORS[i % PART_COLORS.length]! }))
    .filter((r) => Math.abs(r.v) >= 0.5);
  const pos = rows.reduce((s, r) => s + Math.max(0, r.v), 0) || 1;
  const share = (v: number): string => (fc.cost ? `${(v / fc.cost * 100).toFixed(0)}%` : "–");
  return (
    <div className="dp-parts">
      <div className="dp-parts-bar">{rows.filter((r) => r.v > 0).map((r) =>
        <i key={r.key} title={`${r.label} ${baht(r.v)} บาท (${share(r.v)})`} style={{ width: `${r.v / pos * 100}%`, background: r.c }} />)}</div>
      <ul className="dp-parts-list">{rows.map((r) => (
        <li key={r.key} title={share(r.v)}><i style={{ background: r.c }} /><span>{r.label}</span>
          <b>{r.v < 0 ? "−" : ""}{baht(Math.abs(r.v))}</b></li>
      ))}</ul>
    </div>
  );
}
