# -*- coding: utf-8 -*-
import io, re

def patch(p, pairs):
    s = io.open(p, encoding="utf-8").read()
    for old, new in pairs:
        assert old in s, (p, old[:60])
        s = s.replace(old, new, 1)
    io.open(p, "w", encoding="utf-8", newline="\n").write(s)
    print("ok", p)

# ---- Debtors: ตารางค้างชำระ/ประวัติ แสดงทุกแถว เลื่อนในกล่อง
patch("features/debtors/Debtors.tsx", [
    ('import { thDateSafe', 'import GrowBox from "../../lib/ui/GrowBox";\nimport { thDateSafe'),
    ('''  const outstanding = rows.filter((r) => !r.paid);
  const paidRows = rows.filter((r) => r.paid);''',
     '''  // memo ไว้ให้ GrowBox รู้ว่าข้อมูลเปลี่ยนจริง ไม่ใช่แค่ render ซ้ำ
  const outstanding = useMemo(() => rows.filter((r) => !r.paid), [rows]);
  const paidRows = useMemo(() => rows.filter((r) => r.paid), [rows]);'''),
    ('''      <div className="scroll">
        <table className="rec-table">
          <thead><tr>
            <th>แหล่งข้อมูล</th><th>วันที่</th><th>เลขที่ใบรายการ</th><th>เลขที่บิล</th><th>ประเภทสินค้า</th>''',
     '''      <GrowBox rows={list} render={(shown) => (
        <table className="rec-table">
          <thead><tr>
            <th>แหล่งข้อมูล</th><th>วันที่</th><th>เลขที่ใบรายการ</th><th>เลขที่บิล</th><th>ประเภทสินค้า</th>'''),
    ('            {list.slice(0, 300).map((r) => (\n              <tr key={r.key} className={r.src === "เก่า" ? "oldrow" : undefined}>',
     '            {shown.map((r) => (\n              <tr key={r.key} className={r.src === "เก่า" ? "oldrow" : undefined}>'),
    ('''          </tbody>
        </table>
      </div>
      {list.length === 0 && (
        <div className="rec-empty">{pending ? "ไม่มีบิลค้างชำระ 🎉" : "ยังไม่มีบิลที่ชำระแล้ว"}</div>''',
     '''          </tbody>
        </table>
      )} />
      {list.length === 0 && (
        <div className="rec-empty">{pending ? "ไม่มีบิลค้างชำระ 🎉" : "ยังไม่มีบิลที่ชำระแล้ว"}</div>'''),
])

# ---- RecordsList: รายการทั้งหมด
patch("features/records/RecordsList.tsx", [
    ('import { duplicateRecord } from "../../lib/record/duplicate";',
     'import { duplicateRecord } from "../../lib/record/duplicate";\nimport GrowBox from "../../lib/ui/GrowBox";'),
    ('''      <div className="rec-card">
        <div className="scroll">
          <table className="rec-table">''',
     '''      <div className="rec-card">
        <GrowBox rows={list} render={(shown) => (
          <table className="rec-table">'''),
    ('              {list.slice(0, 300).map(({ r, locked }, i) => {',
     '              {shown.map(({ r, locked }, i) => {'),
    ('''            </tbody>
          </table>
        </div>
        {list.length === 0 && (
          <div className="rec-empty">''',
     '''            </tbody>
          </table>
        )} />
        {list.length === 0 && (
          <div className="rec-empty">'''),
    ('''        แสดง {Math.min(list.length, 300)} รายการ · ใหม่ {newCount} · เก่า {oldCount}
        {list.length > 300 && " · จำกัด 300 แถวแรก ใช้ช่องค้นหาเพื่อกรองให้แคบลง"}''',
     '''        ทั้งหมด {list.length.toLocaleString("th-TH")} รายการ · ใหม่ {newCount} · เก่า {oldCount} · เลื่อนในกล่องเพื่อดูต่อ'''),
])

# ---- SortTable (Executive/Dashboard รวม): เลิกจำกัด 300
patch("features/dash-costrev/common.tsx", [
    ('export function SortTable<T>({ rows, cols, sort, onSort, rowKey, empty, limit = 300 }: {\n  rows: T[]; cols: Col<T>[]; sort: { key: string; dir: 1 | -1 };\n  onSort: (key: string) => void; rowKey: (r: T, i: number) => string; empty: string; limit?: number;\n}) {\n  return (\n    <div className="scroll">\n      <table className="dz-tbl">',
     'export function SortTable<T>({ rows, cols, sort, onSort, rowKey, empty }: {\n  rows: T[]; cols: Col<T>[]; sort: { key: string; dir: 1 | -1 };\n  onSort: (key: string) => void; rowKey: (r: T, i: number) => string; empty: string;\n}) {\n  return (\n    <GrowBox rows={rows} render={(shown) => (\n      <table className="dz-tbl">'),
    ('''            <>
              {rows.slice(0, limit).map((r, i) => (
                <tr key={rowKey(r, i)}>
                  {cols.map((c) => (
                    <td key={c.key} className={c.num ? "n" : undefined}>
                      {c.render ? c.render(r) : (() => { const v = c.get(r); return typeof v === "number" ? fmt(v) : (v ?? "–"); })()}
                    </td>
                  ))}
                </tr>
              ))}
              {rows.length > limit && (
                <tr><td colSpan={cols.length} style={{ textAlign: "center", color: "var(--ink-faint)", padding: 10 }}>
                  …แสดง {fmt(limit)} รายการแรกจากทั้งหมด {fmt(rows.length)} รายการ · ใช้ตัวกรองเพื่อดูรายการอื่น
                </td></tr>
              )}
            </>
          )}
        </tbody>
      </table>
    </div>
  );
}''',
     '''            shown.map((r, i) => (
              <tr key={rowKey(r, i)}>
                {cols.map((c) => (
                  <td key={c.key} className={c.num ? "n" : undefined}>
                    {c.render ? c.render(r) : (() => { const v = c.get(r); return typeof v === "number" ? fmt(v) : (v ?? "–"); })()}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    )} />
  );
}'''),
])
