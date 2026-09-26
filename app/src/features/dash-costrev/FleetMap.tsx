/**
 * แผนที่ตำแหน่งรถ — การ์ดแผนที่ในหน้า "สถานะกองรถ" (dash-fleet/FleetDash.tsx › StatusPane · เจ้าของงานสั่ง 26 ก.ย. 2569)
 * ข้อมูลชุดเดียวกับตาราง "สถานะรายคัน" — หน้าเป็นคนนับรถต่อจุดแล้วส่งมา ที่นี่แค่ฝังแผนที่
 *
 * ใช้แอปแผนที่ตัวเดียวกับ Demo › กำไรรายเส้นทาง (`map/` build ลง `public/map/` · ฝังผ่าน iframe แบบ dash-demo/RouteMap.tsx)
 * คุยกันด้วย postMessage (ดูหัวข้อ "ตำแหน่งรถปัจจุบัน" ท้าย map/src/map.js):
 *   หน้านี้ → แผนที่   map:fleet { stops, labels, routes } (จำนวนรถต่อจุด · routes = ต้นทาง → ปลายทางของรถกำลังเดินทาง) · map:fleetSel { stop, zoom? } (ไฮไลต์วง · zoom = ซูมไปกลุ่มของจุด)
 *                      map:view { view } (สลับมุมมอง ทั้งหมด/ภาคเหนือ/กทม. — ปุ่มในหน้า · แก้จุด กทม. กระจุก 26 ก.ย. 2569)
 *   แผนที่ → หน้านี้   map:ready · map:stop { stop } (กดวง · null = เลิกเลือก) · map:fleetMissing { names } (จุดที่ไม่มีพิกัด)
 *                      map:view { view } (แผนที่ซูมเองตาม map:fleetSel zoom — ให้ปุ่มในหน้าตรงกัน)
 * ★ ข้อความที่ส่งก่อน map:ready หายไปเฉย ๆ — ต้องรอสัญญาณก่อนส่ง (เหมือน RouteMap)
 */
import { useEffect, useRef, useState } from "react";
import { MapZoomButtons } from "../dash-demo/RouteMap";

/** จำนวนรถต่อจุด — สีวงบนแผนที่: ready เขียว · moving น้ำเงิน · upcoming ส้ม · stale เทา (FLEET_COL ใน map.js) */
export interface MapStop { stop: string; total: number; ready?: number; moving?: number; upcoming?: number; stale?: number }
/** เส้นทางของรถที่กำลังเดินทาง — แผนที่วาดเส้นประน้ำเงินตามถนน · n = จำนวนรถ (ความหนาเส้น) */
export interface MapRoute { from: string; to: string; n: number }
export type MapStopLabels = Partial<Record<"ready" | "moving" | "upcoming" | "stale", string>>;
/** สีเดียวกับวงบนแผนที่ — ใช้ทำคำอธิบายสีในหน้า */
export const MAP_COLOR = { ready: "#0f8a5f", moving: "#1a73e8", upcoming: "#e37400", stale: "#9aa0a6" } as const;
/** มุมมองแผนที่ — all = ทุกจุด · north / bkk = กรอบของจุดกลุ่มนั้น (group ใน map/src/network.js) */
export type MapView = "all" | "north" | "bkk";
/** คำสั่งครั้งเดียวถึงแผนที่ — เปลี่ยน id ทุกครั้ง (ส่งผ่าน effect ตาม identity) */
export type MapCmd = { id: number } & ({ type: "view"; view: MapView } | { type: "zoomTo"; stop: string });

/**
 * ?v= กันแคช index.html ของแผนที่รุ่นก่อน (เหตุผลเดียวกับ RouteMap)
 * ไม่ใส่ #thai (ต่างจาก RouteMap) — มุมมองทั้งประเทศทำให้จุดในภาคเหนือกับ กทม. ซ้อนกันจนอ่านไม่ออก
 * ไม่มี #thai แผนที่ครอบเฉพาะช่วงที่มีจุดขึ้นลง (fitAllStops) · ซูมเพิ่มได้ด้วย Ctrl + ล้อเมาส์
 * ★ โหมดขาวอย่างเดียว — โหมดดำ (#dark) ออกแบบคู่กับ #thai ถ้าไม่มี #thai ทะเล/ประเทศเพื่อนบ้านยังสีอ่อนและตัวเลขในวงกลืนพื้น
 */
const SRC = () => `${import.meta.env.BASE_URL}map/index.html?v=${Date.now()}#embed&bare&tab=top`;

export default function FleetMap({ stops, routes, labels, sel, onSel, onMissing, cmd, onView }: {
  /** memo ไว้ ไม่งั้นแผนที่วาดใหม่ทุก render */
  stops: MapStop[];
  /** memo ไว้เหมือน stops */
  routes: MapRoute[];
  /** ค่าคงที่ — ชื่อสถานะในป้ายตอนชี้วง */
  labels: MapStopLabels;
  sel: string | null;
  onSel: (stop: string | null) => void;
  onMissing: (names: string[]) => void;
  /** คำสั่งล่าสุด (สลับมุมมอง / ซูมไปจุด) — null = ยังไม่มี */
  cmd: MapCmd | null;
  /** แผนที่ซูมเองไปกลุ่มของจุดที่สั่ง zoomTo — แจ้งมุมมองให้ปุ่มในหน้าตรงกัน */
  onView: (view: MapView) => void;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [src] = useState(SRC);
  const [ready, setReady] = useState(false);
  // callback ล่าสุดใน ref — ตัวฟังข้อความผูกครั้งเดียว
  const cb = useRef({ onSel, onMissing, onView });
  cb.current = { onSel, onMissing, onView };

  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow || !e.data) return;
      if (e.data.type === "map:ready") setReady(true);
      if (e.data.type === "map:stop") cb.current.onSel(e.data.stop ?? null);
      if (e.data.type === "map:fleetMissing") cb.current.onMissing(e.data.names ?? []);
      if (e.data.type === "map:view") cb.current.onView(e.data.view);
    };
    window.addEventListener("message", on);
    return () => window.removeEventListener("message", on);
  }, []);

  const post = (msg: object) => frame.current?.contentWindow?.postMessage(msg, "*");
  useEffect(() => {
    if (ready) post({ type: "map:fleet", labels, routes, stops: stops.map((s) => ({ name: s.stop, ...s })) });
  }, [ready, stops, routes, labels]);
  useEffect(() => { if (ready) post({ type: "map:fleetSel", stop: sel }); }, [ready, sel, stops]);
  useEffect(() => {
    if (!ready || !cmd) return;
    if (cmd.type === "view") post({ type: "map:view", view: cmd.view });
    else post({ type: "map:fleetSel", stop: cmd.stop, zoom: true });
  }, [ready, cmd]);

  return (
    <div className="rp-map">
      <iframe ref={frame} src={src} title="แผนที่ตำแหน่งรถ" loading="lazy" />
      {!ready && <div className="rp-map-wait">กำลังโหลดแผนที่…</div>}
      {/* กลับมุมเริ่มต้น = มุมมอง "ทั้งหมด" — แผนที่ส่ง map:view กลับ ปุ่มมุมมองในหน้าจึงเปลี่ยนตาม (onView) */}
      <MapZoomButtons ready={ready} post={post} />
    </div>
  );
}
