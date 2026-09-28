/**
 * ตั้งค่าสีของแดชบอร์ดรายจุด (เจ้าของงานขอ 28 ก.ย. 2569 — "เลือกสีได้แบบ Claude Design · เปลี่ยนสีแต่ละจุดแต่ละกล่องได้โดยละเอียด")
 *
 * รายการจุด/ค่าตั้งต้น/ชุดสำเร็จรูปอยู่ที่ lib/ui/themeColors.ts ที่เดียว — หน้านี้แค่วาดช่องเลือกตามรายการนั้น
 * เปลี่ยนแล้วมีผลทันทีทั้งแอป (ตัวแปร --th-* บน <html>) และจำใน localStorage ของเครื่องนั้น
 *
 * ตัวอย่างย่อ (ค้างด้านซ้ายตอนเลื่อน) ใช้ตัวแปรชุดเดียวกับแดชบอร์ดจริง และมีครบทุกจุดใน THEME_GROUPS —
 * ชี้/โฟกัสช่องสี = จุดนั้นในตัวอย่างกระพริบ · กดจุดในตัวอย่าง = กระโดดไปช่องสีของจุดนั้น (เจ้าของงานขอ 28 ก.ย. 2569)
 * ★ เพิ่ม token ใหม่ต้องใส่ data-th ให้ส่วนที่ตรงกันใน <Preview> ด้วย ไม่งั้นชี้แล้วไม่มีอะไรกระพริบ
 *
 * ตั้งสีรายแท็บ (28 ก.ย. 2569): แถวขอบเขตบนสุด ทั้งระบบ · 12 แท็บของ 3 Dashboard — เลือกแท็บแล้วตัวอย่างเป็นหน้าจริงในกรอบ
 *   (ThemePreviewFrame) ช่องสีเหลือเฉพาะ token ที่ไม่ใช่ global · ค่าที่แสดง = สีของแท็บ ?? สีรวม · ↺ = กลับไปใช้สีรวม
 */
import { useEffect, useRef, useState } from "react";
import { IS_CHERRY } from "../../lib/ui/dashTheme";
import {
  THEME_DEFAULTS, THEME_EVENT, THEME_GROUPS, THEME_PRESETS, THEME_SCOPES, THEME_TOKENS, isHex,
  loadAllScopeColors, loadThemeColors, saveScopeColors, saveThemeColors, type ThemeColors,
} from "../../lib/ui/themeColors";
import ThemePreviewFrame from "./ThemePreviewFrame";

/** data-th = รายชื่อ token (คั่นด้วยช่องว่าง) ที่ส่วนนั้นใช้ */
function Preview() {
  return (
    <div className="thp" data-th="pageTop pageBottom">
      <div className="thp-side" data-th="sideTop sideBottom">
        <span className="on" data-th="sideActiveBg sideActiveText">Executive</span>
        <span data-th="sideText">Overall</span>
        <span data-th="sideText">Manager</span>
        <span data-th="sideText">ตั้งค่า</span>
      </div>
      <div className="thp-main">
        <div className="thp-head" data-th="headBg">
          <i className="thp-bar" data-th="headBorder" />
          <div className="thp-hrow">
            <b data-th="headTitle">Executive Dashboard</b>
            <span className="thp-btn" data-th="accent">เปลี่ยนหน้าที่</span>
          </div>
          <div className="thp-meta" data-th="headMuted headText">จับคู่ได้ <b>4,007</b> เที่ยว</div>
          <div className="thp-ff">
            {["ปี|ทุกปี", "สาขา|ทุกสาขา", "ต้นทาง|ทั้งหมด"].map((x) => {
              const [l, v] = x.split("|");
              return <span key={x} data-th="headLine"><small data-th="headMuted">{l}</small> <em data-th="headText">{v}</em></span>;
            })}
          </div>
        </div>
        <div className="thp-h2"><span data-th="pageText">Route</span><i data-th="pageMuted" /></div>
        <div className="thp-heroes">
          {([["profit", "กำไรสุทธิ", "55.9M"], ["rev", "รายได้รวม", "97.5M"], ["cost", "ต้นทุนรวม", "41.6M"]] as const).map(([k, l, v]) => (
            <div key={k} className={k} data-th={`${k}A ${k}B`}><small data-th="heroText">{l}</small><b data-th="heroText">{v}</b></div>
          ))}
        </div>
        <div className="thp-heroes sm">
          <div className="cust" data-th="custA custB"><small data-th="heroText">ลูกค้า</small></div>
          <div className="loss" data-th="lossA lossB"><small data-th="heroText">ขาดทุน</small></div>
          <div className="fleet" data-th="fleet"><small data-th="heroText">กองรถ</small></div>
          <div className="svc" data-th="svc"><small data-th="heroText">บริการ</small></div>
        </div>
        <div className="thp-cards">
          <div data-th="cardBg cardLine"><small data-th="cardLabel">อัตรากำไร</small><b data-th="cardValue">57.4%</b></div>
          <div data-th="cardBg cardLine"><small data-th="cardLabel">จำนวนเที่ยว</small><b data-th="cardValue">4,407</b></div>
          <div className="thp-pi" data-th="piBg"><small>Performance Index</small><b data-th="piAccent">18.4</b><i data-th="piAccent" /></div>
        </div>
        <div className="thp-sg">
          <span className="s1" data-th="sg1">ทั่วไป 63%</span>
          <span className="s2" data-th="sg2">แช่เย็น 37%</span>
          <span className="s3" data-th="sg3">แช่แข็ง 51%</span>
        </div>
        <div className="thp-box" data-th="cardBg cardLine">
          <div className="thp-bt" data-th="boxTitle">ตารางจัดอันดับเส้นทาง</div>
          <div className="thp-secs">
            <span className="a" data-th="secA">หัวส่วน 1</span>
            <span className="b" data-th="secB">หัวส่วน 2</span>
            <span className="c" data-th="secC">หัวส่วน 3</span>
          </div>
          <div className="thp-row"><span data-th="cardValue">ตลาดไท-กองลอย</span><span data-th="cardLabel">32,006</span></div>
          <div className="thp-row on" data-th="rowOn"><span data-th="cardValue">แถวที่เลือก</span><span data-th="cardLabel">31,143</span></div>
        </div>
        <div className="thp-note" data-th="pageMuted">โน้ตบนพื้นหลัง · ข้อความรอง</div>
      </div>
    </div>
  );
}

