/**
 * ตารางค่าซ่อมแซม — ตรงตาม details#repairPanel และ renderRepair() ของ index.html บน main
 *
 * ค่าซ่อม = Σ(อัตราปีนั้น × น้ำหนักถ่วงปีนั้น) ทั้ง 3 ปี
 *   ตามเวลา (บาท/เที่ยว)  แยกอัตรารถบริษัทกับรถร่วม
 *   ตามระยะทาง (บาท/กม.)  รถบริษัทกับรถร่วมใช้อัตราเดียวกัน
 *
 * ★ ปีในไฟล์ฐานเก็บเป็นเลขสองหลักของ ค.ศ. ("24" = ค.ศ. 2024 = พ.ศ. 2567)
 *   ห้ามเติม "25" ไปข้างหน้าเฉย ๆ จะกลายเป็น พ.ศ. 2524 ซึ่งเพี้ยนไป 43 ปี
 */
import { useState } from "react";
import { REF } from "../../../lib/refdata";
import { useOverrides } from "../../../lib/store/overrides";

const Chev = () => (
  <svg className="chev" width="18" height="18" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 9l6 6 6-6" /></svg>
);

const YEARS = REF.repair.years;
/** repYearLabel() ของ main:3105 */
const yearLabel = (y: string) => `พ.ศ. ${2000 + Number(y) + 543}`;

/** แท็บของตาราง — สองแท็บแรกเป็นอัตราตามเวลา แท็บสุดท้ายเป็นตามระยะทาง */
const TABS = [
  { id: "รถบริษัท", label: "ตามเวลา · รถบริษัท" },
  { id: "รถร่วม", label: "ตามเวลา · รถร่วม" },
  { id: "dist", label: "ตามระยะทาง (ใช้ร่วมกัน)" },
] as const;
type TabId = (typeof TABS)[number]["id"];

const thNum = (n: number, d: number) =>
  n.toLocaleString("th-TH", { minimumFractionDigits: d, maximumFractionDigits: d });

