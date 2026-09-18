/**
 * แท็บย่อยของ "Dashboard ลูกหนี้" ใน Executive Dashboard
 * ดึงข้อมูลบิลค้างชำระจากไฟล์รายได้ที่ผูกกับเที่ยววิ่ง (costrev/old_debtors.json)
 * ร่วมกับข้อมูลบิลที่ชำระแล้วจาก manifest.debtorPaid
 */
import { useMemo, useState } from "react";
import { DBar } from "../../../lib/chart/dcharts";
import { D } from "../../../lib/chart/theme";
import { ShortId } from "../../../lib/custmap/ShortId";
import { daysBetween, thSlash, todayISO } from "../../../lib/record/date";
import { KC, Note, Pane, searchStyle } from "../../dash-fleet/parts";
import { EmptyRow, fmt, pct, Tbl } from "./common";
import type { CostRevManifest } from "../../../lib/data/useCostRev";
import type { RecordsState, OldDebtor } from "../../../lib/store/useRecords";

export interface DebtorBillItem {
  key: string;
  docNo: string;
  no: string;
  date: string;
  goodsType: string;
  origin: string;
  dest: string;
  sender: string;
  receiver: string;
  senderN: number;
  receiverN: number;
  payType: string;
  total: number;
  age: number;
}

export function parseUnpaidBills(rawBills: OldDebtor[]): DebtorBillItem[] {
  const today = todayISO();
  return rawBills
    .filter((d) => !(d.paid === true || d.status === "ชำระแล้ว"))
    .map((d, i) => {
      const dateStr = String(d.date ?? "");
      const calcAge = dateStr ? daysBetween(dateStr, today) : null;
      const age = Number(d.agingDays) || calcAge || 0;
      return {
        key: `debt-${i}-${d.no ?? ""}`,
        docNo: String(d.docNo ?? ""),
        no: String(d.no ?? ""),
        date: dateStr,
        goodsType: String(d.goodsType ?? ""),
        origin: String(d.origin ?? ""),
        dest: String(d.dest ?? ""),
        sender: String(d.sender ?? ""),
        receiver: String(d.receiver ?? ""),
        senderN: Number(d.senderN) || 0,
        receiverN: Number(d.receiverN) || 0,
        payType: String(d.payType ?? ""),
        total: Number(d.total) || 0,
        age: Math.max(0, age),
      };
    })
    .sort((a, b) => b.total - a.total);
}

const AGING_BUCKETS = [
  { label: "ไม่เกิน 30 วัน", hit: (a: number) => a <= 30, color: D.indigo },
  { label: "31–60 วัน", hit: (a: number) => a >= 31 && a <= 60, color: D.amber },
  { label: "61–90 วัน", hit: (a: number) => a >= 61 && a <= 90, color: D.orange },
  { label: "เกิน 90 วัน", hit: (a: number) => a > 90, color: D.rose },
];

