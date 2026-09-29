/**
 * แท็บ "กำไรรายเส้นทาง" ของเมนู Demo — ลำดับการแสดงผลตามที่เจ้าของงานสั่ง (21 ก.ย. 2569)
 *
 *   ★ 28 ก.ย. 2569 (ปรับปรุงโมเดล2.pdf) ข้อ 1 · 2 · 2b ยุบเหลือ 6 กล่อง — ดูคอมเมนต์ที่ JSX · ข้อความ 1–2b ข้างล่างเป็นประวัติ
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
 * ★ ชุดเที่ยว = จับคู่เลขที่ใบรายการกับบิลรายได้ได้ หรือเป็นเที่ยวเปล่า (ผู้เรียกกรองผ่าน inProfitScope)
 *   เที่ยวเปล่านับเข้า ต้นทุน · กำไร · จำนวนเที่ยว · %เที่ยวที่ขาดทุน แต่มีบิล 0 ลูกค้าว่าง กลุ่มบริการ "ไม่ระบุ"
 * ★ จำนวนบิล/ลูกค้ามาจากฟิลด์ bn/cus ที่ ETL เติมให้เฉพาะเที่ยวที่จับคู่บิลได้
 *   ลูกค้า = ผู้จ่ายเงิน (สด/เชื่อต้นทาง → ผู้ส่ง · ปลายทาง → ผู้รับ) นับแบบไม่ซ้ำทั้งชุดที่กรองอยู่
 *   ไม่ใช่ผลบวกของแต่ละเที่ยว — ลูกค้าคนเดียวส่งของหลายเที่ยวต้องนับครั้งเดียว
 * ★ ตัวกรองเป็นของหน้า (DemoDash · filter.tsx) ไม่ใช่ของส่วนนี้แล้ว — Demo รวมเป็นหน้ายาวหน้าเดียว 24 ก.ย. 2569
 */
import { useMemo, useState } from "react";
import { DLine } from "../../lib/chart/dcharts";
import { D } from "../../lib/chart/theme";
import { Hero, KC, Pane } from "../dash-fleet/parts";
import {
  SortTable, fmt, groupBy, monthLabel, pct, signed, useSort,
} from "../dash-costrev/common";
import type { Col } from "../dash-costrev/common";
import { passDemo } from "./filter";
import type { DemoFilter } from "./filter";
import ServicePanel from "./ServicePanel";
import TripsModal from "./TripsModal";
import { type MapRoute } from "./RouteMap";
import { CostBreakdown, RP, RouteMapCard, buildCostTree, useRouteEnds, type CostTree } from "./routeMapParts";
import { TonKmHero, TonKmScope } from "../dash-costrev/tonkm/TonKmDemoRow";
import type { Trip } from "../../lib/data/useCostRev";
// กลุ่มบริการของการ์ดท้ายหน้า + %Margin รายเส้นทาง — ชุดเดียวกับ Performance Index (Route & Service)
import { SERVICE_GROUPS, routeMargin } from "../../lib/pi/route";
import { percentileInc } from "../../lib/damage/damage";
import imgBox from "../../assets/icons3d/box.webp";
import imgCloud from "../../assets/icons3d/cloud.webp";
import imgSnow from "../../assets/icons3d/snow.webp";
import imgFolder from "../../assets/icons3d/folder.webp";
import imgPin from "../../assets/icons3d/pin.webp";
import imgPerson from "../../assets/icons3d/person.webp";


/** รูปมุมขวาบนของการ์ดกำไรเฉลี่ย — รูป 3 มิติที่เจ้าของงานส่ง 28 ก.ย. 2569 (assets/icons3d): บิล = แฟ้มเอกสารฟ้า · เที่ยว = หมุดบนฐาน · ลูกค้า = คนสีน้ำเงิน */
const ICON_BILL = <img src={imgFolder} alt="" />;
const ICON_PIN = <img src={imgPin} alt="" />;
const ICON_PERSON = <img src={imgPerson} alt="" />;

