/**
 * สีรายจุดของธีม cherry ที่ผู้ใช้เลือกเองได้ในหน้าการตั้งค่า (เจ้าของงานขอ 28 ก.ย. 2569 — "เปลี่ยนสีแต่ละจุดแต่ละกล่องได้โดยละเอียด")
 *
 * ★ แหล่งเดียวของค่าสี: `THEME_TOKENS` ข้างล่าง — CSS ท้าย index.css อ่านผ่าน `var(--th-<key>)` เท่านั้น ไม่มีค่าตั้งต้นซ้ำใน CSS
 *   main.tsx เรียก `applyThemeColors()` ก่อนวาดหน้า → เขียนทุกตัวแปรเป็น inline style ของ <html> (ค่าตั้งต้นทับด้วยค่าที่ผู้ใช้เลือก)
 * ★ ค่าที่เลือกเก็บ localStorage `dashThemeColors` ของเครื่องนั้น (เก็บเฉพาะตัวที่ต่างจากค่าตั้งต้น) เหมือนค่าที่แก้เองอื่น ๆ
 * ★ ใช้กับธีม cherry เท่านั้น — ธีม classic (`dashTheme = "classic"`) ไม่อ่านตัวแปรเหล่านี้
 * ★ สีในกราฟ (ชุด `D` ใน lib/chart/theme.ts) ไม่อยู่ในนี้ — เป็นค่าคงที่ระดับโมดูล เปลี่ยนสดไม่ได้
 * ค่าตั้งต้น = ชุด "กรมท่า + ทราย" ตามภาพที่เจ้าของงานส่ง 28 ก.ย. 2569 (พื้นกรมท่าเข้ม · เมนูทรายไล่เทา · หัวชมพูอ่อน)
 */

import { DEMO_PARTS } from "./demoNav";
import { OVERALL_TABS } from "./overallNav";
import { MANAGER_TABS } from "./managerNav";

export interface ThemeToken {
  key: string;
  label: string;
  hint?: string;
  def: string;
  /** ใช้กับทั้งหน้า (พื้นหลัง · เมนูซ้าย · กล่องหัว) — ตั้งได้เฉพาะสีรวม ไม่ตั้งรายแท็บ */
  global?: true;
  /** selector ของจุดจริงในหน้า — กรอบตัวอย่างรายแท็บใช้ไฮไลต์/เลือกจุด (★ token ใหม่ต้องมี) */
  sel?: string;
  /** ค่าเป็นเปอร์เซ็นต์ 0–100 (สไลเดอร์) ไม่ใช่สี #rrggbb */
  pct?: true;
}

export interface ThemeGroup {
  title: string;
  tokens: ThemeToken[];
}

