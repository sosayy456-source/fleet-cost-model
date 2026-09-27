"""รายได้และต้นทุนรายเที่ยวต้องตรงกับรายการที่นับเข้ากำไรลูกค้า"""

from build_costrev import BillProfitAcc
from src.alloc import Item, allocate_trip, exclusion_of, payer_of


def test_กำไรเที่ยวใช้เฉพาะบิลที่เข้าลูกค้าและปันต้นทุนตรงกัน():
    routes = {"ก": {"ข": 100.0}}
    items = [
        Item(doc="D1", bill="B1", origin="ก", dest="ข", weight=1000,
             revenue=1200, payment="สดต้นทาง", sender="C1", goods="สินค้า"),
        Item(doc="D1", bill="B2", origin="ก", dest="ข", weight=500,
             revenue=300, payment="สดต้นทาง", sender="C2", goods="บิลเคลียร์"),
        Item(doc="D1", bill="B3", origin="ก", dest="ข", weight=200,
             revenue=180, payment="", goods="สินค้า"),
    ]
    cost = 900.0
    expected = allocate_trip(items, cost, routes, cf=250.0)
    kept = [it for it in expected.items if not exclusion_of(it) and payer_of(it)[1]]

    acc = BillProfitAcc(routes, {"D1": "ของย่อย"}, {"D1": 250.0})
    for it in items:
        acc.add(it)
    revenue, net_cost = acc.totals("D1", cost)

    assert revenue == sum(it.revenue for it in kept)
    assert abs(net_cost - sum(it.alloc for it in kept)) < 0.01
