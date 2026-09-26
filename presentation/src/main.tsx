import { createRoot } from 'react-dom/client';
import Tour from './tour/Tour';
import './styles/fonts.css';
import './styles/tokens.css';
import './styles/global.css';
// เว็บนำเสนอเหลือโหมดเดียว = pitch ด้วยวิดีโอ (เจ้าของงานสั่งตัดหน้าจำลองทีละขั้นทิ้ง 26 ก.ย. 2569 · เดิมเปิดด้วย ?tour)
createRoot(document.getElementById('root')!).render(<Tour/>);
