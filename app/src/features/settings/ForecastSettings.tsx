/**
 * ตั้งค่าจำนวนเดือนย้อนหลังของ "ต้นทุนพยากรณ์" — สเปก 22 ก.ย. 2569
 * (เจ้าของงานขอให้ปรับได้เอง เช่นเปลี่ยนจาก 5 เดือนเป็น 12 เดือน)
 *
 * ค่าเก็บใน localStorage ของเครื่องนั้น เหมือนค่าอ้างอิงอื่นที่ผู้ใช้แก้เอง
 * หน้าที่ใช้ค่านี้: หน้าจัดรถ (กล่องสรุปผล) และป็อบอัพ "จริงเทียบพยากรณ์" ของฝ่ายบัญชี
 */
import { useEffect, useState } from "react";
import { DEFAULT_FORECAST_MONTHS, getForecastMonths, setForecastMonths } from "../../lib/forecast/forecast";

const CHOICES = [3, 5, 6, 12, 24];

export default function ForecastSettings() {
  const [months, setMonths] = useState(DEFAULT_FORECAST_MONTHS);
  const [msg, setMsg] = useState("");

  useEffect(() => { setMonths(getForecastMonths()); }, []);

  const apply = (n: number) => {
    setForecastMonths(n);
    setMonths(getForecastMonths());
    setMsg(`ใช้ข้อมูลเก่า ${n} เดือนล่าสุดในการพยากรณ์ต้นทุนแล้ว`);
  };

  return (
    <div className="card">
      <div className="card-h"><span className="step">฿</span><h2>ต้นทุนพยากรณ์</h2>
        <span className="hint">ใช้ในหน้าจัดรถ และป็อบอัพเทียบต้นทุนของฝ่ายบัญชี</span></div>

      <div className="price-note">
        ต้นทุนพยากรณ์ = <b>ค่าเฉลี่ยต้นทุนจริงต่อเที่ยว</b>ของข้อมูลเก่า (ไฟล์ต้นทุนรายเที่ยว)
        โดยจับคู่ตาม <b>เส้นทาง × ชนิดรถ</b> — ถ้าเส้นทางนั้นยังไม่มีรถชนิดนี้วิ่ง จะถอยไปใช้ค่าเฉลี่ยของชนิดรถ
        แล้วค่อยเป็นค่าเฉลี่ยของเส้นทาง · ไม่รวมเที่ยววิ่งเปล่า ·
        นับจากเดือนล่าสุดที่มีในไฟล์ ไม่ใช่เดือนปัจจุบัน (ไฟล์ข้อมูลเก่าตัดยอดไว้แล้วไม่ขยับตามเวลา)
      </div>

      <div className="price-add" style={{ marginTop: 12 }}>
        <label style={{ alignSelf: "center" }}>ใช้ข้อมูลย้อนหลัง</label>
        <select value={months} onChange={(e) => apply(Number(e.target.value))}>
          {CHOICES.map((n) => (
            <option key={n} value={n}>{n} เดือนล่าสุด{n === DEFAULT_FORECAST_MONTHS ? " (ค่าเริ่มต้น)" : ""}</option>
          ))}
          {!CHOICES.includes(months) && <option value={months}>{months} เดือนล่าสุด</option>}
        </select>
        <input type="number" min={1} max={36} value={months} style={{ width: 110 }}
          onChange={(e) => apply(Number(e.target.value) || DEFAULT_FORECAST_MONTHS)} />
        <span className="hint" style={{ alignSelf: "center" }}>เดือน (1–36)</span>
      </div>
      {msg && <div className="msg" style={{ color: "var(--green)" }}>{msg}</div>}
    </div>
  );
}
