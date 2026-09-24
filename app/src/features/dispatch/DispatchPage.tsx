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
 *
 * ★ การจัดรถต้องไม่ค้างครึ่งทาง (แก้ 23 ก.ย. 2569 — เดิมสร้างใบในเครื่องแล้วพังตอนส่งชีต
 *   บิลยังรอจัดรถ กดซ้ำได้ใบซ้ำ คนขับเห็นงานเกิน) กันไว้สามชั้น:
 *     1. ยังไม่เชื่อมชีต = กดยืนยันไม่ได้ (ฝ่ายอื่นต้องเห็นใบ และบิลต้องไม่ถูกเครื่องอื่นจัดซ้ำ)
 *     2. สร้างใบรายการไม่สำเร็จ = ลบใบที่ saveRecord เขียนลงเครื่องไปแล้วทิ้ง บิลคงสถานะเดิม กดใหม่ได้
 *     3. ใบสร้างแล้วแต่สถานะบิลไปไม่ถึงชีต = splitStuckBills() ซ่อนบิลนั้นจากรายการที่จัดได้
 *        แล้วมีแถบให้กดอัปเดตสถานะ (useBills ก็ลองส่งบิลที่ค้างให้เองทุกครั้งที่เปิดหน้า)
 */
import { useEffect, useMemo, useState } from "react";
import {
  ACTIVE_VEHICLE_NAMES, REF, ROSTER_FLEET_TYPES, TRAILER_VEHICLE_NAMES, costFleetType, distanceFor, isTrailerKind,
} from "../../lib/refdata";
import { vehicleSpec } from "../../lib/refdata/vehicleSpecs";
import { useOverrides } from "../../lib/store/overrides";
import { kindsOf, useRoster } from "../../lib/store/roster";
import { splitLoad } from "../../lib/dispatch/loadSplit";
import { onRouteOf, stopsFor, useEnRoute } from "../../lib/route/enRoute";
import LoadTruck from "./LoadTruck";
import type { FleetKind, FleetVehicle } from "../../lib/store/roster";
import { useBills } from "../../lib/store/bills";
import { loadCostRev } from "../../lib/data/useCostRev";
import { COST_PART_LABELS, buildForecast, forecastFor } from "../../lib/forecast/forecast";
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

const baht = (v: number): string => Math.round(v).toLocaleString("th-TH");
const num3 = (v: number): string => v.toLocaleString("th-TH", { maximumFractionDigits: 3 });

interface Filter { date: string; branch: string; origin: string; dest: string; group: string }
const F0: Filter = { date: "", branch: "", origin: "", dest: "", group: "" };

const uniq = (xs: string[]): string[] => [...new Set(xs.filter(Boolean))].sort((a, b) => a.localeCompare(b, "th"));

/**
 * คู่ประเภท/ชนิดของคันนี้ในบทบาทที่ใช้ (หัว หรือ หาง) — คันเดียวเคยวิ่งได้ทั้งสองแบบ (ชม.71-2752 เป็นทั้ง
 * หางพ่วงคอกและรถ 10 ล้อ) · ตรงตัวกรองก่อน → คู่หลักของคัน → คู่แรกที่เจอ
 */
function roleKind(v: FleetVehicle, trailer: boolean, want: { fleetType?: string; vehicle?: string } = {}): FleetKind | null {
  const ks = kindsOf(v).filter((k) => isTrailerKind(k.vehicle) === trailer);
  return ks.find((k) => (!want.fleetType || k.fleetType === want.fleetType) && (!want.vehicle || k.vehicle === want.vehicle))
    ?? ks.find((k) => k.vehicle === v.vehicle) ?? ks[0] ?? null;
}

/** คันนี้เป็นหัว/หางตามตัวเลือกประเภท/ชนิดได้ไหม — ค่าว่าง = ไม่กรองมิตินั้น */
const fitsRole = (v: FleetVehicle, trailer: boolean, fleetType: string, vehicle: string): boolean =>
  kindsOf(v).some((k) => isTrailerKind(k.vehicle) === trailer
    && (!fleetType || k.fleetType === fleetType) && (!vehicle || k.vehicle === vehicle));

/** ตัวเลือกรถหนึ่งคัน ประเภท → ชนิด → ทะเบียน — ใช้ชุดเดียวกันทั้งหัวและหางพ่วง (เจ้าของงานสั่ง 24 ก.ย. 2569) */
interface VehiclePick { fleetType: string; vehicle: string; plate: string }
const P0: VehiclePick = { fleetType: "", vehicle: "", plate: "" };

