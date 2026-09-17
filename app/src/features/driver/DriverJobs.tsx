/**
 * หน้าของคนขับ — ดูงานที่กำลังวิ่งของรถตัวเอง แล้วกดจบงานเมื่อส่งของเสร็จ
 *
 * ★ ในใบรายการไม่มีช่อง "ชื่อคนขับ" เลย (ช่อง drv คือเบี้ยเลี้ยง ไม่ใช่ชื่อคน)
 *   จึงให้คนขับค้นหา/เลือกทะเบียนรถของตัวเองทุกครั้งที่เข้าหน้านี้แทนการล็อกอิน
 *   (ไม่จำไว้ในเครื่อง — เผื่อมีคนอื่นใช้เครื่องเดียวกันขับคนละคัน)
 *   และมีตารางรถทั้งกองไว้ดูเผื่อวันไหนขับคันอื่น
 *
 * ใช้เฉพาะ state.records (ข้อมูลใหม่) — ใบข้อมูลเก่าจากชีตแก้ไม่ได้อยู่แล้ว
 */
import { useEffect, useMemo, useState } from "react";
import { finishTrip } from "../../lib/store/finishTrip";
import { tripProgress } from "../../lib/record/tripEta";
import { daysBetween, savedAt, thDateSafe, todayISO } from "../../lib/record/date";
import { lastEditedAt } from "../../lib/record/roles";
import { useRoster } from "../../lib/store/roster";
import type { RecordsState } from "../../lib/store/useRecords";
import type { RoleKey, TripRecord } from "../../types/record";

const routeLabel = (r: { origin?: string; dest?: string }) => (r.origin || "?") + " → " + (r.dest || "?");

/** ตัดจุด/ขีด/ช่องว่างออกก่อนเทียบ — คนขับพิมพ์แค่ตัวเลขท้ายทะเบียน ("1815") ก็ต้องเจอ */
const normPlate = (s: string) => s.replace(/[\s.\-–—]/g, "").toLowerCase();

/**
 * รหัสผ่านก่อนกดจบงาน — ★ ตั้งไว้ตัวเดียวกันทุกใบชั่วคราว
 * ของจริงต้องผูกกับตัวคนขับ (เช่น รหัสรายคันจากฝ่ายจัดรถ) แล้วย้ายไปตรวจฝั่งเซิร์ฟเวอร์
 * เพราะค่าที่ฝังในหน้าเว็บใครเปิดดูก็เห็น
 */
const FINISH_PIN = "1";

/** จำนวนรายการที่โชว์ตอนค้นหา — มากกว่านี้ต้องพิมพ์ให้แคบลง ไม่งั้นรายการยาวเกินจอมือถือ */
const MAX_HITS = 8;

