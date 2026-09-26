import { createRoot } from 'react-dom/client';
import Tour from './tour/Tour';
import './styles/fonts.css';
import './styles/tokens.css';
import './styles/global.css';
// เว็บนำเสนอ = โหมดวิดีโอ (คลิปแอปจริง) อย่างเดียว — ฉากหน้าจอจำลอง R0/R1 ลบแล้ว 26 ก.ย. 2569 (เจ้าของงานสั่ง)
// ลิงก์เก่าที่ต่อ ?tour ยังเปิดได้ตามเดิม
createRoot(document.getElementById('root')!).render(<Tour/>);
