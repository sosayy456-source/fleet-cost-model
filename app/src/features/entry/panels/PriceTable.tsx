/**
 * ตารางราคาน้ำมัน — ตรงตาม details.prices ใน view-settings ของ index.html บน main
 *
 * ราคาเป็นแบบขั้นบันได: แถวหนึ่งคือ "มีผลตั้งแต่วันที่นี้"
 * ราคาที่ผู้ใช้เพิ่มเองเก็บแยกจากฐานกลาง แถวที่แก้เองมีจุดส้มกำกับ (tr.userrow)
 * และเรียงจากเก่าไปใหม่เหมือนต้นฉบับ เพราะอ่านเป็นขั้นบันไดไล่ลงมาได้ตรงกว่า
 */
import { useMemo, useState } from "react";
import { REF } from "../../../lib/refdata";
import { TH_MONTHS, thDateSafe } from "../../../lib/record/date";
import { useOverrides } from "../../../lib/store/overrides";

const Chev = () => (
  <svg className="chev" width="18" height="18" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 9l6 6 6-6" /></svg>
);

const thisYear = new Date().getFullYear();
const YEARS = Array.from({ length: 6 }, (_, i) => thisYear - 3 + i);

export default function PriceTable() {
  const [ovr, setOvr] = useOverrides();
  const [d, setD] = useState("");
  const [m, setM] = useState("");
  const [y, setY] = useState(String(thisYear));
  const [price, setPrice] = useState("");
  const [msg, setMsg] = useState("");

  const user = ovr.prices ?? {};

  /** รวมฐานกลาง + ที่ผู้ใช้เพิ่ม แล้วเรียงจากเก่าไปใหม่ (ลำดับเดียวกับ PRICES ของ main) */
  const rows = useMemo(() => {
    const map = new Map<string, { price: number; own: boolean }>();
    for (const p of REF.prices) map.set(p.date, { price: p.price, own: false });
    for (const [date, p] of Object.entries(user)) map.set(date, { price: Number(p), own: true });
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date, ...v }));
  }, [user]);

  const add = () => {
    const day = parseInt(d, 10), mon = parseInt(m, 10), year = parseInt(y, 10), pr = parseFloat(price);
    if (!day || day < 1 || day > 31) { setMsg("กรุณาระบุ ‘วัน’ ให้ถูกต้อง (1–31)"); return; }
    if (!mon || !year) { setMsg("กรุณาเลือกเดือนและปี"); return; }
    if (!Number.isFinite(pr) || pr <= 0) { setMsg("กรุณาระบุ ‘ราคา’ ให้มากกว่า 0"); return; }
    const iso = `${year}-${String(mon).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const existed = rows.some((r) => r.date === iso);
    setOvr({ ...ovr, prices: { ...user, [iso]: pr } });
    setPrice("");
    setMsg(`${existed ? "อัปเดต" : "เพิ่ม"}ราคา ${thDateSafe(iso)} = ${pr.toFixed(2)} บาท/ลิตร แล้ว ✓`);
  };

  /** ลบราคาที่เพิ่มเองทั้งหมด — npReset ของ main:3096 */
  const clearOwn = () => {
    if (!Object.keys(user).length) { setMsg("ยังไม่มีราคาที่เพิ่มเอง"); return; }
    setOvr({ ...ovr, prices: {} });
    setMsg("ล้างราคาที่เพิ่มเองแล้ว ✓");
  };

  const del = (date: string) => {
    const next = { ...user };
    delete next[date];
    setOvr({ ...ovr, prices: next });
    setMsg(`ลบราคาวันที่ ${thDateSafe(date)} แล้ว`);
  };

  return (
    <div className="card">
      {/* main เปิดกางไว้ตั้งแต่แรก (มี attribute open) */}
      <details className="prices" open>
        <summary>
          ⛽ ตารางราคาน้ำมัน (ใช้คำนวณน้ำมันเดินทางอัตโนมัติ) · กดเพื่อดู/อัปเดต
          <Chev />
        </summary>

        <div className="price-note" style={{ marginTop: 12 }}>
          ราคาคิดแบบ <b>ขั้นบันได</b> — ใบรายการจะใช้ราคาของแถวที่มีผลล่าสุด<b>ก่อนหรือตรงกับ</b>วันที่ในใบ
          ถ้าวันที่ในใบเก่ากว่าแถวแรกสุด ระบบใช้ราคาแถวแรก
        </div>

        <div className="price-add">
          <input placeholder="วัน" type="number" min={1} max={31} style={{ width: 58, flex: "none" }}
            value={d} onChange={(e) => setD(e.target.value)} />
          <select style={{ width: 96, flex: "none" }} value={m} onChange={(e) => setM(e.target.value)}>
            <option value="">เดือน</option>
            {TH_MONTHS.map((name, i) => <option key={name} value={i + 1}>{name}</option>)}
          </select>
          <select style={{ width: 88, flex: "none" }} value={y} onChange={(e) => setY(e.target.value)}>
            {YEARS.map((ce) => <option key={ce} value={ce}>{ce + 543}</option>)}
          </select>
          {/* main ห่อช่องราคาด้วย .input-suffix เพื่อให้มีเซลล์หน่วย บ./ล. ต่อท้าย */}
          <div className="input-suffix np-price" style={{ flex: 1, minWidth: 96 }}>
            <input placeholder="ราคา" type="number" min={0} step="0.01"
              value={price} onChange={(e) => setPrice(e.target.value)} />
            <span className="unit">บ./ล.</span>
          </div>
          <button className="btn-add" type="button" onClick={add}>+ อัปเดตราคา</button>
        </div>
        <div className="msg" style={{ color: "var(--green)" }}>{msg}</div>

        <div className="scroll" style={{ maxHeight: 300, overflowY: "auto" }}>
          <table>
            <thead><tr>
              <th>วันที่มีผล</th><th className="num">ราคา (บาท/ลิตร)</th><th />
            </tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.date} className={r.own ? "userrow" : undefined}>
                  <td>{thDateSafe(r.date)}</td>
                  <td className="num">{r.price.toFixed(2)}</td>
                  <td className="num">
                    {r.own && (
                      <span className="del-x" title="ลบราคาที่เพิ่มเอง" role="button" tabIndex={0}
                        onClick={() => del(r.date)}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") del(r.date); }}>✕</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: 11.5, color: "var(--ink-faint)", marginTop: 8 }}>
          <span role="button" tabIndex={0} onClick={clearOwn}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") clearOwn(); }}
            style={{ color: "var(--orange-dark)", cursor: "pointer", textDecoration: "underline" }}>
            ล้างราคาที่เพิ่มเอง
          </span>
        </p>
      </details>
    </div>
  );
}