/**
 * ลูกศรซิกแซก 3 มิติในที่ว่างขวาของการ์ดกำไร (แทนกราฟกำไรรายเดือน · เจ้าของงานสั่ง 28 ก.ย. 2569 — รอบแรกเป็นเส้นแบนเล็ก ๆ)
 * กำไรชี้ขึ้น · ขาดทุนชี้ลง · ชั้นล่างเลื่อนลงขวาสีเข้ม = ความหนา · ชั้นบนไล่ขาว→โปร่ง + เส้นสะท้อนแสง
 */
/** ลูกศร 3 มิติขึ้น (กำไร) / ลง (ขาดทุน) ของการ์ดกำไร — ใช้ร่วมกับการ์ดลูกค้ามีกำไร/ขาดทุนของ Customer Performance */
export const trendArrow = (up: boolean) => {
  const d = up ? "M6 70 40 36l18 18L96 16" : "M6 14l34 34 18-18 38 38";
  const head = up ? "M74 12h26v26" : "M74 72h26V46";
  return (
    <svg className="dm-trend-ic" viewBox="0 0 110 86" aria-hidden="true" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <defs>
        <linearGradient id="ta-g" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stopColor="#fff" stopOpacity=".55" /><stop offset="1" stopColor="#fff" /></linearGradient>
      </defs>
      <g stroke="#000" strokeOpacity=".22" strokeWidth="13" transform="translate(4 5)"><path d={d} /><path d={head} /></g>
      <g stroke="url(#ta-g)" strokeWidth="13"><path d={d} /><path d={head} /></g>
      <g stroke="#fff" strokeOpacity=".9" strokeWidth="3" transform="translate(-2 -3)"><path d={d} /></g>
    </svg>
  );
};

/**
 * ภาพประกอบการ์ดกลุ่มบริการ (ลำดับเดียวกับ SERVICE_GROUPS) — รูป 3 มิติที่เจ้าของงานส่ง 28 ก.ย. 2569 (assets/icons3d)
 * ทั่วไป = กล่องพัสดุ · แช่เย็น = กล่อง + เมฆลมเย็น · แช่แข็ง = กล่อง + เกล็ดหิมะ (รูปที่สองวางซ้อนมุมขวาบนของกล่อง)
 */
const sgPic = (extra?: string) => (
  <span className="sg-pic"><img src={imgBox} alt="" />{extra && <img className="sg-pic-x" src={extra} alt="" />}</span>
);
const SG_STYLE = [
  { cls: "sg-gen", icon: sgPic() },
  { cls: "sg-chill", icon: sgPic(imgCloud) },
  { cls: "sg-frozen", icon: sgPic(imgSnow) },
] as const;

// สี · กลุ่มต้นทุน · การ์ดแผนที่ อยู่ใน routeMapParts.tsx (ใช้ร่วมกับแผนที่เที่ยววิ่งเปล่าของ Overall Dashboard · 26 ก.ย. 2569)

interface RouteRow {
  rt: string; o: string; de: string; n: number; rev: number; cost: number; profit: number; perTrip: number;
  margin: number | null;
  /** อันดับตามกำไรต่อเที่ยว (มากไปน้อย) — คอลัมน์ # ของตารางจัดอันดับ คงที่ไม่ขยับตามการกดเรียงคอลัมน์อื่น */
  rank: number;
  /** %Margin ของเส้นทางนี้แยกกลุ่มบริการ (ลำดับ SERVICE_GROUPS) · null = ไม่มีเที่ยวของกลุ่มนั้น (N/A) */
  sgMargin: (number | null)[];
}

/** ป้ายสั้นของกลุ่มบริการบนหัวตารางจัดอันดับ (ลำดับ SERVICE_GROUPS) */
const SG_SHORT = ["ทั่วไป", "แช่เย็น", "แช่แข็ง"] as const;
/**
 * สี %Margin ของตารางจัดอันดับ (ชิปรายกลุ่มบริการ + คอลัมน์อัตรากำไร) — เกณฑ์ percentile (เจ้าของงานสั่ง 28 ก.ย. 2569
 * แทนเกณฑ์ตายตัว > 10% / 5–10% / < 5%): ขาดทุน (< 0) แดง · 0 ถึง < P50 เหลือง · ≥ P50 เขียว
 * P50 = ค่ากลาง %Margin รายเที่ยวของทุกเที่ยวที่ผ่านตัวกรองของหน้า (marginP50) · ไม่มีเที่ยว = ไม่ขาดทุนเป็นเหลืองทั้งหมด
 */
