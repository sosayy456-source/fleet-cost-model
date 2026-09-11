/**
 * นำเข้าข้อมูลดิบจาก Excel เพื่ออัปเดตอัตราค่าซ่อมแซม — ตามเอกสาร "ค่าซ่อม.pdf"
 *
 * วางไว้ใต้ตารางค่าซ่อมในหน้าการตั้งค่า เพราะผลลัพธ์ลงในตารางนั้นโดยตรง
 *
 * รับข้อมูลสองทาง — วางจากคลิปบอร์ด (เร็วสำหรับตารางเล็ก) และเลือกไฟล์ .csv/.txt
 * (จำเป็นสำหรับรายงานค่าซ่อมจริงที่มีหลายหมื่นบรรทัด ซึ่งวางในช่องข้อความไม่ไหว)
 * ไม่รับ .xlsx โดยตรงเพราะต้องลากไลบรารีอ่าน Excel ราว 400 KB เข้ามาใน bundle
 * ที่ทุกคนต้องโหลด — Save As CSV ใน Excel ครั้งเดียวจบกว่า
 *
 * ตรรกะทั้งหมดอยู่ใน lib/repair/ — ที่นี่มีแต่หน้าจอ ตามกติกาว่าฟีเจอร์ห้ามมีสูตรของตัวเอง
 */
import { useMemo, useRef, useState } from "react";
import { REF } from "../../lib/refdata";
import { useOverrides } from "../../lib/store/overrides";
import { BASE_YEARS, KNOWN_VEHICLES, planApply } from "../../lib/repair/apply";
import { decodeThai } from "../../lib/repair/parse";
import {
  ANY_FLEET, TIME_KEYWORDS, computeRates, parseMaintenance, parseOperations, parseWeights,
} from "../../lib/repair/rates";

const Chev = () => (
  <svg className="chev" width="18" height="18" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 9l6 6 6-6" /></svg>
);

const thNum = (n: number | undefined, d: number) =>
  n == null ? "–" : n.toLocaleString("th-TH", { minimumFractionDigits: d, maximumFractionDigits: d });

const FLEET_LABEL = (f: string) => (f === ANY_FLEET ? "ทุกประเภท" : f);

