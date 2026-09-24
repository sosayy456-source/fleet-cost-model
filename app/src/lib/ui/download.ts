/**
 * ให้เบราว์เซอร์ดาวน์โหลดข้อมูลเป็นไฟล์ (ลงโฟลเดอร์ Downloads ตามการตั้งค่าของเบราว์เซอร์)
 * แอปเป็นเว็บนิ่งบน GitHub Pages ไม่มีเซิร์ฟเวอร์ให้เขียนไฟล์ — ส่งออกได้ทางนี้ทางเดียว
 */
export function downloadJson(name: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // ปล่อยหลังเบราว์เซอร์เริ่มดาวน์โหลดแล้ว — ปล่อยทันทีบางเบราว์เซอร์ได้ไฟล์ว่าง
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
