/**
 * แสดงรหัสลูกค้าแบบสั้น — เทียบเท่า shortId() ใน v5:2549
 *
 * ต่างจาก v5 ตรงที่ตารางรหัส (18 MB) โหลดเฉพาะตอนเข้าหน้า “ค้นหารหัสลูกค้า”
 * ถ้ายังไม่ได้โหลด จะย่อ hash ให้อ่านง่ายแทน โดยเก็บค่าเต็มไว้ใน title
 *
 * ★ prop `n` = เลขในรหัส CUS ที่ ETL แปลงมาให้แล้ว (custcodes.py) — ถ้ามีให้ใช้อันนี้เลย
 *   ไม่ต้องพึ่งตารางในเครื่อง ผลจึงเหมือนกันทุกครั้งไม่ว่าเปิดหน้าไหนมาก่อน
 *   ของเดิมพึ่ง peekCustMap() ซึ่งเป็นแคชระดับโมดูล — แวะหน้าค้นรหัสก่อนแล้วรหัสขึ้น
 *   ไม่แวะแล้วไม่ขึ้น กด F5 แล้วหายอีก อธิบายกับคนใช้ไม่ได้
 */
import { custCode, isHashLike } from "./custmap";
import { isOwnCode, lookupCustomer } from "./newCodes";

export function ShortId({ v, n }: { v: string | null | undefined; n?: number }) {
  const s = String(v ?? "").trim();
  if (!s) return <>–</>;

  // เลขจาก ETL มาก่อนเสมอ — ไม่ต้องรอตารางในเครื่อง
  if (n && n > 0) {
    return <span className="cuscode" title={`รหัสต้นฉบับ: ${s}`}>{custCode(n)}</span>;
  }
  const code = lookupCustomer(s);
  if (code) {
    // รหัสที่ระบบออกเองใช้สีเขียว (.isnew) เพื่อให้แยกออกจากรหัสที่มาจากไฟล์แปลงรหัส
    const own = isOwnCode(s);
    return (
      <span className={"cuscode" + (own ? " isnew" : "")}
        title={`${own ? "รหัสที่ระบบออกใหม่" : "รหัสต้นฉบับ"}: ${s}`}>{code}</span>
    );
  }
  if (isHashLike(s)) {
    return <span title={s} style={{ fontFamily: "ui-monospace, monospace", fontSize: 11 }}>{s.slice(0, 10)}…</span>;
  }
  return <>{s}</>;
}

/** ป้ายชื่อลูกค้าสำหรับกราฟและตัวเลือก — ข้อความล้วน ไม่ใช่ element */
export function shortIdText(v: string | null | undefined, n?: number): string {
  const s = String(v ?? "").trim();
  if (!s) return "–";
  if (n && n > 0) return custCode(n);
  const code = lookupCustomer(s);
  if (code) return code;
  return isHashLike(s) ? s.slice(0, 10) + "…" : s;
}

/**
 * ป้ายชื่อลูกค้าสำหรับแกนกราฟ — custLabel() ของ main:2916
 * ต่างจาก shortIdText ตรงที่ตัดชื่อยาวเกิน 22 ตัวทิ้ง ไม่งั้นแกนกินพื้นที่กราฟหมด
 */
export function custLabel(v: string | null | undefined, n?: number): string {
  const s = String(v ?? "").trim();
  if (!s) return "(ไม่ระบุ)";
  if (n && n > 0) return custCode(n);
  const code = lookupCustomer(s);
  if (code) return code;
  if (isHashLike(s)) return s.slice(0, 10) + "…";
  return s.length > 22 ? s.slice(0, 20) + "…" : s;
}
