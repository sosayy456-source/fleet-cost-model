/**
 * แท็บ "ข้อ 2" ของเมนู Demo — การ์ดสรุป 4 กล่อง (เจ้าของงานสั่ง 23 ก.ย. 2569)
 *
 *   1. LF เฉลี่ย                              ┐ ชุด loadfactor/ (ชื่อไฟล์ในโน้ตอ่านจาก manifest)
 *   2. ต้นทุนค่าเสียโอกาสจากการบรรทุกไม่เต็ม   ┘ = Idle Cost
 *   3. % เที่ยววิ่งเปล่าเทียบเที่ยวทั้งหมด      ┐ ชุด costrev/ (เหมือน Executive Dashboard)
 *   4. มูลค่าเที่ยววิ่งเปล่า                    ┘ = ต้นทุนรวมของเที่ยวที่ empty
 *
 * ★ สองชุดข้อมูลคนละไฟล์ คนละตัวหาร — **ห้ามเอาตัวเลขข้ามฝั่งมาหารกัน** เช่นเอา idle ของ loadfactor
 *   ไปหารด้วยต้นทุนของ costrev จำนวนเที่ยวไม่เท่ากัน (ไฟล์ LF กรองสถานะข้อมูลทิ้งไปส่วนหนึ่ง)
 *   การ์ด 1-2 จึงอ้างยอดรวมของฝั่ง LF ส่วน 3-4 อ้างยอดรวมของฝั่งไฟล์ต้นทุน แยกกันชัดเจนในข้อความใต้การ์ด
 * ★ ฝั่ง LF โหลดเองด้วย useLoadFactor() — ถ้าชุดนั้นหาย การ์ด 1-2 ขึ้น "–" แต่ 3-4 ยังใช้ได้ ไม่ล้มทั้งแท็บ
 * ★ การ์ด 3-4 ใช้ชุด inProfitScope() (จับคู่ได้ + เที่ยววิ่งเปล่า) ชุดเดียวกับแท็บ "เที่ยววิ่งเปล่า" ของ
 *   Executive Dashboard (เจ้าของงานเคาะ 24 ก.ย. 2569 — เดิมใช้ทุกแถวในไฟล์) ผู้เรียกส่ง allTrips มาให้
 * ★ สูตร Idle อยู่ใน lib/loadfactor/calc.ts ที่เดียว ห้ามคิดเองในไฟล์นี้
 *
 * ★ กดการ์ด 1-2 → แท็บ "ต้นทุนที่จมกับที่ว่าง" · 3-4 → แท็บ "เที่ยววิ่งเปล่า" ของ Executive Dashboard
 *   (เจ้าของงานสั่ง 23 ก.ย. 2569 · กลไกอยู่ใน lib/ui/dashJump.ts)
 *
 * ★ ตามตัวกรองของหน้า Demo (24 ก.ย. 2569 — รวมเป็นหน้ายาว ตัวกรองชุดเดียวคุมทั้งหน้า · เดิมไม่มีตัวกรอง)
 *   การ์ด 3-4 ผู้เรียกส่งเที่ยวที่กรองครบทุกตัวมาแล้ว · การ์ด 1-2 กรองไฟล์ LF เองด้วย ปี · เดือน · ประเภทรถ · ชนิดรถ
 *   (ไฟล์ LF มีแค่ "เส้นทางมาตรฐาน" ไม่มีต้นทาง/ปลายทางแยก และไม่มีกลุ่มบริการ — FilterScope บอกไว้)
 */
import { useMemo } from "react";
import { useLoadFactor } from "../../lib/data/useLoadFactor";
import { summarize } from "../../lib/loadfactor/calc";
import { Hero, Note } from "../dash-fleet/parts";
import { fmt, pct } from "../dash-costrev/common";
import type { Trip } from "../../lib/data/useCostRev";
import { openExecTab } from "../../lib/ui/dashJump";
import SourceTag from "../../lib/ui/SourceTag";
import { FilterScope } from "./filter";
import type { DemoFilter } from "./filter";

const baht = (n: number): string => fmt(Math.round(n));
/** สัดส่วน 0–1 → "72.5%" */
const pctOf = (x: number, d = 1): string => pct(x * 100, d);
const toLf = (): void => openExecTab("lf");
const toEmpty = (): void => openExecTab("empty");

