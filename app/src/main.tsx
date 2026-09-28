import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import ErrorBoundary from "./lib/ui/ErrorBoundary";
import { tidyCacheBustParam } from "./lib/ui/lazyPage";
import "./fonts.css";
import "./index.css";
import { IS_CHERRY } from "./lib/ui/dashTheme";
import { applyThemeColors } from "./lib/ui/themeColors";
import { bootThemePreview } from "./lib/ui/themePreview";

// ธีมสีแดชบอร์ด (lib/ui/dashTheme.ts) — CSS ของธีม cherry ครอบด้วย html.theme-cherry ท้าย index.css
if (IS_CHERRY) document.documentElement.classList.add("theme-cherry");
// สีรายจุดของธีม cherry (ค่าตั้งต้น + ที่เลือกในหน้าการตั้งค่า · lib/ui/themeColors.ts) — ต้องก่อนวาดหน้า ไม่งั้นเห็นสีว่างแวบ
applyThemeColors();
// เปิดอยู่ในกรอบตัวอย่างของหน้าตั้งค่าสี (?themePreview=…) — ต้องก่อนวาดหน้า ให้ App/แท็บได้หน้าที่ถูกตั้งแต่รอบแรก
bootThemePreview();

// ถ้าเพิ่งถูกรีโหลดข้ามแคชเพราะ deploy ใหม่ ให้เก็บ ?v= ออกจากแถบที่อยู่ก่อนวาดหน้า
tidyCacheBustParam();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {/* ชั้นนอกสุด — กันจอขาวถ้าโครงหลักพัง ส่วนของแต่ละหน้ามีอีกชั้นใน App.tsx */}
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