/* ================= แท็บ 1 · ยอดคงค้าง & Aging ================= */
export function AgingTab({ state, manifest }: { state: RecordsState; manifest?: CostRevManifest }) {
  const bills = useMemo(() => parseUnpaidBills(state.fileOld.debtors), [state.fileOld.debtors]);
  const unpaidTotal = useMemo(() => bills.reduce((s, b) => s + b.total, 0), [bills]);
  const unpaidCustomers = useMemo(() => new Set(bills.map((b) => b.receiver).filter(Boolean)).size, [bills]);

  const paidInfo = manifest?.debtorPaid ?? { bills: 0, total: 0 };
  const allTotal = unpaidTotal + paidInfo.total;
  const collectionRate = allTotal > 0 ? (paidInfo.total / allTotal) * 100 : null;

  const buckets = useMemo(() => AGING_BUCKETS.map((b) => {
    const hit = bills.filter((r) => b.hit(r.age));
    const amount = hit.reduce((s, r) => s + r.total, 0);
    return {
      label: b.label,
      color: b.color,
      count: hit.length,
      amount: Math.round(amount),
      pct: unpaidTotal > 0 ? (amount / unpaidTotal) * 100 : 0,
    };
  }), [bills, unpaidTotal]);

  return (
    <Pane deps={[state.fileOld.debtors, manifest]}>
      <div className="dz-cards">
        <KC dot={D.rose} tone={unpaidTotal > 0 ? "bad" : undefined} l="ยอดคงค้างชำระ"
          v={`฿${fmt(unpaidTotal)}`} s={`${fmt(bills.length)} บิลค้างชำระ`} />
        <KC dot={D.emerald} l="ยอดบิลที่ชำระแล้ว"
          v={`฿${fmt(paidInfo.total)}`} s={`${fmt(paidInfo.bills)} บิลที่ชำระแล้ว`} />
        <KC dot={D.indigo} l="อัตราการจัดเก็บเงิน"
          v={collectionRate != null ? pct(collectionRate, 2) : "–"}
          s={`จากยอดรวม ฿${fmt(allTotal)}`} />
        <KC dot={D.violet} l="ลูกค้าที่ยังมียอดค้าง"
          v={`${fmt(unpaidCustomers)} ราย`} s="จากบิลที่ผูกกับเที่ยววิ่ง" />
      </div>

      <div className="dz-row dz-2" style={{ marginTop: 14 }}>
        <div className="dz-cc">
          <h4>ยอดคงค้างแยกตามช่วงอายุหนี้ (Aging)</h4>
          <div className="dz-box tall">
            {bills.length === 0 ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center",
                            height: "100%", color: "var(--ink-faint)", textAlign: "center", padding: 20 }}>
                ไม่มีบิลค้างชำระในชุดข้อมูลนี้
              </div>
            ) : (
              <DBar data={buckets.map((b) => ({ label: b.label, v: b.amount }))} xKey="label"
                colors={buckets.map((b) => b.color)}
                series={[{ key: "v", label: "ยอดคงค้าง (บาท)", color: D.indigo }]} />
            )}
          </div>
          <Note>
            อายุหนี้นับจำนวนวันจากวันที่ออกบิลในไฟล์รายได้ถึงปัจจุบัน (หรือวันที่ระบุในระบบ)
          </Note>
        </div>

        <div className="dz-cc">
          <h4>สรุปตามช่วงอายุหนี้</h4>
          <Tbl head={["ช่วงอายุหนี้", ["ยอดคงค้าง", "n"], ["สัดส่วน", "n"], ["จำนวนบิล", "n"]]}>
            {buckets.map((b) => (
              <tr key={b.label}>
                <td><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: b.color, marginRight: 6 }} />{b.label}</td>
                <td className="n">{fmt(b.amount)} บาท</td>
                <td className="n">{pct(b.pct, 2)}</td>
                <td className="n">{fmt(b.count)}</td>
              </tr>
            ))}
          </Tbl>
          <div style={{ marginTop: 10 }}>
            <Note>
              ข้อมูลบิลมาจาก <code>costrev/old_debtors.json</code> ซึ่งคัดกรองเฉพาะบิลของเที่ยววิ่งที่จับคู่ได้
            </Note>
          </div>
        </div>
      </div>
    </Pane>
  );
}

/* ================= แท็บ 2 · รายลูกหนี้ ================= */
export function ByDebtorTab({ state }: { state: RecordsState }) {
  const bills = useMemo(() => parseUnpaidBills(state.fileOld.debtors), [state.fileOld.debtors]);
  const unpaidTotal = useMemo(() => bills.reduce((s, b) => s + b.total, 0), [bills]);

  const debtors = useMemo(() => {
    const byCust = new Map<string, { cust: string; custN: number; total: number; count: number; maxAge: number }>();
    for (const b of bills) {
      const k = b.receiver || "(ไม่ระบุ)";
      const item = byCust.get(k) ?? { cust: k, custN: b.receiverN, total: 0, count: 0, maxAge: 0 };
      item.total += b.total;
      item.count++;
      item.maxAge = Math.max(item.maxAge, b.age);
      byCust.set(k, item);
    }
    return Array.from(byCust.values()).sort((a, b) => b.total - a.total);
  }, [bills]);

  const topDebtors = useMemo(() => debtors.slice(0, 10).map((d) => ({
    name: d.custN ? `CUS${String(d.custN).padStart(7, "0")}` : d.cust.slice(0, 10) + "…",
    v: Math.round(d.total),
  })), [debtors]);

  return (
    <Pane deps={[state.fileOld.debtors]}>
      <div className="dz-cards">
        <KC dot={D.rose} l="ยอดค้างชำระทั้งหมด" v={`฿${fmt(unpaidTotal)}`} s={`${fmt(bills.length)} บิล`} />
        <KC dot={D.violet} l="ลูกหนี้ที่มียอดค้าง" v={`${fmt(debtors.length)} ราย`} s="ผู้รับตามบิลขนส่ง" />
        <KC dot={D.teal} l="ค้างสูงสุดรายเดียว"
          v={debtors[0] ? `฿${fmt(debtors[0].total)}` : "–"}
          s={debtors[0] ? `สัดส่วน ${pct(unpaidTotal ? (debtors[0].total / unpaidTotal) * 100 : 0, 1)}` : "ไม่มี"} />
      </div>

      <div className="dz-cc" style={{ marginTop: 14 }}>
        <h4>ลูกหนี้ที่มียอดค้างชำระสูงสุด 10 อันดับแรก</h4>
        <div className="dz-box tall">
          <DBar data={topDebtors} xKey="name" horiz
            series={[{ key: "v", label: "ยอดคงค้าง (บาท)", color: D.rose }]} />
        </div>
      </div>

      <div className="dz-cc" style={{ marginTop: 14 }}>
        <h4>ตารางลูกหนี้ที่มียอดค้างชำระทั้งหมด</h4>
        <Tbl head={[["#", "n"], "รหัสลูกค้า", ["ยอดคงค้าง", "n"], ["สัดส่วน", "n"], ["จำนวนบิล", "n"], ["ค้างนานสุด (วัน)", "n"]]}>
          {debtors.length === 0 ? (
            <EmptyRow cols={6} text="ไม่มีลูกหนี้ค้างชำระ" />
          ) : (
            debtors.map((d, i) => (
              <tr key={d.cust}>
                <td className="n">{i + 1}</td>
                <td><ShortId v={d.cust} n={d.custN} /></td>
                <td className="n">{fmt(d.total)} บาท</td>
                <td className="n">{pct(unpaidTotal ? (d.total / unpaidTotal) * 100 : 0, 2)}</td>
                <td className="n">{fmt(d.count)}</td>
                <td className="n" style={d.maxAge > 60 ? { color: "var(--red)", fontWeight: 700 } : undefined}>
                  {d.maxAge}
                </td>
              </tr>
            ))
          )}
        </Tbl>
      </div>
    </Pane>
  );
}

