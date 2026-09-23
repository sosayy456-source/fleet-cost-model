import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import ErrorBoundary from "./lib/ui/ErrorBoundary";
import { tidyCacheBustParam } from "./lib/ui/lazyPage";
import "./fonts.css";
import "./index.css";

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
