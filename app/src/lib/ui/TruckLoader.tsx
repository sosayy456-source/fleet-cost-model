/**
 * ตัวบอกว่า "กำลังบันทึก" — รถบรรทุกเล็ก ๆ สีธีม (--accent) วิ่งอยู่บนถนน
 *
 * ใช้แทนข้อความเปล่า ๆ ตอนรอ HTTP ไปชีต (บันทึกบิล · ยืนยันการจัดรถ · บันทึกข้อมูล) ซึ่งกินเวลาหลายวินาที
 * ตัวรถอยู่กับที่ ขยับแค่ถนน เส้นลม และตัวรถเด้งเบา ๆ — ให้ดูเหมือนวิ่งโดยไม่ต้องเลื่อนตำแหน่งจริง
 * ผู้ใช้ที่ตั้งลดการเคลื่อนไหว (prefers-reduced-motion) จะเห็นรถนิ่ง ๆ พร้อมข้อความ
 * CSS อยู่ในส่วนที่ 2 ของ index.css (`.truck-ld`)
 *
 * `label={null}` = เอาเฉพาะตัวรถ ไม่มีข้อความ — ใช้ต่อท้ายข้อความ "กำลังโหลด…" ที่แต่ละหน้าเขียนไว้เองอยู่แล้ว
 * (เจ้าของงานสั่ง 23 ก.ย. 2569: ห้ามแทนข้อความเดิม ให้ต่อรถไว้ท้ายข้อความ)
 */
export default function TruckLoader({ label = "กำลังบันทึก…" }: { label?: string | null }) {
  return (
    <span className="truck-ld" role="status" aria-live="polite">
      <svg viewBox="0 0 72 30" width="72" height="30" aria-hidden="true">
        {/* เส้นลมด้านหลังรถ */}
        <g className="truck-ld-wind">
          <line x1="2" y1="10" x2="12" y2="10" />
          <line x1="5" y1="15" x2="13" y2="15" />
          <line x1="1" y1="20" x2="10" y2="20" />
        </g>
        <g className="truck-ld-body">
          {/* ตู้สินค้า */}
          <rect x="16" y="5" width="30" height="17" rx="2.5" />
          {/* หัวรถ + กระจก */}
          <path d="M48 10h8.5l5.5 6.5V22H48z" />
          <path className="truck-ld-glass" d="M51 12.5h4.6l3.3 4H51z" />
          {/* ล้อ */}
          <circle className="truck-ld-wheel" cx="24" cy="23.5" r="3.6" />
          <circle className="truck-ld-wheel" cx="55" cy="23.5" r="3.6" />
        </g>
        {/* ถนน — เส้นประเลื่อนไปทางซ้าย */}
        <line className="truck-ld-road" x1="0" y1="28.5" x2="72" y2="28.5" />
      </svg>
      {label && <span className="truck-ld-t">{label}</span>}
    </span>
  );
}
