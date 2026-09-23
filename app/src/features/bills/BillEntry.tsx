/**
 * หน้า "บันทึกบิล" ของฝ่ายบริการลูกค้า — สเปก "ปรับปรุงโมเดล" (22 ก.ย. 2569)
 *
 * เปลี่ยนจากเดิมที่ CS กรอก "ใบรายการ" (มีบิลอยู่ข้างใน) มาเป็นกรอก **รายบิล** ล้วน ๆ
 *   · ไม่มีช่องเลขที่ใบรายการแล้ว — ฝ่ายจัดรถเป็นคนสร้างตอนรวมบิลเข้ารถ
 *   · เลขที่บิลระบบออกให้ตอนกดบันทึก (lib/bill/number.ts) ตรวจไม่ให้ซ้ำกับบิลที่มีอยู่
 *   · จำนวน / น้ำหนักรวม / กว้าง ยาว สูง → คิดปริมาตรให้อัตโนมัติ
 *   · ทุกค่าต้องมากกว่า 0 ก่อนบันทึก (กันบิลน้ำหนัก/ขนาดเป็น 0 หรือติดลบ)
 *   · กดบันทึกแล้วขึ้น "หน้าสรุป" ให้ตรวจก่อน แล้วค่อยยืนยันบันทึกจริง
 *   · บิลที่บันทึกได้สถานะ "รอจัดรถ" รออยู่ในแท็บของฝ่ายจัดรถ
 *
 * สองแท็บ: กรอกบิลใหม่ · บิลที่ยังไม่ได้จัดรถ (ยกเลิกได้ เห็นเฉพาะที่ยังไม่จัดรถ)
 */
import { useMemo, useState } from "react";
import { BRANCHES, ORIGINS, destsFor } from "../../lib/refdata";
import { PAY_TYPES, PRICE_BASIS } from "../../types/record";
import { emptyDraft, n, problem, randomDraft } from "./draft";
import type { Draft } from "./draft";
import { SERVICE_GROUPS_V2, billTotalOf, billVolume } from "../../types/bill";
import type { PendingBill } from "../../types/bill";
import { newBillNos } from "../../lib/bill/number";
import { nowStamp } from "../../lib/record/date";
import { useBills } from "../../lib/store/bills";
import ThaiDateInput from "../entry/ThaiDateInput";
import PendingBillList from "./PendingBillList";
import TruckLoader from "../../lib/ui/TruckLoader";

const baht = (v: number): string => v.toLocaleString("th-TH", { maximumFractionDigits: 2 });

/** ค่าที่คิดให้จากแถวที่กรอก — ปริมาตรและราคารวม (สูตรกลางอยู่ใน types/bill.ts) */
function derive(d: Draft) {
  const qty = n(d.qty), weight = n(d.weight);
  const volume = billVolume({ width: n(d.width), length: n(d.length), height: n(d.height), qty });
  const total = billTotalOf({ pricingType: d.pricingType, weight, qty, unitPrice: n(d.unitPrice) });
  return { qty, weight, volume, total };
}

