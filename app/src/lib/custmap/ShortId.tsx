/**
 * แสดงรหัสลูกค้าแบบสั้น — เทียบเท่า shortId() ใน v5:2549
 *
 * ต่างจาก v5 ตรงที่ตารางรหัส (3.5 MB) โหลดเฉพาะตอนเข้าหน้า “ค้นหารหัสลูกค้า”
 * ถ้ายังไม่ได้โหลด จะย่อ hash ให้อ่านง่ายแทน โดยเก็บค่าเต็มไว้ใน title
 */
import { isHashLike, peekCustMap } from "./custmap";

export function ShortId({ v }: { v: string | null | undefined }) {
  const s = String(v ?? "").trim();
  if (!s) return <>–</>;

  const code = peekCustMap()?.codeFor(s) ?? null;
  if (code) {
    return <span className="cuscode" title={`รหัสต้นฉบับ: ${s}`}>{code}</span>;
  }
  if (isHashLike(s)) {
    return <span title={s} style={{ fontFamily: "ui-monospace, monospace", fontSize: 11 }}>{s.slice(0, 10)}…</span>;
  }
  return <>{s}</>;
}

/** ป้ายชื่อลูกค้าสำหรับกราฟและตัวเลือก — ข้อความล้วน ไม่ใช่ element */
export function shortIdText(v: string | null | undefined): string {
  const s = String(v ?? "").trim();
  if (!s) return "–";
  const code = peekCustMap()?.codeFor(s);
  if (code) return code;
  return isHashLike(s) ? s.slice(0, 10) + "…" : s;
}
