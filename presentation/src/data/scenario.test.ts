import { describe, it, expect } from 'vitest';
import { billTotalOf, billVolume } from '../../../app/src/types/bill';
import { yymm } from '../../../app/src/lib/bill/number';
import scenario from './scenario.json';
describe('ข้อมูลบิลสมมติจากสูตรจริง', () => {
  it('ปริมาตรและราคารวมตรงกับสูตรที่แอปใช้ทุกบิล', () => {
    for (const bill of scenario.bills) { expect(bill.volume).toBe(billVolume(bill)); expect(bill.total).toBe(billTotalOf(bill)); }
    expect(scenario.bills[0].volume).toBe(4.8);
    expect(scenario.bills[0].total).toBe(3400);
  });
  it('รายได้รวมตรงกันและบิลยังไม่มีเลขที่ใบรายการก่อนจัดรถ', () => {
    expect(scenario.bills.reduce((s,b)=>s+b.total,0)).toBe(scenario.trip.revenue);
    expect(scenario.bills.every(b=>b.docNo === '' && b.status === 'รอจัดรถ')).toBe(true);
    expect(scenario.bills.filter(b=>b.existing)).toHaveLength(2);
  });
  it('เลขสมมติไม่ซ้ำ มี 13 หลักและปีเดือนตรงรูปแบบแอป', () => {
    const nos = scenario.bills.map(b=>b.no);
    expect(new Set(nos).size).toBe(3);
    for (const no of nos) expect(no).toMatch(new RegExp(`^5${yymm(scenario.trip.date)}\\d{8}$`));
    expect(scenario.trip.docNo).toMatch(/^6\d{12}$/);
    expect(scenario.fictional).toBe(true);
  });
});
