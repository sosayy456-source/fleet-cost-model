/**
 * สถานะรวมทุกงาน ETL ในรอบเดียว — plugin autoEtl (vite.config.ts) เรียก แล้วส่งเป็น event "all:status"
 * (เจ้าของงานขอ 26 ก.ย. 2569: หัว Executive Dashboard เห็นแค่งานต้นทุน+รายได้ พองานนั้นเสร็จแถบก็หาย
 *  ทั้งที่งานปันส่วนกำไรลูกค้ารันต่ออีกนาน และแถบของมันอยู่ท้ายหน้า)
 *
 * "รอบ" = ตั้งแต่มีงานแรกเข้า running จนทุกงานในรอบจบ และไม่มีงานรันอยู่/รอคิว
 * % รวม = ถ่วงน้ำหนักตามเวลาโดยประมาณของแต่ละงาน (WEIGHT) × % ของงานนั้น (etl/src/progress.py)
 *
 * ★ ไฟล์นี้ vite.config.ts import ตอนโหลด config — ห้าม import อะไรที่ใช้ได้แค่ในเบราว์เซอร์
 */

export type EtlJob = "rev" | "cr" | "al" | "db" | "lf";

export interface JobStatus {
  state: "idle" | "running" | "done" | "error" | "cleared";
  message: string;
  at: number;
  pct?: number;
  step?: string;
}

const ORDER: EtlJob[] = ["rev", "cr", "al", "db", "lf"];
const LABEL: Record<EtlJob, string> = {
  rev: "ไฟล์รายได้ (build_json)", cr: "ต้นทุน+รายได้รายเที่ยว", al: "กำไรลูกค้า (ปันส่วนต้นทุน)",
  db: "ลูกหนี้", lf: "Load Factor",
};
/** เวลาโดยประมาณเทียบกัน — ปันส่วนอ่านไฟล์บิล 3 รอบ (รอบ 2–3 จากแคช) ลูกหนี้/LF ไฟล์เล็ก */
const WEIGHT: Record<EtlJob, number> = { rev: 1, cr: 1, al: 1.5, db: 0.3, lf: 0.3 };

export class EtlBatch {
  private batch = new Set<EtlJob>();
  private finished = new Set<EtlJob>();
  private batchAt = 0;
  status: JobStatus = { state: "idle", message: "", at: Date.now() };

  /**
   * job = งานที่สถานะเพิ่งเปลี่ยน · null = แค่คิดใหม่ (ตอนคิวว่าง — งานสุดท้ายแจ้ง done ตอนยังนับว่า busy อยู่)
   * คืนสถานะรวมใหม่ หรือ null ถ้าไม่มีรอบที่ต้องบอก
   */
  update(job: EtlJob | null, all: Record<EtlJob, JobStatus>, busy: EtlJob | null, queued: boolean,
    now = Date.now()): JobStatus | null {
    const st = job ? all[job].state : "idle";
    if (job && st === "running") {
      if (!this.batch.size) { this.batchAt = now; this.finished.clear(); }
      this.batch.add(job);
      this.finished.delete(job);
    } else if (job && this.batch.has(job) && st !== "idle") {
      this.finished.add(job);
    }
    if (!this.batch.size) return null;

    const jobs = ORDER.filter((j) => this.batch.has(j));
    const total = jobs.reduce((a, j) => a + WEIGHT[j], 0);
    const doneW = jobs.reduce((a, j) => a + WEIGHT[j] * (this.finished.has(j) ? 1 : (all[j].pct ?? 0) / 100), 0);
    const pct = Math.min(100, Math.floor((100 * doneW) / total));

    if (jobs.every((j) => this.finished.has(j)) && !busy && !queued) {
      const failed = jobs.filter((j) => all[j].state === "error");
      const cleared = jobs.every((j) => all[j].state === "cleared");
      this.status = cleared
        ? { state: "cleared", message: "ไม่มีไฟล์ข้อมูลจริงแล้ว — กลับไปใช้ข้อมูลตัวอย่าง", at: now }
        : failed.length
          ? { state: "error", message: `แปลงไม่สำเร็จ: ${failed.map((j) => LABEL[j]).join(" · ")} — ดูรายละเอียดใน terminal ของ dev server`, at: now }
          : { state: "done", message: `ข้อมูลจริงพร้อมแล้วครบ ${jobs.length} งาน`, at: now };
      this.batch.clear();
      this.finished.clear();
      return this.status;
    }

    const cur = busy && this.batch.has(busy) ? busy : jobs.find((j) => !this.finished.has(j)) ?? jobs[0]!;
    // งานที่รันอยู่บอกขั้นจาก python · งานที่ยังรอคิว/รอคัดลอกใช้ข้อความสถานะของมัน
    const step = busy === cur ? all[cur].step : all[cur].message;
    const order = jobs.map((j) => (this.finished.has(j) ? "✓ " : j === cur ? "▶ " : "") + LABEL[j]).join(" → ");
    this.status = {
      state: "running", at: this.batchAt, pct,
      message: `กำลังแปลงข้อมูลจริง งานที่ ${jobs.indexOf(cur) + 1}/${jobs.length} · ${LABEL[cur]}`,
      step: jobs.length > 1 ? [step, `ลำดับ: ${order}`].filter(Boolean).join(" · ") : step,
    };
    return this.status;
  }
}