const sgTone = (m: number, p50: number | null): "g" | "y" | "r" =>
  (m < 0 ? "r" : p50 != null && m >= p50 ? "g" : "y");
/** สีตัวอักษรของคอลัมน์อัตรากำไร — ชุดเดียวกับชิป (.rp-sgc.g/.y/.r) */
const TONE_INK = { g: "#16775B", y: "#B26A12", r: "#B42A2A" } as const;

/** P50 ของ %Margin รายเที่ยว (PERCENTILE.INC) · รายได้ 0 แล้วขาดทุน = −100% ตาม routeMargin · รายได้ 0 ไม่ขาดทุน = ไม่นับ */
function marginP50(trips: Trip[]): number | null {
  const ms: number[] = [];
  for (const t of trips) {
    const m = routeMargin(t.rev, t.profit);
    if (m != null) ms.push(m);
  }
  return percentileInc(ms, 0.5);
}

/**
 * summary = โหมดของเมนู Executive Summary (แท็บ Route Profitability · เจ้าของงานเลือกส่วนจาก PDF 27 ก.ย. 2569) —
 * ตั้งแต่ 28 ก.ย. 2569 ทุกหน้าเรียง Service Category → แผนที่ + จัดอันดับ เหมือนกันแล้ว prop นี้จึงไม่เปลี่ยนอะไร (คงไว้ให้ผู้เรียกเดิม)
 */
