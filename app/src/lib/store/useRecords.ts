/**
 * โหลดใบรายการจากทุกแหล่งมารวมกัน — ใช้ร่วมกันทุกหน้า
 *
 *   เครื่อง (IndexedDB) : ใบที่กรอกเองและยังไม่ได้ sync
 *   ชีต loadTrips       : ใบ "ใหม่" ที่ฝ่ายอื่นกรอกไว้ผ่านฟอร์มแอป (มีคอลัมน์ _DATA)
 *   ชีต loadOld         : อ่านอย่างเดียว — ข้อมูลเก่าจากแท็บ "ข้อมูลเก่า*" รวมทั้งแถวในแท็บ
 *                         "ข้อมูลใหม่" ที่พิมพ์ตรงในชีตเอง (ไม่ผ่านฟอร์ม จึงไม่มี _DATA)
 *
 * ใบเดียวกันอาจอยู่ทั้งในเครื่องและบนชีต — ถือว่าของบนชีตใหม่กว่าเสมอ
 * ยกเว้นใบที่ยังไม่ได้ sync (synced=false) ซึ่งของในเครื่องใหม่กว่า
 */
import { useCallback, useEffect, useState } from "react";
import { getUrl, loadOld, loadTrips } from "../sheet/client";
import { loadCostRevOld } from "../data/useCostRev";
import { getAll, migrateFromLocalStorage } from "./records";
import type { TripRecord } from "../../types/record";

const OLD_CACHE_KEY = "oldRecordsCache";

/**
 * แคช oldRecords/oldDebtors ไว้ในเครื่อง — loadOld() ไล่อ่านทุกแท็บ "ข้อมูลเก่า*" ผ่าน Apps Script
 * ซึ่งช้า (cold start + สแกนหลายแท็บ) ต่างจากหน้าอื่นที่ใช้ไฟล์ JSON จาก ETL
 * เก็บผลลัพธ์ล่าสุดไว้โชว์ค้างก่อนตั้งแต่ render แรก แทนที่จะรอโหลดสดทุกครั้งที่เปิดแอป/กดรีเฟรช
 */
function readOldCache(): { records: Record<string, unknown>[]; debtors: OldDebtor[] } {
  try {
    const v = JSON.parse(localStorage.getItem(OLD_CACHE_KEY) ?? "null");
    if (v && Array.isArray(v.records) && Array.isArray(v.debtors)) return v;
  } catch { /* โควตาเต็ม/private mode — ไม่มีแคชก็แค่โหลดสดตามปกติ */ }
  return { records: [], debtors: [] };
}

