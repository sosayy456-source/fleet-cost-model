/**
 * ป็อบอัพรายละเอียดเที่ยว — กดที่แถวในหน้า "รายการทั้งหมด" (สเปก Role Accounting 22 ก.ย. 2569)
 *
 * สองมุมมอง สลับด้วยปุ่มที่หัวป็อบอัพ:
 *   1. รายการบิล        ทุกบิลของเที่ยวนั้น พร้อมกำไร / รายได้ / ต้นทุนที่จัดสรร
 *                       ต้นทุนจัดสรรของบิล = ต้นทุนทั้งเที่ยว × สัดส่วนรายได้ของบิลนั้น
 *                       (บิลที่รายได้รวมเป็น 0 ทั้งใบ → หารเท่ากันทุกบิล เพื่อไม่ให้ตกหล่น)
 *   2. ต้นทุนจริงเทียบพยากรณ์  แยกตามกลุ่มต้นทุน พร้อมผลต่างรายกลุ่ม
 *                       พยากรณ์มาจากค่าเฉลี่ยข้อมูลเก่า N เดือนล่าสุด (lib/forecast/)
 *
 * ★ วาดผ่าน portal ไป body — หน้ารายการทั้งหมดไม่ได้อยู่ใต้ #view-dash จึงไม่ต้องห่วงโทเคนสีแดชบอร์ด
 */
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { thDateSafe } from "../../lib/record/date";
import { forecastFor } from "../../lib/forecast/forecast";
import type { CostParts, ForecastTable } from "../../lib/forecast/forecast";
import type { TripRecord } from "../../types/record";

const baht = (v: number): string => Math.round(v).toLocaleString("th-TH");
const signed = (v: number): string => (v > 0 ? "+" : v < 0 ? "−" : "") + baht(Math.abs(v));

/** ต้นทุนจริงของใบ แยกตามกลุ่มเดียวกับฝั่งพยากรณ์ */
function actualParts(r: TripRecord): CostParts {
  const fuel = Number(r.fuelSum) || 0;
  const allow = Number(r.labor) || 0;
  const fee = Number(r.fees) || 0;
  const repair = Number(r.repTotal) || 0;
  const waste = Number(r.waste) || 0;
  const normal = Number(r.normal) || 0;
  return {
    fuel, allow, fee, repair, waste,
    // ใบที่กรอกในโมเดลไม่มีช่องค่าเสื่อม/ค่าเช่าแยก (อยู่ในต้นทุนรวมของไฟล์เก่าเท่านั้น)
    dep: 0, rent: 0,
    other: Math.round((normal - fuel - allow - fee - repair) * 100) / 100,
  };
}

const PART_LABEL: { key: keyof CostParts; label: string }[] = [
  { key: "fuel", label: "ค่าน้ำมัน" },
  { key: "allow", label: "ค่าเบี้ยเลี้ยง/ค่าแรง" },
  { key: "fee", label: "ค่าธรรมเนียม" },
  { key: "repair", label: "ค่าซ่อม" },
  { key: "dep", label: "ค่าเสื่อม" },
  { key: "rent", label: "ค่าเช่า" },
  { key: "waste", label: "ต้นทุนสูญเปล่า" },
  { key: "other", label: "อื่น ๆ" },
];

