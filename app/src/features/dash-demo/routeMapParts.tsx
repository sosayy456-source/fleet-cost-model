/**
 * ชิ้นส่วนใช้ร่วมของ "การ์ดแผนที่เส้นทาง" — Profit Per Route (Executive Dashboard) และแผนที่เที่ยววิ่งเปล่า (Overall Dashboard › Empty Trips)
 * แยกออกมาจาก RouteProfitTab.tsx 26 ก.ย. 2569 ตอนเจ้าของงานสั่งทำแผนที่เที่ยววิ่งเปล่า "หลักการเหมือนกำไรเป๊ะ" — หน้าตาสองหน้าต้องเหมือนกัน
 *
 *   RouteMapCard   การ์ดเดียวสองคอลัมน์ .rp-wrap: แผนที่ (ซ้าย · ปุ่มขาว/ดำ · ชิปชื่อเส้นทาง · แถบลากปรับความกว้าง) | children (ขวา)
 *                  ความกว้าง/โหมดสีจำใน localStorage คีย์เดียวกันทั้งสองหน้า (rpMapPct · rpMapTheme)
 *   COST_TREE · buildCostTree · CostBreakdown   กลุ่มต้นทุนตามเอกสาร "การจัดประเภทต้นทุนสำหรับ Dashboard" + แถบสัดส่วน + รายการ
 */
import { useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { fmt, pct } from "../dash-costrev/common";
import RouteMap, { type MapRoute } from "./RouteMap";
import { fixedOf, otherOf, semiOf, variableOf } from "../../lib/data/useCostRev";
import type { Trip } from "../../lib/data/useCostRev";

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
export const RP = { profit: "#0f7a55", loss: "#c8384e", variable: "#4f46e5", semi: "#f59e0b", fixed: "#475569",
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

type CostVal = Omit<CostPart, "subs"> & { v: number };
export type CostTree = { group: string; parts: (CostVal & { subs: CostVal[] })[]; sum: number }[];

/** ต้นทุนของชุดเที่ยว แยกตามการจัดประเภท (ปกติ → ผันแปร/กึ่งผันแปร/คงที่/ค่าเช่า/อื่น ๆ · สูญเปล่า) — ก้อนที่เป็น 0 ไม่แสดง */
export function buildCostTree(trips: Trip[]): CostTree {
  const sum = (of: (t: Trip) => number) => trips.reduce((s, t) => s + of(t), 0);
  return COST_TREE.map((g) => {
    const parts = g.parts
      .map((p) => ({
        ...p, v: sum(p.of),
        subs: (p.subs ?? []).map((c) => ({ ...c, v: sum(c.of) })).filter((c) => Math.abs(c.v) > 0.5),
      }))
      .filter((p) => Math.abs(p.v) > 0.5);
    return { group: g.group, parts, sum: parts.reduce((s, p) => s + p.v, 0) };
  }).filter((g) => g.parts.length);
}

/**
 * แถบสัดส่วนต้นทุน (ไม่รวมกำไร) + รายการกลุ่มต้นทุน — % เทียบต้นทุนรวม · ค่าเป็นบาทต่อเที่ยว (÷ n)
 * ★ "อื่น ๆ" ติดลบได้ แถบจึงวาดเฉพาะค่าบวก
 */
export function CostBreakdown({ tree, n, cost }: { tree: CostTree; n: number; cost: number }) {
  const per = (v: number) => fmt(Math.round(v / n));
  const ofCost = (v: number) => (cost ? pct(v / cost * 100, 1) : "–");
  const parts = tree.flatMap((g) => g.parts);
  const barBase = parts.reduce((s, p) => s + Math.max(0, p.v), 0) || 1;
  return (
    <>
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
    </>
  );
}

/** ความกว้างคอลัมน์แผนที่ (%) — ค่าตั้งต้น/ขอบล่าง/ขอบบนตามดีไซน์ · คีย์ localStorage */
const MAP_PCT_KEY = "rpMapPct";
/** โหมดแผนที่ขาว/ดำ (เจ้าของงานขอ 24 ก.ย. 2569) — ค่าเริ่ม = ขาว (เปลี่ยนจากดำ 25 ก.ย. 2569) · จำรายเครื่องใน localStorage */
const MAP_THEME_KEY = "rpMapTheme";
const MAP_PCT_DEFAULT = 38, MAP_PCT_MIN = 20, MAP_PCT_MAX = 65;

/**
 * การ์ดแผนที่สองคอลัมน์ — แผนที่ (ซ้าย) | children (ขวา · เนื้อหาใน .rp-main)
 * @param routes    เส้นที่จะวาด (เส้นเดียวที่ผู้ใช้กด หรือว่าง) — memo ไว้ ไม่งั้นแผนที่วาดใหม่ทุก render
 * @param chip      ข้อความชิปมุมซ้ายบน · chipLoss = จุดในชิปสีแดง (ขาดทุน / เที่ยวเปล่า)
 * @param cantDraw  เส้นที่เลือกวาดไม่ได้ (ไม่มีพิกัด/ต้นทาง = ปลายทาง — ผู้เรียกดูจาก onMissing) → ขึ้นข้อความบนแผนที่
 */
export function RouteMapCard({ routes, chip, chipLoss, cantDraw, onMissing, label = "แผนที่เส้นทาง", children }: {
  routes: MapRoute[];
  chip: string;
  chipLoss?: boolean;
  cantDraw?: boolean;
  onMissing: (keys: string[]) => void;
  label?: string;
  children: ReactNode;
}) {
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

  return (
    <div ref={wrapRef} className={"rp-wrap" + (dragging ? " dragging" : "")}
      style={{ gridTemplateColumns: `${mapPct}% minmax(0,1fr)` }}>
      <section className="rp-mapcol" aria-label={label}>
        <div className={"rp-mapbox" + (mapDark ? "" : " light")}>
          <RouteMap routes={routes} onMissing={onMissing} dark={mapDark} />
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
            <i aria-hidden="true" className={chipLoss ? "loss" : undefined} />
            <span>{chip}</span>
          </div>
          {cantDraw && (
            <p className="rp-map-hint">แสดงบนแผนที่ไม่ได้ — ไม่มีพิกัดของต้นทาง/ปลายทาง หรือเป็นจุดเดียวกัน</p>
          )}
        </div>
        <div className="rp-resize" role="separator" aria-orientation="vertical" tabIndex={0}
          aria-valuenow={Math.round(mapPct)} aria-valuemin={MAP_PCT_MIN} aria-valuemax={MAP_PCT_MAX}
          aria-label="ปรับความกว้างแผนที่" title="ลากเพื่อปรับขนาด"
          onPointerDown={startDrag} onKeyDown={keyDrag}><span /></div>
      </section>

      <div className="rp-main">{children}</div>
    </div>
  );
}

/** ต้นทาง/ปลายทางของแต่ละเส้นทาง (rt = "ต้นทาง-ปลายทาง" จาก ETL) — เอาจากเที่ยวแรกของกลุ่ม แผนที่ใช้ชื่อจุดสองตัวนี้ */
export function useRouteEnds(rows: Trip[]): Map<string, { o: string; de: string }> {
  return useMemo(() => {
    const ends = new Map<string, { o: string; de: string }>();
    for (const t of rows) if (t.rt && !ends.has(t.rt)) ends.set(t.rt, { o: t.o, de: t.de });
    return ends;
  }, [rows]);
}
