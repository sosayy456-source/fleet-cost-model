/**
 * แผง "ใบที่ยังรอ…กรอก" ในหน้าบันทึกข้อมูล — แทนแถบชิป renderDraftBar() ของ main
 *
 * ★ ทุกตำแหน่งที่กรอกใบเห็นแผงนี้ (ของเดิมซ่อนจากฝ่ายบริการลูกค้ากับผู้ดูแลระบบ)
 *   ฝ่ายบริการลูกค้า/จัดรถ/บัญชี = ใบที่ยังไม่ครบ และ "ฝ่ายเรา" ยังไม่กรอก
 *   ผู้ดูแลระบบกรอกแทนได้ทุกฝ่าย จึงเห็นใบที่ยังไม่ครบทั้งหมด
 *
 * สีตามจำนวนวันที่ค้าง (เขียว/เหลือง/แดง) เป็นค่าคงที่ของแผงนี้ เพราะธีมหลักไม่มีโทนเหลือง
 * ส่วนพื้น/เส้น/ตัวอักษรใช้โทเคนของธีมตามปกติ
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { ROLES, roleAllDone, roleDone } from "../../../lib/record/roles";
import { daysBetween, todayISO } from "../../../lib/record/date";
import type { RecordsState } from "../../../lib/store/useRecords";
import type { RoleKey, TripRecord } from "../../../types/record";

/** โทนตามความค้าง — 0 วัน / 1-2 วัน / ตั้งแต่ 3 วันขึ้นไป */
function toneOf(days: number): { tone: string; tint: string } {
  if (days >= 3) return { tone: "#B4293A", tint: "#FBE4E7" };
  if (days >= 1) return { tone: "#9A6408", tint: "#FBF0DC" };
  return { tone: "#5C7A63", tint: "#E9F1EA" };
}

const pad2 = (n: number) => String(n).padStart(2, "0");
/** เวลาเครื่อง HH:MM — ห้ามใช้ toISOString() ด้วยเหตุผลเดียวกับ todayISO() */
const hhmm = () => {
  const d = new Date();
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};

const IconDoc = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5M9 13h6M9 17h4" />
  </svg>
);

const IconRefresh = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 11a8 8 0 1 0-.9 4.5" />
    <path d="M20 4v7h-7" />
  </svg>
);

export default function PendingSlips({
  role, state, onOpen, showAging = true,
}: {
  role: RoleKey;
  state: RecordsState;
  onOpen: (r: TripRecord) => void;
  /** ปิดแล้วทุกใบขึ้นคำกลาง ๆ "รอกรอก" แทนจำนวนวัน (สียังคิดจากวันที่ค้างเหมือนเดิม) */
  showAging?: boolean;
}) {
  /** เวลาที่ลิสต์นี้ตรงกับชีตครั้งล่าสุด — ขยับทุกครั้งที่โหลดเสร็จ ไม่ใช่ทุก render */
  const [stamp, setStamp] = useState(hhmm);
  const wasLoading = useRef(state.loading);
  useEffect(() => {
    if (wasLoading.current && !state.loading) setStamp(hhmm());
    wasLoading.current = state.loading;
  }, [state.loading]);

  const slips = useMemo(() => {
    const list = state.records.filter((r) =>
      !roleAllDone(r) && (role === "admin" || !roleDone(r, role)));
    return list
      .map((r) => {
        const days = r.date ? Math.max(0, daysBetween(r.date, todayISO()) ?? 0) : 0;
        return { rec: r, days, ...toneOf(days) };
      })
      // ค้างนานสุดขึ้นก่อน
      .sort((a, b) => b.days - a.days);
  }, [state.records, role]);

  const title = role === "admin"
    ? "ใบที่ยังกรอกไม่ครบทุกฝ่าย"
    : `ใบที่ยังรอ${ROLES[role].label}กรอก`;
  const none = role === "admin"
    ? "ไม่มีใบที่กรอกไม่ครบในขณะนี้"
    : "ไม่มีใบที่รอฝ่ายนี้กรอกในขณะนี้";

  return (
    <section className="pslips">
      <div className="pslips-h">
        <div className="pslips-ht">
          <div className="pslips-t">
            <h2>{title}</h2>
            <span className="pslips-pill">{slips.length} ใบ</span>
          </div>
          <p className="pslips-sub">
            {state.loading
              ? "กำลังตรวจใบล่าสุด…"
              : `อัปเดตล่าสุด ${stamp} น. · เรียงตามจำนวนวันที่ค้างนานที่สุด`}
          </p>
        </div>
        {/* ฝ่ายบริการลูกค้ากับฝ่ายจัดรถไม่มีหน้า "ใบที่ยังไม่ครบ" ให้ไปกดโหลดใหม่ ปุ่มนี้เลยต้องอยู่ตรงนี้
            และต้องไม่หายตอนลิสต์ว่าง ไม่งั้นพอเคลียร์ครบก็ดึงใบใหม่เข้ามาไม่ได้อีก */}
        <button type="button" className="pslips-reload" onClick={state.reload} disabled={state.loading}
          title={state.connected
            ? "ดึงใบล่าสุดจากชีตมาอีกครั้ง"
            : "ยังไม่ได้ตั้งค่า Google Sheet — อ่านจากในเครื่องอย่างเดียว"}>
          <span className={"pslips-spin" + (state.loading ? " on" : "")}><IconRefresh /></span>
          รีเฟรช
        </button>
      </div>

      {slips.length > 0 ? (
        <div className="pslips-grid">
          {slips.map((s) => (
            <button key={s.rec.id} type="button" className="pslip" onClick={() => onOpen(s.rec)}>
              <span className="pslip-ic" style={{ background: s.tint, color: s.tone }}><IconDoc /></span>
              <span className="pslip-tx">
                <span className="pslip-code">{s.rec.docNo || "–"}</span>
                <span className="pslip-age" style={{ color: s.tone }}>
                  <span className="dot" />
                  {!showAging ? "รอกรอก" : s.days === 0 ? "เข้าวันนี้" : `ค้าง ${s.days} วัน`}
                </span>
              </span>
              <span className="pslip-chev">›</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="pslips-none">{state.loading ? "กำลังตรวจใบล่าสุด…" : none}</div>
      )}
    </section>
  );
}
