/**
 * แผงที่กางออกมาเมื่อกดการ์ดกลุ่มบริการ (ท้ายแท็บกำไรรายเส้นทางของเมนู Demo)
 *
 *   บน  กราฟเส้นกำไรสุทธิรายเดือน 3 เส้น (หนึ่งเส้นต่อกลุ่มบริการ) สีเดียวกับการ์ด
 *       กลุ่มที่กดค้างไว้เป็นเส้นเด่น อีกสองเส้นจางลงเพื่อใช้เทียบ
 *   ล่าง ตารางรายเส้นทางของกลุ่มที่เลือก — คอลัมน์ชุดเดียวกับ "ตารางสรุป" ใน Executive Dashboard
 *       แต่ตัด ชนิดรถ กับ คำแนะนำ ออก และ **ยุบรวมทุกชนิดรถเป็นแถวเดียวต่อเส้นทาง** (เจ้าของงานเลือก 21 ก.ย. 2569)
 *
 * ★ ห้ามแก้ SummaryTable ของ Executive Dashboard — แผงนี้เขียนตารางของตัวเองแยกไว้
 * ★ ข้อมูลที่รับเข้ามา (`trips`) ผ่านตัวกรองของแท็บมาแล้ว **ยกเว้นกลุ่มบริการ** เพราะกราฟต้องวาดครบ 3 เส้น
 *   ส่วนตารางค่อยกรองด้วยกลุ่มที่กดการ์ดอีกที
 */
