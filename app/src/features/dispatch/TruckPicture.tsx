/**
 * รูปรถตามชนิดรถ (เจ้าของงานออกแบบ 8 ชนิด ส่งมา 27 ก.ย. 2569 — ต้นฉบับ PNG ใน "Model design/ออกแบบรถ 8 ชนิด/export")
 *
 * รูปใน src/assets/trucks/ ลบข้อความ "0% LOAD FACTOR" ที่ฝังมากับรูปออกแล้ว (สคริปต์ลบข้อความทำครั้งเดียว ไม่ได้เก็บใน repo)
 * แล้ววาดทับในนี้: ของในตู้เติมจากพื้นตู้ตาม % · ตัวเลข % ตรงตำแหน่งเดิม · ล้อหมุน (ตัดวงล้อจากรูปเดียวกันมาหมุน)
 * พิกัดทั้งหมดเป็นพิกเซลของรูปต้นฉบับ 1542 × 540 (วัดจากรูปด้วยสคริปต์)
 *
 * ชนิดรถที่ไม่มีรูปของตัวเอง → ใช้รูปของชนิดที่หน้าตาใกล้กัน (PICTURE_ALIAS) · ไม่มีทั้งคู่ = null (หน้าจัดรถใช้รูปวาดเดิม)
 */
import { useId } from "react";
import tenReefer from "../../assets/trucks/10-reefer.webp";
import tenDry from "../../assets/trucks/10-dry.webp";
import twelveCage from "../../assets/trucks/12-cage.webp";
import twelveReefer from "../../assets/trucks/12-reefer.webp";
import sixDry from "../../assets/trucks/6-dry.webp";
import sixLarge from "../../assets/trucks/6-large.webp";
import trailer from "../../assets/trucks/trailer.webp";
import pickupReefer from "../../assets/trucks/pickup-reefer.webp";

const W = 1542, H = 540, WHEEL_Y = 454;

interface Pic {
  src: string;
  /** พื้นที่ในตู้ที่เติมของได้ [ซ้าย, บน, ขวา, พื้นตู้] — พื้นตู้ = ขอบบนของแถบสีด้านล่าง */
  box: [number, number, number, number];
  /** กรอบข้อความ "0% LOAD FACTOR" เดิม [x0, y0, x1, y1] */
  text: [number, number, number, number];
  /** จุดศูนย์กลางล้อ (x) · รัศมียาง */
  wheels: number[]; r: number;
}

const PICS: Record<string, Pic> = {
  "รถ 10 ล้อตู้เย็น": { src: tenReefer, box: [261, 96, 944, 317], text: [522, 170, 680, 251], wheels: [439, 595, 1117], r: 51 },
  "รถ 10 ล้อตู้แห้ง": { src: tenDry, box: [261, 96, 944, 317], text: [522, 170, 680, 251], wheels: [439, 595, 1117], r: 51 },
  "รถ 12 ล้อคอก": { src: twelveCage, box: [182, 84, 1000, 338], text: [521, 172, 681, 253], wheels: [454, 603, 1191], r: 51 },
  "รถ 12 ล้อตู้เย็น": { src: twelveReefer, box: [194, 96, 1012, 317], text: [522, 170, 680, 251], wheels: [362, 510, 664, 1173], r: 51 },
  "รถ 6 ล้อ(ตู้แห้ง)": { src: sixDry, box: [396, 184, 848, 330], text: [553, 227, 688, 294], wheels: [591, 1027], r: 47 },
  "รถ 6 ล้อใหญ่": { src: sixLarge, box: [329, 142, 896, 324], text: [535, 199, 687, 276], wheels: [560, 1071], r: 49 },
  "รถเทรเลอร์": { src: trailer, box: [51, 84, 1100, 299], text: [495, 155, 653, 236], wheels: [196, 319, 441, 959, 1094, 1349], r: 51 },
  "รถปิ๊กอัพตู้เย็น": { src: pickupReefer, box: [391, 246, 726, 336], text: [490, 273, 625, 326], wheels: [587, 1069], r: 43 },
};

/** ชนิดที่ยังไม่มีรูปของตัวเอง → รูปของชนิดที่หน้าตาใกล้กันที่สุด (แก้/เพิ่มได้ที่นี่ที่เดียว) */
const PICTURE_ALIAS: Record<string, string> = {
  "รถ 10 ล้อ": "รถ 10 ล้อตู้แห้ง",
  "รถ 10 ล้อยาว": "รถ 10 ล้อตู้แห้ง",
  "รถ 10 ล้อพ่วง(แม่)": "รถ 10 ล้อตู้แห้ง",
  "รถ 6 ล้อ FC4": "รถ 6 ล้อ(ตู้แห้ง)",
  "รถ 6 ล้อเล็ก": "รถ 6 ล้อ(ตู้แห้ง)",
  "รถ 6 ล้อคอก": "รถ 6 ล้อใหญ่",
  "รถปิกอัพ 3 ตัน": "รถปิ๊กอัพตู้เย็น",
};

