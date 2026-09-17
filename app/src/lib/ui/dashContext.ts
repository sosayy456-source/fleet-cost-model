/**
 * ของที่ App ส่งให้หัวแดชบอร์ด (DashShell) — หน้าแดชบอร์ดไม่มีแถบตำแหน่ง/หัวเรื่องของ App แล้ว
 * ทุกอย่างรวมอยู่ในการ์ดหัวตามดีไซน์ 1A "Command bar"
 *
 * FilterSlotContext = กล่องในหัวที่ตัวกรองของแต่ละแท็บ portal ขึ้นไปวาง (แถวเดียวกับแท็บ)
 * ตัวกรองยังเป็นของแท็บเอง (state อยู่ที่แท็บ) แค่ไปแสดงผลที่หัว
 */
import { createContext, useContext } from "react";

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
