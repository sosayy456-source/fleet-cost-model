import * as d3 from "d3";

/* ------------------------------------------------------------------
   เส้นทางแบบมีมิติ + รถวิ่งตามเส้นทาง
   - tube(): วาดเส้นทางซ้อนหลายชั้น (เงาเบลอ · ขอบขาว · ขอบล่างสีเข้ม · ผิวหน้า · ไฮไลต์ · จุดไหล)
             ให้ดูเหมือนท่อนูนที่มีแสงส่องจากมุมซ้ายบน
   - Cars:   รถบรรทุกมุมมองจากด้านบน ขับจากต้นทางไปปลายทางของเส้น แล้ววนซ้ำ
   ความหนาเส้นทั้งหมดเป็นหน่วย px บนจอ (#map path ใช้ non-scaling-stroke)
   ------------------------------------------------------------------ */

export function addDefs(svg) {
  const defs = svg.append("defs");
  // เงาใต้เส้น: ใช้พื้นที่ฟิลเตอร์แบบ userSpaceOnUse กันเงาถูกตัดขอบเมื่อเส้นเกือบตรงแนวตั้ง
  defs.append("filter").attr("id", "tubeShadow").attr("filterUnits", "userSpaceOnUse")
    .attr("x", -500).attr("y", -500).attr("width", 2000).attr("height", 2400)
    .append("feGaussianBlur").attr("stdDeviation", 3);
  defs.append("filter").attr("id", "carShadow")
    .attr("x", "-50%").attr("y", "-50%").attr("width", "200%").attr("height", "200%")
    .append("feGaussianBlur").attr("stdDeviation", 1.6);
}

/* ชั้นของเส้น: [class, สีเส้น, dx, dy (px บนจอ)] */
const LAYERS = [
  ["t-shadow", "#1b2733", 1.5, 3.5],
  ["t-case",   "#fff",    0,   0],
  ["t-edge",   "dark",    .7,  .7],
  ["t-face",   "color",  -.5, -.5],
  ["t-hi",     "#fff",  -1.3, -1.3],
  ["t-flow",   "#fff",    0,   0]
];
/* ความหนาของแต่ละชั้นตามสถานะ (null = ซ่อน) */
const WIDTH = {
  on:  { "t-shadow": 10, "t-case": 10, "t-edge": 6.6, "t-face": 4.8, "t-hi": 1.4, "t-flow": 2.6 },
  dim: { "t-shadow": null, "t-case": 5, "t-edge": null, "t-face": 3, "t-hi": null, "t-flow": null }
};

export function tube(parent, d, color, { scale = 1, off = 0 } = {}) {
  const g = parent.append("g").attr("class", "tube");
  const dark = d3.color(color).darker(1).formatHex();
  const layers = LAYERS.map(([cls, stroke, dx, dy]) => {
    const p = g.append("path").attr("class", cls).attr("d", d)
      .attr("stroke", stroke === "dark" ? dark : stroke === "color" ? color : stroke);
    p.node().__dxy = [dx, dy];
    return p;
  });
  const t = {
    g, color, off,
    node: layers[3].node(),   // ใช้ชั้นผิวหน้าเป็นเรขาคณิตสำหรับให้รถวิ่ง
    state(s) {
      t.on = s === "on";
      layers.forEach(p => {
        const w = WIDTH[s][p.attr("class")];
        p.attr("display", w == null ? "none" : null).attr("stroke-width", w * scale);
      });
      g.attr("opacity", t.on ? 1 : .22);
      return t;
    },
    place(k) {
      layers.forEach(p => {
        const [dx, dy] = p.node().__dxy;
        p.attr("transform", `translate(${(t.off + dx) / k},${dy / k})`);
      });
    }
  };
  return t;
}

/* ---------- เส้นทางแบบเรืองแสง (โหมด #dark · ดีไซน์ "Route 1c" ที่เจ้าของงานส่ง 24 ก.ย. 2569) ----------
   เส้นฐานเข้ม + เส้นไล่สีเขียว→ฟ้า (ต้นทาง→ปลายทาง) ที่ค่อย ๆ ลากตามรถ (progress ถูกเรียกจาก Cars ทุกเฟรม) +
   แสงเรืองใต้เส้น + ดาวหางสีขาววิ่งวน · ความหนา/ความเบลอเป็น px บนจอ แต่คิดเป็นหน่วย viewBox เอง (vector-effect:none)
   เพราะ stroke-dasharray ของเส้นที่ลากต้องเทียบกับความยาวเส้นในหน่วยเดียวกัน — non-scaling-stroke ทำให้ขีดเพี้ยน */
