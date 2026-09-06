/**
 * หน้าการตั้งค่า — เมนูใหม่ที่ index.html บน main เพิ่มเข้ามา
 * รวมของที่เดิมกระจายอยู่ในหน้ากรอกข้อมูล: ตารางราคาน้ำมัน · ตารางค่าซ่อม ·
 * ทะเบียนรถในกองรถ และการเชื่อม Google Sheet
 */
import SheetSettings from "./SheetSettings";
import PriceTable from "../entry/panels/PriceTable";
import RepairTable from "../entry/panels/RepairTable";
import FleetRoster from "../entry/panels/FleetRoster";

export default function Settings() {
  return (
    <>
      <SheetSettings />
      <PriceTable />
      <RepairTable />
      <FleetRoster />
    </>
  );
}