export default function Item2Tab({ allTrips, f }: { allTrips: Trip[]; f: DemoFilter }) {
  const { data: lf, error: lfError } = useLoadFactor();

  /* ---- ฝั่ง Load Factor (การ์ด 1-2) — กรองเท่าที่ไฟล์ LF มีให้ ---- */
  const sum = useMemo(() => {
    if (!lf) return null;
    const ts = lf.trips.filter((t) => (!f.year || String(t.y) === f.year) && (!f.month || t.mo.slice(5) === f.month)
      && (!f.ft || t.ft === f.ft) && (!f.vk || t.vk === f.vk));
    return ts.length ? summarize(ts) : null;
  }, [lf, f.year, f.month, f.ft, f.vk]);

  /* ---- ฝั่งไฟล์ต้นทุน (การ์ด 3-4) ---- */
  const emp = useMemo(() => {
    let n = 0, cost = 0, emptyN = 0, emptyCost = 0;
    for (const t of allTrips) {
      n++; cost += t.cost;
      if (t.empty) { emptyN++; emptyCost += t.cost; }
    }
    return { n, cost, emptyN, emptyCost,
      nShare: n ? emptyN / n : 0, costShare: cost ? emptyCost / cost : 0 };
  }, [allTrips]);

  const lfNote = lfError
    ? "โหลดชุด Load Factor ไม่ได้ — สร้างด้วย python etl/build_loadfactor.py --dataset sample"
    : !lf ? "กำลังโหลด…" : !sum ? "ไม่มีเที่ยวในไฟล์ Load Factor ตามตัวกรองที่เลือก" : null;

  // ชื่อไฟล์จริงจาก manifest — เดิมเขียน ExampleLoadfactor.xlsx ตายตัว พอใช้ข้อมูลจริงข้อความจะผิด
  const lfFiles = lf?.manifest.sourceFiles.join(", ") || "ไฟล์ Load Factor";

  return (
    <>
      {/* การ์ด 1-2 อ่านชุด loadfactor/ ซึ่งเลือก real/sample แยกจากไฟล์ต้นทุนที่หัวหน้าใช้ */}
      <SourceTag block sample={lf?.manifest.isSample} what="กล่องที่ 1–2 (ไฟล์ Load Factor)" />
      <div className="dz-heroes i2-heroes">
        <Hero kind="cust" l="Load Factor เฉลี่ย" onClick={toLf}
          v={sum ? pctOf(sum.avgLf) : "–"}
          vSub={sum ? `เป้า ${pctOf(sum.avgTg)}` : undefined}
          s={sum
            ? `เฉลี่ยต่อเที่ยวจาก ${fmt(sum.n)} เที่ยว · ห่างจากเป้า ${Math.round((sum.avgTg - sum.avgLf) * 100)} จุด`
            : lfNote} />

        <Hero kind="loss" l="ต้นทุนค่าเสียโอกาสจากการบรรทุกไม่เต็ม" unit="บาท" onClick={toLf}
          v={sum ? baht(sum.idle) : "–"}
          s={sum
            ? `${pctOf(sum.share)} ของต้นทุนขนส่งรวม ${baht(sum.cost)} บาท`
            : lfNote} />

        <Hero kind="fleet" l="เที่ยววิ่งเปล่าเทียบเที่ยวทั้งหมด" onClick={toEmpty}
          v={pctOf(emp.nShare)}
          s={`${fmt(emp.emptyN)} จาก ${fmt(emp.n)} เที่ยว (จับคู่รายได้ได้ + เที่ยววิ่งเปล่า)`} />

        <Hero kind="loss" l="มูลค่าเที่ยววิ่งเปล่า" unit="บาท" onClick={toEmpty}
          v={baht(emp.emptyCost)}
          s={`${pctOf(emp.costShare)} ของต้นทุนรวม ${baht(emp.cost)} บาท`} />
      </div>

      <Note>
        กล่องที่ 1–2 มาจากไฟล์ Load Factor ({lfFiles}) — ต้นทุนค่าเสียโอกาส = ต้นทุนรวม × (100% − Max LF)
        ของแต่ละเที่ยว · กล่องที่ 3–4 มาจากไฟล์ต้นทุนชุดเดียวกับ Executive Dashboard คือ
        <b> เที่ยวที่จับคู่ข้อมูลรายได้ได้ + เที่ยววิ่งเปล่า</b> (เที่ยวเปล่าไม่มีรายได้จึงไม่มีบิลให้จับคู่ แต่นับทุกเที่ยว) ·
        สองชุดนี้คนละไฟล์และมีจำนวนเที่ยวไม่เท่ากัน ตัวเลขจึงเทียบข้ามกล่องกันตรง ๆ ไม่ได้
      </Note>
      <FilterScope f={f} uses={["year", "month", "ft", "vk"]} who="กล่องที่ 1–2 "
        why="ไฟล์ Load Factor ไม่มีต้นทาง/ปลายทางแยกและไม่มีกลุ่มบริการ — กล่องที่ 3–4 กรองครบทุกตัว" />
    </>
  );
}
