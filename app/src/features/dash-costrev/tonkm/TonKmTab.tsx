/**
 * แท็บ "กำไรส่วนเกิน/ตัน-กม." ของ Executive Dashboard — สไลด์ที่เจ้าของงานส่ง 23 ก.ย. 2569
 * การ์ดสรุปอยู่ในเมนู Demo › กำไรรายเส้นทางด้วย กดแล้วมาที่แท็บนี้ (lib/ui/execTab.ts)
 *
 *   1. การ์ด 4 ใบ (TonKmCards) ตามช่วงที่เลือก
 *   2. กราฟแท่งนอนรายชนิดรถ — แท่ง = อัตราของช่วงที่เลือก · ขีดตั้ง = เป้าหมาย · สีตามสถานะ
 *      แถว = ชนิดรถที่มีเที่ยวในช่วงนั้น ดึงจากข้อมูลล้วน — ไฟล์ใหม่มีชนิดรถเพิ่มก็ขึ้นเอง
 *   3. ตารางรายปี × ชนิดรถ (ทั้งปี ไม่ตามตัวกรองเดือน) — Contribution · ตัน-กม. · อัตรา · Baseline · เป้า · สถานะ
 *      **กดแถวเพื่อเปิดป็อบอัพรายละเอียด** (TonKmRowModal — รายเดือน/รายเส้นทาง/รายเที่ยว + ที่มาของเป้า)
 *      มีตัวกรองของตัวเองที่หัวตาราง (ปี · ชนิดรถ · สถานะ) แยกจากแถบหัวที่คุมการ์ดกับกราฟ
 *
 * ★ ตัวกรอง: ปี (ต้องเลือก — เป้าคิดจากสองปีก่อนหน้าปีที่เลือก) · เดือน (ว่าง = ทั้งปี) · X% ของเป้า
 *   ค่าเริ่มต้น = เดือนล่าสุดของไฟล์ ให้ตรงกับการ์ดใน Demo ที่กดมา · ปุ่มล้างตัวกรองกลับไปเดือนล่าสุด
 * ★ ชุดข้อมูล loadfactor/ ไม่ใช้ trips ของ costrev — อยู่ใน STANDALONE ของ CostRevDash · สูตรอยู่ใน lib/tonkm/calc.ts
 * ★ กราฟอยู่ใน TonKmChart.tsx (Recharts แท่งนอน + ขีดเป้า) — เดิมเป็น HTML เจ้าของงานให้ทำใหม่ 23 ก.ย. 2569
 */
import { useMemo, useState } from "react";
import FilterBar, { ClearFiltersBtn } from "../../../lib/ui/FilterBar";
import EtlBanner from "../../../lib/ui/EtlBanner";
import { useAutoReloadOnEtl, useEtlStatus } from "../../../lib/data/etlStatus";
import { lfShellSource, useLoadFactor } from "../../../lib/data/useLoadFactor";
import { useShellSource } from "../../../lib/ui/dashContext";
import type { LfManifest, LfTrip } from "../../../lib/data/useLoadFactor";
import { BASE_W, STATUS_LABEL, hasTonKm, latestPeriod, overview, yearRows } from "../../../lib/tonkm/calc";
import type { TkPeriod, TkStatus, YearRow } from "../../../lib/tonkm/calc";
import { useTargetPct } from "../../../lib/tonkm/prefs";
import { FF, Note, Pane, TableHead } from "../../dash-fleet/parts";
import { MonthFF, SortTable, duniq, fmt, isFiltered, pct, useSort } from "../common";
import type { Col } from "../common";
import TonKmCards, { BaseTag, StatusTag, periodStr, rateStr } from "./TonKmCards";
import TonKmRowModal from "./TonKmRowModal";
import TonKmChart from "./TonKmChart";
import TruckLoader from "../../../lib/ui/TruckLoader";

