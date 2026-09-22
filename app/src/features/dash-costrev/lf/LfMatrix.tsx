/**
 * ส่วนที่ 4 ของแท็บ "ต้นทุนที่จมกับที่ว่าง" — กราฟจุด 4 กลุ่ม (LF เทียบกำไรต่อเที่ยว)
 *
 * ★ มุมมองรายกลุ่ม (ชนิดรถ / เส้นทาง) เป็นค่าเริ่มต้นเสมอ — เจ้าของงานเคาะ 22 ก.ย. 2569: ข้อมูลจริงหลายหมื่นเที่ยว
 *   แต่จำนวนกลุ่มไม่เกินหลักร้อย จึงวาดได้เสมอโดยไม่ต้องตัดข้อมูลทิ้ง · จุดของกลุ่ม = LF เฉลี่ย × กำไรเฉลี่ยต่อเที่ยว
 *   ขนาด = ต้นทุนรวมของกลุ่ม · สรุป 4 กลุ่มยังนับจำนวนเที่ยวครบทุกเที่ยว (ไม่ใช่จำนวนจุด)
 * ★ มุมมองรายเที่ยวเปิดได้เมื่อกรองจนเหลือไม่เกิน TRIP_LIMIT เที่ยว (เช่น กดกลุ่มในส่วน "เสียตรงไหน" ก่อน)
 *   ถ้ายังเกิน ให้โชว์ตารางเรียงตามต้นทุนที่จมแทนการวาดจุด
 * ★ เส้นแบ่ง: โหมด "ค่าเฉลี่ย" = LF เฉลี่ยกับกำไรเฉลี่ยของชุดที่กรอง · โหมด "เป้า" = แกน X เป็น LF − เป้าของกลุ่ม เส้นแบ่งที่ 0
 * ★ แกน/กริด/พื้นที่อ้างอิงเขียนตรง ๆ เป็นลูกของ ScatterChart (Recharts หาลูกจาก displayName ห่อไม่ได้)
 */
import { useMemo, useState } from "react";
import {
  CartesianGrid, Cell, ReferenceArea, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis,
} from "recharts";
import { anim, axisProps, gridProps } from "../../../lib/chart/primitives";
import { D, DFONT, fmtShort, useChartTheme } from "../../../lib/chart/theme";
import type { LfTrip } from "../../../lib/data/useLoadFactor";
import { QUAD, QUAD_ORDER, groupTrips, matrix, pointsOfGroups, pointsOfTrips } from "../../../lib/loadfactor/calc";
import type { LfPoint, MatrixMode, Quad } from "../../../lib/loadfactor/calc";
import { Note } from "../../dash-fleet/parts";
import { SortTable, fmt, pct, useSort } from "../common";
import type { Col } from "../common";

/** ระยะขีดแกนแบบเลขกลม (1/2/5 × 10^n) — สูตรเดียวกับ niceStep ในสเปก */
const niceStep = (range: number, n: number): number => {
  const raw = range / n, p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
};

/** เพดานของมุมมองรายเที่ยว — เกินนี้โชว์ตารางแทน */
const TRIP_LIMIT = 1000;

type View = "vk" | "rt" | "trip";
const VIEW_LABEL: Record<View, string> = { vk: "รายชนิดรถ", rt: "รายเส้นทาง", trip: "รายเที่ยว" };
const QUAD_COLOR: Record<Quad, string> = { star: D.emerald, price: D.rose, value: D.indigo, waste: D.amber };

const pctOf = (x: number, d = 0): string => pct(x * 100, d);
const baht = (n: number): string => fmt(Math.round(n));

