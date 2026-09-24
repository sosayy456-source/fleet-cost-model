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
  const path = d3.geoPath(proj);

  addDefs(svg);

  /* ---------- พื้นหลัง: ทะเล / ประเทศเพื่อนบ้าน / จังหวัด ---------- */
  svg.append("rect").attr("class", "water").attr("width", W).attr("height", H).attr("fill", "var(--water)");
  const root = svg.append("g");   // ทุกอย่างที่ซูมได้อยู่ในกลุ่มนี้

  root.append("g").attr("class", "neighbors").selectAll("path")
    .data(world.features.filter(f => f.properties.name !== "Thailand"))
    .join("path").attr("d", path)
    .attr("fill", "var(--neighbor)").attr("stroke", "var(--neighbor)")
    .attr("stroke-width", 3.5).attr("stroke-linejoin", "round");

  /* ฐาน 3 มิติของโหมด #3d (ใช้คู่กับ #thai · เคยเปิดในหน้า Demo แล้วเจ้าของงานให้กลับเป็น 2 มิติ 24 ก.ย. 2569): เงาเบลอใต้ประเทศ + ผนังด้านข้าง
     = เงาของรูปประเทศซ้อนกันเลื่อนลงทีละนิด (สีเข้มขึ้นตามความลึก) · ใช้รูปจังหวัดทั้งหมดต่อเป็น path เดียว
     ไม่ต้อง merge ขอบเขต (fill ซ้อนกันแล้วได้รูปประเทศ) · โหมดอื่นซ่อนไว้ด้วย CSS (.thai3d) */
  const land = prov.features.map(f => path(f)).join("");
  const g3d = root.append("g").attr("class", "thai3d");
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

  // เส้นขอบประเทศ: วาดเส้นหนาไว้ข้างล่าง แล้วให้ชั้นจังหวัดทับส่วนที่อยู่ด้านใน
  root.append("g").selectAll("path").data(prov.features).join("path")
    .attr("d", path).attr("fill", "var(--land)")
    .attr("stroke", "var(--border)").attr("stroke-width", 3).attr("stroke-linejoin", "round");

  root.append("g").selectAll("path").data(prov.features).join("path")
    .attr("d", path).attr("fill", "var(--land)")
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
  const cars = Cars(root.append("g"), kk);   // รถวิ่งตามเส้นทางที่แสดงอยู่ (ทั้งสองแท็บ)
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
  /* จุดที่เส้นที่เลือกวิ่งผ่าน + จุดใกล้เคียงในรัศมี NEAR_KM จากแนวเส้น → ทาสีเหลือง (เจ้าของงานขอ 24 ก.ย. 2569) */
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
      r.tube = fed ? neonTube(gRoutes, d, { a: pts[0], b: pts[pts.length - 1], off: r.off, loss: r.profit < 0 })
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

  // แนวเส้นทางตามถนนหลัก (src/roads.js) คำนวณไว้ล่วงหน้าทุกคู่ แสดงเฉพาะเมื่อเลือกจุด
  const netRoutes = PAIRS.map(([from, to]) =>
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
    const rel = netSel ? netRoutes.filter(r => r.from === netSel || r.to === netSel) : [];
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
    root.selectAll(".pin").attr("transform", function () { return pinT(this.__p); });
    freeText.attr("font-size", function () { return this.__fs / kk(); })
      .attr("stroke-width", function () { return this.__sw / kk(); });
    routes.forEach(r => { r.tube.place(kk()); r.$hit.attr("transform", `translate(${r.off / kk()},0)`); });
    netTubes.forEach(t => t.place(kk()));
    cars.render();
    showLabels();
    updateScale();
  }

  const zoom = d3.zoom().scaleExtent([1, 24]).translateExtent([[0, 0], [W, H]])
    // ล้อเมาส์ต้องกด Ctrl ค้าง (ทัชแพดแบบบีบนิ้วส่ง Ctrl ให้อัตโนมัติ) หน้าเว็บจึงยังเลื่อนขึ้นลงได้ตามปกติ
    .filter(e => (e.type === "wheel" ? e.ctrlKey || e.metaKey : !e.button))
    .on("zoom", e => { k = e.transform.k; root.attr("transform", e.transform); rescale(); });
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
     { type:"map:routes", routes:[{ key, from, to, profit, color? }] }
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
      id: i + 1, key: r.key, from: r.from, to: r.to, profit: +r.profit || 0,
      name: r.from + "–" + r.to, color: r.color || PALETTE[i % PALETTE.length],
      coords: roadPath(r.from, r.to)
    })));
    fedStops = new Set(routes.flatMap(r => [r.from, r.to]));
    fedNear = nearStops(routes.map(r => r.coords));
    // แจ้งกลับว่าวาดเส้นไหนได้บ้าง — หน้าที่ฝังจะบอกผู้ใช้เองว่าเส้นที่เหลือไม่มีพิกัดในแผนที่
    if (window.parent !== window) window.parent.postMessage({ type: "map:drawn", keys: routes.map(r => r.key) }, "*");
    setMode("top");
    select(routes.length ? routes[0].id : null);
    rescale();
    if (first) fitAllStops();
  }

  window.addEventListener("message", e => {
    if (e.source !== window.parent || !e.data) return;
    if (e.data.type === "map:routes") feed(e.data);
    // สลับโหมดขาว/ดำจากปุ่มในหน้าที่ฝัง — ไม่โหลดแผนที่ใหม่ เส้นกับรถที่วิ่งอยู่ไม่เริ่มใหม่
    if (e.data.type === "map:theme") { document.body.classList.toggle("dark", !!e.data.dark); styleStops(); }
  });
  if (window.parent !== window) window.parent.postMessage({ type: "map:ready" }, "*");
})();
