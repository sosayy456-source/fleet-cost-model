import * as d3 from "d3";
import "./dashboard.css";

/* ------------------------------------------------------------------
   ตัวอย่าง dashboard เที่ยวเปล่า + แผนที่ (index.html ฝังผ่าน iframe)
   ★ ตัวเลขด้านล่างเป็นค่าประมาณที่อ่านจากกราฟเดิม — แทนที่ด้วยข้อมูลจริง
   ชื่อจุดต้นทาง/ปลายทางต้องตรงกับ STOPS ใน src/network.js แผนที่จึงวาดเส้นได้
   ------------------------------------------------------------------ */

// % ต้นทุนเที่ยวเปล่า ÷ ต้นทุนวิ่งรถทั้งหมด (partial = ปีที่ข้อมูลยังไม่ครบ)
const TREND = [
  { year: 2567, pct: 3.1 },
  { year: 2568, pct: 2.3 },
  { year: 2569, pct: 2.2, partial: true }
];

// เส้นทางเที่ยวเปล่า: รวม Top 10 จำนวนเที่ยว และ Top 10 ต้นทุน ไว้ในตารางเดียว
// null = เส้นทางนี้ไม่ติด Top 10 ของตัวชี้วัดนั้น (ไม่มีตัวเลขในกราฟเดิม)
const ROUTES = [
  { from: "ท่าลี่",    to: "กองลอย",   trips: 133,  cost: 1260000 },
  { from: "เชียงใหม่", to: "กองลอย",   trips: 48,   cost: 515000 },
  { from: "เชียงราย",  to: "เชียงใหม่", trips: 107,  cost: 355000 },
  { from: "แม่สาย",   to: "เชียงใหม่", trips: 16,   cost: 55000 },
  { from: "เชียงใหม่", to: "ท่าลี่",    trips: 4,    cost: 40000 },
  { from: "เชียงใหม่", to: "เชียงใหม่", trips: 8,    cost: 30000 },
  { from: "แพร่",     to: "เชียงใหม่", trips: 7,    cost: 30000 },
  { from: "เชียงราย",  to: "ฝาง",      trips: null, cost: 18000 },
  { from: "ฝาง",      to: "เชียงใหม่", trips: 4,    cost: 18000 },
  { from: "พะเยา",    to: "เชียงใหม่", trips: 5,    cost: 15000 },
  { from: "แพร่",     to: "ลำปาง",    trips: 5,    cost: null }
];

const fmt = d3.format(",");
const key = r => r.from + "→" + r.to;
const perTrip = r => (r.trips && r.cost ? r.cost / r.trips : null);

/* ================= KPI ================= */
const last = TREND.at(-1), first = TREND[0];
const sumTrips = d3.sum(ROUTES, r => r.trips);
const sumCost = d3.sum(ROUTES, r => r.cost);
const top = d3.greatest(ROUTES, r => r.cost);
document.getElementById("kPct").textContent = last.pct.toFixed(1) + "%";
document.getElementById("kPctSub").textContent =
  `ลดจาก ${first.pct.toFixed(1)}% ในปี ${first.year}` + (last.partial ? " · ข้อมูลถึง มิ.ย." : "");
document.getElementById("kTrips").textContent = fmt(sumTrips);
document.getElementById("kCost").textContent = (sumCost / 1e6).toFixed(2);
document.getElementById("kTopShare").textContent = Math.round(100 * top.cost / sumCost) + "%";
document.getElementById("kTopSub").textContent = `ของต้นทุน Top 10 มาจาก ${top.from} → ${top.to} · ดูบนแผนที่`;
document.getElementById("kTop").onclick = () => pick(key(top));

/* ================= กราฟแนวโน้ม ================= */
{
  const W = 560, H = 210, m = { t: 26, r: 34, b: 30, l: 40 };
  const svg = d3.select("#trend");
  const x = d3.scalePoint(TREND.map(d => d.year), [m.l, W - m.r]).padding(.25);
  const y = d3.scaleLinear([0, 4], [H - m.b, m.t]);

  svg.append("g").attr("class", "grid-y").selectAll("g").data(y.ticks(4)).join("g")
    .call(g => g.append("line").attr("x1", m.l).attr("x2", W - m.r).attr("y1", y).attr("y2", y))
    .call(g => g.append("text").attr("x", m.l - 8).attr("y", y).attr("dy", "0.32em")
      .attr("text-anchor", "end").text(d => d + "%"));
  svg.append("g").attr("class", "axis-x").selectAll("text").data(TREND).join("text")
    .attr("x", d => x(d.year)).attr("y", H - 8).attr("text-anchor", "middle")
    .text(d => "พ.ศ. " + d.year);

  const line = d3.line(d => x(d.year), d => y(d.pct));
  const full = TREND.filter(d => !d.partial);
  const tail = TREND.slice(Math.max(0, full.length - 1));   // ช่วงต่อไปยังปีที่ข้อมูลไม่ครบ
  svg.append("path").attr("class", "trend-area")
    .attr("d", d3.area(d => x(d.year), y(0), d => y(d.pct))(TREND));
  svg.append("path").attr("class", "trend-line").attr("d", line(full));
  if (tail.length > 1) svg.append("path").attr("class", "trend-line dash").attr("d", line(tail));

  const pt = svg.append("g").selectAll("g").data(TREND).join("g")
    .attr("transform", d => `translate(${x(d.year)},${y(d.pct)})`);
  pt.append("circle").attr("r", 5).attr("class", d => d.partial ? "dot open" : "dot");
  pt.append("text").attr("class", "val").attr("y", -12).attr("text-anchor", "middle")
    .text(d => d.pct.toFixed(1) + "%");
}