export default function TonKmTab() {
  const { data, error, reload } = useLoadFactor();
  const etl = useEtlStatus("loadfactor");
  useAutoReloadOnEtl(etl, reload);
  // หัวแดชบอร์ดบอกชุด loadfactor/ ไม่ใช่ไฟล์ต้นทุน (lfShellSource)
  useShellSource(lfShellSource(data?.manifest));
  return (
    <>
      <EtlBanner status={etl} />
      {error ? (
        <div className="card">
          <div className="banner">{error}</div>
          <p className="muted">
            สร้างไฟล์ข้อมูลด้วย <code>python etl/build_loadfactor.py --dataset sample</code> (หรือ <code>--dataset real</code>
            เมื่อวางไฟล์จริงใน <code>etl/data/Loadfactor/</code> แล้ว)
          </p>
        </div>
      ) : !data ? (
        <div className="card"><p className="muted">กำลังโหลดข้อมูล... <TruckLoader label={null} /></p></div>
      ) : !hasTonKm(data.trips) ? (
        <div className="card">
          <h2>ไฟล์ข้อมูลรุ่นเก่า</h2>
          <p className="muted">
            ชุด loadfactor/ นี้ยังไม่มีระยะทาง/น้ำหนักจริง/VC (สร้างก่อน 23 ก.ย. 2569) — รัน{" "}
            <code>python etl/build_loadfactor.py</code> ใหม่แล้วกด ↻ รีเฟรชข้อมูล · ถ้ารันแล้วยังขึ้นข้อความนี้
            แปลว่าไฟล์ Load Factor ไม่มีคอลัมน์ <code>ระยะทาง</code> <code>น้ำหนักจริง</code> <code>VC</code>
          </p>
        </div>
      ) : (
        <Body trips={data.trips} manifest={data.manifest} />
      )}
    </>
  );
}

