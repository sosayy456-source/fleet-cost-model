/**
 * กล่อง "สถานะการบรรทุก" ของหน้าจัดรถ — รูปรถเติมของตาม Load Factor ของบิลที่ติ๊ก (เจ้าของงานส่งแบบ
 * "Truck Load Factor (standalone).html" 24 ก.ย. 2569) · ใช้สี/ฟอนต์ของโมเดล ไม่ใช่ของไฟล์ต้นแบบ
 *
 * มีหางพ่วง = วาดหางต่อท้ายรถ แล้วเติมตู้หัวก่อน ล้นไปตู้หาง (splitLoad) · หลอดกับตัวเลขใต้รูปเป็น Load Factor รวม
 * ตัวเลขในตู้นับขึ้นทีละเฟรม ล้อหมุนตลอด — ปิดทั้งคู่เมื่อผู้ใช้ตั้ง prefers-reduced-motion
 * ข้อความสรุป/คำเตือนใต้หลอดมาจากหน้าจัดรถ (children) ที่นี่แค่วาดกรอบให้
 */
import { useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { Load, LoadStats } from "../../lib/dispatch/load";
import type { Cap } from "../../lib/dispatch/loadSplit";

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
  children: ReactNode;
}

const reducedMotion = (): boolean =>
  typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** สีของที่เติม: เกิน 100% แดง · ตั้งแต่ 95% เขียว (เต็มคันพอดี) · นอกนั้นสีหลักของโมเดล */
const tone = (pct: number): string => (pct > 100 ? " over" : pct >= 95 ? " full" : "");
/** สีของในตู้: ยังไม่เต็ม = เหลือง · เต็ม (≥ 95% เกณฑ์เดียวกับ "เต็มคันพอดี") หรือล้น = แดง (เจ้าของงานสั่ง 24 ก.ย. 2569) */
const isFull = (pct: number): boolean => pct >= 95;
/** รถยุบลงตามน้ำหนัก (หน่วยของ viewBox) — เหมือนไฟล์ต้นแบบ */
const sinkOf = (pct: number): number => Math.min(100, pct) * 0.06;

