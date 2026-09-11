/**
 * นำเข้าข้อมูลดิบเพื่ออัปเดตอัตราค่าซ่อมแซม — ตามเอกสาร "ค่าซ่อม.pdf"
 *
 * วางไว้ใต้ตารางค่าซ่อมในหน้าการตั้งค่า เพราะผลลัพธ์ลงในตารางนั้นโดยตรง
 *
 * รับเป็น "ไฟล์" อย่างเดียว ไม่มีช่องพิมพ์/วางข้อความ — ของจริงมีหลายหมื่นบรรทัด
 * วางในช่องข้อความไม่ไหวอยู่แล้ว และการมีสองทางทำให้ผู้ใช้ลังเลว่าต้องใช้ทางไหน
 *
 * ไม่มีช่องน้ำหนักถ่วงรายปี — ตารางด้านบนมีให้แก้อยู่แล้ว ไม่ต้องรับซ้ำ
 *
 * ตรรกะทั้งหมดอยู่ใน lib/repair/ — ที่นี่มีแต่หน้าจอ ตามกติกาว่าฟีเจอร์ห้ามมีสูตรของตัวเอง
 */
import { useMemo, useRef, useState } from "react";
import { REF } from "../../lib/refdata";
import { useOverrides } from "../../lib/store/overrides";
import { addSnapshot } from "../../lib/store/repairSnapshots";
import { BASE_YEARS, KNOWN_VEHICLES, planApply } from "../../lib/repair/apply";
import { readTable } from "../../lib/repair/parse";
import { ANY_FLEET, TIME_KEYWORDS, computeRates, parseMaintenance, parseOperations } from "../../lib/repair/rates";

const Chev = () => (
  <svg className="chev" width="18" height="18" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 9l6 6 6-6" /></svg>
);

const thNum = (n: number | undefined, d: number) =>
  n == null ? "–" : n.toLocaleString("th-TH", { minimumFractionDigits: d, maximumFractionDigits: d });

const FLEET_LABEL = (f: string) => (f === ANY_FLEET ? "ทุกประเภท" : f);

/** ไฟล์หนึ่งช่อง — ตารางที่อ่านได้ พร้อมชื่อไฟล์และข้อผิดพลาดถ้ามี */
interface Picked {
  name: string;
  table: string[][];
}

