import * as d3 from "d3";
import * as topojson from "topojson-client";
import { DATA_PROVINCES, DATA_WORLD, ROUTES, CITIES, COUNTRIES, SEAS } from "./data.js";
import { STOPS, PAIRS } from "./network.js";
import { roadPath } from "./roads.js";
import { addDefs, tube, neonTube, NEON, Cars } from "./motion.js";
import "./styles.css";

/* ------------------------------------------------------------------
   การวาดแผนที่ + การเลือกเส้นทาง
   - แท็บ "เครือข่ายขนส่ง": ข้อมูลจาก src/network.js
   - แท็บ "กำไรสูงสุด":   ข้อมูลจาก src/data.js — หรือจากหน้าที่ฝังแผนที่ไว้ (postMessage "map:routes")
   ------------------------------------------------------------------ */
const W = 1000, H = 1400;
const OUT = "#1a73e8", IN = "#e37400";          // สีเส้นขาออก / ขาเข้า ของจุดที่เลือก
  const svg = d3.select("#map");
let selected = null;   // เส้นทางที่เลือกในแท็บกำไรสูงสุด (null = ยังไม่เลือก แสดงเป็นเงาทั้งหมด, 0 = ทั้งหมด)
let netSel = null;     // จุดที่เลือกในแท็บเครือข่าย
let k = 1;             // ระดับซูมปัจจุบัน
/* ตัวคูณขนาดบนจอ — แผนที่วาดใน viewBox กว้าง 1000 ถ้าฝังในกล่องแคบ (เช่น การ์ดกว้าง ~300px) ทุกอย่างย่อตาม
   ป้ายชื่อ/หมุด/รถจะเล็กจนอ่านไม่ออก โหมดฝัง (#embed) จึงขยายกลับด้วย ui = 1000 ÷ ความกว้างจริง (อย่างน้อย 1)
   ใช้คู่กับ k เป็น kk = k ÷ ui ทุกที่ที่เดิมหารด้วย k เพื่อคงขนาดบนจอ (เส้นใช้ non-scaling-stroke อยู่แล้ว) */
let ui = 1;
const kk = () => k / ui;
/** #dark = โหมดพื้นเข้มของหน้า Demo (ดีไซน์ "Route 1c") — เส้นเรืองแสง + รถแบบใหม่ + จุดขึ้นลงสีเข้ม */
const isDark = () => document.body.classList.contains("dark");

/* จุดที่แสดงชื่อตลอด (จุดอื่นแสดงชื่อเมื่อซูมเข้า) และจุดที่วางป้ายชื่อไว้ทางซ้าย */
const MAJOR = new Set(["เชียงใหม่","เชียงราย","ลำปาง","น่าน","แพร่","พะเยา","พิษณุโลก","ตาก",
  "กำแพงเพชร","ฝาง","แม่สาย","ท่าลี่","ตลาดไท","ราชบุรี"]);
const LEFT = new Set(["ปากคลองตลาด","ปากคลองตลาดใหม่","พุทธมณฑลสาย 5","มหาชัย","ราชบุรี",
  "ป่าซาง","บ้านกาด","บ้านโฮ่ง","กองลอย","ฝาง","ตาก"]);
const LABEL_ALL_AT = 4;   // ซูมถึงระดับนี้แล้วแสดงชื่อทุกจุด

