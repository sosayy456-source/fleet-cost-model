/**
 * ช่องเลือกรถ ประเภทรถ → ชนิดรถ → ทะเบียน — ใช้ร่วมหน้า "จัดรถ" กับส่วน Fleet Coordinator ของ "บันทึกข้อมูลรวม"
 * ชุดเดียวกันทั้งหัวและหางพ่วง (เจ้าของงานสั่ง 24 ก.ย. 2569) · ย้ายออกมาจาก DispatchPage.tsx
 */
import { ROSTER_FLEET_TYPES, isTrailerKind } from "../../lib/refdata";
import { kindsOf } from "../../lib/store/roster";
import type { FleetKind, FleetVehicle } from "../../lib/store/roster";

/**
 * คู่ประเภท/ชนิดของคันนี้ในบทบาทที่ใช้ (หัว หรือ หาง) — คันเดียวเคยวิ่งได้ทั้งสองแบบ (ชม.71-2752 เป็นทั้ง
 * หางพ่วงคอกและรถ 10 ล้อ) · ตรงตัวกรองก่อน → คู่หลักของคัน → คู่แรกที่เจอ
 */
export function roleKind(v: FleetVehicle, trailer: boolean, want: { fleetType?: string; vehicle?: string } = {}): FleetKind | null {
  const ks = kindsOf(v).filter((k) => isTrailerKind(k.vehicle) === trailer);
  return ks.find((k) => (!want.fleetType || k.fleetType === want.fleetType) && (!want.vehicle || k.vehicle === want.vehicle))
    ?? ks.find((k) => k.vehicle === v.vehicle) ?? ks[0] ?? null;
}

/** คันนี้เป็นหัว/หางตามตัวเลือกประเภท/ชนิดได้ไหม — ค่าว่าง = ไม่กรองมิตินั้น */
export const fitsRole = (v: FleetVehicle, trailer: boolean, fleetType: string, vehicle: string): boolean =>
  kindsOf(v).some((k) => isTrailerKind(k.vehicle) === trailer
    && (!fleetType || k.fleetType === fleetType) && (!vehicle || k.vehicle === vehicle));

export interface VehiclePick { fleetType: string; vehicle: string; plate: string }
export const P0: VehiclePick = { fleetType: "", vehicle: "", plate: "" };

/** ตัวเลือกของทะเบียนนี้ในบทบาทนั้น — ใช้ตั้งค่าเริ่มของช่องเมื่อเปิดใบเดิม (ไม่เจอคัน = ว่าง) */
export function pickOf(pool: FleetVehicle[], trailer: boolean, plate: string, vehicle = ""): VehiclePick {
  const v = pool.find((x) => x.plate === plate);
  const k = v ? roleKind(v, trailer, { vehicle }) : null;
  return v && k ? { fleetType: k.fleetType, vehicle: k.vehicle, plate: v.plate } : P0;
}

/** ช่องเลือก ประเภทรถ · ชนิดรถ · ทะเบียน ของรถหนึ่งบทบาท (หัว/หาง) — เปลี่ยนตัวบนแล้วล้างตัวล่างที่ไม่เข้ากัน */
export function VehiclePickFields({ pick, setPick, pool, trailer, kindNames, anyKind, plateLabel, noneLabel, disabled }: {
  pick: VehiclePick; setPick: (p: VehiclePick) => void; pool: FleetVehicle[]; trailer: boolean;
  kindNames: readonly string[]; anyKind: string; plateLabel: string; noneLabel: (n: number) => string;
  disabled?: boolean;
}) {
  const cur = pool.find((v) => v.plate === pick.plate) ?? null;
  const ftOpts = ROSTER_FLEET_TYPES.filter((ft) => pool.some((v) => fitsRole(v, trailer, ft, "")));
  const vkOpts = kindNames.filter((n) => pool.some((v) => fitsRole(v, trailer, pick.fleetType, n)));
  const choices = pool.filter((v) => fitsRole(v, trailer, pick.fleetType, pick.vehicle));
  return (
    <>
      <div className="f"><label>ประเภทรถ</label>
        <select value={pick.fleetType} disabled={disabled} onChange={(e) => {
          const fleetType = e.target.value;
          // ชนิด/ทะเบียนเดิมที่ไม่เข้ากับประเภทใหม่ = ล้างทิ้ง ไม่งั้นช่องค้างค่าที่เลือกไม่ได้
          const vehicle = pick.vehicle && pool.some((v) => fitsRole(v, trailer, fleetType, pick.vehicle)) ? pick.vehicle : "";
          setPick({ fleetType, vehicle, plate: cur && fitsRole(cur, trailer, fleetType, vehicle) ? pick.plate : "" });
        }}>
          <option value="">ทุกประเภทรถ</option>
          {ftOpts.map((ft) => <option key={ft} value={ft}>{ft}</option>)}
        </select></div>
      <div className="f"><label>ชนิดรถ</label>
        <select value={pick.vehicle} disabled={disabled} onChange={(e) => {
          const vehicle = e.target.value;
          setPick({ ...pick, vehicle, plate: cur && fitsRole(cur, trailer, pick.fleetType, vehicle) ? pick.plate : "" });
        }}>
          <option value="">{anyKind}</option>
          {vkOpts.map((n) => <option key={n} value={n}>{n}</option>)}
        </select></div>
      <div className="f"><label>{plateLabel}</label>
        <select value={pick.plate} disabled={disabled} onChange={(e) => {
          const v = pool.find((x) => x.plate === e.target.value);
          // เลือกทะเบียนก่อนเลือกประเภท/ชนิด = เติมสองช่องนั้นจากทะเบียนให้เลย
          const k = v ? roleKind(v, trailer, pick) : null;
          setPick(v && k ? { fleetType: k.fleetType, vehicle: k.vehicle, plate: v.plate } : { ...pick, plate: "" });
        }}>
          <option value="">{noneLabel(choices.length)}</option>
          {choices.map((v) => {
            const k = roleKind(v, trailer, pick);
            return <option key={v.plate} value={v.plate}>{v.plate} · {k?.vehicle} ({k?.fleetType})</option>;
          })}
        </select></div>
    </>
  );
}
