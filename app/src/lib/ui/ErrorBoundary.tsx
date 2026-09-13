/**
 * กันจอขาว — ถ้าคอมโพเนนต์ไหน throw ตอน render ให้แสดงการ์ดบอกผู้ใช้แทนที่จะดับทั้งแอป
 *
 * React ไม่มี hook สำหรับดักข้อผิดพลาดตอน render ต้องเป็น class component เท่านั้น
 * นี่จึงเป็นไฟล์เดียวในโปรเจกต์ที่ใช้ class
 *
 * วางไว้สองชั้น:
 *   main.tsx  ครอบทั้งแอป — กันกรณีที่โครงหลักพัง
 *   App.tsx   ครอบเฉพาะเนื้อหน้า — เมนูซ้ายยังอยู่ ผู้ใช้เปลี่ยนไปหน้าอื่นต่อได้
 *
 * ★ ต้องรีเซ็ตตัวเองเมื่อเปลี่ยนหน้า (prop resetKey) ไม่งั้นกดเมนูอื่นแล้วยังค้างที่จอ error
 */
import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** เปลี่ยนค่านี้ = ลองแสดงผลใหม่ (ปกติส่งชื่อหน้าปัจจุบันมา) */
  resetKey?: string;
  /** ข้อความบอกว่าพังตรงส่วนไหน */
  where?: string;
}

interface State {
  err: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { err: null };

  static getDerivedStateFromError(err: Error): State {
    return { err };
  }

  componentDidUpdate(prev: Props): void {
    if (this.state.err && prev.resetKey !== this.props.resetKey) this.setState({ err: null });
  }

  componentDidCatch(err: Error, info: ErrorInfo): void {
    // ไม่มีระบบเก็บ log ฝั่งเซิร์ฟเวอร์ อย่างน้อยให้เหลือร่องรอยใน console ให้เปิดดูได้
    console.error("[ErrorBoundary]", this.props.where ?? "", err, info.componentStack);
  }

  render(): ReactNode {
    const { err } = this.state;
    if (!err) return this.props.children;

    return (
      <div className="card">
        <div className="card-h"><h2>หน้านี้แสดงผลไม่สำเร็จ</h2></div>
        <p className="muted">
          {this.props.where ? `เกิดข้อผิดพลาดใน${this.props.where}` : "เกิดข้อผิดพลาดที่ไม่คาดคิด"} ·
          ข้อมูลที่บันทึกไว้แล้วยังอยู่ครบ ไม่ได้หายไปไหน
        </p>
        <pre style={{
          whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 12.5,
          color: "var(--ink-soft)", background: "var(--field-bg)",
          border: "1px solid var(--border)", borderRadius: 12, padding: "12px 14px", margin: "14px 0",
        }}>{err.message || String(err)}</pre>
        <div className="save-row">
          <button className="btn btn-save" type="button" onClick={() => this.setState({ err: null })}>
            ลองแสดงผลใหม่
          </button>
          <button className="btn-ghost" type="button" onClick={() => location.reload()}>
            โหลดหน้าเว็บใหม่ทั้งหมด
          </button>
        </div>
      </div>
    );
  }
}