export default function RouteProfitTab({ trips, f, overview, partTitle }: {
  trips: Trip[]; f: DemoFilter; summary?: boolean;
  /** หัวข้อส่วน — วางใต้การ์ด Service Category เหนือแผนที่ (เจ้าของงานสั่ง 28 ก.ย. 2569) · ไม่ส่ง = ไม่มีหัวข้อ */
  partTitle?: string;
  /** true = วาดเฉพาะ 6 กล่องภาพรวม (Executive Dashboard วางเหนือกรอบส่วน) · false = เนื้อหาส่วน (เริ่มที่กราฟรายเดือน) */
  overview?: boolean;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  /** กลุ่มบริการที่กดจากชิปในแถว — รายละเอียดต้นทุน/ป็อบอัพเที่ยวเหลือเฉพาะกลุ่มนั้น (เจ้าของงานสั่ง 28 ก.ย. 2569) · null = ทุกกลุ่ม */
  const [pickedSg, setPickedSg] = useState<string | null>(null);
  const [showList, setShowList] = useState(false);
  /** ป็อบอัพเที่ยวที่ขาดทุนทั้งหมด (กดการ์ด %เที่ยวที่ขาดทุน) */
  const [showLoss, setShowLoss] = useState(false);
  /** กราฟรายเดือนในภาพรวม: ตั้งต้นเตี้ย กดขยายเป็นขนาดเดิม (เจ้าของงานสั่ง 28 ก.ย. 2569) */
  const [chartBig, setChartBig] = useState(false);
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
  const ends = useRouteEnds(rows);
  const byRoute = useMemo<RouteRow[]>(() => {
    // เส้นทาง × กลุ่มบริการ → %Margin ของชิปในตาราง (รายได้/กำไรรวมของเที่ยวกลุ่มนั้นในเส้นทางนั้น)
    const sgSum = new Map<string, { rev: number; profit: number; n: number }>();
    for (const t of rows) {
      const k = `${t.rt}|${t.sg}`;
      const a = sgSum.get(k) ?? { rev: 0, profit: 0, n: 0 };
      a.rev += t.rev; a.profit += t.profit; a.n++;
      sgSum.set(k, a);
    }
    const list = groupBy(rows, (t) => t.rt).map((a) => ({
      rt: a.key, ...(ends.get(a.key) ?? { o: "", de: "" }), n: a.n, rev: a.rev, cost: a.cost, profit: a.profit,
      perTrip: a.profit / a.n,
      // รายได้ 0 แล้วขาดทุน = เสียต้นทุนไปทั้งก้อนโดยไม่ได้อะไรกลับ → −100% (เจ้าของงานเลือก 21 ก.ย. 2569)
      // หารด้วยศูนย์ตรง ๆ ไม่ได้ · รายได้ 0 และไม่ขาดทุน (ต้นทุน 0 ด้วย) ยังเป็น null = "–"
      margin: routeMargin(a.rev, a.profit),
      rank: 0,
      sgMargin: SERVICE_GROUPS.map((g) => {
        const x = sgSum.get(`${a.key}|${g}`);
        return x && x.n ? routeMargin(x.rev, x.profit) : null;
      }),
    }));
    [...list].sort((a, b) => b.perTrip - a.perTrip).forEach((r, i) => { r.rank = i + 1; });
    return list;
  }, [rows, ends]);

  const p50 = useMemo(() => marginP50(rows), [rows]);
  /** กดชิปกลุ่มบริการ = เลือกเส้นทางนั้น + กลุ่มนั้น · กดชิปเดิมซ้ำ = กลับไปดูทุกกลุ่มของเส้นทาง */
  const pickSg = (rt: string, g: string) => {
    if (picked === rt && pickedSg === g) { setPickedSg(null); return; }
    setPicked(rt); setPickedSg(g);
  };
  const cols = useMemo<Col<RouteRow>[]>(() => [
    { key: "rank", label: "#", get: (r) => r.rank,
      render: (r) => <span className="rp-rank">{String(r.rank).padStart(2, "0")}</span> },
    // กดหัว "เส้นทาง" = เรียงตามจำนวนเที่ยว มากไปน้อยก่อน (เจ้าของงานสั่ง 29 ก.ย. 2569 — เดิมเรียงตามชื่อ) · useSort วนสามจังหวะเหมือนทุกตาราง
    { key: "rt", label: "เส้นทาง", get: (r) => r.n,   // ไม่ใส่ num — num ทำให้ชิดขวา (เรียงตัวเลขได้อยู่แล้ว)
      render: (r) => <div className="rp-rt"><b>{r.rt}</b><small>{fmt(r.n)} เที่ยว</small></div> },
    // %Margin รายกลุ่มบริการเป็นชิป (ตามภาพที่เจ้าของงานส่ง 28 ก.ย. 2569 แทนคอลัมน์แท่งกำไร/เที่ยว) · ไม่มีเที่ยวของกลุ่ม = N/A กรอบประ
    ...SERVICE_GROUPS.map((g, i): Col<RouteRow> => ({
      key: `sg${i}`, label: SG_SHORT[i]!, get: (r) => r.sgMargin[i] ?? null, num: true,
      render: (r) => {
        const m = r.sgMargin[i];
        return m == null
          ? <span className="rp-sgc na" title={`${g}: ไม่มีเที่ยวในเส้นทางนี้`}>N/A</span>
          : <span className={`rp-sgc rp-sgc-btn ${sgTone(m, p50)}` + (picked === r.rt && pickedSg === g ? " on" : "")}
              role="button" tabIndex={0}
              title={`${g}: อัตรากำไร ${pct(m)}${p50 == null ? "" : ` · P50 ${pct(p50)}`} · กดเพื่อดูเฉพาะ${g}`}
              onClick={(e) => { e.stopPropagation(); pickSg(r.rt, g); }}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); pickSg(r.rt, g); } }}>
              {m > 0 ? "+" : ""}{Math.round(m)}%</span>;
      },
    })),
    { key: "margin", label: "อัตรากำไร", get: (r) => r.margin, num: true,
      render: (r) => <span className="rp-margin" style={{ color: r.margin == null ? undefined : TONE_INK[sgTone(r.margin, p50)] }}>
        {r.margin == null ? "–" : pct(r.margin)}</span> },
  ], [p50, picked, pickedSg]);
  // เรียงตั้งต้นตามอันดับกำไร/เที่ยว (# = 1 ขึ้นก่อน) — คอลัมน์กำไร/เที่ยวเอาออกแล้ว
  const { sorted, sort, toggle } = useSort(byRoute, cols, { key: "rank", dir: 1 });

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


  // รายละเอียดต้นทุนโผล่เฉพาะเมื่อกดแถว (เจ้าของงานสั่ง 28 ก.ย. 2569 — เดิมโชว์แถวแรกไว้ก่อน) · เส้นทางหลุดจากตัวกรอง = ซ่อน
  const detailTrips = useMemo(
    () => (pickedRow ? rows.filter((t) => t.rt === pickedRow.rt && (!pickedSg || t.sg === pickedSg)) : []),
    [rows, pickedRow, pickedSg]);
  /** แถวของการ์ดรายละเอียด — เลือกกลุ่มบริการ = ยอดเฉพาะเที่ยวของกลุ่มนั้นในเส้นทาง */
  const detail = useMemo<RouteRow | null>(() => {
    if (!pickedRow) return null;
    if (!pickedSg) return pickedRow;
    const rev = detailTrips.reduce((a, t) => a + t.rev, 0);
    const cost = detailTrips.reduce((a, t) => a + t.cost, 0);
    const profit = detailTrips.reduce((a, t) => a + t.profit, 0);
    const n = detailTrips.length;
    return { ...pickedRow, n, rev, cost, profit, perTrip: n ? profit / n : 0, margin: routeMargin(rev, profit) };
  }, [pickedRow, pickedSg, detailTrips]);
  /** ต้นทุนของเส้นทางที่เลือก แยกตามการจัดประเภท (ปกติ → ผันแปร/กึ่งผันแปร/คงที่/ค่าเช่า/อื่น ๆ · สูญเปล่า) */
  const costTree = useMemo(() => buildCostTree(detailTrips), [detailTrips]);

  /** เที่ยวสำหรับแผงกลุ่มบริการ — ตัวกรองแท็บทุกตัว ยกเว้นกลุ่มบริการ เพราะกราฟต้องวาดครบสามเส้น */
  const rowsNoSg = useMemo(() => trips.filter((t) => passDemo(t, { ...f, sg: "" })), [trips, f]);

  /* ---------- 5. อัตรากำไรตามกลุ่มบริการ (คิดตามตัวกรองด้านบน) ---------- */
  const groups = useMemo(() => SERVICE_GROUPS.map((g) => {
    const gs = rows.filter((t) => t.sg === g);
    const rev = gs.reduce((s, t) => s + t.rev, 0);
    const profit = gs.reduce((s, t) => s + t.profit, 0);
    return { name: g, n: gs.length, rev, profit, margin: rev ? profit / rev * 100 : null };
  }), [rows]);

  const mapBlock = (
      <>
        {/* 4 — ดีไซน์ที่เจ้าของงานส่ง 24 ก.ย. 2569: แผนที่ (ซ้าย) · จัดอันดับ + รายละเอียดต้นทุน (ขวา) */}
        {/* การ์ดเดียวสองคอลัมน์: แผนที่ (ลากเส้นแบ่งปรับความกว้างได้) | จัดอันดับ + รายละเอียด */}
        <RouteMapCard routes={mapRoutes} onMissing={setMissing}
          chip={pickedRow ? pickedRow.rt : "กดเส้นทางในตารางเพื่อดูบนแผนที่"} chipLoss={!!pickedRow && pickedRow.profit < 0}
          cantDraw={!!pickedRow && (missing.includes(pickedRow.rt) || !pickedRow.o || !pickedRow.de)}>
            <section className="rp-sec">
              <header className="rp-sh">
                <span className="rp-ico green" aria-hidden="true">
                  <svg viewBox="0 0 24 24"><path d="M6 20V10M12 20V4M18 20v-7" /></svg>
                </span>
                <div className="rp-sht">
                  <h3>จัดอันดับเส้นทาง</h3>
                  <p>คลิกเส้นทางเพื่อดูรายละเอียดต้นทุน · กดซ้ำเพื่อปิด · # = อันดับกำไรต่อเที่ยว · ชิป = อัตรากำไรรายกลุ่มบริการ</p>
                </div>
              </header>
              <div className="rp-tblwrap">
                <SortTable rows={sorted} cols={cols} sort={sort} onSort={toggle} rowKey={(r) => r.rt}
                  empty="ไม่มีข้อมูลตามตัวกรองที่เลือก" className="rp-tbl rp-tbl-sg" maxHeight={detail ? 350 : 620}
                  rowProps={(r) => ({
                    className: r.rt === detail?.rt ? "on" : undefined,
                    // กดแถวเดิมซ้ำ = ยกเลิก แผนที่กลับเป็นแผนที่เปล่า (เจ้าของงานขอ 24 ก.ย. 2569)
                    onClick: () => { setPickedSg(null); setPicked((p) => (p === r.rt && !pickedSg ? null : r.rt)); },
                    title: r.rt === picked ? "กดอีกครั้งเพื่อเอาเส้นทางออกจากแผนที่" : "กดเพื่อดูรายละเอียดต้นทุนและเส้นทางบนแผนที่",
                  })} />
              </div>
            </section>

            {detail && (
              <section className="rp-sec">
                <RouteDetail r={detail} tree={costTree} sg={pickedSg} onAll={() => setPickedSg(null)} onList={() => setShowList(true)} />
              </section>
            )}
        </RouteMapCard>
      </>
  );
  const sgBlock = (
      <>
        {/* 5 — หัวข้อ "Service Category" (เจ้าของงานสั่ง 28 ก.ย. 2569) */}
        <h3 className="dm-sub-h">Service Category</h3>
        <div className="dm-sgs">
          {/* สี + ไอคอนตามชนิดสินค้า (เจ้าของงานสั่ง 28 ก.ย. 2569): ทั่วไป น้ำตาลอ่อน + กล่องพัสดุ · แช่เย็น ฟ้าอ่อน + กล่อง + ปรอท ·
              แช่แข็ง ฟ้าเข้มขึ้น + กล่อง + หิมะ · %เที่ยวที่ขาดทุนย้ายไปแถวสองของ 6 กล่องภาพรวมแล้ว */}
          {groups.map((g, i) => (
            <button key={g.name} type="button"
              className={`dm-sg c${i + 1} ${SG_STYLE[i]!.cls}` + (openGroup === g.name ? " open" : "")}
              aria-expanded={openGroup === g.name}
              onClick={() => setOpenGroup((p) => (p === g.name ? null : g.name))}
              title={openGroup === g.name ? "กดอีกครั้งเพื่อปิด" : "กดเพื่อดูกราฟและรายเส้นทางของกลุ่มนี้"}>
              {/* ชื่อกลุ่มตัวใหญ่ใกล้ขนาดตัวเลข · "อัตรากำไร" ตัวเล็กหน้าตัวเลข (เจ้าของงานสั่ง 28 ก.ย. 2569) */}
              <span className="l">{g.name}</span>
              <span className="dm-sg-vrow"><small>อัตรากำไร</small><span className="v">{g.margin == null ? "–" : pct(g.margin)}</span></span>
              <span className="s">{fmt(g.n)} เที่ยว · กำไร {signed(Math.round(g.profit))} บาท</span>
              <span className="dm-sg-ic" aria-hidden="true">{SG_STYLE[i]!.icon}</span>
            </button>
          ))}
        </div>
        {openGroup && <ServicePanel trips={rowsNoSg} groups={SERVICE_GROUPS} picked={openGroup}
          tone={SG_STYLE[SERVICE_GROUPS.indexOf(openGroup as (typeof SERVICE_GROUPS)[number])]?.cls} />}
      </>
  );

  // ★ 6 กล่องภาพรวม + กราฟรายเดือน (overview) วาดแยกเหนือกรอบส่วน Profit Per Route — ส่วนนี้เริ่มที่แผนที่ (เจ้าของงานสั่ง 28 ก.ย. 2569)
  if (overview) return (
    <>
    <Pane deps={[rows]}>
        {/* 1–2 — 6 กล่อง (ปรับปรุงโมเดล2.pdf · เจ้าของงานสั่ง 28 ก.ย. 2569 · เดิม 15 กล่อง) + การ์ด %เที่ยวที่ขาดทุน ต่อท้ายแถวสอง
            แถวบน (เด่น · เตี้ยลง): กำไร (+%Margin · ลูกศรขึ้น/ลงแทนกราฟ) · กำไรส่วนเกิน/ตัน-กม. · รายได้ + ต้นทุน (สีอ่อน)
            แถวสอง: กำไรเฉลี่ย/บิล · /เที่ยว · /ลูกค้า (รูป 3 มิติ) · %เที่ยวที่ขาดทุน (แดง กดดูรายการ)
            ตัดออก: ชนิดรถกำไรสูงสุด/ต่ำสุด · ชนิดรถต่ำกว่าเป้า (ยังอยู่ในแท็บ Contribution Margin ของ Overall) */}
        <div className="dz-heroes">
          <Hero kind={kpi.profit < 0 ? "loss" : "profit"} l={kpi.profit < 0 ? "ขาดทุน" : "กำไร"} v={signed(kpi.profit)} unit="บาท"
            s={<><b className="dm-margin">%Margin {pct(kpi.margin)}</b> กำไร ÷ รายได้</>} art={trendArrow(kpi.profit >= 0)} />
          <TonKmHero f={f} />
          <div className="dz-kc dm-duo">
            <div className="dm-duo-r">
              <span className="l">รายได้รวม</span>
              <b key={kpi.rev} className="v">{fmt(kpi.rev)}</b>
            </div>
            <div className="dm-duo-r">
              <span className="l">ต้นทุนรวม</span>
              <b key={kpi.cost} className="v">{fmt(kpi.cost)}</b>
            </div>
            <span className="dm-duo-u">บาท</span>
          </div>
        </div>
        <div className="dz-cards four dm-avg">
          <KC dot={D.indigo} tone={kpi.perBill < 0 ? "bad" : undefined} l="กำไรเฉลี่ย/บิล" icon={ICON_BILL}
            v={signed(Math.round(kpi.perBill))} s={`บาท ต่อบิล · ${fmt(kpi.bills)} บิลของใบรายการที่จับคู่ได้`} />
          <KC dot={D.violet} tone={kpi.perTrip < 0 ? "bad" : undefined} l="กำไรเฉลี่ย/เที่ยว" icon={ICON_PIN}
            v={signed(Math.round(kpi.perTrip))} s={`บาท ต่อเที่ยว · ${fmt(kpi.n)} เที่ยว`} />
          <KC dot={D.teal} tone={kpi.perCust < 0 ? "bad" : undefined} l="กำไรเฉลี่ย/ลูกค้า" icon={ICON_PERSON}
            v={signed(Math.round(kpi.perCust))} s={`บาท ต่อลูกค้า · ${fmt(kpi.custs)} ราย (ผู้จ่ายเงินไม่ซ้ำ)`} />
          {/* ย้ายมาจากแถวการ์ดกลุ่มบริการท้ายส่วน (เจ้าของงานสั่ง 28 ก.ย. 2569) */}
          <button type="button" className="dz-kc dm-loss" disabled={!kpi.loss} onClick={() => setShowLoss(true)}
            title={kpi.loss ? "กดดูรายการเที่ยวที่ขาดทุนทั้งหมด" : undefined}>
            <span className="l">เที่ยวที่ขาดทุน</span>
            <span className="v" key={kpi.lossPct}>{pct(kpi.lossPct)}</span>
            <span className="s">{kpi.loss ? `${fmt(kpi.loss)} จาก ${fmt(kpi.n)} เที่ยว · กดดูรายละเอียดรายการ` : "ไม่มีเที่ยวขาดทุน"}</span>
          </button>
        </div>
        <TonKmScope f={f} />

        {/* กราฟรายเดือน — ย้ายออกจากส่วน Profit Per Route มาอยู่กับ 6 กล่อง · ตั้งต้นเตี้ย กดขยายเป็นขนาดเดิม */}
        <div className="dz-cc dm-month">
          <div className="dm-month-h">
            <h4>เปรียบเทียบ รายได้ / ต้นทุน / กำไร · รายเดือน</h4>
            <button type="button" className="dm-month-btn" aria-expanded={chartBig} onClick={() => setChartBig((b) => !b)}>
              {chartBig ? "ย่อกราฟ" : "ขยายกราฟ"}
            </button>
          </div>
          <div className={"dz-box " + (chartBig ? "tall" : "dm-month-sm")}>
            <DLine data={monthly} xKey="mo" series={[
              { key: "รายได้", label: "รายได้", color: D.indigo },
              { key: "ต้นทุน", label: "ต้นทุน", color: D.rose },
              { key: "กำไร", label: "กำไร", color: D.emeraldLight },
            ]} />
          </div>
        </div>
    </Pane>
    {showLoss && (
      <TripsModal rt="เที่ยวที่ขาดทุน" trips={lossTrips} onClose={() => setShowLoss(false)} showRoute
        note="ทุกเที่ยวที่กำไรติดลบ ตามตัวกรองที่เลือกอยู่ · เรียงขาดทุนมากสุดก่อน"
        initialSort={{ key: "profit", dir: 1 }} />
    )}
    </>
  );

  return (
    <>
      <Pane deps={[rows]}>
        {/* Service Category อยู่เหนือแผนที่ทุกหน้า (เจ้าของงานสั่ง 28 ก.ย. 2569 · เดิม Executive Dashboard วางแผนที่ก่อน) */}
        {sgBlock}
        {/* ชื่อส่วน "Profit Per Route" อยู่เหนือแผนที่ ไม่ใช่บนสุดของส่วน (เจ้าของงานสั่ง 28 ก.ย. 2569 · DemoDash ส่ง partTitle มา) */}
        {partTitle && <h2 className="dm-part-h">{partTitle}</h2>}
        {mapBlock}
      </Pane>

      {showList && detail && (
        <TripsModal rt={pickedSg ? `${detail.rt} · ${pickedSg}` : detail.rt} trips={detailTrips} onClose={() => setShowList(false)} />
      )}
      {showLoss && (
        <TripsModal rt="เที่ยวที่ขาดทุน" trips={lossTrips} onClose={() => setShowLoss(false)} showRoute
          note="ทุกเที่ยวที่กำไรติดลบ ตามตัวกรองที่เลือกอยู่ · เรียงขาดทุนมากสุดก่อน"
          initialSort={{ key: "profit", dir: 1 }} />
      )}
    </>
  );
}

