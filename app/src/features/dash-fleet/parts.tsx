/**
 * ชิ้นส่วนหน้าตาของแดชบอร์ด — ตรงกับคลาสที่ index.html บน main ใช้
 * แยกไฟล์ไว้เพราะทั้ง 6 แท็บใช้ร่วมกัน และจะได้ไม่ปนกับตรรกะการคำนวณ
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
import { createPortal } from "react-dom";
import { useNumFade } from "../../lib/chart/dashfx";

/** เส้นประกอบในการ์ดเด่น — เป็นลายตกแต่ง ไม่ใช่ข้อมูลจริง (ตรงตาม main) */
export const SPARK = (
  <svg className="spark" viewBox="0 0 120 40" preserveAspectRatio="none" aria-hidden="true">
    <polyline points="0,32 15,26 30,29 45,18 60,22 75,12 90,15 105,6 120,9" />
  </svg>
);

/**
 * เส้นแนวโน้มจริงของการ์ดเด่น (ดีไซน์ 1A) — ย่อชุดตัวเลขลงกรอบ 160×40 ไม่มีแกน
 * น้อยกว่า 2 จุดวาดเส้นไม่ได้ → ไม่แสดง
 */
function Trend({ data }: { data: number[] }) {
  const pts = data.filter((v) => Number.isFinite(v));
  if (pts.length < 2) return null;
  const min = Math.min(...pts), max = Math.max(...pts);
  const span = max - min || 1;
  const W = 160, H = 40;
  const points = pts
    .map((v, i) => `${(i / (pts.length - 1) * W).toFixed(1)},${(H - 3 - (v - min) / span * (H - 6)).toFixed(1)}`)
    .join(" ");
  return (
    <svg className="trend" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
      <polyline points={points} />
    </svg>
  );
}

/**
 * การ์ดเด่นพื้นไล่สี — หนึ่งใบต่อแท็บ ยกเว้นแท็บหลักที่มีสามใบ
 * unit  = ชิปหน่วยมุมขวาบน (ดีไซน์ 1A) · trend = ชุดตัวเลขจริงสำหรับเส้นแนวโน้ม
 * ไม่ส่ง trend → ใช้เส้นตกแต่ง SPARK แบบเดิม (หน้าที่ยังไม่มีชุดข้อมูลรายเดือนให้)
 * vSub  = ตัวเล็กข้างตัวเลขใหญ่ เช่น "(81%)" — อยู่นอก .v เพราะ useNumFade เล่นท่ากับทั้งกล่อง .v
 * onClick/active = การ์ดกดได้ (แท็บกำไรลูกค้าของ Demo ใช้กรองตาราง) — ไม่ส่ง = การ์ดธรรมดา
 * foot  = บรรทัดใต้ชิป s เช่น ยอดกำไรของกลุ่มนั้น (แท็บกำไรลูกค้าของ Demo) — ไม่ส่ง = ไม่มีบรรทัดนี้
 */
/**
 * ตัวเลขใหญ่ของการ์ด Hero ที่มีรูปด้านขวา: ไม่พอ = ย่อตัวเลขทีละ 5% ถึง 60% ให้อยู่ในที่ที่เว้นจากรูป
 * (ข้อมูลจริงหลักแสนเคยลอดไปทับลูกศรของ Customer Performance — เจ้าของงานแจ้ง 1 ต.ค. 2569) · คิดใหม่เมื่อการ์ดเปลี่ยนความกว้าง
 * box = แถวตัวเลข (.vrow) หรือตัวเลขเอง · วัดล้นจาก scrollWidth · ขนาดเดิมอ่านจาก CSS ทุกครั้ง (ล้าง inline ก่อน)
 */
