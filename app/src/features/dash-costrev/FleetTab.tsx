/**
 * กองรถ: ใช้รายได้และเส้นทางจากไฟล์ต้นทุน แบ่งกลุ่มบริการตามสัดส่วนบิลรายได้
 *
 * ★ หนึ่งใบรายการมีได้ถึง 3 ทะเบียน (หัว · คันที่ 2 ที่เป็นค่าเช่า · พ่วง) fleetSlices แบ่งยอดให้ทุกคัน
 *   ตามสัดส่วนต้นทุนแล้ว ตัวกรองประเภท/ชนิดรถจึงต้องกรอง **ที่ระดับรถแต่ละคัน** ไม่ใช่ระดับใบ
 *   (ถ้ากรองระดับใบซึ่งใช้ค่าของคันที่ 1 เลือก "หางเทรเลอร์" แล้วจะไม่เจออะไรเลยทั้งที่มีหางอยู่)
 *   ส่วนตัวกรองปี/เดือน/จุดขึ้น/จุดลง ยังกรองที่ระดับใบเหมือนเดิม
 */
import { useMemo, useState } from "react";
import type { Trip } from "../../lib/data/useCostRev";
import { fleetSlices, UNKNOWN_SERVICE } from "../../lib/fleetcompare/utilization";
import FilterBar, { ClearFiltersBtn } from "../../lib/ui/FilterBar";
import { Note } from "../dash-fleet/parts";
import { BASE_F0, duniq, fmt, isFiltered, ListFF, MonthFF, passBase, YearFF, type BaseFilter } from "./common";
import FleetUtilizationView from "./FleetUtilizationView";

const INITIAL = { ...BASE_F0, service: "" };
export default function FleetTab({ trips }: { trips: Trip[] }) {
  const [filter, setFilter] = useState(INITIAL);
  const set = (key: keyof BaseFilter | "service") => (value: string) => setFilter((current) => ({ ...current, [key]: value }));
  const allSlices = useMemo(() => fleetSlices(trips), [trips]);
  const services = useMemo(() => duniq(allSlices.map((row) => row.service)), [allSlices]);
  const scope = useMemo(() => trips.filter((trip) => passBase(trip, filter, { ignoreVehicle: true })), [trips, filter]);
  const slices = useMemo(
    () => fleetSlices(scope).filter((row) => (!filter.ft || row.ft === filter.ft) && (!filter.vk || row.vk === filter.vk)),
    [scope, filter.ft, filter.vk]);
  const unknown = useMemo(() => new Set(slices.filter((row) => row.service === UNKNOWN_SERVICE).map((row) => row.id)).size, [slices]);
  const legacy = scope.some((trip) => trip.serviceRevenue === undefined);
  const rows = useMemo(() => slices.filter((row) => !filter.service || row.service === filter.service), [slices, filter.service]);

  return <>
    <FilterBar>
      <YearFF trips={trips} value={filter.year} onChange={set("year")} />
      <MonthFF value={filter.month} onChange={set("month")} />
      <ListFF label="จุดขึ้น" all="ทุกจุดขึ้น" value={filter.o} onChange={set("o")} opts={duniq(trips.map((t) => t.o))} />
      <ListFF label="จุดลง" all="ทุกจุดลง" value={filter.de} onChange={set("de")} opts={duniq(trips.map((t) => t.de))} />
      <ListFF label="กลุ่มบริการ" all="ทุกกลุ่มบริการ" value={filter.service} onChange={set("service")} opts={services} />
      {/* ตัวเลือกมาจากรถทุกคันในใบ ไม่ใช่เฉพาะคันที่ 1 — ชนิดของหางจึงอยู่ในรายการด้วย */}
      <ListFF label="ประเภทรถ" all="ทุกประเภทรถ" value={filter.ft} onChange={set("ft")} opts={duniq(allSlices.map((r) => r.ft))} />
      <ListFF label="ชนิดรถ" all="ทุกชนิดรถ" value={filter.vk} onChange={set("vk")} opts={duniq(allSlices.map((r) => r.vk))} />
      <ClearFiltersBtn active={isFiltered(filter, INITIAL)} onClick={() => setFilter(INITIAL)} />
    </FilterBar>
    {unknown > 0 && <Note>มี {fmt(unknown)} เที่ยวในช่วงที่เลือกที่ยังแบ่งกลุ่มบริการไม่ได้
      (ไม่มีบิลรายได้ที่ใช้คำนวณสัดส่วนได้ หรือยอดเป็นศูนย์/ติดลบ) จัดไว้ใน “{UNKNOWN_SERVICE}” และยังคงยอดรวมเดิม
      {legacy && <> · ข้อมูลชุดนี้ยังมีไฟล์รุ่นเก่า ต้องแปลงข้อมูลต้นทุนและรายได้ใหม่เพื่อแสดงกลุ่มบริการ</>}
    </Note>}
    <FleetUtilizationView rows={rows} trips={scope} />
  </>;
}
