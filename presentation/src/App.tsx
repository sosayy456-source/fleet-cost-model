import { useEffect } from 'react';
import { startScroll } from './engine/scroll';
import { startSteps } from './engine/steps';
import { R0Home } from './scenes/R0Home';
import { R1CustomerService } from './scenes/R1CustomerService';
import { Cursor } from './primitives';
import { ProgressRail } from './components/ProgressRail/ProgressRail';
import { PresenterPanel } from './components/PresenterPanel/PresenterPanel';
import styles from './App.module.css';
export default function App() {
  useEffect(() => { const stopScroll = startScroll(); const stopSteps = startSteps(); return () => { stopSteps(); stopScroll(); }; }, []);
  return <><a className={styles.skip} href="#r1-1">ข้ามไปบันทึกบิล</a><ProgressRail sample/><main><R0Home/><R1CustomerService/></main><Cursor/><PresenterPanel notes={{ R0:'หกตำแหน่งเข้าโมเดลเดียวกัน เล่าตามลำดับ CS → จัดรถ → คนขับ → บัญชี → ผู้ดูแลระบบ', R1:'ข้อมูลสมมติทั้งหมด บิลแรกกรอกใหม่ อีกสองบิลเตรียมไว้สำหรับ V2 · สูตรใช้ billVolume และ billTotalOf ของแอป · ระบบกลางในเรื่องเป็นสถานะเชื่อมต่อสำเร็จ ไม่มีการส่งข้อมูลจริง' }}/></>;
}
