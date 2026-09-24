/**
 * หน้า "บันทึกข้อมูลรวม" ของผู้ดูแลระบบ (เจ้าของงานสั่ง 24 ก.ย. 2569)
 * เอาหน้าจริงของ 4 ฝ่ายมาเรียงต่อกันตามลำดับงาน — แต่ละส่วนคือหน้าเดียวกับที่ฝ่ายนั้นเห็นทุกอย่าง
 *   Customer Service   = บันทึกบิล       (features/bills/BillEntry)
 *   Fleet Coordinator  = จัดรถ            (features/dispatch/DispatchPage)
 *   Driver             = เที่ยวรถของฉัน   (features/driver/DriverJobs)
 *   Accounting         = บันทึกข้อมูล      (features/entry/EntryForm — เปิดใบจากรายการแล้วกรอกค่าใช้จ่าย)
 *
 * ★ ห้ามทำหน้าตาแยกของหน้านี้เอง — แก้ที่หน้าของฝ่ายนั้น แล้วหน้านี้จะตามไปเอง
 *   ผู้ดูแลระบบไม่เห็นเมนูแยกของ 4 หน้านี้แล้ว (ROLE_VIEWS.admin) ส่วนฝ่ายอื่นเห็นหน้าของตัวเองเหมือนเดิม
 */
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import BillEntry from "../bills/BillEntry";
import DispatchPage from "../dispatch/DispatchPage";
import DriverJobs from "../driver/DriverJobs";
import EntryForm from "./EntryForm";
import type { RecordsState } from "../../lib/store/useRecords";
import type { RoleKey } from "../../types/record";

function Part({ id, title, sub, children }: { id: string; title: string; sub: string; children: ReactNode }) {
  return (
    <section id={`ea-${id}`} className="ea-part">
      <h2 className="ea-part-h">{title}<span>{sub}</span></h2>
      {children}
    </section>
  );
}

export default function EntryAll({ role, state }: { role: RoleKey; state: RecordsState }) {
  // มาจากปุ่ม "แก้ไข" ของรายการทั้งหมด/ใบที่ยังไม่ครบ = เลื่อนไปส่วน Accounting ที่ฟอร์มเปิดใบนั้นอยู่
  // ★ อ่านตอน render แรก — EntryForm (ลูก) ลบคีย์ทิ้งใน effect ของตัวเองซึ่งทำงานก่อน effect ของหน้านี้
  const [fromEdit] = useState(() => {
    try { return !!sessionStorage.getItem("editRecordId"); } catch { return false; }
  });
  useEffect(() => {
    if (fromEdit) document.getElementById("ea-account")?.scrollIntoView({ block: "start" });
  }, [fromEdit]);

  return (
    <>
      <Part id="cs" title="Customer Service" sub="ฝ่ายบริการลูกค้า · บันทึกบิล"><BillEntry /></Part>
      <Part id="dispatch" title="Fleet Coordinator" sub="ฝ่ายเจ้าหน้าที่จัดรถ · จัดรถ">
        <DispatchPage state={state} role={role} />
      </Part>
      <Part id="driver" title="Driver" sub="คนขับ · เที่ยวรถของฉัน"><DriverJobs state={state} role={role} /></Part>
      <Part id="account" title="Accounting Department" sub="ฝ่ายบัญชีการเงิน · บันทึกค่าใช้จ่าย">
        <EntryForm role={role} state={state} />
      </Part>
    </>
  );
}
