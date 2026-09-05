/** ตั้งค่าและทดสอบการเชื่อม Google Sheet — กล่อง gs-config ตรงตาม v5:961-985 */
import { useState } from "react";
import { GS_VERSION, getUrl, isValidUrl, ping, setUrl } from "../../lib/sheet/client";

export default function SheetSettings() {
  const [url, setUrlValue] = useState(getUrl());
  const [msg, setMsg] = useState<{ text: string; tone: "ok" | "err" | "info" } | null>(null);
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(!!getUrl());

  const save = () => {
    try {
      setUrl(url);
      setConnected(!!url.trim());
      setMsg({ text: "บันทึกลิงก์แล้ว ลองกดทดสอบการเชื่อมต่อ", tone: "ok" });
    } catch (e) {
      setMsg({ text: (e as Error).message, tone: "err" });
    }
  };

  const test = async () => {
    setBusy(true);
    setMsg({ text: "กำลังทดสอบ...", tone: "info" });
    try {
      const d = await ping();
      setMsg({
        text: `เชื่อมต่อสำเร็จ (โค้ด v${d.version}) · บันทึกลงชีต “${d.sheet ?? "—"}”`,
        tone: "ok",
      });
    } catch (e) {
      setMsg({ text: (e as Error).message, tone: "err" });
    } finally { setBusy(false); }
  };

  const tone = { ok: "var(--green)", err: "var(--red)", info: "var(--ink-soft)" };

  return (
    <details className="gs-config" open={!connected}>
      <summary>
        ⚙ ตั้งค่าการเชื่อม Google Sheet
        <span className={"badge-conn " + (connected ? "on" : "off")}>
          {connected ? "เชื่อมแล้ว" : "ยังไม่เชื่อม"}
        </span>
        <svg className="chev" width="18" height="18" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 9l6 6 6-6" /></svg>
      </summary>

      <div className="gs-inner">
        <label htmlFor="gsUrl">Web app URL (ลงท้าย /exec)</label>
        <div className="gs-row">
          <input id="gsUrl" type="text" value={url}
            onChange={(e) => setUrlValue(e.target.value)}
            placeholder="https://script.google.com/macros/s/....../exec" />
          <button className="btn-add" type="button" onClick={save} disabled={!isValidUrl(url)}>บันทึกลิงก์</button>
          <button className="btn-ghost" type="button" onClick={test} disabled={busy || !connected}>ทดสอบการเชื่อมต่อ</button>
        </div>

        {msg && <div className="gs-status" style={{ color: tone[msg.tone] }}>{msg.text}</div>}

        <div className="gs-steps">
          <b>วิธีตั้งค่า (ทำครั้งเดียว):</b><br />
          1. เปิด Google Sheet → เมนู <b>ส่วนขยาย (Extensions)</b> → <b>Apps Script</b><br />
          2. ลบโค้ดเดิม วางโค้ดจากไฟล์ <code>apps-script/Code.gs</code> แล้วกดบันทึก<br />
          3. กด <b>Deploy → New deployment</b> → เลือก <b>Web app</b> · Execute as: <b>Me</b> ·
          Who has access: <b>Anyone</b> → <b>Deploy</b> แล้วอนุญาตสิทธิ์<br />
          4. คัดลอก <b>Web app URL</b> (ลงท้าย <code>/exec</code>) มาวางช่องด้านบน → บันทึกลิงก์ → ทดสอบ
          <br /><br />
          <b style={{ color: "var(--red)" }}>เคย Deploy ไว้แล้วแต่ข้อมูลไม่ขึ้นชีต?</b> = โค้ดในชีตเป็นเวอร์ชันเก่า<br />
          วางโค้ดใหม่ทับ → บันทึก → <b>Deploy → Manage deployments</b> → กดดินสอ <b>✏</b> ที่ deployment เดิม →
          ช่อง <b>Version</b> เลือก <b>New version</b> → <b>Deploy</b> · URL เดิมใช้ต่อได้ไม่ต้องเปลี่ยน<br />
          (กด “ทดสอบการเชื่อมต่อ” แล้วต้องขึ้น <code>โค้ด v{GS_VERSION}</code> จึงจะบันทึกได้)<br />
          <br />ระบบจะสร้าง 2 ชีต: <code>บันทึกเดินรถ</code> (1 แถว = 1 ใบรายการ) และ
          <code>รายการลูกหนี้</code> (1 แถว = ลูกหนี้ 1 ราย)
          <br /><br />ลิงก์เก็บไว้ในเครื่องนี้เท่านั้น ไม่ได้ commit ขึ้น repo
        </div>
      </div>
    </details>
  );
}