function writeOldCache(records: Record<string, unknown>[], debtors: OldDebtor[]): void {
  try {
    localStorage.setItem(OLD_CACHE_KEY, JSON.stringify({ records, debtors }));
  } catch { /* โควตาเต็ม — ข้ามการแคชรอบนี้ ไม่กระทบการทำงาน */ }
}

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
  /** แถวอ่านตรงจากชีต (ข้อมูลเก่า + ข้อมูลใหม่ที่พิมพ์ตรงในชีตเอง) — ไม่มี bills, แยกด้วย r.source */
  oldRecords: Record<string, unknown>[];
  oldDebtors: OldDebtor[];
  /**
   * "ข้อมูลเก่า" จากไฟล์ต้นทุน+รายได้ (etl/build_costrev.py) — เที่ยวที่เลขที่ใบรายการตรงกับ
   * ข้อมูลรายได้จริง และบิลของเที่ยวเหล่านั้นจากไฟล์รายได้
   * หน้ารายการทั้งหมดกับหน้าลูกหนี้ใช้ชุดนี้แทนแท็บ "ข้อมูลเก่า*" ในชีต
   * ★ แดชบอร์ดเดิม (dash-fleet) ยังใช้ oldRecords/oldDebtors จากชีตตามเดิม ไม่แตะ
   */
  fileOld: { records: TripRecord[]; debtors: OldDebtor[] };
  loading: boolean;
  /** ข้อความบอกว่าโหลดจากชีตไม่ได้ ไม่ถือว่าพัง — ยังใช้ข้อมูลในเครื่องได้ */
  sheetError: string | null;
  /** จำนวนใบที่เพิ่งย้ายมาจาก localStorage ของเวอร์ชันเดิม — null = ไม่ได้ย้ายรอบนี้ */
  migrated: number | null;
  connected: boolean;
  /**
   * โหลดใหม่ทุกแหล่ง — ปุ่ม "↻ รีเฟรช" · `loading` ปลดทันทีที่ loadTrips (เร็ว) เสร็จ
   * ส่วนแท็บข้อมูลเก่า (ช้า) วิ่งเบื้องหลังเงียบ ๆ แล้วอัปเดต oldRecords/oldDebtors ทีหลัง
   * ไม่บล็อก loading — ระหว่างรอจะยังเห็นค่าที่แคชไว้ล่าสุดค้างอยู่ (ดู readOldCache/writeOldCache)
   */
  reload: () => void;
  /**
   * โหลดเฉพาะใบใหม่ (เครื่อง + loadTrips) ไม่อ่านแท็บข้อมูลเก่า — เรียกอัตโนมัติตอนเลือก/เปลี่ยนหน้าที่
   * เปลี่ยนเมนู บันทึกเสร็จ และกลับมาที่แท็บเบราว์เซอร์ ใบที่ฝ่ายก่อนหน้าเพิ่งบันทึกจึงขึ้นเองโดยไม่ต้องกดรีเฟรช
   */
  refresh: () => void;
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
  const [oldRecords, setOldRecords] = useState<Record<string, unknown>[]>(() => readOldCache().records);
  const [oldDebtors, setOldDebtors] = useState<OldDebtor[]>(() => readOldCache().debtors);
  const [fileOld, setFileOld] = useState<RecordsState["fileOld"]>({ records: [], debtors: [] });
  const [loading, setLoading] = useState(true);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [migrated, setMigrated] = useState<number | null>(null);
  const [tick, setTick] = useState(0);

  const [liteTick, setLiteTick] = useState(0);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  const refresh = useCallback(() => setLiteTick((t) => t + 1), []);

  // โหลดแบบเบา — ข้ามรอบแรก (tick ข้างล่างโหลดครบอยู่แล้ว)
  useEffect(() => {
    if (liteTick === 0) return;
    let alive = true;
    setLoading(true);
    (async () => {
      // migration เรียกซ้ำได้ (ครั้งถัดไปจบทันที) — ต้องรอให้จบก่อนอ่าน IndexedDB เหมือนรอบเต็ม
      await migrateFromLocalStorage().catch(() => null);
      const local = await getAll().catch(() => [] as TripRecord[]);
      if (!alive) return;
      if (!getUrl()) {
        setRecords(local);
        setLoading(false);
        return;
      }
      try {
        const trips = await loadTrips();
        if (!alive) return;
        setRecords(mergeRecords(local, trips));
        setSheetError(null);
      } catch (err) {
        if (!alive) return;
        // ชีตล่ม — ยังแสดงของในเครื่องล่าสุด (รวมใบที่เพิ่งบันทึก) แทนที่จะค้างของเก่า
        setRecords((prev) => mergeRecords(local, prev.filter((r) => r.synced !== false)));
        setSheetError((err as Error).message);
      }
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [liteTick]);

  // กลับมาที่แท็บนี้ (สลับไปทำอย่างอื่นมา) — ฝ่ายอื่นอาจบันทึกไปแล้ว · เว้นอย่างน้อย 15 วินาทีต่อครั้ง
  useEffect(() => {
    let last = 0;
    const on = () => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - last < 15_000) return;
      last = now;
      refresh();
    };
    document.addEventListener("visibilitychange", on);
    return () => document.removeEventListener("visibilitychange", on);
  }, [refresh]);

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

      // ข้อมูลเก่าจากไฟล์ — ไม่ต้องมีชีตก็โหลดได้ (คืนค่าว่างถ้ายังไม่รัน ETL)
      loadCostRevOld().then((fo) => {
        if (alive) setFileOld({ records: fo.records as TripRecord[], debtors: fo.debtors as OldDebtor[] });
      });

      if (!getUrl()) {
        setLoading(false);
        return;
      }

      // ข้อมูลใหม่ (loadTrips) เร็ว — ปลดล็อกหน้าทันทีที่เสร็จ ไม่ต้องรอข้อมูลเก่า
      loadTrips()
        .then((trips) => { if (alive) setRecords(mergeRecords(local, trips)); })
        .catch((err) => { if (alive) setSheetError((err as Error).message); })
        .finally(() => { if (alive) setLoading(false); });

      // ข้อมูลเก่า (loadOld) ช้า — ไล่อ่านทุกแท็บ "ข้อมูลเก่า*" ผ่าน Apps Script
      // แยกเป็นงานเบื้องหลัง ไม่บล็อกหน้าจอ ระหว่างรอใช้ค่าที่แคชไว้ (จาก state เริ่มต้น) ไปพลาง
      loadOld()
        .then((old) => {
          if (!alive) return;
          setOldRecords(old.records);
          setOldDebtors(old.debtors as OldDebtor[]);
          writeOldCache(old.records, old.debtors as OldDebtor[]);
        })
        .catch(() => { /* ใช้ค่าที่แคชไว้ต่อไปเงียบ ๆ — ไม่ทับ sheetError ของ loadTrips */ });
    })();

    return () => { alive = false; };
  }, [tick]);

  return {
    records, oldRecords, oldDebtors, fileOld, loading, sheetError, migrated,
    connected: !!getUrl(), reload, refresh,
  };
}
