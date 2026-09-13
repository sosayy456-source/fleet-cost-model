import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import ErrorBoundary from "./lib/ui/ErrorBoundary";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {/* ชั้นนอกสุด — กันจอขาวถ้าโครงหลักพัง ส่วนของแต่ละหน้ามีอีกชั้นใน App.tsx */}
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