export const THEME_GROUPS: ThemeGroup[] = [
  {
    title: "พื้นหลังหน้าแดชบอร์ด",
    tokens: [
      { key: "pageTop", label: "พื้นหลัง (บน)", def: "#F5F3F2" , global: true },
      { key: "pageBottom", label: "พื้นหลัง (ล่าง)", def: "#E9ECF0" , global: true },
      // แสงเรืองมุมบนซ้าย + ลำแสงทแยง (เจ้าของงานส่งภาพพื้นน้ำเงินเรืองแสง 28 ก.ย. 2569) — ค่าตั้งต้น = สีพื้นบน จึงแทบมองไม่เห็น
      { key: "pageGlow", label: "แสงเรืองมุมบนซ้าย", hint: "ตั้งเท่าพื้นหลัง (บน) = ไม่มีแสง", def: "#FFFFFF" , global: true },
      { key: "pageText", label: "หัวข้อบนพื้นหลัง", hint: "เช่น Route · หัวข้อส่วน", def: "#1F2933" , sel: ".dm-part-h, .dz-t, .cp-sec h3, .mg-debt > .mg-h" },
      { key: "pageMuted", label: "ข้อความรอง/เส้นคั่นบนพื้นหลัง", def: "#5B6470" , sel: ".dz-note, .cp-sec p" },   // เดิม #FFFFFF จาก theme-export — ขาวบนพื้นสว่างอ่านไม่ออก (เจ้าของงานแจ้ง 29 ก.ย. 2569)
      // กรอบที่ครอบแต่ละส่วน/แท็บ (.dm-part ของ Executive Dashboard) — เจ้าของงานขอ 28 ก.ย. 2569
      // ค่าตั้งต้นเท่าหน้าตาเดิม: พื้น = สีหัวข้อบนพื้นหลัง ทึบ 5% · ขอบ ≈ สีหัวข้อ 12% บนพื้นกรมท่า
      { key: "partBg", label: "พื้นกรอบส่วน", hint: "กรอบที่ครอบแต่ละส่วนของ Executive Dashboard", def: "#1F2933", sel: ".dm-part" },
      { key: "partAlpha", label: "ความทึบพื้นกรอบส่วน", hint: "0 = ใส · 100 = ทึบเต็ม", def: "5", pct: true, sel: ".dm-part" },
      { key: "partBorder", label: "ขอบกรอบส่วน", def: "#D9DDE3", sel: ".dm-part" },
    ],
  },
  {
    title: "เมนูซ้าย",
    tokens: [
      { key: "sideTop", label: "พื้นเมนู (บน)", def: "#BD0000" , global: true },
      { key: "sideBottom", label: "พื้นเมนู (ล่าง)", def: "#BD0000" , global: true },
      { key: "sideText", label: "ตัวอักษรเมนู", def: "#FFFFFF" , global: true },
      { key: "sideActiveBg", label: "พื้นเมนูที่เลือก", def: "#E8EDF5" , global: true },
      { key: "sideActiveText", label: "ตัวอักษรเมนูที่เลือก", def: "#1E3A8A" , global: true },
      { key: "accent", label: "สีเน้น", hint: "ปุ่มหลัก · ป้ายตัวเลข · ขอบช่องที่โฟกัส", def: "#1E3A8A" , global: true },
    ],
  },
  {
    title: "กล่องหัวแดชบอร์ด",
    tokens: [
      { key: "headBg", label: "พื้นกล่องหัว", def: "#FFFFFF" , global: true },
      { key: "headBorder", label: "แถบสีด้านบน", def: "#1E3A8A" , global: true },
      { key: "headTitle", label: "ชื่อหน้า", def: "#1E3A8A" , global: true },
      { key: "headText", label: "ข้อความ/ค่าในตัวกรอง", def: "#2A0A10" , global: true },
      { key: "headMuted", label: "ข้อความรอง/ป้ายตัวกรอง", def: "#7A5A60" , global: true },
      { key: "headLine", label: "เส้นขอบช่องตัวกรอง", def: "#E5E7EB" , global: true },
      // แท็บที่เลือกในแคปซูลหัว — แยกจากสีเน้น (เจ้าของงานสั่ง 28 ก.ย. 2569 ให้เป็นแดงแม้สีเน้นเป็นน้ำเงิน)
      { key: "tabOn", label: "แท็บที่เลือกในหัว", def: "#C62828" , global: true, sel: ".cap-tabs button.on" },
    ],
  },
  {
    title: "การ์ดเด่น (ไล่สีจากซ้ายบน → ขวาล่าง)",
    tokens: [
      { key: "profitA", label: "กำไร · สีเริ่ม", def: "#A8843F" , sel: ".dz-kc.hero.profit" },
      { key: "profitB", label: "กำไร · สีปลาย", def: "#D2B27C" , sel: ".dz-kc.hero.profit" },
      { key: "revA", label: "รายได้ · สีเริ่ม", def: "#0F5E48" , sel: ".dz-kc.hero.rev" },
      { key: "revB", label: "รายได้ · สีปลาย", def: "#2B9474" , sel: ".dz-kc.hero.rev" },
      { key: "costA", label: "ต้นทุน · สีเริ่ม", def: "#9E1F22" , sel: ".dz-kc.hero.cost" },
      { key: "costB", label: "ต้นทุน · สีปลาย", def: "#D2493F" , sel: ".dz-kc.hero.cost" },
      { key: "custA", label: "ลูกค้า · สีเริ่ม", def: "#7A1A2E" , sel: ".dz-kc.hero.cust" },
      { key: "custB", label: "ลูกค้า · สีปลาย", def: "#3F0110" , sel: ".dz-kc.hero.cust" },
      // การ์ดแดงสองใบของ Inefficient Transportation Cost (.i2-group) มีสีของตัวเอง (idle/empty) — ไม่ไฮไลต์/ไม่ถูกเลือกเป็น "ขาดทุน"
      { key: "lossA", label: "ขาดทุน · สีเริ่ม", def: "#9E2C42" , sel: ".dz-kc.hero.loss:not(.i2-group *)" },
      { key: "lossB", label: "ขาดทุน · สีปลาย", def: "#D9707E" , sel: ".dz-kc.hero.loss:not(.i2-group *)" },
      { key: "fleet", label: "กองรถ", def: "#8E5A68" , sel: ".dz-kc.hero.fleet" },
      { key: "svc", label: "บริการ", def: "#B0473A" , sel: ".dz-kc.hero.svc" },
      // Inefficient Transportation Cost: การ์ด 4 ใบตั้งสีแยกได้ (เจ้าของงานสั่ง 28 ก.ย. 2569 · ดีไซน์แผงขาวรอบสอง — Item2Tab I2Card)
      //   ใบ 1 เบอร์กันดีเข้ม · ใบ 2/4 ชมพูอ่อนตัวเข้ม · ใบ 3 แดง · คีย์ i2* ใหม่ (รุ่นแรก idleA/emptyA ทิ้งไป)
      { key: "i2LfA", label: "Load Factor เฉลี่ย · สีเริ่ม", def: "#4A0616" , sel: ".i2c.i2-lf" },
      { key: "i2LfB", label: "Load Factor เฉลี่ย · สีปลาย", def: "#8A1530" , sel: ".i2c.i2-lf" },
      { key: "i2IdleA", label: "ต้นทุนค่าเสียโอกาส (LF) · สีเริ่ม", def: "#F8E1E6" , sel: ".i2c.i2-idle" },
      { key: "i2IdleB", label: "ต้นทุนค่าเสียโอกาส (LF) · สีปลาย", def: "#E7B7C2" , sel: ".i2c.i2-idle" },
      { key: "i2EmptyA", label: "% ต้นทุนเที่ยวเปล่า · สีเริ่ม", def: "#A3161C" , sel: ".i2c.i2-empty" },
      { key: "i2EmptyB", label: "% ต้นทุนเที่ยวเปล่า · สีปลาย", def: "#D13A36" , sel: ".i2c.i2-empty" },
      { key: "i2EmptyCostA", label: "มูลค่าต้นทุนเที่ยวเปล่า · สีเริ่ม", def: "#F8E1E6" , sel: ".i2c.i2-emptyc" },
      { key: "i2EmptyCostB", label: "มูลค่าต้นทุนเที่ยวเปล่า · สีปลาย", def: "#E7B7C2" , sel: ".i2c.i2-emptyc" },
      { key: "i2LightInk", label: "ตัวอักษรในการ์ดสีอ่อน (Inefficient Transportation)", def: "#4A0616" , sel: ".i2c.light .i2c-v, .i2c.light .i2c-l" },
      { key: "i2Title", label: "หัวแผง Load Factor / Empty Trips", def: "#8A1530" , sel: ".i2-v3 .i2-gh" },
      // กล่องแดง 4 ตัวเลขของ Damage (Service Performance) — ตัวอักษรดำ (เจ้าของงานสั่ง 28 ก.ย. 2569 · เดิมขาวตามการ์ดเด่น)
      { key: "dmgInk", label: "ตัวอักษรในกล่อง Damage (Service Performance)", def: "#141414" , sel: ".pi-dmg-row" },
      { key: "dmgA", label: "กล่อง Damage (Service Performance) · สีเริ่ม", def: "#F8BCBC" , sel: ".pi-dmg4" },
      { key: "dmgB", label: "กล่อง Damage (Service Performance) · สีปลาย", def: "#EE8A8A" , sel: ".pi-dmg4" },
      { key: "heroText", label: "ตัวอักษรในการ์ดเด่น", def: "#FFFFFF" , sel: ".dz-kc.hero .v, .dz-kc.hero .l" },
    ],
  },
  {
    title: "การ์ดรอง · กล่องกราฟ/ตาราง",
    tokens: [
      { key: "cardBg", label: "พื้นการ์ด/กล่อง", def: "#FFFFFF" , sel: ".dz-kc:not(.hero), .dz-cc, .i3-panel" },
      { key: "cardLine", label: "เส้นขอบการ์ด", def: "#EBDDE2" , sel: ".dz-kc:not(.hero), .dz-cc" },
      { key: "cardLabel", label: "ชื่อการ์ด/ข้อความรอง", def: "#7A5A60" , sel: ".dz-kc:not(.hero) .l, .dz-tbl th" },
      { key: "cardValue", label: "ตัวเลขในการ์ด", def: "#2A0A10" , sel: ".dz-kc:not(.hero) .v" },
      { key: "boxTitle", label: "หัวข้อกล่องกราฟ/ตาราง", def: "#2A0A10" , sel: ".dz-cc h4" },
      { key: "rowOn", label: "แถวที่เลือกในตาราง", def: "#F8EEF1" , sel: ".rp-tbl tbody tr.on td, .i3-group" },
    ],
  },
  {
    title: "กลุ่มบริการ · หัวส่วน · Performance Index",
    tokens: [
      { key: "sg1", label: "กลุ่มบริการ ใบที่ 1", def: "#1E3A8A" , sel: ".dm-sg.c1" },
      { key: "sg2", label: "กลุ่มบริการ ใบที่ 2", def: "#B0473A" , sel: ".dm-sg.c2, .rp-ico.red" },
      { key: "sg3", label: "กลุ่มบริการ ใบที่ 3", def: "#8E5A68" , sel: ".dm-sg.c3" },
      { key: "secA", label: "หัวส่วน/หัวตาราง สีที่ 1", hint: "Vehicle Utilization Cost · ไอคอนการ์ดเส้นทาง", def: "#1E3A8A" , sel: ".i3-h.violet, .rp-ico.violet, .i3-sec:nth-child(1) .i3-tbl thead tr" },
      { key: "secB", label: "หัวส่วน/หัวตาราง สีที่ 2", def: "#1B7A60" , sel: ".i3-h.green, .rp-ico.green, .i3-sec:nth-child(2) .i3-tbl thead tr, .rp-rank" },
      { key: "secC", label: "หัวส่วน/หัวตาราง สีที่ 3", def: "#8E5A68" , sel: ".i3-h.blue" },
      // 28 ก.ย. 2569 (ภาพที่เจ้าของงานส่ง): กล่อง Index 5 หมวด = เงินเงา ตัวเข้ม · กล่องคะแนนรวม = แชมเปญทอง ตัวเบอร์กันดี
      //   เดิมคีย์ piBg #590212 (เบอร์กันดี) ใช้ทั้งสองกล่อง · piAccent #F3E6C4 — **เปลี่ยนชื่อคีย์เป็น piBox/piBoxAccent**
      //   ให้ค่าเก่าที่เครื่องเคยบันทึก (สีรวม/รายแท็บ) ถูกทิ้งเงียบ ๆ ไม่งั้นแท็บที่เคยตั้งสีค้างพื้นแดงทับเงิน (เจ้าของงานเจอ 28 ก.ย. 2569)
      { key: "piBox", label: "กล่อง Index 5 หมวด (พื้นเงิน)", def: "#CDD1D6" , sel: ".pi-box" },
      { key: "piBoxAccent", label: "คะแนน/แถบในกล่อง Index", def: "#4A4F57" , sel: ".pi-box .pi-score b, .pi-box .pi-meter, .pi-box .pi-bar" },
      { key: "piInk", label: "ตัวอักษรในกล่อง Index", def: "#1F2328" , sel: ".pi-box .pi-t, .pi-box .pi-rm-h" },
      // กล่องคะแนนรวม ไล่ 3 สี (เจ้าของงานส่งรหัสสี 28 ก.ย. 2569): 115deg แชมเปญอ่อน → ทองกลาง 55% → ทองเข้ม
      { key: "piTotalA", label: "กล่องคะแนนรวม · สีเริ่ม (แชมเปญอ่อน)", def: "#F7ECDA" , sel: ".pi-total" },
      { key: "piTotalM", label: "กล่องคะแนนรวม · สีกลาง (ทองกลาง)", def: "#E8D4B1" , sel: ".pi-total" },
      { key: "piTotalBg", label: "กล่องคะแนนรวม · สีปลาย (ทองเข้ม)", def: "#C6A774" , sel: ".pi-total" },
      { key: "piTotalInk", label: "ตัวเลข/แถบ/ตัวอักษรในกล่องคะแนนรวม", def: "#5A0F1E" , sel: ".pi-total .pi-score b, .pi-total .pi-meter, .pi-jump-sc" },
    ],
  },
  {
    // สีเส้น/แท่งในกราฟ = ชุด D ของ lib/chart/theme.ts (เจ้าของงานขอ 28 ก.ย. 2569) — ค่าตั้งต้นที่นี่คือแหล่งเดียวของ D ธีม cherry
    // ★ D เป็นค่าคงที่ที่หลายไฟล์อ่านไปเก็บตอนโหลดโมดูล → เปลี่ยนแล้วต้องรีโหลดหน้า · ตั้งรายแท็บไม่ได้ (global)
    title: "สีเส้น/แท่งในกราฟ (มีผลหลังรีโหลดหน้า)",
    tokens: [
      { key: "chRev", label: "รายได้", hint: "เส้น/แท่งรายได้ · สีชุดที่ 1 ของกราฟ", def: "#C29A5B", global: true },
      { key: "chCost", label: "ต้นทุน / ขาดทุน", hint: "เส้นต้นทุน · ค่าที่แย่ลง", def: "#C86253", global: true },
      { key: "chProfit", label: "กำไร", hint: "เส้นกำไรทุกกราฟ", def: "#0C5A45", global: true },
      { key: "chProfitLight", label: "กำไร (อ่อน) / ดีขึ้น", def: "#1B7A60", global: true },
      { key: "chRevDeep", label: "รายได้ (เข้ม)", def: "#9A7A3E", global: true },
      { key: "chViolet", label: "สีชุดที่ 4", hint: "เส้นทาง/ชนิดรถลำดับที่ 4 · จุดการ์ด", def: "#590212", global: true },
      { key: "chTeal", label: "สีชุดที่ 2 (รถร่วม)", hint: "รถร่วม · ลำดับที่ 2", def: "#8E5A68", global: true },
      { key: "chAmber", label: "สีชุดที่ 3 (เตือน)", hint: "ลำดับที่ 3 · ค่าที่ต้องระวัง", def: "#D9A04A", global: true },
      { key: "chCyan", label: "สีชุดที่ 5", hint: "Damage Incidence Rate · ลำดับที่ 5", def: "#DDA39F", global: true },
      { key: "chOrange", label: "สีชุดที่ 6", def: "#A8472F", global: true },
      { key: "chPink", label: "สีชุดที่ 7", def: "#8E5A68", global: true },
      { key: "chSlate", label: "เทา (อื่น ๆ/แรเงา)", def: "#B7A6AC", global: true },
      { key: "chSlateDeep", label: "เทาเข้ม", def: "#6B4A52", global: true },
    ],
  },
];