export const NEON = { a: "#1fd1a0", b: "#3aa8ff", base: "#2b4a42", comet: "#e8fffb", bg: "#0f1e1b" };
/* เส้นทางที่ขาดทุน (กำไร < 0) ไล่สีแดง→ส้มแทน (เจ้าของงานขอ 24 ก.ย. 2569) · รถยังเป็นแบบเดิม */
export const NEON_LOSS = { a: "#ff4d5e", b: "#ff9f43" };
/* แผนที่เที่ยววิ่งเปล่า (Overall Dashboard › Empty Trips · 26 ก.ย. 2569) — เส้นกับรถแดงล้วน (tone "empty") */
export const NEON_EMPTY = { a: "#e11d2e", b: "#ff5a6a", roof: "#ff9aa3", halo: "#ff5a6a" };
const NEON_W = { "n-base": 3, "n-glow": 9, "n-line": 3.2, "n-comet": 3 };
let neonId = 0;

export function neonTube(parent, d, { a, b, off = 0, loss = false, empty = false } = {}) {
  const pal = empty ? NEON_EMPTY : loss ? NEON_LOSS : NEON;
  const id = "neon" + (++neonId);
  const g = parent.append("g").attr("class", "tube neon");
  // ไล่สีตามแนวต้นทาง→ปลายทางในหน่วย viewBox (objectBoundingBox ใช้ไม่ได้ — เส้นตรงแนวนอน/ตั้งมีกรอบกว้าง 0 แล้วไม่วาดเลย)
  const grad = g.append("linearGradient").attr("id", id + "g").attr("gradientUnits", "userSpaceOnUse")
    .attr("x1", a[0]).attr("y1", a[1]).attr("x2", b[0]).attr("y2", b[1]);
  grad.append("stop").attr("offset", 0).attr("stop-color", pal.a);
  grad.append("stop").attr("offset", 1).attr("stop-color", pal.b);
  const blur = g.append("filter").attr("id", id + "f").attr("filterUnits", "userSpaceOnUse")
    .attr("x", -500).attr("y", -500).attr("width", 2000).attr("height", 2400)
    .append("feGaussianBlur").attr("stdDeviation", 3);
  const mk = (cls, stroke) => g.append("path").attr("class", cls).attr("d", d).attr("stroke", stroke)
    .style("vector-effect", "none");
  const layers = [
    mk("n-base", NEON.base),
    mk("n-glow", `url(#${id}g)`).attr("filter", `url(#${id}f)`).attr("opacity", .8),
    mk("n-line", `url(#${id}g)`),
    mk("n-comet", NEON.comet).attr("filter", `url(#${id}f)`)
  ];
  const [, glow, line, comet] = layers;
  const len = line.node().getTotalLength() || 1;
  [glow, line].forEach(p => p.attr("stroke-dasharray", `${len} ${len}`).attr("stroke-dashoffset", len));
  comet.attr("stroke-dasharray", `${len * .04} ${len * .96}`)
    .append("animate").attr("attributeName", "stroke-dashoffset").attr("from", len).attr("to", 0)
    .attr("dur", "2.4s").attr("repeatCount", "indefinite");
  const t = {
    g, color: pal.a, off, neon: true, empty,
    node: line.node(),
    state(s) { t.on = s === "on"; g.attr("opacity", t.on ? 1 : .22); return t; },
    place(k) {
      layers.forEach(p => p.attr("stroke-width", NEON_W[p.attr("class")] / k).attr("transform", `translate(${t.off / k},0)`));
      blur.attr("stdDeviation", 3 / k);
    },
    /** q = ระยะที่รถวิ่งไปแล้ว (0–1) — เส้นไล่สีลากตามรถ */
    progress(q) { [glow, line].forEach(p => p.attr("stroke-dashoffset", len * (1 - q))); }
  };
  return t;
}