/** ช่องเลือก ประเภทรถ · ชนิดรถ · ทะเบียน ของรถหนึ่งบทบาท (หัว/หาง) — เปลี่ยนตัวบนแล้วล้างตัวล่างที่ไม่เข้ากัน */
function VehiclePickFields({ pick, setPick, pool, trailer, kindNames, anyKind, plateLabel, noneLabel }: {
  pick: VehiclePick; setPick: (p: VehiclePick) => void; pool: FleetVehicle[]; trailer: boolean;
  kindNames: readonly string[]; anyKind: string; plateLabel: string; noneLabel: (n: number) => string;
}) {
  const cur = pool.find((v) => v.plate === pick.plate) ?? null;
  const ftOpts = ROSTER_FLEET_TYPES.filter((ft) => pool.some((v) => fitsRole(v, trailer, ft, "")));
  const vkOpts = kindNames.filter((n) => pool.some((v) => fitsRole(v, trailer, pick.fleetType, n)));
  const choices = pool.filter((v) => fitsRole(v, trailer, pick.fleetType, pick.vehicle));
  return (
    <>
      <div className="f"><label>ประเภทรถ</label>
        <select value={pick.fleetType} onChange={(e) => {
          const fleetType = e.target.value;
          // ชนิด/ทะเบียนเดิมที่ไม่เข้ากับประเภทใหม่ = ล้างทิ้ง ไม่งั้นช่องค้างค่าที่เลือกไม่ได้
          const vehicle = pick.vehicle && pool.some((v) => fitsRole(v, trailer, fleetType, pick.vehicle)) ? pick.vehicle : "";
          setPick({ fleetType, vehicle, plate: cur && fitsRole(cur, trailer, fleetType, vehicle) ? pick.plate : "" });
        }}>
          <option value="">ทุกประเภทรถ</option>
          {ftOpts.map((ft) => <option key={ft} value={ft}>{ft}</option>)}
        </select></div>
      <div className="f"><label>ชนิดรถ</label>
        <select value={pick.vehicle} onChange={(e) => {
          const vehicle = e.target.value;
          setPick({ ...pick, vehicle, plate: cur && fitsRole(cur, trailer, pick.fleetType, vehicle) ? pick.plate : "" });
        }}>
          <option value="">{anyKind}</option>
          {vkOpts.map((n) => <option key={n} value={n}>{n}</option>)}
        </select></div>
      <div className="f"><label>{plateLabel}</label>
        <select value={pick.plate} onChange={(e) => {
          const v = pool.find((x) => x.plate === e.target.value);
          // เลือกทะเบียนก่อนเลือกประเภท/ชนิด = เติมสองช่องนั้นจากทะเบียนให้เลย
          const k = v ? roleKind(v, trailer, pick) : null;
          setPick(v && k ? { fleetType: k.fleetType, vehicle: k.vehicle, plate: v.plate } : { ...pick, plate: "" });
        }}>
          <option value="">{noneLabel(choices.length)}</option>
          {choices.map((v) => {
            const k = roleKind(v, trailer, pick);
            return <option key={v.plate} value={v.plate}>{v.plate} · {k?.vehicle} ({k?.fleetType})</option>;
          })}
        </select></div>
    </>
  );
}

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

  /** ความจุ = หัว + หาง รวมกัน แล้วยังใช้ฝั่งที่เต็มกว่าเหมือนเดิม */
  const headKg = spec?.capacityKg ?? 0;
  const headM3 = spec?.volumeM3 ?? 0;
  const tailKg = tSpec?.capacityKg ?? 0;
  const tailM3 = tSpec?.volumeM3 ?? 0;
  const capKg = headKg + tailKg;
  const capM3 = headM3 + tailM3;

  /** ฝั่งที่เต็มกว่า — ใช้คิด Load Factor และใช้บล็อกการยืนยัน */
  const useWeight = capKg > 0 ? sum.weight / capKg : 0;
  const useVolume = capM3 > 0 ? sum.volume / capM3 : 0;
  const binding = useWeight >= useVolume ? "น้ำหนัก" : "ปริมาตร";
  const loadFactor = Math.max(useWeight, useVolume) * 100;
  const overWeight = capKg > 0 && sum.weight > capKg;
  const overVolume = capM3 > 0 && sum.volume > capM3;
  /** % ของตู้หัว/ตู้หาง สำหรับรูปรถ — เติมตู้หัวก่อน ล้นไปตู้หาง */
  const split = truck
    ? splitLoad(sum, { kg: headKg, m3: headM3 }, trailer ? { kg: tailKg, m3: tailM3 } : null)
    : { head: 0, tail: null };

  /* ---------- เส้นทางของเที่ยว ---------- */
  const origins = uniq(chosen.map((b) => b.origin));
  const dests = uniq(chosen.map((b) => b.dest));
  const origin = origins[0] ?? "";
  const dest = dests[dests.length - 1] ?? "";
  const mixedRoute = origins.length > 1 || dests.length > 1;

  const forecast: ForecastResult | null = fc && origin && dest && kind
    ? forecastFor(fc, origin, dest, kind) : null;
  const profit = forecast ? sum.revenue - forecast.cost : null;

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
    setTp(P0);
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

      {/* ขั้นที่ 1 แบ่งสองฝั่ง: ซ้าย = บิลที่รอจัดรถ · ขวา = สถานะการบรรทุก (รูปรถ + หลอด Load Factor) */}
      <div className="dispatch-top">
      <div className="card">
        <div className="card-h">
          <span className="step">1</span><h2>บิลที่รอจัดรถ</h2>
          <span className="hint">{rows.length} บิล{rows.length !== waiting.length ? ` จากทั้งหมด ${waiting.length}` : ""} · ติ๊กเลือกบิลที่จะไปด้วยกัน</span>
        </div>

        {/* ★ ใช้ dh-filters ไม่ใช่ dz-filters — สไตล์ของ dz-* ประกาศใต้ #view-dash เท่านั้น
            หน้านี้เป็นหน้าฟอร์ม ถ้าใช้ dz-filters ช่องกรองจะกลายเป็น select เปล่าไม่มีกรอบ */}
        <div className="dh-filters">
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
            <GrowBox rows={rows} render={(shown) => (
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

      <LoadTruck
        hint={truck
          ? `${truck.plate} · ${kind} (${hp.fleetType})${trailer ? ` + หาง ${trailer.plate}` : ""}`
          : "ยังไม่ได้เลือกรถ"}
        lf={truck ? loadFactor : 0} head={split.head} tail={split.tail}
        basis={truck && chosen.length ? `คิดจากฝั่ง${binding}` : ""}
        over={overWeight || overVolume}>
        {!truck ? (
          <div className="lf">ยังไม่ได้เลือกรถ <small>— เลือกประเภทรถ ชนิดรถ และทะเบียนในขั้นที่ 2</small></div>
        ) : (
          <>
            <div className="lf">Load Factor <b>{loadFactor.toFixed(1)}%</b>
              <small> {overWeight || overVolume ? "เกินความจุรถ"
                : !chosen.length ? "ยังไม่ได้เลือกบิล"
                : loadFactor >= 95 ? "เต็มคันพอดี"
                : `ยังว่างอยู่ ${(100 - loadFactor).toFixed(1)}%`}{trailer ? " · ความจุหัว + หางพ่วง" : ""}</small></div>
            <div className="cap">
              น้ำหนัก {baht(sum.weight)} / {baht(capKg)} กก. ({(useWeight * 100).toFixed(1)}%) ·
              ปริมาตร {num3(sum.volume)} / {num3(capM3)} ลบ.ม. ({(useVolume * 100).toFixed(1)}%)
            </div>
            {trailer && (
              <div className="cap">
                หัว {truck.plate} {baht(headKg)} กก. / {num3(headM3)} ลบ.ม. +
                หาง {trailer.plate} {baht(tailKg)} กก. / {num3(tailM3)} ลบ.ม.
              </div>
            )}
            {(overWeight || overVolume) && <div className="bill-bad">⚠ เกินความจุรถ — เอาบิลออกหรือเปลี่ยนคันก่อนจึงจะยืนยันได้</div>}
            {headKg === 0 && headM3 === 0 && (
              <div className="bill-bad">⚠ ยังไม่มีสเปกความจุของ "{kind}" ในระบบ — ตั้งค่าได้ที่หน้าการตั้งค่า</div>
            )}
            {trailer && tailKg === 0 && tailM3 === 0 && (
              <div className="bill-bad">⚠ ยังไม่มีสเปกความจุของหาง "{tp.vehicle}" ในระบบ — ตั้งค่าได้ที่หน้าการตั้งค่า</div>
            )}
          </>
        )}
      </LoadTruck>
      </div>

      <div className="card">
        <div className="card-h">
          <span className="step">2</span><h2>เลือกรถและยืนยัน</h2>
          <span className="hint">เลือกได้เฉพาะทะเบียนที่สถานะ "ใช้งาน" ({usable.length} คัน)</span>
        </div>

        <div className="bill-grid">
          <VehiclePickFields pick={hp} setPick={setHp} pool={heads} trailer={false}
            kindNames={ACTIVE_VEHICLE_NAMES} anyKind="ทุกชนิดรถ" plateLabel="ทะเบียนรถ"
            noneLabel={(n) => (n ? `เลือกทะเบียน (${n} คัน)` : "ไม่พบรถตามที่เลือก")} />
          <div className="f"><label>วันปล่อยรถ</label>
            <input type="date" value={releaseDate} onChange={(e) => setReleaseDate(e.target.value)} /></div>
        </div>

        <div className="dispatch-trailer">
          <div className="dispatch-trailer-h">
            หางพ่วง (ทะเบียนรถคันที่ 2)
            {(tp.fleetType || tp.vehicle || tp.plate) && (
              <button type="button" className="dh-clear" onClick={() => setTp(P0)}>✕ ไม่มีหางพ่วง</button>
            )}
          </div>
          <div className="bill-grid">
            <VehiclePickFields pick={tp} setPick={setTp} pool={trailersAll} trailer
              kindNames={TRAILER_VEHICLE_NAMES} anyKind="ทุกชนิดหาง" plateLabel="ทะเบียนหางพ่วง"
              noneLabel={(n) => (n ? `ไม่มีหางพ่วง (มีให้เลือก ${n} คัน)` : "ไม่พบหางตามที่เลือก")} />
            {/* ช่องเปล่าแทน "วันปล่อยรถ" ของแถวหัว — ให้กริดมี 4 ช่องเท่ากัน ความกว้างช่องจึงตรงกับแถวบน */}
            <div aria-hidden="true" />
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

        {/* กล่องสรุปผล — แทนกล่องต้นทุนเดิม ใช้ต้นทุนพยากรณ์จากข้อมูลเก่า */}
        <div className={"dispatch-result " + (profit == null ? "" : profit >= 0 ? "good" : "bad")}>
          <div className="box"><span>กำไร (ประมาณการ)</span>
            <b>{profit == null ? "—" : `${baht(profit)} บาท`}</b></div>
          <div className="box"><span>รายได้ (รวมทุกบิล)</span><b>{baht(sum.revenue)} บาท</b></div>
          <div className="box"><span>ต้นทุนพยากรณ์</span>
            <b>{forecast ? `${baht(forecast.cost)} บาท` : "—"}</b></div>
        </div>
        {forecast && forecast.n > 0 && <ForecastParts fc={forecast} />}
        <div className="price-note">
          {forecast
            ? <>ต้นทุนพยากรณ์จากค่าเฉลี่ยข้อมูลเก่า <b>{forecast.n}</b> เที่ยว ({forecast.note}) ·
                ช่วง {forecast.from} – {forecast.to} · ตั้งจำนวนเดือนได้ที่หน้าการตั้งค่า</>
            : "เลือกบิลและรถให้ครบเพื่อคำนวณต้นทุนพยากรณ์ (ใช้ค่าเฉลี่ยข้อมูลเก่าตามเส้นทางและชนิดรถ)"}
          {mixedRoute && <> · <b>บิลที่เลือกมีหลายเส้นทาง</b> — ใบรายการจะใช้ {origin}–{dest} เป็นเส้นทางหลัก</>}
        </div>

        {msg && <div className={"save-msg " + msg.tone}>{msg.text}</div>}

        <div className="bill-actions">
          {busy ? <TruckLoader label="กำลังสร้างใบรายการ…" /> : blocked && <span className="muted">{blocked}</span>}
          <button type="button" className="btn btn-save" disabled={!!blocked || busy} onClick={confirmDispatch}>
            ยืนยันการจัดรถ
          </button>
        </div>
      </div>
    </>
  );
}

