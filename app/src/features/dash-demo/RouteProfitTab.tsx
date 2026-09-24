/**
 * แท็บ "กำไรรายเส้นทาง" ของเมนู Demo — ลำดับการแสดงผลตามที่เจ้าของงานสั่ง (21 ก.ย. 2569)
 *
 *   1. การ์ดเด่น 3 ใบ  **กำไร (ใบใหญ่สุด)** · รายได้รวม · ต้นทุนรวม — เจ้าของงานสั่งสลับ 24 ก.ย. 2569
 *                      ใบแรกกว้างกว่าเพราะกฎ 1.35fr ของ .dz-heroes ใน index.css
 *   2. การ์ดย่อย 8 ใบ  **%Margin** · จำนวนบิล · จำนวนเที่ยว · จำนวนลูกค้า
 *                      **%เที่ยวที่ขาดทุน** · กำไรเฉลี่ย/บิล · กำไรเฉลี่ย/เที่ยว · กำไรเฉลี่ย/ลูกค้า
 *                      (สองการ์ด % อยู่หัวแถว · กด %เที่ยวที่ขาดทุน = ป็อบอัพรายการเที่ยวที่ขาดทุนทั้งหมด)
 *   2b. การ์ดกำไรส่วนเกิน/ตัน-กม. 4 ใบ (23 ก.ย. 2569) — ชุด loadfactor/ ตามตัวกรอง ปี/เดือน/ประเภทรถ/ชนิดรถ ของหน้า
 *      (24 ก.ย. 2569 · เดิมตรึงเดือนล่าสุด) กดแล้วไป Executive Dashboard › แท็บ "กำไรส่วนเกิน/ตัน-กม." (dash-costrev/tonkm/)
 *   3. กราฟ รายได้/ต้นทุน/กำไร รายเดือน — **ตามตัวกรองปีด้วย** (ต่างจากแท็บกำไรรายเที่ยวของ
 *      Executive Dashboard ที่จงใจโชว์ทุกปีเสมอ)
 *   4. ดีไซน์ใหม่ 24 ก.ย. 2569 (ภาพที่เจ้าของงานส่ง): แผนที่เส้นทาง (ซ้าย · RouteMap.tsx ฝังแอปแผนที่ map/ ผ่าน
 *      iframe) · จัดอันดับกำไรต่อเที่ยว (ขวาบน) · รายละเอียดต้นทุนของเส้นทางที่เลือก (ขวาล่าง) พร้อมปุ่ม i ·
 *      แผนที่เปิดมาเปล่า กดแถวในตาราง = เส้นนั้นโผล่พร้อมรถหนึ่งคัน (ไม่ใช่ "5 เส้นทางกำไรสูงสุด" แล้ว)
 *   5. การ์ดอัตรากำไรตามกลุ่มบริการ 3 ใบ — กดแล้วไป Executive Dashboard (กราฟของจริงจะทำทีหลัง)
 *
 * ★ ชุดเที่ยว = จับคู่ได้ + เที่ยววิ่งเปล่า (inProfitScope ใน lib/data/useCostRev.ts — ผู้เรียกกรองมาให้)
 *   เที่ยวเปล่านับเข้า ต้นทุน · กำไร · จำนวนเที่ยว · %เที่ยวที่ขาดทุน แต่มีบิล 0 ลูกค้าว่าง กลุ่มบริการ "ไม่ระบุ"
 * ★ จำนวนบิล/ลูกค้ามาจากฟิลด์ bn/cus ที่ ETL เติมให้เฉพาะเที่ยวที่จับคู่บิลได้
 *   ลูกค้า = ผู้จ่ายเงิน (สด/เชื่อต้นทาง → ผู้ส่ง · ปลายทาง → ผู้รับ) นับแบบไม่ซ้ำทั้งชุดที่กรองอยู่
 *   ไม่ใช่ผลบวกของแต่ละเที่ยว — ลูกค้าคนเดียวส่งของหลายเที่ยวต้องนับครั้งเดียว
 * ★ ตัวกรองเป็นของหน้า (DemoDash · filter.tsx) ไม่ใช่ของส่วนนี้แล้ว — Demo รวมเป็นหน้ายาวหน้าเดียว 24 ก.ย. 2569
 */