const LABEL_OF: Record<string, string> = Object.fromEntries(THEME_TOKENS.map((t) => [t.key, t.label]));
const GROUP_OF: Record<string, string> = Object.fromEntries(THEME_GROUPS.flatMap((g) => g.tokens.map((t) => [t.key, g.title])));

const DASHES = [...new Set(THEME_SCOPES.map((s) => s.dash))];

export default function ThemeSettings() {
  const [colors, setColors] = useState<ThemeColors>(loadThemeColors);
  const [scopes, setScopes] = useState(loadAllScopeColors);
  /** null = ทั้งระบบ · อื่น ๆ = id ใน THEME_SCOPES */
  const [scope, setScope] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(THEME_GROUPS[0]!.title);
  const [hot, setHot] = useState<string | null>(null);
  const [found, setFound] = useState<{ key: string; n: number } | null>(null);
  /** ค่าที่กำลังพิมพ์ในช่องรหัสสีของโหมดแท็บ (ยังไม่ครบ 7 ตัว) */
  const [draft, setDraft] = useState<ThemeColors>({});
  const pvRef = useRef<HTMLDivElement>(null);

  // หน้าอื่น/แท็บเดียวกันเปลี่ยนค่า → ช่องในหน้านี้ตามทัน
  useEffect(() => {
    const on = () => { setColors(loadThemeColors()); setScopes(loadAllScopeColors()); };
    window.addEventListener(THEME_EVENT, on);
    return () => window.removeEventListener(THEME_EVENT, on);
  }, []);

  useEffect(() => { setHot(null); setFound(null); setDraft({}); }, [scope]);

  // จุดที่กำลังแก้ → กระพริบในตัวอย่าง (โหมดทั้งระบบ · โหมดแท็บส่งเข้ากรอบใน ThemePreviewFrame)
  useEffect(() => {
    const root = pvRef.current;
    if (!root) return;
    root.querySelectorAll(".th-hot").forEach((el) => el.classList.remove("th-hot"));
    if (hot) root.querySelectorAll(`[data-th~="${hot}"]`).forEach((el) => el.classList.add("th-hot"));
  }, [hot, scope]);

  const global: ThemeColors = { ...THEME_DEFAULTS, ...colors };
  const own: ThemeColors = scope ? scopes[scope] ?? {} : {};

  const set = (key: string, v: string) => {
    if (scope) {
      if (isHex(v)) {
        saveScopeColors(scope, { ...own, [key]: v });
        setDraft((d) => { const n = { ...d }; delete n[key]; return n; });
      } else setDraft((d) => ({ ...d, [key]: v }));
      return;
    }
    const next = { ...colors, [key]: v };
    setColors(next);
    if (isHex(v)) saveThemeColors(next);
  };
  const reset = (key: string) => {
    if (scope) { const n = { ...own }; delete n[key]; saveScopeColors(scope, n); return; }
    const next = { ...colors };
    delete next[key];
    setColors(next);
    saveThemeColors(next);
  };
  const usePreset = (c: ThemeColors) => { setColors({ ...c }); saveThemeColors({ ...c }); };
  const changed = Object.keys(colors).filter((k) => isHex(colors[k]!) && colors[k]!.toUpperCase() !== THEME_DEFAULTS[k]!.toUpperCase()).length;

  const jumpTo = (key: string) => {
    setOpen(GROUP_OF[key] ?? null);
    setHot(key);
    requestAnimationFrame(() => {
      const item = document.getElementById(`thm-${key}`);
      item?.scrollIntoView({ behavior: "smooth", block: "center" });
      item?.querySelector<HTMLInputElement>("input.thm-hex")?.focus({ preventScroll: true });
    });
  };
  // กดส่วนในตัวอย่าง (โหมดทั้งระบบ) → เปิดหมวด + เลื่อนไปช่องสีตัวแรกของส่วนนั้น
  const pickFromPreview = (e: React.MouseEvent) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>("[data-th]");
    const key = el?.dataset.th?.split(" ")[0];
    if (key) jumpTo(key);
  };

  const groups = THEME_GROUPS
    .map((g) => ({ ...g, tokens: scope ? g.tokens.filter((t) => !t.global) : g.tokens }))
    .filter((g) => g.tokens.length);
  const cur = THEME_SCOPES.find((s) => s.id === scope);
  const ownN = Object.keys(own).length;

  const caption = hot
    ? <>กำลังแก้: <b>{LABEL_OF[hot]}</b>{scope
        ? (found?.key === hot ? (found.n ? ` — แท็บนี้มี ${found.n} จุด (กระพริบในตัวอย่าง)` : " — แท็บนี้ไม่มีจุดนี้") : "")
        : " — ส่วนที่กระพริบในตัวอย่าง"}</>
    : scope
      ? "ชี้ที่ช่องสีเพื่อดูว่าอยู่ตรงไหนในแท็บนี้ · กดจุดในตัวอย่างเพื่อไปที่ช่องสีนั้น · เลื่อนดูในกรอบได้"
      : "ชี้ที่ช่องสีเพื่อดูว่าอยู่ตรงไหน · กดส่วนในตัวอย่างเพื่อไปที่ช่องสีนั้น";

  return (
    <div className="card">
      <div className="card-h"><span className="step">🎨</span><h2>สีของแดชบอร์ด</h2>
        <span className="hint">เปลี่ยนแล้วมีผลทันที · จำไว้ในเครื่องนี้เท่านั้น</span></div>

      {!IS_CHERRY && (
        <div className="price-note">ตอนนี้เครื่องนี้ใช้ธีมสีเดิม (classic) — สีที่เลือกในส่วนนี้จะไม่แสดงจนกว่าจะล้างค่า
          <code> localStorage.dashTheme </code> แล้วรีโหลด</div>
      )}

      <div className="thm-scopes" role="tablist" aria-label="ตั้งสีให้">
        <button type="button" role="tab" aria-selected={!scope} className={"thm-chip all" + (!scope ? " on" : "")} onClick={() => setScope(null)}>
          ทั้งระบบ
        </button>
        {DASHES.map((d) => (
          <div key={d} className="thm-scope-row">
            <span className="thm-scope-dash">{d}</span>
            {THEME_SCOPES.filter((s) => s.dash === d).map((s) => (
              <button key={s.id} type="button" role="tab" aria-selected={scope === s.id}
                className={"thm-chip" + (scope === s.id ? " on" : "") + (scopes[s.id] ? " set" : "")}
                title={scopes[s.id] ? `ตั้งสีเฉพาะแท็บนี้ไว้ ${Object.keys(scopes[s.id]!).length} จุด` : "ใช้สีรวม"}
                onClick={() => setScope(s.id)}>
                {s.label}
              </button>
            ))}
          </div>
        ))}
      </div>

      <div className={"thm-layout" + (scope ? " tab" : "")}>
        <div className="thm-left">
          {cur ? (
            <ThemePreviewFrame scope={cur.id} hot={hot} onPick={jumpTo} onFound={(key, n) => setFound({ key, n })} />
          ) : (
            <div ref={pvRef} className="thm-pv" onClick={pickFromPreview} title="กดส่วนไหนเพื่อไปที่ช่องสีของส่วนนั้น">
              <Preview />
            </div>
          )}
          <div className={"thm-cap" + (hot ? " on" : "")}>{caption}</div>
          {cur ? (
            <div className="thm-presets">
              <div className="thm-sub">{cur.dash} › {cur.label}</div>
              <div className="hint">ช่องที่ไม่ได้ตั้งเองใช้สีรวม — เปลี่ยนสีรวมทีหลัง แท็บนี้จะเปลี่ยนตาม · พื้นหลัง/เมนูซ้าย/กล่องหัว ตั้งได้ที่ "ทั้งระบบ"</div>
              <button type="button" className="thm-resetall" disabled={!ownN} onClick={() => saveScopeColors(cur.id, {})}>
                ↺ ล้างสีของแท็บนี้ กลับไปใช้สีรวม{ownN ? ` (ตั้งไว้ ${ownN} จุด)` : ""}
              </button>
            </div>
          ) : (
            <div className="thm-presets">
              <div className="thm-sub">ชุดสำเร็จรูป</div>
              {THEME_PRESETS.map((p) => {
                const c = { ...THEME_DEFAULTS, ...p.colors };
                return (
                  <button key={p.name} type="button" className="thm-preset" onClick={() => usePreset(p.colors)}>
                    <span className="thm-dots">
                      {[c.pageTop, c.sideTop, c.headBg, c.profitA, c.revA, c.costA].map((x, i) => <i key={i} style={{ background: x }} />)}
                    </span>
                    {p.name}
                  </button>
                );
              })}
              <button type="button" className="thm-resetall" disabled={!changed} onClick={() => usePreset({})}>
                ↺ กลับค่าตั้งต้นทั้งหมด{changed ? ` (แก้ไว้ ${changed} จุด)` : ""}
              </button>
            </div>
          )}
        </div>

        <div className="thm-groups" onMouseLeave={() => setHot(null)}>
          {groups.map((g) => (
            <details key={g.title} className="thm-group" open={open === g.title}
              onToggle={(e) => { if ((e.currentTarget as HTMLDetailsElement).open) setOpen(g.title); }}>
              <summary>
                <span className="thm-dots">{g.tokens.slice(0, 6).map((t) => <i key={t.key} style={{ background: own[t.key] ?? global[t.key] }} />)}</span>
                {g.title}
              </summary>
              <div className="thm-grid">
                {g.tokens.map((t) => {
                  const v = scope ? draft[t.key] ?? own[t.key] ?? global[t.key]! : colors[t.key] ?? t.def;
                  const base = scope ? global[t.key]! : t.def;
                  const dirty = scope ? own[t.key] != null : colors[t.key] != null && colors[t.key]!.toUpperCase() !== t.def.toUpperCase();
                  return (
                    <label key={t.key} id={`thm-${t.key}`}
                      className={"thm-item" + (dirty ? " dirty" : "") + (hot === t.key ? " hot" : "")}
                      onMouseEnter={() => setHot(t.key)} onFocus={() => setHot(t.key)}>
                      <input type="color" value={isHex(v) ? v : base} onChange={(e) => set(t.key, e.target.value.toUpperCase())} />
                      <span className="thm-lb">
                        <b>{t.label}</b>
                        {scope
                          ? <small className={dirty ? "thm-own" : ""}>{dirty ? "ตั้งเฉพาะแท็บนี้" : "ใช้สีรวม"}</small>
                          : t.hint && <small>{t.hint}</small>}
                      </span>
                      <input className="thm-hex" type="text" value={v} maxLength={7} spellCheck={false}
                        aria-label={`รหัสสี ${t.label}`}
                        onChange={(e) => set(t.key, e.target.value.startsWith("#") ? e.target.value : "#" + e.target.value)} />
                      <button type="button" className="thm-undo" disabled={!dirty}
                        title={scope ? `กลับไปใช้สีรวม ${base}` : `กลับเป็นค่าตั้งต้น ${t.def}`}
                        onClick={(e) => { e.preventDefault(); reset(t.key); }}>↺</button>
                    </label>
                  );
                })}
              </div>
            </details>
          ))}
          <div className="hint" style={{ marginTop: 6 }}>สีในกราฟ (เส้น/แท่ง) ยังเป็นชุดเดิม เปลี่ยนจากหน้านี้ไม่ได้</div>
        </div>
      </div>
    </div>
  );
}