/* ================= แท็บ 3 · รายการบิลค้างชำระ ================= */
export function BillListTab({ state }: { state: RecordsState }) {
  const [q, setQ] = useState("");
  const bills = useMemo(() => parseUnpaidBills(state.fileOld.debtors), [state.fileOld.debtors]);
  const unpaidTotal = useMemo(() => bills.reduce((s, b) => s + b.total, 0), [bills]);

  const needle = q.trim().toLowerCase();
  const listed = useMemo(() => {
    if (!needle) return bills;
    return bills.filter((r) => [r.no, r.docNo, r.receiver, r.origin, r.dest, r.goodsType, r.payType]
      .some((v) => v.toLowerCase().includes(needle)));
  }, [bills, needle]);

  return (
    <Pane deps={[state.fileOld.debtors, q]}>
      <div className="dz-cards">
        <KC dot={D.rose} tone={unpaidTotal > 0 ? "bad" : undefined} l="ยอดค้างชำระจากไฟล์บิล"
          v={`฿${fmt(unpaidTotal)}`} s={`${fmt(bills.length)} บิล`} />
        <KC dot={D.violet} l="ลูกค้าที่ยังค้าง"
          v={`${fmt(new Set(bills.map((r) => r.receiver).filter(Boolean)).size)} ราย`} s="ผู้รับ" />
        <KC dot={D.slateDeep} l="แหล่งข้อมูล" small
          v="costrev/old_debtors.json" s="ไฟล์ต้นทุน + ไฟล์รายได้" />
      </div>

      <div className="dz-cc" style={{ marginTop: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                      gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
          <h4 style={{ margin: 0 }}>รายการบิลค้างชำระ ({fmt(listed.length)} บิล)</h4>
          <input style={searchStyle} value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="ค้นหาเลขที่บิล / ใบรายการ / ผู้รับ / เส้นทาง" />
        </div>

        <Tbl head={["เลขที่บิล", "เลขที่ใบรายการ", "วันที่", "ผู้รับ", "เส้นทาง", "ประเภทสินค้า", "วิธีชำระเงิน", ["ยอด", "n"], ["ค้าง (วัน)", "n"]]}>
          {listed.length === 0 ? (
            <EmptyRow cols={9} text={bills.length === 0
              ? "ไม่มีบิลค้างชำระจากไฟล์รายได้"
              : "ไม่พบบิลตามคำค้น"} />
          ) : (
            listed.slice(0, 300).map((r) => (
              <tr key={r.key}>
                <td style={{ fontWeight: 600 }}>{r.no || "–"}</td>
                <td>{r.docNo || "–"}</td>
                <td>{r.date ? thSlash(r.date) : "–"}</td>
                <td><ShortId v={r.receiver} n={r.receiverN} /></td>
                <td>{r.origin || "–"} → {r.dest || "–"}</td>
                <td>{r.goodsType || "–"}</td>
                <td>{r.payType || "–"}</td>
                <td className="n">{fmt(r.total)} บาท</td>
                <td className="n" style={r.age > 30 ? { color: "var(--red)", fontWeight: 700 } : undefined}>
                  {r.age}
                </td>
              </tr>
            ))
          )}
        </Tbl>
        {listed.length > 300 && <Note>แสดง 300 แถวแรก — ใช้ช่องค้นหาเพื่อจำกัดรายการ</Note>}
      </div>
    </Pane>
  );
}
