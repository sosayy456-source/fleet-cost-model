/**
 * "Dashboard รายได้" — แท็บใน Executive Dashboard ที่พอร์ตมาจากส่วนแรกของไฟล์ PDF
 * ที่เจ้าของข้อมูลส่งมา (dashboard คนละตัวกับแอป Streamlit เดิมใน RevenueDashboard/)
 *
 * แท็บย่อยตามรูป ส่วนอันสุดท้ายย้ายมาจากแท็บบนสุดของ Executive Dashboard
 * ตามที่เจ้าของข้อมูลสั่ง 17 ก.ย. 2569:
 *   ภาพรวม · แนวโน้ม & สินค้า · การชำระเงิน · ลูกค้า (Pareto) · กำไรลูกค้า (ปันส่วนต้นทุน)
 *
 * ★ "ภาพรวม" มาจากสเปกชุดที่สอง (หน้ารวมของ TRANSPORTATION REVENUE DASHBOARD)
 *   เอามาเสริมของเดิม ไม่ได้แทนที่ · ส่วน Return/สินค้าตีกลับ กับ Transport Operation
 *   ในสเปกเดียวกันยังไม่ทำที่นี่ — Return ไม่มีข้อมูลในไฟล์บิลและมีคนอื่นทำอยู่แล้ว
 *   ส่วน Transport Operation ต้องใช้ไฟล์ต้นทุนรายเที่ยวซึ่งเป็นคนละแท็บ
 *
 * ★ แท็บ "เส้นทาง" (Top 10 เส้นทางที่ทำรายได้สูงสุด) ถูกตัดออก 17 ก.ย. 2569 เพราะซ้ำกับ
 *   เมนู "กำไรรายเส้นทาง" ที่มีตารางเส้นทางเรียงตามรายได้อยู่แล้ว และละเอียดกว่า
 *   (มีระยะทางกับต้นทุนต่อเที่ยวด้วย) — routes.json ที่ ETL สร้างจึงไม่มีหน้าไหนอ่านแล้ว
 *
 * ส่วนลูกหนี้อยู่คนละแท็บ (board/DebtorBoard.tsx) และอ่านคนละไฟล์ — ไม่รวมยอดกัน
 *
 * ★ โหลด useDataset เอง ไม่รับ data เป็น prop — เดิมหน้าแม่ (แดชบอร์ดรายได้) โหลดให้
 *   แต่หน้านั้นถูกยุบไปแล้ว แท็บนี้จึงต้องจัดการสถานะโหลด/ผิดพลาด/รีเฟรชของตัวเอง
 *
 * ต้นแบบเป็น Plotly พื้นดำ ที่นี่วาดด้วยชุดกราฟกลางของโปรเจกต์ (lib/chart/) และการ์ด
 * dz-* ชุดเดียวกับแดชบอร์ดอื่น จึงได้สี ฟอนต์ มุมมน และแอนิเมชันเหมือนกันทั้งแอป
 */
import { useRef, useState } from "react";
import { useDashInk } from "../../../lib/chart/dashfx";
import { useAutoReloadOnEtl, useEtlStatus } from "../../../lib/data/etlStatus";
import { useDataset } from "../../../lib/data/useDataset";
import EtlBanner from "../../../lib/ui/EtlBanner";
import RefreshBtn from "../../../lib/ui/RefreshBtn";
import AllocDash from "../../dash-alloc/AllocDash";
import OverviewTab from "./OverviewTab";
import { useRevFilter } from "./filters";
import ParetoTab from "./ParetoTab";
import PaymentTab from "./PaymentTab";
import TrendTab from "./TrendTab";
import { fmt } from "./common";

const SUB = [
  { id: "overview", label: "ภาพรวม" },
  { id: "trend", label: "แนวโน้ม & สินค้า" },
  { id: "pay", label: "การชำระเงิน" },
  { id: "pareto", label: "ลูกค้า (Pareto)" },
  // อ่านชุด alloc/ ของตัวเอง ไม่ได้ใช้ไฟล์รายได้ชุดเดียวกับสี่แท็บแรก
  { id: "cust", label: "กำไรลูกค้า (ปันส่วนต้นทุน)" },
] as const;
type SubId = (typeof SUB)[number]["id"];

export default function RevenueBoard() {
  const { data, error, loading, reload } = useDataset();
  // dev server แปลงไฟล์ให้เองเมื่อวางไฟล์ใน etl/data/revenue/ — ขึ้นแถบแล้วรีเฟรชเองตอนเสร็จ
  const etl = useEtlStatus("etl");
  useAutoReloadOnEtl(etl, reload);
  const [sub, setSub] = useState<SubId>("overview");
  // ตัวกรองอยู่ระดับนี้เพื่อให้สลับแท็บย่อยแล้วค่าที่เลือกไว้ไม่หาย
  const [f, setF, resetF] = useRevFilter();
  const barRef = useRef<HTMLDivElement>(null);
  useDashInk(barRef, sub);

  const refresh = (
    <RefreshBtn className="dash-reload" onClick={reload} loading={loading}
      title="ดึงไฟล์ข้อมูลรายได้ที่ ETL สร้างไว้มาใหม่" />
  );

  const tabs = (
    <div className="dash-tabs" ref={barRef}>
      <span className="dink" />
      {SUB.map((s) => (
        <button key={s.id} type="button" className={"dtab" + (sub === s.id ? " active" : "")}
          onClick={() => setSub(s.id)}>{s.label}</button>
      ))}
    </div>
  );

  /* แท็บ "กำไรลูกค้า" อ่านไฟล์ชุดอื่น จึงต้องเข้าได้แม้ไฟล์รายได้จะยังไม่มี
     — ไม่งั้นไฟล์รายได้หายทีเดียวปิดแท็บที่ไม่เกี่ยวกันไปด้วย */
  const body = () => {
    if (sub === "cust") return <AllocDash embedded />;
    if (error) {
      return (
        <div className="card">
          <h2>ไม่มีข้อมูลรายได้</h2>
          <div className="banner">{error}</div>
          <p className="muted">
            สร้างไฟล์ข้อมูลด้วย <code>python etl/build_json.py --dataset sample</code>{" "}
            (หรือวางไฟล์บิลจริงใน <code>etl/data/revenue/</code> แล้วปล่อยให้ dev server แปลงให้)
          </p>
          <div style={{ marginTop: 12 }}>{refresh}</div>
        </div>
      );
    }
    if (!data) return <div className="card"><p className="muted">กำลังโหลดข้อมูล...</p></div>;
    return (
      <>
        {sub === "overview" && <OverviewTab data={data} f={f} set={setF} reset={resetF} />}
        {sub === "trend" && <TrendTab data={data} />}
        {sub === "pay" && <PaymentTab data={data} />}
        {sub === "pareto" && <ParetoTab data={data} />}
      </>
    );
  };

  return (
    <>
      <EtlBanner status={etl} />
      {data && sub !== "cust" && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <span className="muted" style={{ fontSize: 12.5 }}>
              {fmt(data.manifest.rowCount)} รายการ · {data.manifest.sourceFiles.length} ไฟล์ ·{" "}
              {data.manifest.dateRange.min} → {data.manifest.dateRange.max}
              {data.manifest.isSample && <> · <b style={{ color: "var(--red)" }}>ข้อมูลตัวอย่าง</b></>}
            </span>
            <span style={{ marginLeft: "auto" }}>{refresh}</span>
          </div>
        </div>
      )}
      {tabs}
      {body()}
    </>
  );
}
