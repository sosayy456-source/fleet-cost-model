/**
 * เว็บนำเสนอแบบ pitch ด้วยวิดีโอ (หน้าเดียวของ presentation/ — เดิมเปิดด้วย `?tour` ก่อนตัดหน้าจำลองทีละขั้นทิ้ง 26 ก.ย. 2569) — เจ้าของงานขอ 26 ก.ย. 2569: ~2 นาที · เปิดเรื่อง + 5 ฝ่าย · ตัวเลขจากคลิป · ไม่มีเพลง
 *
 * ลำดับ:  ready → intro (สไลด์ปัญหา/ทางออก ตามเวลา) → [การ์ดคั่นฝ่าย → วิดีโอช่วงของฝ่ายนั้น] × 5 → end
 * วิดีโอ = คลิปแอปจริงที่ตัด/เร่งด้วย tools/build-tour.py ตาม data/tour.json · หน้านี้อ่านตารางเดียวกันจึงรู้ว่าเวลาไหนเป็นช่วงไหน
 *
 * การกำกับภาพ (ทำให้ไม่ใช่ "แค่เปิดคลิป"):
 *   · กล้อง — แต่ละช่วงซูมเข้าจุด `focus` ด้วย transform-origin + scale (ไม่แตะตัววิดีโอ · จุดอยู่ในภาพเสมอจึงไม่เห็นขอบ)
 *   · การ์ดตัวเลข `callout` ลอยคร่อมขอบจอ ตัวเลขอ่านจากคลิป
 *   · การ์ดคั่นฝ่ายเต็มเวที (หยุดวิดีโอ ~2 วิ) บอกคุณค่า + ก่อน/หลัง · จอโน้ตบุ๊กเอียงระหว่างคั่นแล้วค่อยตั้งตรง
 * ปุ่ม: → ถัดไป · ← ย้อน · Space หยุด/เล่น · 1–5 ข้ามไปฝ่าย · F เต็มจอ
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import tour from '../data/tour.json';
import styles from './Tour.module.css';

interface Callout { label: string; value: string; sub?: string; tone: string }
interface Seg { chapter: string; from: number; to: number; speed: number; focus: number[]; title: string; text: string; hold?: boolean; callout?: Callout; start: number; end: number }
type Phase = 'ready' | 'intro' | 'card' | 'demo' | 'end';
const CARD_MS = 2200;

function timeline(): Seg[] {
  let t = 0;
  return (tour.segments as Omit<Seg, 'start' | 'end'>[]).map(s => {
    const len = (s.to - s.from) / s.speed; const seg = { ...s, start: t, end: t + len }; t += len; return seg;
  });
}

export default function Tour() {
  const segs = useMemo(timeline, []);
  const video = useRef<HTMLVideoElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>('ready');
  const [intro, setIntro] = useState(0);
  const [idx, setIdx] = useState(0);
  const [cardFor, setCardFor] = useState<string>('r1');
  const [paused, setPaused] = useState(false);
  const shown = useRef(new Set<string>());      // ฝ่ายที่แสดงการ์ดคั่นไปแล้ว
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const seg = segs[idx];
  const chapter = tour.chapters.find(c => c.id === (phase === 'card' ? cardFor : seg.chapter))!;
  const chapterNo = tour.chapters.indexOf(chapter);

  const clear = () => clearTimeout(timer.current);
  const playVideo = useCallback(() => { setPhase('demo'); setPaused(false); void video.current?.play(); }, []);
  /** แสดงการ์ดคั่นฝ่าย แล้วเล่นวิดีโอต่อ */
  const showCard = useCallback((ch: string) => {
    clear(); video.current?.pause();
    shown.current.add(ch); setCardFor(ch); setPhase('card');
    timer.current = setTimeout(playVideo, CARD_MS);
  }, [playVideo]);

  // สไลด์เปิดเรื่องเดินตามเวลา
  // ★ ตัวจับเวลาแยกจากของการ์ดคั่น — ถ้าใช้ตัวเดียวกัน cleanup ตอนออกจาก intro จะยกเลิกเวลาของการ์ด วิดีโอค้างไม่เล่น
  useEffect(() => {
    if (phase !== 'intro') return;
    const t = setTimeout(() => {
      if (intro < tour.intro.length - 1) setIntro(intro + 1);
      else { if (video.current) video.current.currentTime = 0; showCard('r1'); }
    }, tour.intro[intro].ms);
    return () => clearTimeout(t);
  }, [phase, intro, showCard]);

  // ติดตามเวลาวิดีโอ: ช่วงปัจจุบัน · แถบเวลา · เข้าฝ่ายใหม่ = การ์ดคั่น
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const v = video.current;
      if (v && phase === 'demo') {
        const t = v.currentTime;
        let i = segs.findIndex(s => t < s.end - 0.02); if (i < 0) i = segs.length - 1;
        setIdx(i);
        if (!shown.current.has(segs[i].chapter)) showCard(segs[i].chapter);
        if (bar.current) bar.current.style.transform = `scaleX(${t / segs[segs.length - 1].end})`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase, segs, showCard]);

  const start = useCallback(() => { shown.current.clear(); setIdx(0); setIntro(0); setPhase('intro'); }, []);
  const jumpSeg = useCallback((i: number) => {
    const target = segs[Math.max(0, Math.min(segs.length - 1, i))];
    const v = video.current; if (!v) return;
    v.currentTime = target.start + 0.01; setIdx(segs.indexOf(target));
    if (!shown.current.has(target.chapter)) showCard(target.chapter); else playVideo();
  }, [segs, showCard, playVideo]);
  const jumpChapter = useCallback((id: string) => {
    // ย้อนหรือข้ามไปฝ่ายไหน ฝ่ายนั้นและฝ่ายถัดไปจะได้การ์ดคั่นใหม่ตอนเล่นถึง
    const from = tour.chapters.findIndex(c => c.id === id);
    tour.chapters.slice(from).forEach(c => shown.current.delete(c.id));
    const i = segs.findIndex(s => s.chapter === id);
    if (video.current) video.current.currentTime = segs[i].start + 0.01;
    setIdx(i); showCard(id);
  }, [segs, showCard]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      const next = ['arrowright', 'arrowdown', 'pagedown'].includes(k), prev = ['arrowleft', 'arrowup', 'pageup'].includes(k);
      if (next || prev || k === ' ') e.preventDefault();
      if (k === 'f') { void (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()); return; }
      if (/^[1-5]$/.test(k)) { jumpChapter(tour.chapters[Number(k) - 1].id); return; }
      if (phase === 'ready' || phase === 'end') { if (next || k === ' ') start(); return; }
      if (phase === 'intro') {
        if (next || k === ' ') { if (intro < tour.intro.length - 1) setIntro(intro + 1); else showCard('r1'); }
        if (prev && intro > 0) setIntro(intro - 1);
        return;
      }
      if (phase === 'card') { if (next || k === ' ') { clear(); playVideo(); } if (prev) { clear(); jumpSeg(idx - 1); } return; }
      if (k === ' ') { const v = video.current!; if (v.paused) { void v.play(); setPaused(false); } else { v.pause(); setPaused(true); } }
      else if (next) jumpSeg(idx + 1);
      else if (prev) jumpSeg(video.current && video.current.currentTime - seg.start > 1.2 ? idx : idx - 1);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [phase, intro, idx, seg, start, showCard, playVideo, jumpSeg, jumpChapter]);

  const [fx, fy, fs] = seg.focus;
  const inDemo = phase === 'demo' || phase === 'card';
  const stepList = segs.filter(s => s.chapter === seg.chapter);

  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <span className={styles.brand}>โมเดลต้นทุนการเดินรถ</span>
        {inDemo && <span className={styles.sub}>สาธิตการใช้งานจริง</span>}
        <span className={styles.keys}>→ ถัดไป · Space หยุด · 1–5 ข้ามฝ่าย</span>
      </header>

      {/* ---------- เริ่ม / เปิดเรื่อง ---------- */}
      {phase === 'ready' && (
        <section className={styles.full}>
          <p className={styles.eyebrow}>Fleet Cost Model · Live Demo</p>
          <h1 className={styles.hero}>โมเดลต้นทุน<br/>การเดินรถ</h1>
          <button type="button" className={styles.startBtn} onClick={start}>▶ เริ่มนำเสนอ</button>
        </section>
      )}
      {phase === 'intro' && <Intro i={intro}/>}

      {/* ---------- เดโม ---------- */}
      <section className={styles.demo} style={{ display: inDemo ? undefined : 'none' }}>
        <aside className={styles.side}>
          <ol className={styles.chapters}>
            {tour.chapters.map((c, i) => (
              <li key={c.id} className={`${styles.chip} ${i === chapterNo ? styles.now : ''} ${i < chapterNo ? styles.done : ''}`}>
                <button type="button" onClick={() => jumpChapter(c.id)}><b>{c.no}</b><span>{c.th}<small>{c.role}</small></span></button>
              </li>
            ))}
          </ol>
          {phase === 'demo' && (
            <div className={styles.caption} key={idx}>
              <p className={styles.kicker}>{chapter.th} · {stepList.indexOf(seg) + 1}/{stepList.length}</p>
              <h2>{seg.title}</h2>
              <p className={styles.text}>{seg.text}</p>
            </div>
          )}
        </aside>

        <div className={styles.stage}>
          <div className={`${styles.laptop} ${phase === 'card' ? styles.tilt : ''}`}>
            <div className={styles.bezel}>
              <div className={styles.screen}>
                <div className={styles.camera} style={{ transformOrigin: `${fx * 100}% ${fy * 100}%`, transform: `scale(${phase === 'card' ? 1 : fs})` }}>
                  <video ref={video} className={styles.video} muted playsInline preload="auto"
                    onEnded={() => { setPhase('end'); }}>
                    <source src="clips/tour.webm" type="video/webm"/>
                    <source src="clips/tour.mp4" type="video/mp4"/>
                  </video>
                </div>
                {paused && phase === 'demo' && <div className={styles.paused}>หยุดชั่วคราว</div>}
              </div>
            </div>
            <div className={styles.base}/>
          </div>
          {phase === 'demo' && seg.callout && (
            <div className={`${styles.callout} ${styles[seg.callout.tone]}`} key={`c${idx}`}>
              <span>{seg.callout.label}</span><b>{seg.callout.value}</b>{seg.callout.sub && <small>{seg.callout.sub}</small>}
            </div>
          )}
          <div className={styles.rail}><div ref={bar} className={styles.fill}/></div>
        </div>

        {phase === 'card' && (
          <div className={styles.card} key={cardFor}>
            <b className={styles.cardNo}>{chapter.no}</b>
            <p className={styles.cardRole}>{chapter.role}</p>
            <h2 className={styles.cardTitle}>{chapter.th}</h2>
            <p className={styles.cardTag}>{chapter.tagline}</p>
            <div className={styles.ba}>
              <span className={styles.before}><i>เดิม</i>{chapter.before}</span>
              <span className={styles.arrow}>→</span>
              <span className={styles.after}><i>ตอนนี้</i>{chapter.after}</span>
            </div>
          </div>
        )}
      </section>

      {/* ---------- ปิด ---------- */}
      {phase === 'end' && (
        <section className={`${styles.full} ${styles.endScreen}`}>
          <p className={styles.eyebrow}>จากบิลใบแรก ถึงหน้าจอผู้บริหาร</p>
          <div className={styles.flow}>
            {tour.chapters.map((c, i) => <span key={c.id} style={{ animationDelay: `${i * 120}ms` }}><b>{c.no}</b>{c.th}</span>)}
          </div>
          <h1 className={styles.hero}>ขอบคุณครับ</h1>
          <p className={styles.heroSub}>Q&amp;A</p>
        </section>
      )}
    </div>
  );
}