/* รถของโหมด #dark: ตู้ขาวขอบเขียว หัวเขียว ไฟหน้าเหลือง + วงแสงสีฟ้ากระพริบ (แบบเดียวกับดีไซน์ "Route 1c")
   empty = รถของแผนที่เที่ยววิ่งเปล่า: หัว/ขอบแดง วงแสงแดง */
function drawTruckNeon(g, empty = false) {
  const c = empty ? { body: NEON_EMPTY.a, roof: NEON_EMPTY.roof, halo: NEON_EMPTY.halo } : { body: NEON.a, roof: "#5fe6bf", halo: NEON.b };
  g.html(`
    <circle r="9" fill="${c.halo}" opacity=".35"><animate attributeName="r" values="7;14;7" dur="1.8s" repeatCount="indefinite"/><animate attributeName="opacity" values=".45;0;.45" dur="1.8s" repeatCount="indefinite"/></circle>
    <rect x="-13" y="-5" width="27" height="11" rx="3" fill="#000" opacity=".18" transform="translate(1,1.5)"/>
    <rect x="-13" y="-5.5" width="16.5" height="11" rx="1.4" fill="#fbfcfb" stroke="${c.body}" stroke-width=".9"/>
    <g stroke="${c.body}" stroke-width=".35" opacity=".45"><line x1="-10" y1="-5" x2="-10" y2="5"/><line x1="-7" y1="-5" x2="-7" y2="5"/><line x1="-4" y1="-5" x2="-4" y2="5"/><line x1="-1" y1="-5" x2="-1" y2="5"/></g>
    <rect x="-12" y="-1" width="14.5" height="2" rx=".5" fill="${c.body}"/>
    <rect x="-13.6" y="-4.6" width="1" height="2" rx=".3" fill="#e5484d"/><rect x="-13.6" y="2.6" width="1" height="2" rx=".3" fill="#e5484d"/>
    <rect x="3.5" y="-1.2" width="1.8" height="2.4" fill="#2a3a35"/>
    <rect x="5" y="-5" width="8.5" height="10" rx="2.4" fill="${c.body}"/>
    <rect x="5.6" y="-4.2" width="3.2" height="8.4" rx="1" fill="${c.roof}"/>
    <rect x="9.6" y="-4" width="2.6" height="8" rx="1" fill="#16312a"/>
    <path d="M10.2,-3.4 L11.6,-3.4 L10.6,0.5 Z" fill="#fff" opacity=".45"/>
    <rect x="8.4" y="-6.6" width="1.6" height="1.4" rx=".4" fill="#2a3a35"/><rect x="8.4" y="5.2" width="1.6" height="1.4" rx=".4" fill="#2a3a35"/>
    <circle cx="13.3" cy="-3.6" r=".9" fill="#ffd66b"/><circle cx="13.3" cy="3.6" r=".9" fill="#ffd66b"/>
    <path d="M14,-3.6 L22,-7 L22,-0.5 Z M14,3.6 L22,7 L22,0.5 Z" fill="#ffe9a8" opacity=".35"/>`);
}

/* ------------------------- รถวิ่งตามเส้นทาง ------------------------- */
const SPEED = 85;     // px ต่อวินาที (ที่ซูม 1 เท่า)
const NEON_SPEED = 60;
const HOLD = 1400;    // หยุดรอที่ปลายทางก่อนวนรอบใหม่ (ms)
const FADE = 350;
const SIZE = 1.25;    // ขนาดรถ (เท่าของแบบที่วาดไว้)