import { useMemo, useRef, useState } from "react";
import { DLine } from "../../lib/chart/dcharts";
import { D } from "../../lib/chart/theme";
import { Hero, KC, Note, Pane } from "../dash-fleet/parts";
import {
  Meter, SortTable, fmt, groupBy, monthLabel, passBase, pct, signed, useSort,
} from "../dash-costrev/common";
import type { Col } from "../dash-costrev/common";
import { passDemo } from "./filter";
import type { DemoFilter } from "./filter";
import ServicePanel from "./ServicePanel";
import TripsModal from "./TripsModal";
import RouteMap, { type MapRoute } from "./RouteMap";
import TonKmDemoRow from "../dash-costrev/tonkm/TonKmDemoRow";
import { fixedOf, otherOf, semiOf, variableOf } from "../../lib/data/useCostRev";
import type { Trip } from "../../lib/data/useCostRev";

/** กลุ่มบริการที่ทำเป็นการ์ดท้ายหน้า — ชื่อต้องตรงกับ sg ที่ ETL เติมจากประเภทสินค้าในบิล */
const SERVICE_GROUPS = ["สินค้าทั่วไป", "สินค้าแช่เย็น", "สินค้าแช่แข็ง"] as const;

/**
 * กลุ่มต้นทุนตามเอกสาร "การจัดประเภทต้นทุนสำหรับ Dashboard" (ชุดเดียวกับแท็บต้นทุนของ Executive Dashboard)
 *   ต้นทุนทั้งหมด = ต้นทุนปกติ + ต้นทุนสูญเปล่า
 *   ต้นทุนปกติ    = ผันแปร (น้ำมัน+เบี้ยเลี้ยง+ค่าธรรมเนียม) + กึ่งผันแปร (ค่าซ่อม) + คงที่ (ค่าเสื่อม) + ค่าเช่า + อื่น ๆ
 */
interface CostPart { label: string; color: string; of: (t: Trip) => number; subs?: CostPart[] }
/**
 * สีตามดีไซน์ที่เจ้าของงานส่ง 24 ก.ย. 2569 (แผนที่ + จัดอันดับ + รายละเอียดต้นทุน) — กำไรเขียว · ผันแปรดำ ·
 * กึ่งผันแปรส้มทอง · คงที่เทา · ก้อนย่อยของผันแปรเป็นสี่เหลี่ยมโปร่ง (.rp-cl li.sub) จึงไม่ต้องมีสีของตัวเอง
 */
const RP = { profit: "#0f7a55", loss: "#c8384e", variable: "#4f46e5", semi: "#f59e0b", fixed: "#475569",
  rent: "#6f8fae", other: "#9aa0a6", waste: "#d9707f",
  // ก้อนย่อยของผันแปร — แต่ละก้อนมีสีของตัวเองตามภาพที่เจ้าของงานส่ง 24 ก.ย. 2569 (รอบสอง)
  fuel: "#4f46e5", allow: "#9333ea", fee: "#0f9488" };
const COST_TREE: { group: string; parts: CostPart[] }[] = [
  { group: "ต้นทุนปกติ", parts: [
    { label: "ผันแปร", color: RP.variable, of: variableOf, subs: [
      // ★ ไฟล์มีคอลัมน์ย่อยของสามก้อนนี้เท่านั้น (น้ำมัน 5 · เบี้ยเลี้ยง 3 · ค่าธรรมเนียม 7)
      //   เจ้าของงานเลือกให้แสดงแค่สองชั้น จึงหยุดที่ระดับนี้ ไม่ลงรายก้อนย่อย (21 ก.ย. 2569)
      { label: "น้ำมัน", color: RP.fuel, of: (t) => t.fuel },
      { label: "เบี้ยเลี้ยง", color: RP.allow, of: (t) => t.allow },
      { label: "ค่าธรรมเนียม", color: RP.fee, of: (t) => t.fee },
    ] },
    // ค่าซ่อมรวม / ค่าเสื่อม / ค่าเช่ารวม เป็นคอลัมน์เดียวในไฟล์ต้นฉบับ ไม่มีรายละเอียดย่อยให้แยก
    { label: "กึ่งผันแปร (ค่าซ่อม)", color: RP.semi, of: semiOf },
    { label: "คงที่ (ค่าเสื่อม)", color: RP.fixed, of: fixedOf },
    { label: "ค่าเช่า", color: RP.rent, of: (t) => t.rent },
    { label: "อื่น ๆ", color: RP.other, of: otherOf },
  ] },
  // สูญเปล่าในไฟล์ต้นฉบับมี 3 คอลัมน์ (น้ำมันนอกเส้นทาง · Fleet Card · รถวิ่งอ้อม) แต่ ETL รวมเป็นก้อนเดียว
  // เจ้าของงานเลือกให้ใช้ก้อนเดียวต่อ ไม่ต้องแก้ ETL
  { group: "ต้นทุนสูญเปล่า", parts: [
    { label: "สูญเปล่า", color: RP.waste, of: (t) => t.waste },
  ] },
];


