/**
 * ค้นรหัสลูกค้า — โครงตรงตาม <section id="view-custcode"> ของ index.html บน main
 * (การ์ดค้นหา + การ์ด "รหัสที่ระบบออกใหม่" + กล่องอธิบายวิธีทำงาน)
 *
 * ★ เทียบแบบเป๊ะเท่านั้น: CUS ตามด้วยเลข 7 หลักพอดี · รหัสต้นฉบับครบ 64 ตัว ·
 *   หรือค่าที่เคยออกรหัสใหม่ให้ ซึ่งเทียบทั้งสตริง
 *   ของเดิมรับ /^CUS/ แล้วโยนเข้า parseInt ทำให้ CUS1, CUS001, CUS0000001
 *   ชี้ไปที่ลูกค้ารายเดียวกันหมด และรหัสต้นฉบับพิมพ์แค่ 12 ตัวก็ตอบแล้ว
 */
import { useEffect, useMemo, useState } from "react";
import { CUSTMAP_URL, custCode, isFullHash, isHashLike, loadCustMap } from "../../lib/custmap/custmap";
import type { CustMap } from "../../lib/custmap/custmap";
import { clearNewCodes, newCodeRows, nextNumber, origOfCode, useNewCodes } from "../../lib/custmap/newCodes";

const CODE_RE = /^CUS(\d{7})$/i;

const Chev = () => (
  <svg className="chev" width="18" height="18" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 9l6 6 6-6" /></svg>
);

/** รหัสต้นฉบับ 64 ตัวยาวเกินบรรทัดเดียว ต้องตัดขึ้นบรรทัดใหม่ได้ */
const origStyle: React.CSSProperties = {
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSize: 12.5, lineHeight: 1.7, wordBreak: "break-all", userSelect: "all",
};

interface Hit { code: string; orig: string; partial: boolean; source: string }

