/**
 * ตารางบิลน้ำมัน (ส่วน A ของดีไซน์) — 1 บิล = 1 แถว
 *
 * แทนช่องยอดรวม 6+3 ช่องเดิมของโซนฝ่ายบัญชี · ยอดรวมถูกสรุปลง 9 ช่องเดิมให้อัตโนมัติ
 * ผ่าน applyFuelBills() ตอนบันทึก สูตร/ชีต/แดชบอร์ดจึงไม่ต้องรู้เรื่องบิลเลย
 *
 * ตรรกะทั้งหมดอยู่ใน lib/cost/fuelBills.ts กับ lib/cost/fuelBillCheck.ts — ที่นี่วาดอย่างเดียว
 */
import { useEffect, useMemo } from "react";
import {
  EST_REPLACE_DAYS, FUEL_CATS, FUEL_CAT_LABEL, FUEL_PAYS, FUEL_PAY_LABEL, FUEL_REASONS,
} from "../../../types/record";
import { emptyFuelBill, fuelBillAmount, isWasteCat } from "../../../lib/cost/fuelBills";
import { checkFuelBill, countPending } from "../../../lib/cost/fuelBillCheck";
import { addDaysISO, nowStamp, thDateSafe, todayISO } from "../../../lib/record/date";
import ThaiDateInput from "../ThaiDateInput";
import type { FuelBill, FuelCat, FuelPay, RoleKey, TripRecord } from "../../../types/record";

const baht = (n: number) =>
  n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** ตำแหน่งที่กดอนุมัติยอดประมาณการได้ — ตกลงกับเจ้าของข้อมูลไว้ 3 ตำแหน่งนี้ */
const canApproveRole = (r: RoleKey) => r === "account" || r === "manager" || r === "admin";

