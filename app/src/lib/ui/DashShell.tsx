/**
 * โครงหน้าแดชบอร์ดร่วมทุกหน้า — การ์ดหัวแบบ 1A "Command bar" + เนื้อหาของหน้า
 *
 *   แถว 1  หัวเรื่อง + ชิปข้อมูลตัวอย่าง · บรรทัดที่มาของข้อมูล · ปุ่มรีเฟรช + ตำแหน่ง/เปลี่ยนหน้าที่
 *   แถว 2  แท็บ (แคปซูล) · ตัวกรองของแท็บที่เปิดอยู่ (FilterBar portal ขึ้นมาที่ .dh-filters)
 *
 * ต้องครอบทั้งหัวและเนื้อหา เพราะตัวกรองอยู่ในแท็บ (ลูกของ children) แต่ไปแสดงที่หัว
 * สถานะโหลด/พัง/ไม่มีข้อมูลก็ใช้โครงนี้ ปุ่มรีเฟรชกับ "เปลี่ยนหน้าที่" จึงกดได้ตลอด
 */
import { useState } from "react";
import type { ReactNode } from "react";
import RefreshBtn from "./RefreshBtn";
import { FilterSlotContext, ShellSampleContext, ShellSourceContext, useDashPage } from "./dashContext";
import type { ShellSource } from "./dashContext";

export interface DashShellProps {
  /** ชุดข้อมูลตัวอย่าง → ชิป "ข้อมูลตัวอย่าง — ไม่ใช่ยอดจริงของบริษัท" · ข้อมูลจริง = ไม่แสดง */
  sample?: boolean;
  /** บรรทัดที่มาของข้อมูลใต้หัวเรื่อง — ใช้ <Meta> ช่วยใส่จุดคั่น */
  meta?: ReactNode;
  onRefresh: () => void;
  loading?: boolean;
  refreshTitle?: string;
  /** แถบแท็บ (.dash-tabs) — ไม่มีก็ได้ */
  tabs?: ReactNode;
  /** ใช้แทนหัวเรื่องจาก App (เช่นหน้าเดียวกันที่มีสองโหมด) */
  title?: string;
  children?: ReactNode;
}

export default function DashShell({
  sample, meta, onRefresh, loading, refreshTitle, tabs, title, children,
}: DashShellProps) {
  const page = useDashPage();
  // callback ref → state เพื่อให้ FilterBar ในเนื้อหา re-render แล้ว portal ได้หลังกล่องถูกสร้าง
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  // แท็บที่อ่านชุดข้อมูลของตัวเองทับป้าย/บรรทัดที่มาได้ (useShellSource ใน dashContext.ts)
  const [src, setSrc] = useState<ShellSource | null>(null);
  const isSample = src ? src.sample : sample;
  const metaNode = src ? <Meta parts={src.parts} /> : meta;

  return (
    <FilterSlotContext.Provider value={slot}>
    <ShellSourceContext.Provider value={setSrc}>
    <ShellSampleContext.Provider value={isSample}>
      <header className="dh">
        <div className="dh-top">
          <div className="dh-titles">
            <div className="dh-titleline">
              <h1>{title ?? page?.title}</h1>
              {isSample && (
                <span className="dh-sample"><i aria-hidden="true" />ข้อมูลตัวอย่าง — ไม่ใช่ยอดจริงของบริษัท</span>
              )}
            </div>
            {metaNode && <p className="dh-meta">{metaNode}</p>}
          </div>
          <div className="dh-actions">
            <RefreshBtn className="dh-refresh" onClick={onRefresh} loading={loading} title={refreshTitle} />
            {page && (
              <div className="dh-role">
                <span>{page.roleLabel}</span>
                <button type="button" onClick={page.onSwitchRole}>เปลี่ยนหน้าที่</button>
              </div>
            )}
          </div>
        </div>
        <div className="dh-bar">
          {tabs}
          <div className="dh-filters" ref={setSlot} />
        </div>
      </header>
      {children}
    </ShellSampleContext.Provider>
    </ShellSourceContext.Provider>
    </FilterSlotContext.Provider>
  );
}

/** บรรทัด meta — ต่อชิ้นข้อความด้วยจุดคั่นสีจาง ข้ามชิ้นที่ว่าง */
export function Meta({ parts }: { parts: ReactNode[] }) {
  const items = parts.filter((p) => p !== null && p !== undefined && p !== false && p !== "");
  return (
    <>
      {items.map((p, i) => (
        <span key={i}>{i > 0 && <span className="dh-sep" aria-hidden="true">·</span>}{p}</span>
      ))}
    </>
  );
}