function useFitValue(v: string) {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  // ref callback ต้องคงที่ ไม่งั้น React เรียก null → node ทุก render แล้ว setState วน
  const attach = useCallback((node: HTMLDivElement | null) => setEl(node), []);
  useLayoutEffect(() => {
    const box = el;
    if (!box) return;
    const num = (box.classList.contains("v") ? box : box.querySelector(".v")) as HTMLElement | null;
    if (!num) return;
    // วัดขอบขวาของตัวอักษรจริง (Range) เทียบขอบขวาของกล่อง — scrollWidth ของ flex ที่ห่อบรรทัดไม่นับตัวเลขที่ล้น
    const range = document.createRange();
    const fits = () => {
      range.selectNodeContents(num);
      return range.getBoundingClientRect().right <= box.getBoundingClientRect().right + 1;
    };
    const fit = () => {
      num.style.fontSize = "";
      const base = parseFloat(getComputedStyle(num).fontSize);
      for (let k = 1; k >= 0.6 - 1e-9; k -= 0.05) {
        num.style.fontSize = k < 1 ? `${base * k}px` : "";
        if (fits()) return;
      }
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(box.parentElement ?? box);
    return () => ro.disconnect();
  }, [el, v]);
  return attach;
}

/**
 * บรรทัดล่างของการ์ดที่ CSS บังคับบรรทัดเดียว (white-space:nowrap · .hero-align / การ์ดที่มี note) —
 * ข้อความยาวเกินกล่อง = ย่อตัวอักษรทีละ 5% ถึง 60% · ข้อความที่พออยู่แล้วขนาดเดิม (เจ้าของงานสั่ง 1 ต.ค. 2569)
 * การ์ดอื่นที่ตัดบรรทัดได้ scrollWidth ไม่เกิน clientWidth จึงไม่ถูกย่อ
 */
function useFitText() {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const attach = useCallback((node: HTMLDivElement | null) => setEl(node), []);
  useLayoutEffect(() => {
    if (!el) return;
    const fit = () => {
      el.style.fontSize = "";
      if (el.scrollWidth <= el.clientWidth + 1) return;
      const base = parseFloat(getComputedStyle(el).fontSize);
      for (let k = 0.95; k >= 0.6 - 1e-9; k -= 0.05) {
        el.style.fontSize = `${base * k}px`;
        if (el.scrollWidth <= el.clientWidth + 1) return;
      }
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el.parentElement ?? el);
    const mo = new MutationObserver(fit);
    mo.observe(el, { childList: true, subtree: true, characterData: true });
    return () => { ro.disconnect(); mo.disconnect(); };
  }, [el]);
  return attach;
}

/**
 * ปุ่ม i ของการ์ด Hero — กดกาง/พับคำอธิบาย · กดนอกกล่อง / Esc / เลื่อนหน้า = ปิด · ไม่ส่งคลิกต่อให้การ์ดที่กดได้
 * ★ กล่องข้อความ portal ไป #view-dash (position fixed ใต้ปุ่ม) — การ์ดตัดขอบ (overflow) และตัวเลขใหญ่มี stacking ของตัวเอง
 *   วางไว้ในการ์ดแล้วถูกตัวเลขทับ/ถูกตัดขอบล่าง (เจ้าของงานเจอ 29 ก.ย. 2569) · ไป body ไม่ได้เพราะโทเคนสีอยู่ใต้ #view-dash
 */
function HeroInfo({ text }: { text: ReactNode }) {
  const [at, setAt] = useState<{ top: number; right: number } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!at) return;
    const close = () => setAt(null);
    const off = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!pop.current?.contains(t) && !btn.current?.contains(t)) close();
    };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("mousedown", off);
    document.addEventListener("keydown", esc);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", off); document.removeEventListener("keydown", esc);
      window.removeEventListener("scroll", close, true); window.removeEventListener("resize", close);
    };
  }, [at]);
  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (at) return setAt(null);
    const r = btn.current!.getBoundingClientRect();
    setAt({ top: r.bottom + 8, right: Math.max(8, window.innerWidth - r.right - 4) });
  };
  const host = typeof document !== "undefined" ? document.getElementById("view-dash") ?? document.body : null;
  return (
    <>
      <button type="button" ref={btn} className={"hero-i" + (at ? " on" : "")} aria-expanded={!!at}
        aria-label={at ? "ซ่อนคำอธิบาย" : "ดูคำอธิบาย"} title={at ? "ซ่อนคำอธิบาย" : "ดูคำอธิบาย"} onClick={toggle}>i</button>
      {at && host && createPortal(
        <span className="hero-pop" role="note" ref={pop} style={{ top: at.top, right: at.right }}
          onClick={(e) => e.stopPropagation()}>{text}</span>, host)}
    </>
  );
}

