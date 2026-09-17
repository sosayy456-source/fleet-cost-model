/**
 * สามแท็บย่อยของ "Dashboard ลูกหนี้" — ส่วนที่สองของไฟล์ PDF
 *   ยอดคงค้าง & Aging   การ์ด 4 ใบ + กราฟช่วงอายุหนี้ + ตาราง Aging
 *   รายลูกหนี้ / สาขา    ลูกหนี้ที่ค้างสูงสุด + สรุปตามสาขา
 *   จากข้อมูลบิล (เดิม)   บิลค้างชำระที่มาจากไฟล์รายได้ (costrev/old_debtors.json)
 *
 * ★ สองแท็บแรกอ่าน debtors/debtors.json (etl/build_debtors.py) ซึ่งเป็นไฟล์ใบวางบิล
 *   ที่ **ไม่เชื่อมกับข้อมูลเก่า** — เลขที่ใบวางบิลคนละเลขกับเลขที่ใบรายการ และรหัสลูกหนี้
 *   ยาว 40 ตัวไม่ใช่ 64 ตัว จึงห้ามเอาไป join กับบิลฝั่ง costrev/ เด็ดขาด
 *   แท็บที่สามจึงแยกออกมาต่างหาก ไม่รวมยอดกับสองแท็บแรก
 *
 * ไฟล์นี้มีวันครบกำหนดรายบิลอยู่แล้ว (วางบิล + ระยะเวลาเครดิตของใบนั้น) จึงไม่ต้องให้ผู้ใช้
 * เลือกเครดิตเทอมเองเหมือนรุ่นก่อนหน้า และคิด "ปิดบัญชีเฉลี่ย / ปิดช้ากว่ากำหนด" ได้จริง
 */
import { useMemo, useState } from "react";
import { DBar } from "../../../lib/chart/dcharts";
import { D } from "../../../lib/chart/theme";
import { ShortId } from "../../../lib/custmap/ShortId";
import { thSlash } from "../../../lib/record/date";
import { KC, Note, Pane, searchStyle } from "../../dash-fleet/parts";
import { EmptyRow, fmt, pct, Tbl } from "./common";
import type { DebtorData } from "../../../lib/data/useDebtors";
import type { RecordsState } from "../../../lib/store/useRecords";

/** ช่วงอายุหนี้ — 4 ช่วงแรกตรงกับ PDF ช่วงสุดท้ายเพิ่มเพื่อไม่ให้บิลที่ค้างนานหายจากกราฟ */
const BUCKETS: { label: string; hit: (over: number) => boolean; color: string }[] = [
  { label: "ยังไม่ครบกำหนด", hit: (o) => o <= 0, color: D.amber },
  { label: "เกินกำหนด 1–7 วัน", hit: (o) => o >= 1 && o <= 7, color: D.indigo },
  { label: "เกินกำหนด 8–15 วัน", hit: (o) => o >= 8 && o <= 15, color: D.rose },
  { label: "เกินกำหนด 16–30 วัน", hit: (o) => o >= 16 && o <= 30, color: D.teal },
  { label: "เกินกำหนด 30 วันขึ้นไป", hit: (o) => o > 30, color: D.orange },
];

export const statusOf = (over: number): string =>
  over <= 0 ? "ยังไม่ครบกำหนด" : over <= 7 ? "เกินกำหนด 1–7 วัน"
    : over <= 15 ? "เกินกำหนด 8–15 วัน" : over <= 30 ? "เกินกำหนด 16–30 วัน"
      : "เกินกำหนด 30 วันขึ้นไป";

/* ================= แท็บ 1 · ยอดคงค้าง & Aging ================= */

