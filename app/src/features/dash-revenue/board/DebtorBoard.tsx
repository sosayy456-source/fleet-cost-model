/**
 * "Dashboard ลูกหนี้" — แท็บแยกจาก "Dashboard รายได้" ตามที่เจ้าของข้อมูลสั่ง (17 ก.ย. 2569)
 * สองส่วนนี้ **ไม่รวมยอดกัน** เหมือนในไฟล์ PDF ที่แยกเป็นคนละแถบแท็บ
 *
 * แท็บย่อยสามอันตามรูป:
 *   ยอดคงค้าง & Aging · รายลูกหนี้ / สาขา · จากข้อมูลบิล (เดิม)
 *
 * สองอันแรกอ่าน data/<ds>/debtors/ (etl/build_debtors.py จากไฟล์ใบวางบิล)
 * อันที่สามอ่าน costrev/old_debtors.json ผ่าน RecordsState — คนละชุดข้อมูลกันคนละเลขเอกสาร
 */
import { useRef, useState } from "react";
import { useDashInk } from "../../../lib/chart/dashfx";
import { useDebtors } from "../../../lib/data/useDebtors";
import { resetDebtorCodes, useDebtorCodes } from "../../../lib/custmap/debtorCodes";
import { useAutoReloadOnEtl, useEtlStatus } from "../../../lib/data/etlStatus";
import EtlBanner from "../../../lib/ui/EtlBanner";
import RefreshBtn from "../../../lib/ui/RefreshBtn";
import { AgingTab, ByDebtorTab, FromBillsTab } from "./DebtorTabs";
import { fmt } from "./common";
import type { RecordsState } from "../../../lib/store/useRecords";

const SUB = [
  { id: "aging", label: "ยอดคงค้าง & Aging" },
  { id: "debtor", label: "รายลูกหนี้ / สาขา" },
  { id: "bills", label: "จากข้อมูลบิล (เดิม)" },
] as const;
type SubId = (typeof SUB)[number]["id"];

export default function DebtorBoard({ state }: { state: RecordsState }) {
  const { data, error, loading, reload: reloadData } = useDebtors();
  // ตารางรหัส CUS ของลูกหนี้ — โหลดไว้ให้ <ShortId> แสดงเป็นรหัสย่อแทน hash
  useDebtorCodes();
  const reload = () => { resetDebtorCodes(); reloadData(); };
  // dev server แปลงไฟล์ให้เองเมื่อวางไฟล์ใน etl/data/debtors/ — ขึ้นแถบแล้วรีเฟรชเองตอนเสร็จ
  const etl = useEtlStatus("debtors");
  useAutoReloadOnEtl(etl, reload);
  const [sub, setSub] = useState<SubId>("aging");
  const barRef = useRef<HTMLDivElement>(null);
  useDashInk(barRef, sub);

  const refresh = (
    <RefreshBtn className="dash-reload" onClick={reload} loading={loading}
      title="ดึงไฟล์ที่ ETL สร้างไว้ (debtors/) มาใหม่" />
  );

  if (error) {
    return (
      <div className="card">
        <h2>Dashboard ลูกหนี้</h2>
        <div className="banner">{error}</div>
        <p className="muted">
          สร้างไฟล์ข้อมูลด้วย <code>python etl/build_debtors.py --dataset sample</code>{" "}
          (หรือ <code>--dataset real</code> เมื่อวางไฟล์ใบวางบิลจริงใน <code>etl/data/debtors/</code> แล้ว)
        </p>
        <div style={{ marginTop: 12 }}>{refresh}</div>
      </div>
    );
  }
  if (!data) return <div className="card"><p className="muted">กำลังโหลดข้อมูลลูกหนี้...</p></div>;

  const m = data.manifest;

  return (
    <>
      <EtlBanner status={etl} />
      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <span className="muted" style={{ fontSize: 12.5 }}>
            ใบวางบิล {fmt(m.rows)} ใบ · ลูกหนี้ {fmt(m.customers)} ราย · สาขา {m.branches.length} แห่ง ·{" "}
            {m.dateRange.min} → {m.dateRange.max}
            {m.isSample && <> · <b style={{ color: "var(--red)" }}>ข้อมูลตัวอย่าง</b></>}
          </span>
          <span style={{ marginLeft: "auto" }}>{refresh}</span>
        </div>
      </div>

      <div className="dash-tabs" ref={barRef}>
        <span className="dink" />
        {SUB.map((s) => (
          <button key={s.id} type="button" className={"dtab" + (sub === s.id ? " active" : "")}
            onClick={() => setSub(s.id)}>{s.label}</button>
        ))}
      </div>

      {sub === "aging" && <AgingTab data={data} />}
      {sub === "debtor" && <ByDebtorTab data={data} />}
      {sub === "bills" && <FromBillsTab state={state} />}
    </>
  );
}
