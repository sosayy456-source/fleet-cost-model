/**
 * แท็บ "ข้อ 2" ของเมนู Demo — การ์ดสรุป 4 กล่อง (เจ้าของงานสั่ง 23 ก.ย. 2569)
 *
 *   1. LF เฉลี่ย                              ┐ ชุด loadfactor/ (ชื่อไฟล์ในปุ่มข้อมูลอ่านจาก manifest)
 *   2. ต้นทุนค่าเสียโอกาสจากการบรรทุกไม่เต็ม   ┘ = Idle Cost
 *   3. % จำนวนเที่ยวเปล่า (เที่ยวเปล่า ÷ เที่ยวทั้งหมด)   ┐ ชุด costrev/ ตามตัวกรองของหน้า · ไม่มี YoY
 *   4. % ต้นทุนเที่ยวเปล่า (Σต้นทุนเปล่า ÷ Σต้นทุนทั้งหมด) ┘ (เจ้าของงานสั่ง 29 ก.ย. 2569 — เดิม % ต้นทุนปีล่าสุด + YoY / มูลค่าต้นทุน)
 *
 * ★ สองชุดข้อมูลคนละไฟล์ คนละตัวหาร — **ห้ามเอาตัวเลขข้ามฝั่งมาหารกัน** เช่นเอา idle ของ loadfactor
 *   ไปหารด้วยต้นทุนของ costrev จำนวนเที่ยวไม่เท่ากัน (ไฟล์ LF กรองสถานะข้อมูลทิ้งไปส่วนหนึ่ง)
 *   การ์ด 1-2 จึงอ้างยอดรวมของฝั่ง LF ส่วน 3-4 อ้างยอดรวมของฝั่งไฟล์ต้นทุน แยกกันชัดเจนในปุ่มข้อมูล
 * ★ ฝั่ง LF โหลดเองด้วย useLoadFactor() — ถ้าชุดนั้นหาย การ์ด 1-2 ขึ้น "–" แต่ 3-4 ยังใช้ได้ ไม่ล้มทั้งแท็บ
 * ★ การ์ด 3-4 ใช้ทุกเที่ยวจากไฟล์ต้นทุน ชุดเดียวกับแท็บเที่ยววิ่งเปล่า
 *   ผู้เรียกส่ง all/trips/tripsAnyYear มาให้
 * ★ สูตร Idle อยู่ใน lib/loadfactor/calc.ts ที่เดียว ห้ามคิดเองในไฟล์นี้
 *
 * ★ กดการ์ด 1-2 → แท็บ "ต้นทุนที่จมกับที่ว่าง" · 3-4 → แท็บ "เที่ยววิ่งเปล่า" ของ Executive Dashboard
 *   (เจ้าของงานสั่ง 23 ก.ย. 2569 · กลไกอยู่ใน lib/ui/dashJump.ts)
 *
 * ★ ตามตัวกรองของหน้า Demo (24 ก.ย. 2569 — รวมเป็นหน้ายาว ตัวกรองชุดเดียวคุมทั้งหน้า · เดิมไม่มีตัวกรอง)
 *   การ์ด 3-4 ผู้เรียกส่งเที่ยวที่กรองครบทุกตัวมาแล้ว · การ์ด 1-2 กรองไฟล์ LF เองด้วย ปี · เดือน · ประเภทรถ · ชนิดรถ
 *   (ไฟล์ LF มีแค่ "เส้นทางมาตรฐาน" ไม่มีต้นทาง/ปลายทางแยก และไม่มีกลุ่มบริการ — FilterScope บอกไว้)
 */
import { useEffect, useMemo, type ReactNode } from "react";
import { useLoadFactor } from "../../lib/data/useLoadFactor";
import { summarize } from "../../lib/loadfactor/calc";
import { EmptyCards } from "../dash-costrev/EmptyHeroes";
import { fmt, pct } from "../dash-costrev/common";
import I2Card from "./I2Card";
// รูป 3 มิติของการ์ด 4 ใบ (เจ้าของงานส่ง 29 ก.ย. 2569 · ตัดจากภาพที่ส่งมา ลบพื้นขาว)
import imgTruckFull from "../../assets/icons3d/truck-full.webp";
import imgTruckHalf from "../../assets/icons3d/truck-half.webp";
import type { Trip } from "../../lib/data/useCostRev";
import { openExecTab } from "../../lib/ui/dashJump";
import { FilterScope, passLfDemo } from "./filter";
import type { DemoFilter } from "./filter";

const baht = (n: number): string => fmt(Math.round(n));
/** สัดส่วน 0–1 → "72.5%" */
const pctOf = (x: number, d = 1): string => pct(x * 100, d);
const toLf = (): void => openExecTab("lf");
const toEmpty = (): void => openExecTab("empty");

/**
 * trips = กรองครบ · all/tripsAnyYear ยังรับไว้ตามผู้เรียก แต่การ์ดเที่ยวเปล่ารุ่น 29 ก.ย. 2569 ไม่ใช้แล้ว (ไม่มี YoY)
 */