/** หนึ่งช่องรับข้อมูล — วางจากคลิปบอร์ด หรือเลือกไฟล์ */
function Box({ title, hint, value, onChange, status, tone }: {
  title: string; hint: string; value: string;
  onChange: (v: string) => void; status: string; tone: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const pick = async (f: File | undefined) => {
    if (!f) return;
    setBusy(true);
    try {
      onChange(decodeThai(await f.arrayBuffer()));
    } catch {
      onChange("");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="xls-box">
      <label>
        <b>{title}</b>
        <span className="xls-hint">{hint}</span>
      </label>
      <textarea value={value.length > 200_000 ? value.slice(0, 200_000) + "\n…" : value}
        onChange={(e) => onChange(e.target.value)} spellCheck={false}
        placeholder="คัดลอกจาก Excel ทั้งตาราง (รวมบรรทัดหัวตาราง) แล้ววางที่นี่ หรือเลือกไฟล์ด้านล่าง" />
      <div className="xls-file">
        <input ref={fileRef} type="file" accept=".csv,.tsv,.txt"
          onChange={(e) => void pick(e.target.files?.[0])} />
        {value && (
          <button type="button" className="btn-ghost" onClick={() => onChange("")}>ล้างช่องนี้</button>
        )}
      </div>
      <div className="xls-status" style={{ color: busy ? "var(--ink-soft)" : tone }}>
        {busy ? "กำลังอ่านไฟล์…" : status}
      </div>
    </div>
  );
}

export default function RepairImport() {
  const [ovr, setOvr] = useOverrides();
  const [maintText, setMaintText] = useState("");
  const [opText, setOpText] = useState("");
  const [weightText, setWeightText] = useState("");
  const [mergeTrailer, setMergeTrailer] = useState(true);
  const [useWeights, setUseWeights] = useState(true);
  const [preview, setPreview] = useState(false);
  const [msg, setMsg] = useState<{ text: string; tone: string } | null>(null);

  const maint = useMemo(() => parseMaintenance(maintText), [maintText]);
  const ops = useMemo(() => parseOperations(opText), [opText]);
  const weights = useMemo(() => parseWeights(weightText), [weightText]);

  const ready = maint.rows.length > 0 && ops.rows.length > 0;

  const result = useMemo(
    () => (ready
      ? computeRates(maint.rows, ops.rows, weights.rows, { mergeTrailer, knownVehicles: KNOWN_VEHICLES })
      : null),
    [ready, maint.rows, ops.rows, weights.rows, mergeTrailer],
  );

  const plan = useMemo(
    () => (result ? planApply(result, ovr.repair, { useWeights }) : null),
    [result, ovr.repair, useWeights],
  );

  /** น้ำหนักที่จะใช้จริงตอนถ่วง — เอาไว้โชว์คอลัมน์ POR ให้ตรงกับที่จะได้จริง */
  const effWeights = BASE_YEARS.map((y, i) =>
    (useWeights ? result?.weights[y] : undefined)
    ?? ovr.repair?.weights?.[i] ?? REF.repair.weights[i] ?? 0);

  const por = (rates: Record<number, number> | undefined) =>
    BASE_YEARS.reduce((s, y, i) => s + ((rates?.[y] ?? 0) * (effWeights[i] ?? 0)), 0);

  /** แถวของตารางอัตราตามเวลา — หนึ่งแถวต่อ ชนิดรถ × ประเภทรถ */
  const timeRows = (result?.vehicles ?? []).flatMap((v) =>
    Object.entries(v.time).map(([fleet, byYear]) => ({ vehicle: v.vehicle, fleet, byYear })));

  const distRows = (result?.vehicles ?? []).filter((v) => Object.keys(v.dist).length);

  const statusOf = (t: { rows: unknown[]; missing: string[] }, text: string) => {
    if (!text.trim()) return { text: "ยังไม่ได้ใส่ข้อมูล", tone: "var(--ink-faint)" };
    if (t.missing.length) return { text: `หาคอลัมน์ไม่เจอ: ${t.missing.join(", ")}`, tone: "var(--red)" };
    if (!t.rows.length) return { text: "อ่านข้อมูลไม่ได้สักบรรทัด", tone: "var(--red)" };
    return { text: `อ่านได้ ${t.rows.length.toLocaleString("th-TH")} บรรทัด ✓`, tone: "var(--green)" };
  };

  const apply = () => {
    if (!plan || !plan.cells) return;
    setOvr({ ...ovr, repair: plan.repair });
    setMsg({
      text: `อัปเดตอัตราค่าซ่อมแล้ว ${plan.cells} ช่อง · ${plan.vehicles.length} ชนิดรถ`
        + " (ย้อนกลับได้ที่ลิงก์ “↺ ย้อนกลับไปใช้ค่าเดิมทั้งหมด” ในตารางด้านบน)",
      tone: "var(--green)",
    });
    setPreview(false);
  };

  const clearAll = () => {
    setMaintText(""); setOpText(""); setWeightText("");
    setPreview(false); setMsg(null);
  };

  const allWarnings = [
    ...maint.warnings, ...ops.warnings, ...weights.warnings,
    ...(result?.warnings ?? []), ...(plan?.warnings ?? []),
  ];

  return (
    <div className="card">
      <details className="prices">
        <summary>
          📥 อัปเดตอัตราค่าซ่อมจากข้อมูล Excel · กดเพื่อเปิด
          <Chev />
        </summary>

        <div className="price-note" style={{ marginTop: 12 }}>
          ใส่ข้อมูลได้สองทาง — <b>คัดลอกจาก Excel แล้ววาง</b> (รวมบรรทัดหัวตาราง) หรือ{" "}
          <b>เลือกไฟล์ .csv</b> ที่ Save As มาจาก Excel (แนะนำสำหรับรายงานจริงที่มีหลายหมื่นบรรทัด)<br />
          <b>วิธีแบ่งประเภทค่าใช้จ่าย:</b> ชื่อบัญชีมีคำว่า “สินทรัพย์รอตัดบัญชี” → คิดตามเวลา
          โดยหารยอดด้วย 8 · รายละเอียดการซ่อมตรงกับคำสำคัญ {TIME_KEYWORDS.length} คำ
          (ประกันภัย · ภาษี · GPS · ตรวจเช็ค 68 จุด · บำรุงรักษายาง ฯลฯ) → คิดตามเวลาเต็มจำนวน ·
          ที่เหลือ → คิดตามระยะทาง<br />
          <b>อัตรา:</b> ตามเวลา = ยอดกลุ่มเวลา ÷ จำนวนวัน <i>(แยกตามประเภทรถ)</i> ·
          ตามระยะทาง = ยอดกลุ่มระยะทาง ÷ ระยะทางรวม <i>(รวมทุกประเภทรถ เพราะตารางใช้แถวเดียวกัน)</i>
        </div>

        <div className="xls-grid">
          <Box
            title="1 · รายงานค่าซ่อมตามงวด"
            hint="ต้องมี: ชนิดรถ · จำนวนเงิน · วันที่ตามงวด (หรือ ปี) — ควรมี: ประเภทรถ · ชื่อบัญชี · รายละเอียดการซ่อม"
            value={maintText} onChange={setMaintText}
            status={statusOf(maint, maintText).text} tone={statusOf(maint, maintText).tone}
          />
          <Box
            title="2 · ข้อมูลการปฏิบัติงาน"
            hint="ต้องมี: ปี · ชนิดรถ · ระยะทางรวม · จำนวนวันรวม — ควรมี: ประเภทรถ (รถบริษัท/รถร่วม)"
            value={opText} onChange={setOpText}
            status={statusOf(ops, opText).text} tone={statusOf(ops, opText).tone}
          />
          <Box
            title="3 · น้ำหนักถ่วงรายปี"
            hint="ต้องมี: ปี · น้ำหนัก (ใส่ 20% หรือ 0.2 ก็ได้) — ไม่ใส่ก็ได้ ระบบจะใช้น้ำหนักเดิม"
            value={weightText} onChange={setWeightText}
            status={statusOf(weights, weightText).text} tone={statusOf(weights, weightText).tone}
          />
        </div>

        <div className="xls-opts">
          <label>
            <input type="checkbox" checked={mergeTrailer}
              onChange={(e) => setMergeTrailer(e.target.checked)} />
            ยุบค่าซ่อม “หางเทรลเลอร์” เข้ากับ “รถเทรเล่อร์ (แม่)”
            <span className="xls-hint">
              ควรเปิดไว้ — ในระบบนี้รถเทรเลอร์ชี้ไปที่หัวลากอย่างเดียว แถวของหางจึงไม่เคยถูกใช้
            </span>
          </label>
          <label>
            <input type="checkbox" checked={useWeights}
              onChange={(e) => setUseWeights(e.target.checked)} />
            ใช้น้ำหนักถ่วงจากตารางที่ 3 ทับของเดิม
          </label>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginTop: 4 }}>
          <button className="btn-add" type="button" disabled={!ready}
            onClick={() => setPreview(true)}>
            คำนวณอัตรา
          </button>
          <button className="btn-ghost" type="button" onClick={clearAll}>ล้างทั้งหมด</button>
          {!ready && (
            <span className="locknote">ต้องมีอย่างน้อยตารางที่ 1 และ 2 ถึงจะคำนวณได้</span>
          )}
        </div>

        {allWarnings.length > 0 && (
          <div className="xls-warn">
            <b>ข้อควรตรวจ {allWarnings.length} ข้อ</b>
            <ul>{allWarnings.slice(0, 12).map((w, i) => <li key={i}>{w}</li>)}</ul>
            {allWarnings.length > 12 && <div className="locknote">…และอีก {allWarnings.length - 12} ข้อ</div>}
          </div>
        )}

        {preview && result && plan && (
          <>
            <div className="price-note" style={{ marginTop: 14 }}>
              <b>ผลการคำนวณ</b> · {result.vehicles.length} ชนิดรถ · ปีที่พบ{" "}
              {result.years.map((y) => `พ.ศ. ${y}`).join(" / ") || "–"} ·
              จะเขียนลงตาราง {plan.cells} ช่อง ·{" "}
              {result.fleetSplit
                ? "แยกอัตราตามเวลาตามประเภทรถจากไฟล์"
                : "ไฟล์ไม่ได้บอกประเภทรถ — ลงอัตราเดียวกันทุกแท็บ"}
              {Object.keys(result.mergedTrailer).length > 0 && (
                <>
                  <br />ยุบค่าซ่อมหางเข้าหัวลากแล้ว{" "}
                  {Object.entries(result.mergedTrailer)
                    .map(([y, v]) => `พ.ศ. ${y}: ${v.toLocaleString("th-TH", { maximumFractionDigits: 0 })} บาท`)
                    .join(" · ")}
                </>
              )}
            </div>

            <div className="xls-prevhead">อัตราตามเวลา (บาท/วัน)</div>
            <div className="scroll" style={{ maxHeight: 320, overflowY: "auto" }}>
              <table className="rep-tbl xls-prev">
                <thead><tr>
                  <th>ชนิดรถ</th><th>ลงแท็บ</th>
                  {BASE_YEARS.map((y) => <th key={y}>{y}</th>)}
                  <th>POR</th>
                </tr></thead>
                <tbody>
                  {timeRows.map((r) => (
                    <tr key={`${r.vehicle}|${r.fleet}`}>
                      <td>{r.vehicle}</td>
                      <td className="locknote">{FLEET_LABEL(r.fleet)}</td>
                      {BASE_YEARS.map((y) => <td key={y} className="num">{thNum(r.byYear[y], 2)}</td>)}
                      <td className="num rep-total">{thNum(por(r.byYear), 2)}</td>
                    </tr>
                  ))}
                  {!timeRows.length && (
                    <tr><td colSpan={BASE_YEARS.length + 3} className="locknote">
                      ไม่มีรายการที่เข้าเกณฑ์คิดตามเวลา
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="xls-prevhead">อัตราตามระยะทาง (บาท/กม.) · ใช้ร่วมกันทุกประเภทรถ</div>
            <div className="scroll" style={{ maxHeight: 320, overflowY: "auto" }}>
              <table className="rep-tbl xls-prev">
                <thead><tr>
                  <th>ชนิดรถ</th>
                  {BASE_YEARS.map((y) => <th key={y}>{y}</th>)}
                  <th>POR</th>
                </tr></thead>
                <tbody>
                  {distRows.map((v) => (
                    <tr key={v.vehicle}>
                      <td>{v.vehicle}</td>
                      {BASE_YEARS.map((y) => <td key={y} className="num">{thNum(v.dist[y], 4)}</td>)}
                      <td className="num rep-total">{thNum(por(v.dist), 4)}</td>
                    </tr>
                  ))}
                  {!distRows.length && (
                    <tr><td colSpan={BASE_YEARS.length + 2} className="locknote">
                      ไม่มีรายการที่เข้าเกณฑ์คิดตามระยะทาง
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginTop: 12 }}>
              <button className="btn btn-save" type="button" onClick={apply} disabled={!plan.cells}>
                ✓ นำอัตราไปใส่ตารางค่าซ่อม
              </button>
              <button className="btn-ghost" type="button" onClick={() => setPreview(false)}>ยกเลิก</button>
              <span className="locknote">
                เขียนเป็น “ค่าที่แก้เอง” ทับฐานกลาง ย้อนกลับได้ทุกเมื่อ ไม่ได้แก้ไฟล์ต้นฉบับ
              </span>
            </div>
          </>
        )}

        {msg && <div className="msg" style={{ marginTop: 10, color: msg.tone }}>{msg.text}</div>}
      </details>
    </div>
  );
}
