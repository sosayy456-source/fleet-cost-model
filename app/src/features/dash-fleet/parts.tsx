/**
 * ชิ้นส่วนหน้าตาของแดชบอร์ด — ตรงกับคลาสที่ index.html บน main ใช้
 * แยกไฟล์ไว้เพราะทั้ง 6 แท็บใช้ร่วมกัน และจะได้ไม่ปนกับตรรกะการคำนวณ
 */
import { useRef } from "react";
import type { ReactNode, RefObject } from "react";
import { useCountUp } from "../../lib/chart/dashfx";

/** เส้นประกอบในการ์ดเด่น — เป็นลายตกแต่ง ไม่ใช่ข้อมูลจริง (ตรงตาม main) */
export const SPARK = (
  <svg className="spark" viewBox="0 0 120 40" preserveAspectRatio="none" aria-hidden="true">
    <polyline points="0,32 15,26 30,29 45,18 60,22 75,12 90,15 105,6 120,9" />
  </svg>
);

/** การ์ดเด่นพื้นไล่สี — หนึ่งใบต่อแท็บ ยกเว้นแท็บหลักที่มีสามใบ */
export function Hero({ kind, l, v, s }: {
  kind: "rev" | "cost" | "profit" | "loss" | "cust" | "fleet" | "svc";
  l: string; v: string; s?: ReactNode;
}) {
  return (
    <div className={`dz-kc hero ${kind}`}>
      <div className="l">{l}</div>
      <div className="v">{v}</div>
      {s && <div className="s">{s}</div>}
      {SPARK}
    </div>
  );
}

/** การ์ดตัวเลขธรรมดา — จุดสีหน้าป้ายมาจากตัวแปร --dot เหมือน main */
export function KC({ l, v, s, dot, tone, small, bar }: {
  l: string; v: string; s?: ReactNode;
  dot?: string;
  tone?: "good" | "warn" | "bad";
  /** ค่าที่เป็นข้อความ (ชื่อลูกค้า) main ย่อเหลือ 14px */
  small?: boolean;
  /** แถบตกแต่งใต้ตัวเลข — main ใส่ไว้สองใบในแท็บกองรถ */
  bar?: string;
}) {
  return (
    <div className={"dz-kc" + (tone ? ` t-${tone}` : "")}
      style={dot ? ({ "--dot": dot } as React.CSSProperties) : undefined}>
      <div className="l">{dot && <i className="d" />}{l}</div>
      <div className="v" style={small ? { fontSize: 14 } : undefined}>{v}</div>
      {s && <div className="s">{s}</div>}
      {bar && <div className="kbar"><i style={{ background: bar }} /></div>}
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
export const Note = ({ children }: { children: ReactNode }) => <div className="dz-note">{children}</div>;

/** ช่องตัวกรองหนึ่งช่อง */
export function FF({ label, value, onChange, children }: {
  label: string; value: string;
  onChange: (v: string) => void;
  children: ReactNode;
}) {
  return (
    <div className="ff">
      <label>{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}>{children}</select>
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
  fontFamily: "inherit", fontSize: 13, padding: "8px 11px",
  border: "1px solid var(--border)", borderRadius: 9, minWidth: 260,
};
export const selectStyle: React.CSSProperties = {
  fontFamily: "inherit", fontSize: 13, padding: "7px 9px",
  border: "1px solid var(--border)", borderRadius: 8,
};

/**
 * ห่อเนื้อหาของแท็บหนึ่ง แล้วสั่งให้ตัวเลขในการ์ดนับขึ้นใหม่ทุกครั้งที่ข้อมูลเปลี่ยน
 * (main เรียก countUp() ท้าย render ของทุกแท็บ)
 */
export function Pane({ deps, children }: { deps: unknown[]; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useCountUp(ref as RefObject<HTMLElement | null>, deps);
  return <div ref={ref}>{children}</div>;
}
