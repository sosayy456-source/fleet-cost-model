/** ค้นรหัสลูกค้า — โครงตรงตาม v5:1075-1157 (การ์ดค้นหา + กล่องผลลัพธ์ cc-hit / cc-miss) */
import { useEffect, useState } from "react";
import { loadCustMap } from "../../lib/custmap/custmap";
import type { CustMap } from "../../lib/custmap/custmap";

const MAP_URL = `${import.meta.env.BASE_URL}custmap.bin`;

const Chev = () => (
  <svg className="chev" width="18" height="18" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 9l6 6 6-6" /></svg>
);

export default function CustCode() {
  const [map, setMap] = useState<CustMap | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    let alive = true;
    loadCustMap(MAP_URL)
      .then((m) => { if (alive) setMap(m); })
      .catch((e) => { if (alive) setErr((e as Error).message); });
    return () => { alive = false; };
  }, []);

  const input = q.trim();
  const asCode = map && /^CUS/i.test(input) ? map.prefixFor(input) : null;
  const asHash = map && /^[0-9a-f]{12,}$/i.test(input) ? map.codeFor(input) : null;
  const hit = asCode || asHash;

  const status = err ? "โหลดตารางไม่สำเร็จ"
    : map ? `พร้อมใช้งาน · ${map.count.toLocaleString("th-TH")} ราย`
      : "กำลังเตรียมฐานข้อมูลรหัส…";

  return (
    <>
      <div className="card">
        <div className="card-h">
          <span className="step">?</span><h2>ค้นหา</h2>
          <span className="hint">{status}</span>
        </div>

        {err && (
          <div className="banner">
            {err}
            <div style={{ fontWeight: 400, marginTop: 6, fontSize: 13 }}>
              ไฟล์ <code>custmap.bin</code> ไม่ได้ commit ขึ้น repo เพราะมาจากข้อมูลลูกค้าจริง
              สร้างในเครื่องด้วยคำสั่ง:<br />
              <code>node tools/extract-custmap.mjs ../โมเดลเดินรถ-gsheet-v5.html public/custmap.bin</code>
            </div>
          </div>
        )}

        <div className="field">
          <label>รหัสต้นฉบับ (hash) หรือรหัสย่อ CUSxxxxxxx</label>
          <input value={q} onChange={(e) => setQ(e.target.value)} disabled={!map}
            placeholder="วางรหัส hash หรือพิมพ์ CUS0000001" />
        </div>

        {!map && !err && <p className="muted">กำลังโหลดตาราง (3.3 MB) ...</p>}

        {map && input && (hit ? (
          <div className="cc-hit">
            {asHash && (
              <>
                <div className="cc-row"><span className="k">รหัสย่อที่ระบบใช้</span>
                  <span className="cc-big">{asHash}</span></div>
                <div className="cc-row"><span className="k">รหัสต้นฉบับที่กรอก</span>
                  <span className="v">{input}</span></div>
              </>
            )}
            {asCode && (
              <>
                <div className="cc-row"><span className="k">รหัสย่อที่กรอก</span>
                  <span className="cc-big">{input.toUpperCase()}</span></div>
                <div className="cc-row"><span className="k">รหัสต้นฉบับ (12 ตัวแรก)</span>
                  <span className="v">{asCode}…</span></div>
              </>
            )}
          </div>
        ) : (
          <div className="cc-miss">
            ไม่พบ — ตรวจว่าพิมพ์ครบหรือยัง (รหัสต้นฉบับต้องอย่างน้อย 12 ตัว · รหัสย่อต้องขึ้นต้นด้วย CUS)
          </div>
        ))}
      </div>

      <div className="card">
        <details className="prices">
          <summary>ℹ️ วิธีทำงานของรหัสลูกค้า · กดเพื่อดู<Chev /></summary>
          <div className="gs-steps" style={{ marginTop: 12 }}>
            รหัสลูกค้าในไฟล์ข้อมูลถูก <b>anonymize เป็น SHA-256 ยาว 64 ตัว</b> ซึ่งอ่านและพูดถึงกันไม่ได้
            ระบบจึงจับคู่แต่ละรหัสกับเลขลำดับแถวเดิม แล้วออกรหัสย่อรูปแบบ <code>CUS</code> + เลขลำดับ 7 หลัก
            <br /><br />
            ตารางเก็บแค่ <b>12 ตัวแรก</b>ของรหัสต้นฉบับ (ยาวพอที่ยืนยันแล้วว่าไม่ชนกัน)
            การค้นย้อนกลับจากรหัสย่อจึงได้เฉพาะตัวขึ้นต้น ไม่ได้รหัสเต็ม
            <br /><br />
            ไฟล์ตารางแยกเป็น <code>custmap.bin</code> โหลดเฉพาะตอนเข้าหน้านี้ —
            ต่างจากไฟล์เดิมที่ฝัง base64 4.6 MB ไว้ในหน้าเว็บ ทำให้ทุกคนต้องโหลดแม้ไม่ได้ใช้
          </div>
        </details>
      </div>
    </>
  );
}
