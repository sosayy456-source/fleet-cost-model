/**
 * เลือกชุดข้อมูลตอนรัน — real ถ้ามีไฟล์ที่ ETL สร้างไว้ ไม่งั้น sample
 *
 * เดิมต้องตั้ง VITE_DATASET=real ตอนสตาร์ท dev server ซึ่งต้องพิมพ์ env แบบ PowerShell
 * ปิด server เก่า แล้วเปิดใหม่ทุกครั้ง — ยากเกินไปสำหรับงานที่ทำบ่อย
 * ตอนนี้แอปตรวจเองจาก public/data/real/manifest.json: มี = real / ไม่มี = sample
 * และตรวจซ้ำทุกครั้งที่กดรีเฟรชข้อมูล จึงวางไฟล์ตอน server รันอยู่ก็เห็นผลได้
 *
 * VITE_DATASET ยังบังคับได้ถ้าตั้งไว้ — workflow deploy ตั้ง sample เสมอ
 * (และไฟล์ใต้ public/data/real/ ติด .gitignore จึงไม่มีทางขึ้น Pages อยู่แล้ว)
 *
 * ★ Vite dev ตอบ 200 + text/html ให้ทุก path ที่ไม่มีไฟล์ (SPA fallback)
 *   ดูแค่ status ไม่ได้ ต้องเช็ค content-type ว่าเป็น json ด้วย ไม่งั้นจะนึกว่ามี real ตลอด
 */
import { useEffect, useState } from "react";

export type DatasetName = "sample" | "real";

const FORCED = (import.meta.env.VITE_DATASET as string | undefined) as DatasetName | undefined;
const BASE = import.meta.env.BASE_URL;

/** path ของไฟล์ข้อมูลที่ ETL สร้าง (เคารพ base ของ Vite) */
export const dataUrl = (dataset: DatasetName, file: string) => `${BASE}data/${dataset}/${file}`;

let resolved: DatasetName | null = FORCED ?? null;
let probe: Promise<DatasetName> | null = null;

/** เหตุการณ์ของหน้าต่างเดียวกัน — ให้แถบ "ข้อมูลตัวอย่าง" ใน App รู้ตัวเมื่อชุดข้อมูลเปลี่ยน */
const EV = "dataset:changed";

async function detect(): Promise<DatasetName> {
  try {
    const res = await fetch(dataUrl("real", "manifest.json"), { cache: "no-store" });
    const isJson = (res.headers.get("content-type") ?? "").includes("json");
    return res.ok && isJson ? "real" : "sample";
  } catch {
    return "sample";
  }
}

/** ชุดข้อมูลที่จะใช้ — ตรวจครั้งเดียวแล้วจำไว้ จนกว่าจะ resetDataset() */
export function resolveDataset(): Promise<DatasetName> {
  if (resolved) return Promise.resolve(resolved);
  probe ??= detect().then((d) => {
    const changed = d !== resolved;
    resolved = d;
    probe = null;
    if (changed) dispatchEvent(new Event(EV));
    return d;
  });
  return probe;
}

/** ให้ตรวจใหม่รอบหน้า — เรียกตอนกดรีเฟรชข้อมูล เผื่อเพิ่งรัน ETL ครั้งแรก */
export function resetDataset(): void {
  if (FORCED) return;
  resolved = null;
}

/** ชุดข้อมูลที่รู้แล้ว ณ ตอนนี้ (null = ยังไม่ได้ตรวจ) — สำหรับที่ที่เรียกแบบ synchronous */
export const peekDataset = (): DatasetName | null => resolved;

/** สำหรับแถบเตือนใน App — อัปเดตเองเมื่อชุดข้อมูลเปลี่ยนหลังรีเฟรช */
export function useActiveDataset(): { dataset: DatasetName | null; isSample: boolean } {
  const [dataset, setDataset] = useState<DatasetName | null>(resolved);
  useEffect(() => {
    let alive = true;
    resolveDataset().then((d) => { if (alive) setDataset(d); });
    const on = () => setDataset(resolved);
    addEventListener(EV, on);
    return () => { alive = false; removeEventListener(EV, on); };
  }, []);
  // ยังไม่รู้ = ถือว่าเป็นตัวอย่างไว้ก่อน ปลอดภัยกว่าโชว์ว่าเป็นยอดจริงทั้งที่ยังไม่แน่
  return { dataset, isSample: dataset !== "real" };
}
