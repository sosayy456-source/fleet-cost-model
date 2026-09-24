/**
 * ของที่ App ส่งให้หัวแดชบอร์ด (DashShell) — หน้าแดชบอร์ดไม่มีแถบตำแหน่ง/หัวเรื่องของ App แล้ว
 * ทุกอย่างรวมอยู่ในการ์ดหัวตามดีไซน์ 1A "Command bar"
 *
 * FilterSlotContext = กล่องในหัวที่ตัวกรองของแต่ละแท็บ portal ขึ้นไปวาง (แถวเดียวกับแท็บ)
 * ตัวกรองยังเป็นของแท็บเอง (state อยู่ที่แท็บ) แค่ไปแสดงผลที่หัว
 */
import { createContext, useContext, useEffect } from "react";

export interface DashPageInfo {
  /** หัวเรื่องหน้า — มาจาก PAGES ใน App.tsx */
  title: string;
  /** ชื่อตำแหน่งที่แสดงในแคปซูลข้างปุ่ม "เปลี่ยนหน้าที่" */
  roleLabel: string;
  onSwitchRole: () => void;
}

export const DashPageContext = createContext<DashPageInfo | null>(null);
export const useDashPage = (): DashPageInfo | null => useContext(DashPageContext);

export const FilterSlotContext = createContext<HTMLElement | null>(null);
export const useFilterSlot = (): HTMLElement | null => useContext(FilterSlotContext);

/**
 * ที่มาของข้อมูลที่แท็บประกาศทับหัวแดชบอร์ด — ป้าย "ข้อมูลตัวอย่าง" กับบรรทัดที่มาต้องเป็นของชุดที่แท็บนั้นใช้จริง
 * (เจ้าของงานสั่ง 24 ก.ย. 2569 "แยกป้ายตามข้อมูลของตัวเอง")
 *
 * หัวของ CostRevDash/DemoDash อ่าน manifest ของ costrev/ แต่บางแท็บอ่านชุดของตัวเอง (loadfactor/ · alloc/ · debtors/)
 * แต่ละชุดเลือก real/sample แยกกัน วางไฟล์จริงไม่ครบชุดแล้วหัวจะบอกว่าเป็นข้อมูลจริงทั้งที่แท็บโชว์ตัวอย่าง
 * ข้อความเป็นสตริงล้วน เพราะใช้เป็นคีย์ของ effect — ถ้าเป็น ReactNode จะได้ object ใหม่ทุก render แล้ววนไม่จบ
 */
export interface ShellSource {
  sample: boolean;
  parts: string[];
}

export const ShellSourceContext = createContext<((s: ShellSource | null) => void) | null>(null);

/** ป้าย "ข้อมูลตัวอย่าง" ที่หัวกำลังแสดงอยู่ (หลังแท็บทับแล้ว) · undefined = ยังไม่รู้ */
export const ShellSampleContext = createContext<boolean | undefined>(undefined);
export const useShellSample = (): boolean | undefined => useContext(ShellSampleContext);

/** ทับป้าย/บรรทัดที่มาของหัวแดชบอร์ดตลอดที่คอมโพเนนต์นี้อยู่บนจอ · null = ยังไม่ทับ (ใช้ของหน้า) */
export function useShellSource(src: ShellSource | null): void {
  const set = useContext(ShellSourceContext);
  const key = src ? `${src.sample}\u0001${src.parts.join("\u0001")}` : "";
  useEffect(() => {
    if (!set || !key) return;
    const [sample, ...parts] = key.split("\u0001");
    set({ sample: sample === "true", parts });
    return () => set(null);
  }, [set, key]);
}