/* ================= ตารางเส้นทาง (รวมกราฟ Top 10 สองอัน) ================= */
const maxCost = d3.max(ROUTES, r => r.cost), maxTrips = d3.max(ROUTES, r => r.trips);
let sortBy = "cost", active = null, stopFilter = null;

function renderRoutes() {
  const rows = [...ROUTES].sort((a, b) => (b[sortBy] ?? -1) - (a[sortBy] ?? -1));
  const box = d3.select("#routes");
  box.selectAll("button").data(rows, key).join(enter => {
    const b = enter.append("button").attr("class", "route").attr("type", "button")
      .on("click", (e, r) => pick(key(r)));
    b.append("span").attr("class", "rank");
    b.append("span").attr("class", "name").html(r => `${r.from} <span class="arr">→</span> ${r.to}`);
    const bars = b.append("span").attr("class", "bars");
    [["cost", maxCost], ["trips", maxTrips]].forEach(([k, max]) => {
      const t = bars.append("span").attr("class", "track " + k);
      t.append("span").attr("class", "fill").style("--p", r => r[k] ? (r[k] / max).toFixed(3) : 0)
        .style("display", r => r[k] ? null : "none");
      t.append("span").attr("class", "num").text(r => r[k] == null ? "นอก Top 10" : fmt(r[k]));
    });
    b.append("span").attr("class", "per").text(r => perTrip(r) ? fmt(Math.round(perTrip(r))) : "—");
    return b;
  })
    .order()
    .attr("aria-pressed", r => key(r) === active)
    .classed("dim", r => stopFilter && r.from !== stopFilter && r.to !== stopFilter)
    .select(".rank").text((r, i) => i + 1);

  d3.selectAll(".seg button").attr("aria-pressed", function () { return this.dataset.sort === sortBy; });
  document.getElementById("filter").hidden = !stopFilter;
  document.getElementById("filterName").textContent = stopFilter || "";
}

d3.selectAll(".seg button").on("click", function () { sortBy = this.dataset.sort; renderRoutes(); });
document.getElementById("filterClear").onclick = () => { stopFilter = null; tellMap("view=north&reset=" + Date.now()); renderRoutes(); };

/* ================= คุยกับแผนที่ใน iframe ================= */
const frame = document.getElementById("routeMap");
const status = document.getElementById("mapStatus");

// เปลี่ยนเฉพาะ # ของแผนที่ แผนที่ฟัง hashchange แล้ววาดใหม่โดยไม่โหลดหน้าใหม่
function tellMap(params) {
  const hash = "embed&tab=net&" + params;
  try { frame.contentWindow.location.hash = hash; }
  catch { frame.src = "index.html#" + hash; }   // กรณีแผนที่อยู่คนละโดเมน
}

// เลือกเส้นทาง (คลิกซ้ำ = ยกเลิก กลับไปดูทั้งภาค)
function pick(k) {
  active = active === k ? null : k;
  const r = ROUTES.find(x => key(x) === active);
  if (r) {
    tellMap(`from=${r.from}&to=${r.to}`);
    status.innerHTML = `<b>${r.from} → ${r.to}</b> · ` +
      (r.trips ? `${fmt(r.trips)} เที่ยว · ` : "") + (r.cost ? `${fmt(r.cost)} บาท` : "");
  } else resetMap();
  renderRoutes();
}

function resetMap() {
  active = null;
  tellMap("view=north&reset=" + Date.now());
  status.textContent = "ภาคเหนือทั้งหมด · คลิกเส้นทางในตารางเพื่อดูบนแผนที่";
}
document.getElementById("mapReset").onclick = () => { stopFilter = null; resetMap(); renderRoutes(); };

// แผนที่แจ้งกลับเมื่อผู้ใช้คลิกจุดบนแผนที่ → กรองตารางให้เหลือเส้นทางที่ผ่านจุดนั้น
window.addEventListener("message", e => {
  if (e.source !== frame.contentWindow || e.data?.type !== "map:stop") return;
  if (e.data.stop) {
    active = null;
    status.innerHTML = `จุด <b>${e.data.stop}</b> · เส้นทางเข้า–ออกไปกรุงเทพฯ`;
  } else if (!active) status.textContent = "ภาคเหนือทั้งหมด · คลิกเส้นทางในตารางเพื่อดูบนแผนที่";
  stopFilter = e.data.stop && ROUTES.some(r => r.from === e.data.stop || r.to === e.data.stop) ? e.data.stop : null;
  renderRoutes();
});

renderRoutes();
