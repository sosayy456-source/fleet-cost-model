/**
 * ตารางระดับรายเที่ยว — ท้ายแท็บ "กำไรรายเที่ยว" (สเปก "กำไรต่อเที่ยว" ส่วนตารางสรุประดับรายเที่ยว)
 *
 * 1 แถว = 1 เที่ยว ตามตัวกรองด้านบนของแท็บ · ไม่ซ่อนเที่ยววิ่งเปล่า (รายได้ 0 ก็เป็นเที่ยวที่มีต้นทุน)
 * ต้นทุนแยก 5 กลุ่มตามสเปก ส่วนที่เหลือ (ค่าเช่า สูญเปล่า ฯลฯ) รวมเป็น "ต้นทุนอื่น ๆ" ให้ผลรวมตรงต้นทุนรวมเสมอ
 * ★ ค่าแรงคนขับ = ค่าเบี้ยเลี้ยง (`allow`) เพราะไฟล์ต้นทุนไม่มีคอลัมน์ค่าแรงแยก
 * ★ ทะเบียนรถหางพ่วงยังไม่มี — ETL ไม่ได้อ่านคอลัมน์นั้นออกมา
 */
import { useMemo } from "react";
import { Note, TableHead } from "../dash-fleet/parts";
import { SortTable, fmt, marginOf, marginTone, pct, signed, useSort } from "./common";
import type { Col } from "./common";
import type { Trip } from "../../lib/data/useCostRev";

/** ต้นทุนอื่น ๆ = ต้นทุนรวม − 5 กลุ่มหลัก */
const otherOf = (t: Trip): number => t.cost - t.fuel - t.allow - t.fee - t.dep - t.repair;

export default function TripTable({ trips }: { trips: Trip[] }) {
  const cols = useMemo<Col<Trip>[]>(() => [
    { key: "y", label: "ปี", get: (t) => t.y, render: (t) => String(t.y + 543) },
    { key: "d", label: "วัน/เดือน", get: (t) => t.d,
      render: (t) => (t.d ? `${t.d.slice(8, 10)}/${t.d.slice(5, 7)}` : "–") },
    { key: "id", label: "เลขที่ใบรายการ", get: (t) => t.id },
    { key: "rt", label: "ต้นทาง-ปลายทาง", get: (t) => t.rt || "–" },
    { key: "ft", label: "ประเภทรถ", get: (t) => t.ft || "–" },
    { key: "vk", label: "ชนิดรถ", get: (t) => t.vk || "–" },
    { key: "pl", label: "ทะเบียนรถ", get: (t) => t.pl || "–" },
    { key: "rev", label: "รายได้", get: (t) => t.rev, num: true },
    { key: "fuel", label: "ค่าน้ำมันเชื้อเพลิง", get: (t) => t.fuel, num: true },
    { key: "allow", label: "ค่าแรงคนขับรถ", get: (t) => t.allow, num: true },
    { key: "fee", label: "ค่าธรรมเนียม/ค่าประกัน", get: (t) => t.fee, num: true },
    { key: "dep", label: "ค่าเสื่อม", get: (t) => t.dep, num: true },
    { key: "repair", label: "ค่าซ่อม", get: (t) => t.repair, num: true },
    { key: "other", label: "ต้นทุนอื่น ๆ", get: otherOf, num: true },
    { key: "cost", label: "ต้นทุนรวม", get: (t) => t.cost, num: true },
    { key: "profit", label: "กำไร", get: (t) => t.profit, num: true,
      render: (t) => <span style={{ fontWeight: 700, color: t.profit < 0 ? "var(--red)" : "var(--green)" }}>{signed(t.profit)}</span> },
    { key: "margin", label: "%margin", get: marginOf, num: true,
      render: (t) => {
        const m = marginOf(t);
        return <span style={{ fontWeight: 700, color: marginTone(m) }}>{m == null ? "–" : pct(m)}</span>;
      } },
  ], []);
  const { sorted, sort, toggle } = useSort(trips, cols, { key: "profit", dir: 1 });

  const sum = useMemo(() => {
    const rev = trips.reduce((s, t) => s + t.rev, 0);
    const cost = trips.reduce((s, t) => s + t.cost, 0);
    return { rev, cost, profit: rev - cost, margin: rev ? (rev - cost) / rev * 100 : null };
  }, [trips]);

  return (
    <div className="dz-cc" style={{ marginTop: 14 }}>
      <TableHead title={`ตารางระดับรายเที่ยว · ${fmt(trips.length)} เที่ยว`} />
      <SortTable rows={sorted} cols={cols} sort={sort} onSort={toggle}
        rowKey={(t, i) => `${t.id}-${i}`} empty="ไม่พบเที่ยวตามเงื่อนไข" />
      <Note>
        สรุปรายการที่กรองอยู่: รายได้ <b>{fmt(sum.rev)}</b> · ต้นทุน <b>{fmt(sum.cost)}</b> ·
        กำไร <b>{signed(sum.profit)}</b> · %margin <b>{sum.margin == null ? "–" : pct(sum.margin)}</b> ·
        เรียงจากขาดทุนมากสุดก่อน คลิกหัวคอลัมน์เพื่อเรียงใหม่ ·
        ค่าแรงคนขับรถคือค่าเบี้ยเลี้ยง · ต้นทุนอื่น ๆ รวมค่าเช่ารถ สูญเปล่า และรายการที่ไม่จัดกลุ่ม ·
        เที่ยววิ่งเปล่าแสดงด้วย (%margin เป็น "–" เพราะไม่มีรายได้)
      </Note>
    </div>
  );
}