/** ความกว้างคอลัมน์แผนที่ (%) — ค่าตั้งต้น/ขอบล่าง/ขอบบนตามดีไซน์ · คีย์ localStorage */
const MAP_PCT_KEY = "rpMapPct";
/** โหมดแผนที่ขาว/ดำ (เจ้าของงานขอ 24 ก.ย. 2569) — ค่าเริ่ม = ขาว (เปลี่ยนจากดำ 25 ก.ย. 2569) · จำรายเครื่องใน localStorage */
const MAP_THEME_KEY = "rpMapTheme";
const MAP_PCT_DEFAULT = 38, MAP_PCT_MIN = 20, MAP_PCT_MAX = 65;

interface RouteRow {
  rt: string; o: string; de: string; n: number; rev: number; cost: number; profit: number; perTrip: number;
  margin: number | null;
  /** อันดับตามกำไรต่อเที่ยว (มากไปน้อย) — คอลัมน์ # ของตารางจัดอันดับ คงที่ไม่ขยับตามการกดเรียงคอลัมน์อื่น */
  rank: number;
}

export default function RouteProfitTab({ trips, f }: { trips: Trip[]; f: DemoFilter }) {
  const [picked, setPicked] = useState<string | null>(null);
  const [showList, setShowList] = useState(false);
  /** ป็อบอัพเที่ยวที่ขาดทุนทั้งหมด (กดการ์ด %เที่ยวที่ขาดทุน) */
  const [showLoss, setShowLoss] = useState(false);
  /** การ์ดกลุ่มบริการที่กางแผงอยู่ — กดซ้ำที่การ์ดเดิม = ปิด */
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  const rows = useMemo(() => trips.filter((t) => passDemo(t, f)), [trips, f]);

  /* ---------- 1–2. ยอดรวมและการ์ดย่อย ---------- */
  const kpi = useMemo(() => {
    const rev = rows.reduce((s, t) => s + t.rev, 0);
    const cost = rows.reduce((s, t) => s + t.cost, 0);
    const profit = rev - cost;
    const bills = rows.reduce((s, t) => s + t.bn, 0);
    // ลูกค้าไม่ซ้ำทั้งชุด ไม่ใช่ผลบวกรายเที่ยว
    const custs = new Set<string>();
    for (const t of rows) for (const c of t.cus) custs.add(c);
    const loss = rows.filter((t) => t.profit < 0).length;
    return {
      rev, cost, profit, bills, custs: custs.size, n: rows.length, loss,
      margin: rev ? profit / rev * 100 : 0,
      perBill: bills ? profit / bills : 0,
      perTrip: rows.length ? profit / rows.length : 0,
      perCust: custs.size ? profit / custs.size : 0,
      lossPct: rows.length ? loss / rows.length * 100 : 0,
    };
  }, [rows]);

  /** เที่ยวที่ขาดทุน — นิยามเดียวกับตัวเศษของ %เที่ยวที่ขาดทุน (กำไร < 0) */
  const lossTrips = useMemo(() => rows.filter((t) => t.profit < 0), [rows]);

  /* ---------- 3. กราฟรายเดือน (ตามตัวกรองทั้งหมด รวมปี) ---------- */
  const monthly = useMemo(() => groupBy(rows, (t) => t.mo)
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((a) => ({ mo: monthLabel(a.key), รายได้: Math.round(a.rev), ต้นทุน: Math.round(a.cost), กำไร: Math.round(a.profit) })),
    [rows]);

  /* ---------- 4. แผนที่ 5 เส้นทางกำไรสูงสุด + จัดอันดับกำไรต่อเที่ยว + รายละเอียดต้นทุน ---------- */
  const byRoute = useMemo<RouteRow[]>(() => {
    // ต้นทาง/ปลายทางของเส้นทาง (rt = "ต้นทาง-ปลายทาง" จาก ETL) — เอาจากเที่ยวแรกของกลุ่ม แผนที่ใช้ชื่อจุดสองตัวนี้
    const ends = new Map<string, { o: string; de: string }>();
    for (const t of rows) if (!ends.has(t.rt)) ends.set(t.rt, { o: t.o, de: t.de });
    const list = groupBy(rows, (t) => t.rt).map((a) => ({
      rt: a.key, ...(ends.get(a.key) ?? { o: "", de: "" }), n: a.n, rev: a.rev, cost: a.cost, profit: a.profit,
      perTrip: a.profit / a.n,
      // รายได้ 0 แล้วขาดทุน = เสียต้นทุนไปทั้งก้อนโดยไม่ได้อะไรกลับ → −100% (เจ้าของงานเลือก 21 ก.ย. 2569)
      // หารด้วยศูนย์ตรง ๆ ไม่ได้ · รายได้ 0 และไม่ขาดทุน (ต้นทุน 0 ด้วย) ยังเป็น null = "–"
      margin: a.rev ? a.profit / a.rev * 100 : a.profit < 0 ? -100 : null,
      rank: 0,
    }));
    [...list].sort((a, b) => b.perTrip - a.perTrip).forEach((r, i) => { r.rank = i + 1; });
    return list;
  }, [rows]);

  /** ฐานของความยาวแท่ง — ค่าสัมบูรณ์มากสุดในชุดที่กรองอยู่ */
  const barMax = useMemo(() => Math.max(1, ...byRoute.map((r) => Math.abs(r.perTrip))), [byRoute]);

  const cols = useMemo<Col<RouteRow>[]>(() => [
    { key: "rank", label: "#", get: (r) => r.rank,
      render: (r) => <span className="rp-rank">{String(r.rank).padStart(2, "0")}</span> },
    { key: "rt", label: "เส้นทาง", get: (r) => r.rt,
      render: (r) => <div className="rp-rt"><b>{r.rt}</b><small>{fmt(r.n)} เที่ยว</small></div> },
    { key: "perTrip", label: "กำไร/เที่ยว (บาท)", get: (r) => r.perTrip, num: true,
      render: (r) => (
        <div className="rp-val">
          <b style={r.perTrip < 0 ? { color: RP.loss } : undefined}>{signed(Math.round(r.perTrip))}</b>
          <span className="rp-track" aria-hidden="true">
            <i style={{ width: `${Math.abs(r.perTrip) / barMax * 100}%`, background: r.perTrip < 0 ? RP.loss : RP.profit }} />
          </span>
        </div>
      ) },
    { key: "margin", label: "อัตรากำไร", get: (r) => r.margin, num: true,
      render: (r) => <span className="rp-margin" style={{ color: r.margin != null && r.margin < 0 ? RP.loss : RP.profit }}>
        {r.margin == null ? "–" : pct(r.margin)}</span> },
  ], [barMax]);
  const { sorted, sort, toggle } = useSort(byRoute, cols, { key: "perTrip", dir: -1 });

  /**
   * เส้นบนแผนที่ = เฉพาะเส้นทางที่ผู้ใช้กดในตารางด้านขวา (เจ้าของงานกำหนด 24 ก.ย. 2569) — เปิดมายังไม่กด = แผนที่เปล่า
   * แม้การ์ดรายละเอียดจะแสดงแถวแรกของตารางไว้ก่อนก็ตาม · memo ด้วยต้นทาง/ปลายทาง ไม่งั้นเปลี่ยนตัวกรองแล้วแผนที่วาดเส้นเดิมซ้ำ
   */
  const pickedRow = useMemo(() => byRoute.find((r) => r.rt === picked) ?? null, [byRoute, picked]);
  const mapRoutes = useMemo<MapRoute[]>(() => (pickedRow && pickedRow.o && pickedRow.de
    ? [{ key: pickedRow.rt, from: pickedRow.o, to: pickedRow.de, profit: Math.round(pickedRow.profit),
        color: pickedRow.profit < 0 ? RP.loss : RP.profit }]
    : []), [pickedRow?.rt, pickedRow?.o, pickedRow?.de, pickedRow ? pickedRow.profit < 0 : null]);
  /** เส้นที่แผนที่วาดไม่ได้ (ชื่อจุดไม่มีพิกัดใน map/src/network.js หรือต้นทาง = ปลายทาง) */
  const [missing, setMissing] = useState<string[]>([]);

  /**
   * ความกว้างคอลัมน์แผนที่ (% ของการ์ด) — ลากเส้นแบ่งปรับได้ 20–65% ตามดีไซน์ Route Profit Dashboard
   * ที่เจ้าของงานส่ง 24 ก.ย. 2569 · จำไว้ใน localStorage (ความสะดวกรายเครื่อง ไม่ต้องแชร์)
   * ★ ลากผ่าน iframe แผนที่แล้ว pointermove จะหายเข้า iframe — ใช้ setPointerCapture ที่ตัวจับ
   *   และปิด pointer-events ของ iframe ระหว่างลาก (.rp-wrap.dragging)
   */
  const [mapPct, setMapPct] = useState<number>(() => {
    try {
      const v = parseFloat(localStorage.getItem(MAP_PCT_KEY) ?? "");
      return v >= MAP_PCT_MIN && v <= MAP_PCT_MAX ? v : MAP_PCT_DEFAULT;
    } catch { return MAP_PCT_DEFAULT; }
  });
  const [mapDark, setMapDark] = useState<boolean>(() => {
    try { return localStorage.getItem(MAP_THEME_KEY) === "dark"; } catch { return false; }
  });
  const pickTheme = (dark: boolean) => {
    setMapDark(dark);
    try { localStorage.setItem(MAP_THEME_KEY, dark ? "dark" : "light"); } catch { /* private mode — ไม่จำก็ได้ */ }
  };
  const [dragging, setDragging] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const saveMapPct = (v: number) => {
    try { localStorage.setItem(MAP_PCT_KEY, String(Math.round(v * 10) / 10)); } catch { /* private mode — ไม่จำก็ได้ */ }
  };
  const startDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    setDragging(true);
    let last = mapPct;
    const move = (ev: PointerEvent) => {
      const r = wrapRef.current?.getBoundingClientRect();
      if (!r) return;
      last = Math.min(MAP_PCT_MAX, Math.max(MAP_PCT_MIN, (ev.clientX - r.left) / r.width * 100));
      setMapPct(last);
    };
    const up = () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      setDragging(false);
      saveMapPct(last);
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
  };
  /** ใช้คีย์บอร์ดปรับได้ด้วย (ลูกศรซ้าย/ขวา ทีละ 2%) */
  const keyDrag = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const d = e.key === "ArrowLeft" ? -2 : e.key === "ArrowRight" ? 2 : 0;
    if (!d) return;
    e.preventDefault();
    const v = Math.min(MAP_PCT_MAX, Math.max(MAP_PCT_MIN, mapPct + d));
    setMapPct(v);
    saveMapPct(v);
  };

  // เส้นทางที่เลือกไว้หลุดจากตัวกรอง → กลับไปใช้แถวแรกของตาราง
  const detail = useMemo(
    () => byRoute.find((r) => r.rt === picked) ?? sorted[0] ?? null,
    [byRoute, picked, sorted]);
  const detailTrips = useMemo(
    () => (detail ? rows.filter((t) => t.rt === detail.rt) : []),
    [rows, detail]);
  /** ต้นทุนของเส้นทางที่เลือก แยกตามการจัดประเภท (ปกติ → ผันแปร/กึ่งผันแปร/คงที่/ค่าเช่า/อื่น ๆ · สูญเปล่า) */
  const costTree = useMemo(() => {
    const sum = (of: (t: Trip) => number) => detailTrips.reduce((s, t) => s + of(t), 0);
    return COST_TREE.map((g) => {
      const parts = g.parts
        .map((p) => ({
          ...p, v: sum(p.of),
          subs: (p.subs ?? []).map((c) => ({ ...c, v: sum(c.of) })).filter((c) => Math.abs(c.v) > 0.5),
        }))
        .filter((p) => Math.abs(p.v) > 0.5);
      return { group: g.group, parts, sum: parts.reduce((s, p) => s + p.v, 0) };
    }).filter((g) => g.parts.length);
  }, [detailTrips]);

  /** เที่ยวสำหรับแผงกลุ่มบริการ — ตัวกรองแท็บทุกตัว ยกเว้นกลุ่มบริการ เพราะกราฟต้องวาดครบสามเส้น */
  const rowsNoSg = useMemo(() => trips.filter((t) => passBase(t, f)), [trips, f]);

  /* ---------- 5. อัตรากำไรตามกลุ่มบริการ (คิดตามตัวกรองด้านบน) ---------- */
  const groups = useMemo(() => SERVICE_GROUPS.map((g) => {
    const gs = rows.filter((t) => t.sg === g);
    const rev = gs.reduce((s, t) => s + t.rev, 0);
    const profit = gs.reduce((s, t) => s + t.profit, 0);
    return { name: g, n: gs.length, rev, profit, margin: rev ? profit / rev * 100 : null };
  }), [rows]);

  return (
    <>
      <Pane deps={[rows]}>
        {/* 1 */}
        <div className="dz-heroes">
          <Hero kind={kpi.profit < 0 ? "loss" : "profit"} l="กำไร" v={signed(kpi.profit)} unit="บาท" s="รายได้ – ต้นทุน = กำไร" />
          <Hero kind="rev" l="รายได้รวม" v={fmt(kpi.rev)} unit="บาท" />
          <Hero kind="cost" l="ต้นทุนรวม" v={fmt(kpi.cost)} unit="บาท" />
        </div>

        {/* 2 — สองแถว แถวละ 4 ใบ */}
        <div className="dz-cards four">
          <Meter dot={D.emerald} bar={kpi.margin < 0 ? D.rose : D.emerald} tone={kpi.margin < 0 ? "bad" : "good"}
            l="%Margin" v={pct(kpi.margin)} s="กำไร ÷ รายได้" fill={Math.abs(kpi.margin)} />
          <KC dot={D.indigo} l="จำนวนบิล" v={fmt(kpi.bills)} s="บิล · ทุกบิลของใบรายการที่จับคู่ได้" />
          <KC dot={D.violet} l="จำนวนเที่ยว" v={fmt(kpi.n)} s="เที่ยว" />
          <KC dot={D.teal} l="จำนวนลูกค้า" v={fmt(kpi.custs)} s="ราย · ผู้จ่ายเงินไม่ซ้ำ" />
          <Meter dot={D.rose} bar={D.rose} tone={kpi.lossPct > 0 ? "bad" : "good"}
            l="%เที่ยวที่ขาดทุน" v={pct(kpi.lossPct)}
            s={kpi.loss ? `${fmt(kpi.loss)} เที่ยวขาดทุน ÷ เที่ยวทั้งหมด · กดดูรายการ` : "เที่ยวขาดทุน ÷ เที่ยวทั้งหมด"}
            fill={kpi.lossPct} onClick={kpi.loss ? () => setShowLoss(true) : undefined} />
          <KC dot={D.indigo} tone={kpi.perBill < 0 ? "bad" : undefined} l="กำไรเฉลี่ย/บิล"
            v={signed(Math.round(kpi.perBill))} s="บาท ต่อบิล" />
          <KC dot={D.violet} tone={kpi.perTrip < 0 ? "bad" : undefined} l="กำไรเฉลี่ย/เที่ยว"
            v={signed(Math.round(kpi.perTrip))} s="บาท ต่อเที่ยว" />
          <KC dot={D.teal} tone={kpi.perCust < 0 ? "bad" : undefined} l="กำไรเฉลี่ย/ลูกค้า"
            v={signed(Math.round(kpi.perCust))} s="บาท ต่อลูกค้า" />
        </div>

        {/* 2b — กำไรส่วนเกิน/ตัน-กม. (ข้อมูลคนละชุด ไม่ตามตัวกรอง) */}
        <TonKmDemoRow f={f} />

        {/* 3 */}
        <div className="dz-cc" style={{ marginTop: 14 }}>
          <h4>เปรียบเทียบ รายได้ / ต้นทุน / กำไร · รายเดือน</h4>
          <div className="dz-box tall">
            <DLine data={monthly} xKey="mo" series={[
              { key: "รายได้", label: "รายได้", color: D.indigo },
              { key: "ต้นทุน", label: "ต้นทุน", color: D.rose },
              { key: "กำไร", label: "กำไร", color: D.emeraldLight },
            ]} />
          </div>
        </div>

        {/* 4 — ดีไซน์ที่เจ้าของงานส่ง 24 ก.ย. 2569: แผนที่ (ซ้าย) · จัดอันดับ + รายละเอียดต้นทุน (ขวา) */}
        {/* การ์ดเดียวสองคอลัมน์: แผนที่ (ลากเส้นแบ่งปรับความกว้างได้) | จัดอันดับ + รายละเอียด */}
        <div ref={wrapRef} className={"rp-wrap" + (dragging ? " dragging" : "")}
          style={{ gridTemplateColumns: `${mapPct}% minmax(0,1fr)` }}>
          <section className="rp-mapcol" aria-label="แผนที่เส้นทาง">
            <div className={"rp-mapbox" + (mapDark ? "" : " light")}>
              <RouteMap routes={mapRoutes} onMissing={setMissing} dark={mapDark} />
              <div className="rp-theme" role="group" aria-label="โหมดแผนที่">
                <button type="button" aria-pressed={!mapDark} onClick={() => pickTheme(false)} title="โหมดขาว">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.2" />
                    <path d="M12 2.5v2.3M12 19.2v2.3M2.5 12h2.3M19.2 12h2.3M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" /></svg>
                  ขาว
                </button>
                <button type="button" aria-pressed={mapDark} onClick={() => pickTheme(true)} title="โหมดดำ">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8.2 8.2 0 0 1 9.5 4a8.2 8.2 0 1 0 10.5 10.5Z" /></svg>
                  ดำ
                </button>
              </div>
              <div className="rp-chip">
                <i aria-hidden="true" className={pickedRow && pickedRow.profit < 0 ? "loss" : undefined} />
                <span>{pickedRow ? pickedRow.rt : "กดเส้นทางในตารางเพื่อดูบนแผนที่"}</span>
              </div>
              {pickedRow && (missing.includes(pickedRow.rt) || !pickedRow.o || !pickedRow.de) && (
                <p className="rp-map-hint">แสดงบนแผนที่ไม่ได้ — ไม่มีพิกัดของต้นทาง/ปลายทาง หรือเป็นจุดเดียวกัน</p>
              )}
            </div>
            <div className="rp-resize" role="separator" aria-orientation="vertical" tabIndex={0}
              aria-valuenow={Math.round(mapPct)} aria-valuemin={MAP_PCT_MIN} aria-valuemax={MAP_PCT_MAX}
              aria-label="ปรับความกว้างแผนที่" title="ลากเพื่อปรับขนาด"
              onPointerDown={startDrag} onKeyDown={keyDrag}><span /></div>
          </section>

          <div className="rp-main">
            <section className="rp-sec">
              <header className="rp-sh">
                <span className="rp-ico green" aria-hidden="true">
                  <svg viewBox="0 0 24 24"><path d="M6 20V10M12 20V4M18 20v-7" /></svg>
                </span>
                <div className="rp-sht">
                  <h3>จัดอันดับกำไรต่อเที่ยว</h3>
                  <p>คลิกเส้นทางเพื่อดูรายละเอียดต้นทุน · กดซ้ำเพื่อเอาเส้นทางออกจากแผนที่</p>
                </div>
                <span className="rp-pill">บาท/เที่ยว</span>
              </header>
              <div className="rp-tblwrap">
                <SortTable rows={sorted} cols={cols} sort={sort} onSort={toggle} rowKey={(r) => r.rt}
                  empty="ไม่มีข้อมูลตามตัวกรองที่เลือก" className="rp-tbl" maxHeight={300}
                  rowProps={(r) => ({
                    className: r.rt === detail?.rt ? "on" : undefined,
                    // กดแถวเดิมซ้ำ = ยกเลิก แผนที่กลับเป็นแผนที่เปล่า (เจ้าของงานขอ 24 ก.ย. 2569)
                    onClick: () => setPicked((p) => (p === r.rt ? null : r.rt)),
                    title: r.rt === picked ? "กดอีกครั้งเพื่อเอาเส้นทางออกจากแผนที่" : "กดเพื่อดูรายละเอียดต้นทุนและเส้นทางบนแผนที่",
                  })} />
              </div>
            </section>

            <section className="rp-sec">
              {detail ? <RouteDetail r={detail} tree={costTree} onList={() => setShowList(true)} />
                : <p className="rp-foot rp-pad">เลือกเส้นทางจากรายการด้านบน</p>}
            </section>
          </div>
        </div>
        <Note>
          ปุ่ม <b>i</b> เปิดรายการทุกเที่ยวของเส้นทางนั้นตามตัวกรองด้านบน · ต้นทุนแยกตามการจัดประเภท: <b>ต้นทุนปกติ</b>
          (ผันแปร + กึ่งผันแปร + คงที่ + ค่าเช่า + อื่น ๆ) และ <b>ต้นทุนสูญเปล่า</b> ·
          % ของกำไรเทียบรายได้ · % ของต้นทุนแต่ละกลุ่มเทียบต้นทุนรวม · แนวเส้นบนแผนที่ตามทางหลวงหลักโดยประมาณ ไม่ใช่เส้นทาง GPS จริง
        </Note>

        {/* 5 */}
        <div className="dm-sgs">
          {groups.map((g, i) => (
            <button key={g.name} type="button"
              className={`dm-sg c${i + 1}` + (openGroup === g.name ? " open" : "")}
              aria-expanded={openGroup === g.name}
              onClick={() => setOpenGroup((p) => (p === g.name ? null : g.name))}
              title={openGroup === g.name ? "กดอีกครั้งเพื่อปิด" : "กดเพื่อดูกราฟและรายเส้นทางของกลุ่มนี้"}>
              <span className="l">อัตรากำไร · {g.name}</span>
              <span className="v">{g.margin == null ? "–" : pct(g.margin)}</span>
              <span className="s">{fmt(g.n)} เที่ยว · กำไร {signed(Math.round(g.profit))} บาท</span>
            </button>
          ))}
        </div>
        <Note>การ์ดกลุ่มบริการคิดตามตัวกรองด้านบน · กดการ์ดเพื่อกางกราฟกับรายเส้นทางของกลุ่มนั้น กดซ้ำเพื่อปิด</Note>
        {openGroup && <ServicePanel trips={rowsNoSg} groups={SERVICE_GROUPS} picked={openGroup} />}
      </Pane>

      {showList && detail && (
        <TripsModal rt={detail.rt} trips={detailTrips} onClose={() => setShowList(false)} />
      )}
      {showLoss && (
        <TripsModal rt="เที่ยวที่ขาดทุน" trips={lossTrips} onClose={() => setShowLoss(false)} showRoute
          note="ทุกเที่ยวที่กำไรติดลบ ตามตัวกรองที่เลือกอยู่ · เรียงขาดทุนมากสุดก่อน"
          initialSort={{ key: "profit", dir: 1 }} />
      )}
    </>
  );
}

