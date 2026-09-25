/**
 * กดปุ่ม C = กลับไปจุดเดิมก่อนกดกล่องลิงก์ (เจ้าของงานขอ 25 ก.ย. 2569 — รุ่นแรกเป็นคลิกขวา)
 *
 * กล่อง/การ์ดที่ลิงก์ไปแท็บของ Overall Dashboard (exec-dash) ทุกตัววิ่งผ่าน openExecTab() (dashJump.ts) ตัวเดียว
 * จึงจำจุดเดิม (hash ของหน้า + ตำแหน่งเลื่อนของ window) ไว้ที่นั่นที่เดียว · App ดัก keydown ปุ่ม C แล้วเรียก goBack()
 * ★ เก็บใน sessionStorage (ไม่ใช่ตัวแปร) — lazyPage รีโหลดหน้าเองได้เมื่อมี deploy ทับ ถ้าเก็บในหน่วยความจำจะหาย
 * ★ กดเมนูซ้ายเอง = เริ่มใหม่ ล้างทิ้ง (clearReturnPoints ใน goto ของ App) ไม่งั้นกด C ทีหลังเด้งไปที่ไม่คาดคิด
 * ★ ได้คืนแค่ "หน้า + ตำแหน่งเลื่อน" — ตัวกรอง/เส้นทางที่เลือกในหน้านั้นเป็น state ที่หายไปพร้อมหน้าเมื่อออก
 */
const KEY = "returnStack";
const MAX = 10;

interface ReturnPoint { hash: string; y: number }

function read(): ReturnPoint[] {
  try {
    const v = JSON.parse(sessionStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((p) => typeof p?.hash === "string" && typeof p?.y === "number") : [];
  } catch { return []; }
}

function write(list: ReturnPoint[]): void {
  try {
    if (list.length) sessionStorage.setItem(KEY, JSON.stringify(list.slice(-MAX)));
    else sessionStorage.removeItem(KEY);
  } catch { /* ไม่มีที่เก็บก็แค่กลับไม่ได้ */ }
}

/** จำหน้า + ตำแหน่งเลื่อนปัจจุบัน — เรียกก่อนเปลี่ยน hash */
export function pushReturnPoint(): void {
  write([...read(), { hash: location.hash, y: Math.round(window.scrollY) }]);
}

export const hasReturnPoint = (): boolean => read().length > 0;

export const clearReturnPoints = (): void => write([]);

/** ซ่อนเนื้อหาระหว่างรอหน้ายาวพอ (html.rp-returning ในส่วนที่ 2 ของ index.css) */
const HIDE = "rp-returning";
/** ซ่อนได้นานสุดกี่ ms แล้วแสดงหน้าเลย (ข้อมูลโหลดช้า/หน้าไม่ยาวพอ) */
const MAX_HIDE = 1500;

/**
 * เลื่อนไปตำแหน่ง y โดยไม่ให้เห็นจอวิ่งผ่านตำแหน่งอื่น
 * ★ รุ่นแรกเลื่อนตามทุกเฟรมระหว่างหน้ายังโต ผู้ใช้เห็นจอวิ่งผ่านตาราง · รุ่นสองซ่อนหน้ารอความสูงนิ่ง จอขาว ~2 วิ
 *   (เจ้าของงานแจ้งทั้งสองรอบ 25 ก.ย. 2569) — วัดแล้วเวลาส่วนใหญ่คือเบราว์เซอร์วาดหน้า Executive Dashboard (เมนู demo) ~1.2 วิ (ข้อมูลอยู่ในแคชแล้ว)
 *   และเฟรมแรกที่วาดเสร็จหน้าก็ยาวเต็มแล้ว
 * วิธีนี้: เช็คทุกเฟรม (rAF รันก่อนเบราว์เซอร์วาดภาพ) — หน้ายาวพอเมื่อไหร่ก็เลื่อนในเฟรมนั้นเลย จอจึงไปโผล่ที่จุดเดิมทันที
 *   ไม่ต้องซ่อน · ซ่อนเฉพาะตอนหน้าวาดแล้วแต่ยังสั้นกว่าจุดเดิม (ข้อมูลบางส่วนยังโหลด) และนานสุด MAX_HIDE
 */
function restoreScroll(y: number, page: string): void {
  const root = document.documentElement;
  const drawn = (): boolean => document.querySelector<HTMLElement>("main.app")?.dataset.page === page;
  const giveUp = Date.now() + 5000;          // หน้าไม่ถูกวาดเลย (เช่น ตำแหน่งนี้เข้าหน้านั้นไม่ได้) — เลิกรอ
  let hideUntil = 0;
  const reveal = (): void => root.classList.remove(HIDE);
  const step = (): void => {
    // hash เปลี่ยนก่อน React วาดหน้าใหม่ — ระหว่างนี้จอยังเป็นหน้าเดิม ไม่ซ่อน ไม่เลื่อน รอเฟรมถัดไป
    if (!drawn()) { if (Date.now() < giveUp) requestAnimationFrame(step); return; }
    if (root.scrollHeight - innerHeight >= y) { scrollTo({ top: y }); reveal(); return; }
    hideUntil ||= Date.now() + MAX_HIDE;
    if (Date.now() >= hideUntil) { scrollTo({ top: y }); reveal(); return; }
    root.classList.add(HIDE);
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/** กลับไปจุดล่าสุดที่จำไว้ — ไม่มีให้กลับ = false */
export function goBack(): boolean {
  const list = read();
  const p = list.pop();
  if (!p) return false;
  write(list);
  if (location.hash !== p.hash) location.hash = p.hash;
  restoreScroll(p.y, p.hash.replace(/^#\/?/, ""));
  return true;
}