export default function DriverJobs({ state, role }: { state: RecordsState; role: RoleKey }) {
  const [plate, setPlate] = useState("");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  /** ใบที่กำลังจะกดจบงาน — เปิดโมดัลใส่รหัสผ่านกลางจอ */
  const [asking, setAsking] = useState<TripRecord | null>(null);
  const [pin, setPin] = useState("");
  const [pinErr, setPinErr] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [roster] = useRoster();
  const today = todayISO();

  const pickPlate = (v: string) => {
    setPlate(v);
    setQ(v);
  };

  /**
   * รายชื่อทะเบียนที่ค้นหาได้ — ฐานกองรถ (roster) บวกทะเบียนที่มีใบรายการจริงแต่ไม่อยู่ในฐาน
   * เพราะ roster ตัดทะเบียนตัวอย่างเก่าของ v5 ทิ้งโดยตั้งใจ (ดูคอมเมนต์ lib/store/roster.ts)
   * แต่ข้อมูลตัวอย่าง/ข้อมูลจริงบางทีก็มีใบรายการอ้างทะเบียนที่ไม่อยู่ใน 274 คันของไฟล์กองรถ
   * ถ้าค้นแค่ใน roster จะหาทะเบียนที่เห็นอยู่ในตาราง "รถที่กำลังเดินทางทั้งกอง" ไม่เจอ
   */
  const searchable = useMemo(() => {
    const known = new Set(roster.map((v) => v.plate));
    const extra: { plate: string; vehicle: string }[] = [];
    const seen = new Set<string>();
    for (const r of state.records) {
      if (!r.plate || known.has(r.plate) || seen.has(r.plate)) continue;
      seen.add(r.plate);
      extra.push({ plate: r.plate, vehicle: r.vehicle || "" });
    }
    return [...roster, ...extra];
  }, [roster, state.records]);

  /** ผลค้นหาทะเบียน — เทียบทั้งทะเบียนและชนิดรถ */
  const hits = useMemo(() => {
    const key = normPlate(q);
    if (!key) return [];
    return searchable
      .filter((v) => normPlate(v.plate).includes(key) || normPlate(v.vehicle || "").includes(key))
      .slice(0, MAX_HITS + 1);
  }, [q, searchable]);

  /**
   * เลือกทะเบียนให้อัตโนมัติเมื่อพิมพ์ตรงเป๊ะกับคันในกอง — ไม่งั้นถ้าพิมพ์เต็มแล้วไม่กดเลือกจากรายการ
   * ทะเบียนที่ผูกกับ "งานที่กำลังวิ่ง" (ส่วนที่ 2) จะยังเป็นคันเดิมค้างอยู่ ทั้งที่ในช่องพิมพ์เปลี่ยนไปแล้ว
   */
  useEffect(() => {
    const key = normPlate(q);
    if (!key) return;
    const exact = searchable.find((v) => normPlate(v.plate) === key);
    if (exact && exact.plate !== plate) setPlate(exact.plate);
  }, [q, searchable, plate]);

  const mineVehicle = plate ? searchable.find((v) => v.plate === plate)?.vehicle ?? "" : "";

  /** เที่ยวที่ยังวิ่งอยู่ทั้งกอง เรียงคันที่ออกก่อนไว้บน */
  const moving = useMemo(() => state.records
    .map((r) => ({ r, p: tripProgress(r, today) }))
    .filter((x) => x.p.moving)
    .sort((a, b) => a.p.start.localeCompare(b.p.start)), [state.records, today]);

  const mine = plate ? moving.filter((x) => x.r.plate === plate) : [];

  /** เปิดกล่องยืนยันรหัสผ่านกลางจอสำหรับใบนั้น */
  function askFinish(r: TripRecord) {
    setAsking(r);
    setPin("");
    setPinErr(false);
  }

  async function onFinish(r: TripRecord) {
    if (pin.trim() !== FINISH_PIN) { setPinErr(true); return; }
    setAsking(null);
    setPin("");
    setBusy(r.id);
    setMsg(null);
    try {
      const res = await finishTrip(r, role);
      state.reload();
      setMsg(res.pushed ? "บันทึกจบงานแล้ว" : "บันทึกในเครื่องแล้ว · รอเชื่อมเน็ตเพื่อซิงก์");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <div className="card">
        <div className="card-h">
          <span className="step">1</span>
          <h2>ทะเบียนรถของฉัน</h2>
        </div>
        <div className="field">
          <label>ทะเบียนรถที่ขับอยู่ <span className="hint">· ค้นหาทุกครั้งที่เข้าหน้านี้</span></label>
          <input type="search" value={q}
            placeholder={`ค้นหาทะเบียน — พิมพ์เลขท้ายก็ได้ (มี ${searchable.length} คัน)`}
            onChange={(e) => setQ(e.target.value)} />
          {/* ซ่อนรายการเมื่อข้อความตรงกับคันที่เลือกไว้แล้ว — เพิ่งกดเลือกไม่ต้องโชว์ซ้ำ */}
          {q.trim() !== "" && q !== plate && (
            hits.length === 0
              ? <p className="muted" style={{ marginTop: 8 }}>ไม่พบทะเบียนที่ตรงกับ “{q}”</p>
              : <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
                  {hits.slice(0, MAX_HITS).map((v) => (
                    <button key={v.plate} type="button" className="cc-hit"
                      style={{ textAlign: "left", cursor: "pointer", width: "100%" }}
                      onClick={() => pickPlate(v.plate)}>
                      <span style={{ fontWeight: 700 }}>{v.plate}</span>
                      {v.vehicle && <span className="muted"> · {v.vehicle}</span>}
                    </button>
                  ))}
                  {hits.length > MAX_HITS &&
                    <p className="muted">มีมากกว่า {MAX_HITS} คัน — พิมพ์เพิ่มเพื่อให้แคบลง</p>}
                </div>
          )}
          {plate && <p className="muted" style={{ marginTop: 8 }}>
            กำลังใช้ {plate}{mineVehicle ? ` · ${mineVehicle}` : ""}</p>}
        </div>
      </div>

      {msg && <div className="edit-banner" style={{ display: "flex" }}>{msg}
        <button type="button" className="x" onClick={() => setMsg(null)}>ปิด</button></div>}

      <div className="card">
        <div className="card-h">
          <span className="step">2</span>
          <h2>งานที่กำลังวิ่ง</h2>
          <span className="hint">เฉพาะรถของฉัน · กดจบงานเมื่อส่งของเสร็จ</span>
        </div>

        {!plate ? (
          <p className="muted">เลือกทะเบียนรถด้านบนก่อน แล้วงานของรถคันนั้นจะขึ้นตรงนี้</p>
        ) : mine.length === 0 ? (
          <p className="muted">ตอนนี้ไม่มีงานที่กำลังวิ่งของ {plate}</p>
        ) : mine.map(({ r, p }) => {
          const left = p.eta ? daysBetween(today, p.eta) : null;
          return (
            <div key={r.id} className="cc-hit" style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>{routeLabel(r)}</div>
              <div className="cc-row">เลขที่ใบรายการ · {r.docNo || "–"}</div>
              <div className="cc-row">วันปล่อยรถ · {thDateSafe(p.start)}</div>
              <div className="cc-row">ระยะทาง · {p.dist == null ? "ไม่ทราบ" : `${p.dist.toLocaleString("th-TH")} กม.`}</div>
              <div className="cc-row">
                ประมาณการถึงปลายทาง · {p.eta ? thDateSafe(p.eta) : "ไม่ทราบ"}
                {left != null && (left > 0 ? ` (อีก ${left} วัน)` : left === 0 ? " (วันนี้)" : " (เลยกำหนดแล้ว)")}
              </div>
              <button type="button" className="btn-green" style={{ marginTop: 12, width: "100%" }}
                disabled={busy === r.id} onClick={() => askFinish(r)}>
                {busy === r.id ? "กำลังบันทึก..." : "จบงาน"}
              </button>
            </div>
          );
        })}
      </div>

      <div className="card">
        <div className="card-h">
          <h2>รถที่กำลังเดินทางทั้งกอง</h2>
          <span className="hint">{moving.length} คัน</span>
        </div>
        <div className="scroll">
          <table className="dz-tbl">
            <thead><tr>
              <th>ทะเบียนรถ</th><th>เลขที่ใบรายการ</th><th>เส้นทาง</th><th>วันปล่อยรถ</th><th>ประมาณการเสร็จ</th><th>เวลาล่าสุด</th><th />
            </tr></thead>
            <tbody>
              {moving.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: "center", color: "var(--ink-faint)", padding: 16 }}>
                  ตอนนี้ไม่มีรถคันไหนกำลังวิ่ง
                </td></tr>
              ) : moving.map(({ r, p }) => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 700 }}>{r.plate || "–"}</td>
                  <td>{r.docNo || "–"}</td>
                  <td>{routeLabel(r)}</td>
                  <td>{thDateSafe(p.start)}</td>
                  <td>{p.eta ? thDateSafe(p.eta) : "ไม่ทราบ"}</td>
                  <td>{(() => { const t = lastEditedAt(r); return t ? savedAt(t) : "–"; })()}</td>
                  <td>
                    <button type="button" className="btn-mini" disabled={busy === r.id}
                      onClick={() => askFinish(r)}>
                      {busy === r.id ? "..." : "จบงาน"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {asking && (
        <div className="modal-bg" onClick={(e) => { if (e.target === e.currentTarget) setAsking(null); }}>
          <div className="modal">
            <div className="modal-h">ยืนยันจบงาน</div>
            <div className="modal-info">
              {asking.plate || "–"} · {routeLabel(asking)}
            </div>
            <form onSubmit={(e) => { e.preventDefault(); onFinish(asking); }}>
              <div className="field" style={{ marginTop: 12 }}>
                <label>รหัสผ่านคนขับ</label>
                <input type="password" inputMode="numeric" autoFocus value={pin} placeholder="รหัสผ่าน"
                  onChange={(e) => { setPin(e.target.value); setPinErr(false); }} />
              </div>
              {pinErr && <div className="msg" style={{ color: "var(--red)" }}>รหัสผ่านไม่ถูกต้อง</div>}
              <div className="modal-actions">
                <button type="button" className="btn-ghost" onClick={() => setAsking(null)}>ยกเลิก</button>
                <button type="submit" className="btn-green" disabled={!pin.trim()}>ยืนยันจบงาน</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
