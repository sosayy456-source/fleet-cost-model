/**
 * ที่เก็บบิลของฝ่ายบริการลูกค้า — IndexedDB (store "bills") + Google Sheet แท็บ "บิลรอจัดรถ"
 *
 * ทางเดินข้อมูลเหมือน TripRecord ทุกอย่าง: เขียนลงเครื่องก่อนเสมอ แล้วค่อยส่งขึ้นชีต
 * ส่งไม่สำเร็จก็ยังอยู่ในเครื่องและติดธง synced=false ไว้ส่งรอบหน้า
 *
 * ★ ของบนชีตถือว่าใหม่กว่าเสมอ ยกเว้นบิลที่ยังไม่ได้ sync (กติกาเดียวกับ mergeRecords)
 * ★ บิลที่จัดรถแล้วไม่ถูกลบ — เปลี่ยน status เป็น "จัดรถแล้ว" แล้วเติม docNo เพื่อย้อนดูได้
 */
import { useCallback, useEffect, useState } from "react";
import { BILL_STORE, storePutMany, storeTx } from "./records";
import { getUrl, loadBills as loadBillsFromSheet, pushBills } from "../sheet/client";
import { nowStamp, toISODate } from "../record/date";
import type { PendingBill } from "../../types/bill";

export const getAllBills = (): Promise<PendingBill[]> =>
  storeTx<PendingBill[]>(BILL_STORE, "readonly", (s) => s.getAll());

export const putBill = (b: PendingBill): Promise<IDBValidKey> =>
  storeTx<IDBValidKey>(BILL_STORE, "readwrite", (s) => s.put(b));

export const putBills = (rows: PendingBill[]): Promise<void> => storePutMany(BILL_STORE, rows);

export const removeBill = (id: string): Promise<undefined> =>
  storeTx<undefined>(BILL_STORE, "readwrite", (s) => s.delete(id));

/** รวมบิลจากเครื่องกับบิลจากชีต — ของชีตใหม่กว่า ยกเว้นบิลที่ยังไม่ได้ sync */
export function mergeBills(local: PendingBill[], sheet: PendingBill[]): PendingBill[] {
  const byId = new Map<string, PendingBill>();
  for (const b of sheet) byId.set(b.id, { ...b, synced: true });
  for (const b of local) {
    if (b.synced === false || !byId.has(b.id)) byId.set(b.id, b);
  }
  // วันที่บิลทำเป็น ISO เสมอ — สำเนาในเครื่องที่ดึงจากชีตก่อนแก้ 24 ก.ย. 2569 อาจเก็บข้อความ Date ไว้ (หน้าจัดรถขึ้น NaN)
  return [...byId.values()]
    .map((b) => { const d = toISODate(b.date); return d && d !== b.date ? { ...b, date: d } : b; })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.no.localeCompare(a.no));
}

/**
 * บันทึกบิล (ใหม่หรือแก้) — เขียนลงเครื่องก่อน แล้วค่อยส่งขึ้นชีต
 * คืนบิลที่บันทึกจริง (มีธง synced ตามผลการส่ง) — ผู้เรียกเอาไปอัปเดตหน้าจอต่อได้
 */
export async function saveBills(rows: PendingBill[]): Promise<PendingBill[]> {
  const stamped = rows.map((b) => ({ ...b, updatedAt: nowStamp(), synced: false }));
  await putBills(stamped);
  if (!getUrl()) return stamped;                 // ยังไม่ได้เชื่อมชีต — เก็บในเครื่องอย่างเดียว
  try {
    await pushBills(stamped);
    const synced = stamped.map((b) => ({ ...b, synced: true }));
    await putBills(synced);
    return synced;
  } catch {
    // ส่งไม่ผ่าน (เน็ตหลุด/ชีตล็อก) — ของยังอยู่ในเครื่อง รอบหน้าค่อยส่งใหม่ ไม่ทำให้การบันทึกล้ม
    return stamped;
  }
}

export interface BillsState {
  bills: PendingBill[];
  loading: boolean;
  error: string | null;
  /** เชื่อมชีตแล้วหรือยัง — หน้าจอใช้เตือนว่าฝ่ายอื่นอาจยังไม่เห็นบิล */
  connected: boolean;
  reload: () => void;
  /** บันทึกแล้วอัปเดต state ให้เลย ไม่ต้องรอ reload */
  save: (rows: PendingBill[]) => Promise<PendingBill[]>;
}

export function useBills(): BillsState {
  const [bills, setBills] = useState<PendingBill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const connected = !!getUrl();

  useEffect(() => {
    let alive = true;
    setLoading(true);
    (async () => {
      const local = await getAllBills();
      if (alive) setBills(mergeBills(local, []));
      if (!getUrl()) return;
      const sheet = await loadBillsFromSheet();
      if (!alive) return;
      // เก็บสำเนาของชีตลงเครื่อง ไว้ใช้ตอนออฟไลน์ (ไม่ทับบิลที่ยังไม่ได้ sync)
      let merged = mergeBills(local, sheet);
      await putBills(merged.filter((b) => b.synced !== false));
      // ★ ส่งบิลที่ค้างในเครื่อง (synced=false) ขึ้นชีตอีกรอบ — "ส่งรอบหน้า" ตามหัวไฟล์เกิดขึ้นตรงนี้
      //   ไม่ส่งซ้ำ บิลที่จัดรถแล้วแต่สถานะส่งไม่ถึงชีตจะค้าง "รอจัดรถ" บนชีตตลอด เครื่องอื่นจัดซ้ำได้
      const unsynced = merged.filter((b) => b.synced === false);
      if (unsynced.length) {
        try {
          await pushBills(unsynced);
          const done = new Map(unsynced.map((b) => [b.id, { ...b, synced: true }]));
          await putBills([...done.values()]);
          merged = merged.map((b) => done.get(b.id) ?? b);
        } catch {
          /* ยังส่งไม่ผ่าน — คงธงไว้ เปิดหน้ารอบหน้าค่อยลองใหม่ */
        }
      }
      if (alive) setBills(merged);
    })()
      .catch((e) => { if (alive) setError((e as Error).message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  const save = useCallback(async (rows: PendingBill[]) => {
    const saved = await saveBills(rows);
    setBills((cur) => mergeBills([...saved, ...cur.filter((b) => !saved.some((x) => x.id === b.id))], []));
    return saved;
  }, []);

  return { bills, loading, error, connected, reload, save };
}