/**
 * การ์ดรายละเอียดของเส้นทางที่เลือก (ขวาล่าง) — ตัวเลขต่อเที่ยวสามช่อง · แถบรายได้แบ่งเป็นกำไร + ต้นทุนแต่ละกลุ่ม ·
 * รายการกำไร/ต้นทุนรวม/กลุ่มต้นทุน (% ของกำไรเทียบรายได้ · % ของต้นทุนเทียบต้นทุนรวม) ตามภาพดีไซน์ 24 ก.ย. 2569
 * ★ ขาดทุน: แถบยาวเท่าต้นทุน (รายได้ไม่พอคลุม) ไม่มีท่อนกำไร · "อื่น ๆ" ติดลบได้ แถบวาดเฉพาะค่าบวก
 */
function RouteDetail({ r, tree, sg, onAll, onList }: {
  r: RouteRow; tree: CostTree; sg: string | null; onAll: () => void; onList: () => void;
}) {
  const per = (v: number) => fmt(Math.round(v / (r.n || 1)));
  const loss = r.profit < 0;
  return (
    <>
      <header className="rp-sh rp-dh">
        <div className="rp-sht">
          <h3>{r.rt}{sg && <span className="rp-dsg">เฉพาะ{sg}</span>}</h3>
          <p>{fmt(r.n)} เที่ยว · {loss ? "ขาดทุนรวม" : "กำไรรวม"} {fmt(Math.round(Math.abs(r.profit)))} บาท
            {sg && <> · <button type="button" className="rp-dall" onClick={onAll}>ดูทุกกลุ่มบริการ</button></>}</p>
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
        <CostBreakdown tree={tree} n={r.n} cost={r.cost} />
      </div>
    </>
  );
}