/** ยังไม่ได้เลือกชนิดรถ → แสดงรูปรถ 6 ล้อ (เจ้าของงานสั่ง 27 ก.ย. 2569) */
export const DEFAULT_PICTURE_KIND = "รถ 6 ล้อ(ตู้แห้ง)";

const picOf = (kind: string): Pic | null => PICS[kind] ?? PICS[PICTURE_ALIAS[kind] ?? ""] ?? null;
export const hasTruckPicture = (kind: string): boolean => picOf(kind) !== null;

/** เต็มคัน (≥ 95%) = ของสีแดง · ยังไม่เต็ม = เหลือง — เกณฑ์เดียวกับรูปวาดเดิม (LoadTruck.tsx) */
const isFull = (pct: number): boolean => pct >= 95;

export default function TruckPicture({ kind, lf }: { kind: string; lf: number }) {
  const uid = useId().replace(/:/g, "");
  const pic = picOf(kind);
  if (!pic) return null;
  const [bx0, by0, bx1, by1] = pic.box;
  const [tx0, ty0, tx1, ty1] = pic.text;
  const th = ty1 - ty0, tcx = (tx0 + tx1) / 2;
  const fillPct = Math.min(100, Math.max(0, lf));
  const fillTop = by1 - (by1 - by0) * fillPct / 100;
  // ตัวหนังสือขาวเมื่อของสีแดงท่วมถึงตัวเลขแล้ว — บนพื้นขาว/เหลืองใช้แดงตามรูปต้นฉบับ
  const onRed = isFull(lf) && fillTop < ty0 + th * 0.6;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="tp-svg" role="img" aria-label={`${kind} · Load Factor ${lf.toFixed(1)}%`}>
      <defs>
        <clipPath id={`${uid}box`}><rect x={bx0} y={by0} width={bx1 - bx0} height={by1 - by0} rx={6} /></clipPath>
        <pattern id={`${uid}crates`} width={60} height={46} patternUnits="userSpaceOnUse" x={bx0} y={by1}>
          <rect x={3} y={3} width={54} height={40} rx={4} fill="rgba(255,255,255,.08)" stroke="rgba(255,255,255,.22)" strokeWidth={2} />
          <path d="M3 23H57" stroke="rgba(255,255,255,.14)" strokeWidth={2} />
        </pattern>
        {pic.wheels.map((cx, i) => (
          <clipPath key={i} id={`${uid}w${i}`}><circle cx={cx} cy={WHEEL_Y} r={pic.r - 1} /></clipPath>
        ))}
      </defs>
      <ellipse cx={W / 2} cy={H - 30} rx={W / 2 - 40} ry={9} className="lt-shadow" />
      <image href={pic.src} width={W} height={H} />

      {/* ของในตู้ — เติมจากพื้นตู้ขึ้นไป */}
      <g clipPath={`url(#${uid}box)`}>
        <g className="tp-fillg" style={{ transform: `translateY(${fillTop - by0}px)` }}>
          <rect x={bx0} y={by0} width={bx1 - bx0} height={by1 - by0} className={"lt-fill" + (isFull(lf) ? " full" : "")} />
          <rect x={bx0} y={by0} width={bx1 - bx0} height={by1 - by0} fill={`url(#${uid}crates)`} />
          <rect x={bx0} y={by0} width={bx1 - bx0} height={5} fill="rgba(255,255,255,.35)" />
        </g>
      </g>

      {/* key = ค่าเปลี่ยนแล้วได้ตัวหนังสือใหม่ ท่า fade-down จึงเล่นใหม่ทุกครั้ง */}
      <text key={Math.round(lf)} x={tcx} y={ty0 + th * 0.74} textAnchor="middle"
        className={"tp-pct num-fd" + (onRed ? " on" : "")} style={{ fontSize: th * 0.8 }}>{Math.round(lf)}%</text>
      <text x={tcx} y={ty1} textAnchor="middle" className={"tp-cap" + (onRed ? " on" : "")}
        style={{ fontSize: th * 0.21 }}>LOAD FACTOR</text>

      {/* ล้อ — ตัดวงล้อจากรูปเดียวกันมาหมุนทับตำแหน่งเดิม */}
      {pic.wheels.map((cx, i) => (
        <g key={i} className="tp-wheel" style={{ transformOrigin: `${cx}px ${WHEEL_Y}px` }}>
          <image href={pic.src} width={W} height={H} clipPath={`url(#${uid}w${i})`} />
        </g>
      ))}
    </svg>
  );
}