/**
 * รายละเอียดต้นทุนพยากรณ์แยกตามกลุ่มต้นทุน (เฉลี่ยต่อเที่ยว) — ชื่อกลุ่มมาจาก COST_PART_LABELS
 * ชุดเดียวกับป็อบอัพ "จริงเทียบพยากรณ์" ของฝ่ายบัญชี
 * "อื่น ๆ" = ต้นทุนรวมหักกลุ่มที่แยกได้ จึงติดลบได้ — แถบวาดเฉพาะค่าบวก
 */
function ForecastParts({ fc }: { fc: ForecastResult }) {
  const rows = COST_PART_LABELS
    .map(({ key, label }) => ({ key, label, v: fc.parts[key] }))
    .filter((r) => Math.abs(r.v) >= 0.5);
  const max = Math.max(1, ...rows.map((r) => r.v));
  const share = (v: number): string => (fc.cost ? `${(v / fc.cost * 100).toFixed(0)}%` : "–");
  return (
    <div className="fc-parts">
      <div className="fc-h">รายละเอียดต้นทุนพยากรณ์<span>เฉลี่ยต่อเที่ยว · แยกตามกลุ่มต้นทุน</span></div>
      {rows.map((r) => (
        <div key={r.key} className="fc-row">
          <span className="k">{r.label}</span>
          <span className="bar"><i style={{ width: `${Math.max(0, r.v) / max * 100}%` }} /></span>
          <b>{r.v < 0 ? "−" : ""}{baht(Math.abs(r.v))}</b>
          <small>{share(r.v)}</small>
        </div>
      ))}
      <div className="fc-row total">
        <span className="k">รวมต้นทุนพยากรณ์</span><span />
        <b>{baht(fc.cost)}</b><small>100%</small>
      </div>
    </div>
  );
}