export default function TripDetailModal({ rec, table, onClose }: {
  rec: TripRecord; table: ForecastTable | null; onClose: () => void;
}) {
  const [view, setView] = useState<"bills" | "cost">("bills");

  useEffect(() => {
    const on = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", on);
    return () => document.removeEventListener("keydown", on);
  }, [onClose]);

  const bills = rec.bills ?? [];
  const cost = Number(r0(rec.normal)) + Number(r0(rec.waste));
  const revenue = Number(r0(rec.revenue));

  /** ปันต้นทุนทั้งเที่ยวเข้าบิลตามสัดส่วนรายได้ — รายได้รวมเป็น 0 ให้หารเท่ากัน */
  const rows = useMemo(() => {
    const totals = bills.map((b) => Number(b.total) || 0);
    const sum = totals.reduce((s, v) => s + v, 0);
    return bills.map((b, i) => {
      const share = sum > 0 ? (totals[i] ?? 0) / sum : bills.length ? 1 / bills.length : 0;
      const alloc = Math.round(cost * share * 100) / 100;
      return { b, rev: totals[i] ?? 0, alloc, profit: (totals[i] ?? 0) - alloc };
    });
  }, [bills, cost]);

  const forecast = table ? forecastFor(table, rec.origin, rec.dest, rec.vehicle) : null;
  const actual = actualParts(rec);
  const diff = forecast ? cost - forecast.cost : null;

  return createPortal(
    <div className="modal-bg" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal wide sm-modal" role="dialog" aria-modal="true" aria-label="รายละเอียดเที่ยว">
        <div className="sm-mh">
          <div className="sm-mt">
            <div className="modal-h">ใบ {rec.docNo || "–"} <span>· {rec.origin || "–"}→{rec.dest || "–"}</span></div>
            <p>
              {thDateSafe(rec.date)} · {rec.plate || "ไม่ระบุทะเบียน"} · {rec.vehicle || "ไม่ระบุชนิดรถ"} ·
              รายได้ {baht(revenue)} · ต้นทุนจริง {baht(cost)} ·
              กำไร <b style={{ color: revenue - cost < 0 ? "var(--red)" : "var(--green)" }}>{signed(revenue - cost)}</b> บาท
            </p>
          </div>
          <button type="button" className="sm-x" onClick={onClose} aria-label="ปิด">✕</button>
        </div>

        <div className="cp-seg" role="group" aria-label="เลือกมุมมอง">
          <button type="button" className={view === "bills" ? "on" : ""} onClick={() => setView("bills")}>
            รายการบิล ({bills.length})
          </button>
          <button type="button" className={view === "cost" ? "on" : ""} onClick={() => setView("cost")}>
            ต้นทุนจริง เทียบ พยากรณ์
          </button>
        </div>

        <div className="sm-list">
          {view === "bills" ? (
            <table className="tbl">
              <thead><tr>
                <th>เลขที่บิล</th><th>ประเภทสินค้า</th><th>ผู้ส่ง → ผู้รับ</th><th>เส้นทาง</th>
                <th className="n">จำนวน</th><th className="n">รายได้</th>
                <th className="n">ต้นทุนที่จัดสรร</th><th className="n">กำไร</th>
              </tr></thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={8} style={{ textAlign: "center", padding: 16, color: "var(--ink-faint)" }}>
                    ใบนี้ยังไม่มีบิล</td></tr>
                ) : rows.map(({ b, rev, alloc, profit }, i) => (
                  <tr key={`${b.no}-${i}`}>
                    <td><b>{b.no || "–"}</b></td>
                    <td>{b.goodsType || "–"}</td>
                    <td>{b.sender || "–"} → {b.receiver || "–"}</td>
                    <td>{b.origin || "–"}–{b.dest || "–"}</td>
                    <td className="n">{baht(Number(b.qty) || 0)}</td>
                    <td className="n">{baht(rev)}</td>
                    <td className="n">{baht(alloc)}</td>
                    <td className="n" style={{ fontWeight: 700, color: profit < 0 ? "var(--red)" : "var(--green)" }}>
                      {signed(profit)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr>
                <td colSpan={5}>รวม</td>
                <td className="n"><b>{baht(rows.reduce((s, x) => s + x.rev, 0))}</b></td>
                <td className="n"><b>{baht(rows.reduce((s, x) => s + x.alloc, 0))}</b></td>
                <td className="n"><b>{signed(rows.reduce((s, x) => s + x.profit, 0))}</b></td>
              </tr></tfoot>
            </table>
          ) : (
            <>
              <div className={"dispatch-result " + (diff == null ? "" : diff <= 0 ? "good" : "bad")}>
                <div className="box"><span>ต้นทุนจริง</span><b>{baht(cost)} บาท</b></div>
                <div className="box"><span>ต้นทุนพยากรณ์</span>
                  <b>{forecast ? `${baht(forecast.cost)} บาท` : "—"}</b></div>
                <div className="box"><span>ผลต่าง</span>
                  <b>{diff == null ? "—" : `${signed(diff)} บาท`}</b></div>
              </div>
              <table className="tbl" style={{ marginTop: 12 }}>
                <thead><tr>
                  <th>กลุ่มต้นทุน</th><th className="n">จริง</th><th className="n">พยากรณ์</th><th className="n">ผลต่าง</th>
                </tr></thead>
                <tbody>
                  {PART_LABEL.map(({ key, label }) => {
                    const a = actual[key];
                    const f = forecast?.parts[key] ?? 0;
                    const d = a - f;
                    if (!a && !f) return null;
                    return (
                      <tr key={key}>
                        <td>{label}</td>
                        <td className="n">{baht(a)}</td>
                        <td className="n">{forecast ? baht(f) : "—"}</td>
                        <td className="n" style={{ color: d > 0 ? "var(--red)" : d < 0 ? "var(--green)" : undefined }}>
                          {forecast ? signed(d) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="price-note" style={{ marginTop: 10 }}>
                {forecast
                  ? <>พยากรณ์จากค่าเฉลี่ยข้อมูลเก่า <b>{forecast.n}</b> เที่ยว ({forecast.note}) ·
                      ช่วง {forecast.from} – {forecast.to} · ตั้งจำนวนเดือนได้ที่หน้าการตั้งค่า ·
                      ผลต่างเป็นบวก = จ่ายจริงมากกว่าที่พยากรณ์ไว้</>
                  : "ยังไม่มีไฟล์ต้นทุนรายเที่ยวให้เทียบ — วางไฟล์แล้วรัน ETL จึงจะเห็นต้นทุนพยากรณ์"}
                {" "}· ใบที่กรอกในโมเดลยังไม่มีช่องค่าเสื่อม/ค่าเช่าแยก จึงเทียบได้เฉพาะกลุ่มที่มีทั้งสองฝั่ง
              </p>
            </>
          )}
        </div>

        <div className="modal-actions">
          <button type="button" className="btn-ghost" onClick={onClose}>ปิด</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** ค่าที่อาจเป็น undefined ในใบเก่า — คืน 0 แทน NaN */
function r0(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
