/**
 * ส่วนภาพรวมสาขาของ Manager Dashboard หน้าเดียว — เลย์เอาต์ตาม "Dashboard ผู้จัดการสาขา.html" (เจ้าของงานส่ง 28 ก.ย. 2569)
 * สี/การ์ดเป็นชุดของโมเดล (เจ้าของงานเลือก) · สูตรทั้งหมดอยู่ lib/manager/overview.ts
 *
 *   Verdict        แถบสรุปสถานการณ์บนสุด (จากกล่อง "ต้องจัดการ")
 *   MonthChart     รายได้ vs ค่าใช้จ่าย 6 เดือน (ล้านบาท)
 *   CostParts      ค่าใช้จ่ายแบ่งตามหมวด · เส้น = สัดส่วนเฉลี่ย 6 เดือนก่อน (ไม่มีงบ) · แดง = สูงกว่าเฉลี่ย
 *   CustRevenueBox รายได้แยกตามลูกค้า (ยอดวางบิลในไฟล์ลูกหนี้) เทียบช่วงก่อน + ป้ายเสี่ยงเสียลูกค้า
 *   AgingBox       แถบอายุลูกหนี้คงค้าง
 *   FleetBox       สถานะรถของสาขา ณ วันสิ้นช่วง + LF เฉลี่ย · %เที่ยวเปล่า
 *   CostBox        ต้นทุนต่อเที่ยว · น้ำมันต่อ กม. · ต้นทุนต่อ กม. · Margin
 */
import type { ReactNode } from "react";
import { fmt, pct } from "../dash-costrev/common";
import { ShortId } from "../../lib/custmap/ShortId";
import { numberForDebtor } from "../../lib/custmap/debtorCodes";
import { CUST_RISK_DROP, verdictOf } from "../../lib/manager/overview";
import type { CustRev } from "../../lib/manager/overview";
import { DEBT_STATUS_LABEL, issueLabel } from "../../lib/manager/manager";
import type { DebtStatus, MgrBill, Todo } from "../../lib/manager/manager";

/**
 * ยอดเงินบนการ์ด — หลักล้านเขียนเป็นล้านบาททศนิยม 2 ตำแหน่ง แบบ Executive Summary / ส่วน DSO
 * (เจ้าของงานเลือก 28 ก.ย. 2569 · เดิมบาทเต็มยาวจนการ์ดแรกถูกตัด "12,552,9…") · ต่ำกว่าล้านเขียนเต็มเป็นบาท
 */
export const money = (v: number): { v: string; unit: string } => (Math.abs(v) >= 1e6
  ? { v: (v / 1e6).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }), unit: "ล้านบาท" }
  : { v: fmt(Math.round(v)), unit: "บาท" });
export const moneyText = (v: number): string => { const m = money(v); return `${m.v} ${m.unit}`; };

/** "▲ 2.5% จากเดือนก่อน" · null = ช่วงก่อนไม่มีข้อมูล · goodUp = ขึ้นแล้วดี (รายได้) / ลงแล้วดี (ค่าใช้จ่าย) */
export function Delta({ v, vs, goodUp = true }: { v: number | null; vs: string; goodUp?: boolean }) {
  if (v == null) return <span className="mo-d">ไม่มีข้อมูล{vs}ให้เทียบ</span>;
  const good = v === 0 ? null : (v > 0) === goodUp;
  return <span className={"mo-d" + (good == null ? "" : good ? " up" : " dn")}>{v > 0 ? "▲" : v < 0 ? "▼" : "±"} {pct(Math.abs(v))} จาก{vs}</span>;
}

/* ---------------- แถบสรุปสถานการณ์ ---------------- */
export function Verdict({ todo, debts, period }: { todo: Todo; debts: boolean; period: string }) {
  const v = verdictOf(todo, debts);
  const bits: ReactNode[] = [];
  if (todo.fail) bits.push(<>เที่ยวไม่ผ่านเกณฑ์ <b>{fmt(todo.fail)}</b> เที่ยว</>);
  if (debts && todo.over30.bills) bits.push(<>ลูกค้าค้างเกิน 30 วัน <b>{fmt(todo.over30.cust)}</b> ราย</>);
  if (todo.topIssue) bits.push(<>{issueLabel(todo.topIssue.key)} <b>{fmt(todo.topIssue.n)}</b> เที่ยว</>);
  if (debts && todo.soon.bills) bits.push(<>บิลใกล้ครบกำหนด <b>{fmt(todo.soon.cust)}</b> ราย</>);
  const head = v.level === "bad" ? "ช่วงนี้ค่อนข้างเสี่ยง" : v.level === "warn" ? "ช่วงนี้ควรติดตาม" : "ช่วงนี้อยู่ในเกณฑ์ปกติ";
  return (
    <div className={`mo-verdict ${v.level}`} role="status">
      <b>{head}:</b>{" "}
      {bits.length ? <>{bits.map((b, i) => <span key={i}>{i > 0 && " · "}{b}</span>)} — จัดการ {v.count} เรื่องในกล่อง "ต้องจัดการ" ด้านล่างก่อน</>
        : <>ไม่มีเรื่องที่ต้องจัดการ{period}</>}
    </div>
  );
}

