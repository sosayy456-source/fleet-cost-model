import { readFileSync, writeFileSync } from 'node:fs';
import { billTotalOf, billVolume } from '../../app/src/types/bill.ts';
import { yymm } from '../../app/src/lib/bill/number.ts';

// ใช้สูตรกลางของแอปเฉพาะตอนสร้างไฟล์ เว็บนำเสนออ่านผลลัพธ์อย่างเดียว
const input = JSON.parse(readFileSync(new URL('./scenario.input.json', import.meta.url), 'utf8'));
const routes = JSON.parse(readFileSync(new URL('../../app/src/lib/refdata/routes.json', import.meta.url), 'utf8'));
if (!routes[input.origin]?.[input.dest]) throw new Error('เส้นทางตัวอย่างไม่มีในแอป');
const bills = input.bills.map((b: Parameters<typeof billVolume>[0] & Parameters<typeof billTotalOf>[0], i: number) => ({
  ...b, id: `ตัวอย่าง-${i + 1}`, no: `5${yymm(input.date)}${String(90001 + i)}000`,
  date: input.date, dateDisplay: new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(input.date)), branch: input.branch, origin: input.origin, dest: input.dest,
  serviceGroup: 'สินค้าทั่วไป', payType: 'เชื่อต้นทาง', status: 'รอจัดรถ', docNo: '',
  volume: billVolume(b), total: billTotalOf(b), existing: i > 0,
}));
const scenario = {
  fictional: true, phase: 'V1',
  trip: { docNo: `6${yymm(input.date)}90001000`, date: input.date, branch: input.branch, from: input.origin, to: input.dest, revenue: bills.reduce((sum: number, b: { total: number }) => sum + b.total, 0) },
  bills,
};
writeFileSync(new URL('../src/data/scenario.json', import.meta.url), JSON.stringify(scenario, null, 2) + '\n');
console.log('สร้าง scenario บิลสมมติ 3 ใบด้วยสูตรของแอปแล้ว');