export default function LoadTruck({ hint, lf, head, tail, basis, over, children }: Props) {
  const uid = useId().replace(/:/g, "");
  const [reduced] = useState(reducedMotion);
  const [shown, setShown] = useState({ lf: 0, head: 0, tail: 0 });
  const shownRef = useRef(shown);
  shownRef.current = shown;
  const wheels = useRef<(SVGGElement | null)[]>([]);
  const hasTail = tail != null;

  // ตัวเลข % นับขึ้น/ลงไปหาค่าใหม่ใน 0.7 วิ (ease-out)
  useEffect(() => {
    const target = { lf, head, tail: tail ?? 0 };
    if (reduced) { setShown(target); return; }
    const from = shownRef.current;
    const t0 = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / 700);
      const e = 1 - (1 - p) ** 3;
      setShown({
        lf: from.lf + (target.lf - from.lf) * e,
        head: from.head + (target.head - from.head) * e,
        tail: from.tail + (target.tail - from.tail) * e,
      });
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

  const wheel = (i: number, cx: number) => (
    <g key={i} ref={(el) => { wheels.current[i] = el; }} style={{ transformOrigin: `${cx}px 248px` }}>
      <circle cx={cx} cy={248} r={30} className="lt-tire" />
      <circle cx={cx} cy={248} r={17} className="lt-hub" />
      <circle cx={cx} cy={248} r={6} className="lt-bolt" />
      <circle cx={cx} cy={237} r={2.5} className="lt-bolt" />
      <circle cx={cx + 10.5} cy={251} r={2.5} className="lt-bolt" />
      <circle cx={cx - 10.5} cy={251} r={2.5} className="lt-bolt" />
    </g>
  );
  const arch = (cx: number) => `M${cx - 42} 236A42 42 0 0 1 ${cx + 42} 236Z`;

  /** ตู้สินค้าหนึ่งตู้ — กรอบ + ของที่เติม (scaleY จากพื้นตู้) + ตัวเลข % กลางตู้ */
  const cargo = (x: number, w: number, pct: number, shownPct: number, label: string, clipId: string) => (
    <>
      <rect x={x - 8} y={26} width={w + 16} height={194} rx={14} className="lt-frame" />
      <rect x={x} y={34} width={w} height={178} rx={10} className="lt-inner" />
      <clipPath id={clipId}><rect x={x} y={34} width={w} height={178} rx={10} /></clipPath>
      <g clipPath={`url(#${clipId})`}>
        <g className="lt-fillg" style={{ transform: `scaleY(${Math.min(100, pct) / 100})`, transformOrigin: "0 212px" }}>
          <rect x={x} y={34} width={w} height={178} className={"lt-fill" + (isFull(pct) ? " full" : "")} />
          <rect x={x} y={34} width={w} height={178} fill={`url(#${uid}crates)`} />
          <rect x={x} y={34} width={w} height={4} fill="rgba(255,255,255,.35)" />
        </g>
      </g>
      <rect x={x - 8} y={26} width={w + 16} height={10} rx={5} className="lt-rail" />
      {/* ตัวหนังสือขาวเฉพาะบนพื้นแดง — บนพื้นเหลืองขาวอ่านไม่ออก ใช้สีเข้มตามเดิม */}
      <text x={x + w / 2} y={128} textAnchor="middle" className={"lt-pct" + (shownPct > 55 && isFull(pct) ? " on" : "")}>
        {Math.round(shownPct)}%
      </text>
      <text x={x + w / 2} y={152} textAnchor="middle" className={"lt-cap" + (shownPct > 55 && isFull(pct) ? " on" : "")}>{label}</text>
    </>
  );

  // ไม่มีหาง = กรอบเท่าไฟล์ต้นแบบ · มีหาง = ขยายไปทางซ้ายให้หางต่อท้าย
  const x0 = hasTail ? -340 : 0;
  const barPct = Math.min(100, lf);

  return (
    <div className="card lt-card">
      <div className="card-h">
        <h2>สถานะการบรรทุก</h2>
        <span className="hint">{hint}</span>
      </div>

      <div className="lt-stage">
        <svg viewBox={`${x0} 0 ${600 - x0} 300`} className="lt-svg" role="img"
          aria-label={`Load Factor ${lf.toFixed(1)}%`}>
          <defs>
            <pattern id={`${uid}crates`} width={47} height={36} patternUnits="userSpaceOnUse" x={24} y={212}>
              <rect x={3} y={3} width={41} height={30} rx={3} fill="rgba(255,255,255,.07)" stroke="rgba(255,255,255,.18)" strokeWidth={1.5} />
              <path d="M3 18H44" stroke="rgba(255,255,255,.12)" strokeWidth={1.5} />
            </pattern>
          </defs>
          <ellipse cx={(x0 + 600) / 2} cy={278} rx={(600 - x0) / 2 - 10} ry={10} className="lt-shadow" />
          <path d={`M${x0} 280H600`} className="lt-ground" />
          <path d={[arch(100), arch(182), arch(494), ...(hasTail ? [arch(-262), arch(-80)] : [])].join("")} className="lt-tire" />

          {/* หางพ่วง — ต่อท้ายด้วยคานลาก */}
          {tail != null && (
            <g className="lt-body" style={{ transform: `translateY(${sinkOf(tail)}px)` }}>
              {cargo(-320, 296, tail, shown.tail, "ตู้หาง", `${uid}clipT`)}
              <rect x={-332} y={218} width={320} height={16} rx={6} className="lt-chassis" />
              <rect x={-16} y={222} width={34} height={6} rx={3} className="lt-chassis" />
            </g>
          )}

          {/* รถหัว — ตู้ + หัวเก๋ง (รูปตามไฟล์ต้นแบบ) */}
          <g className="lt-body" style={{ transform: `translateY(${sinkOf(head)}px)` }}>
            {cargo(24, 376, head, hasTail ? shown.head : shown.lf, hasTail ? "ตู้หัว" : "LOAD FACTOR", `${uid}clipH`)}
            <path d="M392 78.5H400M392 123H400M392 167.5H400" className="lt-tick" />
            <rect x={12} y={218} width={556} height={16} rx={6} className="lt-chassis" />
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
          </g>

          {wheel(0, 100)}
          {wheel(1, 182)}
          {wheel(2, 494)}
          {hasTail && wheel(3, -262)}
          {hasTail && wheel(4, -80)}
        </svg>
      </div>

      <div className="lt-barhead"><span>หลอด Load Factor</span><span>{basis}</span></div>
      <div className="lt-bar"><i className={"lt-bar-fill" + tone(lf)} style={{ width: `${barPct}%` }} /></div>

      <div className={"dispatch-load" + (over ? " over" : "")}>{children}</div>
    </div>
  );
}

const kg = (v: number): string => Math.round(v).toLocaleString("th-TH");
const m3 = (v: number): string => v.toLocaleString("th-TH", { maximumFractionDigits: 3 });

/**
 * กล่องสถานะการบรรทุกพร้อมข้อความสรุป/คำเตือน — ใช้ร่วมหน้า "จัดรถ" กับส่วน Fleet Coordinator ของ "บันทึกข้อมูลรวม"
 * (ย้ายข้อความมาจาก DispatchPage.tsx ให้สองหน้าเหมือนกันทุกตัวอักษร) · stats = null คือยังไม่ได้เลือกรถ
 */
export function LoadTruckPanel({ stats, load, headCap, tailCap, truckPlate, trailerPlate, kind, fleetType, trailerKind,
  hasLoad, noTruckText, noLoadText, overText }: {
  stats: LoadStats | null; load: Load; headCap: Cap; tailCap: Cap | null;
  truckPlate: string; trailerPlate: string; kind: string; fleetType: string; trailerKind: string;
  /** มีของให้คิดแล้วหรือยัง (หน้าจัดรถ = ติ๊กบิลแล้ว) */
  hasLoad: boolean;
  noTruckText: string; noLoadText: string; overText: string;
}) {
  const over = !!stats && (stats.overWeight || stats.overVolume);
  return (
    <LoadTruck
      hint={stats ? `${truckPlate} · ${kind} (${fleetType})${tailCap ? ` + หาง ${trailerPlate}` : ""}` : "ยังไม่ได้เลือกรถ"}
      lf={stats ? stats.loadFactor : 0} head={stats?.head ?? 0} tail={stats?.tail ?? null}
      basis={stats && hasLoad ? `คิดจากฝั่ง${stats.binding}` : ""}
      over={over}>
      {!stats ? (
        <div className="lf">ยังไม่ได้เลือกรถ <small>— {noTruckText}</small></div>
      ) : (
        <>
          <div className="lf">Load Factor <b>{stats.loadFactor.toFixed(1)}%</b>
            <small> {over ? "เกินความจุรถ"
              : !hasLoad ? noLoadText
              : stats.loadFactor >= 95 ? "เต็มคันพอดี"
              : `ยังว่างอยู่ ${(100 - stats.loadFactor).toFixed(1)}%`}{tailCap ? " · ความจุหัว + หางพ่วง" : ""}</small></div>
          <div className="cap">
            น้ำหนัก {kg(load.weight)} / {kg(stats.capKg)} กก. ({(stats.useWeight * 100).toFixed(1)}%) ·
            ปริมาตร {m3(load.volume)} / {m3(stats.capM3)} ลบ.ม. ({(stats.useVolume * 100).toFixed(1)}%)
          </div>
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
    </LoadTruck>
  );
}