export default function Item2Tab({ trips, f, costSample, onInfo }: {
  all: Trip[]; trips: Trip[]; tripsAnyYear: Trip[]; f: DemoFilter; costSample?: boolean;
  onInfo: (content: ReactNode, sample?: boolean) => void;
}) {
  const { data: lf, error: lfError } = useLoadFactor();

  /* ---- ฝั่ง Load Factor (การ์ด 1-2) — กรองเท่าที่ไฟล์ LF มีให้ ---- */
  const sum = useMemo(() => {
    if (!lf) return null;
    const ts = lf.trips.filter((t) => passLfDemo(t, f));
    return ts.length ? summarize(ts) : null;
  }, [lf, f]);

  const lfNote = lfError
    ? "โหลดชุด Load Factor ไม่ได้ — สร้างด้วย python etl/build_loadfactor.py --dataset sample"
    : !lf ? "กำลังโหลด…" : !sum ? "ไม่มีเที่ยวในไฟล์ Load Factor ตามตัวกรองที่เลือก" : null;

  // ชื่อไฟล์จริงจาก manifest — เดิมเขียน ExampleLoadfactor.xlsx ตายตัว พอใช้ข้อมูลจริงข้อความจะผิด
  const lfFiles = lf?.manifest.sourceFiles.join(", ") || "ไฟล์ Load Factor";
  const lfSample = lf?.manifest.isSample;
  useEffect(() => {
    onInfo(<>
      <h3>Inefficient Transportation</h3>
      <p>กล่องที่ 1–2: ไฟล์ Load Factor ({lfFiles}){lfSample !== undefined && ` · ${lfSample ? "ข้อมูลตัวอย่าง" : "ข้อมูลจริง"}`} · ต้นทุนค่าเสียโอกาส = ต้นทุนรวม × (100% − Max LF) ของแต่ละเที่ยว</p>
      <p>กล่องที่ 3–4: ชุดเดียวกับแท็บ Empty Trips ของ Overall Dashboard มาจากไฟล์ต้นทุน{costSample !== undefined && ` · ${costSample ? "ข้อมูลตัวอย่าง" : "ข้อมูลจริง"}`} · นับเที่ยวที่จับคู่ข้อมูลรายได้ได้และเที่ยววิ่งเปล่า แม้เที่ยวเปล่าไม่มีบิลรายได้ให้จับคู่</p>
      <p>สองชุดนี้คนละไฟล์และมีจำนวนเที่ยวไม่เท่ากัน ตัวเลขจึงเทียบข้ามกล่องกันตรง ๆ ไม่ได้</p>
      <FilterScope f={f} uses={["year", "month", "ft", "vk"]} who="กล่องที่ 1–2 "
        why="ไฟล์ Load Factor ไม่มีสาขา ต้นทาง/ปลายทางแยก และกลุ่มบริการ — กล่องที่ 3–4 กรองครบทุกตัว" />
    </>, lfSample || costSample);
  }, [onInfo, lfFiles, lfSample, costSample, f]);

  const gap = sum ? (sum.avgTg - sum.avgLf) * 100 : null;

  return (
    <>
      {/* ดีไซน์ที่เจ้าของงานส่ง 28 ก.ย. 2569: สองแผงขาวซ้าย-ขวา หัวข้อสีแดงเข้ม · ใบแรกเข้ม ใบสองสีชมพูอ่อน
          (แทนหัวข้อเส้นใต้ + เส้นประคั่นของดีไซน์ "1c") */}
      <div className="i2-groups i2-v3">
      <section className="i2-group lf" aria-label="Load Factor">
        <h3 className="i2-gh"><b>Load Factor</b></h3>
        <div className="i2-cards">
          <I2Card tone="dark" cls="i2-lf" l="อัตราการบรรทุกเฉลี่ย" onClick={toLf} art={imgTruckFull}
            v={sum ? pctOf(sum.avgLf) : "–"}
            sub={sum ? `เป้าหมาย ${pctOf(sum.avgTg)}` : lfNote}
            pill={gap == null ? undefined
              : gap > 0 ? `ต่ำกว่าเป้าหมาย ${gap.toFixed(1)} PP`
              : gap < 0 ? `สูงกว่าเป้าหมาย ${Math.abs(gap).toFixed(1)} PP` : "เท่ากับเป้าหมาย"} />
          {/* 29 ก.ย. 2569 (เจ้าของงานสั่ง): ยอดต้นทุนขนส่งรวม + "มูลค่าประเมินตามแบบจำลอง" ย้ายเข้าปุ่ม i */}
          <I2Card tone="light" cls="i2-idle" l="ต้นทุนค่าเสียโอกาสจากการบรรทุกไม่เต็ม" unit="บาท" onClick={toLf} art={imgTruckHalf}
            v={sum ? baht(sum.idle) : "–"}
            pill={sum ? `${pctOf(sum.share)} ของต้นทุนขนส่งรวม` : undefined}
            sub={sum ? undefined : lfNote}
            info={sum && <>ต้นทุนขนส่งรวม {baht(sum.cost)} บาท<br />มูลค่าประเมินตามแบบจำลอง</>} />
        </div>
      </section>
      <section className="i2-group empty" aria-label="Empty Trips">
        <h3 className="i2-gh"><b>Empty Trips</b></h3>
        <div className="i2-cards">
          {/* 29 ก.ย. 2569 (เจ้าของงานสั่ง): ใบแรก % จำนวนเที่ยว ไม่มี YoY · ใบสอง % ต้นทุน — ตัวเดียวกับแท็บ Empty Trips */}
          <EmptyCards rows={trips} onOpen={toEmpty} />
        </div>
      </section>
      </div>
    </>
  );
}
