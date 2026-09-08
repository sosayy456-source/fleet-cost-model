/**
 * ค้นรหัสลูกค้า — โครงตรงตาม v5:1075-1157 (การ์ดค้นหา + กล่องผลลัพธ์ cc-hit / cc-miss)
 *
 * ★ เทียบแบบเป๊ะเท่านั้น: CUS ตามด้วยเลข 7 หลักพอดี หรือรหัสต้นฉบับครบ 64 ตัว
 *   ของเดิมรับ /^CUS/ แล้วโยนเข้า parseInt ทำให้ CUS1, CUS001, CUS0000001
 *   ชี้ไปที่ลูกค้ารายเดียวกันหมด และรับรหัสต้นฉบับแค่ 12 ตัวก็ตอบแล้ว
 */
import { useEffect, useState } from "react";
import { isCustCode, isFullHash, loadCustMap } from "../../lib/custmap/custmap";
import type { CustMap } from "../../lib/custmap/custmap";

const MAP_URL = `${import.meta.env.BASE_URL}custmap.bin`;

const Chev = () => (
  <svg className="chev" width="18" height="18" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 9l6 6 6-6" /></svg>
);

/** กล่องแสดงรหัสต้นฉบับ — 64 ตัวยาวเกินบรรทัดเดียว ต้องตัดขึ้นบรรทัดใหม่ได้ */
const hashStyle: React.CSSProperties = {
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSize: 12.5, lineHeight: 1.7, wordBreak: "break-all", userSelect: "all",
};