export default function BillEntry() {
  const state = useBills();
  const [tab, setTab] = useState<"new" | "pending">("new");
  const [rows, setRows] = useState<Draft[]>([emptyDraft()]);
  /** หน้าสรุปก่อนบันทึกจริง — null = ยังกรอกอยู่ */
  const [review, setReview] = useState<Draft[] | null>(null);
  const [msg, setMsg] = useState<{ text: string; tone: "ok" | "err" } | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (i: number, patch: Partial<Draft>) =>
    setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  const pending = useMemo(() => state.bills.filter((b) => b.status === "รอจัดรถ"), [state.bills]);

  const check = () => {
    const bad = rows.findIndex((d) => problem(d));
    if (bad >= 0) {
      setMsg({ text: `บิลแถวที่ ${bad + 1}: ${problem(rows[bad]!)}`, tone: "err" });
      return;
    }
    setMsg(null);
    setReview(rows);
  };

  async function confirm() {
    if (!review) return;
    setBusy(true);
    try {
      // ★ ออกเลขตอนนี้เท่านั้น — ตรวจกับเลขที่บิลทั้งหมดที่โหลดมาแล้ว (เครื่อง + ชีต)
      const nos = newBillNos(review.length, review[0]!.date, state.bills.map((b) => b.no));
      const stamp = nowStamp();
      const bills: PendingBill[] = review.map((d, i) => {
        const v = derive(d);
        return {
          id: crypto.randomUUID(), no: nos[i]!,
          date: d.date, branch: d.branch,
          sender: d.sender.trim(), receiver: d.receiver.trim(),
          origin: d.origin, dest: d.dest, serviceGroup: d.serviceGroup,
          qty: v.qty, weight: v.weight,
          width: n(d.width), length: n(d.length), height: n(d.height), volume: v.volume,
          payType: d.payType, pricingType: d.pricingType, unitPrice: n(d.unitPrice), total: v.total,
          status: "รอจัดรถ", docNo: "",
          createdAt: stamp, updatedAt: stamp,
        };
      });
      const saved = await state.save(bills);
      const offline = saved.some((b) => b.synced === false);
      setMsg({
        text: `บันทึก ${saved.length} บิลแล้ว (${saved.map((b) => b.no).join(", ")})`
          + (offline ? " — ยังไม่ได้ขึ้นชีต เก็บไว้ในเครื่องก่อน ฝ่ายจัดรถจะยังไม่เห็น" : " · สถานะ รอจัดรถ"),
        tone: offline ? "err" : "ok",
      });
      setRows([emptyDraft()]);
      setReview(null);
    } catch (e) {
      setMsg({ text: `บันทึกไม่สำเร็จ: ${(e as Error).message}`, tone: "err" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="bill-tabs">
        <button type="button" className={tab === "new" ? "on" : ""} onClick={() => setTab("new")}>
          กรอกบิลใหม่
        </button>
        <button type="button" className={tab === "pending" ? "on" : ""} onClick={() => setTab("pending")}>
          บิลที่ยังไม่ได้จัดรถ <b>{pending.length}</b>
        </button>
      </div>

      {!state.connected && (
        <div className="banner">
          ยังไม่ได้เชื่อม Google Sheet — บิลจะเก็บในเครื่องนี้เท่านั้น <b>ฝ่ายจัดรถจะยังไม่เห็น</b>
          {" "}ตั้งค่าลิงก์ได้ที่หน้า "รายการทั้งหมด" → ⚙
        </div>
      )}
      {state.error && <div className="banner">โหลดบิลจากชีตไม่สำเร็จ: {state.error}</div>}

      {tab === "pending" ? (
        <PendingBillList state={state} />
      ) : review ? (
        /* ── หน้าสรุปก่อนบันทึกจริง ── */
        <div className="card">
          <div className="card-h"><span className="step">✓</span><h2>ตรวจสอบก่อนบันทึก</h2>
            <span className="hint">{review.length} บิล · ระบบจะออกเลขที่บิลให้เมื่อกดยืนยัน</span></div>
          <div className="scroll scroll-x">
            <table className="tbl bill-sum">
              <thead><tr>
                <th>#</th><th>วันที่</th><th>สาขา</th><th>ผู้ส่ง → ผู้รับ</th><th>เส้นทาง</th>
                <th>กลุ่มบริการ</th><th className="n">จำนวน</th><th className="n">น้ำหนัก (กก.)</th>
                <th className="n">ปริมาตร (ลบ.ม.)</th><th>การชำระ</th><th className="n">ราคารวม</th>
              </tr></thead>
              <tbody>
                {review.map((d, i) => {
                  const v = derive(d);
                  return (
                    <tr key={d.key}>
                      <td>{i + 1}</td>
                      <td>{d.date}</td>
                      <td>{d.branch}</td>
                      <td>{d.sender} → {d.receiver}</td>
                      <td>{d.origin}–{d.dest}</td>
                      <td>{d.serviceGroup}</td>
                      <td className="n">{baht(v.qty)}</td>
                      <td className="n">{baht(v.weight)}</td>
                      <td className="n">{v.volume.toFixed(3)}</td>
                      <td>{d.payType}</td>
                      <td className="n"><b>{baht(v.total)}</b></td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot><tr>
                <td colSpan={6}>รวม</td>
                <td className="n">{baht(review.reduce((s, d) => s + derive(d).qty, 0))}</td>
                <td className="n">{baht(review.reduce((s, d) => s + derive(d).weight, 0))}</td>
                <td className="n">{review.reduce((s, d) => s + derive(d).volume, 0).toFixed(3)}</td>
                <td />
                <td className="n"><b>{baht(review.reduce((s, d) => s + derive(d).total, 0))}</b></td>
              </tr></tfoot>
            </table>
          </div>
          <div className="bill-actions">
            {busy && <TruckLoader />}
            <button type="button" className="btn-ghost" onClick={() => setReview(null)} disabled={busy}>
              ← กลับไปแก้
            </button>
            <button type="button" className="btn btn-save" onClick={confirm} disabled={busy}>
              ยืนยันบันทึก
            </button>
          </div>
        </div>
      ) : (
        /* ── ฟอร์มกรอกบิล ── */
        <div className="card">
          <div className="card-h"><span className="step">1</span><h2>บิลใหม่</h2>
            <span className="hint">กรอกได้หลายบิลพร้อมกัน · เลขที่บิลระบบออกให้ตอนบันทึก</span></div>

          {rows.map((d, i) => {
            const v = derive(d);
            const bad = problem(d);
            return (
              <div key={d.key} className="bill-card">
                <div className="bill-card-h">
                  <b>บิลที่ {i + 1}</b>
                  {rows.length > 1 && (
                    <button type="button" className="bill-x" title="ลบบิลนี้"
                      onClick={() => setRows((r) => r.filter((_, j) => j !== i))}>✕</button>
                  )}
                </div>
                <div className="bill-grid">
                  <div className="f"><label>วันที่รับสินค้า</label>
                    <ThaiDateInput value={d.date} onChange={(val) => set(i, { date: val })} /></div>
                  <div className="f"><label>สาขา</label>
                    <select value={d.branch} onChange={(e) => set(i, { branch: e.target.value })}>
                      {BRANCHES.map((b) => <option key={b} value={b}>{b}</option>)}
                    </select></div>
                  <div className="f"><label>กลุ่มบริการ</label>
                    <select value={d.serviceGroup} onChange={(e) => set(i, { serviceGroup: e.target.value })}>
                      {SERVICE_GROUPS_V2.map((g) => <option key={g} value={g}>{g}</option>)}
                    </select></div>
                  <div className="f"><label>ผู้ส่ง</label>
                    <input value={d.sender} placeholder="ชื่อหรือรหัสลูกค้า"
                      onChange={(e) => set(i, { sender: e.target.value })} /></div>
                  <div className="f"><label>ผู้รับ</label>
                    <input value={d.receiver} placeholder="ชื่อหรือรหัสลูกค้า"
                      onChange={(e) => set(i, { receiver: e.target.value })} /></div>
                  <div className="f"><label>ต้นทาง</label>
                    <select value={d.origin} onChange={(e) => set(i, { origin: e.target.value, dest: "" })}>
                      <option value="">เลือกต้นทาง</option>
                      {ORIGINS.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select></div>
                  <div className="f"><label>ปลายทาง</label>
                    <select value={d.dest} onChange={(e) => set(i, { dest: e.target.value })}>
                      <option value="">เลือกปลายทาง</option>
                      {destsFor(d.origin).map((o) => <option key={o} value={o}>{o}</option>)}
                    </select></div>
                  <div className="f"><label>จำนวน (หน่วย)</label>
                    <input type="number" min={0} step="any" value={d.qty} placeholder="0"
                      onChange={(e) => set(i, { qty: e.target.value })} /></div>
                  <div className="f"><label>น้ำหนักรวม (กก.)</label>
                    <input type="number" min={0} step="any" value={d.weight} placeholder="0"
                      onChange={(e) => set(i, { weight: e.target.value })} /></div>
                  <div className="f"><label>กว้าง (ซม.)</label>
                    <input type="number" min={0} step="any" value={d.width} placeholder="0"
                      onChange={(e) => set(i, { width: e.target.value })} /></div>
                  <div className="f"><label>ยาว (ซม.)</label>
                    <input type="number" min={0} step="any" value={d.length} placeholder="0"
                      onChange={(e) => set(i, { length: e.target.value })} /></div>
                  <div className="f"><label>สูง (ซม.)</label>
                    <input type="number" min={0} step="any" value={d.height} placeholder="0"
                      onChange={(e) => set(i, { height: e.target.value })} /></div>
                  <div className="f"><label>ประเภทการชำระเงิน</label>
                    <select value={d.payType} onChange={(e) => set(i, { payType: e.target.value })}>
                      {PAY_TYPES.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select></div>
                  <div className="f"><label>เกณฑ์คิดราคา</label>
                    <select value={d.pricingType} onChange={(e) => set(i, { pricingType: e.target.value })}>
                      {PRICE_BASIS.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select></div>
                  <div className="f"><label>ราคาต่อหน่วย (บาท)</label>
                    <input type="number" min={0} step="any" value={d.unitPrice} placeholder="0"
                      onChange={(e) => set(i, { unitPrice: e.target.value })} /></div>
                </div>
                <div className="bill-auto">
                  <span>ปริมาตรรวม <b>{v.volume.toFixed(3)}</b> ลบ.ม.
                    <small> (กว้าง × ยาว × สูง ÷ 1,000,000 × จำนวน)</small></span>
                  <span>ราคารวม <b>{baht(v.total)}</b> บาท
                    <small> ({d.pricingType === "คิดตามน้ำหนัก" ? "น้ำหนักรวม" : "จำนวน"} × ราคาต่อหน่วย)</small></span>
                </div>
                {bad && <div className="bill-bad">⚠ {bad}</div>}
              </div>
            );
          })}

          <button className="btn-add" type="button" onClick={() => setRows((r) => [...r, emptyDraft()])}>
            + เพิ่มบิล
          </button>

          {msg && <div className={"save-msg " + (msg.tone === "ok" ? "ok" : "err")}>{msg.text}</div>}

          <div className="bill-actions">
            {/* สำหรับทดสอบเท่านั้น — สุ่มทับทุกแถวที่มีอยู่ (เพิ่มบิลไว้กี่แถวก็ได้กี่บิล) ไม่บันทึกเอง */}
            <button type="button" className="btn-ghost" title="สุ่มค่าทุกช่องของทุกบิลในฟอร์ม เพื่อทดสอบ"
              onClick={() => { setRows((r) => r.map((d) => randomDraft(d.key))); setMsg(null); }}>
              🎲 สุ่มข้อมูล
            </button>
            <button type="button" className="btn btn-save" onClick={check}>
              ตรวจสอบและบันทึก →
            </button>
          </div>
        </div>
      )}
    </>
  );
}