export default function LfMatrix({ trips }: { trips: LfTrip[] }) {
  const [view, setView] = useState<View>("vk");
  const [mode, setMode] = useState<MatrixMode>("avg");
  const tooMany = view === "trip" && trips.length > TRIP_LIMIT;

  const points = useMemo<LfPoint[]>(() => {
    if (view === "trip") return tooMany ? [] : pointsOfTrips(trips, mode);
    return pointsOfGroups(groupTrips(trips, view), mode, view === "vk" ? "ชนิดรถ" : "เส้นทาง");
  }, [trips, view, mode, tooMany]);
  const m = useMemo(() => matrix(points, mode), [points, mode]);

  const worst = QUAD_ORDER.map((q) => ({ q, ...m.quads[q] })).sort((a, b) => b.idle - a.idle)[0];
  const totalIdle = trips.reduce((s, t) => s + t.idle, 0);

  return (
    <>
      <div className="dz-row dz-2" style={{ marginTop: 10 }}>
        <div className="dz-cc">
          <div className="cp-th">
            <div>
              <h4 style={{ margin: 0 }}>แผนที่ 4 กลุ่ม · {VIEW_LABEL[view]}</h4>
              <p>{worst && worst.idle > 0
                ? `ต้นทุนที่จมกระจุกอยู่ในกลุ่ม "${QUAD[worst.q].name}" ${fmt(worst.n)} เที่ยว รวม ${baht(worst.idle)} บาท (${totalIdle ? pctOf(worst.idle / totalIdle) : "–"} ของที่จมทั้งหมด)`
                : "ไม่มีข้อมูลตามตัวกรอง"}</p>
            </div>
            <div className="lf-ctl">
              <div className="cp-seg" role="group" aria-label="มุมมอง">
                {(["vk", "rt", "trip"] as View[]).map((v) => (
                  <button key={v} type="button" className={view === v ? "on" : ""} onClick={() => setView(v)}
                    title={v === "trip" ? `วาดรายเที่ยวได้เมื่อกรองเหลือไม่เกิน ${fmt(TRIP_LIMIT)} เที่ยว` : undefined}>
                    {VIEW_LABEL[v]}</button>
                ))}
              </div>
              <label className="lf-mode">เส้นแบ่งความเต็ม
                <select value={mode} onChange={(e) => setMode(e.target.value as MatrixMode)}>
                  <option value="avg">ค่าเฉลี่ยของชุดที่กรอง</option>
                  <option value="target">เป้าของแต่ละกลุ่ม</option>
                </select>
              </label>
            </div>
          </div>
          {tooMany ? (
            <TripTable trips={trips} />
          ) : (
            <div className="dz-box tall">
              <QuadChart points={m.points} xLine={m.xLine} yLine={m.yLine} mode={mode} />
            </div>
          )}
        </div>
        <div className="dz-cc lf-qlist">
          <h4>สี่กลุ่ม และสิ่งที่ควรทำ</h4>
          {QUAD_ORDER.map((q) => {
            const s = m.quads[q];
            return (
              <div key={q} className="q">
                <b style={{ color: QUAD_COLOR[q] }}>{QUAD[q].name}</b>
                <span className="m"> ({fmt(s.n)} เที่ยว{view !== "trip" ? ` · ${fmt(s.points)} ${view === "vk" ? "ชนิดรถ" : "เส้นทาง"}` : ""}{s.n ? ` · ต้นทุนที่จม ${baht(s.idle)}` : ""})</span>
                <div className="a">{QUAD[q].act}</div>
              </div>
            );
          })}
          <Note>
            ค่าเฉลี่ยของชุดที่กรองใช้เป็นเส้นแบ่ง (ถ่วงด้วยจำนวนเที่ยว) · มุมมองรายกลุ่มวางจุดที่ LF เฉลี่ยกับกำไรเฉลี่ยต่อเที่ยวของกลุ่ม
            ส่วนจำนวนเที่ยวในวงเล็บนับทุกเที่ยวของกลุ่มนั้น · มุมมองรายเที่ยววาดได้เมื่อกรองเหลือไม่เกิน {fmt(TRIP_LIMIT)} เที่ยว
          </Note>
        </div>
      </div>
    </>
  );
}

