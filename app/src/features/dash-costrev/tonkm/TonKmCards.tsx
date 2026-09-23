/**
 * การ์ด 4 ใบของกำไรส่วนเกิน/ตัน-กม. — ใช้สองที่ (เจ้าของงานเคาะ 23 ก.ย. 2569)
 *   · เมนู Demo › กำไรรายเส้นทาง ต่อจากแถว "กำไรเฉลี่ย/บิล" — ช่วงเวลาตรึงที่เดือนล่าสุด กดแล้วไปแท็บรายละเอียด
 *   · Executive Dashboard › แท็บ "กำไรส่วนเกิน/ตัน-กม." — ตามตัวกรองปี/เดือนของแท็บ
 *
 *   1. อัตราเฉลี่ยรวมของช่วง + % เปลี่ยนเทียบช่วงก่อน
 *   2. ชนิดรถอัตราสูงสุด · 3. ต่ำสุด — พร้อมเป้าหมายและป้ายสถานะ
 *   4. จำนวนชนิดรถที่ต่ำกว่าเป้าเฉพาะตัว (รวมชนิดที่ Baseline ≤ 0 — ป้าย "ต่ำกว่าเป้า" เหมือนกัน)
 *
 * ★ ชื่อชนิดรถใช้ .tk-name ไม่ใช่ .v — useCountUp ไล่ตัวเลขทุก .dz-kc .v "รถ 10 ล้อ" จะถูกนับขึ้นจาก 0
 */
import type { CSSProperties, ReactNode } from "react";
import { D } from "../../../lib/chart/theme";
import { STATUS_LABEL, isJudged } from "../../../lib/tonkm/calc";
import type { BaseYears, TkOverview, TkPeriod, TkStatus, VkRow } from "../../../lib/tonkm/calc";
import { fmt, monthName } from "../common";

export const rateStr = (r: number | null): string => (r == null ? "–" : fmt(r, 2));
export const periodStr = (p: TkPeriod): string =>
  (p.month ? `${monthName(p.month)} ` : "ทั้งปี ") + (p.year + 543);

export function StatusTag({ s }: { s: TkStatus }) {
  return <span className={`tk-tag ${s}`}>{STATUS_LABEL[s]}</span>;
}

/** จำนวนปีฐานที่ใช้คิดเป้า — ตามป้าย 2ปี/1ปี ในสไลด์ · 0 ไม่ต้องโชว์ (ป้ายสถานะ "ไม่มีฐาน" บอกอยู่แล้ว) */
export function BaseTag({ n }: { n: BaseYears }) {
  if (!n) return null;
  return <span className={`tk-base n${n}`} title={n === 2 ? "Baseline จาก 2 ปีก่อนหน้า (40/60)" : "มีข้อมูลปีก่อนหน้าปีเดียว — Baseline ใช้ปีนั้นปีเดียว"}>{n}ปี</span>;
}

function Card({ edge, onClick, children }: { edge: string; onClick?: () => void; children: ReactNode }) {
  const press = onClick ? {
    role: "button", tabIndex: 0, onClick,
    onKeyDown: (e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } },
    title: "กดเพื่อดูรายละเอียดใน Executive Dashboard",
  } : {};
  return (
    <div className={"dz-kc tk-card" + (onClick ? " clickable" : "")} style={{ "--edge": edge } as CSSProperties} {...press}>
      {children}
    </div>
  );
}

function VkCard({ label, row, edge, onClick }: { label: string; row: VkRow | null; edge: string; onClick?: () => void }) {
  return (
    <Card edge={edge} onClick={onClick}>
      <div className="l">{label}</div>
      {row ? (
        <>
          <div className="tk-name">{row.vk}</div>
          <div className="s">
            {rateStr(row.cur.rate)} บาท/ตัน-กม. · เป้าหมาย {rateStr(row.target)}
          </div>
          <div className="tk-foot"><StatusTag s={row.status} /></div>
        </>
      ) : <div className="tk-name">–</div>}
    </Card>
  );
}

export default function TonKmCards({ ov, x, onClick }: { ov: TkOverview; x: number; onClick?: () => void }) {
  const up = ov.change != null && ov.change >= 0;
  const judged = ov.rows.filter((r) => isJudged(r.status)).length;
  return (
    <div className="dz-cards four tk-cards">
      <Card edge={D.emerald} onClick={onClick}>
        {/* ไม่ใส่เดือน/ปีในหัวการ์ด (เจ้าของงานสั่ง 23 ก.ย. 2569) — ช่วงเวลาดูจากบรรทัดเทียบข้างล่างและชี้เมาส์ */}
        <div className="l" title={`ช่วง ${periodStr(ov.period)}`}>กำไรส่วนเกิน/ตัน-กม. เฉลี่ยรวม</div>
        <div className="tk-vrow">
          {/* key + data-real — ดูเหตุผลที่ useCountUp() */}
          <div className="v" key={rateStr(ov.all.rate)} data-real={rateStr(ov.all.rate)}>{rateStr(ov.all.rate)}</div>
          <span className="tk-unit">บาท/ตัน-กม.</span>
        </div>
        <div className="s">
          {ov.change == null ? `ไม่มีข้อมูล${periodStr(ov.prev)}ให้เทียบ` : (
            <span className={up ? "tk-up" : "tk-down"}>
              {up ? "▲" : "▼"} {fmt(Math.abs(ov.change), 1)}% เทียบ{ov.period.month ? "เดือน " : ""}{periodStr(ov.prev)}
            </span>
          )}
        </div>
      </Card>
      <VkCard label="ชนิดรถกำไรสูงสุด" row={ov.best} edge={D.indigoDeep} onClick={onClick} />
      <VkCard label="ชนิดรถกำไรต่ำสุด" row={ov.worst} edge={D.rose} onClick={onClick} />
      <Card edge={ov.below ? D.rose : D.emerald} onClick={onClick}>
        <div className="l">ชนิดรถต่ำกว่าเป้าเฉพาะตัว</div>
        <div className="tk-vrow">
          <div className="v" key={String(ov.below)} data-real={String(ov.below)}>{fmt(ov.below)}</div>
          <span className="tk-unit">จาก {fmt(judged)} ชนิด</span>
        </div>
        <div className="s">
          เป้าหมาย = Baseline × (1 + {fmt(x, x % 1 ? 1 : 0)}%)
        </div>
      </Card>
    </div>
  );
}
