/**
 * โหลดใบรายการจากทุกแหล่งมารวมกัน — ใช้ร่วมกันทุกหน้า
 *
 *   เครื่อง (IndexedDB) : ใบที่กรอกเองและยังไม่ได้ sync
 *   ชีต loadTrips       : ใบ "ใหม่" ที่ฝ่ายอื่นกรอกไว้
 *   ชีต loadOld         : ข้อมูลเก่าจากแท็บ "ข้อมูลเก่า*" อ่านอย่างเดียว
 *
 * ใบเดียวกันอาจอยู่ทั้งในเครื่องและบนชีต — ถือว่าของบนชีตใหม่กว่าเสมอ
 * ยกเว้นใบที่ยังไม่ได้ sync (synced=false) ซึ่งของในเครื่องใหม่กว่า
 */
import { useCallback, useEffect, useState } from "react";
import { getUrl, loadOld, loadTrips } from "../sheet/client";
import { getAll, migrateFromLocalStorage } from "./records";
import type { TripRecord } from "../../types/record";

export interface OldDebtor {
  source: string;
  docNo?: string;
  date?: string;
  no?: string;
  goodsType?: string;
  origin?: string;
  dest?: string;
  sender?: string;
  receiver?: string;
  payType?: string;
  status?: string;
  paid?: boolean;
  qty?: number;
  total?: number;
  agingDays?: number;
  sheetName?: string;
  [k: string]: unknown;
}

export interface RecordsState {
  /** ใบใหม่ทั้งหมด (เครื่อง + ชีต รวมกันแล้ว) */
  records: TripRecord[];
  /** แถวจากแท็บข้อมูลเก่า — ไม่มี bills */
  oldRecords: Record<string, unknown>[];
  oldDebtors: OldDebtor[];
  loading: boolean;
  /** ข้อความบอกว่าโหลดจากชีตไม่ได้ ไม่ถือว่าพัง — ยังใช้ข้อมูลในเครื่องได้ */
  sheetError: string | null;
  /** จำนวนใบที่เพิ่งย้ายมาจาก localStorage ของเวอร์ชันเดิม — null = ไม่ได้ย้ายรอบนี้ */
  migrated: number | null;
  connected: boolean;
  reload: () => void;
}

/** รวมใบจากเครื่องกับจากชีต โดยใบที่ยังไม่ sync ให้ของในเครื่องชนะ */
export function mergeRecords(local: TripRecord[], sheet: TripRecord[]): TripRecord[] {
  const byId = new Map<string, TripRecord>();
  for (const r of sheet) byId.set(r.id, { ...r, source: "ใหม่", synced: true });
  for (const r of local) {
    const onSheet = byId.get(r.id);
    if (!onSheet || r.synced === false) byId.set(r.id, r);
  }
  return [...byId.values()].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
}

export function useRecords(): RecordsState {
  const [records, setRecords] = useState<TripRecord[]>([]);
  const [oldRecords, setOldRecords] = useState<Record<string, unknown>[]>([]);
  const [oldDebtors, setOldDebtors] = useState<OldDebtor[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [migrated, setMigrated] = useState<number | null>(null);
  const [tick, setTick] = useState(0);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setSheetError(null);

    (async () => {
      // ต้องย้ายข้อมูลจากเวอร์ชันเดิมให้เสร็จก่อนอ่าน ไม่งั้นรอบแรกจะได้ลิสต์ว่าง
      // แล้วผู้ใช้ต้องรีเฟรชเองถึงจะเห็นใบเก่า
      const mg = await migrateFromLocalStorage().catch(() => null);
      if (!alive) return;
      if (mg && !mg.alreadyDone && mg.migrated) setMigrated(mg.migrated);

      const local = await getAll().catch(() => [] as TripRecord[]);
      if (!alive) return;
      setRecords(local);

      if (!getUrl()) {
        setLoading(false);
        return;
      }

      // โหลดจากชีตแบบ best-effort — ล้มเหลวก็ยังใช้ข้อมูลในเครื่องต่อได้
      const [trips, old] = await Promise.allSettled([loadTrips(), loadOld()]);
      if (!alive) return;

      if (trips.status === "fulfilled") {
        setRecords(mergeRecords(local, trips.value));
      } else {
        setSheetError((trips.reason as Error).message);
      }

      if (old.status === "fulfilled") {
        setOldRecords(old.value.records);
        setOldDebtors(old.value.debtors as OldDebtor[]);
      } else if (trips.status === "fulfilled") {
        setSheetError((old.reason as Error).message);
      }

      setLoading(false);
    })();

    return () => { alive = false; };
  }, [tick]);

  return {
    records, oldRecords, oldDebtors, loading, sheetError, migrated,
    connected: !!getUrl(), reload,
  };
}
