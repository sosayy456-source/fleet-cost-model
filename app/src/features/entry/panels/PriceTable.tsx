/**
 * ตารางราคาน้ำมัน — ยกจาก v5:915-930 (details.prices#pricePanel)
 *
 * ราคาเป็นแบบขั้นบันได: แถวหนึ่งคือ "มีผลตั้งแต่วันที่นี้"
 * ราคาที่ผู้ใช้เพิ่มเองเก็บแยกจากฐานกลาง แถวที่แก้เองมีจุดส้มกำกับ (tr.userrow)
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

  /** รวมฐานกลาง + ที่ผู้ใช้เพิ่ม แล้วเรียงจากใหม่ไปเก่า (เหมือนตารางใน v5) */
  const rows = useMemo(() => {
    const map = new Map<string, { price: number; own: boolean }>();
    for (const p of REF.prices) map.set(p.date, { price: p.price, own: false });
    for (const [date, p] of Object.entries(user)) map.set(date, { price: Number(p), own: true });
    return [...map.entries()].sort(([a], [b]) => b.localeCompare(a))
      .map(([date, v]) => ({ date, ...v }));
  }, [user]);

  const add = () => {
    const day = parseInt(d, 10), mon = parseInt(m, 10), year = parseInt(y, 10), pr = parseFloat(price);
    if (!day || !mon || !year) { setMsg("กรอกวัน เดือน ปี ให้ครบ"); return; }
    if (!Number.isFinite(pr) || pr <= 0) { setMsg("กรอกราคาต่อลิตรให้ถูกต้อง"); return; }
    const iso = `${year}-${String(mon).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    setOvr({ ...ovr, prices: { ...user, [iso]: pr } });
    setD(""); setM(""); setPrice("");
    setMsg(`เพิ่มราคา ${pr.toFixed(2)} บาท/ลิตร มีผลตั้งแต่ ${thDateSafe(iso)}`);
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
          <input className="np-price" placeholder="ราคา/ลิตร" type="number" step="0.01"
            style={{ flex: 1, minWidth: 96 }} value={price} onChange={(e) => setPrice(e.target.value)} />
          <button className="btn-add" type="button" onClick={add}>+ เพิ่มราคา</button>
        </div>
        <div className="msg" style={{ color: "var(--green)" }}>{msg}</div>

        <div className="scroll" style={{ maxHeight: 300, overflowY: "auto" }}>
          <table>
            <thead><tr>
              <th>มีผลตั้งแต่</th><th className="n">ราคา (บาท/ลิตร)</th><th>ที่มา</th><th />
            </tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.date} className={r.own ? "userrow" : undefined}>
                  <td>{thDateSafe(r.date)}</td>
                  <td className="n">{r.price.toFixed(2)}</td>
                  <td>{r.own
                    ? <span className="badge src-new">แก้เอง</span>
                    : <span className="badge src-old">ฐานกลาง</span>}</td>
                  <td>{r.own && <button className="del-x" type="button" onClick={() => del(r.date)}>✕</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="dz-note">
          แถวที่มีจุดส้มคือราคาที่เพิ่มเอง เก็บไว้ในเครื่องนี้เท่านั้น — ถ้าอยากให้ทุกฝ่ายใช้ราคาชุดเดียวกัน
          ต้องแก้ที่ไฟล์ <code>refdata/fuelPrices.json</code>
        </div>
      </details>
    </div>
  );
}