export function AgingTab({ data }: { data: DebtorData }) {
  const m = data.manifest;
  const open = useMemo(() => data.rows.filter((r) => r.close === null), [data.rows]);

  const buckets = useMemo(() => BUCKETS.map((b) => {
    const hit = open.filter((r) => b.hit(r.over ?? 0));
    return { label: b.label, color: b.color, n: hit.length, v: Math.round(hit.reduce((s, r) => s + r.amount, 0)) };
  }), [open]);

  return (
    <Pane deps={[data]}>
      <div className="dz-cards">
        <KC dot={D.rose} tone={m.outstanding.amount > 0 ? "bad" : undefined} l="ยอดคงค้างทั้งหมด"
          v={`฿${fmt(m.outstanding.amount)}`} s={`${fmt(m.outstanding.bills)} รายการ`} />
        <KC dot={D.indigo} l="ระยะเวลาปิดบัญชีเฉลี่ย"
          v={m.avgClearDays == null ? "–" : `${m.avgClearDays.toFixed(1)} วัน`}
          s={`จาก ${fmt(m.closedBills)} ใบที่ปิดแล้ว`} />
        <KC dot={D.amber} tone={(m.latePct ?? 0) > 0 ? "warn" : undefined} l="สัดส่วนปิดช้ากว่ากำหนด"
          v={pct(m.latePct)} s="ปิดช้ากว่าเครดิตของใบนั้น" />
        <KC dot={D.teal} l="ข้อมูล ณ วันที่" v={thSlash(m.asOf)} s="วันล่าสุดที่มีในไฟล์" />
      </div>

      <div className="dz-row dz-2" style={{ marginTop: 14 }}>
        <div className="dz-cc">
          <h4>ยอดคงค้างแยกตามช่วงอายุหนี้ (Aging)</h4>
          <div className="dz-box">
            {open.length === 0 ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center",
                            height: "100%", color: "var(--ink-faint)", textAlign: "center", padding: 20 }}>
                ทุกใบวางบิลในชุดข้อมูลนี้ปิดบัญชีแล้ว จึงไม่มียอดคงค้างให้แยกช่วงอายุ
              </div>
            ) : (
              <DBar data={buckets.map((b) => ({ label: b.label, v: b.v }))} xKey="label"
                colors={buckets.map((b) => b.color)}
                series={[{ key: "v", label: "ยอดคงค้าง", color: D.indigo }]} />
            )}
          </div>
          <Note>
            ครบกำหนด = วันที่วางบิล + ระยะเวลาเครดิตของใบนั้น (ชุดนี้มี{" "}
            {m.terms.map((t) => `${t}`).join(" / ")} วัน) · อายุหนี้นับถึง {thSlash(m.asOf)}
            ซึ่งเป็นวันที่ล่าสุดในไฟล์ ไม่ใช่วันนี้ — ช่วงอายุหนี้จึงไม่ไหลไปกองที่ช่องท้ายตามเวลาที่ผ่านไป
          </Note>
        </div>

        <div className="dz-cc">
          <h4>ตาราง Aging</h4>
          <Tbl head={["ช่วงอายุหนี้", ["จำนวนรายการ", "n"], ["ยอดคงค้าง", "n"]]}>
            {open.length === 0
              ? <EmptyRow cols={3} text="ไม่มีใบวางบิลที่ยังค้างชำระ" />
              : buckets.map((b) => (
                <tr key={b.label}>
                  <td>{b.label}</td>
                  <td className="n">{fmt(b.n)}</td>
                  <td className="n">{fmt(b.v)} บาท</td>
                </tr>
              ))}
          </Tbl>
          <Note>
            ใบที่ยังค้างชำระ = แถวที่ช่อง "วันที่จบ" ในไฟล์ต้นทางเว้นว่างไว้ ·
            ช่วง "30 วันขึ้นไป" ไม่มีในต้นแบบ เพิ่มไว้เพราะถ้าไม่มี บิลที่ค้างนานกว่านั้นจะหายไปเงียบ ๆ
          </Note>
        </div>
      </div>

    </Pane>
  );
}

/* ================= แท็บ 2 · รายลูกหนี้ / สาขา ================= */

