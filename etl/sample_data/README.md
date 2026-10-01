# ไฟล์ตัวอย่าง

ข้อมูลตัวอย่างทั้งหมดของ ETL (`--dataset sample`) อยู่ที่นี่ — สุ่ม/anonymize แล้ว commit ขึ้น repo ได้

| ไฟล์/โฟลเดอร์ | ใช้โดย |
|---|---|
| `ExampleCost.xlsx` | ต้นทุนรายเที่ยว · `build_costrev.py` · `build_alloc.py` |
| `revenue/bill_*.xlsx` | บิลรายได้ · `build_costrev.py` · `build_alloc.py` · `build_json.py` (ย้ายมาจาก `RevenueDashboard/RevenueDashboard/sample_data/` 1 ต.ค. 2569 ตอนลบแอป Streamlit เดิม) |
| `LoadFactor/` | Load Factor · `build_loadfactor.py` |
| `ExampleDebtors_Randomed.xlsx` | ลูกหนี้ · `build_debtors.py` (สร้างด้วย `gen_sample_debtors.py`) |

ไฟล์ชื่อมี `.backup.` และไฟล์ล็อก `~$` ถูก ETL ข้ามเอง

ถ้าจะวางไฟล์ตัวอย่างชุดใหม่ที่นี่ ต้องเป็นข้อมูลที่ anonymize แล้วเท่านั้น
เพราะโฟลเดอร์นี้ commit ขึ้น repo สาธารณะ