function Body({ trips, manifest }: { trips: LfTrip[]; manifest: LfManifest }) {
  const latest = useMemo(() => latestPeriod(trips)!, [trips]);
  const [p, setP] = useState<TkPeriod>(latest);
  const [x, setX] = useTargetPct();
  const years = useMemo(() => duniq(trips.map((t) => String(t.y))), [trips]);

  const ov = useMemo(() => overview(trips, p, x), [trips, p, x]);
  const bars = useMemo(() => [...ov.rows].sort((a, b) => (b.cur.rate ?? -Infinity) - (a.cur.rate ?? -Infinity)), [ov]);
  // เรียงไว้ก่อน (ปีใหม่ → เก่า · อัตราสูง → ต่ำ) ให้แถวในปีเดียวกันเรียงอ่านง่ายตอนเรียงตามปี
  const table = useMemo(() => yearRows(trips, x).sort((a, b) => b.year - a.year || (b.agg.rate ?? 0) - (a.agg.rate ?? 0)), [trips, x]);

  const [open, setOpen] = useState<YearRow | null>(null);
  // X% เปลี่ยนตอนป็อบอัพเปิดอยู่ → ใช้แถวใหม่ของปี × ชนิดรถเดิม ให้เป้าในป็อบอัพตรงกับตาราง
  const openRow = open && (table.find((r) => r.year === open.year && r.vk === open.vk) ?? null);

  const isLatest = p.year === latest.year && p.month === latest.month;
  const excluded = manifest.check.tonKm?.noWeight ?? 0;

  return (
    <>
      <FilterBar>
        <FF label="ปี" value={String(p.year)} onChange={(v) => setP((c) => ({ ...c, year: Number(v) }))}>
          {years.map((y) => <option key={y} value={y}>พ.ศ. {+y + 543}</option>)}
        </FF>
        <MonthFF value={p.month} onChange={(v) => setP((c) => ({ ...c, month: v }))} />
        <div className="ff tk-x">
          <label>เป้า: เพิ่มจากฐาน (%)</label>
          <input type="number" step={0.5} value={x}
            onChange={(e) => { const v = Number(e.target.value); if (Number.isFinite(v)) setX(v); }} />
        </div>
        <ClearFiltersBtn active={!isLatest} onClick={() => setP(latest)} />
      </FilterBar>

      <Pane deps={[ov]}>
        <div className="cp-sec">
          <div>
            <h3>กำไรส่วนเกินต่อตัน-กม. แยกชนิดรถ</h3>
            <p>
              ช่วงที่ดู: <b>{periodStr(p)}</b>{isLatest && " (ข้อมูลล่าสุด)"} ·
              เป้าหมาย = ({BASE_W[0]} × ปี {p.year - 2 + 543} + {BASE_W[1]} × ปี {p.year - 1 + 543}) × (1 + {fmt(x, x % 1 ? 1 : 0)}%)
              · {manifest.isSample ? "ข้อมูลตัวอย่าง" : "ข้อมูลจริง"}
            </p>
          </div>
        </div>

        <TonKmCards ov={ov} x={x} />

        <div className="dz-cc" style={{ marginTop: 14 }}>
          <TableHead title="อัตรารายชนิดรถ เทียบเป้าหมาย">
            <div className="tk-legend">
              <span><i className="ok" />ถึงเป้า</span><span><i className="near" />80–99%</span>
              <span><i className="far" />ต่ำกว่า 80%</span>
              <span><i className="nobase" />ไม่มีฐาน</span><span><b className="tk-tick-key" />เป้าหมาย</span>
            </div>
          </TableHead>
          <TonKmChart rows={bars} />
        </div>

        <div className="dz-cc" style={{ marginTop: 14 }}>
          <YearTable rows={table} onPick={setOpen} />
          <Note>
            <b>สูตร:</b> ตัน-กม. = น้ำหนักจริง (ตัน) × ระยะทาง · Contribution = รายได้ − ต้นทุนผันแปร (ไม่หักค่าเสื่อมและค่าซ่อมตามเวลา) ·
            อัตรา = ΣContribution ÷ Σตัน-กม. ของทั้งกลุ่ม (ไม่ใช่ค่าเฉลี่ยของอัตรารายเที่ยว) ·
            Baseline ของปี Y = {BASE_W[0]} × อัตราปี Y−2 + {BASE_W[1]} × อัตราปี Y−1 ทั้งปี ไม่ใช้ข้อมูลของปีที่กำลังวัด (ป้าย "2ปี") —
            มีข้อมูลปีก่อนหน้าปีเดียวใช้ปีนั้นปีเดียว (ป้าย "1ปี" เป้าเชื่อถือได้น้อยกว่า) · ไม่มีเลยขึ้น "ไม่มีฐาน" · ชนิดรถที่ Baseline ≤ 0 (รายได้ไม่พอแม้แต่ต้นทุนผันแปร) ขึ้น
            "ต่ำกว่าเป้า" โดยไม่คิดเป้าหมาย/% เพราะเป้า +X% ของค่าติดลบจะกลายเป็นขาดทุนมากขึ้น ·
            ไม่นับเที่ยวที่ไม่มีน้ำหนักหรือระยะทาง {fmt(excluded)} เที่ยว
          </Note>
        </div>
      </Pane>

      {openRow && <TonKmRowModal row={openRow} trips={trips} x={x} onClose={() => setOpen(null)} />}
    </>
  );
}

/* ---------------- ตารางรายปี × ชนิดรถ ---------------- */
interface TblFilter { year: string; vk: string; st: string }
const TF0: TblFilter = { year: "", vk: "", st: "" };

