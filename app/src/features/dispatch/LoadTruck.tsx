/**
 * กล่อง "สถานะการบรรทุก" ของหน้าจัดรถ — รูปรถเติมของตาม Load Factor ของบิลที่ติ๊ก (เจ้าของงานส่งแบบ
 * "Truck Load Factor (standalone).html" 24 ก.ย. 2569) · ใช้สี/ฟอนต์ของโมเดล ไม่ใช่ของไฟล์ต้นแบบ
 *
 * มีหางพ่วง = วาดหางต่อท้ายรถ แล้วเติมตู้หัวก่อน ล้นไปตู้หาง (splitLoad) · หลอดกับตัวเลขใต้รูปเป็น Load Factor รวม
 * ตัวเลขในตู้ fade-down เมื่อค่าเปลี่ยน ล้อหมุนตลอด — ปิดทั้งคู่เมื่อผู้ใช้ตั้ง prefers-reduced-motion
 * ข้อความสรุป/คำเตือนใต้หลอดมาจากหน้าจัดรถ (children) ที่นี่แค่วาดกรอบให้
 * ★ ทรงรถเปลี่ยนตามชนิดรถที่เลือก (เจ้าของงานสั่ง 27 ก.ย. 2569 · จัดกลุ่มใน lib/dispatch/truckShape.ts · ตำแหน่งใน layout() ข้างล่าง):
 *   จำนวนเพลาตามจริง (ปิกอัพ 2 · 6 ล้อ 2 · 10 ล้อ 3 · 12 ล้อ 4 · เทรเลอร์ = หัวลาก 3 เพลา + หางกึ่งพ่วง 2 เพลา) ·
 *   ความยาวตู้คงที่ต่อกลุ่ม · รูปตู้ ตู้แห้ง/ตู้เย็น (มีเครื่องทำความเย็น)/คอก (เสาคอก)/กระบะปิกอัพ ·
 *   รถเทรเลอร์ + หางเทรเลอร์ = หางกึ่งพ่วงวางบนหัวลาก แบ่งเป็นตู้หัว/ตู้หาง · หางอื่นต่อท้ายด้วยคานลาก ·
 *   ยังไม่เลือกชนิดรถ = รถเทาทรง 10 ล้อ
 */
import { useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { Load, LoadStats } from "../../lib/dispatch/load";
import type { Cap } from "../../lib/dispatch/loadSplit";
import { headShape, tailShape } from "../../lib/dispatch/truckShape";
import type { BodyKind, HeadShape, TailShape } from "../../lib/dispatch/truckShape";
import TruckPicture, { hasTruckPicture } from "./TruckPicture";

interface Props {
  /** ข้อความหัวกล่องด้านขวา เช่น ทะเบียน · ชนิดรถ (ประเภท) */
  hint: string;
  /** Load Factor รวม (%) */
  lf: number;
  /** % ของตู้หัว / ตู้หาง (null = ไม่มีหาง) */
  head: number;
  tail: number | null;
  /** "คิดจากฝั่งน้ำหนัก" ฯลฯ — ว่าง = ไม่แสดง */
  basis: string;
  over: boolean;
  /** ชนิดรถหัว / หาง — กำหนดทรงรถในรูป ("" = ยังไม่เลือก) */
  headKind: string;
  tailKind: string;
  children?: ReactNode;
  /** true = วาดแค่เวทีรูปรถ ไม่มีกรอบการ์ด/หัว/หลอด/ข้อความ (หน้าจัดรถแบบแผงขวา · 27 ก.ย. 2569) */
  bare?: boolean;
}

const reducedMotion = (): boolean =>
  typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** สีของที่เติม: เกิน 100% แดง · ตั้งแต่ 95% เขียว (เต็มคันพอดี) · นอกนั้นสีหลักของโมเดล */
const tone = (pct: number): string => (pct > 100 ? " over" : pct >= 95 ? " full" : "");
/** สีของในตู้: ยังไม่เต็ม = เหลือง · เต็ม (≥ 95% เกณฑ์เดียวกับ "เต็มคันพอดี") หรือล้น = แดง (เจ้าของงานสั่ง 24 ก.ย. 2569) */
const isFull = (pct: number): boolean => pct >= 95;
/** รถยุบลงตามน้ำหนัก (หน่วยของ viewBox) — เหมือนไฟล์ต้นแบบ */
const sinkOf = (pct: number): number => Math.min(100, pct) * 0.06;

/* ---------------- ตำแหน่งชิ้นส่วนตามทรงรถ (หน่วย viewBox · หน้ารถชี้ขวา กันชนที่ x ≈ 590 · พื้นตู้ y = 212) ---------------- */
const FLOOR = 212;
interface Box { x: number; w: number; top: number; body: BodyKind; unit: "head" | "tail"; label: string }
interface Axle { x: number; r: number; dual: boolean }
interface Bar { x1: number; x2: number; y: number; h: number; unit: "head" | "tail" }
interface Layout { cab: "truck" | "pickup"; boxes: Box[]; axles: Axle[]; bars: Bar[]; fifth: boolean; minX: number }

/** เพลา/ตู้ของรถหัวแต่ละกลุ่ม — ตู้ชิดหลังหัวเก๋งที่ x = right · axles = เพลาหลัง (+ เพลาหน้าที่ 2 ของ 12 ล้อ) */
const HEAD: Record<Exclude<HeadShape["cls"], "none">, { x: number; w: number; top: number; rear: number[]; front2?: number }> = {
  pickup: { x: 250, w: 170, top: 146, rear: [312] },
  "6": { x: 160, w: 240, top: 56, rear: [250] },
  "10": { x: 24, w: 376, top: 34, rear: [100, 182] },
  "10long": { x: -40, w: 440, top: 34, rear: [40, 122] },
  "12": { x: -26, w: 426, top: 34, rear: [52, 134], front2: 414 },
  tractor: { x: -150, w: 555, top: 34, rear: [306, 378] },
};

/** กรอบมาตรฐาน = รถ 10 ล้อไม่มีหาง (ไฟล์ต้นแบบ 600 × 300) · ขยายรถเล็กได้สูงสุดเท่านี้ */
const BASE_W = 624, BASE_H = 300, MAX_ZOOM = 1.35;
/** viewBox ที่ครอบรถ (minX → กันชน 592) ไว้กลาง · พื้น y 280 อยู่ที่ขอบล่างเดิม · สัดส่วน BASE_W : BASE_H */
function frameOf(L: Layout) {
  const left = L.minX, right = 592, span = right - left;
  const top = Math.min(L.cab === "pickup" ? 118 : 82, ...L.boxes.map((b) => b.top - (b.body === "cold" ? 38 : 8)));
  let w = Math.max(span + 24, BASE_W / MAX_ZOOM), h = w * BASE_H / BASE_W;
  const needH = BASE_H - top + 12;                 // ขอบบนเหนือชิ้นที่สูงสุด 12 หน่วย
  if (h < needH) { h = needH; w = h * BASE_W / BASE_H; }
  const cx = (left + right) / 2;
  return { x: cx - w / 2, y: BASE_H - h, w, h, cx, span };
}

function layout(head: HeadShape, tail: TailShape | null): Layout {
  const cls = head.cls === "none" ? "10" : head.cls;
  const g = HEAD[cls];
  const pickup = cls === "pickup";
  const r = pickup ? 25 : 30;
  const boxes: Box[] = [], axles: Axle[] = [], bars: Bar[] = [];
  const top = pickup && head.body === "cold" ? 104 : g.top;
  // ล้อหน้าใต้หัวเก๋ง · 12 ล้อมีเพลาหน้าสองเพลา
  axles.push({ x: pickup ? 505 : 494, r, dual: false });
  if (g.front2) axles.push({ x: g.front2, r, dual: false });
  for (const x of g.rear) axles.push({ x, r, dual: !pickup });
  let semiOnTractor = false;
  if (cls === "tractor") {
    // หัวลาก: แชสซีสั้น + จานหมุน · ตู้คือหางกึ่งพ่วงวางบนหัว มีล้อคู่ท้ายตู้สองเพลา
    bars.push({ x1: 250, x2: 568, y: 218, h: 16, unit: "head" });
    bars.push({ x1: g.x - 12, x2: 300, y: 214, h: 10, unit: "head" });
    axles.push({ x: g.x + 70, r, dual: true }, { x: g.x + 152, r, dual: true });
    semiOnTractor = tail?.cls === "semi";
    if (semiOnTractor) {
      // รถเทรเลอร์ + หางเทรเลอร์ = คันเดียวกัน แบ่งตู้หน้า (หัว) กับตู้หลัง (หาง)
      const half = Math.round(g.w / 2);
      boxes.push({ x: g.x + g.w - half + 8, w: half - 8, top, body: head.body, unit: "head", label: "ตู้หัว" });
      boxes.push({ x: g.x, w: g.w - half - 8, top, body: tail!.body, unit: "tail", label: "ตู้หาง" });
    } else {
      boxes.push({ x: g.x, w: g.w, top, body: head.body, unit: "head", label: "" });
    }
  } else {
    bars.push({ x1: g.x - 12, x2: 568, y: 218, h: pickup ? 14 : 16, unit: "head" });
    boxes.push({ x: g.x, w: g.w, top, body: head.body, unit: "head", label: "" });
  }
  let minX = Math.min(...bars.map((b) => b.x1), ...boxes.map((b) => b.x - 8));
  if (tail && !semiOnTractor) {
    // หางต่อท้ายด้วยคานลาก — ตู้ 296 · ล้อหน้า-หลัง (หางเทรเลอร์หลังรถที่ไม่ใช่หัวลาก ก็วาดแบบนี้)
    const hitch = Math.min(...bars.filter((b) => b.unit === "head").map((b) => b.x1));
    const right = hitch - 36, x = right - 296;
    boxes.push({ x, w: 296, top: 34, body: tail.body, unit: "tail", label: "ตู้หาง" });
    bars.push({ x1: x - 12, x2: right + 12, y: 218, h: 16, unit: "tail" }, { x1: right + 4, x2: hitch + 6, y: 222, h: 6, unit: "tail" });
    axles.push(tail.cls === "semi"
      ? { x: x + 70, r: 30, dual: true } : { x: x + 58, r: 30, dual: false },
    tail.cls === "semi" ? { x: x + 152, r: 30, dual: true } : { x: x + 240, r: 30, dual: false });
    minX = x - 12;
  }
  return { cab: pickup ? "pickup" : "truck", boxes, axles, bars, fifth: cls === "tractor", minX };
}

export default function LoadTruck({ hint, lf, head, tail, basis, over, headKind, tailKind, children, bare }: Props) {
  const uid = useId().replace(/:/g, "");
  const [reduced] = useState(reducedMotion);
  const shownRef = useRef({ lf: 0, head: 0, tail: 0 });
  const wheels = useRef<(SVGGElement | null)[]>([]);
  const hasTail = tail != null;

  // ค่าที่ไล่ตามทีละเฟรมใน 0.7 วิ (ease-out) — ใช้หมุนล้อเท่านั้น ตัวเลขในตู้โชว์ค่าจริงแล้ว fade-down (.num-fd)
  useEffect(() => {
    const target = { lf, head, tail: tail ?? 0 };
    if (reduced) { shownRef.current = target; return; }
    const from = shownRef.current;
    const t0 = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / 700);
      const e = 1 - (1 - p) ** 3;
      shownRef.current = {
        lf: from.lf + (target.lf - from.lf) * e,
        head: from.head + (target.head - from.head) * e,
        tail: from.tail + (target.tail - from.tail) * e,
      };
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [lf, head, tail, reduced]);

  // ล้อหมุนตลอด + หมุนเพิ่มตามของที่เติม
  useEffect(() => {
    if (reduced) return;
    const t0 = performance.now();
    let raf = 0;
    const spin = (now: number) => {
      const deg = (now - t0) * 0.2 + shownRef.current.lf * 3.6;
      for (const g of wheels.current) if (g) g.style.transform = `rotate(${deg}deg)`;
      raf = requestAnimationFrame(spin);
    };
    raf = requestAnimationFrame(spin);
    return () => cancelAnimationFrame(raf);
  }, [reduced]);

  const hs = headShape(headKind);
  const L = layout(hs, hasTail ? tailShape(tailKind) : null);
  const ghost = hs.cls === "none";

  const wheel = (i: number, a: Axle) => {
    const cy = 280 - a.r - 2, k = a.r / 30;
    return (
      <g key={i} ref={(el) => { wheels.current[i] = el; }} style={{ transformOrigin: `${a.x}px ${cy}px` }}>
        <circle cx={a.x} cy={cy} r={a.r} className="lt-tire" />
        {a.dual && <circle cx={a.x} cy={cy} r={a.r - 5} className="lt-dual" />}
        <circle cx={a.x} cy={cy} r={17 * k} className="lt-hub" />
        <circle cx={a.x} cy={cy} r={6 * k} className="lt-bolt" />
        <circle cx={a.x} cy={cy - 11 * k} r={2.5 * k} className="lt-bolt" />
        <circle cx={a.x + 10.5 * k} cy={cy + 3 * k} r={2.5 * k} className="lt-bolt" />
        <circle cx={a.x - 10.5 * k} cy={cy + 3 * k} r={2.5 * k} className="lt-bolt" />
      </g>
    );
  };
  const arch = (a: Axle) => {
    const cy = 280 - a.r - 2, R = a.r + 12, y = cy - 12;
    return `M${a.x - R} ${y}A${R} ${R} 0 0 1 ${a.x + R} ${y}Z`;
  };

  /** ตู้สินค้าหนึ่งตู้ตามรูปตู้ — กรอบ + ของที่เติม (scaleY จากพื้นตู้) + ตัวเลข % กลางตู้ */
  const cargo = (b: Box, pct: number, numPct: number, label: string, clipId: string) => {
    const h = FLOOR - b.top, small = h < 100, mid = b.top + h / 2;
    const stake = b.body === "stake";
    const posts = stake ? Math.max(2, Math.round(b.w / 70)) : 0;
    const on = numPct > 55 && isFull(pct);
    return (
      <>
        {!stake && <rect x={b.x - 8} y={b.top - 8} width={b.w + 16} height={h + 16} rx={14} className="lt-frame" />}
        <rect x={b.x} y={b.top} width={b.w} height={h} rx={stake ? 4 : 10} className="lt-inner" />
        <clipPath id={clipId}><rect x={b.x} y={b.top} width={b.w} height={h} rx={stake ? 4 : 10} /></clipPath>
        <g clipPath={`url(#${clipId})`}>
          <g className="lt-fillg" style={{ transform: `scaleY(${Math.min(100, pct) / 100})`, transformOrigin: `0 ${FLOOR}px` }}>
            <rect x={b.x} y={b.top} width={b.w} height={h} className={"lt-fill" + (isFull(pct) ? " full" : "")} />
            <rect x={b.x} y={b.top} width={b.w} height={h} fill={`url(#${uid}crates)`} />
            <rect x={b.x} y={b.top} width={b.w} height={4} fill="rgba(255,255,255,.35)" />
          </g>
        </g>
        {stake ? (
          <>
            {/* คอก: เสาคอก + ราวสามเส้น ของในกระบะมองเห็นผ่านช่อง */}
            {Array.from({ length: posts + 1 }, (_, n) => (
              <rect key={n} x={b.x - 4 + (b.w * n) / posts} y={b.top - 8} width={8} height={h + 8} rx={3} className="lt-rail" />
            ))}
            {[b.top - 8, b.top + h / 2 - 3].map((y) => <rect key={y} x={b.x - 8} y={y} width={b.w + 16} height={7} rx={3} className="lt-rail" />)}
            <rect x={b.x - 8} y={FLOOR - 2} width={b.w + 16} height={8} rx={3} className="lt-rail" />
          </>
        ) : (
          <>
            <rect x={b.x - 8} y={b.top - 8} width={b.w + 16} height={10} rx={5} className="lt-rail" />
            {!small && <path d={[0.25, 0.5, 0.75].map((f) => `M${b.x + b.w - 8} ${b.top + h * f}H${b.x + b.w}`).join("")} className="lt-tick" />}
          </>
        )}
        {b.body === "cold" && (
          <g className="lt-reefer-g">
            {/* ตู้เย็น: เครื่องทำความเย็นบนหัวตู้ด้านหน้า */}
            <rect x={b.x + b.w - 66} y={b.top - 38} width={52} height={30} rx={6} className="lt-reefer" />
            <path d={`M${b.x + b.w - 58} ${b.top - 30}V${b.top - 16}M${b.x + b.w - 48} ${b.top - 30}V${b.top - 16}M${b.x + b.w - 38} ${b.top - 30}V${b.top - 16}`}
              className="lt-reefer-vent" />
            <circle cx={b.x + b.w - 24} cy={b.top - 23} r={5} className="lt-reefer-vent" />
          </g>
        )}
        {/* ตัวหนังสือขาวเฉพาะบนพื้นแดง — บนพื้นเหลืองขาวอ่านไม่ออก ใช้สีเข้มตามเดิม */}
        {/* key = ค่าเปลี่ยนแล้วได้ตัวหนังสือใหม่ ท่า fade-down จึงเล่นใหม่ทุกครั้ง */}
        <text key={Math.round(numPct)} x={b.x + b.w / 2} y={mid + (small ? 8 : 12)} textAnchor="middle"
          className={"lt-pct num-fd" + (small ? " sm" : "") + (on ? " on" : "")}>
          {Math.round(numPct)}%
        </text>
        {!small && <text x={b.x + b.w / 2} y={mid + 36} textAnchor="middle" className={"lt-cap" + (on ? " on" : "")}>{label}</text>}
      </>
    );
  };

  // กรอบภาพครอบตัวรถพอดีแล้ววางกลางกล่อง (เจ้าของงานสั่ง 27 ก.ย. 2569) · สัดส่วนกรอบคงที่ ความสูงกล่องเท่ากันทุกชนิด ·
  // รถสั้น (ปิกอัพ · 6 ล้อ) ขยายได้ถึง MAX_ZOOM เท่า · รถยาว/มีหางย่อลงให้ครบคัน · ขอบบนต้องไม่ตัดเครื่องทำความเย็น/หัวเก๋ง
  const vb = frameOf(L);
  const barPct = Math.min(100, lf);
  const unitPct = (u: "head" | "tail") => (u === "tail" ? tail ?? 0 : head);
  const boxOf = (u: "head" | "tail") => L.boxes.filter((b) => b.unit === u);
  const headLabel = hasTail ? "ตู้หัว" : "LOAD FACTOR";

  const stage = (
      <div className="lt-stage">
        <svg viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} className={"lt-svg" + (ghost ? " lt-ghost" : "")} role="img"
          aria-label={`Load Factor ${lf.toFixed(1)}%${headKind ? ` · ${headKind}` : ""}`}>
          <defs>
            <pattern id={`${uid}crates`} width={47} height={36} patternUnits="userSpaceOnUse" x={24} y={212}>
              <rect x={3} y={3} width={41} height={30} rx={3} fill="rgba(255,255,255,.07)" stroke="rgba(255,255,255,.18)" strokeWidth={1.5} />
              <path d="M3 18H44" stroke="rgba(255,255,255,.12)" strokeWidth={1.5} />
            </pattern>
          </defs>
          <ellipse cx={vb.cx} cy={278} rx={vb.span / 2 + 10} ry={10} className="lt-shadow" />
          <path d={`M${vb.x} 280H${vb.x + vb.w}`} className="lt-ground" />
          <path d={L.axles.map(arch).join("")} className="lt-tire" />

          {/* หาง — ต่อท้ายด้วยคานลาก หรือเป็นตู้หลังของหางกึ่งพ่วงบนหัวลาก */}
          {tail != null && (
            <g className="lt-body" style={{ transform: `translateY(${sinkOf(tail)}px)` }}>
              {boxOf("tail").map((b, n) => <g key={n}>{cargo(b, tail, tail, b.label, `${uid}clipT${n}`)}</g>)}
              {L.bars.filter((b) => b.unit === "tail").map((b, n) => (
                <rect key={n} x={b.x1} y={b.y} width={b.x2 - b.x1} height={b.h} rx={Math.min(6, b.h / 2)} className="lt-chassis" />
              ))}
            </g>
          )}

          {/* รถหัว — ตู้ + หัวเก๋ง */}
          <g className="lt-body" style={{ transform: `translateY(${sinkOf(head)}px)` }}>
            {boxOf("head").map((b, n) => (
              <g key={n}>{cargo(b, unitPct("head"), hasTail ? head : lf, b.label || headLabel, `${uid}clipH${n}`)}</g>
            ))}
            {L.bars.filter((b) => b.unit === "head").map((b, n) => (
              <rect key={n} x={b.x1} y={b.y} width={b.x2 - b.x1} height={b.h} rx={Math.min(6, b.h / 2)} className="lt-chassis" />
            ))}
            {L.fifth && <rect x={292} y={206} width={96} height={8} rx={3} className="lt-chassis" />}
            {L.cab === "truck" ? (
              <>
                <path d="M418 232V96Q418 82 432 82H508Q522 82 531 94L570 150Q578 161 578 175V220Q578 232 566 232Z" className="lt-cab" />
                <path d="M418 196H578V220Q578 232 566 232H418Z" className="lt-cab-low" />
                <path d="M436 98H502Q510 98 515 105L545 148H436Z" className="lt-glass" />
                <path d="M470 98L452 148H462L480 98Z" fill="rgba(255,255,255,.45)" />
                <path d="M430 92V192H528" fill="none" className="lt-door" />
                <rect x={500} y={160} width={18} height={5} rx={2.5} className="lt-handle" />
                <rect x={552} y={112} width={8} height={30} rx={3} className="lt-chassis" />
                <rect x={566} y={178} width={14} height={14} rx={4} className="lt-lamp" />
                <rect x={560} y={220} width={30} height={16} rx={5} className="lt-tire" />
                <rect x={436} y={204} width={28} height={6} rx={3} className="lt-chassis" />
              </>
            ) : (
              <>
                {/* ปิกอัพ: หัวเก๋งเตี้ย มีฝากระโปรงหน้า */}
                <path d="M432 232V132Q432 118 446 118H498Q510 118 518 128L546 162H566Q580 162 580 176V220Q580 232 568 232Z" className="lt-cab" />
                <path d="M432 200H580V220Q580 232 568 232H432Z" className="lt-cab-low" />
                <path d="M446 132H496Q502 132 506 138L528 162H446Z" className="lt-glass" />
                <path d="M476 132L462 162H470L484 132Z" fill="rgba(255,255,255,.45)" />
                <path d="M442 126V196H530" fill="none" className="lt-door" />
                <rect x={500} y={176} width={18} height={5} rx={2.5} className="lt-handle" />
                <rect x={566} y={182} width={14} height={12} rx={4} className="lt-lamp" />
                <rect x={560} y={220} width={30} height={14} rx={5} className="lt-tire" />
              </>
            )}
          </g>

          {L.axles.map((a, n) => wheel(n, a))}
        </svg>
      </div>
  );
  if (bare) return stage;

  return (
    <div className="card lt-card">
      <div className="card-h">
        <h2>สถานะการบรรทุก</h2>
        <span className="hint">{hint}</span>
      </div>

      {stage}

      <div className="lt-barhead"><span>หลอด Load Factor</span><span>{basis}</span></div>
      <div className="lt-bar"><i className={"lt-bar-fill" + tone(lf)} style={{ width: `${barPct}%` }} /></div>

      <div className={"dispatch-load" + (over ? " over" : "")}>{children}</div>
    </div>
  );
}