export default function RepairTable() {
  const [ovr, setOvr] = useOverrides();
  const [tab, setTab] = useState<TabId>("รถบริษัท");
  const [msg, setMsg] = useState<{ text: string; tone: string } | null>(null);

  const rep = ovr.repair ?? {};
  const isDist = tab === "dist";
  const unit = isDist ? "บาท/กม." : "บาท/เที่ยว";
  const digits = isDist ? 4 : 2;

  const weights = YEARS.map((_, i) => rep.weights?.[i] ?? REF.repair.weights[i] ?? 0);
  const weightSum = weights.reduce((s, w) => s + (Number(w) || 0), 0);

  const base = isDist ? REF.repair.dist : (REF.repair.time[tab] ?? {});
  const names = Object.keys(base).sort((a, b) => a.localeCompare(b, "th"));

  const baseVal = (veh: string, i: number) => base[veh]?.[i] ?? 0;
  const ovrVal = (veh: string, i: number) =>
    (isDist ? rep.dist?.[veh]?.[i] : rep.time?.[tab]?.[veh]?.[i]) ?? null;
  const value = (veh: string, i: number) => ovrVal(veh, i) ?? baseVal(veh, i);
  /** ถือว่า "แก้เอง" เฉพาะเมื่อค่าต่างจากฐานจริง ๆ — repIsEdited() ของ main:3111 */
  const edited = (veh: string, i: number) => {
    const v = ovrVal(veh, i);
    return v != null && Number.isFinite(v) && Math.abs(v - baseVal(veh, i)) > 1e-9;
  };

  const weighted = (veh: string) =>
    YEARS.reduce((s, _, i) => s + value(veh, i) * (weights[i] ?? 0), 0);

  const say = (text: string, tone = "var(--green)") => setMsg({ text, tone });

  const setWeight = (i: number, v: string) => {
    const n = parseFloat(v);
    const next = YEARS.map((_, j) => (j === i ? (Number.isFinite(n) ? n : REF.repair.weights[j] ?? 0) : weights[j] ?? 0));
    setOvr({ ...ovr, repair: { ...rep, weights: next } });
    say(`ปรับน้ำหนัก ${yearLabel(YEARS[i]!)} เป็น ${Number.isFinite(n) ? n : REF.repair.weights[i]} แล้ว ✓`);
  };

  const setCell = (veh: string, i: number, v: string) => {
    const n = parseFloat(v);
    const val = Number.isFinite(n) ? n : null;
    const cur = (isDist ? rep.dist?.[veh] : rep.time?.[tab]?.[veh]) ?? YEARS.map(() => null);
    const arr = YEARS.map((_, j) => (j === i ? val : cur[j] ?? null));
    setOvr(isDist
      ? { ...ovr, repair: { ...rep, dist: { ...rep.dist, [veh]: arr } } }
      : { ...ovr, repair: { ...rep, time: { ...rep.time, [tab]: { ...rep.time?.[tab], [veh]: arr } } } });
    say(`ปรับอัตรา ${veh} · ${yearLabel(YEARS[i]!)} แล้ว ✓ (ค่าที่ใช้คำนวณอัปเดตทันที)`);
  };

  /** นับช่องที่แก้เองทั้งตาราง — repCountEdits() ของ main:3129 */
  const countEdits = () => {
    let n = 0;
    (rep.weights ?? []).forEach((v, i) => {
      if (v != null && Math.abs(v - (REF.repair.weights[i] ?? 0)) > 1e-9) n++;
    });
    for (const f of ["รถบริษัท", "รถร่วม"]) {
      const src = rep.time?.[f] ?? {};
      for (const veh of Object.keys(src)) {
        src[veh]?.forEach((v, i) => {
          if (v != null && Math.abs(v - (REF.repair.time[f]?.[veh]?.[i] ?? 0)) > 1e-9) n++;
        });
      }
    }
    for (const veh of Object.keys(rep.dist ?? {})) {
      rep.dist?.[veh]?.forEach((v, i) => {
        if (v != null && Math.abs(v - (REF.repair.dist[veh]?.[i] ?? 0)) > 1e-9) n++;
      });
    }
    return n;
  };

  const resetAll = () => {
    const n = countEdits();
    if (!n) { say("ยังไม่มีค่าที่แก้เอง", "var(--ink-faint)"); return; }
    if (!confirm(`ย้อนค่าซ่อมทั้งหมดกลับไปใช้ค่าเดิมจากไฟล์ Excel? (มีที่แก้เองอยู่ ${n} ช่อง)`)) return;
    setOvr({ ...ovr, repair: {} });
    say("ย้อนกลับไปใช้ค่าเดิมทั้งหมดแล้ว ✓", "var(--orange-dark)");
  };

  const resetTab = () => {
    const next = { ...rep };
    if (isDist) delete next.dist;
    else if (next.time) next.time = Object.fromEntries(
      Object.entries(next.time).filter(([k]) => k !== tab));
    setOvr({ ...ovr, repair: next });
    say("ย้อนเฉพาะแท็บนี้แล้ว ✓", "var(--orange-dark)");
  };

  return (
    <div className="card">
      {/* main เปิดกางไว้ตั้งแต่แรก (มี attribute open) */}
      <details className="prices" open>
        <summary>
          🔧 การคำนวณค่าซ่อมแซม (แก้อัตราและน้ำหนักรายปีได้) · กดเพื่อดู/แก้ไข
          <Chev />
        </summary>

        <div className="price-note" style={{ marginTop: 12 }}>
          <b>สูตร:</b> ค่าซ่อม = ผลรวมของ (อัตราปีนั้น × น้ำหนักปีนั้น) ทั้ง 3 ปี<br />
          <b>ตามเวลา</b> = บาท/เที่ยว · แยกอัตรา <b>รถบริษัท</b> กับ <b>รถร่วม</b> ·
          <b> ตามระยะทาง</b> = บาท/กม. · รถบริษัทกับรถร่วมใช้อัตราเดียวกัน<br />
          แก้ตัวเลขในช่องได้เลย ระบบคำนวณและบันทึกให้อัตโนมัติ · ช่องที่แก้เองจะมีจุดส้ม{" "}
          <span style={{ color: "var(--orange)" }}>●</span> กำกับ
        </div>

        <div className="rep-wrap">
          <div className="rep-weights">
            <b>น้ำหนักถ่วงรายปี</b>
            {YEARS.map((y, i) => (
              <span key={y} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span className="wlab">{yearLabel(y)}</span>
                <input type="number" step="0.05" min={0}
                  className={rep.weights?.[i] != null
                    && Math.abs((rep.weights[i] ?? 0) - (REF.repair.weights[i] ?? 0)) > 1e-9
                    ? "edited" : undefined}
                  value={weights[i] ?? 0}
                  onChange={(e) => setWeight(i, e.target.value)} />
              </span>
            ))}
            <span className="locknote">
              รวม {weightSum.toFixed(2)}
              {Math.abs(weightSum - 1) > 1e-6
                ? <b style={{ color: "var(--red)" }}> — ปกติควรรวมได้ 1.00</b>
                : " ✓"}
            </span>
          </div>

          <div className="rep-tabs">
            {TABS.map((t) => (
              <button key={t.id} type="button" className={"rtab" + (tab === t.id ? " on" : "")}
                onClick={() => setTab(t.id)}>{t.label}</button>
            ))}
          </div>

          <div className="scroll" style={{ maxHeight: 420, overflowY: "auto" }}>
            <table className="rep-tbl">
              <thead><tr>
                <th>ชนิดรถ</th>
                {YEARS.map((y) => <th key={y}>อัตรา {yearLabel(y)}</th>)}
                <th>รวม ({unit})</th>
              </tr></thead>
              <tbody>
                {names.map((veh) => (
                  <tr key={veh}>
                    <td>{veh}</td>
                    {YEARS.map((_, i) => (
                      <td key={i}>
                        <input type="number" step="any"
                          className={"rc" + (edited(veh, i) ? " edited" : "")}
                          value={value(veh, i)}
                          onChange={(e) => setCell(veh, i, e.target.value)} />
                        {edited(veh, i) && (
                          <span className="rep-dot" title={`แก้เอง (เดิม ${baseVal(veh, i)})`}>●</span>
                        )}
                      </td>
                    ))}
                    <td className="rep-total">{thNum(weighted(veh), digits)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {msg && <div className="msg" style={{ marginTop: 8, color: msg.tone }}>{msg.text}</div>}

          <p style={{ fontSize: 11.5, color: "var(--ink-faint)", marginTop: 8 }}>
            <span onClick={resetAll} role="button" tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") resetAll(); }}
              style={{ color: "var(--orange-dark)", cursor: "pointer", textDecoration: "underline" }}>
              ↺ ย้อนกลับไปใช้ค่าเดิมทั้งหมด
            </span>
            {" · "}
            <span onClick={resetTab} role="button" tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") resetTab(); }}
              style={{ color: "var(--orange-dark)", cursor: "pointer", textDecoration: "underline" }}>
              ย้อนเฉพาะแท็บนี้
            </span>
          </p>
        </div>
      </details>
    </div>
  );
}
