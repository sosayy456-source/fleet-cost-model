/**
 * ส่วน C (ยอดรวม) + ส่วน D (เทียบต้นทุนมาตรฐาน) ของดีไซน์ค่าน้ำมัน — อ่านอย่างเดียวทั้งหมด
 *
 * ★ ยอดแยกตามประเภทคิดจาก "บิล" ตรง ๆ ไม่ใช่จาก 9 ช่องเดิม
 *   เพราะ fuelCash ยุบเงินสดขาล่าง/ขาขึ้นไว้ช่องเดียว ถ้าอ่านจาก 9 ช่องจะแยกสองขาไม่ออก
 *
 * ส่วน D เป็นการ "เปรียบเทียบ" ล้วน ไม่ถูกบวกเข้าต้นทุนจริง — ใบที่มีตารางบิลจะปิด
 * ค่าน้ำมันอัตโนมัติไว้เสมอ (applyFuelBills) ไม่งั้นจะนับซ้ำกับยอดบิล
 */
import { useMemo } from "react";
import { FUEL_CATS, FUEL_CAT_LABEL } from "../../../types/record";
import { fuelBillsByCat, isWasteCat } from "../../../lib/cost/fuelBills";
import type { FuelBill } from "../../../types/record";

const baht = (n: number) =>
  n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** สัดส่วนยอดประมาณการต่อทั้งเที่ยวที่ยอมรับได้ · ผลต่างจากมาตรฐานที่ยอมรับได้ */
const EST_SHARE_LIMIT = 10;
const VARIANCE_LIMIT = 10;

export default function FuelSummary({ bills, dist, rate, price }: {
  bills: FuelBill[];
  dist: number;
  rate: number;
  price: number;
}) {
  const s = useMemo(() => fuelBillsByCat(bills), [bills]);

  const share = s.total > 0 ? (s.est / s.total) * 100 : 0;
  const shareOver = share > EST_SHARE_LIMIT;

  // มาตรฐานเทียบเฉพาะขาล่อง+ขาขึ้น ตามดีไซน์ (ไปเก็บสินค้า/เรียกรถ ไม่ได้วิ่งตามเส้นทางหลัก)
  const std = dist * rate * price;
  const act = s.cat.down + s.cat.up;
  const diff = act - std;
  const pct = std > 0 ? (diff / std) * 100 : 0;
  const over = std > 0 && Math.abs(pct) > VARIANCE_LIMIT;

  return (
    <div className="fuel-panes">
      <div className="fuel-pane">
        <h4>ยอดรวม <span>คำนวณจากตารางบิล · แก้ไขตรงนี้ไม่ได้</span></h4>

        <div className="fuel-grp">ต้นทุนปกติ</div>
        <div className="fuel-cells">
          {FUEL_CATS.filter((c) => !isWasteCat(c)).map((c) => (
            <div key={c} className="fuel-cell">
              <span>{FUEL_CAT_LABEL[c]}</span><b>{baht(s.cat[c])}</b>
            </div>
          ))}
        </div>

        <div className="fuel-grp waste">ต้นทุนสูญเปล่า</div>
        <div className="fuel-cells">
          {FUEL_CATS.filter(isWasteCat).map((c) => (
            <div key={c} className="fuel-cell waste">
              <span>{FUEL_CAT_LABEL[c]}</span><b>{baht(s.cat[c])}</b>
            </div>
          ))}
        </div>

        <div className="fuel-est">
          <div className="row">
            <span>ยอดประมาณการ (ไม่มีเอกสาร · นับเป็นต้นทุนแล้ว)</span>
            <b>{baht(s.est)}</b>
          </div>
          <div className="row line">
            <span>สัดส่วนยอดประมาณการต่อทั้งเที่ยว</span>
            <span className={"fuel-badge " + (shareOver ? "err" : "ok")}>
              {share.toFixed(1)}% (เกณฑ์ {EST_SHARE_LIMIT}%)
            </span>
          </div>
        </div>

        <div className="fuel-total">
          <span>รวมค่าน้ำมันทั้งเที่ยว</span>
          <b>{baht(s.total)} บาท</b>
        </div>
        <div className="fuel-total-sub">
          มีเอกสาร {baht(s.total - s.est)} · ประมาณการ {baht(s.est)}
        </div>
      </div>

      <div className="fuel-pane">
        <h4>เทียบต้นทุนมาตรฐาน <span>ใช้เป็นเกณฑ์ตรวจสอบเท่านั้น ไม่ถูกบวกเข้ายอดจริง</span></h4>

        <div className="fuel-cmp-in">
          <div><label>ระยะทาง (กม.)</label><b>{dist.toLocaleString("th-TH")}</b></div>
          <div><label>อัตรา (ล./กม.)</label><b>{rate.toFixed(5)}</b></div>
          <div><label>ราคา (บ./ล.)</label><b>{price.toFixed(2)}</b></div>
        </div>

        <div className="fuel-cmp-row"><span>มาตรฐาน (ขาล่อง + ขาขึ้น)</span><b>{baht(std)} บาท</b></div>
        <div className="fuel-cmp-row"><span>จริงตามบิล (ขาล่อง + ขาขึ้น)</span><b>{baht(act)} บาท</b></div>

        <div className={"fuel-diff " + (over ? "over" : "under")}>
          <div className="row"><span>ผลต่าง</span>
            <b>{diff >= 0 ? "+" : ""}{baht(diff)} ({pct >= 0 ? "+" : ""}{pct.toFixed(1)}%)</b>
          </div>
          <div className="note">
            {std <= 0
              ? "ยังไม่รู้ระยะทางหรืออัตราของชนิดรถนี้ จึงเทียบไม่ได้"
              : over
                ? `เกินเกณฑ์ ${VARIANCE_LIMIT}% — ควรระบุเหตุผลก่อนส่งให้ตรวจ`
                : `อยู่ในเกณฑ์ ±${VARIANCE_LIMIT}%`}
          </div>
        </div>
      </div>
    </div>
  );
}
