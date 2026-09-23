/**
 * กราฟ "อัตรารายชนิดรถ เทียบเป้าหมาย" — แท่งนอน Recharts ชุดเดียวกับกราฟอื่นของแดชบอร์ด
 * (เจ้าของงานให้ทำใหม่ 23 ก.ย. 2569 — แบบ HTML เดิมมีรางว่างยาวทางซ้ายของศูนย์เพราะมีชนิดรถติดลบ และสีไล่ดูจาง)
 *
 *   แท่ง   = อัตรากำไรส่วนเกิน/ตัน-กม. ของช่วงที่เลือก · สีทึบตามสถานะ (ชุดเดียวกับป้ายสถานะ)
 *   ขีดตั้ง = เป้าหมายของชนิดรถนั้น (Scatter รูปขีด) · ไม่มีเป้า = ไม่มีขีด
 *   เส้นศูนย์ขึ้นเฉพาะเมื่อมีชนิดรถติดลบ · tooltip บอกอัตรา เป้า % ของเป้า สถานะ และจำนวนเที่ยว
 *
 * ★ แกน/กริดเขียนตรง ๆ เป็นลูกของกราฟ — ห่อไม่ได้ (ดู lib/chart/primitives.ts)
 */
import {
  Bar, CartesianGrid, Cell, ComposedChart, LabelList, ReferenceLine, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis,
} from "recharts";
import { anim, axisProps, gridProps } from "../../../lib/chart/primitives";
import { DFONT, useChartTheme } from "../../../lib/chart/theme";
import { STATUS_LABEL } from "../../../lib/tonkm/calc";
import type { TkStatus, VkRow } from "../../../lib/tonkm/calc";
import { fmt, pct } from "../common";
import { rateStr } from "./TonKmCards";

/** สีแท่งตามสถานะ — ตรงกับ .tk-tag / .tk-legend ใน index.css */
export const STATUS_COLOR: Record<TkStatus, string> = {
  ok: "#10B981", near: "#F59E0B", far: "#F43F5E", vcloss: "#F43F5E", nobase: "#CBD5E1", nodata: "#CBD5E1",
};

interface Pt { vk: string; rate: number; target: number | null; status: TkStatus; n: number; pct: number | null }

const ROW_H = 38;

/** ขีดเป้าหมาย — ขอบขาวให้แยกจากแท่งที่อยู่ใต้ */
function Tick({ cx, cy }: { cx?: number; cy?: number }) {
  if (cx == null || cy == null) return null;
  return <rect x={cx - 2} y={cy - 12} width={4} height={24} rx={2} fill="#17161A" stroke="#fff" strokeWidth={1.5} />;
}

function Tip({ active, payload }: { active?: boolean; payload?: { payload: Pt }[] }) {
  const p = active && payload?.[0]?.payload;
  if (!p) return null;
  return (
    <div style={{ background: "#17161A", color: "#fff", borderRadius: 12, padding: "10px 13px", fontFamily: DFONT,
                  fontSize: 13.5, lineHeight: 1.6, boxShadow: "0 10px 28px -10px rgba(0,0,0,.45)" }}>
      <div style={{ fontWeight: 700, fontSize: 14.5 }}>{p.vk}</div>
      <div><b>{rateStr(p.rate)}</b> บาท/ตัน-กม. · {fmt(p.n)} เที่ยว</div>
      <div style={{ opacity: 0.8 }}>
        {p.target != null ? `เป้าหมาย ${rateStr(p.target)}` : "ไม่มีเป้าหมาย"}
        {p.pct != null && ` · ${pct(p.pct, 0)} ของเป้า`}
      </div>
      <div style={{ color: STATUS_COLOR[p.status], fontWeight: 700 }}>{STATUS_LABEL[p.status]}</div>
    </div>
  );
}

export default function TonKmChart({ rows }: { rows: VkRow[] }) {
  const t = useChartTheme();
  const data: Pt[] = rows.filter((r) => r.cur.rate != null).map((r) => ({
    vk: r.vk, rate: r.cur.rate!, target: r.target, status: r.status, n: r.cur.n, pct: r.pctOfTarget,
  }));
  if (!data.length) return <p className="dz-note">ไม่มีเที่ยวในช่วงนี้</p>;
  const hasNeg = data.some((d) => d.rate < 0);
  const nameW = Math.min(200, Math.max(90, Math.max(...data.map((d) => d.vk.length)) * 7.6 + 14));
  return (
    <div style={{ height: data.length * ROW_H + 36 }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} layout="vertical" margin={{ top: 4, right: 56, left: 0, bottom: 0 }} barCategoryGap="32%">
          <CartesianGrid {...gridProps(t)} horizontal={false} />
          <XAxis {...axisProps(t)} type="number" tickFormatter={(v: number) => fmt(v, 1)} axisLine={false}
            domain={[hasNeg ? "dataMin" : 0, "auto"]} />
          <YAxis {...axisProps(t)} type="category" dataKey="vk" width={nameW} axisLine={false} />
          <Tooltip cursor={{ fill: t.grid, fillOpacity: 0.7 }} content={<Tip />} />
          {hasNeg && <ReferenceLine x={0} stroke={t.ink2} strokeOpacity={0.5} />}
          <Bar dataKey="rate" radius={6} {...anim}>
            {data.map((d) => <Cell key={d.vk} fill={STATUS_COLOR[d.status]} />)}
            <LabelList dataKey="rate" position="right" offset={8}
              formatter={(v: unknown) => (typeof v === "number" ? rateStr(v) : "")}
              style={{ fontFamily: DFONT, fontSize: 13, fontWeight: 700, fill: t.ink }} />
          </Bar>
          <Scatter dataKey="target" shape={<Tick />} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