function QuadChart({ points, xLine, yLine, mode }: { points: (LfPoint & { q: Quad })[]; xLine: number; yLine: number; mode: MatrixMode }) {
  const t = useChartTheme();
  const xs = points.map((p) => p.x), ys = points.map((p) => p.y);
  let x0: number, x1: number;
  if (mode === "avg") { x0 = 0; x1 = Math.max(1, Math.ceil((Math.max(...xs, 0.5) + 0.03) * 10) / 10); }
  else { x0 = Math.floor((Math.min(...xs, -0.1) - 0.02) * 10) / 10; x1 = Math.ceil((Math.max(...xs, 0.1) + 0.02) * 10) / 10; }
  // ขอบแกน Y ปัดเป็นเลขกลม ๆ (Recharts ไม่ปัดให้เมื่อกำหนด domain เอง ป้ายจะเป็น 26,067 / 12,310)
  const yStep = niceStep(Math.max(1, Math.max(...ys, 1) - Math.min(...ys, 0)), 6);
  const y0 = Math.floor(Math.min(...ys, 0) / yStep) * yStep, y1 = Math.ceil(Math.max(...ys, 1) * 1.06 / yStep) * yStep;
  const yTicks: number[] = [];
  for (let v = y0; v <= y1 + 1e-6; v += yStep) yTicks.push(v);
  const xTick = (v: number) => (mode === "avg" ? `${Math.round(v * 100)}%` : `${v > 0 ? "+" : ""}${Math.round(v * 100)}`);
  const data = points.map((p) => ({ ...p, xr: p.x, yr: p.y, size: p.size }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ScatterChart margin={{ top: 12, right: 18, left: 0, bottom: 8 }}>
        <CartesianGrid {...gridProps(t)} />
        <XAxis {...axisProps(t)} type="number" dataKey="xr" domain={[x0, x1]} tickFormatter={xTick}
          label={{ value: mode === "avg" ? "Max LF ของเที่ยว (%)" : "Max LF เทียบเป้าของกลุ่ม (จุด %)", position: "insideBottom", offset: -4, fill: t.ink2, fontFamily: DFONT, fontSize: 12 }} />
        <YAxis {...axisProps(t)} type="number" dataKey="yr" domain={[y0, y1]} ticks={yTicks} width={64} tickFormatter={fmtShort}
          label={{ value: "กำไรต่อเที่ยว (บาท)", angle: -90, position: "insideLeft", fill: t.ink2, fontFamily: DFONT, fontSize: 12 }} />
        <ZAxis type="number" dataKey="size" range={[50, 600]} />
        {/* พื้นสี่ช่อง — ชื่อกลุ่มอยู่มุมของแต่ละช่อง */}
        <ReferenceArea x1={x0} x2={xLine} y1={yLine} y2={y1} fill={QUAD_COLOR.value} fillOpacity={0.06}
          label={{ value: QUAD.value.name, position: "insideTopLeft", fill: QUAD_COLOR.value, fontFamily: DFONT, fontSize: 12.5, fontWeight: 700 }} />
        <ReferenceArea x1={xLine} x2={x1} y1={yLine} y2={y1} fill={QUAD_COLOR.star} fillOpacity={0.08}
          label={{ value: QUAD.star.name, position: "insideTopRight", fill: QUAD_COLOR.star, fontFamily: DFONT, fontSize: 12.5, fontWeight: 700 }} />
        <ReferenceArea x1={x0} x2={xLine} y1={y0} y2={yLine} fill={QUAD_COLOR.waste} fillOpacity={0.12}
          label={{ value: QUAD.waste.name, position: "insideBottomLeft", fill: QUAD_COLOR.waste, fontFamily: DFONT, fontSize: 12.5, fontWeight: 700 }} />
        <ReferenceArea x1={xLine} x2={x1} y1={y0} y2={yLine} fill={QUAD_COLOR.price} fillOpacity={0.06}
          label={{ value: QUAD.price.name, position: "insideBottomRight", fill: QUAD_COLOR.price, fontFamily: DFONT, fontSize: 12.5, fontWeight: 700 }} />
        <ReferenceLine x={xLine} stroke={t.ink2} strokeDasharray="5 4" />
        <ReferenceLine y={yLine} stroke={t.ink2} strokeDasharray="5 4" />
        <Tooltip cursor={{ strokeDasharray: "3 3" }} content={<PointTip />} />
        <Scatter data={data} fillOpacity={0.82} stroke="#fff" strokeWidth={1} {...anim}>
          {data.map((p, i) => <Cell key={i} fill={QUAD_COLOR[p.q]} />)}
        </Scatter>
      </ScatterChart>
    </ResponsiveContainer>
  );
}

function PointTip({ active, payload }: { active?: boolean; payload?: { payload: LfPoint & { q: Quad } }[] }) {
  const p = active && payload?.[0]?.payload;
  if (!p) return null;
  return (
    <div style={{ background: "#17161A", color: "#fff", borderRadius: 10, padding: 11, fontFamily: DFONT, fontSize: 13.5,
                  boxShadow: "0 8px 24px -8px rgba(0,0,0,.35)", maxWidth: 280 }}>
      <div style={{ fontWeight: 600 }}>{p.name} <span style={{ color: QUAD_COLOR[p.q] }}>· {QUAD[p.q].name}</span></div>
      <div style={{ opacity: .8 }}>{p.sub}</div>
      <div>LF {pctOf(p.lf)} (เป้า {pctOf(p.tg)}) · กำไร{p.n > 1 ? "เฉลี่ย" : ""} {baht(p.profit)} บาท{p.n > 1 ? "/เที่ยว" : ""}</div>
      <div>ต้นทุนที่จม {baht(p.idle)} บาท · ต้นทุนรวม {baht(p.size)} บาท</div>
    </div>
  );
}

/** เกินเพดานรายเที่ยว — ตารางเรียงตามต้นทุนที่จมแทนการวาดจุด (แสดงครบทุกแถวผ่าน GrowBox) */
function TripTable({ trips }: { trips: LfTrip[] }) {
  const cols = useMemo<Col<LfTrip>[]>(() => [
    { key: "id", label: "เลขที่ใบรายการ", get: (r) => r.id },
    { key: "mo", label: "เดือน", get: (r) => r.mo },
    { key: "pl", label: "ทะเบียน", get: (r) => r.pl || "–" },
    { key: "vk", label: "ชนิดรถ", get: (r) => r.vk },
    { key: "rt", label: "เส้นทาง", get: (r) => r.rt },
    { key: "lf", label: "LF", get: (r) => r.lf, num: true, render: (r) => pctOf(r.lf) },
    { key: "tg", label: "เป้า", get: (r) => r.tg, num: true, render: (r) => pctOf(r.tg) },
    { key: "profit", label: "กำไร", get: (r) => r.profit, num: true,
      render: (r) => <span style={{ fontWeight: 700, color: r.profit < 0 ? "var(--red)" : "var(--green)" }}>{baht(r.profit)}</span> },
    { key: "idle", label: "ต้นทุนที่จม", get: (r) => r.idle, num: true, render: (r) => <b>{baht(r.idle)}</b> },
  ], []);
  const { sorted, sort, toggle } = useSort(trips, cols, { key: "idle", dir: -1 });
  return (
    <>
      <p className="dz-note" style={{ marginTop: 0 }}>
        ชุดที่กรองมี {fmt(trips.length)} เที่ยว เกินเพดาน {fmt(TRIP_LIMIT)} จุดของกราฟ — แสดงเป็นตารางเรียงตามต้นทุนที่จมแทน
        (กดชนิดรถหรือเส้นทางในส่วน "เสียตรงไหน" หรือเลือกปี/เดือน เพื่อให้เหลือน้อยพอวาดจุด)
      </p>
      <SortTable rows={sorted} cols={cols} sort={sort} onSort={toggle} rowKey={(r) => r.id} empty="ไม่มีเที่ยว" />
    </>
  );
}