type CostVal = Omit<CostPart, "subs"> & { v: number };
type CostTree = { group: string; parts: (CostVal & { subs: CostVal[] })[]; sum: number }[];

/**
 * การ์ดรายละเอียดของเส้นทางที่เลือก (ขวาล่าง) — ตัวเลขต่อเที่ยวสามช่อง · แถบรายได้แบ่งเป็นกำไร + ต้นทุนแต่ละกลุ่ม ·
 * รายการกำไร/ต้นทุนรวม/กลุ่มต้นทุน (% ของกำไรเทียบรายได้ · % ของต้นทุนเทียบต้นทุนรวม) ตามภาพดีไซน์ 24 ก.ย. 2569
 * ★ ขาดทุน: แถบยาวเท่าต้นทุน (รายได้ไม่พอคลุม) ไม่มีท่อนกำไร · "อื่น ๆ" ติดลบได้ แถบวาดเฉพาะค่าบวก
 */
function RouteDetail({ r, tree, onList }: { r: RouteRow; tree: CostTree; onList: () => void }) {
  const per = (v: number) => fmt(Math.round(v / r.n));
  const ofCost = (v: number) => (r.cost ? pct(v / r.cost * 100, 1) : "–");
  const parts = tree.flatMap((g) => g.parts);
  const barBase = parts.reduce((s, p) => s + Math.max(0, p.v), 0) || 1;
  const loss = r.profit < 0;
  return (
    <>
      <header className="rp-sh rp-dh">
        <div className="rp-sht">
          <h3>{r.rt}</h3>
          <p>{fmt(r.n)} เที่ยว · {loss ? "ขาดทุนรวม" : "กำไรรวม"} {fmt(Math.round(Math.abs(r.profit)))} บาท</p>
        </div>
        <button type="button" className="rp-i" onClick={onList}
          title="ดูรายการทุกเที่ยวของเส้นทางนี้" aria-label="ดูรายการทุกเที่ยวของเส้นทางนี้">i</button>
      </header>
      <div className="rp-dbody">
        <div className="rp-stats">
          <div><span>รายได้/เที่ยว</span><b>{per(r.rev)}</b></div>
          <div><span>ต้นทุน/เที่ยว</span><b>{per(r.cost)}</b></div>
          <div className={loss ? "pf loss" : "pf"}><span>กำไร/เที่ยว</span><b>{signed(Math.round(r.perTrip))}</b></div>
        </div>
        {/* แถบสัดส่วนต้นทุน (ไม่รวมกำไร) — ก้อนละสีตามรายการด้านล่าง · "อื่น ๆ" ติดลบได้จึงวาดเฉพาะค่าบวก */}
        <div className="rp-stack" role="img" aria-label="สัดส่วนต้นทุนต่อเที่ยวแยกตามกลุ่ม">
          {parts.filter((p) => p.v > 0).map((p) => (
            <i key={p.label} style={{ width: `${p.v / barBase * 100}%`, background: p.color }}
              title={`${p.label} ${per(p.v)} บาท/เที่ยว`} />
          ))}
        </div>
        <ul className="rp-cl">
          {tree.map((g) => [
            <li key={g.group} className="grp">
              <span>{g.group}</span><b>{ofCost(g.sum)}</b><small>{per(g.sum)} ฿/เที่ยว</small>
            </li>,
            ...g.parts.flatMap((p) => [
              <li key={p.label}>
                <i style={{ background: p.color }} /><span>{p.label}</span>
                <b>{ofCost(p.v)}</b><small>{per(p.v)} ฿/เที่ยว</small>
              </li>,
              ...p.subs.map((c) => (
                <li key={`${p.label}/${c.label}`} className="sub">
                  <i style={{ background: c.color }} /><span>{c.label}</span>
                  <b>{ofCost(c.v)}</b><small>{per(c.v)} ฿/เที่ยว</small>
                </li>
              )),
            ]),
          ])}
        </ul>
      </div>
    </>
  );
}
