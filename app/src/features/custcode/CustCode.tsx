/** ค้นรหัสลูกค้า — แทน view-custcode ของ v5 */
import { useEffect, useState } from "react";
import { loadCustMap } from "../../lib/custmap/custmap";
import type { CustMap } from "../../lib/custmap/custmap";

const MAP_URL = `${import.meta.env.BASE_URL}custmap.bin`;

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

  return (
    <div className="card">
      <h2>ค้นหารหัสลูกค้า</h2>
      <p className="muted" style={{ marginTop: 0 }}>
        รหัสลูกค้าในไฟล์ข้อมูลถูก anonymize เป็น SHA-256 ยาว 64 ตัว อ่านยาก
        หน้านี้แปลงไปมากับรหัสสั้น <code>CUS0000001</code> ได้ทั้งสองทาง
      </p>

      {err && (
        <div className="banner">
          {err}
          <div style={{ fontWeight: 400, marginTop: 6, fontSize: 13 }}>
            ไฟล์ <code>custmap.bin</code> ไม่ได้ commit ขึ้น repo เพราะมาจากข้อมูลลูกค้าจริง
            สร้างในเครื่องด้วยคำสั่ง:
            <br />
            <code>node tools/extract-custmap.mjs ../โมเดลเดินรถ-gsheet-v5.html public/custmap.bin</code>
          </div>
        </div>
      )}

      {!map && !err && <p className="muted">กำลังโหลดตาราง (3.3 MB) ...</p>}

      {map && (
        <>
          <p className="muted">มีข้อมูล {map.count.toLocaleString("th-TH")} ราย</p>
          <input
            value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="วางรหัส hash หรือพิมพ์ CUS0000001"
            style={{ width: "100%", marginBottom: 12 }}
          />

          {input && (
            <table>
              <tbody>
                {asHash && (
                  <tr><td>รหัสสั้น</td><td className="n"><b>{asHash}</b></td></tr>
                )}
                {asCode && (
                  <tr>
                    <td>hash (12 ตัวแรก)</td>
                    <td className="n"><b>{asCode}…</b></td>
                  </tr>
                )}
                {!asHash && !asCode && (
                  <tr>
                    <td colSpan={2} className="muted">
                      ไม่พบ — ตรวจว่าพิมพ์ครบหรือยัง (hash ต้องอย่างน้อย 12 ตัว
                      รหัสสั้นต้องขึ้นต้นด้วย CUS)
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}

          <p className="muted" style={{ fontSize: 12, marginBottom: 0 }}>
            ตารางเก็บแค่ 12 ตัวแรกของ hash (ยาวพอที่ยืนยันแล้วว่าไม่ชนกัน)
            การค้นย้อนกลับจึงได้เฉพาะตัวขึ้นต้น ไม่ได้ hash เต็ม
          </p>
        </>
      )}
    </div>
  );
}
