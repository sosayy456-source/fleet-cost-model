/**
 * ป็อบอัพรายละเอียดเที่ยว — กดที่แถวในหน้า "รายการทั้งหมด" (สเปก Role Accounting 22 ก.ย. 2569)
 *
 * สองมุมมอง สลับด้วยปุ่มที่หัวป็อบอัพ:
 *   1. รายการบิล        ทุกบิลของเที่ยวนั้น พร้อมกำไร / รายได้ / ต้นทุนที่จัดสรร + ที่มาของต้นทุน (breakdown)
 *                       ★ 27 ก.ย. 2569 (เจ้าของงานสั่ง) ปันตามการใช้ทรัพยากรรถ แทนสัดส่วนรายได้ — สูตรใน lib/alloc/tripAlloc.ts
 *                       (ชุดเดียวกับ ETL ปันส่วนของ Customer Performance): CF จากความจุรถหัว + หาง ·
 *                       น้ำหนักเทียบเท่า = MAX(น้ำหนัก, ปริมาตร × CF) · Metric = × ระยะทางของบิล · ปันตามสัดส่วน Metric
 *                       น้ำหนัก/ปริมาตรมาจากบิลที่ CS กรอก (useBills) — บิลที่หาต้นฉบับไม่เจอปันตามรายได้
 *   2. ต้นทุนจริงเทียบพยากรณ์  แยกตามกลุ่มต้นทุน พร้อมผลต่างรายกลุ่ม
 *                       พยากรณ์มาจากค่าเฉลี่ยข้อมูลเก่า N เดือนล่าสุด (lib/forecast/)
 *
 * ★ วาดผ่าน portal ไป body — หน้ารายการทั้งหมดไม่ได้อยู่ใต้ #view-dash จึงไม่ต้องห่วงโทเคนสีแดชบอร์ด
 */
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { thDateSafe } from "../../lib/record/date";
import { forecastFor, recordParts } from "../../lib/forecast/forecast";
import { allocateTrip } from "../../lib/alloc/tripAlloc";
import { recordAllocItems, recordCapacity } from "../../lib/alloc/recordAlloc";
import { useBills } from "../../lib/store/bills";
import { useOverrides } from "../../lib/store/overrides";
import { COST_PART_LABELS } from "../../lib/forecast/forecast";
import type { ForecastTable } from "../../lib/forecast/forecast";
import type { TripRecord } from "../../types/record";