export function Hero({ kind, l, v, s, unit, trend, vSub, onClick, active, foot, title, art, icon, info, note }: {
  /** warn = เหลืองอำพัน (Manager Dashboard: เฝ้าระวัง / ค้าง 1–30 วัน) */
  kind: "rev" | "cost" | "profit" | "loss" | "cust" | "fleet" | "svc" | "warn";
  l: string; v: string; s?: ReactNode;
  unit?: string;
  trend?: number[];
  vSub?: string;
  onClick?: () => void;
  active?: boolean;
  foot?: ReactNode;
  /** tooltip ของทั้งการ์ด */
  title?: string;
  /** ภาพแทนเส้นตกแต่ง SPARK มุมขวาล่าง (การ์ดกำไรของ Executive Dashboard = ลูกศรขึ้น/ลง) */
  art?: ReactNode;
  /** ไอคอน 3 มิติมุมขวาบน **แทนป้ายหน่วย** (Customer Performance · 29 ก.ย. 2569 เจ้าของงานเลือก) — ไม่ส่ง = ป้ายหน่วยตามเดิม */
  icon?: ReactNode;
  /** คำอธิบายซ่อนหลังปุ่ม i มุมขวาบน กดแล้วกางกล่องข้อความ (แทนป้ายหน่วย · Inefficient Cost › LF เฉลี่ย 29 ก.ย. 2569) */
  info?: string;
  /** สูตร/วิธีคิด ซ่อนหลังปุ่ม i มุมขวาล่าง — บรรทัดล่าง (s) แสดงตัวเลขจริงแทน (Overall › Vehicle Utilization · Damage Rate · Utilization Cost · 1 ต.ค. 2569) */
  note?: ReactNode;
}) {
  const cls = `dz-kc hero ${kind}` + (trend ? " has-trend" : "") + (onClick ? " clickable" : "") + (active ? " on" : "");
  const fitBox = useFitValue(v);
  const fitS = useFitText();
  const press = onClick ? {
    role: "button", tabIndex: 0, onClick,
    onKeyDown: (e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } },
    "aria-pressed": !!active,
  } : {};
  return (
    <div className={cls} title={title} {...press}>
      <div className="hh">
        <div className="l">{l}</div>
        {info ? <HeroInfo text={info} /> : icon ? <span className="hero-ic" aria-hidden="true">{icon}</span> : unit && <span className="u">{unit}</span>}
      </div>
      {/* key = ค่าเปลี่ยนแล้วได้กล่องใหม่ ท่า fade-down เล่นใหม่ (useNumFade) */}
      {vSub ? (
        <div className="vrow" ref={art ? fitBox : undefined}>
          <div className="v" key={v} data-real={v}>{v}</div>
          <span className="vs">{vSub}</span>
        </div>
      ) : (
        <div className="v" key={v} data-real={v} ref={art ? fitBox : undefined}>{v}</div>
      )}
      {trend ? (
        <div className="hf">
          {s && <div className="s">{s}</div>}
          {foot && <div className="ft">{foot}</div>}
          <Trend data={trend} />
        </div>
      ) : (
        <>
          {s && <div className="s" ref={fitS}>{s}</div>}
          {foot && <div className="ft">{foot}</div>}
          {art ? <div className="hero-art">{art}</div> : SPARK}
        </>
      )}
      {note && <span className="hero-note"><HeroInfo text={note} /></span>}
    </div>
  );
}

