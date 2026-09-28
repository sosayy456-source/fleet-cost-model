/**
 * โหมด "ตัวอย่างในกรอบ" ของหน้าการตั้งค่าสี (28 ก.ย. 2569 — เจ้าของงานเลือกให้ตัวอย่างรายแท็บเป็นหน้าจริงย่อส่วน)
 *
 * หน้าตั้งค่าเปิดแอปตัวเองใน iframe ที่ `?themePreview=<scope>` (scope ตาม THEME_SCOPES เช่น demo:route)
 *  · ซ่อนเมนูซ้าย/กล่องหัว/ส่วนอื่นของหน้า เหลือแท็บเดียว (CSS html.th-preview ท้าย index.css)
 *  · App อ่าน `PREVIEW_SCOPE.page` บังคับหน้า · แท็บ Overall/Manager ส่งผ่าน overallGo/managerGo (pending ในเอกสารกรอบเอง)
 *  · สีเปลี่ยนสด: หน้าตั้งค่าเขียน localStorage → กรอบได้ `storage` event → เขียนตัวแปรใหม่
 *  · คุยกับหน้าตั้งค่าด้วย postMessage (origin เดียวกันเท่านั้น):
 *      รับ  th:hot {key}        → ใส่ .th-hot ให้จุดจริงของ token นั้นในแท็บ แล้วเลื่อนเข้าจอ · ตอบ th:found {key, n}
 *      ส่ง  th:ready            → แท็บวาดเสร็จ
 *      ส่ง  th:pick {key}       → ผู้ใช้กดจุดในกรอบ (คลิกในกรอบถูกดักไว้ ไม่ทำงานของแอป)
 * ★ ใช้ sessionStorage ตำแหน่งเดียวกับแท็บแม่ (same-origin) — ไม่ต้องเลือกตำแหน่งในกรอบ
 */
import { overallGo, type OverallTabId } from "./overallNav";
import { managerGo, type ManagerTabId } from "./managerNav";
import { SCOPE_TOKENS, THEME_EVENT, THEME_SCOPES, applyThemeColors, type ThemeScopeDef } from "./themeColors";

function readScope(): ThemeScopeDef | null {
  try {
    const id = new URLSearchParams(location.search).get("themePreview");
    return THEME_SCOPES.find((s) => s.id === id) ?? null;
  } catch {
    return null;
  }
}

export const PREVIEW_SCOPE: ThemeScopeDef | null = readScope();

const post = (msg: object): void => { if (parent !== window) parent.postMessage(msg, location.origin); };
const scopeRoot = (id: string): Element | null => document.querySelector(`[data-th-scope="${id}"]`);

export function bootThemePreview(): void {
  const sc = PREVIEW_SCOPE;
  if (!sc) return;
  const html = document.documentElement;
  html.classList.add("th-preview");
  history.replaceState(null, "", `${location.pathname}${location.search}#/${sc.page}`);
  if (sc.id.startsWith("overall:")) overallGo(sc.tab as OverallTabId);
  if (sc.id.startsWith("manager:")) managerGo(sc.tab as ManagerTabId);
  if (sc.id.startsWith("demo:")) {
    // หน้ายาวของ Executive — ซ่อนส่วนอื่น เหลือส่วนนี้
    const st = document.createElement("style");
    st.textContent = `html.th-preview .dm-part:not(#demo-${sc.tab}){display:none!important}`;
    document.head.appendChild(st);
  }

  addEventListener("storage", () => { applyThemeColors(); dispatchEvent(new Event(THEME_EVENT)); });

  // แจ้งหน้าตั้งค่าเมื่อแท็บวาดแล้ว
  const ready = (): boolean => {
    if (!scopeRoot(sc.id)?.firstElementChild) return false;
    post({ type: "th:ready" });
    return true;
  };
  if (!ready()) {
    const mo = new MutationObserver(() => { if (ready()) mo.disconnect(); });
    mo.observe(document.body, { childList: true, subtree: true });
  }

  let hotKey: string | null = null;
  const highlight = (key: string | null, scroll: boolean): void => {
    hotKey = key;
    document.querySelectorAll(".th-hot").forEach((el) => el.classList.remove("th-hot"));
    const tok = SCOPE_TOKENS.find((t) => t.key === key);
    const root = scopeRoot(sc.id);
    if (!key || !tok?.sel || !root) { if (key) post({ type: "th:found", key, n: 0 }); return; }
    const els = [...root.querySelectorAll<HTMLElement>(tok.sel)].filter((el) => el.getClientRects().length > 0);
    els.forEach((el) => el.classList.add("th-hot"));
    // ห้ามใช้ scrollIntoView — มันเลื่อนหน้าตั้งค่าที่เป็นแม่ด้วย รายการสีใต้เมาส์ขยับแล้วจุดที่ชี้เปลี่ยนเอง
    if (scroll && els[0]) {
      const r = els[0].getBoundingClientRect();
      if (r.top < 0 || r.bottom > innerHeight) scrollTo({ top: scrollY + r.top - innerHeight / 3, behavior: "smooth" });
    }
    post({ type: "th:found", key, n: els.length });
  };

  addEventListener("message", (e: MessageEvent) => {
    if (e.origin !== location.origin || e.source !== parent) return;
    const d = e.data as { type?: string; key?: string | null };
    if (d?.type === "th:hot") highlight(d.key ?? null, true);
  });

  // ข้อมูลโหลดทีหลัง/ตารางวาดใหม่ → ไฮไลต์ตามจุดที่เพิ่งโผล่ (ไม่เลื่อนจอซ้ำ)
  setInterval(() => { if (hotKey) highlight(hotKey, false); }, 1500);

  // กดในกรอบ = เลือกจุด — ไล่จากตัวที่กดขึ้นไปหา token ที่ selector ตรงตัวแรก
  document.addEventListener("click", (e) => {
    const root = scopeRoot(sc.id);
    const t = e.target as Element | null;
    if (!root || !t || !root.contains(t)) return;
    e.preventDefault();
    e.stopPropagation();
    for (let el: Element | null = t; el && el !== root; el = el.parentElement) {
      const tok = SCOPE_TOKENS.find((k) => k.sel && el!.matches(k.sel));
      if (tok) { post({ type: "th:pick", key: tok.key }); return; }
    }
  }, true);
}