/* ---------------- กราฟ 6 เดือน ---------------- */
const TH_M = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
export function MonthChart({ data }: { data: { mo: string; rev: number; cost: number }[] }) {
  const max = Math.max(1, ...data.flatMap((d) => [d.rev, d.cost]));
  const m = (v: number) => (v / 1e6).toLocaleString("en-US", { maximumFractionDigits: 2 });
  return (
    <div>
      <div className="mo-chart" role="img" aria-label="กราฟรายได้และค่าใช้จ่าย 6 เดือน">
        {data.map((d) => (
          <div className="mo-col" key={d.mo}>
            <div className="mo-bars">
              <i className="rev" style={{ height: `${d.rev / max * 100}%` }} title={`รายได้ ${moneyText(d.rev)}`}><em>{m(d.rev)}</em></i>
              <i className="cost" style={{ height: `${d.cost / max * 100}%` }} title={`ค่าใช้จ่าย ${moneyText(d.cost)}`} />
            </div>
            <span>{TH_M[Number(d.mo.slice(5, 7)) - 1]}</span>
          </div>
        ))}
      </div>
      <div className="mo-lg"><span className="rev">รายได้</span><span className="cost">ค่าใช้จ่าย</span></div>
    </div>
  );
}

/* ---------------- ค่าใช้จ่ายตามหมวด ---------------- */
export function CostParts({ rows }: { rows: { key: string; label: string; v: number; share: number; avgShare: number | null }[] }) {
  const shown = rows.filter((r) => Math.abs(r.v) >= 0.5);
  const max = Math.max(1, ...shown.flatMap((r) => [r.share, r.avgShare ?? 0]));
  return (
    <div>
      {shown.map((r) => {
        const over = r.avgShare != null && r.share > r.avgShare + 0.05;
        return (
          <div className="mo-ex" key={r.key}>
            <span>{r.label}</span>
            <div className="mo-tr" title={`${pct(r.share)} ของค่าใช้จ่ายรวม${r.avgShare != null ? ` · เฉลี่ย 6 เดือนก่อน ${pct(r.avgShare)}` : ""}`}>
              <i className={over ? "over" : ""} style={{ width: `${Math.max(0, r.share) / max * 100}%` }} />
              {r.avgShare != null && <u style={{ left: `${Math.max(0, r.avgShare) / max * 100}%` }} />}
            </div>
            <span>{moneyText(r.v)}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ---------------- รายได้แยกตามลูกค้า ---------------- */
const TOP_CUST = 6;
export function CustRevenueBox({ list, total, top3, vs }: { list: CustRev[]; total: number; top3: number; vs: string }) {
  const top = list.slice(0, TOP_CUST);
  const rest = list.slice(TOP_CUST);
  const restAmt = rest.reduce((s, c) => s + c.amt, 0), restPrev = rest.reduce((s, c) => s + c.prev, 0);
  const chg = (c: number | null) => (c == null ? <span className="mo-d">ใหม่</span>
    : <span className={"mo-d " + (c >= 0 ? "up" : "dn")}>{c >= 0 ? "▲" : "▼"} {pct(Math.abs(c), 0)}</span>);
  if (!total) return <p className="dz-note">ไม่มีบิลที่วางในช่วงนี้</p>;
  return (
    <>
      <div className="mo-scroll">
        <table className="mo-tbl">
          <thead><tr><th>ลูกค้า</th><th className="n">รายได้ (ยอดวางบิล)</th><th className="n">เทียบ{vs}</th><th>สถานะ</th></tr></thead>
          <tbody>
            {top.map((c) => (
              <tr key={c.cust}>
                <td><ShortId v={c.cust} n={numberForDebtor(c.cust) ?? undefined} /></td>
                <td className="n">{moneyText(c.amt)}</td>
                <td className="n">{chg(c.change)}</td>
                <td>{c.risk ? <span className="mo-tag bad" title={`ยอดลดลงเกิน ${-CUST_RISK_DROP}% เทียบ${vs}`}>เสี่ยงเสียลูกค้า</span> : "ปกติ"}</td>
              </tr>
            ))}
            {rest.length > 0 && (
              <tr>
                <td>ลูกค้ารายอื่น ({fmt(rest.length)} ราย)</td>
                <td className="n">{moneyText(restAmt)}</td>
                <td className="n">{chg(restPrev ? (restAmt - restPrev) / restPrev * 100 : null)}</td>
                <td>{rest.filter((c) => c.risk).length ? <span className="mo-tag warn">เสี่ยง {fmt(rest.filter((c) => c.risk).length)} ราย</span> : "ปกติ"}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mo-note">ลูกค้า 3 รายใหญ่คิดเป็น {pct(top3, 0)} ของรายได้{top3 >= 50 ? " ควรกระจายความเสี่ยง" : ""}</p>
    </>
  );
}

/* ---------------- อายุลูกหนี้ ---------------- */
const AGING: { k: DebtStatus; cls: string }[] = [
  { k: "notdue", cls: "ok" }, { k: "late30", cls: "warn" }, { k: "late60", cls: "late" }, { k: "late61", cls: "bad" },
];
export function AgingBox({ open }: { open: MgrBill[] }) {
  const amt = Object.fromEntries(AGING.map(({ k }) => [k, 0])) as Record<DebtStatus, number>;
  for (const b of open) amt[b.status] += b.amount;
  const total = open.reduce((s, b) => s + b.amount, 0);
  const over60 = new Set(open.filter((b) => b.status === "late61").map((b) => b.cust)).size;
  if (!total) return <p className="dz-note">ไม่มีลูกหนี้คงค้าง ณ วันสิ้นช่วง</p>;
  return (
    <>
      <div className="mo-bar">{AGING.map(({ k, cls }) => amt[k] > 0 && (
        <i key={k} className={cls} style={{ width: `${amt[k] / total * 100}%` }} title={`${DEBT_STATUS_LABEL[k]} ${moneyText(amt[k])}`} />))}</div>
      <div className="mo-lg">{AGING.map(({ k, cls }) => (
        <span key={k} className={cls}>{DEBT_STATUS_LABEL[k]} {pct(amt[k] / total * 100, 0)}</span>))}</div>
      <p className="mo-note">{over60 ? `ควรตามหนี้เกิน 60 วัน ${fmt(over60)} รายก่อนสิ้นเดือน` : "ไม่มีหนี้เกิน 60 วัน"}</p>
    </>
  );
}

/* ---------------- สถานะรถ + ต้นทุน ---------------- */
export function FleetBox({ st, lfAvg, emptyPct }: {
  st: { total: number; running: number; idle: number; down: number }; lfAvg: number | null; emptyPct: number | null;
}) {
  const parts = [{ k: "running", cls: "run", label: "วิ่งงาน", n: st.running }, { k: "idle", cls: "ok", label: "ว่าง", n: st.idle },
    { k: "down", cls: "bad", label: "ไม่พร้อมใช้งาน", n: st.down }];
  return (
    <>
      {st.total ? <div className="mo-bar">{parts.map((p) => p.n > 0 && (
        <i key={p.k} className={p.cls} style={{ width: `${p.n / st.total * 100}%` }} title={`${p.label} ${fmt(p.n)} คัน`} />))}</div>
        : <p className="dz-note">ไม่มีรถในทะเบียนของสาขานี้</p>}
      <div className="mo-lg">{parts.map((p) => <span key={p.k} className={p.cls}>{p.label} {fmt(p.n)}</span>)}</div>
      <p className="mo-note">Load Factor เฉลี่ยต่อเที่ยว {lfAvg == null ? "–" : pct(lfAvg, 0)} · เที่ยวเปล่า {emptyPct == null ? "–" : pct(emptyPct, 0)} (เที่ยวที่กำลังวิ่งในช่วง)</p>
    </>
  );
}

export function CostBox({ k }: { k: { perTrip: number | null; fuelPerKm: number | null; costPerKm: number | null; margin: number | null } }) {
  const b = (v: number | null, d = 0) => (v == null ? "–" : `฿${v.toLocaleString("th-TH", { minimumFractionDigits: d, maximumFractionDigits: d })}`);
  return (
    <div className="mo-cost">
      <div>ต้นทุนต่อเที่ยว<b>{b(k.perTrip)}</b></div>
      <div>น้ำมันต่อ กม.<b>{b(k.fuelPerKm, 1)}</b></div>
      <div>ต้นทุนต่อ กม.<b>{b(k.costPerKm, 1)}</b></div>
      <div>กำไรขั้นต้น (Margin)<b className={k.margin != null && k.margin < 0 ? "neg" : ""}>{k.margin == null ? "–" : pct(k.margin)}</b></div>
    </div>
  );
}