const baht = (v: number): string => Math.round(v).toLocaleString("th-TH");
const num = (v: number, d = 0): string => v.toLocaleString("th-TH", { minimumFractionDigits: d, maximumFractionDigits: d });
const signed = (v: number): string => (v > 0 ? "+" : v < 0 ? "−" : "") + baht(Math.abs(v));

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
  const pending = useBills();
  const [ovr] = useOverrides();

  /** ปันต้นทุนทั้งเที่ยวเข้าบิลตามการใช้ทรัพยากรรถ (lib/alloc/tripAlloc.ts) */
  const cap = useMemo(() => recordCapacity(rec, ovr.vehicleSpecs), [rec, ovr.vehicleSpecs]);
  const alloc = useMemo(() => {
    const { items, unmatched } = recordAllocItems(rec, pending.bills);
    return { ...allocateTrip(items, cost, cap.cf), unmatched };
  }, [rec, pending.bills, cost, cap.cf]);
  const rows = useMemo(() => alloc.rows.map((r, i) => ({ b: bills[i]!, r, profit: r.revenue - r.cost })), [alloc.rows, bills]);

  const forecast = table ? forecastFor(table, rec.origin, rec.dest, rec.vehicle) : null;
  const actual = recordParts(rec);
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
            <>
              <p className="price-note" style={{ margin: "0 0 10px" }}>
                ปันต้นทุนตามการใช้ทรัพยากรรถ · Conversion Factor ={" "}
                {cap.cf == null
                  ? <b style={{ color: "var(--red)" }}>คิดไม่ได้ ({cap.missing.length ? `ไม่มีความจุของ ${cap.missing.join(", ")}` : "ไม่ระบุชนิดรถ"})</b>
                  : <><b>{num(cap.capKg)} กก. ÷ {num(cap.capM3, 2)} ลบ.ม. = {num(cap.cf, 2)} กก./ลบ.ม.</b> ({cap.kinds.join(" + ")})</>}
                {" "}· น้ำหนักเทียบเท่า = MAX(น้ำหนัก, ปริมาตร × CF) · Metric = น้ำหนักเทียบเท่า × ระยะทาง
                {alloc.unmatched > 0 && <> · <b>{alloc.unmatched}</b> บิลหาน้ำหนัก/ปริมาตรที่ CS กรอกไม่เจอ ปันตามรายได้</>}
              </p>
              {alloc.error ? (
                <div className="banner" style={{ marginBottom: 10 }}>{alloc.error}</div>
              ) : (
                <table className="tbl ta-tbl">
                  <thead><tr>
                    <th>เลขที่บิล</th><th>ผู้ส่ง → ผู้รับ</th><th>เส้นทาง</th>
                    <th className="n">น้ำหนัก (กก.)</th><th className="n">ปริมาตร (ลบ.ม.)</th><th className="n">ระยะทาง (กม.)</th>
                    <th className="n">CF</th><th className="n">น้ำหนักเทียบเท่า (กก.)</th><th className="n">Metric (กก.-กม.)</th>
                    <th className="n">สัดส่วน</th><th className="n">ต้นทุนที่จัดสรร</th><th className="n">รายได้</th><th className="n">กำไร</th>
                  </tr></thead>
                  <tbody>
                    {rows.map(({ b, r, profit }, i) => (
                      <tr key={`${b.no}-${i}`}>
                        <td><b>{b.no || "–"}</b></td>
                        <td>{b.sender || "–"} → {b.receiver || "–"}</td>
                        <td>{b.origin || "–"}–{b.dest || "–"}</td>
                        <td className="n">{num(r.weightKg)}</td>
                        <td className="n">{num(r.volumeM3, 3)}</td>
                        <td className="n" title={r.distSource}>{num(r.dist)}{r.distSource !== "ตารางระยะทาง" && " *"}</td>
                        <td className="n">{num(r.cf, 2)}</td>
                        <td className="n">{r.byRevenue ? <span title={r.flag}>ตามรายได้</span> : num(r.eqKg, 1)}</td>
                        <td className="n">{r.byRevenue ? "–" : num(r.metric)}</td>
                        <td className="n">{num(r.share * 100, 2)}%</td>
                        <td className="n"><b>{num(r.cost, 2)}</b></td>
                        <td className="n">{num(r.revenue, 2)}</td>
                        <td className="n" style={{ fontWeight: 700, color: profit < 0 ? "var(--red)" : "var(--green)" }}>
                          {signed(profit)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot><tr>
                    <td colSpan={8}>รวม</td>
                    <td className="n"><b>{num(alloc.totalMetric)}</b></td>
                    <td className="n"><b>{num(rows.reduce((s, x) => s + x.r.share, 0) * 100, 2)}%</b></td>
                    <td className="n"><b>{num(rows.reduce((s, x) => s + x.r.cost, 0), 2)}</b></td>
                    <td className="n"><b>{num(rows.reduce((s, x) => s + x.r.revenue, 0), 2)}</b></td>
                    <td className="n"><b>{signed(rows.reduce((s, x) => s + x.profit, 0))}</b></td>
                  </tr></tfoot>
                </table>
              )}
              <p className="price-note" style={{ marginTop: 8 }}>
                ต้นทุนที่จัดสรร = ต้นทุนเที่ยว × Metric ของบิล ÷ Metric รวม · ปัดสตางค์แล้วส่วนต่างอยู่ที่บิลที่ต้นทุนมากสุด ยอดรวมจึงเท่าต้นทุนเที่ยวพอดี ·
                ระยะทาง = ต้นทาง → ปลายทางของบิลตามตารางมาตรฐาน (* = หาไม่เจอ ใช้ค่ากลางของบิลอื่นในเที่ยว) ·
                บิลที่น้ำหนัก/ขนาดเชื่อไม่ได้ปันตามรายได้แยกก้อน
              </p>
            </>
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
                  {COST_PART_LABELS.map(({ key, label }) => {
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