export function ByDebtorTab({ data }: { data: DebtorData }) {
  const [q, setQ] = useState("");
  const rows = data.rows;

  /** ยอดค้างรายลูกหนี้ — เฉพาะใบที่ยังไม่ปิด ตรงตามหัวตารางในต้นแบบ */
  const byCust = useMemo(() => {
    const acc = new Map<string, { total: number; n: number; maxOver: number }>();
    for (const r of rows) {
      if (r.close !== null) continue;
      const k = r.cust || "(ไม่ระบุ)";
      const cur = acc.get(k) ?? { total: 0, n: 0, maxOver: -Infinity };
      cur.total += r.amount;
      cur.n += 1;
      cur.maxOver = Math.max(cur.maxOver, r.over ?? 0);
      acc.set(k, cur);
    }
    return [...acc.entries()]
      .map(([cust, v]) => ({ cust, ...v }))
      .sort((a, b) => b.total - a.total);
  }, [rows]);

  const needle = q.trim().toLowerCase();
  const listed = needle ? byCust.filter((c) => c.cust.toLowerCase().includes(needle)) : byCust;

  /** สรุปตามสาขา — ทุกคอลัมน์คิดได้จริงเพราะไฟล์มีวันที่จบกับเครดิตรายบิลครบ */
  const byBranch = useMemo(() => {
    const acc = new Map<string, { out: number; all: number; days: number[]; late: number; n: number }>();
    for (const r of rows) {
      const k = r.br || "(ไม่ระบุ)";
      const cur = acc.get(k) ?? { out: 0, all: 0, days: [], late: 0, n: 0 };
      cur.all += r.amount;
      cur.n += 1;
      if (r.close === null) cur.out += r.amount;
      else if (r.days != null) {
        cur.days.push(r.days);
        if (r.days > r.term) cur.late += 1;
      }
      acc.set(k, cur);
    }
    return [...acc.entries()].map(([br, v]) => ({
      br, out: v.out, all: v.all, n: v.n,
      avg: v.days.length ? v.days.reduce((a, b) => a + b, 0) / v.days.length : null,
      latePct: v.days.length ? v.late / v.days.length * 100 : null,
    })).sort((a, b) => b.out - a.out || b.all - a.all);
  }, [rows]);

  return (
    <Pane deps={[data]}>
      <div className="dz-cc">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                      gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
          <h4 style={{ margin: 0 }}>ลูกหนี้ที่มียอดค้างชำระสูงสุด ({fmt(listed.length)} ราย)</h4>
          <input style={searchStyle} value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="ค้นหารหัสลูกหนี้" />
        </div>
        <Tbl head={["รหัสลูกหนี้", ["ยอดค้างชำระ", "n"], ["จำนวนรายการ", "n"], "สถานะ", ["เกินกำหนด (วัน)", "n"]]}>
          {listed.length === 0 ? (
            <EmptyRow cols={5} text={byCust.length === 0
              ? `ทุกใบวางบิลใน ${fmt(rows.length)} ใบปิดบัญชีแล้ว จึงไม่มีลูกหนี้ค้างชำระ`
              : "ไม่พบรหัสลูกหนี้ตามคำค้น"} />
          ) : listed.slice(0, 200).map((c) => (
            <tr key={c.cust}>
              <td><ShortId v={c.cust} /></td>
              <td className="n">{fmt(c.total)} บาท</td>
              <td className="n">{fmt(c.n)}</td>
              <td>{statusOf(c.maxOver)}</td>
              <td className="n" style={c.maxOver > 30 ? { color: "var(--red)", fontWeight: 700 } : undefined}>
                {c.maxOver > 0 ? fmt(c.maxOver) : "–"}
              </td>
            </tr>
          ))}
        </Tbl>
        <Note>สถานะอ่านจากใบที่เกินกำหนดมากที่สุดของลูกหนี้รายนั้น</Note>
      </div>

      <div className="dz-cc" style={{ marginTop: 14 }}>
        <h4>สรุปตามสาขา</h4>
        <Tbl head={["สาขา", ["ยอดคงค้าง", "n"], ["ปิดบัญชีเฉลี่ย (วัน)", "n"],
                    ["สัดส่วนจ่ายช้า", "n"], ["จำนวนใบ", "n"], ["ยอดรวมทั้งหมด", "n"]]}>
          {byBranch.length === 0 ? <EmptyRow cols={6} text="ไม่มีข้อมูล" /> : byBranch.map((b) => (
            <tr key={b.br}>
              <td>{b.br}</td>
              <td className="n">{fmt(b.out)} บาท</td>
              <td className="n">{b.avg == null ? "–" : b.avg.toFixed(4)}</td>
              <td className="n">{pct(b.latePct, 4)}</td>
              <td className="n">{fmt(b.n)}</td>
              <td className="n">{fmt(b.all)} บาท</td>
            </tr>
          ))}
        </Tbl>
        <Note>สาขาอ่านตรงจากคอลัมน์ "สาขา" ในไฟล์ ไม่ได้ย้อนหาจากใบรายการเหมือนข้อมูลชุดเก่า</Note>
      </div>
    </Pane>
  );
}

/* ================= แท็บ 3 · จากข้อมูลบิล (เดิม) ================= */

/**
 * ชุดเดิมจากไฟล์รายได้ (costrev/old_debtors.json) — แหล่งเดียวกับหน้า "รายการลูกหนี้"
 * ไฟล์นั้นเก็บเฉพาะบิลที่ยังค้างชำระตามที่เจ้าของข้อมูลเลือกไว้ จึงไม่มีวันที่ชำระให้คิด
 * ระยะเวลาปิดบัญชี — แท็บนี้จึงมีแค่ยอดค้างกับอายุหนี้นับจากวันที่บิล
 */