export default function CustCode() {
  const [map, setMap] = useState<CustMap | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [newQ, setNewQ] = useState("");
  const [msg, setMsg] = useState<{ text: string; tone: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const newCodes = useNewCodes();

  useEffect(() => {
    let alive = true;
    loadCustMap(CUSTMAP_URL)
      .then((m) => { if (alive) setMap(m); })
      .catch((e) => { if (alive) setErr((e as Error).message); });
    return () => { alive = false; };
  }, []);

  const input = q.trim();
  const codeMatch = CODE_RE.exec(input);
  const owned = Object.keys(newCodes).length;
  const nextCode = map ? custCode(nextNumber(newCodes)) : null;
  const lastCode = map ? custCode(nextNumber(newCodes) - 1) : null;

  /** ผลการค้น — null = ไม่พบ (ข้อความบอกเหตุผลแยกด้านล่าง) */
  const hit = useMemo<Hit | null>(() => {
    if (!map || !input) return null;

    // ทิศทางที่ 1: รหัสย่อ -> ค่าต้นฉบับ
    if (codeMatch) {
      const n = parseInt(codeMatch[1]!, 10);
      if (n >= 1 && n <= map.count) {
        const orig = map.hashFor(input);
        return orig
          ? { code: custCode(n), orig, partial: !map.full, source: "ไฟล์แปลงรหัส" }
          : null;
      }
      const orig = origOfCode(input, newCodes);
      return orig
        ? { code: custCode(n), orig, partial: false, source: "ออกรหัสใหม่ในระบบ" }
        : null;
    }

    // ทิศทางที่ 2: ค่าต้นฉบับ -> รหัสย่อ (เทียบทั้งสตริง ไม่เดาจากตัวขึ้นต้น)
    const own = newCodes[input];
    if (own) {
      return { code: custCode(own), orig: input, partial: false, source: "ออกรหัสใหม่ในระบบ" };
    }
    if (isFullHash(input)) {
      const code = map.codeFor(input);
      return code
        ? { code, orig: input.toLowerCase(), partial: false, source: "ไฟล์แปลงรหัส" }
        : null;
    }
    return null;
  }, [map, input, codeMatch, newCodes]);

  /** เหตุผลที่ไม่พบ — แยก "พิมพ์ผิดรูป" ออกจาก "รูปแบบถูกแต่ไม่มีในระบบ" */
  const missReason = useMemo(() => {
    if (!map || !input || hit) return null;
    if (/^cus/i.test(input) && !codeMatch) {
      return { bad: true, text: `รหัสย่อต้องเป็น CUS ตามด้วยเลข 7 หลักพอดี (เช่น CUS0000001) — พิมพ์ไป ${input.length} ตัวอักษร` };
    }
    if (codeMatch) {
      return { bad: false, text: `ไม่พบรหัสย่อนี้ในระบบ — ตอนนี้มีถึง ${lastCode} เท่านั้น` };
    }
    if (isHashLike(input) && !isFullHash(input)) {
      return { bad: true, text: `รหัสต้นฉบับต้องครบทั้ง 64 ตัว — พิมพ์ไป ${input.length} ตัว · ระบบเทียบแบบเป๊ะ ไม่เดาให้จากตัวขึ้นต้น` };
    }
    return { bad: false, text: "ไม่พบค่านี้ในไฟล์แปลงรหัส และยังไม่เคยออกรหัสใหม่ให้" };
  }, [map, input, hit, codeMatch, lastCode]);

  const rows = useMemo(() => {
    const list = newCodeRows(newCodes);
    const needle = newQ.trim().toLowerCase();
    if (!needle) return list;
    return list.filter((r) =>
      r.orig.toLowerCase().includes(needle) || r.code.toLowerCase().includes(needle));
  }, [newCodes, newQ]);

  const copy = (text: string) => {
    navigator.clipboard?.writeText(text).then(
      () => { setCopied(true); setTimeout(() => setCopied(false), 1600); },
      () => { /* เบราว์เซอร์ไม่ให้สิทธิ์ก็ยังเลือกข้อความเองได้ */ },
    );
  };

  const reset = () => {
    if (!owned) { setMsg({ text: "ยังไม่มีรหัสที่ออกใหม่", tone: "var(--ink-soft)" }); return; }
    if (!confirm("ล้างรหัสที่ระบบออกใหม่ทั้งหมด? (ไม่กระทบรหัสจากไฟล์แปลงรหัส)")) return;
    clearNewCodes();
    setMsg({ text: "ล้างรหัสที่ออกใหม่แล้ว", tone: "var(--orange-dark)" });
  };

  const status = err ? "โหลดตารางไม่สำเร็จ"
    : map ? `พร้อมใช้งาน · ${map.count.toLocaleString("th-TH")} รหัสจากไฟล์`
      + ` + ${owned.toLocaleString("th-TH")} รหัสที่ออกใหม่`
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
          <label>รหัสย่อ CUS + เลข 7 หลัก · รหัสต้นฉบับ 64 ตัว · หรือชื่อลูกค้าที่ระบบออกรหัสให้แล้ว</label>
          <input value={q} onChange={(e) => setQ(e.target.value)} disabled={!map}
            spellCheck={false} autoComplete="off"
            placeholder="เช่น CUS0000001 หรือวางรหัสต้นฉบับทั้ง 64 ตัว" />
        </div>

        <div className="price-note" style={{ marginTop: 0 }}>
          ค้นได้ทั้ง <b>รหัสย่อ → รหัสต้นฉบับ</b> และ <b>รหัสต้นฉบับ → รหัสย่อ</b> ·
          วางรหัสต้นฉบับเต็ม ๆ จากชีตได้เลย · <b>เทียบแบบเป๊ะทุกตัวอักษร</b>
        </div>

        {!map && !err && <p className="muted">กำลังโหลดตาราง ...</p>}

        {map && input && (hit ? (
          <div className="cc-hit" style={{ marginTop: 16 }}>
            <div className="cc-row"><span className="k">รหัสย่อที่ระบบใช้</span>
              <span className="cc-big">{hit.code}</span></div>
            <div className="cc-row" style={{ alignItems: "flex-start" }}>
              <span className="k">{hit.partial ? "รหัสต้นฉบับ (12 ตัวแรก)" : "รหัสต้นฉบับ"}</span>
              <span style={origStyle}>{hit.orig}</span>
            </div>
            <div className="cc-row"><span className="k">ที่มา</span><span className="v">{hit.source}</span></div>
            <div className="cc-row">
              <span className="k" />
              <button className="btn-ghost" type="button" onClick={() => copy(hit.orig)}>
                {copied ? "คัดลอกแล้ว ✓" : "คัดลอกรหัสต้นฉบับ"}
              </button>
            </div>
          </div>
        ) : missReason && (
          <div className="cc-miss" style={{ marginTop: 16 }}>
            {missReason.text}
            {!missReason.bad && !codeMatch && nextCode && (
              <div style={{ fontWeight: 500, marginTop: 6, fontSize: 12.5, color: "var(--ink-soft)" }}>
                ระบบจะออกรหัส {nextCode} ให้อัตโนมัติเมื่อบันทึกใบรายการที่มีลูกค้ารายนี้
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-h">
          <span className="step">+</span><h2>รหัสที่ระบบออกใหม่</h2>
          <span className="hint">
            ลูกค้าที่ไม่มีในไฟล์แปลงรหัส — ระบบรันเลขต่อจาก {map ? custCode(map.count) : "…"}
          </span>
        </div>

        <div className="rec-bar">
          <div className="searchbox">
            <svg viewBox="0 0 24 24" fill="none" strokeWidth="2.2" strokeLinecap="round">
              <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
            </svg>
            <input value={newQ} onChange={(e) => setNewQ(e.target.value)}
              placeholder="ค้นหาในรหัสที่ออกใหม่" />
          </div>
          <button className="btn-ghost" type="button" onClick={reset}>
            ↺ ล้างรหัสที่ออกใหม่ทั้งหมด
          </button>
        </div>

        {rows.length > 0 ? (
          <div className="rec-card">
            <div className="scroll">
              <table className="rec-table">
                <thead><tr>
                  <th>รหัสย่อ</th><th>รหัส/ชื่อต้นฉบับ</th><th>ประเภท</th>
                </tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.n}>
                      <td><span className="cuscode isnew">{r.code}</span></td>
                      <td style={{ wordBreak: "break-all", maxWidth: 520, whiteSpace: "normal" }}>{r.orig}</td>
                      <td>{isHashLike(r.orig)
                        ? <span className="badge b1">รหัสเข้ารหัส</span>
                        : <span className="badge b2">ชื่อ/ข้อความ</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="rec-empty">
            {owned
              ? "ไม่พบรายการที่ค้นหา"
              : "ยังไม่มีรหัสที่ออกใหม่ — จะเกิดขึ้นเมื่อบันทึกลูกค้าที่ไม่มีในไฟล์แปลงรหัส"}
          </div>
        )}

        {msg && <div className="msg" style={{ marginTop: 10, color: msg.tone }}>{msg.text}</div>}
      </div>

      <div className="card">
        <details className="prices">
          <summary>ℹ️ วิธีทำงานของรหัสลูกค้า · กดเพื่อดู<Chev /></summary>
          <div className="gs-steps" style={{ marginTop: 12 }}>
            <b>1) ฐานข้อมูลจากไฟล์</b> — คู่รหัสทั้งหมดมาจาก <code>แปลงรหัสลูกหนี้รวม.xlsx</code>
            (คอลัมน์ “รหัสที่แปลงแล้ว” คู่กับ “รหัสต้นฉบับ”) แปลงเป็น <code>custmap.bin</code>
            ระเบียนละ 32 ไบต์ จึงเก็บรหัสต้นฉบับไว้<b>ครบทุกตัว</b> ค้นย้อนกลับได้เต็ม
            <br /><br />
            <b>2) การแสดงผล</b> — ในทุกตารางและกราฟ ผู้ส่ง/ผู้รับที่เป็นรหัสยาว ๆ จะแสดงเป็น{" "}
            <code>CUSxxxxxxx</code> · เอาเมาส์ชี้ที่รหัสย่อเพื่อดูค่าต้นฉบับ ·
            ชื่อที่อ่านออกได้ (เช่น ชื่อบริษัท) จะแสดงตามเดิม
            <br /><br />
            <b>3) ลูกค้าใหม่</b> — เมื่อบันทึกใบรายการที่มีลูกค้าไม่ตรงกับไฟล์เลย ระบบจะออกรหัสถัดไปให้อัตโนมัติ
            ({map ? <><code>{custCode(map.count + 1)}</code>, <code>{custCode(map.count + 2)}</code>, …</> : "…"})
            และค้นหาได้ในหน้านี้ทันที · รหัสที่ออกใหม่จะเป็น<b>สีเขียว</b>เพื่อให้แยกออกจากรหัสในไฟล์
            <br /><br />
            <b>4) การเทียบเป็นแบบเป๊ะทั้งสองทาง</b> — <code>CUS001</code> ไม่เท่ากับ <code>CUS0000001</code>
            และรหัสต้นฉบับต้องครบ 64 ตัว เพราะรหัสคนละรายที่ขึ้นต้นเหมือนกันมีได้
            ถ้ายอมให้เดาจากตัวขึ้นต้น จะชี้ผิดรายโดยไม่มีอะไรเตือน
            <br /><br />
            <b>5) การเก็บข้อมูล</b> — รหัสที่ออกใหม่เก็บในเครื่อง (localStorage คีย์{" "}
            <code>custNewCodes</code>) แยกจากไฟล์ตาราง · ไฟล์ <code>custmap.bin</code>
            โหลดเฉพาะตอนเข้าหน้านี้กับหน้าบันทึกข้อมูล ไม่ได้ติดไปกับทุกหน้า
          </div>
        </details>
      </div>
    </>
  );
}