/** token สีกราฟ → คีย์ใน D (lib/chart/theme.ts) */
export const CHART_KEY_OF = {
  chRev: "indigo", chCost: "rose", chProfit: "emerald", chProfitLight: "emeraldLight", chRevDeep: "indigoDeep",
  chViolet: "violet", chTeal: "teal", chAmber: "amber", chCyan: "cyan", chOrange: "orange", chPink: "pink",
  chSlate: "slate", chSlateDeep: "slateDeep",
} as const;

export const THEME_TOKENS: ThemeToken[] = THEME_GROUPS.flatMap((g) => g.tokens);
export const THEME_DEFAULTS: Record<string, string> = Object.fromEntries(THEME_TOKENS.map((t) => [t.key, t.def]));

export type ThemeColors = Record<string, string>;

/** ชุดสำเร็จรูป — เลือกแล้วเขียนทับทุกจุด (แก้รายจุดต่อได้) */
export const THEME_PRESETS: { name: string; colors: ThemeColors }[] = [
  // ค่าตั้งต้นเปลี่ยน 29 ก.ย. 2569 ตามไฟล์ theme-export.json ที่เจ้าของงานส่ง (พื้นสว่าง · เมนูแดง · หัวกรมท่า + สีรายแท็บ DEFAULT_SCOPE_COLORS)
  { name: "ค่าตั้งต้น (สว่าง · เมนูแดง)", colors: {} },
  // ค่าตั้งต้นเดิมก่อน 29 ก.ย. 2569 — เก็บไว้เลือกกลับได้
  { name: "กรมท่า + ทราย (ค่าตั้งต้นเดิม)", colors: { pageTop: "#1E2D37", pageBottom: "#0A1319", pageGlow: "#1E2D37", pageText: "#EEE8EA", pageMuted: "#8E9BA3", partBg: "#EEE8EA", partBorder: "#3A474F", sideTop: "#E7CBA9", sideBottom: "#BEC2C3", sideText: "#4B3B3B", sideActiveBg: "#FFFFFF", sideActiveText: "#590212", accent: "#590212", headBg: "#FCEFF2", headBorder: "#590212", headTitle: "#6A0F1B", headLine: "#E4CDD3", sg1: "#5E0718", secA: "#5E0718" } },
  {
    name: "ชมพูเชอร์รี (ธีมก่อนหน้า)",
    colors: {
      pageTop: "#F8F1F2", pageBottom: "#F3E9EC", pageText: "#590212", pageMuted: "#7A5A60",
      sideTop: "#EDE0E3", sideBottom: "#EDE0E3", sideText: "#7A5F66",
      headBg: "#FBF6F7", headTitle: "#590212", partBg: "#590212", partBorder: "#E6D6DA",
      profitA: "#9A7A3E", profitB: "#CFAF7A", revA: "#0C5A45", revB: "#34A07F", costA: "#8E1B1B", costB: "#D44C45",
    },
  },
  {
    name: "กรมท่า + ทอง",
    colors: {
      pageTop: "#14233A", pageBottom: "#070E19", sideTop: "#E9D8B4", sideBottom: "#C8CCD2", sideText: "#2F3441",
      sideActiveText: "#14233A", accent: "#14233A", headBg: "#F5F1E8", headBorder: "#B08A3E", headTitle: "#14233A",
      headLine: "#E3D9C4", sg1: "#14233A", secA: "#14233A",
    },
  },
  {
    // ตามภาพที่เจ้าของงานส่ง 28 ก.ย. 2569: ลำแสงน้ำเงินทแยงจากมุมบนซ้าย + เกรนละเอียด
    // รอบสาม (ภาพที่เจ้าของงานส่ง 28 ก.ย. 2569): พื้นกรมท่าเข้ม + ลำแสงน้ำเงินสดเอียงแบบผ้าไหม ค้างกับจอตอนเลื่อน
    // (รอบแรก ดำ #060A1C→#010207 · รอบสอง กรมท่าสว่าง #22386F→#1B2D5E)
    name: "น้ำเงินเรืองแสง",
    colors: {
      pageTop: "#101737", pageBottom: "#0A0D22", pageGlow: "#1F52E0", pageText: "#EEF2FF", pageMuted: "#A7B4D8",
      partBg: "#EEF2FF", partBorder: "#2B3566",
    },
  },
  {
    name: "สว่าง (ขาว-เทา)",
    colors: {
      pageTop: "#F4F5F7", pageBottom: "#E9ECF0", pageText: "#1F2933", pageMuted: "#6B7280",
      sideTop: "#FFFFFF", sideBottom: "#EEF0F3", sideText: "#374151", sideActiveBg: "#E8EDF5", sideActiveText: "#1E3A8A",
      accent: "#1E3A8A", headBg: "#FFFFFF", headBorder: "#1E3A8A", headTitle: "#1E3A8A", headLine: "#E5E7EB",
      sg1: "#1E3A8A", secA: "#1E3A8A", partBg: "#1F2933", partBorder: "#D9DDE3",
    },
  },
];