export function FromBillsTab({ state }: { state: RecordsState }) {
  const [q, setQ] = useState("");
  const bills = state.fileOld.debtors;

  const rows = useMemo(() => bills
    .filter((d) => !(d.paid === true || d.status === "ชำระแล้ว"))
    .map((d, i) => ({
      key: `old-${i}`,
      docNo: String(d.docNo ?? ""),
      no: String(d.no ?? ""),
      date: String(d.date ?? ""),
      cust: String(d.receiver ?? ""),
      custN: Number(d.receiverN) || 0,
      origin: String(d.origin ?? ""),
      dest: String(d.dest ?? ""),
      payType: String(d.payType ?? ""),
      total: Number(d.total) || 0,
      age: Number(d.agingDays) || null,
    }))
    .sort((a, b) => b.total - a.total), [bills]);

  const needle = q.trim().toLowerCase();
  const listed = needle
    ? rows.filter((r) => [r.no, r.docNo, r.cust, r.origin, r.dest]
      .some((v) => v.toLowerCase().includes(needle)))
    : rows;
  const total = rows.reduce((s, r) => s + r.total, 0);

  return (
    <Pane deps={[bills]}>
      <div className="dz-cards">
        <KC dot={D.rose} tone={total > 0 ? "bad" : undefined} l="ยอดค้างชำระจากไฟล์บิล"
          v={`฿${fmt(total)}`} s={`${fmt(rows.length)} บิล`} />
        <KC dot={D.violet} l="ลูกค้าที่ยังค้าง"
          v={fmt(new Set(rows.map((r) => r.cust)).size)} s="ราย" />
        <KC dot={D.slateDeep} l="แหล่งข้อมูล" small
          v="costrev/old_debtors.json" s="ไฟล์ต้นทุน + ไฟล์รายได้" />
      </div>

      <div className="dz-cc" style={{ marginTop: 14 }}>
        <h4>ทำไมแท็บนี้ไม่มี "ปิดบัญชีเฉลี่ย"</h4>
        <Note>
          ไฟล์ <code>old_debtors.json</code> เก็บไว้เฉพาะบิลที่ <b>ยังไม่ได้ชำระ</b> ตามที่เจ้าของข้อมูล
          เลือกไว้ (ถ้าเก็บทุกบิลไฟล์จะใหญ่ระดับ GB) จึงไม่มีวันที่ชำระให้คำนวณ ·
          และชุดนี้ <b>ไม่เชื่อมกับไฟล์ใบวางบิล</b> ในสองแท็บแรก — คนละเลขที่เอกสาร คนละรูปแบบรหัสลูกค้า
          ห้ามเอายอดสองฝั่งมาบวกกัน
        </Note>
      </div>

      <div className="dz-cc" style={{ marginTop: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                      gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
          <h4 style={{ margin: 0 }}>บิลค้างชำระจากไฟล์รายได้ ({fmt(listed.length)} บิล)</h4>
          <input style={searchStyle} value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="ค้นหาเลขที่บิล / ใบรายการ / ต้นทาง / ปลายทาง" />
        </div>
        <Tbl head={["เลขที่บิล", "เลขที่ใบรายการ", "วันที่", "ผู้รับ", "เส้นทาง",
                    "ประเภทการชำระเงิน", ["ยอด", "n"], ["ค้างมาแล้ว (วัน)", "n"]]}>
          {listed.length === 0 ? (
            <EmptyRow cols={8} text={rows.length === 0
              ? "ยังไม่มีบิลค้างชำระจากไฟล์รายได้ — รัน etl/build_costrev.py ก่อน"
              : "ไม่พบบิลตามคำค้น"} />
          ) : listed.slice(0, 300).map((r) => (
            <tr key={r.key}>
              <td style={{ fontWeight: 600 }}>{r.no || "–"}</td>
              <td>{r.docNo || "–"}</td>
              <td>{r.date ? thSlash(r.date) : "–"}</td>
              <td><ShortId v={r.cust} n={r.custN} /></td>
              <td>{r.origin || "–"} → {r.dest || "–"}</td>
              <td>{r.payType || "–"}</td>
              <td className="n">{fmt(r.total)} บาท</td>
              <td className="n" style={r.age != null && r.age > 30
                ? { color: "var(--red)", fontWeight: 700 } : undefined}>
                {r.age ?? "–"}
              </td>
            </tr>
          ))}
        </Tbl>
        {listed.length > 300 && <Note>แสดง 300 แถวแรก — ใช้ช่องค้นหาเพื่อจำกัดให้แคบลง</Note>}
      </div>
    </Pane>
  );
}