function YearTable({ rows: all, onPick }: { rows: YearRow[]; onPick: (r: YearRow) => void }) {
  const [f, setF] = useState<TblFilter>(TF0);
  const set = (k: keyof TblFilter) => (v: string) => setF((p) => ({ ...p, [k]: v }));
  // ตัวเลือกดึงจากข้อมูลจริง — ปีใหม่/ชนิดรถใหม่/สถานะที่มีอยู่ขึ้นเอง
  const years = useMemo(() => duniq(all.map((r) => String(r.year))).sort().reverse(), [all]);
  const vks = useMemo(() => duniq(all.map((r) => r.vk)), [all]);
  const sts = useMemo(() => (Object.keys(STATUS_LABEL) as TkStatus[]).filter((s) => all.some((r) => r.status === s)), [all]);
  const rows = useMemo(() => all.filter((r) =>
    (!f.year || String(r.year) === f.year) && (!f.vk || r.vk === f.vk) && (!f.st || r.status === f.st)), [all, f]);
  const cols = useMemo<Col<YearRow>[]>(() => [
    { key: "year", label: "ปี", get: (r) => r.year, num: true, render: (r) => String(r.year + 543) },
    { key: "vk", label: "ชนิดรถ", get: (r) => r.vk },
    { key: "n", label: "เที่ยว", get: (r) => r.agg.n, num: true },
    { key: "contrib", label: "Contribution", get: (r) => r.agg.contrib, num: true, render: (r) => fmt(Math.round(r.agg.contrib)) },
    { key: "tk", label: "ตัน-กม.", get: (r) => r.agg.tk, num: true, render: (r) => fmt(Math.round(r.agg.tk)) },
    { key: "rate", label: "บาท/ตัน-กม.", get: (r) => r.agg.rate ?? -Infinity, num: true,
      render: (r) => <b style={{ color: (r.agg.rate ?? 0) < 0 ? "var(--red)" : undefined }}>{rateStr(r.agg.rate)}</b> },
    { key: "base", label: "Baseline", get: (r) => r.base ?? -Infinity, num: true,
      render: (r) => <>{rateStr(r.base)} <BaseTag n={r.baseN} /></> },
    { key: "target", label: "เป้าหมาย", get: (r) => r.target ?? -Infinity, num: true, render: (r) => rateStr(r.target) },
    { key: "pct", label: "% ของเป้า", get: (r) => r.pctOfTarget ?? -Infinity, num: true,
      render: (r) => (r.pctOfTarget == null ? "–" : pct(r.pctOfTarget, 0)) },
    { key: "status", label: "สถานะ", get: (r) => r.status, render: (r) => <StatusTag s={r.status} /> },
  ], []);
  const { sorted, sort, toggle } = useSort(rows, cols, { key: "year", dir: -1 });
  return (
    <>
      <div className="tk-th">
        <div>
          <h4>รายละเอียดรายปี × ชนิดรถ (ทั้งปี)</h4>
          <p>กดแถวเพื่อดูรายละเอียด · {fmt(rows.length)} จาก {fmt(all.length)} แถว</p>
        </div>
        <div className="dm-head" role="group" aria-label="ตัวกรองตาราง ปี ชนิดรถ สถานะ">
          <FF label="ปี" value={f.year} onChange={set("year")}>
            <option value="">ทุกปี</option>
            {years.map((y) => <option key={y} value={y}>พ.ศ. {+y + 543}</option>)}
          </FF>
          <FF label="ชนิดรถ" value={f.vk} onChange={set("vk")}>
            <option value="">ทุกชนิดรถ</option>
            {vks.map((v) => <option key={v} value={v}>{v}</option>)}
          </FF>
          <FF label="สถานะ" value={f.st} onChange={set("st")}>
            <option value="">ทุกสถานะ</option>
            {sts.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </FF>
          {isFiltered(f, TF0) && (
            <button type="button" className="tk-clear" onClick={() => setF(TF0)}>ล้างตัวกรอง</button>
          )}
        </div>
      </div>
      <SortTable rows={sorted} cols={cols} sort={sort} onSort={toggle} rowKey={(r) => `${r.year}|${r.vk}`}
        empty="ไม่มีแถวที่ตรงกับตัวกรอง" className="dm-tbl tk-tbl"
        rowProps={(r) => ({ onClick: () => onPick(r), title: `กดเพื่อดูรายละเอียด ${r.vk} ปี ${r.year + 543}` })} />
    </>
  );
}