const kg = (v: number): string => Math.round(v).toLocaleString("th-TH");
const m3 = (v: number): string => v.toLocaleString("th-TH", { maximumFractionDigits: 3 });

/**
 * แผงขวาของหน้าจัดรถ (เลย์เอาต์ตามภาพที่เจ้าของงานส่ง 27 ก.ย. 2569): หัว "จัดรถ" + Load Factor ตัวใหญ่ ·
 * รูปรถ (LoadTruck bare) · มิเตอร์น้ำหนัก/ปริมาตร 2 ใบ · ข้อความสรุป/คำเตือนชุดเดิมทุกตัวอักษร
 * stats = null คือยังไม่ได้เลือกรถ
 */
export function LoadTruckPanel({ stats, load, headCap, tailCap, truckPlate, trailerPlate, kind, fleetType, trailerKind,
  hasLoad, noTruckText, noLoadText, overText, title, sub, picker, pictureKind }: {
  stats: LoadStats | null; load: Load; headCap: Cap; tailCap: Cap | null;
  truckPlate: string; trailerPlate: string; kind: string; fleetType: string; trailerKind: string;
  /** มีของให้คิดแล้วหรือยัง (หน้าจัดรถ = ติ๊กบิลแล้ว) */
  hasLoad: boolean;
  noTruckText: string; noLoadText: string; overText: string;
  /** หัวแผง เช่น "จัดรถ" · บรรทัดรอง (วันปล่อยรถ · จำนวนบิล · น้ำหนัก) */
  title: string; sub: ReactNode;
  /** ช่องเลือกรถ (ขั้นที่ 2) วางแนวยาวระหว่างหัวแผงกับรูปรถ (เจ้าของงานสั่ง 27 ก.ย. 2569) */
  picker?: ReactNode;
  /** ชนิดรถที่เลือกในช่อง (ยังไม่ต้องเลือกทะเบียน) — มีรูปของชนิดนั้น = ใช้รูป (TruckPicture)
   *  · มีหางพ่วง/ไม่มีรูป = รูปวาดที่ทรงเปลี่ยนตามชนิดรถ (truckShape) เพราะวาดหัว + หางแยกตู้ได้ */
  pictureKind?: string;
}) {
  const over = !!stats && (stats.overWeight || stats.overVolume);
  const lf = stats ? stats.loadFactor : 0;
  const meter = (label: string, use: number, text: string) => (
    <div className={"dp-meter" + (use > 1 ? " over" : "")}>
      <div className="dp-meter-h"><b>{label}</b><span className="num-fd" key={use.toFixed(3)}>{(use * 100).toFixed(1)}%</span></div>
      <div className="dp-meter-bar"><i style={{ width: `${Math.min(100, use * 100)}%` }} /></div>
      <small>{text}</small>
    </div>
  );
  return (
    <div className="dp-stage">
      <div className="dp-stage-h">
        <div>
          <h2>{title}</h2>
          <div className="dp-stage-sub">{sub}</div>
          <div className="dp-stage-truck">
            {stats ? `${truckPlate} · ${kind} (${fleetType})${tailCap ? ` + หาง ${trailerPlate}` : ""}` : "ยังไม่ได้เลือกรถ"}
          </div>
        </div>
        <div className={"dp-lf" + (over ? " over" : stats && lf >= 95 ? " full" : "")}>
          <span>Load Factor{stats && hasLoad ? ` · คิดจากฝั่ง${stats.binding}` : ""}</span>
          <b className="num-fd" key={lf.toFixed(1)}>{lf.toFixed(1)}%</b>
        </div>
      </div>

      {picker && <div className="dp-pick">{picker}</div>}

      {pictureKind && stats?.tail == null && hasTruckPicture(pictureKind)
        ? <div className="lt-stage"><TruckPicture kind={pictureKind} lf={lf} /></div>
        : <LoadTruck bare hint="" lf={lf} head={stats?.head ?? 0} tail={stats?.tail ?? null} basis="" over={over}
            headKind={pictureKind ?? kind} tailKind={tailCap ? trailerKind : ""} />}

      <div className="dp-meters">
        {meter("น้ำหนัก", stats?.useWeight ?? 0, `${kg(load.weight)} / ${stats ? kg(stats.capKg) : "–"} กก.`)}
        {meter("ปริมาตร", stats?.useVolume ?? 0, `${m3(load.volume)} / ${stats ? m3(stats.capM3) : "–"} ลบ.ม.`)}
      </div>

      <div className={"dispatch-load" + (over ? " over" : "")}>
        {!stats ? (
          <div className="lf">ยังไม่ได้เลือกรถ <small>— {noTruckText}</small></div>
        ) : (
          <>
            <div className="lf"><small>{over ? "เกินความจุรถ"
              : !hasLoad ? noLoadText
              : stats.loadFactor >= 95 ? "เต็มคันพอดี"
              : `ยังว่างอยู่ ${(100 - stats.loadFactor).toFixed(1)}%`}{tailCap ? " · ความจุหัว + หางพ่วง" : ""}</small></div>
            {tailCap && (
              <div className="cap">
                หัว {truckPlate} {kg(headCap.kg)} กก. / {m3(headCap.m3)} ลบ.ม. +
                หาง {trailerPlate} {kg(tailCap.kg)} กก. / {m3(tailCap.m3)} ลบ.ม.
              </div>
            )}
            {over && <div className="bill-bad">⚠ {overText}</div>}
            {headCap.kg === 0 && headCap.m3 === 0 && (
              <div className="bill-bad">⚠ ยังไม่มีสเปกความจุของ "{kind}" ในระบบ — ตั้งค่าได้ที่หน้าการตั้งค่า</div>
            )}
            {tailCap && tailCap.kg === 0 && tailCap.m3 === 0 && (
              <div className="bill-bad">⚠ ยังไม่มีสเปกความจุของหาง "{trailerKind}" ในระบบ — ตั้งค่าได้ที่หน้าการตั้งค่า</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
