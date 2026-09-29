/**
 * ช่องต้นทาง/ปลายทาง — พิมพ์เองได้ · กดแล้วเลือกจากรายการได้ · พิมพ์แล้วรายการแนะนำกรองตามตัวอักษร (datalist ของเบราว์เซอร์)
 * กรองแบบ "มีคำนี้" จึงพิมพ์บางส่วนก็ได้ · ปุ่ม × ล้างช่อง
 * ใช้ที่ตาราง "ต้นทุนขนส่งแต่ละชนิดรถ" (Item3Tab) + ตาราง "จัดอันดับเส้นทาง" (RouteProfitTab) — สองตารางอยู่หน้าเดียวกัน
 * `id` ของ datalist จึงต้องไม่ซ้ำกัน (ส่ง `listId` มาเอง)
 */
export default function PlaceInput({ label, value, onChange, opts, listId }: {
  label: string; value: string; onChange: (v: string) => void; opts: string[]; listId: string;
}) {
  return (
    <span className="i3-place">
      <input type="text" list={listId} value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={`${label} (พิมพ์หรือเลือก)`} aria-label={label} autoComplete="off" />
      {value && <button type="button" className="i3-clear" onClick={() => onChange("")} aria-label={`ล้าง${label}`}>×</button>}
      <datalist id={listId}>{opts.map((o) => <option key={o} value={o} />)}</datalist>
    </span>
  );
}
