import { createRoot } from 'react-dom/client';
import App from './App';
import Tour from './tour/Tour';
import './styles/fonts.css';
import './styles/tokens.css';
import './styles/global.css';
// ?tour = โหมดสาธิตด้วยวิดีโอ (ทดลอง 26 ก.ย. 2569) · ไม่มี = ฉากหน้าจอจำลองเดิม
const tour = new URLSearchParams(location.search).has('tour');
createRoot(document.getElementById('root')!).render(tour ? <Tour/> : <App/>);