function FileBox({ title, hint, picked, error, onPick, onClear, status, tone }: {
  title: string; hint: string; picked: Picked | null; error: string | null;
  onPick: (p: Picked) => void; onClear: () => void; status: string; tone: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  /** ข้อผิดพลาดของการอ่านไฟล์เก็บไว้ในตัวช่องเอง ไม่ต้องดันขึ้นไปถึงหน้าหลัก */
  const [err, setErr] = useState<string | null>(null);
  const shown = err ?? error;

  const take = async (f: File | undefined) => {
    if (!f) return;
    setBusy(true);
    try {
      onPick({ name: f.name, table: await readTable(f) });
    } catch (e) {
      onClear();
      setErr((e as Error).message);
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  };

  return (
    <div className="xls-box">
      <label>
        <b>{title}</b>
        <span className="xls-hint">{hint}</span>
      </label>

      <div className={"xls-drop" + (picked ? " on" : "")}>
        <input ref={ref} type="file" accept=".xlsx,.csv,.tsv,.txt"
          onChange={(e) => { setErr(null); void take(e.target.files?.[0]); }} />
        {picked && (
          <div className="xls-picked">
            <b>{picked.name}</b>
            <button type="button" className="btn-ghost"
              onClick={() => { setErr(null); onClear(); }}>เอาออก</button>
          </div>
        )}
      </div>

      <div className="xls-status" style={{ color: busy ? "var(--ink-soft)" : (shown ? "var(--red)" : tone) }}>
        {busy ? "กำลังอ่านไฟล์…" : (shown ?? status)}
      </div>
    </div>
  );
}

export default function RepairImport() {
  const [ovr, setOvr] = useOverrides();
  const [maintFile, setMaintFile] = useState<Picked | null>(null);
  const [opFile, setOpFile] = useState<Picked | null>(null);
  const [mergeTrailer, setMergeTrailer] = useState(true);
  const [preview, setPreview] = useState(false);
  const [msg, setMsg] = useState<{ text: string; tone: string } | null>(null);

  const maint = useMemo(
    () => (maintFile ? parseMaintenance(maintFile.table) : null), [maintFile]);
  const ops = useMemo(
    () => (opFile ? parseOperations(opFile.table) : null), [opFile]);

  const ready = !!maint?.rows.length && !!ops?.rows.length;

  const result = useMemo(
    () => (ready
      ? computeRates(maint!.rows, ops!.rows, [], { mergeTrailer, knownVehicles: KNOWN_VEHICLES })
      : null),
    [ready, maint, ops, mergeTrailer],
  );

  // น้ำหนักถ่วงมาจากตารางด้านบนเสมอ — หน้านี้ไม่รับน้ำหนักเข้ามาแล้ว
  const plan = useMemo(
    () => (result ? planApply(result, ovr.repair, { useWeights: false }) : null),
    [result, ovr.repair],
  );

  const effWeights = BASE_YEARS.map((_, i) =>
    ovr.repair?.weights?.[i] ?? REF.repair.weights[i] ?? 0);

  const por = (rates: Record<number, number> | undefined) =>
    BASE_YEARS.reduce((s, y, i) => s + ((rates?.[y] ?? 0) * (effWeights[i] ?? 0)), 0);

  const timeRows = (result?.vehicles ?? []).flatMap((v) =>
    Object.entries(v.time).map(([fleet, byYear]) => ({ vehicle: v.vehicle, fleet, byYear })));
  const distRows = (result?.vehicles ?? []).filter((v) => Object.keys(v.dist).length);

  const statusOf = (t: { rows: unknown[]; missing: string[] } | null, picked: Picked | null) => {
    if (!picked) return { text: "ยังไม่ได้เลือกไฟล์", tone: "var(--ink-faint)" };
    if (!t) return { text: "อ่านไฟล์ไม่ได้", tone: "var(--red)" };
    if (t.missing.length) return { text: `หาคอลัมน์ไม่เจอ: ${t.missing.join(", ")}`, tone: "var(--red)" };
    if (!t.rows.length) return { text: "อ่านข้อมูลไม่ได้สักบรรทัด", tone: "var(--red)" };
    return { text: `อ่านได้ ${t.rows.length.toLocaleString("th-TH")} บรรทัด ✓`, tone: "var(--green)" };
  };

  const apply = () => {
    if (!plan || !plan.cells) return;
    // ★ เก็บของเดิมไว้เป็นชุดก่อนทับเสมอ ผู้ใช้จึงย้อนกลับได้แม้กดทับไปแล้ว
    const kept = addSnapshot(`ก่อนนำเข้า ${maintFile?.name ?? ""}`.trim(), ovr.repair ?? {});
    setOvr({ ...ovr, repair: plan.repair });
    setMsg({
      text: `อัปเดตอัตราค่าซ่อมแล้ว ${plan.cells} ช่อง · ${plan.vehicles.length} ชนิดรถ`
        + ` · เก็บชุดค่าเดิมไว้ให้แล้วในชื่อ “${kept[0]?.name ?? ""}”`,
      tone: "var(--green)",
    });
    setPreview(false);
  };

  const clearAll = () => {
    setMaintFile(null); setOpFile(null); setPreview(false); setMsg(null);
  };

  const allWarnings = [
    ...(maint?.warnings ?? []), ...(ops?.warnings ?? []),
    ...(result?.warnings ?? []), ...(plan?.warnings ?? []),
  ];

  return (
    <div className="card">
      <details className="prices">
        <summary>
          📥 อัปเดตอัตราค่าซ่อมจากไฟล์ Excel · กดเพื่อเปิด
          <Chev />
        </summary>

        <div className="price-note" style={{ marginTop: 12 }}>
          เลือกไฟล์ <b>.xlsx</b> หรือ <b>.csv</b> ที่ส่งออกจากระบบบัญชี แล้วกด “คำนวณอัตรา” —
          ผลลัพธ์จะไปลงตารางค่าซ่อมด้านบนเมื่อกดยืนยัน<br />
          <b>วิธีแบ่งประเภทค่าใช้จ่าย:</b> ชื่อบัญชีมีคำว่า “สินทรัพย์รอตัดบัญชี” → คิดตามเวลา
          โดยหารยอดด้วย 8 · รายละเอียดการซ่อมตรงกับคำสำคัญ {TIME_KEYWORDS.length} คำ
          (ประกันภัย · ภาษี · GPS · ตรวจเช็ค 68 จุด · บำรุงรักษายาง ฯลฯ) → คิดตามเวลาเต็มจำนวน ·
          ที่เหลือ → คิดตามระยะทาง<br />
          <b>อัตรา:</b> ตามเวลา = ยอดกลุ่มเวลา ÷ จำนวนวัน <i>(แยกตามประเภทรถ)</i> ·
          ตามระยะทาง = ยอดกลุ่มระยะทาง ÷ ระยะทางรวม <i>(รวมทุกประเภทรถ เพราะตารางใช้แถวเดียวกัน)</i><br />
          <b>น้ำหนักถ่วงรายปี</b> ใช้ค่าที่ตั้งไว้ในตารางด้านบน ไม่ต้องใส่ซ้ำที่นี่
        </div>

        <div className="xls-grid two">
          <FileBox
            title="1 · รายงานค่าซ่อมตามงวด"
            hint="ต้องมี: ชนิดรถ · จำนวนเงิน · วันที่ตามงวด (หรือ ปี) — ควรมี: ประเภทรถ · ชื่อบัญชี · รายละเอียดการซ่อม"
            picked={maintFile} error={null}
            onPick={setMaintFile} onClear={() => setMaintFile(null)}
            status={statusOf(maint, maintFile).text} tone={statusOf(maint, maintFile).tone}
          />
          <FileBox
            title="2 · ข้อมูลการปฏิบัติงาน"
            hint="ต้องมี: ปี · ชนิดรถ · ระยะทางรวม · จำนวนวันรวม — ควรมี: ประเภทรถ (รถบริษัท/รถร่วม)"
            picked={opFile} error={null}
            onPick={setOpFile} onClear={() => setOpFile(null)}
            status={statusOf(ops, opFile).text} tone={statusOf(ops, opFile).tone}
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
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginTop: 4 }}>
          <button className="btn-add" type="button" disabled={!ready}
            onClick={() => setPreview(true)}>
            คำนวณอัตรา
          </button>
          <button className="btn-ghost" type="button" onClick={clearAll}>ล้างทั้งหมด</button>
          {!ready && <span className="locknote">ต้องเลือกไฟล์ทั้งสองช่องก่อนจึงจะคำนวณได้</span>}
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
                ชุดค่าเดิมจะถูกเก็บไว้ให้อัตโนมัติก่อนทับ — เลือกย้อนกลับได้ในตารางด้านบน
              </span>
            </div>
          </>
        )}

        {msg && <div className="msg" style={{ marginTop: 10, color: msg.tone }}>{msg.text}</div>}
      </details>
    </div>
  );
}
