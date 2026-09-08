/**
 * ปุ่มรีเฟรชข้อมูล — ใช้ตัวเดียวกันทุกหน้า เพื่อให้ตำแหน่งและคำอธิบายตรงกันหมด
 *
 * แต่ละหน้าดึงข้อมูลคนละทาง จึงรับ onClick มาจากข้างนอก:
 *   หน้าที่ใช้ใบรายการ (แดชบอร์ด / ใบที่ยังไม่ครบ)  → state.reload ของ useRecords
 *   หน้าที่ใช้ไฟล์จาก ETL (รายได้ / กำไรรายเส้นทาง) → reload ของ useDataset
 *
 * ★ ปุ่มต้องอยู่ในหน้าจอ "ตอนไม่มีข้อมูล" ด้วย ไม่งั้นหน้าที่ยังว่างอยู่จะไม่มีทาง
 *   ดึงข้อมูลเข้ามาได้เลยนอกจากรีโหลดทั้งหน้า
 */
export interface RefreshBtnProps {
  onClick: () => void;
  loading?: boolean;
  /** ข้อความ tooltip — บอกว่ากดแล้วดึงอะไรกลับมา */
  title?: string;
  /** ใช้ "dash-reload" ในหน้าแดชบอร์ด (โทนสีของ #view-dash) */
  className?: string;
}

export default function RefreshBtn({
  onClick, loading = false, title, className = "btn btn-green",
}: RefreshBtnProps) {
  return (
    <button type="button" className={className} onClick={onClick} disabled={loading} title={title}>
      {loading ? "⟳ กำลังโหลด…" : "↻ รีเฟรชข้อมูล"}
    </button>
  );
}
