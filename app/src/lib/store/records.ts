/**
 * ที่เก็บใบรายการในเครื่อง
 *
 * ย้ายจาก localStorage มาเป็น IndexedDB เพราะ localStorage มีเพดานราว 5 MB
 * ซึ่งคีย์ tripRecords ของเดิมโตทะลุได้ง่ายเมื่อใบเยอะ แล้วจะ throw ตอน setItem
 * ทำให้ข้อมูลที่เพิ่งกรอกหายแบบเงียบ ๆ
 *
 * ยังอ่านคีย์เดิมของ v5 ได้อยู่ และย้ายให้อัตโนมัติครั้งแรกที่เปิด
 */
import type { TripRecord } from "../../types/record";

const DB_NAME = "fleet-cost-model";
const DB_VERSION = 1;
const STORE = "records";

/** คีย์เดิมใน localStorage ของ v5 */
export const LEGACY_KEYS = {
  records: "tripRecords",
  url: "gsWebAppUrl",
  role: "modelRole",
  fuelPrices: "fuelPriceUpdates",
  repair: "repairOverrides",
  fleet: "fleetRoster",
  custCodes: "custNewCodes",
} as const;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const os = db.createObjectStore(STORE, { keyPath: "id" });
        os.createIndex("docNo", "docNo", { unique: false });
        os.createIndex("date", "date", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = fn(t.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

export const getAll = (): Promise<TripRecord[]> =>
  tx<TripRecord[]>("readonly", (s) => s.getAll());

export const getById = (id: string): Promise<TripRecord | undefined> =>
  tx<TripRecord | undefined>("readonly", (s) => s.get(id));

export const put = (rec: TripRecord): Promise<IDBValidKey> =>
  tx<IDBValidKey>("readwrite", (s) => s.put(rec));

export const remove = (id: string): Promise<undefined> =>
  tx<undefined>("readwrite", (s) => s.delete(id));

export async function putMany(recs: TripRecord[]): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction(STORE, "readwrite");
    const os = t.objectStore(STORE);
    for (const r of recs) os.put(r);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

export async function findByDocNo(docNo: string): Promise<TripRecord | undefined> {
  const all = await getAll();
  return all.find((r) => r.docNo === docNo);
}

// ───────────────────────────── ย้ายข้อมูลจาก v5 ─────────────────────────────

export interface MigrationResult {
  migrated: number;
  skipped: number;
  alreadyDone: boolean;
}

const MIGRATION_FLAG = "idbMigratedFrom.v5";

/**
 * ย้าย tripRecords จาก localStorage เข้า IndexedDB ครั้งเดียว
 * ไม่ลบของเดิมทิ้ง เผื่อผู้ใช้ยังต้องเปิดไฟล์ v5.html คู่กันช่วงเปลี่ยนผ่าน
 */
export async function migrateFromLocalStorage(): Promise<MigrationResult> {
  if (localStorage.getItem(MIGRATION_FLAG)) {
    return { migrated: 0, skipped: 0, alreadyDone: true };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(localStorage.getItem(LEGACY_KEYS.records) || "[]");
  } catch {
    parsed = [];
  }

  const list = Array.isArray(parsed) ? (parsed as TripRecord[]) : [];
  const valid = list.filter((r) => r && typeof r.id === "string" && r.id);
  if (valid.length) await putMany(valid);

  localStorage.setItem(MIGRATION_FLAG, new Date().toISOString());
  return { migrated: valid.length, skipped: list.length - valid.length, alreadyDone: false };
}

/** อ่านค่าที่ผู้ใช้แก้เอง (ราคาน้ำมัน / ตารางค่าซ่อม) จากคีย์เดิมของ v5 */
export function readLegacyOverrides(): {
  prices?: Record<string, number>;
  repair?: unknown;
} {
  const read = (k: string) => {
    try {
      return JSON.parse(localStorage.getItem(k) || "null");
    } catch {
      return null;
    }
  };
  const prices = read(LEGACY_KEYS.fuelPrices);
  const repair = read(LEGACY_KEYS.repair);
  return {
    ...(prices && typeof prices === "object" ? { prices } : {}),
    ...(repair && typeof repair === "object" ? { repair } : {}),
  };
}
