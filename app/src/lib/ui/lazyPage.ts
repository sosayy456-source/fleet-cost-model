/**
 * โหลดหน้าแบบแยกก้อน (code-split) ที่ทนต่อการ deploy ทับตอนผู้ใช้เปิดหน้าค้างไว้
 *
 * ★ อาการที่แก้: Vite ตั้งชื่อก้อนย่อยด้วย hash (`DemoDash-<hash>.js`) พอ deploy ใหม่
 *   ชื่อเปลี่ยนและไฟล์เก่าถูกลบทิ้ง แท็บที่เปิดค้างไว้ยังถือ `index.html` เก่าที่ชี้ไปชื่อเดิม
 *   กดเข้าหน้าที่ยังไม่เคยโหลด → 404 → "Failed to fetch dynamically imported module"
 *   (ไม่ใช่ข้อมูลหาย ไฟล์ข้อมูลยังอยู่ครบ — เป็นเรื่องแคชของเบราว์เซอร์ล้วน ๆ)
 *
 * ★ ทำไมต้องต่อ `?v=` ไม่ใช่ `location.reload()` เฉย ๆ: GitHub Pages ส่ง `index.html` มาพร้อม
 *   `Cache-Control: max-age=600` การรีโหลดธรรมดาจึงอาจได้ HTML เก่าจากแคชกลับมาอีกจนครบสิบนาที
 *   URL ที่ไม่ซ้ำเดิมเป็นคนละคีย์แคช บังคับให้ไปหยิบของใหม่จากเซิร์ฟเวอร์แน่นอน
 *
 * ★ กันวนลูป: จดเวลาที่รีโหลดไว้ใน sessionStorage ถ้าเพิ่งรีโหลดไปไม่ถึง `RELOAD_GAP_MS`
 *   แปลว่าโหลดใหม่แล้วก็ยังพัง (เน็ตหลุดจริง / ไฟล์หายจริง) ให้ปล่อย error ขึ้น ErrorBoundary ตามเดิม
 *   ห้ามตัดตัวกันนี้ออก ไม่งั้นเน็ตหลุดทีเดียวหน้าเว็บจะรีโหลดตัวเองไม่หยุด
 */
import { lazy } from "react";
import type { ComponentType } from "react";

const RELOAD_KEY = "staleChunkReloadAt";
const RELOAD_GAP_MS = 20_000;

/** ข้อความตอนโหลดก้อนย่อยไม่สำเร็จ — แต่ละเบราว์เซอร์เขียนไม่เหมือนกัน ต้องดักทุกแบบ */
export function isStaleChunkError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return /failed to fetch dynamically imported module|error loading dynamically imported module|importing a module script failed|failed to load module script/i
    .test(msg);
}

/**
 * รีโหลดโดยข้ามแคชของ `index.html` — ใช้กับปุ่มที่ผู้ใช้กดเอง จึงไม่มีตัวกันลูป
 * (ตัวกันลูปมีไว้กันการรีโหลดอัตโนมัติ ไม่ใช่กันคนกดปุ่ม)
 */
export function reloadBypassingCache(): void {
  const url = new URL(location.href);
  url.searchParams.set("v", String(Date.now()));
  location.replace(url.toString());
}

/** รีโหลดแบบข้ามแคชหนึ่งครั้ง · คืน false ถ้าเพิ่งรีโหลดไปแล้ว (แปลว่าแก้ไม่ตก) */
function reloadFresh(): boolean {
  let last = 0;
  try {
    last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
  } catch {
    /* โหมดส่วนตัวอ่าน sessionStorage ไม่ได้ — ถือว่ายังไม่เคยรีโหลด */
  }
  if (Date.now() - last < RELOAD_GAP_MS) return false;
  try {
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    /* เขียนไม่ได้ก็ยังรีโหลดให้ แค่กันลูปไม่ได้รอบเดียว */
  }
  reloadBypassingCache();
  return true;
}

/**
 * ใช้แทน `lazy()` ทุกหน้าที่แยกก้อน
 * ถ้าก้อนหายเพราะ deploy ใหม่ จะรีโหลดให้เองเงียบ ๆ แทนที่จะโยนจอ error ใส่ผู้ใช้
 */
// `any` ตรงนี้จำเป็น — เป็นข้อจำกัดเดียวกับที่ `React.lazy` ใช้เอง ถ้าแคบกว่านี้หน้าที่มี props จะส่งเข้าไม่ได้
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyPage<T extends ComponentType<any>>(load: () => Promise<{ default: T }>) {
  return lazy(() =>
    load().catch((err: unknown) => {
      if (isStaleChunkError(err) && reloadFresh()) {
        // หน้ากำลังจะโหลดใหม่อยู่แล้ว — คืน promise ที่ไม่ settle
        // เพื่อให้ค้างที่ fallback ของ Suspense ไม่ให้จอ error แวบขึ้นมาก่อนหน้าจะเปลี่ยน
        return new Promise<{ default: T }>(() => {});
      }
      throw err;
    }),
  );
}

/**
 * ถอด `?v=` ออกจาก URL · คืน `null` ถ้าไม่มีให้ถอด (จะได้ไม่ต้องแตะ history เปล่า ๆ)
 * แยกเป็นฟังก์ชันบริสุทธิ์เพื่อให้เทสได้โดยไม่ต้องมี DOM
 */
export function stripCacheBustParam(href: string): string | null {
  const url = new URL(href);
  if (!url.searchParams.has("v")) return null;
  url.searchParams.delete("v");
  return url.pathname + url.search + url.hash;
}

/** ลบ `?v=` ที่ใช้ล้างแคชออกจากแถบที่อยู่ ไม่ให้ค้างให้ผู้ใช้เห็น (ไม่ได้โหลดหน้าใหม่) */
export function tidyCacheBustParam(): void {
  const next = stripCacheBustParam(location.href);
  if (next !== null) history.replaceState(null, "", next);
}
