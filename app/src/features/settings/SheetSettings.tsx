/** ตั้งค่าและทดสอบการเชื่อม Google Sheet — ยกจากกล่อง gsConfig ใน v5:958 */
import { useState } from "react";
import { getUrl, isValidUrl, ping, setUrl } from "../../lib/sheet/client";

export default function SheetSettings() {
  const [url, setUrlValue] = useState(getUrl());
  const [msg, setMsg] = useState<{ text: string; tone: "ok" | "err" | "info" } | null>(null);
  const [busy, setBusy] = useState(false);

  const save = () => {
    try {
      setUrl(url);
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
        text: `เชื่อมต่อสำเร็จ (โค้ด v${d.version}) · บันทึกลงชีต "${d.sheet ?? "—"}" แท็บ ค่าเดินทาง / ลูกหนี้`,
        tone: "ok",
      });
    } catch (e) {
      setMsg({ text: (e as Error).message, tone: "err" });
    } finally {
      setBusy(false);
    }
  };

  const connected = !!getUrl();
  const tone = { ok: "var(--green)", err: "var(--red)", info: "var(--ink-soft)" };

  return (
    <details className="card" open={!connected}>
      <summary style={{ cursor: "pointer", fontWeight: 600 }}>
        ตั้งค่าการเชื่อม Google Sheet{" "}
        <span style={{ color: connected ? "var(--green)" : "var(--ink-faint)", fontWeight: 400 }}>
          · {connected ? "เชื่อมแล้ว" : "ยังไม่เชื่อม"}
        </span>
      </summary>

      <label htmlFor="gsUrl" style={{ display: "block", marginTop: 12, fontSize: 13 }}>
        Web app URL (ลงท้าย /exec)
      </label>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
        <input
          id="gsUrl" type="text" value={url}
          onChange={(e) => setUrlValue(e.target.value)}
          placeholder="https://script.google.com/macros/s/....../exec"
          style={{ flex: "1 1 320px", minWidth: 0 }}
        />
        <button type="button" onClick={save} disabled={!isValidUrl(url)}>บันทึกลิงก์</button>
        <button type="button" onClick={test} disabled={busy || !connected}>ทดสอบการเชื่อมต่อ</button>
      </div>

      {msg && <p style={{ color: tone[msg.tone], marginBottom: 0 }}>{msg.text}</p>}

      <p className="muted" style={{ fontSize: 12, marginBottom: 0 }}>
        ลิงก์เก็บไว้ในเครื่องนี้เท่านั้น ไม่ได้ commit ขึ้น repo
      </p>
    </details>
  );
}
