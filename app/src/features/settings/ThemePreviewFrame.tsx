/**
 * ตัวอย่างรายแท็บ = หน้าจริงของแอปในกรอบ ย่อส่วน (เจ้าของงานเลือก 28 ก.ย. 2569) — ฝั่งกรอบอยู่ที่ lib/ui/themePreview.ts
 * กรอบกว้างจริง 1280px แล้วย่อด้วย transform ให้พอดีคอลัมน์ · เลื่อนดูในกรอบได้ · กดในกรอบ = เลือกจุด (ส่ง th:pick กลับมา)
 */
import { useEffect, useRef, useState } from "react";

const W = 1280;

interface Props {
  scope: string;
  hot: string | null;
  onPick: (key: string) => void;
  onFound: (key: string, n: number) => void;
}

export default function ThemePreviewFrame({ scope, hot, onPick, onFound }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const [size, setSize] = useState({ w: 560, h: 600 });
  const [ready, setReady] = useState(false);
  const cb = useRef({ onPick, onFound });
  cb.current = { onPick, onFound };

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => { setReady(false); }, [scope]);

  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (e.origin !== location.origin || e.source !== frame.current?.contentWindow) return;
      const d = e.data as { type?: string; key?: string; n?: number };
      if (d?.type === "th:ready") setReady(true);
      else if (d?.type === "th:pick" && d.key) cb.current.onPick(d.key);
      else if (d?.type === "th:found" && d.key) cb.current.onFound(d.key, d.n ?? 0);
    };
    addEventListener("message", on);
    return () => removeEventListener("message", on);
  }, []);

  useEffect(() => {
    if (ready) frame.current?.contentWindow?.postMessage({ type: "th:hot", key: hot }, location.origin);
  }, [hot, ready]);

  const scale = size.w / W;
  return (
    <div ref={box} className="thm-frame">
      <iframe
        key={scope}
        ref={frame}
        title="ตัวอย่างหน้าแท็บ"
        src={`${import.meta.env.BASE_URL}?themePreview=${encodeURIComponent(scope)}`}
        style={{ width: W, height: size.h / scale, transform: `scale(${scale})` }}
      />
      {!ready && <div className="thm-frame-wait">กำลังโหลดตัวอย่างหน้าจริง…</div>}
    </div>
  );
}
