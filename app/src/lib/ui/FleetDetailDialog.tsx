import { useEffect, useId, useRef, type ReactNode } from "react";

/** ใช้ dialog มาตรฐานเพื่อกักโฟกัส รองรับ Esc และคืนโฟกัสให้ปุ่มที่เปิด */
export default function FleetDetailDialog({ title, children, onClose }: {
  title: string; children: ReactNode; onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const dialog = ref.current!;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  return <dialog ref={ref} className="fleet-detail-dialog" aria-labelledby={id}
    onCancel={(event) => { event.preventDefault(); onClose(); }}>
    <div className="sm-mh">
      <h3 id={id} className="sm-mt">{title}</h3>
      <button type="button" className="btn-ghost" onClick={onClose} autoFocus aria-label="ปิดรายละเอียด">ปิด ✕</button>
    </div>
    {children}
  </dialog>;
}
