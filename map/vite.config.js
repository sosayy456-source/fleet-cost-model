import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

// สองหน้า: index.html = แผนที่, dashboard.html = ตัวอย่าง dashboard ที่ฝังแผนที่ผ่าน iframe
// base "./" ให้ไฟล์ใน dist/ ใช้ path แบบ relative จึงนำไปวางในโฟลเดอร์ย่อยของเว็บอื่นได้
// MAP_ONLY=1 (npm run build:map) = build เฉพาะแผนที่ ลง app/public/map/ ของโมเดล
//   หน้า Demo › กำไรรายเส้นทาง ฝังผ่าน iframe (features/dash-demo/RouteMap.tsx) แล้วสั่งด้วย postMessage
//   ★ แก้ไฟล์ใน src/ แล้วต้องรัน build:map ใหม่ และ commit ผลใน app/public/map/ ด้วย ไม่งั้นหน้าเว็บยังใช้ของเก่า
const mapOnly = !!process.env.MAP_ONLY;
const input = { map: fileURLToPath(new URL("index.html", import.meta.url)) };
if (!mapOnly) input.dashboard = fileURLToPath(new URL("dashboard.html", import.meta.url));

export default defineConfig({
  base: "./",
  build: {
    outDir: mapOnly ? "../app/public/map" : "dist",
    emptyOutDir: true,   // outDir อยู่นอกโฟลเดอร์นี้ Vite จะไม่ล้างให้ถ้าไม่สั่ง — ไฟล์ hash เก่าจะค้างสะสม
    rollupOptions: { input }
  }
});