/** การ์ดตัวเลขธรรมดา — จุดสีหน้าป้ายมาจากตัวแปร --dot เหมือน main */
export function KC({ l, v, s, dot, tone, small, bar, onClick, active, icon, unit, note }: {
  l: string; v: string; s?: ReactNode;
  /** หน่วยตัวเล็กต่อท้ายตัวเลข เช่น "บาท/บิล" (Profit Per Route · 29 ก.ย. 2569) */
  unit?: string;
  dot?: string;
  tone?: "good" | "warn" | "bad";
  /** ค่าที่เป็นข้อความ (ชื่อลูกค้า) main ย่อเหลือ 14px */
  small?: boolean;
  /** แถบตกแต่งใต้ตัวเลข — main ใส่ไว้สองใบในแท็บกองรถ */
  bar?: string;
  /** การ์ดกดได้ (หน้าสถานะกองรถใช้กรองตามสถานะ · 26 ก.ย. 2569) — ไม่ส่ง = การ์ดธรรมดา · active = กำลังกรองอยู่ */
  onClick?: () => void;
  active?: boolean;
  /** ไอคอนมุมขวาบน แนวเดียวกับบรรทัดแรก (Executive Dashboard › Profit Per Route · 28 ก.ย. 2569) */
  icon?: ReactNode;
  /** สูตร/วิธีคิด ซ่อนหลังปุ่ม i มุมขวาล่าง (ชุดเดียวกับ Hero note) */
  note?: ReactNode;
}) {
  const fitS = useFitText();
  const press = onClick ? {
    role: "button", tabIndex: 0, onClick, "aria-pressed": !!active,
    onKeyDown: (e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } },
  } : {};
  return (
    <div className={"dz-kc" + (tone ? ` t-${tone}` : "") + (onClick ? " clickable" : "") + (active ? " on" : "")}
      style={dot ? ({ "--dot": dot } as React.CSSProperties) : undefined} {...press}>
      <div className="l">{dot && <i className="d" />}{l}{icon && <span className="kc-ic" aria-hidden="true">{icon}</span>}</div>
      <div className="v" key={v} data-real={v} style={small ? { fontSize: 15.5 } : undefined}>{v}{unit && <span className="u">{unit}</span>}</div>
      {s && <div className="s" ref={note ? fitS : undefined}>{s}</div>}
      {bar && <div className="kbar"><i style={{ background: bar }} /></div>}
      {note && <span className="hero-note"><HeroInfo text={note} /></span>}
    </div>
  );
}

/** กรอบกราฟหนึ่งใบ */
export function CC({ title, tall, children }: { title: string; tall?: boolean; children: ReactNode }) {
  return (
    <div className="dz-cc">
      <h4>{title}</h4>
      <div className={"dz-box" + (tall ? " tall" : "")}>{children}</div>
    </div>
  );
}

/** หัวข้อคั่นกลุ่ม — มีเส้นลากยาวต่อท้ายจาก CSS */
export const ZT = ({ children }: { children: ReactNode }) => <div className="dz-t">{children}</div>;

/** ข้อความอธิบายวิธีคิดใต้ตาราง/กราฟ */
/**
 * คำอธิบาย/วิธีคิดใต้กราฟ ตาราง การ์ด — ยุบไว้หลังปุ่ม ⓘ กดเพื่อกาง กดซ้ำเพื่อพับ
 * (เจ้าของงานสั่ง 28 ก.ย. 2569: คำอธิบายไม่จำเป็นต่อการอ่านตัวเลข ซ่อนไว้ให้หน้าสะอาด แต่ทีมที่ต้องตรวจสูตรยังเปิดดูได้)
 * ★ ข้อความที่ผู้ใช้ต้องเห็นทันที (ไม่มีข้อมูล · error · ต้องรัน ETL) ห้ามใส่ใน Note — ใช้ <p className="dz-note"> ตรง ๆ
 */
