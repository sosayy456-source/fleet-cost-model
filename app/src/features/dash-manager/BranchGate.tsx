/** เลือกสาขาหลังเข้าหน้า Manager Dashboard — dialog ทำให้หน้าด้านหลังรับโฟกัสและคลิกไม่ได้ */
import { useEffect, useRef, useState } from "react";
import BranchPick from "./BranchPick";

export default function BranchGate({ onPick, onBack }: {
  onPick: (branch: string) => void;
  onBack: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [branch, setBranch] = useState("");

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    el.showModal();
    return () => { if (el.open) el.close(); };
  }, []);

  return (
    <dialog ref={dialog} className="mg-branch-dialog" aria-labelledby="mg-branch-title"
      onCancel={(e) => e.preventDefault()}>
      <form onSubmit={(e) => { e.preventDefault(); if (branch) onPick(branch); }}>
        <span className="mg-branch-kicker">MANAGER DASHBOARD</span>
        <h2 id="mg-branch-title">เลือกสาขาของคุณ</h2>
        <p>เลือกสาขาที่รับผิดชอบเพื่อดูภาพรวมและรายการของสาขานั้น</p>
        <BranchPick value={branch} onChange={setBranch} />
        <div className="mg-branch-actions">
          <button type="button" className="mg-branch-back" onClick={onBack}>เปลี่ยนหน้าที่</button>
          <button type="submit" className="mg-branch-continue" disabled={!branch}>เข้าสู่แดชบอร์ด →</button>
        </div>
      </form>
    </dialog>
  );
}
