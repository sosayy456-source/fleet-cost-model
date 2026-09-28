/**
 * ตัวครอบเนื้อหาของแท็บ/ส่วนแดชบอร์ด — ใส่สีที่แท็บนั้นตั้งเองในหน้าการตั้งค่า (lib/ui/themeColors.ts · 28 ก.ย. 2569)
 * display:contents จึงไม่กระทบเลย์เอาต์ · ตัวแปร CSS สืบทอดลงลูกตามโครง DOM
 * ★ แท็บ/ส่วนใหม่ของ 3 Dashboard ต้องครอบด้วยตัวนี้ และเติมใน THEME_SCOPES ไม่งั้นตั้งสีรายแท็บไม่ได้
 */
import { useEffect, useState, type ReactNode } from "react";
import { THEME_EVENT, loadScopeColors, scopeStyle } from "./themeColors";

export function useThemeScope(scope: string): Record<string, string> {
  const [style, setStyle] = useState(() => scopeStyle(loadScopeColors(scope)));
  useEffect(() => {
    const on = () => setStyle(scopeStyle(loadScopeColors(scope)));
    on();
    window.addEventListener(THEME_EVENT, on);
    window.addEventListener("storage", on);
    return () => { window.removeEventListener(THEME_EVENT, on); window.removeEventListener("storage", on); };
  }, [scope]);
  return style;
}

export default function ThemeScope({ scope, children }: { scope: string; children: ReactNode }) {
  const style = useThemeScope(scope);
  return <div className="th-scope" data-th-scope={scope} style={style}>{children}</div>;
}