import { useMemo, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { anim, axisProps, gridProps, legendProps, tooltipProps } from "../../lib/chart/primitives";
import { D, fmtShort, useChartTheme } from "../../lib/chart/theme";
import { Note, TableHead } from "../dash-fleet/parts";
import TripsModal from "./TripsModal";
import { ListFF, SortTable, duniq, fmt, marginTone, monthLabel, pct, signed, useSort } from "../dash-costrev/common";
import type { Col } from "../dash-costrev/common";
import type { Trip } from "../../lib/data/useCostRev";

/** สีเดียวกับการ์ดสามใบ (index.css .dm-sg.c1/.c2/.c3) */
export const GROUP_COLORS: Record<string, string> = {
  "สินค้าทั่วไป": "#259b24",
  "สินค้าแช่เย็น": D.teal,
  "สินค้าแช่แข็ง": "#039be5",
};

const TOP_N = 10;
const F0 = { o: "", de: "", vk: "" };

interface RouteRow { rt: string; n: number; rev: number; cost: number; profit: number; margin: number | null }

export default function ServicePanel({ trips, groups, picked }: {
  /** เที่ยวที่ผ่านตัวกรองของแท็บแล้ว ยกเว้นตัวกรองกลุ่มบริการ */
  trips: Trip[];
  /** ชื่อกลุ่มบริการทั้งสามตามลำดับการ์ด */
  groups: readonly string[];
  picked: string;
}) {
  const [f, setF] = useState(F0);
  const set = (k: keyof typeof F0) => (v: string) => setF((p) => ({ ...p, [k]: v }));
  const [all, setAll] = useState(false);
  /** เส้นทางที่กดในตาราง → เปิดป็อบอัพรายการเที่ยว (เฉพาะกลุ่มบริการที่เลือกอยู่) */
  const [openRoute, setOpenRoute] = useState<string | null>(null);

  /* ---------- กราฟเส้น: กำไรสุทธิรายเดือนของทั้งสามกลุ่ม ---------- */
  const monthly = useMemo(() => {
    const months = [...new Set(trips.map((t) => t.mo))].sort();
    const acc = new Map<string, number>();
    for (const t of trips) {
      if (!groups.includes(t.sg)) continue;
      const k = `${t.mo}\u0000${t.sg}`;
      acc.set(k, (acc.get(k) ?? 0) + t.profit);
    }
    return months.map((mo) => {
      const row: Record<string, string | number | null> = { mo: monthLabel(mo) };
      for (const g of groups) row[g] = Math.round(acc.get(`${mo}\u0000${g}`) ?? 0);
      return row;
    });
  }, [trips, groups]);

  /* ---------- ตาราง: ยุบเป็นรายเส้นทางของกลุ่มที่เลือก ---------- */
  const scope = useMemo(() => trips.filter((t) =>
    t.sg === picked && (!f.o || t.o === f.o) && (!f.de || t.de === f.de) && (!f.vk || t.vk === f.vk)),
    [trips, picked, f]);

  const byRoute = useMemo<RouteRow[]>(() => {
    const m = new Map<string, RouteRow>();
    for (const t of scope) {
      const a = m.get(t.rt) ?? { rt: t.rt, n: 0, rev: 0, cost: 0, profit: 0, margin: null };
      a.n++; a.rev += t.rev; a.cost += t.cost; a.profit += t.profit;
      m.set(t.rt, a);
    }
    return [...m.values()].map((a) => ({
      ...a, margin: a.rev ? a.profit / a.rev * 100 : a.profit < 0 ? -100 : null,
    }));
  }, [scope]);

  const cols = useMemo<Col<RouteRow>[]>(() => [
    { key: "rt", label: "เส้นทาง", get: (r) => r.rt },
    { key: "n", label: "เที่ยว", get: (r) => r.n, num: true },
    { key: "rev", label: "รายได้", get: (r) => r.rev, num: true },
    { key: "cost", label: "ต้นทุนรวม", get: (r) => r.cost, num: true },
    { key: "profit", label: "กำไรสุทธิ", get: (r) => r.profit, num: true,
      render: (r) => <span style={{ fontWeight: 700, color: r.profit < 0 ? "var(--red)" : "var(--green)" }}>{signed(r.profit)}</span> },
    { key: "margin", label: "Margin", get: (r) => r.margin, num: true,
      render: (r) => <span style={{ fontWeight: 700, color: marginTone(r.margin) }}>
        {r.margin == null ? "–" : (r.margin > 0 ? "+" : "") + pct(r.margin)}</span> },
  ], []);
  const { sorted, sort, toggle } = useSort(byRoute, cols, { key: "profit", dir: -1 });
  const shown = useMemo(() => (all ? sorted : sorted.slice(0, TOP_N)), [all, sorted]);

  return (
    <div className="dm-panel">
      <div className="dz-cc">
        <h4>กำไรสุทธิรายเดือน · เทียบ 3 กลุ่มบริการ</h4>
        <div className="dz-box tall">
          <GroupLines data={monthly} groups={groups} picked={picked} />
        </div>
      </div>

      <div className="dz-cc" style={{ marginTop: 14 }}>
        <TableHead title={`รายเส้นทาง · ${picked}`}>
          <span className="dm-fix" title="ล็อกตามการ์ดที่กดไว้ กดการ์ดอื่นเพื่อเปลี่ยน">
            <i style={{ background: GROUP_COLORS[picked] ?? D.indigo }} />กลุ่มบริการ: <b>{picked}</b>
          </span>
          <ListFF label="ต้นทาง" all="ทุกต้นทาง" value={f.o} onChange={set("o")}
            opts={duniq(trips.filter((t) => t.sg === picked).map((t) => t.o))} />
          <ListFF label="ปลายทาง" all="ทุกปลายทาง" value={f.de} onChange={set("de")}
            opts={duniq(trips.filter((t) => t.sg === picked).map((t) => t.de))} />
          <ListFF label="ชนิดรถ" all="ทุกชนิดรถ" value={f.vk} onChange={set("vk")}
            opts={duniq(trips.filter((t) => t.sg === picked).map((t) => t.vk))} />
          <div className="fl-toggle" role="group" aria-label="จำนวนแถวที่แสดง">
            <button type="button" className={!all ? "on" : ""} onClick={() => setAll(false)}>{TOP_N} อันดับแรก</button>
            <button type="button" className={all ? "on" : ""} onClick={() => setAll(true)}>ทั้งหมด ({fmt(byRoute.length)})</button>
          </div>
        </TableHead>
        <SortTable rows={shown} cols={cols} sort={sort} onSort={toggle} rowKey={(r) => r.rt}
          empty="ไม่มีเส้นทางของกลุ่มบริการนี้ตามตัวกรองที่เลือก" className="dm-tbl"
          rowProps={(r) => ({ onClick: () => setOpenRoute(r.rt), title: "กดเพื่อดูรายการเที่ยวของเส้นทางนี้" })} />
        <Note>
          ยุบรวมทุกชนิดรถเป็นแถวเดียวต่อเส้นทาง · คอลัมน์ชุดเดียวกับตารางสรุปใน Executive Dashboard แต่ตัดชนิดรถกับคำแนะนำออก ·
          กลุ่มบริการล็อกตามการ์ดที่กด ส่วนตัวกรองอื่นของแท็บ (ปี · ต้นทาง–ปลายทาง · ประเภทรถ · ชนิดรถ) ยังมีผลกับแผงนี้ด้วย ·
          <b> กดที่แถวไหนก็ได้</b> เพื่อดูรายการเที่ยวของเส้นทางนั้น (เฉพาะกลุ่มบริการที่เลือก)
        </Note>
      </div>

      {openRoute && (
        <TripsModal rt={`${openRoute} · ${picked}`} trips={scope.filter((t) => t.rt === openRoute)}
          note={`ทุกเที่ยวของเส้นทางนี้ในกลุ่ม ${picked} ตามตัวกรองที่เลือกอยู่`}
          onClose={() => setOpenRoute(null)} />
      )}
    </div>
  );
}

/** กราฟเส้นสามกลุ่ม — เส้นที่เลือกหนาและทึบ อีกสองเส้นบางและจาง */
function GroupLines({ data, groups, picked }: {
  data: Record<string, string | number | null>[]; groups: readonly string[]; picked: string;
}) {
  const t = useChartTheme();
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid {...gridProps(t)} />
        <XAxis {...axisProps(t)} dataKey="mo" />
        <YAxis {...axisProps(t)} width={66} tickFormatter={fmtShort} />
        <Tooltip {...tooltipProps(t, " บาท")} />
        <Legend {...legendProps} />
        {groups.map((g) => {
          const on = g === picked;
          return (
            <Line key={g} type="monotone" dataKey={g} name={g} stroke={GROUP_COLORS[g] ?? D.indigo}
              strokeWidth={on ? 3.2 : 1.6} strokeOpacity={on ? 1 : 0.38}
              dot={false} activeDot={{ r: on ? 6 : 4 }} connectNulls {...anim} />
          );
        })}
      </LineChart>
    </ResponsiveContainer>
  );
}