export function Note({ children, className }: { children: ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={"dz-note-wrap" + (open ? " open" : "") + (className ? ` ${className}` : "")}>
      <button type="button" className="dz-note-i" aria-expanded={open} onClick={() => setOpen((o) => !o)}
        title={open ? "ซ่อนคำอธิบาย" : "ดูคำอธิบาย"} aria-label={open ? "ซ่อนคำอธิบาย" : "ดูคำอธิบาย"}>
        <svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="7" /><path d="M8 7.2v4.3M8 4.6v.1" /></svg>
      </button>
      {open && <div className="dz-note">{children}</div>}
    </div>
  );
}

/** ช่องตัวกรองหนึ่งช่อง */
export function FF({ label, value, onChange, children, disabled }: {
  label: string; value: string;
  onChange: (v: string) => void;
  children: ReactNode;
  /** ปิดช่องชั่วคราว (แท็บ Damage Rate: ช่วงเดือนเลือกได้เมื่อเลือกปีแล้ว) — ไม่ส่ง = ใช้ได้ตามปกติ */
  disabled?: boolean;
}) {
  return (
    <div className="ff">
      <label>{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}>{children}</select>
    </div>
  );
}

/** ตัวกรอง “แหล่งข้อมูล” — มีเหมือนกันทุกแท็บ */
export function SrcFF({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <FF label="แหล่งข้อมูล" value={value} onChange={onChange}>
      <option value="">ทั้งหมด</option>
      <option value="ใหม่">ข้อมูลใหม่</option>
      <option value="เก่า">ข้อมูลเก่า</option>
    </FF>
  );
}

/** ตัวกรองจากรายการค่าที่มีจริงในข้อมูล — ตรงกับ fillSel() ของ main */
export function ListFF({ label, all, value, onChange, opts }: {
  label: string; all: string; value: string;
  onChange: (v: string) => void; opts: string[];
}) {
  return (
    <FF label={label} value={value} onChange={onChange}>
      <option value="">{all}</option>
      {opts.map((o) => <option key={o} value={o}>{o}</option>)}
    </FF>
  );
}

export const ResetBtn = ({ onClick }: { onClick: () => void }) => (
  <button type="button" className="dz-fbtn" onClick={onClick}>↺ ล้างตัวกรอง</button>
);

export function Empty({ cols, text }: { cols: number; text: string }) {
  return (
    <tr>
      <td colSpan={cols} style={{ textAlign: "center", color: "var(--ink-faint)", padding: 16 }}>{text}</td>
    </tr>
  );
}

/** ช่องค้นหาเหนือตาราง — main ใส่สไตล์ inline ไว้ จึงคัดมาตรง ๆ */
export function TableHead({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                  gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
      <h4 style={{ margin: 0 }}>{title}</h4>
      {children && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>{children}</div>
      )}
    </div>
  );
}

export const searchStyle: React.CSSProperties = {
  fontFamily: "inherit", fontSize: 14.5, padding: "8px 11px",
  border: "1px solid var(--border)", borderRadius: 9, minWidth: 260,
};
export const selectStyle: React.CSSProperties = {
  fontFamily: "inherit", fontSize: 14.5, padding: "7px 9px",
  border: "1px solid var(--border)", borderRadius: 8,
};

/**
 * ห่อเนื้อหาของแท็บหนึ่ง แล้วสั่งให้ตัวเลขในการ์ด fade-down ใหม่ทุกครั้งที่ข้อมูลเปลี่ยน
 * (main เรียก countUp() ท้าย render ของทุกแท็บ — ที่นี่เปลี่ยนท่าเป็น fade-down)
 */
export function Pane({ deps, children }: { deps: unknown[]; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useNumFade(ref as RefObject<HTMLElement | null>, deps);
  return <div ref={ref}>{children}</div>;
}
