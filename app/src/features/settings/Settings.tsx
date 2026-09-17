/**
 * หน้าการตั้งค่า — ตรงตาม <section id="view-settings"> ของ index.html บน main
 * บวกแผงตั้งค่าการเชื่อม Google Sheet ที่ย้ายมาจากหน้า “รายการทั้งหมด” ตามที่ขอ
 * (main วางไว้หน้านั้น index.html:1073 แต่ตรงหมวด "การตั้งค่า" มากกว่า)
 *
 * ของอีกอย่างอยู่คนละหน้าตามต้นฉบับ — ทะเบียนรถในกองรถ → หน้า “บันทึกข้อมูล” (โซนฝ่ายจัดรถ)
 */
import PriceTable from "../entry/panels/PriceTable";
import RepairTable from "../entry/panels/RepairTable";
import RepairImport from "./RepairImport";
import SheetSettings from "./SheetSettings";

export default function Settings() {
  return (
    <>
      <SheetSettings />
      <PriceTable />
      <RepairTable />
      {/* วางใต้ตารางค่าซ่อม เพราะผลการนำเข้าลงในตารางนั้นโดยตรง */}
      <RepairImport />
    </>
  );
}