/** สไลด์เปิดเรื่อง — ตัวหนังสือใหญ่ ขึ้นทีละบรรทัด */
function Intro({ i }: { i: number }) {
  const s = tour.intro[i] as { kind: string; eyebrow: string; title?: string; sub?: string; items?: string[] };
  return (
    <section className={styles.full} key={i}>
      <p className={styles.eyebrow}>{s.eyebrow}</p>
      {s.kind === 'question' && <>
        <h1 className={styles.hero}>{s.title!.split('\n').map((l, j) => <span key={j} style={{ animationDelay: `${150 + j * 260}ms` }}>{l}</span>)}</h1>
        <p className={styles.heroSub} style={{ animationDelay: '900ms' }}>{s.sub}</p>
      </>}
      {s.kind === 'pains' && (
        <ol className={styles.pains}>
          {s.items!.map((t, j) => <li key={j} style={{ animationDelay: `${200 + j * 900}ms` }}><b>{j + 1}</b>{t}</li>)}
        </ol>
      )}
      {s.kind === 'solution' && <>
        <h1 className={`${styles.hero} ${styles.accentHero}`}><span>{s.title}</span></h1>
        <p className={styles.heroSub} style={{ animationDelay: '500ms' }}>{s.sub}</p>
        <div className={styles.flow}>
          {tour.chapters.map((c, j) => <span key={c.id} style={{ animationDelay: `${1100 + j * 380}ms` }}><b>{c.no}</b>{c.th}</span>)}
        </div>
      </>}
    </section>
  );
}