export default function CustCode() {
  const [map, setMap] = useState<CustMap | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    loadCustMap(MAP_URL)
      .then((m) => { if (alive) setMap(m); })
      .catch((e) => { if (alive) setErr((e as Error).message); });
    return () => { alive = false; };
  }, []);

  const input = q.trim();
  const asCode = isCustCode(input);
  const asHash = isFullHash(input);
  /** พิมพ์อะไรมาก็ไม่เข้าทั้งสองรูปแบบ — ต่างจาก "รูปแบบถูกแต่ไม่มีในตาราง" */
  const badShape = !!input && !asCode && !asHash;

  const hitHash = map && asCode ? map.hashFor(input) : null;
  const hitCode = map && asHash ? map.codeFor(input) : null;

  const copy = (text: string) => {
    navigator.clipboard?.writeText(text).then(
      () => { setCopied(true); setTimeout(() => setCopied(false), 1600); },
      () => { /* เบราว์เซอร์ไม่ให้สิทธิ์ก็ยังเลือกข้อความเองได้ */ },
    );
  };

  const status = err ? "โหลดตารางไม่สำเร็จ"
    : map ? `พร้อมใช้งาน · ${map.count.toLocaleString("th-TH")} ราย`
      + (map.full ? "" : " · ไฟล์รุ่นเก่า เก็บแค่ 12 ตัวแรก")
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
              <code>python etl/build_custmap.py "แปลงรหัสลูกหนี้รวม.xlsx"</code>
            </div>
          </div>
        )}

        {map && !map.full && (
          <div className="banner">
            ไฟล์ตารางเป็นรุ่นเก่าที่เก็บรหัสต้นฉบับไว้แค่ 12 ตัวแรก จึงแสดงรหัสเต็มไม่ได้
            <div style={{ fontWeight: 400, marginTop: 6, fontSize: 13 }}>
              สร้างใหม่จากไฟล์ต้นทางด้วย{" "}
              <code>python etl/build_custmap.py "แปลงรหัสลูกหนี้รวม.xlsx"</code>
            </div>
          </div>
        )}

        <div className="field">
          <label>รหัสย่อ CUS + เลข 7 หลัก หรือรหัสต้นฉบับ 64 ตัว</label>
          <input value={q} onChange={(e) => setQ(e.target.value)} disabled={!map}
            spellCheck={false} autoComplete="off"
            placeholder="เช่น CUS0000001 หรือวางรหัสต้นฉบับทั้ง 64 ตัว" />
        </div>

        {!map && !err && <p className="muted">กำลังโหลดตาราง ...</p>}

        {map && input && (
          badShape ? (
            <div className="cc-miss">
              รูปแบบไม่ถูกต้อง — ต้องเป็น <b>CUS</b> ตามด้วยเลข <b>7 หลักพอดี</b> (เช่น CUS0000001)
              หรือรหัสต้นฉบับ <b>ครบทั้ง 64 ตัว</b>
              <div style={{ fontWeight: 400, marginTop: 6, fontSize: 12.5 }}>
                พิมพ์ไป {input.length} ตัวอักษร · ระบบเทียบแบบเป๊ะ ไม่เดาให้จากตัวขึ้นต้น
              </div>
            </div>
          ) : hitHash || hitCode ? (
            <div className="cc-hit">
              <div className="cc-row"><span className="k">รหัสย่อที่ระบบใช้</span>
                <span className="cc-big">{asCode ? input.toUpperCase() : hitCode}</span></div>
              <div className="cc-row" style={{ alignItems: "flex-start" }}>
                <span className="k">
                  {map.full ? "รหัสต้นฉบับ" : "รหัสต้นฉบับ (12 ตัวแรก)"}
                </span>
                <span style={hashStyle}>{asCode ? hitHash : input.toLowerCase()}</span>
              </div>
              <div className="cc-row">
                <span className="k" />
                <button className="btn-ghost" type="button"
                  onClick={() => copy((asCode ? hitHash : input.toLowerCase()) ?? "")}>
                  {copied ? "คัดลอกแล้ว ✓" : "คัดลอกรหัสต้นฉบับ"}
                </button>
              </div>
            </div>
          ) : (
            <div className="cc-miss">
              รูปแบบถูกต้องแต่<b>ไม่มีรหัสนี้ในตาราง</b>
              {asCode && ` — ตารางมีถึง CUS${String(map.count).padStart(7, "0")} เท่านั้น`}
            </div>
          )
        )}
      </div>

      <div className="card">
        <details className="prices">
          <summary>ℹ️ วิธีทำงานของรหัสลูกค้า · กดเพื่อดู<Chev /></summary>
          <div className="gs-steps" style={{ marginTop: 12 }}>
            รหัสลูกค้าในไฟล์ข้อมูลถูก <b>anonymize เป็น SHA-256 ยาว 64 ตัว</b> ซึ่งอ่านและพูดถึงกันไม่ได้
            ระบบจึงจับคู่แต่ละรหัสกับเลขลำดับแถวเดิม แล้วออกรหัสย่อรูปแบบ <code>CUS</code> + เลขลำดับ 7 หลัก
            <br /><br />
            ตารางคู่รหัสมาจากไฟล์ <code>แปลงรหัสลูกหนี้รวม.xlsx</code> ทั้งไฟล์
            (คอลัมน์ “รหัสที่แปลงแล้ว” คู่กับ “รหัสต้นฉบับ”) แปลงเป็น <code>custmap.bin</code>
            ระเบียนละ 32 ไบต์ จึงเก็บรหัสต้นฉบับไว้<b>ครบทุกตัว</b> ค้นย้อนกลับได้เต็ม
            <br /><br />
            <b>การเทียบเป็นแบบเป๊ะทั้งสองทาง</b> — <code>CUS001</code> ไม่เท่ากับ <code>CUS0000001</code>
            และรหัสต้นฉบับต้องครบ 64 ตัว เพราะรหัสคนละรายที่ขึ้นต้นเหมือนกันมีได้
            ถ้ายอมให้เดาจากตัวขึ้นต้น จะชี้ผิดรายโดยไม่มีอะไรเตือน
            <br /><br />
            ไฟล์ตารางแยกเป็น <code>custmap.bin</code> โหลดเฉพาะตอนเข้าหน้านี้ —
            ต่างจากไฟล์เดิมที่ฝัง base64 4.6 MB ไว้ในหน้าเว็บ ทำให้ทุกคนต้องโหลดแม้ไม่ได้ใช้
          </div>
        </details>
      </div>
    </>
  );
}
