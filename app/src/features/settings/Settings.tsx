/**
 * หน้าการตั้งค่า — ตรงตาม <section id="view-settings"> ของ index.html บน main
 * มีสองการ์ดเท่านั้น: ตารางราคาน้ำมัน และ การคำนวณค่าซ่อมแซม
 *
 * ของอีกสองอย่างอยู่คนละหน้าตามต้นฉบับ —
 *   ทะเบียนรถในกองรถ  → หน้า “บันทึกข้อมูล” (โซนฝ่ายจัดรถ)
 *   การเชื่อม Google Sheet → หน้า “รายการทั้งหมด”
 */
import PriceTable from "../entry/panels/PriceTable";
import RepairTable from "../entry/panels/RepairTable";
import RepairImport from "./RepairImport";

export default function Settings() {
  return (
    <>
      <PriceTable />
      <RepairTable />
      {/* วางใต้ตารางค่าซ่อม เพราะผลการนำเข้าลงในตารางนั้นโดยตรง */}
      <RepairImport />
    </>
  );
}
