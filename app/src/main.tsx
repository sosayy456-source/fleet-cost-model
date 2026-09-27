import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import ErrorBoundary from "./lib/ui/ErrorBoundary";
import { tidyCacheBustParam } from "./lib/ui/lazyPage";
import "./fonts.css";
import "./index.css";
import { IS_CHERRY } from "./lib/ui/dashTheme";

// ธีมสีแดชบอร์ด (lib/ui/dashTheme.ts) — CSS ของธีม cherry ครอบด้วย html.theme-cherry ท้าย index.css
if (IS_CHERRY) document.documentElement.classList.add("theme-cherry");

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
