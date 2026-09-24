/**
 * จุดระหว่างทาง — หน้าจัดรถใช้กรองบิลหลังติ๊กบิลแรก (เจ้าของงานสั่ง 24 ก.ย. 2569)
 * บิลที่ยังเห็น = ต้นทางเดียวกับบิลแรก และปลายทางเดียวกัน หรือเป็นจุดระหว่างทางของปลายทางบิลแรก
 *
 * ★ ตารางระยะทาง (routes.json) มีแค่ระยะจากต้นทางไปปลายทาง ไม่มีระยะระหว่างปลายทางด้วยกัน
 *   จึงคำนวณ "ระหว่างทาง" จากข้อมูลไม่ได้ — ใช้ตารางรายคู่ ต้นทาง → ปลายทาง → [จุดระหว่างทาง] แทน
 *   ค่าเริ่มต้นร่างจากถนนสายหลักตามที่เจ้าของงานยืนยัน ผู้ดูแลระบบแก้รายคู่ได้ในหน้าตั้งค่า
 *   ค่าที่แก้เก็บ localStorage ของเครื่องนั้น (เจ้าของงานเลือก — แบบเดียวกับราคาน้ำมัน/สเปกรถ)
 *
 * ค่าเริ่มต้นแบ่งตามทิศ (ทิศรู้ได้จากปลายทาง — ตารางมีแค่ ภาคเหนือ ↔ กทม./ปริมณฑล):
 *   ขาขึ้น  ปลายทางภาคเหนือ → จุดที่รถผ่านก่อนถึงตามถนนสายหลัก (UP)
 *   ขาล่อง  ปลายทาง กทม./ปริมณฑล → จุดส่งที่อยู่ใกล้กัน + ทางผ่านฝั่งเหนือของเมือง (DOWN)
 * รายการจริงของแต่ละคู่ = รายการข้างล่าง ∩ ปลายทางที่ต้นทางนั้นไปได้จริง
 * จุดที่ยังไม่แน่ใจตำแหน่งตอนร่าง: ท่าลี่ · กองลอย · เวียงป่าเป้า — เจ้าของงานให้ใช้ไปก่อนแล้วแก้ทีหลัง
 */
import { useCallback, useState } from "react";
import { ROUTES, destsFor } from "../refdata";

const KPP = "กำแพงเพชร", TAK = "ตาก", LPG = "ลำปาง", LPN = "ลำพูน", PYO = "พะเยา", CMI = "เชียงใหม่";
const ROAD_CM = [KPP, TAK, LPG, LPN];
const ROAD_CR = [KPP, TAK, LPG, PYO];

const UP: Readonly<Record<string, readonly string[]>> = {
  "กำแพงเพชร": [], "พิษณุโลก": [],
  "ตาก": [KPP],
  "แพร่": ["พิษณุโลก"],
  "น่าน": ["พิษณุโลก", "แพร่"],
  "ลำปาง": [KPP, TAK],
  "ป่าซาง": [KPP, TAK, LPG], "ลำพูน": [KPP, TAK, LPG], "พะเยา": [KPP, TAK, LPG],
  "เชียงใหม่": ROAD_CM, "สันกำแพง": ROAD_CM, "ท่าลี่": ROAD_CM,
  "กองลอย": [...ROAD_CM, CMI], "เชียงดาว": [...ROAD_CM, CMI],
  "ฝาง": [...ROAD_CM, CMI, "เชียงดาว"],
  "เชียงคำ": ROAD_CR, "เชียงราย": ROAD_CR,
  "แม่สาย": [...ROAD_CR, "เชียงราย"],
  "เวียงป่าเป้า": [KPP, TAK, LPG],
};

const NORTH_GATE = ["ตลาดไท", "สี่มุมเมือง"];
const CENTER = ["ปากคลองตลาด", "ปากคลองตลาดใหม่", "สี่แยกมหานาค"];
const WEST = ["พุทธมณฑลสาย 2", "พุทธมณฑลสาย 5"];
const DOWN: Readonly<Record<string, readonly string[]>> = {
  ...Object.fromEntries(CENTER.map((d) => [d, [...CENTER, ...NORTH_GATE]])),
  ...Object.fromEntries(NORTH_GATE.map((d) => [d, NORTH_GATE])),
  ...Object.fromEntries(WEST.map((d) => [d, WEST])),
  "มหาชัย": WEST, "ราชบุรี": WEST,
  "ร่มเกล้า": [],
};

/** จุดระหว่างทางตั้งต้นของคู่นี้ — เฉพาะปลายทางที่ต้นทางนั้นไปได้จริง ไม่รวมตัวปลายทางเอง */
export function defaultStops(origin: string, dest: string): string[] {
  const rule = UP[dest] ?? DOWN[dest] ?? [];
  const reach = new Set(destsFor(origin));
  return rule.filter((s) => s !== dest && reach.has(s));
}

/** ค่าที่แก้เอง คีย์ "ต้นทาง|ปลายทาง" — ไม่มีคีย์ = ใช้ค่าเริ่มต้น */
export type EnRouteOverrides = Record<string, string[]>;
export const pairKey = (origin: string, dest: string): string => `${origin}|${dest}`;

export const stopsFor = (origin: string, dest: string, ovr: EnRouteOverrides): string[] =>
  ovr[pairKey(origin, dest)] ?? defaultStops(origin, dest);

/** บิลนี้ไปทางเดียวกับบิลแรกไหม — ต้นทางต้องตรงกัน (เจ้าของงานเลือก) */
export function onRouteOf(
  anchor: { origin: string; dest: string },
  bill: { origin: string; dest: string },
  ovr: EnRouteOverrides,
): boolean {
  if (bill.origin !== anchor.origin) return false;
  return bill.dest === anchor.dest || stopsFor(anchor.origin, anchor.dest, ovr).includes(bill.dest);
}

/** ทุกคู่ในตารางระยะทาง — หน้าตั้งค่าใช้ทำตัวเลือก */
export const ROUTE_ORIGINS: readonly string[] = Object.keys(ROUTES);

const KEY = "enRouteStops";

export function readEnRoute(): EnRouteOverrides {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null");
    return v && typeof v === "object" && !Array.isArray(v) ? v as EnRouteOverrides : {};
  } catch {
    return {};
  }
}

/**
 * [ค่าที่แก้, ตั้งรายการของคู่หนึ่ง (null = กลับค่าเริ่มต้น), ล้างทั้งตาราง]
 * อ่าน/เขียนพังได้ (โหมดส่วนตัว) — ต้องไม่ทำให้หน้าพัง ใช้ค่าในหน้าต่อไป
 */
export function useEnRoute(): [EnRouteOverrides, (o: string, d: string, stops: string[] | null) => void, () => void] {
  const [ovr, setOvr] = useState<EnRouteOverrides>(readEnRoute);
  const save = (next: EnRouteOverrides) => {
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ไม่เก็บก็ใช้ค่าในหน้าต่อได้ */ }
  };
  const setPair = useCallback((o: string, d: string, stops: string[] | null) => {
    setOvr((cur) => {
      const next = { ...cur };
      if (stops === null) delete next[pairKey(o, d)]; else next[pairKey(o, d)] = stops;
      save(next);
      return next;
    });
  }, []);
  const resetAll = useCallback(() => { setOvr({}); save({}); }, []);
  return [ovr, setPair, resetAll];
}
