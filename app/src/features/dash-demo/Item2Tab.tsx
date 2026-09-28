/**
 * แท็บ "ข้อ 2" ของเมนู Demo — การ์ดสรุป 4 กล่อง (เจ้าของงานสั่ง 23 ก.ย. 2569)
 *
 *   1. LF เฉลี่ย                              ┐ ชุด loadfactor/ (ชื่อไฟล์ในปุ่มข้อมูลอ่านจาก manifest)
 *   2. ต้นทุนค่าเสียโอกาสจากการบรรทุกไม่เต็ม   ┘ = Idle Cost
 *   3. % ต้นทุนเที่ยวเปล่า + มูลค่า YTD         ┐ ชุด costrev/ — การ์ด 2 ใบเดียวกับแท็บเที่ยววิ่งเปล่าของ
 *   4. มูลค่าต้นทุนเที่ยวเปล่า + % เที่ยวเปล่า   ┘ Executive Dashboard (EmptyHeroes.tsx · เจ้าของงานสั่ง 24 ก.ย. 2569)
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
import { Hero } from "../dash-fleet/parts";
import EmptyHeroes from "../dash-costrev/EmptyHeroes";
import { fmt, pct } from "../dash-costrev/common";
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
 * all = ทุกเที่ยวในไฟล์ (กรองสาขา) · trips = กรองครบ · tripsAnyYear = กรองทุกตัวยกเว้นปี
 * (การ์ดใบ % ต้องเทียบปีก่อนและวาดเส้นรายปี — ดู EmptyHeroes.tsx)
 */
export default function Item2Tab({ all, trips, tripsAnyYear, f, costSample, onInfo }: {
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

  return (
    <>
      {/* สองกลุ่มซ้าย-ขวา หัวข้อมีเส้นใต้ยาวเต็มกลุ่ม คั่นด้วยเส้นประ (ดีไซน์ "1c" ที่เจ้าของงานส่ง 28 ก.ย. 2569) */}
      <div className="i2-groups">
      <section className="i2-group lf" aria-label="Load factor">
        <h3 className="i2-gh"><b>Load factor</b></h3>
      <div className="dz-heroes i2-pair">
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
      </div>
      </section>
      <i className="i2-sep" aria-hidden="true" />
      <section className="i2-group empty" aria-label="Empty trip">
        <h3 className="i2-gh"><b>Empty trip</b></h3>
      <div className="dz-heroes i2-pair">
        {/* การ์ด 3-4 = สองใบเดียวกับแท็บเที่ยววิ่งเปล่าของ Executive Dashboard กดแล้วเปิดแท็บนั้น */}
        <EmptyHeroes all={all} rows={trips} rowsAnyYear={tripsAnyYear} period={f} onOpen={toEmpty} />
      </div>
      </section>
      </div>

    </>
  );
}
