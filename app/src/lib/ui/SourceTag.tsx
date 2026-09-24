/**
 * ป้ายชุดข้อมูลของส่วนย่อยในหน้า — ใช้กับส่วนที่อ่านคนละชุดกับหัวแดชบอร์ด (เจ้าของงานสั่ง 24 ก.ย. 2569)
 *
 * ขึ้นเฉพาะเมื่อชุดของส่วนนี้ **ไม่ตรงกับป้ายที่หัว** — ตรงกันก็ไม่ต้องบอกซ้ำ (ทั้งคู่จริงหน้าจะสะอาดเหมือนเดิม)
 *   ส่วนนี้ตัวอย่าง · หัวจริง   → "ข้อมูลตัวอย่าง" สีเดียวกับชิปที่หัว
 *   ส่วนนี้จริง · หัวตัวอย่าง   → "ข้อมูลจริง" (ไม่งั้นผู้ใช้จะเหมาว่าทั้งหน้าเป็นตัวอย่าง)
 *   หัวยังไม่รู้ (ชุดของหน้าโหลดไม่ขึ้น) → ขึ้นเฉพาะตอนส่วนนี้เป็นตัวอย่าง
 */
import { useShellSample } from "./dashContext";

export default function SourceTag({ sample, what, block }: {
  /** undefined = ส่วนนี้ยังโหลดไม่เสร็จ → ไม่แสดง */
  sample: boolean | undefined;
  /** ชื่อชุด/ส่วนที่ป้ายหมายถึง เช่น "ไฟล์ Load Factor" */
  what: string;
  /** วางเป็นบรรทัดของตัวเองเหนือเนื้อหา — ไม่แสดงก็ไม่ทิ้งช่องว่างไว้ */
  block?: boolean;
}) {
  const head = useShellSample();
  if (sample === undefined) return null;
  const show = head === undefined ? sample : sample !== head;
  if (!show) return null;
  const tag = (
    <span className={"src-tag" + (sample ? " sample" : " real")}>
      <i aria-hidden="true" />
      {sample ? "ข้อมูลตัวอย่าง" : "ข้อมูลจริง"} · {what}
    </span>
  );
  return block ? <div className="src-row">{tag}</div> : tag;
}