function drawTruck(g, color) {
  const dark = d3.color(color).darker(1).formatHex();
  g.append("rect").attr("x", -13).attr("y", -6).attr("width", 29).attr("height", 12).attr("rx", 3)
    .attr("transform", "translate(1.5,3)").attr("fill", "#000").attr("opacity", .35)
    .attr("filter", "url(#carShadow)");
  // ตู้สินค้า
  g.append("rect").attr("x", -13).attr("y", -6).attr("width", 19).attr("height", 12).attr("rx", 2)
    .attr("fill", "#fff").attr("stroke", dark).attr("stroke-width", 1.3);
  g.append("rect").attr("x", -11).attr("y", -3.6).attr("width", 15).attr("height", 2.2).attr("rx", 1)
    .attr("fill", color).attr("opacity", .9);
  g.append("rect").attr("x", -11).attr("y", 1.4).attr("width", 15).attr("height", 2.2).attr("rx", 1)
    .attr("fill", color).attr("opacity", .9);
  // หัวรถ
  g.append("rect").attr("x", 7).attr("y", -5.4).attr("width", 9).attr("height", 10.8).attr("rx", 2.6)
    .attr("fill", color).attr("stroke", dark).attr("stroke-width", 1.1);
  g.append("rect").attr("x", 11.4).attr("y", -4.2).attr("width", 2.6).attr("height", 8.4).attr("rx", 1)
    .attr("fill", "#1c2a3a").attr("opacity", .85);
  g.append("rect").attr("x", 8.2).attr("y", -4.2).attr("width", 2).attr("height", 8.4).attr("rx", .8)
    .attr("fill", "#fff").attr("opacity", .35);
  // ไฟหน้า
  [-3.6, 3.6].forEach(y => g.append("circle").attr("cx", 16).attr("cy", y).attr("r", 1.1).attr("fill", "#fff6c2"));
}

export function Cars(layer, getK) {
  let cars = [], playing = true, clock = 0, last = null;

  function render() {
    const k = getK();
    cars.forEach(c => {
      const cycle = c.dur + HOLD;
      const u = ((clock + c.phase * cycle) % cycle + cycle) % cycle;
      const q = u < c.dur ? d3.easeSinInOut(u / c.dur) : 1;
      const s = q * c.len;
      const p = c.node.getPointAtLength(s);
      const a = c.node.getPointAtLength(Math.max(0, s - 2)), b = c.node.getPointAtLength(Math.min(c.len, s + 2));
      if (b.x !== a.x || b.y !== a.y) c.ang = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
      if (c.tube.progress) c.tube.progress(q);
      const op = Math.min(1, u / FADE, (cycle - u) / FADE);
      c.g.attr("opacity", op)
        .attr("transform", `translate(${p.x + c.tube.off / k},${p.y}) rotate(${c.ang}) scale(${SIZE / k})`);
    });
  }

  /* ลูปเฟรมวิ่งเฉพาะตอนมีรถ — เดิมวิ่งทุกเฟรมตลอดแม้ไม่มีรถสักคัน (หน้าสถานะกองรถไม่มีเส้นเลย กินเฟรมเปล่า ๆ · 26 ก.ย. 2569)
     หยุดแล้ว last = null เพื่อให้รอบใหม่ไม่นับช่วงที่หยุดเป็นเวลาวิ่ง */
  let raf = 0;
  function tick(now) {
    if (!cars.length) { raf = 0; last = null; return; }
    if (last != null && playing) clock += Math.min(100, now - last);
    last = now;
    render();
    raf = requestAnimationFrame(tick);
  }
  const wake = () => { if (!raf && cars.length) raf = requestAnimationFrame(tick); };

  return {
    render,
    /* tubes: เส้นที่ต้องมีรถวิ่ง (เรียงตามลำดับ) — เริ่มรอบใหม่ทุกครั้งที่เปลี่ยนการเลือก */
    set(tubes) {
      layer.selectAll("*").remove();
      clock = 0;
      cars = tubes.map((tube, i) => {
        const len = tube.node.getTotalLength();
        const g = layer.append("g").attr("class", "car").attr("pointer-events", "none");
        if (tube.neon) drawTruckNeon(g, tube.empty); else drawTruck(g, tube.color);
        // เส้นเรืองแสงวิ่งช้ากว่า (ดีไซน์ใช้ ~14 วินาทีต่อเส้นเหนือ→กรุงเทพฯ) ให้เห็นเส้นค่อย ๆ ลากตามรถ
        return { tube, g, node: tube.node, len, ang: 0,
          dur: tube.neon ? Math.max(6000, len / NEON_SPEED * 1000) : Math.max(3500, len / SPEED * 1000), phase: tubes.length > 1 ? (i * .37) % 1 : 0 };
      });
      render();
      wake();
    },
    get playing() { return playing; },
    toggle(v = !playing) { playing = v; return playing; }
  };
}
