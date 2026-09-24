"""น้ำหนักต่อแถวบิลของ build_costrev.line_weight_kg (กติกาที่เจ้าของงานเคาะ 23 ก.ย. 2569)"""
from build_costrev import line_weight_kg


def test_ยึดน้ำหนักรวมในไฟล์แม้ไม่ตรงกับผลคูณ():
    assert line_weight_kg(2, 1753, 1753) == 1753
    assert line_weight_kg(196, 9800, 9800) == 9800
    assert line_weight_kg(2, 30, 2) == 2


def test_น้ำหนักรวมเป็นศูนย์เติมจากจำนวนคูณน้ำหนักต่อหน่วย():
    assert line_weight_kg(12, 25, 0) == 300


def test_ไม่มีข้อมูลเลยได้ศูนย์():
    assert line_weight_kg(22, 0, 0) == 0
    assert line_weight_kg(0, 10, 0) == 0
    assert line_weight_kg(0, 0, -3) == 0