(async function () {
  const [prov, tWorld] = await Promise.all([
    d3.json(DATA_PROVINCES),
    d3.json(DATA_WORLD)
  ]);
  const world = topojson.feature(tWorld, tWorld.objects.countries);

  const proj = d3.geoMercator().fitExtent([[70, 70], [W - 70, H - 70]], prov);
  /* โหมดฝัง (#embed) ลดจุดขอบเขตด้วยการปัดพิกัด (หลังฉายแผนที่) ลงตารางขนาด THIN ÷ ระดับซูม (26 ก.ย. 2569 · หน้าสถานะกองรถแลค)
     ขอบเขตจังหวัดต้นฉบับมี 28,109 จุด วาดสองชั้น + เส้น non-scaling-stroke ต้องวาดใหม่ทั้งหมดทุกครั้งที่ซูม/เลื่อน
     · ปัดลงตาราง ไม่ใช่ "ข้ามจุดที่ใกล้จุดก่อนหน้า" — จังหวัดที่ติดกันได้จุดบนเส้นแบ่งตรงกันพอดี (รุ่นข้ามจุดทำให้มีรอยแยกสีเทาตอนซูม)
     · ตารางละเอียดขึ้นตามซูม: ซูมเสร็จแล้ววาดเส้นขอบใหม่ (redrawLand · ขั้นละ 2 เท่า) — ซูม 1 เท่าเบา ซูมลึก (มุมมอง กทม.) ยังคม
     1.5 หน่วย viewBox (1000 หน่วย) ≈ 1 พิกเซลบนจอของกล่องกว้าง ~600px · หน้าแผนที่เต็ม (ไม่มี #embed) ใช้ความละเอียดเดิม */
  const HASH0 = new URLSearchParams(decodeURIComponent(location.hash.slice(1)));
  const THIN = HASH0.has("embed") ? 1.5 : 0;
  const snap = (out, g) => {
    let px = NaN, py = NaN;
    return {
      point(x, y) { x = Math.round(x / g) * g; y = Math.round(y / g) * g; if (x !== px || y !== py) { out.point(x, y); px = x; py = y; } },
      lineStart() { px = py = NaN; out.lineStart(); }, lineEnd() { out.lineEnd(); },
      polygonStart() { out.polygonStart(); }, polygonEnd() { out.polygonEnd(); },
      sphere() { out.sphere?.(); },
    };
  };
  const pathAt = g => d3.geoPath(g ? { stream: s => proj.stream(snap(s, g)) } : proj);
  let landLevel = 1;   // ระดับซูมที่ใช้คิดตารางของเส้นขอบที่วาดอยู่ (1, 2, 4, 8, …)
  const path = pathAt(THIN);
  /** วาดเส้นขอบ (.geo) ใหม่ให้ละเอียดพอกับระดับซูม — เรียกตอนซูมเสร็จ ไม่ใช่ทุกเฟรม */
  function redrawLand() {
    if (!THIN) return;
    const lv = 2 ** Math.max(0, Math.floor(Math.log2(k)));
    if (lv === landLevel) return;
    landLevel = lv;
    root.selectAll(".geo").attr("d", pathAt(THIN / lv));
  }

  addDefs(svg);

  /* ---------- พื้นหลัง: ทะเล / ประเทศเพื่อนบ้าน / จังหวัด ---------- */
  svg.append("rect").attr("class", "water").attr("width", W).attr("height", H).attr("fill", "var(--water)");
  const root = svg.append("g");   // ทุกอย่างที่ซูมได้อยู่ในกลุ่มนี้
  // ประเทศเพื่อนบ้านเฉพาะที่อยู่ในกรอบรอบไทย — เดิมวาดครบ 176 ประเทศทั่วโลก (~10,700 จุด) ทั้งที่อยู่นอกจอเกือบหมด
  const NEAR_BOX = ([[x0, y0], [x1, y1]]) => x1 > 85 && x0 < 115 && y1 > -5 && y0 < 32;
  root.append("g").attr("class", "neighbors").selectAll("path")
    .data(world.features.filter(f => f.properties.name !== "Thailand" && NEAR_BOX(d3.geoBounds(f))))
    .join("path").attr("class", "geo").attr("d", path)
    .attr("fill", "var(--neighbor)").attr("stroke", "var(--neighbor)")
    .attr("stroke-width", 3.5).attr("stroke-linejoin", "round");

  /* ฐาน 3 มิติของโหมด #3d (ใช้คู่กับ #thai · เคยเปิดในหน้า Demo แล้วเจ้าของงานให้กลับเป็น 2 มิติ 24 ก.ย. 2569): เงาเบลอใต้ประเทศ + ผนังด้านข้าง
     = เงาของรูปประเทศซ้อนกันเลื่อนลงทีละนิด (สีเข้มขึ้นตามความลึก) · ใช้รูปจังหวัดทั้งหมดต่อเป็น path เดียว
     ไม่ต้อง merge ขอบเขต (fill ซ้อนกันแล้วได้รูปประเทศ) · โหมดอื่นซ่อนไว้ด้วย CSS (.thai3d) */
  const g3d = root.append("g").attr("class", "thai3d");
  /* สร้างเฉพาะตอนเปิดด้วย #3d — เดิมสร้างทุกครั้ง: รูปประเทศทั้งก้อนซ้อน 17 ชั้น = ข้อความพิกัดหลาย MB + เงาเบลอ
     แม้ CSS ซ่อนไว้ก็ยังเสียเวลาเปิดแผนที่ (โหมดนี้ปิดอยู่ · ต้องการเปิดคืนต้องโหลดหน้าใหม่พร้อม #3d) */
  if (HASH0.has("3d")) {
  const land = prov.features.map(f => path(f)).join("");
  svg.select("defs").append("filter").attr("id", "landShadow")
    .attr("x", "-20%").attr("y", "-20%").attr("width", "140%").attr("height", "140%")
    .append("feGaussianBlur").attr("stdDeviation", 14);
  g3d.append("path").attr("d", land).attr("fill", "#1b2733").attr("opacity", .22)
    .attr("transform", "translate(10,46)").attr("filter", "url(#landShadow)");
  const DEPTH = 16, STEP = 1.6;
  const side = d3.scaleLinear([0, DEPTH], ["#8f887c", "#c9c2b5"]);
  for (let i = DEPTH; i >= 1; i--) {
    g3d.append("path").attr("d", land).attr("fill", side(DEPTH - i)).attr("stroke", side(DEPTH - i))
      .attr("stroke-width", 1).attr("transform", `translate(0,${i * STEP})`);
  }
  }

  // เส้นขอบประเทศ: วาดเส้นหนาไว้ข้างล่าง แล้วให้ชั้นจังหวัดทับส่วนที่อยู่ด้านใน
  root.append("g").selectAll("path").data(prov.features).join("path")
    .attr("class", "geo").attr("d", path).attr("fill", "var(--land)")
    .attr("stroke", "var(--border)").attr("stroke-width", 3).attr("stroke-linejoin", "round");

  root.append("g").selectAll("path").data(prov.features).join("path")
    .attr("class", "geo").attr("d", path).attr("fill", "var(--land)")
    .attr("stroke", "var(--province)").attr("stroke-width", .8).attr("stroke-linejoin", "round");

  /* ---------- ตัวช่วยวาดป้ายชื่อ (มี halo สีขาว) ---------- */
  const label = (sel, t, x, y, o = {}) => sel.append("text").text(t)
    .attr("x", x).attr("y", y).attr("text-anchor", o.anchor || "middle")
    .attr("font-size", o.size || 13).attr("font-weight", o.weight || 500)
    .attr("fill", o.fill || "var(--ink-2)").attr("letter-spacing", o.ls || 0)
    .attr("paint-order", "stroke").attr("stroke", o.halo || "rgba(255,255,255,.9)")
    .attr("stroke-width", o.haloW || 3.5).attr("stroke-linejoin", "round")
    .attr("pointer-events", "none");

  /* หมุด: กลุ่มที่วางไว้ที่จุด p และย่อกลับตามระดับซูม เพื่อให้ขนาดบนจอคงที่ */
  const pinT = p => `translate(${p[0]},${p[1]}) scale(${1 / kk()})`;
  const pin = (sel, p) => {
    const g = sel.append("g").attr("class", "pin").attr("transform", pinT(p));
    g.node().__p = p;
    return g;
  };

  const gCtx = root.append("g").attr("class", "ctx");   // ป้ายประเทศเพื่อนบ้าน/ทะเล — โหมด #thai ซ่อน
  COUNTRIES.forEach(d => {
    const p = proj(d.c);
    label(gCtx, d.n, p[0], p[1], { size:15, weight:600, fill:"#8a9096", ls:.6, halo:"rgba(226,229,231,.9)" });
  });
  SEAS.forEach(d => {
    const p = proj(d.c);
    label(gCtx, d.n, p[0], p[1], { size:14, fill:"#5b9ccd", halo:"rgba(170,218,255,.8)" });
  });

  /* ลำดับชั้น (ล่าง→บน): เส้นทางกำไร · เส้นเครือข่าย · จุดขึ้นลง (แสดงทั้งสองแท็บ) · หมุดเส้นทางที่เลือก */
  const gTop = root.append("g");     // แท็บกำไรสูงสุด
  const gNet = root.append("g");     // แท็บเครือข่าย: เส้นทาง
  const gStops = root.append("g");   // จุดขึ้นลง
  const gNetEnd = root.append("g");  // แท็บเครือข่าย: หมุดของจุดที่เลือก
  const gEnd = root.append("g");     // แท็บกำไรสูงสุด: หมุดต้นทาง/ปลายทางของเส้นที่เลือก
  const gCars = root.append("g");   // ชั้นรถ — โหมดตำแหน่งรถย้ายขึ้นไปอยู่เหนือเส้นทางรถกำลังเดินทาง (feedFleet)
  const cars = Cars(gCars, kk);   // รถวิ่งตามเส้นทางที่แสดงอยู่ (ทั้งสองแท็บ + เส้นทางของโหมดตำแหน่งรถ)
  let mode = "net";
  let netTubes = [];   // เส้นเข้า–ออกของจุดที่เลือกในแท็บเครือข่าย
  let focus = null;    // เส้นทางที่ส่งมาทางลิงก์ #from=…&to=… เช่น จาก dashboard: [ต้นทาง, ปลายทาง]

  /* ================= แท็บ: 5 เส้นทางกำไรสูงสุด ================= */

  const line = d3.line().curve(d3.curveCatmullRom.alpha(.6));
  const gRoutes = gTop.append("g").attr("fill", "none")
    .attr("stroke-linecap", "round").attr("stroke-linejoin", "round");
  const gCity = gTop.append("g");
  const fmt = d3.format(",");
  const list = d3.select("#list");

  /* เส้นทางของแท็บนี้ที่แสดงอยู่ — เริ่มจาก ROUTES ใน data.js แล้วถูกแทนทั้งชุดเมื่อหน้าที่ฝังส่งมา
     fed = ข้อมูลมาจากหน้าที่ฝัง: ซ่อนป้ายเมืองของ data.js และแสดงเฉพาะจุดต้นทาง/ปลายทางของเส้นที่ส่งมา */
  let routes = [];
  let fed = false;
  let fedStops = new Set();
  /* จุดสีเหลือง = จุดที่เส้นวิ่งผ่าน + จุดในรัศมี NEAR_KM จากแนวเส้น — **เฉพาะเส้น tone "empty"** (แผนที่เที่ยววิ่งเปล่า)
     เดิมใช้กับแผนที่กำไร (เจ้าของงานขอ 24 ก.ย. 2569) แล้วสั่งเอาออกจากแผนที่กำไร และย้ายมาไว้ที่แผนที่เที่ยววิ่งเปล่าแทน 26 ก.ย. 2569 */
  let fedNear = new Set();
  const NEAR_KM = 100, NEAR_FILL = "#fbbc04", NEAR_STROKE = "#b06000";

  function buildTop(list0) {
    gRoutes.selectAll("*").remove();
    gCity.selectAll("*").remove();
    list.selectAll("*").remove();
    routes = list0;
    const mid = (routes.length - 1) / 2;
    routes.forEach((r, i) => { r.off = (i - mid) * 3.2; });   // เยื้องเล็กน้อยให้เห็นเส้นที่ซ้อนกัน
    // วาดจากอันดับท้ายขึ้นมา อันดับ 1 จึงอยู่บนสุด — เส้นส่วนใหญ่วิ่งถนนสายเดียวกัน เส้นที่วาดทีหลังทับเส้นก่อน
    [...routes].reverse().forEach(r => {
      const pts = r.coords.map(c => proj(c));
      const d = line(pts);
      // หน้าที่ฝัง (Demo) ใช้เส้นเรืองแสง + รถแบบใหม่ทั้งโหมดขาวและดำ — สลับโหมดเปลี่ยนแค่พื้น/ประเทศ/จุดขึ้นลง
      r.tube = fed ? neonTube(gRoutes, d, { a: pts[0], b: pts[pts.length - 1], off: r.off,
          empty: r.tone === "empty", loss: r.tone !== "empty" && r.profit < 0 })
        : tube(gRoutes, d, r.color, { off: r.off });
      r.tube.g.style("cursor", "pointer").on("click", () => toggle(r.id));
      r.$hit = gRoutes.append("path").attr("d", d).attr("stroke", "transparent")
        .attr("stroke-width", 20).style("cursor", "pointer").on("click", () => toggle(r.id));
    });

    if (!fed) CITIES.forEach(d => {
      const g = pin(gCity, proj(d.c));
      g.append("circle").attr("r", d.size ? 5 : 3.6)
        .attr("fill", "#fff").attr("stroke", "#5f6368").attr("stroke-width", d.size ? 2.4 : 1.8);
      label(g, d.n, d.dx, 4,
        { anchor:d.anchor, size:d.size || 12.5, weight:d.weight || 500, fill:"#3c4043", haloW:4 });
    });

    const max = d3.max(routes, r => r.profit) || 1;
    routes.forEach(r => {
      const b = list.append("button").attr("class", "row").attr("type", "button")
        .attr("aria-pressed", r.id === selected).attr("id", "row" + r.id)
        .on("click", () => toggle(r.id));
      b.append("span").attr("class", "chip").style("background", r.color);
      const t = b.append("span");
      t.append("span").attr("class", "nm").text(r.name);
      t.append("div").attr("class", "bar").style("background", r.color)
        .style("width", (100 * Math.max(0, r.profit) / max).toFixed(1) + "%");
      b.append("span").attr("class", "val").text(fmt(r.profit));
    });
  }

  /* คลิกเส้นทางเดิมซ้ำ = ยกเลิกการเลือก กลับเป็นเงา
     ข้อมูลจากหน้าที่ฝัง: หน้านั้นเป็นคนเลือกเส้นทาง แผนที่แค่แสดง — คลิกเส้นบนแผนที่ไม่ทำอะไร */
  const toggle = id => { if (!fed) select(selected === id ? null : id); };

  /* เลือกเส้นทาง (null = ยังไม่เลือก แสดงเป็นเงาทุกเส้น, 0 = แสดงทั้งหมด) */
  function select(id) {
    selected = id;
    routes.forEach(r => {
      const on = r.id === id || id === 0;
      r.tube.state(on ? "on" : "dim");
      d3.select("#row" + r.id).attr("aria-pressed", id !== 0 && r.id === id);
    });
    if (id) {
      const r = routes.find(x => x.id === id);
      r.tube.g.raise(); r.$hit.raise();
    }
    refreshCars();
    gEnd.selectAll("*").remove();

    (id ? [routes.find(r => r.id === id)] : []).forEach(r => {
      if (r.tube.neon) {
        // ต้นทาง = จุดเขียวไส้ขาว · ปลายทาง = จุดเขียวมีวงกระเพื่อม (ตามดีไซน์ "Route 1c")
        const a = pin(gEnd, proj(r.coords[0]));
        const col = r.tube.color;   // เขียว = กำไร · แดง = ขาดทุน (ตามสีเส้น)
        a.append("circle").attr("r", 7).attr("fill", col);
        a.append("circle").attr("r", 2.6).attr("fill", "#fff");
        const z = pin(gEnd, proj(r.coords[r.coords.length - 1]));
        z.html(`<circle r="10" fill="none" stroke="${col}" stroke-width="1.2"><animate attributeName="r" values="6;14" dur="1.6s" repeatCount="indefinite"/><animate attributeName="opacity" values="1;0" dur="1.6s" repeatCount="indefinite"/></circle>`
          + `<circle r="5.5" fill="${col}" stroke="${NEON.bg}" stroke-width="2"/>`);
        return;
      }
      const a = pin(gEnd, proj(r.coords[0]));
      a.append("circle").attr("r", 8.5)
        .attr("fill", r.color).attr("stroke", "#fff").attr("stroke-width", 2.5);
      // โหมดฝังมีป้ายชื่อของจุดขึ้นลงอยู่แล้ว (fedStops) — ไม่ต้องซ้ำ
      if (!fed) label(a, r.from, -14, 24, { anchor:"end", size:13, weight:600, fill:"var(--ink)", haloW:4.5 });
      const z = pin(gEnd, proj(r.coords[r.coords.length - 1]));
      z.append("path")
        .attr("d", "M0,0 C-11,-13 -13,-17 -13,-22 A13,13 0 1 1 13,-22 C13,-17 11,-13 0,0 Z")
        .attr("fill", r.color).attr("stroke", "#fff").attr("stroke-width", 2);
      z.append("circle").attr("cy", -22).attr("r", 4.6).attr("fill", "#fff");
    });

    document.getElementById("lgSw").style.background = id ? routes.find(r => r.id === id).color : "#9aa0a6";
    document.getElementById("hint").textContent =
      id === 0 ? `กำลังแสดงทั้ง ${routes.length} เส้นทาง` : id ? "เลือกอยู่: " + routes.find(r => r.id === id).name
        : "คลิกเส้นทางเพื่อดูบนแผนที่";
    document.getElementById("allBtn").textContent = id === 0 ? "ล้างการเลือก" : "แสดงทั้งหมด";
  }

  document.getElementById("allBtn").onclick = () => select(selected === 0 ? null : 0);
  buildTop(ROUTES);
  select(null);

  /* ================= แท็บ: เครือข่ายขนส่ง ================= */
  const names = Object.keys(STOPS);
  const pos = Object.fromEntries(names.map(n => [n, proj(STOPS[n].c)]));
  const outOf = n => PAIRS.filter(p => p[0] === n).map(p => p[1]);
  const inTo  = n => PAIRS.filter(p => p[1] === n).map(p => p[0]);

  // แนวเส้นทางตามถนนหลัก (src/roads.js) ทุกคู่ แสดงเฉพาะเมื่อเลือกจุด — คิดตอนใช้ครั้งแรก
  // (เดิมคิดล่วงหน้าตอนเปิด 326 คู่ × หาเส้นทางสั้นสุด ทั้งที่โหมดฝังไม่เคยเลือกจุด)
  let netRoutesMemo = null;
  const netRoutes = () => netRoutesMemo ??= PAIRS.map(([from, to]) =>
    ({ from, to, off: 0, d: line(roadPath(from, to).map(c => proj(c))) }));
  const gNetLine = gNet.append("g").attr("fill", "none")
    .attr("stroke-linecap", "round").attr("stroke-linejoin", "round");

  // เมืองที่แท็บกำไรสูงสุดมีป้ายชื่ออยู่แล้ว: ซ่อนจุดซ้ำในแท็บนั้น
  const CITY_NAMES = new Set(CITIES.map(d => d.n));

  const stopPins = gStops.selectAll("g").data(names).join("g")
    .attr("class", "pin").on("click", (e, n) => { if (mode === "net") selectStop(n); })
    .each(function (n) {
      this.__p = pos[n];
      const s = STOPS[n], g = d3.select(this), left = LEFT.has(n);
      g.append("title").text(`${n}${s.approx ? " (พิกัดโดยประมาณ)" : ""} · ขาออก ${outOf(n).length} · ขาเข้า ${inTo(n).length}`);
      g.append("circle").attr("class", "hit").attr("r", 11).attr("fill", "transparent");   // พื้นที่คลิก
      g.append("circle").attr("class", "dot");
      label(g, n, left ? -9 : 9, 4, { anchor: left ? "end" : "start", size:12, fill:"#3c4043", haloW:4 });
    });

  // ปุ่มเลือกจุดในแผง แบ่งตามกลุ่ม
  [["north", "#chipsNorth"], ["bkk", "#chipsBkk"]].forEach(([grp, el]) => {
    const b = d3.select(el).selectAll("button").data(names.filter(n => STOPS[n].group === grp))
      .join("button").attr("class", "stopbtn").attr("type", "button")
      .on("click", (e, n) => selectStop(n));
    b.append("span").text(n => n + (STOPS[n].approx ? "*" : ""));
    b.append("small").text(n => outOf(n).length + inTo(n).length);
  });

  function selectStop(n) {
    netSel = netSel === n ? null : n;
    focus = null;
    // แจ้งหน้าที่ฝังแผนที่ไว้ (iframe) ว่าเลือกจุดไหน ให้กรองกราฟตามได้
    if (window.parent !== window) window.parent.postMessage({ type: "map:stop", stop: netSel }, "*");
    const rel = netSel ? netRoutes().filter(r => r.from === netSel || r.to === netSel) : [];
    // ขาออกเยื้องขวา ขาเข้าเยื้องซ้ายเล็กน้อย ให้เห็นทั้งสองสีบนถนนเส้นเดียวกัน; ขาออกวาดทับบนสุด
    rel.forEach(r => { r.off = r.from === netSel ? 2 : -2; });
    rel.sort((a, b) => (a.from === netSel) - (b.from === netSel));
    gNetLine.selectAll("*").remove();
    netTubes = rel.map(r => tube(gNetLine, r.d, r.from === netSel ? OUT : IN, { scale: .72, off: r.off }).state("on"));
    refreshCars();

    gNetEnd.selectAll("*").remove();
    if (netSel) {
      const z = pin(gNetEnd, pos[netSel]);
      z.append("path")
        .attr("d", "M0,0 C-11,-13 -13,-17 -13,-22 A13,13 0 1 1 13,-22 C13,-17 11,-13 0,0 Z")
        .attr("fill", OUT).attr("stroke", "#fff").attr("stroke-width", 2);
      z.append("circle").attr("cy", -22).attr("r", 4.6).attr("fill", "#fff");
    }
    rescale();

    styleStops();
    d3.selectAll(".stopbtn").attr("aria-pressed", n => n === netSel);

    const det = d3.select("#netDetail");
    if (!netSel) {
      det.html(`ทั้งหมด <b>${PAIRS.length}</b> เส้นทาง · <b>${names.length}</b> จุด<br>` +
        `คลิกจุดบนแผนที่หรือปุ่มด้านบนเพื่อแสดงเส้นทางเข้า–ออกของจุดนั้น`);
      return;
    }
    const o = outOf(netSel), i = inTo(netSel);
    det.html(
      `<div class="det-h"><b>${netSel}</b>${STOPS[netSel].approx ? " <span class=\"warn\">พิกัดโดยประมาณ</span>" : ""}</div>` +
      `<div class="dir"><span class="sw" style="background:${OUT}"></span><span>ส่งไป <b>${o.length}</b>` +
        (o.length ? `: ${o.join(" · ")}` : "") + `</span></div>` +
      `<div class="dir"><span class="sw" style="background:${IN}"></span><span>รับจาก <b>${i.length}</b>` +
        (i.length ? `: ${i.join(" · ")}` : "") + `</span></div>`);
  }

  /* แสดงเส้นทางเดียวจาก from → to (ใช้กับลิงก์ #from=…&to=…) เช่น เส้นทางเที่ยวเปล่าที่คลิกใน dashboard */
  const FOCUS = "#d93025";
  function focusRoute(from, to) {
    setMode("net");
    netSel = null;
    selectStop(null);   // ล้างจุดที่เลือกอยู่
    focus = [from, to];
    const coords = roadPath(from, to);
    netTubes = from === to ? [] : [tube(gNetLine, line(coords.map(c => proj(c))), FOCUS, { scale: .9 }).state("on")];
    refreshCars();

    const a = pin(gNetEnd, pos[from]);
    a.append("circle").attr("r", 8).attr("fill", FOCUS).attr("stroke", "#fff").attr("stroke-width", 2.5);
    if (from !== to) {
      const z = pin(gNetEnd, pos[to]);
      z.append("path")
        .attr("d", "M0,0 C-11,-13 -13,-17 -13,-22 A13,13 0 1 1 13,-22 C13,-17 11,-13 0,0 Z")
        .attr("fill", FOCUS).attr("stroke", "#fff").attr("stroke-width", 2);
      z.append("circle").attr("cy", -22).attr("r", 4.6).attr("fill", "#fff");
    }
    styleStops();
    rescale();

    const [x0, x1] = d3.extent(coords, c => c[0]), [y0, y1] = d3.extent(coords, c => c[1]);
    zoomToBox([[x0 - .3, y0 - .3], [x1 + .3, y1 + .3]]);

    d3.select("#netDetail").html(`<div class="det-h"><b>${from} → ${to}</b></div>` +
      `<div class="dir"><span class="sw" style="background:${FOCUS}"></span><span>เส้นทางที่เลือกจาก dashboard</span></div>`);
  }

  /* สไตล์จุดขึ้นลงตามแท็บ: แท็บเครือข่ายเน้นจุดที่เลือก, แท็บกำไรแสดงจุดอย่างเดียว (คลิกไม่ได้) */
  function styleStops() {
    const yellow = n => mode === "top" && fed && fedNear.has(n);
    const dark = mode === "top" && fed && isDark();
    const sel = mode === "net" ? netSel : null;
    const linked = new Set(sel ? [sel, ...outOf(sel), ...inTo(sel)] : focus && mode === "net" ? focus : names);
    // ข้อมูลจากหน้าที่ฝัง: แสดงทุกจุดขึ้นลงเสมอแม้ยังไม่มีเส้น (เจ้าของงานขอ 24 ก.ย. 2569) — เลือกเส้นแล้ว
    // จุดที่ไม่ใช่ต้นทาง/ปลายทางของเส้นนั้นจางลง ให้เส้นที่เลือกเด่น
    stopPins
      .attr("display", n => mode !== "top" || fed ? null : CITY_NAMES.has(n) ? "none" : null)
      .attr("opacity", n => mode === "top" && fed ? (!fedStops.size || fedStops.has(n) || fedNear.has(n) ? 1 : .45)
        : linked.has(n) ? 1 : .35)
      .style("cursor", mode === "net" ? "pointer" : null);
    stopPins.select(".hit").attr("pointer-events", mode === "net" ? null : "none");   // ไม่บังการคลิกเส้นทางกำไร
    stopPins.select(".dot")
      .attr("r", n => n === sel ? 7 : 4.5)
      .attr("fill", n => n === sel ? OUT : yellow(n) ? NEAR_FILL : dark ? NEON.bg : STOPS[n].group === "bkk" ? "#5f6368" : "#fff")
      .attr("stroke", n => yellow(n) ? (dark ? NEON.bg : NEAR_STROKE) : dark ? "#4c6b62"
        : n === sel || STOPS[n].group === "bkk" ? "#fff" : "#5f6368")
      .attr("stroke-width", n => n === sel ? 2.5 : 1.8);
    if (sel) stopPins.filter(n => n === sel).raise();
    showLabels();
  }

  /* รถวิ่งบนเส้นที่กำลังแสดง: แท็บกำไร = เส้นที่เลือก (หรือทั้ง 5), แท็บเครือข่าย = เส้นเข้า–ออกของจุดที่เลือก */
  function refreshCars() {
    // ข้อมูลจากหน้าที่ฝัง: มีเส้นเดียว (เส้นที่ผู้ใช้กด) รถคันเดียววิ่งตามเส้นนั้น
    if (mode === "top" && fed) return cars.set(routes.map(r => r.tube));
    cars.set(mode === "top"
      ? (selected === null ? [] : routes.filter(r => selected === 0 || r.id === selected).map(r => r.tube))
      : netTubes);
  }

  function showLabels() {
    stopPins.select("text").attr("display", n =>
      k >= LABEL_ALL_AT || MAJOR.has(n) || (mode === "top" && fed && fedStops.has(n))
        || (mode === "net" && (n === netSel || focus?.includes(n))) ? null : "none");
  }

  /* ================= สลับแท็บ ================= */
  function setMode(m) {
    mode = m;
    gTop.attr("display", m === "top" ? null : "none");
    gEnd.attr("display", m === "top" ? null : "none");
    gNet.attr("display", m === "net" ? null : "none");
    gNetEnd.attr("display", m === "net" ? null : "none");
    styleStops();
    refreshCars();
    d3.selectAll(".tab").attr("aria-selected", function () { return this.dataset.tab === m; });
    d3.selectAll("[data-pane]").property("hidden", function () { return this.dataset.pane !== m; });
  }
  d3.selectAll(".tab").on("click", function () { setMode(this.dataset.tab); });

  /* ================= ซูม / เลื่อนแผนที่ ================= */
  // ป้ายชื่อประเทศ/ทะเลที่ไม่อยู่ในหมุด: ย่อขนาดตัวอักษรกลับให้คงที่บนจอ
  const freeText = gCtx.selectAll("text").each(function () {
    this.__fs = +this.getAttribute("font-size");
    this.__sw = +this.getAttribute("stroke-width");
  });

  /** อัตราขยาย viewBox → จอ ตาม preserveAspectRatio ที่ใช้อยู่ (slice = ด้านที่ขยายมากกว่า · meet = ด้านที่ย่อมากกว่า) */
  function fitOf(w, h) {
    return document.body.classList.contains("thai") ? Math.min(w / W, h / H) : Math.max(w / W, h / H);
  }

  function rescale() {
    // โหมดฝังแผนที่เต็มกล่อง (preserveAspectRatio slice) — viewBox ถูกขยายตามด้านที่ต้องขยายมากกว่า
    const { width: w, height: h } = svg.node().getBoundingClientRect();
    ui = document.body.classList.contains("embed") && w && h ? Math.max(1, 1 / fitOf(w, h)) : 1;
    layoutFleet();   // ตำแหน่งวงของโหมดตำแหน่งรถขึ้นกับระดับซูม — ต้องคิดก่อนวางหมุด
    root.selectAll(".pin").attr("transform", function () { return pinT(this.__p); });
    freeText.attr("font-size", function () { return this.__fs / kk(); })
      .attr("stroke-width", function () { return this.__sw / kk(); });
    routes.forEach(r => { r.tube.place(kk()); r.$hit.attr("transform", `translate(${r.off / kk()},0)`); });
    netTubes.forEach(t => t.place(kk()));
    root.selectAll(".fl-rw").attr("stroke-width", function () { return this.__w / kk(); });   // เส้นทางของหน้าสถานะกองรถ
    cars.render();
    showLabels();
    showFleetLabels();
    updateScale();
  }
  /* ดันป้ายรถของโหมดตำแหน่งรถที่ทับกันให้แยก (26 ก.ย. 2569 — จุดใจกลาง กทม. ห่างกัน 2–3 กม. ทับกันแม้ซูมมุมมอง กทม.)
     ป้ายเป็นแคปซูล (กว้าง __hw×2 · สูง __hh×2 px บนจอ) — คิดแบบกล่อง: ทับกันทั้งสองแกน = ดันออกตามแกนที่ทับน้อยกว่า คู่ละครึ่ง
     ห่าง ≥ 6px · คิดในหน่วยของ root (px ÷ kk()) · ซูมเข้าจนไม่ทับ = กลับที่เดิมเอง
     ป้ายที่ถูกดันเกิน 7px มีเส้นโยงกลับตำแหน่งจริง (__leader) · __p0 = ตำแหน่งจริง · __p = ตำแหน่งที่วาด
     ไม่อ้างตัวแปรของส่วนตำแหน่งรถ (ประกาศทีหลัง rescale — TDZ) */
  function layoutFleet() {
    const nodes = root.selectAll(".fl-pin").nodes();
    if (!nodes.length) return;
    const s = 1 / kk(), GAP = 6;
    const pts = nodes.map(n => ({ n, x: n.__p0[0], y: n.__p0[1], hw: (n.__hw || 14) * s, hh: (n.__hh || 14) * s }));
    for (let it = 0; it < 80; it++) {
      let moved = false;
      for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
        const a = pts[i], b = pts[j];
        let dx = b.x - a.x, dy = b.y - a.y;
        const ox = a.hw + b.hw + GAP * s - Math.abs(dx), oy = a.hh + b.hh + GAP * s - Math.abs(dy);
        if (ox <= 0 || oy <= 0) continue;
        // ตำแหน่งเดียวกันพอดี — แยกตามลำดับ ให้ผลเหมือนเดิมทุกครั้ง
        if (!dx && !dy) dy = (i + j) % 2 ? 1 : -1;
        if (oy <= ox || !dx) { const p = oy / 2 * Math.sign(dy || 1); a.y -= p; b.y += p; }
        else { const p = ox / 2 * Math.sign(dx); a.x -= p; b.x += p; }
        moved = true;
      }
      if (!moved) break;
    }
    pts.forEach(p => {
      p.n.__p = [p.x, p.y];
      const ln = p.n.__leader, [x0, y0] = p.n.__p0;
      if (!ln) return;
      const far = Math.hypot(p.x - x0, p.y - y0) > 7 * s;
      ln.setAttribute("display", far ? "inline" : "none");
      ln.setAttribute("x1", x0); ln.setAttribute("y1", y0); ln.setAttribute("x2", p.x); ln.setAttribute("y2", p.y);
    });
  }
  /** ป้ายชื่อของโหมดตำแหน่งรถ: ผ่านเกณฑ์ (data-min) หรือซูมถึง 2.5 เท่า = ผู้สมัคร
      ไล่วางทีละป้าย (จุดที่เลือกก่อน แล้วจุดที่มีรถมากก่อน) ลองตำแหน่ง ใต้ → ขวา → ซ้าย → บน เอาตำแหน่งแรกที่ไม่ชนป้าย/แคปซูลอื่น
      ไม่มีที่ว่างเลย = ซ่อน (ชื่อดูได้จากป้ายตอนชี้/รายการจุดในหน้า) · จุดที่เลือกได้ตำแหน่งใต้เสมอ
      คิดในหน่วย root (หมุดย่อ 1/kk()) · ไม่อ้างตัวแปรของส่วนนั้น (ประกาศทีหลัง — TDZ) */
  function showFleetLabels() {
    const s = 1 / kk();
    const pins = root.selectAll(".fl-pin").nodes();
    const boxes = [];
    // แคปซูลของทุกจุด หดขอบ 2px — กล่องป้ายเผื่อขอบไว้แล้ว ถ้านับเต็มขนาด จุดที่ชิดกันไม่เหลือที่วางป้ายเลย
    const pills = pins.map(n => {
      const [x, y] = n.__p, hw = ((n.__hw || 14) - 2) * s, hh = ((n.__hh || 14) - 2) * s;
      return { n, b: [x - hw, y - hh, x + hw, y + hh] };
    });
    const cand = pins.map(n => ({ n, t: n.querySelector(".fl-lbl") })).filter(c => c.t)
      .map(c => ({ ...c, on: c.t.getAttribute("data-on") === "1", tot: +c.t.getAttribute("data-t"),
        ok: c.t.getAttribute("data-min") === "1" || k >= 2.5 }))
      .sort((a, b) => b.on - a.on || b.tot - a.tot);
    const over = (b, o) => b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1];
    const hit = (b, n) => boxes.some(o => over(b, o)) || pills.some(p => p.n !== n && over(b, p.b));
    for (const c of cand) {
      let pick = null;
      if (c.ok) {
        const [x, y] = c.n.__p, tw = (c.t.getComputedTextLength?.() || 60) + 4, H = 16;
        const hw = c.n.__hw || 14, hh = c.n.__hh || 14;
        // [ตำแหน่งข้อความในหน่วยหมุด (x, y baseline, anchor), กล่องในหน่วยหมุด (x0, y0, x1, y1)]
        const spots = [
          [0, hh + 13, "middle", -tw / 2, hh + 1, tw / 2, hh + 1 + H],
          [hw + 5, 4, "start", hw + 3, -H / 2, hw + 3 + tw, H / 2],
          [-(hw + 5), 4, "end", -(hw + 3) - tw, -H / 2, -(hw + 3), H / 2],
          [0, -(hh + 5), "middle", -tw / 2, -(hh + 2) - H, tw / 2, -(hh + 2)],
        ];
        for (const sp of (c.on ? spots.slice(0, 1) : spots)) {
          const b = [x + sp[3] * s, y + sp[4] * s, x + sp[5] * s, y + sp[6] * s];
          if (c.on || !hit(b, c.n)) { pick = sp; boxes.push(b); break; }
        }
      }
      if (pick) { c.t.setAttribute("x", pick[0]); c.t.setAttribute("y", pick[1]); c.t.setAttribute("text-anchor", pick[2]); }
      c.t.setAttribute("display", pick ? "inline" : "none");
    }
  }

  const zoom = d3.zoom().scaleExtent([1, 24]).translateExtent([[0, 0], [W, H]])
    // ล้อเมาส์ต้องกด Ctrl ค้าง (ทัชแพดแบบบีบนิ้วส่ง Ctrl ให้อัตโนมัติ) หน้าเว็บจึงยังเลื่อนขึ้นลงได้ตามปกติ
    .filter(e => (e.type === "wheel" ? e.ctrlKey || e.metaKey : !e.button))
    .on("zoom", e => { k = e.transform.k; root.attr("transform", e.transform); rescale(); })
    .on("end", redrawLand);
  svg.call(zoom);

  // ซูมให้กรอบ [lon,lat] พอดีกับพื้นที่ทางซ้ายของแผงรายการ (แผงกว้าง ~340px ทับด้านขวา; โหมดฝังไม่มีแผง)
  // โหมดฝัง: viewBox ถูกตัดขอบ (slice) ให้เต็มกล่อง — พื้นที่ที่เห็นจริงคือกล่อง ÷ อัตราขยาย จัดกึ่งกลางเหมือนเดิม
  // โหมด #thai ใช้ meet (เห็นทั้งประเทศ ส่วนที่เหลือโปร่งใส) อัตราขยายจึงเป็นด้านที่ย่อมากกว่า
  const zoomToBox = ([[x0, y0], [x1, y1]]) => {
    let VIS_W = W - 360, VIS_H = H;
    if (document.body.classList.contains("embed")) {
      const { width: w, height: h } = svg.node().getBoundingClientRect();
      const f = w && h ? fitOf(w, h) : 1;
      VIS_W = w ? w / f : W; VIS_H = h ? h / f : H;
    }
    const [a, b] = [proj([x0, y1]), proj([x1, y0])];
    const s = Math.min(24, .9 / Math.max((b[0] - a[0]) / VIS_W, (b[1] - a[1]) / VIS_H));
    svg.transition().duration(700).call(zoom.transform,
      d3.zoomIdentity.translate(document.body.classList.contains("embed") ? W / 2 : VIS_W / 2, H / 2).scale(s).translate(-(a[0] + b[0]) / 2, -(a[1] + b[1]) / 2));
  };
  const zoomBy = f => svg.transition().duration(300).call(zoom.scaleBy, f);
  d3.select("#zIn").on("click", () => zoomBy(1.6));
  d3.select("#zOut").on("click", () => zoomBy(1 / 1.6));
  d3.select("#zReset").on("click", () => svg.transition().duration(600).call(zoom.transform, d3.zoomIdentity));
  d3.select("#zBkk").on("click", () => zoomToBox([[99.75, 13.45], [100.85, 14.15]]));
  d3.select("#zNorth").on("click", () => zoomToBox([[98.4, 16.3], [101.7, 20.5]]));

  /* ---------- สเกลบาร์ (คำนวณใหม่ตามระดับซูม) ---------- */
  const a = proj.invert([100, H / 2]), b = proj.invert([220, H / 2]);
  const km120 = d3.geoDistance(a, b) * 6371;   // ระยะทางจริงของ 120px ที่ซูม 1 เท่า
  function updateScale() {
    const km = km120 / k;
    const nice = [1, 2, 5, 10, 20, 50, 100, 200, 300, 500]
      .reduce((p, c) => Math.abs(c - km) < Math.abs(p - km) ? c : p);
    document.getElementById("scaleBar").style.width = (120 * nice / km).toFixed(1) + "px";
    document.getElementById("scaleTxt").textContent = nice + " กม.";
  }

  /* ปุ่มหยุด/เล่นรถ (ผู้ใช้ที่ตั้งค่าลดการเคลื่อนไหวจะเริ่มแบบหยุดไว้) */
  const playBtn = d3.select("#zPlay");
  const setPlay = v => {
    const on = cars.toggle(v);
    svg.classed("paused", !on);
    playBtn.text(on ? "⏸" : "▶").attr("aria-label", on ? "หยุดรถ" : "เล่นรถ").attr("aria-pressed", !on);
  };
  playBtn.on("click", () => setPlay());
  setPlay(!matchMedia("(prefers-reduced-motion: reduce)").matches);

  selectStop(null);
  setMode("top");
  rescale();

  // ลิงก์เปิดมุมมองเฉพาะได้ เช่น  #stop=ตลาดไท&view=bkk  (view: bkk | north, tab: net | top)
  //   #from=ท่าลี่&to=กองลอย = แสดงเส้นทางเดียว · #embed = โหมดฝังใน iframe (ซ่อนแผงด้านข้าง)
  // อ่านใหม่ทุกครั้งที่ # เปลี่ยน หน้าที่ฝังแผนที่จึงสั่งแผนที่ได้โดยไม่ต้องโหลดใหม่
  function applyHash() {
    const h = new URLSearchParams(decodeURIComponent(location.hash.slice(1)));
    document.body.classList.toggle("embed", h.has("embed"));
    document.body.classList.toggle("bare", h.has("bare"));
    // #thai = เฉพาะประเทศไทย (ซ่อนทะเล/ประเทศเพื่อนบ้าน) — หน้า Demo ของโมเดลใช้ · #3d = ผนัง + เงา + เอียง (ปิดอยู่)
    document.body.classList.toggle("thai", h.has("thai"));
    document.body.classList.toggle("map3d", h.has("3d"));
    document.body.classList.toggle("dark", h.has("dark"));
    // ฝังในกล่องสัดส่วนไหนก็เต็มกล่อง — ตัดขอบที่เกินแทนการเว้นแถบว่าง (เจ้าของงานเห็นแถบเทาใต้แผนที่ 24 ก.ย. 2569)
    // ยกเว้น #thai ที่ต้องเห็นทั้งประเทศ พื้นหลังโปร่งอยู่แล้ว จึงไม่มีแถบให้เห็น
    svg.attr("preserveAspectRatio", h.has("embed") && !h.has("thai") ? "xMidYMid slice" : null);
    if (h.get("tab") === "net") setMode("net");
    if (h.get("tab") === "top") setMode("top");
    const from = h.get("from"), to = h.get("to");
    if (STOPS[from] && STOPS[to]) return focusRoute(from, to);
    if (focus || (h.has("reset") && netSel)) { netSel = null; selectStop(null); }   // reset = ล้างการเลือก
    if (STOPS[h.get("stop")] && h.get("stop") !== netSel) selectStop(h.get("stop"));
    if (h.get("view") === "bkk") d3.select("#zBkk").dispatch("click");
    if (h.get("view") === "north") d3.select("#zNorth").dispatch("click");
  }
  applyHash();
  rescale();   // applyHash อาจเพิ่งตั้ง body.embed — คิดตัวคูณขนาดใหม่
  // โหมดฝัง: เริ่มจากแผนที่เปล่าทันที ไม่ให้เห็นเส้น/จุดตัวอย่างของ data.js แวบก่อนหน้าที่ฝังส่งข้อมูลมา
  if (document.body.classList.contains("embed")) feed({ routes: [] });
  window.addEventListener("hashchange", applyHash);
  window.addEventListener("resize", rescale);

  /* ================= รับเส้นทางจากหน้าที่ฝังแผนที่ไว้ (iframe) =================
     { type:"map:routes", routes:[{ key, from, to, profit, color?, tone? }] }
       tone "empty" = แผนที่เที่ยววิ่งเปล่า: เส้น/รถแดง (NEON_EMPTY) + จุดขึ้นลงที่เส้นผ่าน/ในรัศมี 100 กม. เป็นสีเหลือง
       → แทนเส้นที่แสดงทั้งชุด (หน้า Demo ส่งทีละเส้น · ว่าง = ล้าง) · from/to ต้องเป็นชื่อใน STOPS (network.js)
         ไม่งั้นข้ามเส้นนั้น · แนวเส้นตามถนนหลักจาก roads.js · มุมมองคงที่ (fitAllStops) ไม่ซูมตามเส้น
     แผนที่ส่ง "map:ready" ตอนวาดพื้นเสร็จ (ข้อความที่ส่งมาก่อนหน้านั้นหายไป หน้าที่ฝังต้องรอสัญญาณนี้) ·
     "map:drawn" { keys } หลังรับ map:routes (เส้นที่วาดได้จริง) */
  const PALETTE = ["#0f8a5f", "#1a73e8", "#e37400", "#9334e6", "#d93025", "#12a4b8", "#5f6368"];

  /* กรอบมุมมองคงที่ของโหมดฝัง = ทุกจุดขึ้นลงใน STOPS (ภาคเหนือ–กรุงเทพฯ) ตั้งครั้งเดียว ไม่ซูมตามเส้นที่กด
     ขนาดแผนที่จึงเท่าเดิมทุกครั้งที่เปลี่ยนเส้นทาง (เจ้าของงานสั่ง 24 ก.ย. 2569) */
  function fitAllStops() {
    // โหมด #thai: ทั้งประเทศ (ขอบเขตจังหวัดทั้งหมด) แทนเฉพาะช่วงที่มีจุดขึ้นลง
    if (document.body.classList.contains("thai")) {
      const [[x0, y0], [x1, y1]] = d3.geoBounds(prov);
      return zoomToBox([[x0 - .2, y0 - .2], [x1 + .2, y1 + .5]]);   // เผื่อล่างให้ผนัง/เงา 3 มิติ
    }
    const cs = Object.values(STOPS).map(s => s.c);
    const [x0, x1] = d3.extent(cs, c => c[0]), [y0, y1] = d3.extent(cs, c => c[1]);
    zoomToBox([[x0 - .3, y0 - .25], [x1 + .3, y1 + .25]]);
  }

  /* โหมดฝังของหน้า Demo (เจ้าของงานสั่ง 24 ก.ย. 2569): เปิดมา = แผนที่เปล่า ไม่มีเส้น/จุด/ป้ายเมืองของ data.js
     หน้าที่ฝังส่งเส้นที่ผู้ใช้กดมาทีละเส้น (routes ว่าง = ล้างแผนที่) → วาดเส้นนั้น + หมุดต้นทาง/ปลายทาง + รถหนึ่งคัน */
  /* ระยะจากจุดถึงแนวเส้น = ระยะวงกลมใหญ่ถึงจุดที่ใกล้สุดบนเส้น — แบ่งแต่ละท่อนถี่ ๆ ทุก ~5 กม.
     (roadPath ให้แค่ปมถนน ท่อนหนึ่งยาวได้หลายสิบกิโล ถ้าวัดถึงปมอย่างเดียวจุดกลางท่อนจะหลุด) */
  function nearStops(lines) {
    const R = 6371, pts = [];
    lines.forEach(cs => cs.forEach((c, i) => {
      if (!i) return pts.push(c);
      const a = cs[i - 1], n = Math.max(1, Math.ceil(d3.geoDistance(a, c) * R / 5)), f = d3.geoInterpolate(a, c);
      for (let j = 1; j <= n; j++) pts.push(f(j / n));
    }));
    if (!pts.length) return new Set();
    return new Set(names.filter(n => pts.some(p => d3.geoDistance(STOPS[n].c, p) * R <= NEAR_KM)));
  }

  function feed(msg) {
    const first = !fed;
    fed = true;
    // จุดขึ้นลงทุกจุดแสดงตลอดในโหมดนี้ — ย้ายไว้ใต้ชั้นเส้นทาง ไม่งั้นจุดที่จางแล้วไปทับบนเส้นที่เลือก
    if (first) root.node().insertBefore(gStops.node(), gTop.node());
    const ok = (msg.routes || []).filter(r => STOPS[r.from] && STOPS[r.to] && r.from !== r.to);
    buildTop(ok.map((r, i) => ({
      id: i + 1, key: r.key, from: r.from, to: r.to, profit: +r.profit || 0, tone: r.tone,
      name: r.from + "–" + r.to, color: r.color || PALETTE[i % PALETTE.length],
      coords: roadPath(r.from, r.to)
    })));
    fedStops = new Set(routes.flatMap(r => [r.from, r.to]));
    fedNear = nearStops(routes.filter(r => r.tone === "empty").map(r => r.coords));
    // แจ้งกลับว่าวาดเส้นไหนได้บ้าง — หน้าที่ฝังจะบอกผู้ใช้เองว่าเส้นที่เหลือไม่มีพิกัดในแผนที่
    if (window.parent !== window) window.parent.postMessage({ type: "map:drawn", keys: routes.map(r => r.key) }, "*");
    setMode("top");
    select(routes.length ? routes[0].id : null);
    rescale();
    if (first) fitAllStops();
  }

  /* ================= ตำแหน่งรถปัจจุบัน (หน้าสถานะกองรถ · ข้อมูลชุดเดียวกับตารางสถานะรายคัน · 26 ก.ย. 2569) =================
     { type:"map:fleet", stops:[{ name, ready, moving, upcoming, stale, total }], labels?:{ ready, moving, upcoming, stale } }
       labels = ชื่อสถานะในป้ายตอนชี้วง (หน้าสถานะกองรถส่ง "ว่างอยู่ที่คลัง"/"กำลังเดินทางมา") · ไม่ส่ง = ชื่อตั้งต้นด้านล่าง
       → รูปรถ 3 มิติ ไม่มีกรอบ ตัวเลขบนตู้สินค้า (= จำนวนรถทั้งหมดที่จุดนั้น) ที่จุดขึ้นลงแต่ละจุด ขนาดเท่ากันทุกจุด · จุดขึ้นลงอื่นซ่อน
         สีรถ: มีรถพร้อม = เขียว · มีแต่รถกำลังเข้า = ฟ้า · มีแต่รถจัดงานแล้ว = ส้ม · มีแต่ข้อมูลเก่า = เทา
         มีรถพร้อมและรถกำลังเข้าด้วย = รถเขียวมีจุดน้ำเงินเหนือหัว · รถหายใจเบา ๆ (.fl-pill ใน styles.css) · เลือกอยู่ = ใหญ่ขึ้น 1.25 เท่า
       กดวง → ส่ง "map:stop" { stop } กลับ (กดซ้ำ = null) · หน้าเว็บส่ง "map:fleetSel" { stop, zoom? } ให้ไฮไลต์วงตามตารางได้
       (zoom = ซูมไปกลุ่มของจุดนั้นด้วย แล้วส่ง "map:view" { view } กลับ) · หน้าเว็บส่ง "map:view" { view: all | north | bkk } สลับมุมมอง
       ชื่อที่ไม่มีใน STOPS ส่งกลับเป็น "map:fleetMissing" { names } · ส่ง stops ว่าง = ล้างวงทั้งหมด
     routes?:[{ from, to, n }] = เส้นทางของรถที่กำลังเดินทาง (หน้าส่งเฉพาะตอนกรองสถานะ "กำลังเดินทาง")
       **ไม่วาดจนกว่าจะกดป้ายรถ** (เจ้าของงานสั่ง 26 ก.ย. 2569) — กดป้าย = วาดเส้นทางที่รถของจุดนั้นวิ่งผ่านมา (to = จุดที่เลือก)
       ตามถนน (roadPath) แบบลากเส้นจากต้นทางถึงปลายทาง แล้วมีแสงวิ่งตามเส้นวน · ต้นทาง = วงกลวง + ชื่อ · หนาขึ้นตามจำนวนรถ
       + **รถวิ่งตามเส้นละหนึ่งคัน** (เจ้าของงานขอ 26 ก.ย. 2569 · `Cars` ตัวเดียวกับหน้า Demo) ออกวิ่งหลังลากเส้นเสร็จ · ชั้นรถ (gCars)
       ย้ายมาอยู่เหนือเส้นทาง ใต้ป้ายรถ ตอนได้ข้อมูลชุดแรก
       ความหนาเป็นหน่วย viewBox (.fl-rw · __w ÷ kk() ใน rescale) ไม่ใช่ non-scaling-stroke เพราะการลากเส้นใช้ dasharray
       ★ ต้องตั้ง style vector-effect:none — styles.css มี `#map path{vector-effect:non-scaling-stroke}` ครอบทุกเส้น ถ้าไม่ทับ
         เบราว์เซอร์วัดขีด (dasharray) กับความหนาเป็นพิกเซลบนจอ ซูมเข้า k เท่า = ขีดยาวแค่ 1/k ของเส้น เส้นหายเหลือท่อนเดียว
         ทั้งที่รถยังวิ่งบนเส้นที่มองไม่เห็น + เส้นบางลง (เจ้าของงานเจอตอนกดมุมมองภาคเหนือ 26 ก.ย. 2569) · ต้องเป็น style ไม่ใช่ attribute
         เพราะกฎ CSS ชนะ presentation attribute · dasharray คิดจากความยาวจริง (getTotalLength)
       ต้นทาง/ปลายทางที่ไม่มีใน STOPS หรือต้นทาง = ปลายทาง ไม่วาด (ไม่นับใน fleetMissing — ป้ายยังปักที่ปลายทางได้) */
  const gFleetRoutes = root.append("g").attr("fill", "none")
    .attr("stroke-linecap", "round").attr("stroke-linejoin", "round");   // เส้นทางรถกำลังเดินทาง (ใต้วงและเส้นโยง)
  const gFleetLines = root.append("g").attr("pointer-events", "none");   // เส้นโยงของวงที่ถูกดันออก (ใต้วง)
  const gFleet = root.append("g");
  let fleetSel = null, fleetData = [], fleetRoutes = [];
  let fleetCarTimer = 0;   // หน่วงให้รถออกวิ่งหลังลากเส้นเสร็จ — ล้างทุกครั้งที่วาดใหม่
  let fleetLabels = { ready: "พร้อมใช้งาน", moving: "กำลังเข้า", upcoming: "จัดงานแล้ว", stale: "ไม่มีข้อมูลล่าสุด" };
  const FLEET_COL = { ready: "#0f8a5f", moving: "#1a73e8", upcoming: "#e37400", stale: "#9aa0a6" };
  const FLEET_LABEL_MIN = 5;
  /* ป้ายขนาดเท่ากันทุกจุด (เจ้าของงานสั่ง 26 ก.ย. 2569 — เดิมโตตามจำนวนรถ วงใหญ่ใน กทม./เชียงใหม่ทับกันจนอ่านไม่ออก) */
  const fleetMain = s => s.ready ? "ready" : s.moving ? "moving" : s.upcoming ? "upcoming" : "stale";

  /* รถ 3 มิติในแคปซูล (ดีไซน์ truck-marker-2b ที่เจ้าของงานส่ง 26 ก.ย. 2569 — ว่าง = รถเขียว · กำลังเดินทาง = รถฟ้า)
     วาดครั้งเดียวใน <defs> ต่อสี แล้วแต่ละจุดอ้างด้วย <use> — viewBox 37×27: เงาพื้น · ตู้สินค้า (ด้านข้างไล่เฉด + หลังคาสว่าง + แถบเงา)
     · หัวรถ (ไล่เฉด + หลังคา + กระจกสะท้อน + ไฟหน้า) · แชสซี · ล้อมีดุม */
  const TRUCK_TONE = {
    ready:    { hi: "#5fd39a", lo: "#1f8a5c", cabHi: "#7fe0b0", cabLo: "#2a9d6a", top: "#b6ecd0", ink: "#0d4a31" },
    moving:   { hi: "#7fb6ff", lo: "#1a5fc4", cabHi: "#9cc8ff", cabLo: "#2f7fe8", top: "#cfe2ff", ink: "#0b3a80" },
    upcoming: { hi: "#ffb566", lo: "#c96200", cabHi: "#ffc98a", cabLo: "#e37400", top: "#ffe2bf", ink: "#6b3300" },
    stale:    { hi: "#c3c8cd", lo: "#80868b", cabHi: "#d3d7db", cabLo: "#9aa0a6", top: "#e8eaed", ink: "#3c4043" },
  };
  {
    const defs = svg.append("defs");
    const grad = (id, a, b) => {
      const g = defs.append("linearGradient").attr("id", id).attr("x1", 0).attr("y1", 0).attr("x2", 0).attr("y2", 1);
      g.append("stop").attr("offset", 0).attr("stop-color", a);
      g.append("stop").attr("offset", 1).attr("stop-color", b);
    };
    grad("flGlass", "#f4faff", "#8fbfe6");
    Object.entries(TRUCK_TONE).forEach(([kind, t]) => {
      grad(`flBox-${kind}`, t.hi, t.lo);
      grad(`flCab-${kind}`, t.cabHi, t.cabLo);
      const s = defs.append("symbol").attr("id", `flTruck-${kind}`).attr("viewBox", "0 0 37 27")
        .attr("stroke-linejoin", "round").attr("stroke-linecap", "round");
      s.append("ellipse").attr("cx", 18.5).attr("cy", 24.6).attr("rx", 17).attr("ry", 2.1).attr("fill", "rgba(0,0,0,.22)");
      // ตู้สินค้า: หลังคา (เอียงไปหลัง) → ด้านข้าง → แถบสะท้อน → รอยต่อแผ่น
      s.append("path").attr("d", "M2 5.2 L5.6 1.6 H24.4 L22 5.2 Z").attr("fill", t.top).attr("stroke", t.ink).attr("stroke-width", 1.1);
      s.append("rect").attr("x", 2).attr("y", 5.2).attr("width", 20).attr("height", 14.3).attr("rx", 1.8)
        .attr("fill", `url(#flBox-${kind})`).attr("stroke", t.ink).attr("stroke-width", 1.3);
      // (ไม่มีแถบสะท้อน/รอยต่อแผ่นบนตู้แล้ว — ตัวเลขจำนวนรถเขียนทับตู้ตรงนี้ · เจ้าของงานสั่ง 26 ก.ย. 2569)
      // หัวรถ: หลังคา → ตัวหัว → กระจก (+ แสงสะท้อน) → ไฟหน้า
      s.append("path").attr("d", "M22 9.2 L24.2 7 H29.8 L29.2 9.2 Z").attr("fill", t.top).attr("stroke", t.ink).attr("stroke-width", 1);
      s.append("path").attr("d", "M22 9.2 H29.2 L35.2 15.6 V20 H22 Z")
        .attr("fill", `url(#flCab-${kind})`).attr("stroke", t.ink).attr("stroke-width", 1.3);
      s.append("path").attr("d", "M24 11.2 H28.4 L32 15.1 H24 Z").attr("fill", "url(#flGlass)").attr("stroke", t.ink).attr("stroke-width", .9);
      s.append("path").attr("d", "M25 12.2 L27.2 12.2 L25 14.4 Z").attr("fill", "#fff").attr("opacity", .75);
      s.append("rect").attr("x", 33.4).attr("y", 16.4).attr("width", 1.8).attr("height", 1.8).attr("rx", .6).attr("fill", "#ffd66b");
      // แชสซี + กันชน
      s.append("rect").attr("x", 1.6).attr("y", 19.2).attr("width", 34.2).attr("height", 1.9).attr("rx", .95).attr("fill", "#37414b");
      // ล้อ: ยาง → ดุม → จุดสะท้อน
      [8, 29].forEach(cx => {
        s.append("circle").attr("cx", cx).attr("cy", 21.4).attr("r", 3.6).attr("fill", "#2b2f36").attr("stroke", "#111").attr("stroke-width", .8);
        s.append("circle").attr("cx", cx).attr("cy", 21.4).attr("r", 1.5).attr("fill", "#c9d1d9");
        s.append("circle").attr("cx", cx - .9).attr("cy", 20.3).attr("r", .6).attr("fill", "#fff").attr("opacity", .7);
      });
    });
  }

  function drawFleet() {
    gFleet.selectAll("*").remove();
    gFleetLines.selectAll("*").remove();
    gFleetRoutes.selectAll("*").remove();
    const dark = isDark();
    // เส้นทางที่รถของจุดที่เลือกวิ่งผ่านมา — วาดเฉพาะตอนกดป้าย (ยังไม่เลือก = ไม่มีเส้น)
    // ลากเส้น (dasharray = ความยาวจริง · dashoffset ความยาว → 0) ~1.4 วิ แล้วแสงวิ่งจากต้นทางถึงปลายทางวนไป
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    clearTimeout(fleetCarTimer);
    cars.set([]);
    const carTubes = [];
    fleetRoutes.filter(r => fleetSel && r.to === fleetSel).sort((a, b) => a.n - b.n).forEach(r => {
      const g = gFleetRoutes.append("g");
      g.append("title").text(`${r.from} → ${r.to} · กำลังเดินทาง ${r.n} คัน`);
      const w = Math.min(6, 3 + (r.n - 1) * .6);
      const path = (cls, stroke, width) => g.append("path").attr("class", "fl-rw " + cls).attr("d", r.d)
        .attr("stroke", stroke).style("vector-effect", "none").each(function () { this.__w = width; })
        .attr("stroke-width", width / kk());
      path("fl-rbase", "#fff", w + 3).attr("opacity", .9);   // ขอบขาวให้เส้นเด่นจากเส้นจังหวัด
      const main = path("fl-rline", FLEET_COL.moving, w);
      const L = main.node().getTotalLength();   // หน่วยเดียวกับ dasharray (หน่วยของเส้น ไม่ขึ้นกับซูม)
      // Cars ใช้ getTotalLength/getPointAtLength ของเส้นนี้ตรง ๆ
      carTubes.push({ node: main.node(), color: FLEET_COL.moving, off: 0 });
      if (!reduce) {
        [g.select(".fl-rbase"), main].forEach(p => p.attr("stroke-dasharray", `${L} ${L}`).attr("stroke-dashoffset", L)
          .append("animate").attr("attributeName", "stroke-dashoffset").attr("from", L).attr("to", 0)
          .attr("dur", "1.4s").attr("fill", "freeze").attr("calcMode", "spline").attr("begin", "indefinite").attr("data-at", 0)
          .attr("keyTimes", "0;1").attr("keySplines", ".4 0 .2 1"));
        // แสงวิ่งตามเส้น — เริ่มหลังลากเส้นเสร็จ
        path("fl-rcomet", "#fff", Math.max(2, w - 1)).attr("stroke-dasharray", `${L * .06} ${L * .94}`).attr("stroke-dashoffset", L)
          .attr("opacity", .95).append("animate").attr("attributeName", "stroke-dashoffset").attr("from", L).attr("to", 0)
          .attr("dur", "2.2s").attr("begin", "indefinite").attr("data-at", 1.4).attr("repeatCount", "indefinite");
      }
      const a = pin(g, pos[r.from]);
      a.append("circle").attr("r", 5.5).attr("fill", dark ? NEON.bg : "#fff")
        .attr("stroke", FLEET_COL.moving).attr("stroke-width", 2.6);
      label(a, r.from, 0, -11, { size: 12, weight: 700, fill: dark ? "#e8f0ee" : "#1a4f99",
        halo: dark ? "rgba(15,30,27,.9)" : "rgba(255,255,255,.92)", haloW: 4 }).attr("text-anchor", "middle");
    });
    // SMIL นับเวลาจากตอนโหลดเอกสาร — ภาพเคลื่อนไหวที่เพิ่มทีหลังด้วย begin ตัวเลขจะถือว่าจบไปแล้ว (เห็นเส้นเต็มทันที)
    // จึงตั้ง begin="indefinite" แล้วสั่งเริ่มเองตอนนี้ (data-at = หน่วงกี่วินาที)
    if (!reduce) gFleetRoutes.selectAll("animate").each(function () { this.beginElementAt?.(+this.getAttribute("data-at") || 0); });
    // รถออกวิ่งหลังเส้นลากถึงปลายทาง (1.4 วิ ตรงกับ animate ข้างบน) · ลดการเคลื่อนไหว = วางรถไว้เลย (Cars หยุดเองตาม setPlay)
    if (carTubes.length) fleetCarTimer = setTimeout(() => cars.set(carTubes), reduce ? 0 : 1400);
    // โหมดนี้ซ่อนจุดขึ้นลงทั้งหมด (~150 หมุดพร้อมป้าย) — ไม่ต้องใช้ และลดของที่ต้องวาดใหม่ทุกครั้งที่ซูม/เลื่อน
    // ซ่อนแม้ไม่มีรถให้ปักเลย (เช่นกรองสถานะที่ไม่มีรถ) — เดิมโชว์จุดขึ้นลงเทาทั้งหมดแทน ดูเหมือนมีรถอยู่ทุกจุด
    // (drawFleet ถูกเรียกเฉพาะจากหน้าสถานะกองรถ — หน้า Demo ไม่ส่ง map:fleet)
    gStops.attr("display", "none");
    [...fleetData].sort((a, b) => a.total - b.total).forEach(s => {
      const on = s.name === fleetSel, kind = fleetMain(s), col = FLEET_COL[kind];
      const g = pin(gFleet, pos[s.name]).classed("fl-pin", true).style("cursor", "pointer")
        .attr("opacity", on || !fleetSel ? 1 : .55)
        .on("click", () => {
          fleetSel = fleetSel === s.name ? null : s.name;
          drawFleet();
          if (window.parent !== window) window.parent.postMessage({ type: "map:stop", stop: fleetSel }, "*");
        });
      g.append("title").text(`${s.name} · ${s.total} คัน — ` + Object.keys(FLEET_COL)
        .filter(k => s[k]).map(k => `${fleetLabels[k]} ${s[k]}`).join(" · "));
      // รูปรถล้วน ไม่มีกรอบ/แคปซูล · ตัวเลขจำนวนรถอยู่บนตู้สินค้าด้านหลัง (เจ้าของงานสั่ง 26 ก.ย. 2569 — แคปซูลขาวดูไม่ออกตอนดูทั้งหมด)
      // รถ 44×32 (symbol viewBox 37×27 · ×1.19) จัดกึ่งกลางที่จุด · ตู้สินค้าอยู่ x −19.6…4.2 · y −9.8…7.2 → ตัวเลขกลางตู้ (−7.7, −1.3)
      // ขนาดเท่ากันทุกจุด (ไม่โตตามจำนวนรถ) · จุดที่เลือก = รถใหญ่ขึ้น 1.25 เท่า แทนกรอบดำ
      const TW = 44, TH = 32, sc = on ? 1.25 : 1;
      g.node().__hw = TW / 2 * sc; g.node().__hh = TH / 2 * sc;
      const p = g.append("g").attr("class", "fl-pill").append("g").attr("transform", sc !== 1 ? `scale(${sc})` : null);
      p.append("use").attr("href", `#flTruck-${kind}`).attr("x", -TW / 2).attr("y", -TH / 2).attr("width", TW).attr("height", TH);
      const txt = String(s.total);
      p.append("text").text(txt).attr("x", -7.7).attr("y", -1.3).attr("dy", "0.36em").attr("text-anchor", "middle")
        .attr("font-size", txt.length >= 3 ? 9.5 : 12).attr("font-weight", 800)
        .style("fill", "#fff").style("stroke", TRUCK_TONE[kind].ink).style("stroke-width", "2.6px")
        .style("paint-order", "stroke").style("stroke-linejoin", "round").attr("pointer-events", "none");
      // มีทั้งรถว่างและรถกำลังเดินทางมา — จุดน้ำเงินเหนือหัวรถ
      if (s.ready && s.moving) p.append("circle").attr("cx", 15).attr("cy", -11).attr("r", 4.5)
        .attr("fill", FLEET_COL.moving).attr("stroke", "#fff").attr("stroke-width", 1.6);
      // ป้ายชื่อเฉพาะจุดที่มีรถ ≥ FLEET_LABEL_MIN หรือจุดที่เลือก — จุดในเชียงใหม่/กทม. อยู่ชิดกันมาก ป้ายทุกจุดซ้อนจนอ่านไม่ออก
      // สร้างป้ายทุกจุด แต่โชว์เฉพาะที่ผ่านเกณฑ์ — ซูมถึง 2.5 เท่า (เช่นกดมุมมอง กทม.) โชว์ทุกจุด (showFleetLabels() · เรียกซ้ำใน rescale)
      label(g, s.name, 0, g.node().__hh + 13, { size: 12, weight: on ? 700 : 600,
        fill: dark ? "#e8f0ee" : "#3c4043", halo: dark ? "rgba(15,30,27,.9)" : "rgba(255,255,255,.9)", haloW: 4 })
        .attr("class", "fl-lbl").attr("data-min", on || s.total >= FLEET_LABEL_MIN ? 1 : 0)
        .attr("data-on", on ? 1 : 0).attr("data-t", s.total);
      if (on) g.raise();
      g.node().__p0 = pos[s.name];
      g.node().__leader = gFleetLines.append("line").attr("stroke", col).attr("stroke-width", 1.5)
        .attr("stroke-dasharray", "3 2").attr("vector-effect", "non-scaling-stroke").attr("display", "none").node();
    });
    layoutFleet();
    gFleet.selectAll(".fl-pin").attr("transform", function () { return pinT(this.__p); });
    showFleetLabels();
  }

  /* มุมมองของโหมดนี้ (เจ้าของงานเลือกแนวทาง "ปุ่มสลับมุมมอง" 26 ก.ย. 2569 แก้จุด กทม. กระจุกกัน):
     "all" = ทุกจุด (fitAllStops) · "north" / "bkk" = กรอบของจุดกลุ่มนั้นใน STOPS (คิดจากพิกัดจริง + ขอบ 8%)
     — ไม่ใช้กรอบ #zNorth เดิมเพราะตัดแม่ฮ่องสอน/ขุนยวมทิ้ง */
  // ราชบุรีอยู่กลุ่ม bkk แต่ห่างใจกลางเมือง ~70 กม. — ถ้านับด้วยกรอบ กทม. กว้างจนจุดในเมืองยังทับกัน (ยังเห็นในมุมมองทั้งหมด)
  const VIEW_SKIP = new Set(["ราชบุรี"]);
  function groupBox(grp) {
    const cs = names.filter(n => STOPS[n].group === grp && !VIEW_SKIP.has(n)).map(n => STOPS[n].c);
    const [x0, x1] = d3.extent(cs, c => c[0]), [y0, y1] = d3.extent(cs, c => c[1]);
    const px = Math.max(.12, (x1 - x0) * .08), py = Math.max(.08, (y1 - y0) * .08);
    return [[x0 - px, y0 - py], [x1 + px, y1 + py]];
  }
  function fleetView(v) {
    if (v === "north" || v === "bkk") zoomToBox(groupBox(v)); else fitAllStops();
  }

  function feedFleet(msg) {
    if (!fed) feed({ routes: [] });   // ล้างเส้นตัวอย่างของ data.js · มุมมองคงที่ครอบทุกจุด
    else if (routes.length) feed({ routes: [] });
    root.node().insertBefore(gCars.node(), gFleetLines.node());   // รถอยู่เหนือเส้นทาง ใต้ป้ายรถ
    if (msg.labels) fleetLabels = { ...fleetLabels, ...msg.labels };
    const all = (msg.stops || []).map(s => ({ ready: 0, moving: 0, upcoming: 0, stale: 0, ...s }));
    fleetData = all.filter(s => pos[s.name] && s.total > 0);
    if (fleetSel && !fleetData.some(s => s.name === fleetSel)) fleetSel = null;
    // แนวถนนคิดครั้งเดียวต่อข้อมูลชุดใหม่ — drawFleet ถูกเรียกซ้ำทุกครั้งที่เลือกวง
    fleetRoutes = (msg.routes || []).filter(r => pos[r.from] && pos[r.to] && r.from !== r.to && r.n > 0)
      .map(r => ({ from: r.from, to: r.to, n: r.n, d: line(roadPath(r.from, r.to).map(c => proj(c))) }));
    drawFleet();
    const missing = all.filter(s => !pos[s.name]).map(s => s.name);
    if (window.parent !== window) window.parent.postMessage({ type: "map:fleetMissing", names: missing }, "*");
  }

  window.addEventListener("message", e => {
    if (e.source !== window.parent || !e.data) return;
    if (e.data.type === "map:routes") feed(e.data);
    if (e.data.type === "map:fleet") feedFleet(e.data);
    if (e.data.type === "map:fleetSel") {
      // หน้าส่งกลับจุดเดิมทุกครั้งหลังกดป้าย (map:stop → sel → map:fleetSel) — ไม่วาดซ้ำ ไม่งั้นแอนิเมชันเส้นทางเริ่มใหม่
      const next = e.data.stop || null;
      if (next !== fleetSel) { fleetSel = next; drawFleet(); }
      // เลือกจากรายการจุดในหน้า → ซูมไปกลุ่มของจุดนั้น แล้วแจ้งกลับให้ปุ่มมุมมองในหน้าตรงกัน
      const grp = fleetSel && e.data.zoom ? STOPS[fleetSel]?.group : null;
      if (grp) { fleetView(grp); window.parent.postMessage({ type: "map:view", view: grp }, "*"); }
    }
    if (e.data.type === "map:view") fleetView(e.data.view);
    /* ปุ่ม + / − / มุมเริ่มต้น บนการ์ดแผนที่ของหน้าที่ฝัง (เจ้าของงานขอ 26 ก.ย. 2569 · โหมดฝังซ่อนปุ่มซูมของแผนที่เอง .zoombar)
       reset = มุมตั้งต้นของโหมดนั้น: ตำแหน่งรถ → มุมมอง "ทั้งหมด" (แจ้ง map:view กลับให้ปุ่มในหน้าตรงกัน) · เส้นทาง → ครอบทุกจุด (fitAllStops) */
    if (e.data.type === "map:zoom") {
      if (e.data.op === "in") zoomBy(1.6);
      else if (e.data.op === "out") zoomBy(1 / 1.6);
      else if (fleetData.length) { fleetView("all"); window.parent.postMessage({ type: "map:view", view: "all" }, "*"); }
      else fitAllStops();
    }
    // สลับโหมดขาว/ดำจากปุ่มในหน้าที่ฝัง — ไม่โหลดแผนที่ใหม่ เส้นกับรถที่วิ่งอยู่ไม่เริ่มใหม่
    if (e.data.type === "map:theme") {
      document.body.classList.toggle("dark", !!e.data.dark); styleStops();
      if (fleetData.length) drawFleet();
    }
  });
  if (window.parent !== window) window.parent.postMessage({ type: "map:ready" }, "*");
})();
