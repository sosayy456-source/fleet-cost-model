import { useId, useState, type ReactNode } from "react";

/** การ์ดตารางที่พับได้ โดยไม่จองพื้นที่เนื้อหาเมื่อพับ */
export default function SettingsTableCard({ className, title, children }: {
  className: string;
  title: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(true);
  const id = useId();

  return (
    <section className={`card settings-table-card ${className}${open ? " is-open" : ""}`}>
      <button type="button" className="settings-table-toggle" id={`${id}-heading`} title={title}
        aria-expanded={open} aria-controls={`${id}-content`} onClick={() => setOpen((value) => !value)}>
        <span>{title}</span>
        <svg className="chev" width="18" height="18" viewBox="0 0 24 24" fill="none"
          aria-hidden="true" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      <div className="settings-table-content" id={`${id}-content`} hidden={!open}
        role="region" aria-labelledby={`${id}-heading`}>
        {children}
      </div>
    </section>
  );
}
