/**
 * การ์ด 2 ใบของเที่ยววิ่งเปล่า — ใช้สองที่ด้วยตัวเดียวกัน (เจ้าของงานสั่ง 24 ก.ย. 2569):
 *   Executive Dashboard › แท็บเที่ยววิ่งเปล่า (EmptyTab.tsx) · Demo › ข้อ 2 กล่องที่ 3–4 (กดแล้วเปิดแท็บเที่ยววิ่งเปล่า)
 *
 *   ใบแรก  % ต้นทุนเที่ยวเปล่าของปีที่เลือก (ไม่เลือก = ปีล่าสุด) + เส้นแนวโน้มรายปี — เลือกช่วงเดือน = ช่วงนั้นของทุกปี
 *          ส่วนเปรียบเทียบข้างล่าง = "มูลค่ารถเที่ยวเปล่า (YTD ม.ค.–พ.ค. 69)" 3 บรรทัด (สูตร lib/empty/ytd.ts)
 *   ใบสอง  มูลค่าต้นทุนเที่ยวเปล่าตามตัวกรอง + จำนวนเที่ยวเปล่า จากเที่ยวทั้งหมด และ **% เที่ยวเปล่าเทียบเที่ยวทั้งหมด**
 *          (นับเที่ยว ไม่ใช่ต้นทุน — ย้ายมาจากการ์ด "เที่ยววิ่งเปล่าเทียบเที่ยวทั้งหมด" เดิมของ Demo ข้อ 2)
 *
 * คืนเป็น Fragment ของ Hero สองใบ — ผู้เรียกวางในกริดของตัวเอง (.em-heroes 2 คอลัมน์ · .i2-heroes 4 คอลัมน์)
 * ผู้เรียกส่งเที่ยวที่กรองแล้วมาเอง เพราะสองหน้ามีตัวกรองคนละชุด:
 *   all = ทุกเที่ยวในชุด (หาเดือนสุดท้ายที่ปีนั้นมีข้อมูล) · rows = กรองครบ · rowsAnyYear = กรองทุกตัวยกเว้นปี
 */
import { useMemo } from "react";
import { Hero } from "../dash-fleet/parts";
import { fmt, pct } from "./common";
import { emptyYtd, prevYY, yearShares, ytdLabel, ytdMonths } from "../../lib/empty/ytd";
import type { EmptyYtd } from "../../lib/empty/ytd";
import type { Trip } from "../../lib/data/useCostRev";
import { isPartialYear, monthsLabel, periodLabel } from "../../lib/filter/period";
import type { Period } from "../../lib/filter/period";

/** เฉลี่ยต่อเดือน — หลักล้านเขียนเป็น "4.83 ล้านบาท" ตามตัวอย่างของเจ้าของงาน ต่ำกว่านั้นเขียนเต็ม */
const perMonth = (v: number): string =>
  v >= 1e6 ? `${(v / 1e6).toFixed(2)} ล้านบาท/เดือน` : `${fmt(Math.round(v))} บาท/เดือน`;

/** หัวข้อ + 3 บรรทัดใต้การ์ดแรก — เฉลี่ย/เดือน · % ของต้นทุนวิ่งรวม · YoY ช่วงเดือนเดียวกัน */
function YtdLines({ r, picked }: { r: EmptyYtd; picked: boolean }) {
  const py = prevYY(r.year);
  const yoy = r.yoy != null
    ? `${r.yoy > 0 ? "+" : r.yoy < 0 ? "−" : "±"}${Math.abs(r.yoy).toFixed(1)}%`
    : r.prevEmpty == null ? `ไม่มีข้อมูลปี ${py} ช่วงเดียวกัน` : `ปี ${py} ช่วงเดียวกันไม่มีเที่ยวเปล่า`;
  return (
    <span className="em-ytd">
      <b>มูลค่ารถเที่ยวเปล่า ({ytdLabel(r.year, r.months, picked)})</b>
      <span>{perMonth(r.avgPerMonth)}</span>
      <span>{r.share == null ? "–" : pct(r.share)} ของต้นทุนวิ่งรวม</span>
      <span>เทียบ YoY ({py}): {yoy}</span>
    </span>
  );
}

export default function EmptyHeroes({ all, rows, rowsAnyYear, period, onOpen }: {
  all: Trip[]; rows: Trip[]; rowsAnyYear: Trip[];
  /** ตัวกรองปี + ช่วงเดือนที่เลือก (ปีว่าง = ทุกปี) */
  period: Period;
  /** มี = กดการ์ดได้ (Demo → เปิดแท็บเที่ยววิ่งเปล่าของ Executive Dashboard) */
  onOpen?: () => void;
}) {
  const yearShare = useMemo(() => yearShares(rowsAnyYear), [rowsAnyYear]);
  const { year, from, to } = period;
  const focusY = year ? Number(year) : yearShare[yearShare.length - 1]?.y;
  const focus = yearShare.find((x) => x.y === focusY);
  const ytd = useMemo(
    () => (focusY == null ? null : emptyYtd(rowsAnyYear, focusY, ytdMonths(all, focusY, from, to))),
    [all, rowsAnyYear, focusY, from, to]);
  const empties = useMemo(() => rows.filter((t) => t.empty), [rows]);
  const emptyCost = empties.reduce((s, t) => s + t.cost, 0);
  const scope = year ? `ปี ${periodLabel(period)}` : `รวม ${yearShare.length} ปี`;

  return (
    <>
      <Hero kind="loss" onClick={onOpen}
        l={focusY != null ? `% ต้นทุนเที่ยวเปล่า · ปี พ.ศ. ${focusY + 543}${monthsLabel(period) ? ` · ${monthsLabel(period)}` : ""}` : "% ต้นทุนเที่ยวเปล่า"}
        v={focus ? pct(focus.share) : "–"}
        trend={yearShare.length >= 2 ? yearShare.map((x) => x.share) : undefined}
        s={ytd && <YtdLines r={ytd} picked={isPartialYear(period)} />} />
      <Hero kind="cost" onClick={onOpen} l={`มูลค่าต้นทุนเที่ยวเปล่า · ${scope}`} v={fmt(emptyCost)} unit="บาท"
        s={<>
          <b>{fmt(empties.length)}</b> เที่ยววิ่งเปล่า · จาก {fmt(rows.length)} เที่ยว ={" "}
          <b>{rows.length ? pct(empties.length / rows.length * 100) : "–"}</b> ของเที่ยวทั้งหมด
        </>} />
    </>
  );
}