const KEY = "dashThemeColors";
export const THEME_EVENT = "dashthemecolors";
const HEX = /^#[0-9a-f]{6}$/i;
const PCT = /^(100|[1-9]?\d)$/;
const PCT_KEYS = new Set(THEME_TOKENS.filter((t) => t.pct).map((t) => t.key));
/** ค่าถูกรูปแบบของ token นั้น — สี #rrggbb หรือเปอร์เซ็นต์ 0–100 (token pct) */
export const validFor = (key: string, v: string): boolean => (PCT_KEYS.has(key) ? PCT : HEX).test(v);

/** ค่าที่ผู้ใช้เลือก — เฉพาะคีย์ที่รู้จักและเป็น #rrggbb (ค่าเพี้ยน/คีย์ที่ถูกลบไปแล้วทิ้งเงียบ ๆ) */
export function loadThemeColors(): ThemeColors {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "{}") as Record<string, unknown>;
    const out: ThemeColors = {};
    for (const k of Object.keys(THEME_DEFAULTS)) {
      const v = raw[k];
      if (typeof v === "string" && validFor(k, v)) out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

/** เขียนตัวแปร --th-* ทุกตัวลง <html> (ค่าตั้งต้นทับด้วยค่าที่เลือก) */
export function applyThemeColors(colors: ThemeColors = loadThemeColors()): void {
  const st = document.documentElement.style;
  for (const t of THEME_TOKENS) st.setProperty(`--th-${t.key}`, colors[t.key] ?? t.def);
}

/** บันทึก + ใช้ทันที · เก็บเฉพาะตัวที่ต่างจากค่าตั้งต้น */
export function saveThemeColors(colors: ThemeColors): void {
  const diff: ThemeColors = {};
  for (const [k, v] of Object.entries(colors)) {
    if (k in THEME_DEFAULTS && validFor(k, v) && v.toUpperCase() !== THEME_DEFAULTS[k]!.toUpperCase()) diff[k] = v.toUpperCase();
  }
  try {
    if (Object.keys(diff).length) localStorage.setItem(KEY, JSON.stringify(diff));
    else localStorage.removeItem(KEY);
  } catch { /* โหมดส่วนตัว — ยังใช้ได้จนปิดหน้า */ }
  applyThemeColors(diff);
  window.dispatchEvent(new Event(THEME_EVENT));
}

export const isHex = (v: string): boolean => HEX.test(v);

/** สีกราฟที่ใช้จริงตอนโหลดหน้า (ค่าตั้งต้น + ที่เลือก) ในรูปคีย์ของ D — lib/chart/theme.ts เรียกครั้งเดียวตอนโหลดโมดูล */
export function chartPalette(): Record<(typeof CHART_KEY_OF)[keyof typeof CHART_KEY_OF], string> {
  const c = { ...THEME_DEFAULTS, ...loadThemeColors() };
  const out = {} as Record<(typeof CHART_KEY_OF)[keyof typeof CHART_KEY_OF], string>;
  for (const [tok, dk] of Object.entries(CHART_KEY_OF)) out[dk] = c[tok]!;
  return out;
}

/** สีกราฟตอนโหลดหน้านี้ — หน้าตั้งค่าเทียบกับค่าปัจจุบันเพื่อบอกว่าต้องรีโหลด */
export const CHART_AT_LOAD: Record<string, string> = Object.fromEntries(
  Object.keys(CHART_KEY_OF).map((k) => [k, (loadThemeColors()[k] ?? THEME_DEFAULTS[k]!).toUpperCase()]));

/* ======================================================================================
   สีรายแท็บ (เจ้าของงานขอ 28 ก.ย. 2569 — ตั้งสีแยกได้ทุกแท็บของทั้ง 3 Dashboard)
   ตัวครอบเนื้อหาแท็บ = <ThemeScope scope="…"> (lib/ui/ThemeScope.tsx) ใส่ data-th-scope + --th-* ที่แท็บนั้นตั้งเอง
   ตัวแปรสืบทอดลงลูก · ตัวแปรที่คิดต่อ (--ch-* --thg-* --d-*) index.css ประกาศซ้ำบน [data-th-scope] ให้คิดใหม่ด้วยค่าของแท็บ
   ไม่ได้ตั้ง = ใช้สีรวม · token global (พื้นหลัง/เมนู/กล่องหัว) ตั้งรายแท็บไม่ได้
   ====================================================================================== */
export interface ThemeScopeDef {
  id: string;
  dash: string;
  label: string;
  /** id หน้าใน App (PAGES) — กรอบตัวอย่างเปิดหน้านี้ */
  page: string;
  tab: string;
}

const scopeList = (dash: string, prefix: string, page: string, tabs: readonly { id: string; label: string }[]): ThemeScopeDef[] =>
  tabs.map((t) => ({ id: `${prefix}:${t.id}`, dash, label: t.label, page, tab: t.id }));

export const THEME_SCOPES: ThemeScopeDef[] = [
  ...scopeList("Executive Dashboard", "demo", "demo", DEMO_PARTS),
  ...scopeList("Overall Dashboard", "overall", "exec-dash", OVERALL_TABS),
  ...scopeList("Manager Dashboard", "manager", "dash-fleet", MANAGER_TABS),
];
export const SCOPE_TOKENS: ThemeToken[] = THEME_TOKENS.filter((t) => !t.global);

const SCOPE_KEY = "dashThemeScopes";

/**
 * สีรายแท็บตั้งต้นของทุกเครื่อง (theme-export.json ที่เจ้าของงานส่ง 29 ก.ย. 2569)
 * ใช้เมื่อเครื่องนั้นยังไม่เคยตั้งสีรายแท็บเอง (localStorage ไม่มีคีย์ dashThemeScopes) — ตั้งเองแล้วใช้ของเครื่องนั้นทั้งชุด
 * ล้างทุกแท็บแล้วเก็บเป็น "{}" (ไม่ลบคีย์) ไม่งั้นค่าตั้งต้นชุดนี้กลับมาเอง
 */
export const DEFAULT_SCOPE_COLORS: Record<string, ThemeColors> = {
  "demo:route": { partBorder: "#6C6519", pageMuted: "#EBEBEB", partBg: "#C7C7C7", pageText: "#344783", partAlpha: "0" },
  "demo:item2": { pageText: "#2243A5", partAlpha: "100", partBg: "#FFFFFF", custA: "#660505", lossA: "#FF2E2E", costA: "#E0298B", lossB: "#FA0526" },
  "demo:cust": { lossA: "#C52645", profitA: "#B28024" },
  "demo:svc": { lossA: "#D08686", lossB: "#DA5D80", i2EmptyCostA: "#E1A8B4", i2EmptyCostB: "#DB9EAC", fleet: "#A1455D", custB: "#B7526C", dmgInk: "#4C1A1A" },
  "demo:pi": { piTotalBg: "#E8D4B1" },
  "overall:detail3": { fleet: "#DDA836", svc: "#459EB0" },
};
const SCOPE_OK = new Set(SCOPE_TOKENS.map((t) => t.key));

/** สีที่ตั้งเองของทุกแท็บ — คีย์ scope/token ที่ไม่รู้จักหรือค่าเพี้ยนทิ้งเงียบ ๆ */
export function loadAllScopeColors(): Record<string, ThemeColors> {
  try {
    const stored = localStorage.getItem(SCOPE_KEY);
    const raw = (stored == null ? DEFAULT_SCOPE_COLORS : JSON.parse(stored)) as Record<string, Record<string, unknown>>;
    const out: Record<string, ThemeColors> = {};
    for (const sc of THEME_SCOPES) {
      const src = raw[sc.id];
      if (!src || typeof src !== "object") continue;
      const c: ThemeColors = {};
      for (const [k, v] of Object.entries(src)) if (SCOPE_OK.has(k) && typeof v === "string" && validFor(k, v)) c[k] = v;
      if (Object.keys(c).length) out[sc.id] = c;
    }
    return out;
  } catch {
    return {};
  }
}

export const loadScopeColors = (scope: string): ThemeColors => loadAllScopeColors()[scope] ?? {};

/** บันทึกสีของแท็บเดียว · ค่าที่เท่าสีรวมไม่เก็บ (สีรวมเปลี่ยนทีหลัง แท็บนั้นจะตามสีรวม) */
export function saveScopeColors(scope: string, colors: ThemeColors): void {
  const global = { ...THEME_DEFAULTS, ...loadThemeColors() };
  const c: ThemeColors = {};
  for (const [k, v] of Object.entries(colors)) {
    if (SCOPE_OK.has(k) && validFor(k, v) && v.toUpperCase() !== global[k]!.toUpperCase()) c[k] = v.toUpperCase();
  }
  const all = loadAllScopeColors();
  if (Object.keys(c).length) all[scope] = c;
  else delete all[scope];
  try {
    // ว่างก็เก็บ "{}" — ลบคีย์ทิ้งแล้วสีรายแท็บตั้งต้น (DEFAULT_SCOPE_COLORS) จะกลับมาเอง
    localStorage.setItem(SCOPE_KEY, JSON.stringify(all));
  } catch { /* โหมดส่วนตัว */ }
  window.dispatchEvent(new Event(THEME_EVENT));
}

/** style ของตัวครอบแท็บ — เฉพาะ --th-* ที่แท็บนั้นตั้งเอง */
export function scopeStyle(colors: ThemeColors): Record<string, string> {
  const st: Record<string, string> = {};
  for (const [k, v] of Object.entries(colors)) st[`--th-${k}`] = v;
  return st;
}
