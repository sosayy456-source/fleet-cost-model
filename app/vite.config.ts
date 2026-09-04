import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// base ต้องตรงกับชื่อ repo เพราะ GitHub Pages เสิร์ฟที่ path ย่อย
// (https://<user>.github.io/fleet-cost-model/) — ตั้งผิดแล้ว asset 404 ทั้งหน้า
export default defineConfig({
  base: "/fleet-cost-model/",
  plugins: [react()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