export default function FuelBillTable({
  rec, role, disabled, refPrice, autoRate, onChange,
}: {
  rec: TripRecord;
  role: RoleKey;
  disabled: boolean;
  /** ราคาน้ำมันอ้างอิงของวันที่ในใบ — ฟอร์มคำนวณมาให้ (priceForDate) ที่นี่ไม่อ่าน REF เอง */
  refPrice: number;
  /** อัตราลิตร/กม. ของชนิดรถที่เลือก — ใช้ตั้งค่าเริ่มต้นให้แถวยอดประมาณ */
  autoRate: number;
  onChange: (bills: FuelBill[]) => void;
}) {
  const bills = useMemo(() => rec.fuelBills ?? [], [rec.fuelBills]);

  /** ช่วงวันเดินทาง — วันปล่อยรถถึงวันที่ใบ (เรียงให้ถูกก่อน เพราะบางใบลงวันปล่อยรถหลังวันที่ใบ) */
  const span = useMemo(() => {
    const a = rec.releaseDate || rec.date;
    const b = rec.date || rec.releaseDate;
    if (!a || !b) return { from: "", to: "" };
    return a <= b ? { from: a, to: b } : { from: b, to: a };
  }, [rec.date, rec.releaseDate]);

  const issues = useMemo(
    () => bills.map((b) => checkFuelBill(b, bills, span, refPrice)),
    [bills, span, refPrice],
  );

  /**
   * ★ เติมสแนปช็อตอัตรา/ราคาย้อนหลังให้แถวยอดประมาณที่ยังเป็น 0
   *
   * อัตราลิตร/กม. มาจาก "ชนิดรถ" ซึ่งเป็นช่องของฝ่ายจัดรถ ฝ่ายบัญชีจึงมักเพิ่มบิลตอนที่
   * ชนิดรถยังว่าง (rate = 0) ถ้าไม่เติมย้อนหลัง ยอดจะค้างอยู่ที่ 0 บาทตลอดกาล
   * ทั้งที่ภายหลังฝ่ายจัดรถกรอกชนิดรถให้แล้ว — เป็นอาการที่หาสาเหตุยากมาก
   * (0 คือ "ยังไม่เคยได้ค่าจริง" ไม่ใช่ "ตั้งใจให้เป็นศูนย์" เพราะรถทุกคันกินน้ำมัน > 0)
   */
  useEffect(() => {
    if (disabled || autoRate <= 0) return;
    if (!bills.some((b) => b.pay === "est" && b.ratePerKm <= 0)) return;
    onChange(bills.map((b) => (b.pay === "est" && b.ratePerKm <= 0
      ? { ...b, ratePerKm: autoRate, pricePerL: b.pricePerL || refPrice }
      : b)));
  }, [bills, autoRate, refPrice, disabled, onChange]);

  const set = (id: string, patch: Partial<FuelBill>) =>
    onChange(bills.map((b) => (b.id === id ? { ...b, ...patch } : b)));

  const add = () => onChange([
    ...bills,
    { ...emptyFuelBill(rec.date || todayISO()), ratePerKm: autoRate, pricePerL: refPrice },
  ]);

  const remove = (id: string) => onChange(bills.filter((b) => b.id !== id));

  /** เปลี่ยนวิธีจ่าย — เข้า/ออกโหมดยอดประมาณต้องล้างช่องที่ใช้คนละชุดกัน */
  const setPay = (b: FuelBill, pay: FuelPay) => {
    if (pay === "est") {
      set(b.id, {
        pay, no: "", liters: 0, amount: 0,
        ratePerKm: b.ratePerKm || autoRate, pricePerL: b.pricePerL || refPrice,
      });
    } else {
      set(b.id, { pay, km: 0, reason: "", approved: false, approvedBy: "", approvedAt: "", dueDate: "" });
    }
  };

  /** "ได้บิลแล้ว — แทนที่ด้วยยอดจริง" — คงยอดประมาณไว้ให้แก้ต่อ ไม่ล้างทิ้ง */
  const replaceWithBill = (b: FuelBill) =>
    set(b.id, {
      pay: "bill", amount: fuelBillAmount(b), km: 0, reason: "",
      approved: false, approvedBy: "", approvedAt: "", dueDate: "",
    });

  const approve = (b: FuelBill) =>
    set(b.id, b.approved
      ? { approved: false, approvedBy: "", approvedAt: "", dueDate: "" }
      : {
        approved: true, approvedBy: role, approvedAt: nowStamp(),
        dueDate: addDaysISO(todayISO(), EST_REPLACE_DAYS),
      });

  const okCount = issues.filter((i) => i.level === "ok" || i.level === "info").length;
  const pending = countPending(issues);

  return (
    <div className="fuel-wrap">
      <div className="fuel-top">
        <span className="fuel-hint">
          1 บิล = 1 แถว · ยอดแต่ละประเภทรวมให้อัตโนมัติ · ทุกยอดตามรอยกลับไปที่เอกสารได้
        </span>
        <span className="fuel-count">
          หลักฐานครบ <b>{okCount}</b> / {bills.length} รายการ
        </span>
      </div>

      {bills.length > 0 && (
        <div className="fuel-head">
          <div>เลขที่บิล / เหตุผล</div>
          <div>วันที่</div>
          <div>ปั๊ม</div>
          <div>วิธีจ่าย</div>
          <div>ประเภท</div>
          <div className="n">ลิตร / กม.</div>
          <div className="n">จำนวนเงิน</div>
          <div>หลักฐาน / อนุมัติ</div>
          <div>สถานะ</div>
          <div />
        </div>
      )}

      {bills.map((b, i) => {
        const issue = issues[i]!;
        const est = b.pay === "est";
        const cls = ["fuel-row", est ? "est" : "", isWasteCat(b.cat) ? "waste" : ""].filter(Boolean).join(" ");
        return (
          <div key={b.id} className="fuel-block">
            <div className={cls}>
              {est ? (
                <select aria-label="เหตุผลที่ไม่มีบิล" value={b.reason} disabled={disabled}
                  className={b.reason ? "" : "need"}
                  onChange={(e) => set(b.id, { reason: e.target.value })}>
                  <option value="">— เลือกเหตุผล —</option>
                  {FUEL_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              ) : (
                <input aria-label="เลขที่บิล" value={b.no} disabled={disabled} placeholder="เช่น INV-0012"
                  className={"doc" + (b.no.trim() ? "" : " need")}
                  onChange={(e) => set(b.id, { no: e.target.value })} />
              )}

              <ThaiDateInput value={b.date} disabled={disabled}
                onChange={(v) => set(b.id, { date: v })} />

              <input aria-label="ปั๊ม" value={b.pump} disabled={disabled} placeholder="ชื่อปั๊ม"
                onChange={(e) => set(b.id, { pump: e.target.value })} />

              <select aria-label="วิธีจ่าย" value={b.pay} disabled={disabled}
                onChange={(e) => setPay(b, e.target.value as FuelPay)}>
                {FUEL_PAYS.map((p) => <option key={p} value={p}>{FUEL_PAY_LABEL[p]}</option>)}
              </select>

              <select aria-label="ประเภทค่าน้ำมัน" value={b.cat} disabled={disabled}
                onChange={(e) => set(b.id, { cat: e.target.value as FuelCat })}>
                <optgroup label="ต้นทุนปกติ">
                  {FUEL_CATS.filter((c) => !isWasteCat(c))
                    .map((c) => <option key={c} value={c}>{FUEL_CAT_LABEL[c]}</option>)}
                </optgroup>
                <optgroup label="ต้นทุนสูญเปล่า">
                  {FUEL_CATS.filter(isWasteCat)
                    .map((c) => <option key={c} value={c}>{FUEL_CAT_LABEL[c]}</option>)}
                </optgroup>
              </select>

              {est ? (
                <input aria-label="ระยะทาง กม." inputMode="decimal" className="n" disabled={disabled}
                  placeholder="กม." value={b.km || ""}
                  onChange={(e) => set(b.id, { km: parseFloat(e.target.value) || 0 })} />
              ) : (
                <input aria-label="ลิตร" inputMode="decimal" className="n" disabled={disabled}
                  placeholder="0" value={b.liters || ""}
                  onChange={(e) => set(b.id, { liters: parseFloat(e.target.value) || 0 })} />
              )}

              {est ? (
                <div className="fuel-auto n" title="คำนวณจากระยะทาง × อัตรา × ราคา แก้เองไม่ได้">
                  {baht(fuelBillAmount(b))}
                </div>
              ) : (
                <input aria-label="จำนวนเงิน" inputMode="decimal" className="n amt" disabled={disabled}
                  placeholder="0.00" value={b.amount || ""}
                  onChange={(e) => set(b.id, { amount: parseFloat(e.target.value) || 0 })} />
              )}

              {est ? (
                <button type="button" className={"fuel-act" + (b.approved ? " on" : "")}
                  disabled={disabled || !canApproveRole(role)}
                  title={canApproveRole(role)
                    ? "ฝ่ายบัญชี ผู้จัดการ และผู้ดูแลระบบ กดอนุมัติได้"
                    : "ตำแหน่งนี้อนุมัติไม่ได้"}
                  onClick={() => approve(b)}>
                  {b.approved ? "✓ อนุมัติแล้ว" : "ขออนุมัติ"}
                </button>
              ) : (
                <button type="button" className={"fuel-act" + (b.proof ? " on" : "")} disabled={disabled}
                  title={b.proofUrl || "กดเพื่อยืนยันว่ามีหลักฐาน แล้ววางลิงก์ได้ในช่องด้านล่าง"}
                  onClick={() => set(b.id, { proof: !b.proof })}>
                  {b.proof ? "✓ แนบแล้ว" : "ยังไม่แนบ"}
                </button>
              )}

              <span className={"fuel-badge " + issue.level} title={issue.hint}>{issue.text}</span>

              <button type="button" className="fuel-x" disabled={disabled} title="ลบรายการนี้"
                onClick={() => remove(b.id)}>✕</button>
            </div>

            {est && (
              <div className="fuel-sub">
                <span>
                  {b.ratePerKm <= 0 ? (
                    <b className="fuel-blocked">
                      ยังคำนวณไม่ได้ — ต้องเลือก “ชนิดรถ” ในการ์ดข้อมูลการเดินทางก่อน
                      (อัตราลิตร/กม. มาจากชนิดรถ)
                    </b>
                  ) : !b.km ? (
                    <b className="fuel-blocked">กรอก “กม.” ในแถวนี้เพื่อคำนวณยอด</b>
                  ) : (
                    <>คำนวณ: {b.km} กม. × {b.ratePerKm.toFixed(5)} ล./กม. × {b.pricePerL.toFixed(2)} บ./ล.</>
                  )}
                  {b.approved && b.dueDate && <> · ต้องนำบิลมาแทนภายใน <b>{thDateSafe(b.dueDate)}</b></>}
                </span>
                <span className="fuel-sub-acts">
                  {/* อัตรา/ราคาถูกแช่ไว้ตอนสร้างแถว เพื่อไม่ให้ใบที่บันทึกแล้วขยับเองเมื่อมีการ
                      แก้ตารางราคาน้ำมันย้อนหลัง — ปุ่มนี้คือทางให้ผู้ใช้สั่งรีเฟรชเองเมื่อต้องการ */}
                  {autoRate > 0
                    && (Math.abs(b.ratePerKm - autoRate) > 1e-9 || Math.abs(b.pricePerL - refPrice) > 0.005) && (
                    <button type="button" className="fuel-sub-btn ghost" disabled={disabled}
                      title={`อัตราปัจจุบัน ${autoRate.toFixed(5)} ล./กม. · ราคา ${refPrice.toFixed(2)} บ./ล.`}
                      onClick={() => set(b.id, { ratePerKm: autoRate, pricePerL: refPrice })}>
                      ใช้อัตรา/ราคาล่าสุด
                    </button>
                  )}
                  <button type="button" className="fuel-sub-btn" disabled={disabled}
                    onClick={() => replaceWithBill(b)}>ได้บิลแล้ว — แทนที่ด้วยยอดจริง</button>
                </span>
              </div>
            )}

            {!est && b.proof && (
              <div className="fuel-sub">
                <input className="fuel-url" disabled={disabled} value={b.proofUrl}
                  placeholder="วางลิงก์รูปบิล / ไฟล์ในไดรฟ์ (ไม่บังคับ — ระบบไม่มีการอัปโหลดไฟล์)"
                  onChange={(e) => set(b.id, { proofUrl: e.target.value })} />
                {b.txnId && <span className="fuel-txn">Transaction ID: {b.txnId}</span>}
              </div>
            )}
          </div>
        );
      })}

      <div className="fuel-foot">
        <button type="button" className="btn-add" disabled={disabled} onClick={add}>+ เพิ่มบิล</button>
        <span className="fuel-hint">
          ระบบตรวจอัตโนมัติ: เลขบิลซ้ำ (ปั๊ม + เลขบิล) · วันที่นอกช่วงเดินทาง ·
          ราคา/ลิตรต่างจากราคาอ้างอิงเกิน 5% · ไม่มีเลขบิลหรือหลักฐาน
          {bills.length === 0 && " · ยังไม่มีบิล — กด “เพิ่มบิล” เพื่อเริ่ม"}
        </span>
      </div>

      {/* ★ การตรวจทั้งหมดเป็น "คำเตือน" ไม่ได้บล็อกการบันทึก — ฝ่ายบัญชีต้องบันทึกค้างไว้ก่อน
          แล้วตามเอกสารทีหลังได้ · ยอดเงินถูกนับเข้าต้นทุนครบทุกแถวไม่ว่าจะมีหลักฐานหรือไม่ */}
      {pending > 0 && (
        <div className="fuel-warn">
          มี <b>{pending}</b> รายการยังไม่ผ่านการตรวจ — <b>บันทึกได้ตามปกติ</b> ยอดเงินถูกนับเข้าต้นทุนครบแล้ว
          ถือเป็นรายการที่ยังรอเอกสารตามทีหลัง
        </div>
      )}
    </div>
  );
}
