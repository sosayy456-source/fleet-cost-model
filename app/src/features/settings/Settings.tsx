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
import ForecastSettings from "./ForecastSettings";
import SheetSettings from "./SheetSettings";
import VehicleSpecTable from "./VehicleSpecTable";

export default function Settings() {
  return (
    <>
      <SheetSettings />
      <div className="settings-main-grid">
        <VehicleSpecTable />
        <PriceTable />
      </div>
      {/* ตั้งค่าจำนวนเดือนย้อนหลังของต้นทุนพยากรณ์ (สเปก 22 ก.ย. 2569) */}
      <ForecastSettings />
      <RepairTable />
      {/* วางใต้ตารางค่าซ่อม เพราะผลการนำเข้าลงในตารางนั้นโดยตรง */}
      <RepairImport />
    </>
  );
}
