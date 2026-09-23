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
 * ★ ไม่มีกล่องคำอธิบายวิธีคิดและกล่องบอกที่มาของระยะทาง (เจ้าของงานให้เอาออก 24 ก.ย. 2569)
 *   ถ้าโหลดไฟล์ต้นทุนไม่ได้ บอกไว้ข้างปุ่มคำนวณแทน
 * ★ รับไฟล์เดียว — รายงานค่าซ่อม (เจ้าของงานสั่ง 23 ก.ย. 2569) ระยะทางรวม/จำนวนวันรวมของตารางที่ 2
 *   ไม่ต้องแนบไฟล์แล้ว คิดจากไฟล์ต้นทุนในโมเดล (costrev/trips.json ทุกเที่ยว) ผ่าน lib/repair/fromTrips.ts
 *   ระยะทาง = Σ km จากตารางเส้นทาง · จำนวนวัน = (ทะเบียน, วันที่ปล่อยรถ) ไม่ซ้ำ
 *
 * ตรรกะทั้งหมดอยู่ใน lib/repair/ — ที่นี่มีแต่หน้าจอ ตามกติกาว่าฟีเจอร์ห้ามมีสูตรของตัวเอง
 */
import { useMemo, useRef, useState } from "react";
import { REF } from "../../lib/refdata";
import { useOverrides } from "../../lib/store/overrides";
import { addSnapshot } from "../../lib/store/repairSnapshots";
import { BASE_YEARS, KNOWN_VEHICLES, planApply } from "../../lib/repair/apply";
import { readTable } from "../../lib/repair/parse";
import { ANY_FLEET, computeRates, parseMaintenance } from "../../lib/repair/rates";
import { monthsOfMaint, opsFromTrips } from "../../lib/repair/fromTrips";
import { useCostRev } from "../../lib/data/useCostRev";

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
  // ตัวหาร (ระยะทาง/วันวิ่ง) มาจากไฟล์ต้นทุนในโมเดล — ไม่ต้องแนบไฟล์ที่ 2
  const costrev = useCostRev();
  // ยุบหางเทรลเลอร์เข้าหัวลากเสมอ — ตัวเลือกเปิด/ปิดเอาออกแล้ว (เจ้าของงานสั่ง 24 ก.ย. 2569) ใช้ค่าเดิมที่ตั้งไว้เป็นค่าเริ่มต้น
  const mergeTrailer = true;
  const [preview, setPreview] = useState(false);
  const [msg, setMsg] = useState<{ text: string; tone: string } | null>(null);

  const maint = useMemo(
    () => (maintFile ? parseMaintenance(maintFile.table) : null), [maintFile]);
  // ตัวหารใช้เฉพาะเดือนที่มีในรายงานค่าซ่อม — รายงานเดือนเดียวต้องหารด้วยวัน/ระยะทางเดือนเดียว ไม่ใช่ทั้งปี
  const months = useMemo(() => (maint ? monthsOfMaint(maint.rows) : undefined), [maint]);
  const ops = useMemo(
    () => (costrev.data ? opsFromTrips(costrev.data.trips, { mergeTrailer, months }) : null),
    [costrev.data, mergeTrailer, months]);

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
    // บันทึกเฉพาะชุดที่นำเข้าใหม่ — ค่าฐานกลางกลับไปได้ด้วย "ย้อนกลับไปใช้ค่าเดิมทั้งหมด" อยู่แล้ว
    // จึงไม่ต้องสำรองของเดิมทุกครั้ง ไม่งั้นรายการชุดจะรกไปด้วยชุด "ก่อน..." ที่ไม่มีใครใช้
    setOvr({ ...ovr, repair: plan.repair });
    const saved = addSnapshot(`นำเข้า ${maintFile?.name ?? ""}`.trim(), plan.repair);
    setMsg({
      text: `อัปเดตอัตราค่าซ่อมแล้ว ${plan.cells} ช่อง · ${plan.vehicles.length} ชนิดรถ`
        + ` · บันทึกเป็นชุด “${saved[0]?.name ?? ""}” แล้ว`,
      tone: "var(--green)",
    });
    setPreview(false);
  };

  const clearAll = () => {
    setMaintFile(null); setPreview(false); setMsg(null);
  };

  const allWarnings = [
    // ★ ไฟล์ต้นทุนตัวอย่างเป็นเที่ยวสุ่มบางส่วน ไม่ใช่ทุกเที่ยวของกองรถ — หารค่าซ่อมจริงทั้งกองด้วยวัน/ระยะทางของเที่ยวสุ่ม
    //   อัตราจะสูงเกินจริงหลายสิบเท่า (เจอ 24 ก.ย. 2569: 10 ล้อตู้เย็น 14,478 บาท/วัน เทียบตารางเดิม ~500)
    ...(costrev.data?.manifest.isSample
      ? ["⚠ ไฟล์ต้นทุนในโมเดลตอนนี้เป็นข้อมูลตัวอย่าง (เที่ยวสุ่มบางส่วน ไม่ใช่ทุกเที่ยวของกองรถ) — อัตราที่คำนวณได้จะสูงเกินจริงมาก "
        + "อย่านำไปใส่ตาราง ให้วางไฟล์ต้นทุนจริงของปี/เดือนเดียวกับรายงานค่าซ่อมก่อน"]
      : []),
    ...(maint?.warnings ?? []),
    ...(ops?.noKm ? [`ไฟล์ต้นทุนมี ${ops.noKm.toLocaleString("th-TH")} เที่ยวที่เส้นทางไม่อยู่ในตารางระยะทาง — นับวันวิ่งแต่ไม่ได้บวกระยะทาง`] : []),
    // ช่วงของตัวหารต้องครอบคลุมช่วงของค่าซ่อม — ไม่งั้นอัตราสูงเกินจริง
    ...[...new Set(maint?.rows.map((r) => r.year) ?? [])].sort().flatMap((y) => {
      const want = months?.get(y);
      const have = ops?.months[y] ?? 0;
      if (want?.size) {
        return have < want.size
          ? [`พ.ศ. ${y}: รายงานค่าซ่อมมี ${want.size} เดือน แต่ไฟล์ต้นทุนมีเที่ยวแค่ ${have} เดือนในนั้น — อัตราปีนี้จะสูงเกินจริง`]
          : [];
      }
      return have < 12 ? [`ไฟล์ต้นทุนปี พ.ศ. ${y} มีข้อมูลแค่ ${have} เดือน — รายงานค่าซ่อมปีนี้ไม่บอกเดือน ถ้าเป็นทั้งปี อัตราจะสูงเกินจริง`] : [];
    }),
    ...(result?.warnings ?? []), ...(plan?.warnings ?? []),
  ];

  return (
    <div className="card">
      <details className="prices">
        <summary>
          📥 อัปเดตอัตราค่าซ่อมจากไฟล์ Excel · กดเพื่อเปิด
          <Chev />
        </summary>

        <div className="xls-grid" style={{ marginTop: 12 }}>
          <FileBox
            title="รายงานค่าซ่อมตามงวด"
            hint="ต้องมี: ชนิดรถ · จำนวนเงิน · วันที่ตามงวด (หรือ ปี) — ควรมี: ประเภทรถ · ชื่อบัญชี · รายละเอียดการซ่อม"
            picked={maintFile} error={null}
            onPick={setMaintFile} onClear={() => setMaintFile(null)}
            status={statusOf(maint, maintFile).text} tone={statusOf(maint, maintFile).tone}
          />
        </div>


        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginTop: 4 }}>
          <button className="btn-add" type="button" disabled={!ready}
            onClick={() => setPreview(true)}>
            คำนวณอัตรา
          </button>
          <button className="btn-ghost" type="button" onClick={clearAll}>ล้างทั้งหมด</button>
          {!ready && (
            <span className="locknote" style={costrev.error ? { color: "var(--red)" } : undefined}>
              {costrev.error ? `โหลดไฟล์ต้นทุน (ระยะทาง/วันวิ่ง) ไม่ได้ — ${costrev.error}`
                : !ops ? "กำลังโหลดไฟล์ต้นทุน…" : "เลือกรายงานค่าซ่อมก่อนจึงจะคำนวณได้"}
            </span>
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
                ค่าที่นำเข้าจะถูกบันทึกเป็นชุดใหม่ — กลับไปค่าเดิมได้ที่ “ย้อนกลับไปใช้ค่าเดิมทั้งหมด” ด้านบน
              </span>
            </div>
          </>
        )}

        {msg && <div className="msg" style={{ marginTop: 10, color: msg.tone }}>{msg.text}</div>}
      </details>
    </div>
  );
}
