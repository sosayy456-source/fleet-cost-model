import { defineConfig } from "vitest/config";
import type { Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { spawn } from "node:child_process";
import { existsSync, readdirSync, rmSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * รัน ETL ให้เองตอน dev เมื่อไฟล์ .xlsx ใน etl/data/ เปลี่ยน
 *
 * ผู้ใช้ไม่ต้องเปิด terminal พิมพ์คำสั่ง python เอง — ลากไฟล์ใส่โฟลเดอร์ รอสักครู่
 * แดชบอร์ดขึ้นแถบ "กำลังแปลง…" แล้วรีเฟรชตัวเองเมื่อเสร็จ
 *
 * มีสองงาน:
 *   rev  etl/data/revenue/              -> build_json.py     -> public/data/real/
 *   cr   etl/data/Dashboard real data/  -> build_costrev.py  -> public/data/real/costrev/
 *
 * ★ สองงานนี้ต้องรันทีละตัว ห้ามพร้อมกัน
 *   ข้อมูลจริงรวมกันเกือบ 700 MB / 5 ล้านแถว งานแรกใช้หน่วยความจำหลาย GB
 *   ถ้าปล่อยให้รันซ้อนกัน เครื่อง 16 GB จะหมดหน่วยความจำ แล้ว Windows ฆ่าทั้ง
 *   python และ dev server ที่เป็นแม่ของมันทิ้ง (อาการ: หน้าเว็บขึ้น "Failed to fetch"
 *   แล้วรีเฟรชอีกทีก็ localhost ปฏิเสธการเชื่อมต่อ) — เกิดขึ้นจริงมาแล้ว
 *
 * ทำงานเฉพาะ `vite` (dev) ไม่แตะ build — workflow deploy บังคับ sample อยู่แล้ว
 * ถ้าเครื่องไม่มี python จะขึ้นเตือนใน terminal ของ dev server แล้วข้ามไป แอปยังรันได้ปกติ
 *
 * ★ Excel เขียนไฟล์เป็นช่วง ๆ และตอนคัดลอกไฟล์ใหญ่ก็ยังไม่ครบทันที
 *   จึงหน่วงหลังเหตุการณ์สุดท้าย ไม่งั้น ETL อ่านไฟล์ครึ่งเดียวแล้วพัง
 */
function autoEtl(): Plugin {
  // package.json เป็น "type": "module" จึงไม่มี __dirname — หาโฟลเดอร์ของไฟล์นี้จาก import.meta.url
  const here = fileURLToPath(new URL(".", import.meta.url));
  const etlDir = resolve(here, "..", "etl");
  const revDir = resolve(etlDir, "data", "revenue");
  const revOut = resolve(here, "public", "data", "real");
  const costDir = resolve(etlDir, "data", "Dashboard real data");
  const costOut = resolve(revOut, "costrev");
  const isXlsx = (f: string) => /\.xlsx$/i.test(f) && !/^~\$/.test(f) && !/\.backup\./i.test(f);
  const hasXlsx = (dir: string) => existsSync(dir) && readdirSync(dir).some(isXlsx);

  /**
   * python ตัวไหนมี pandas — ไล่หา venv ที่รู้จักก่อน แล้วค่อยใช้ตัวบน PATH
   * python ของระบบมักไม่มี pandas (เครื่องนี้ก็ไม่มี) แต่ venv ของ Streamlit เดิมมีครบ
   */
  const pythonExe = (): string => {
    const candidates = [
      resolve(etlDir, ".venv"),
      resolve(here, "..", "RevenueDashboard", "RevenueDashboard", "venv"),
    ];
    for (const v of candidates) {
      for (const exe of [resolve(v, "Scripts", "python.exe"), resolve(v, "bin", "python")]) {
        if (existsSync(exe)) return exe;
      }
    }
    return "python";
  };

  /**
   * ล้างไฟล์ JSON ที่ ETL เคยสร้าง — คืน ok=true ถ้า keyFile หายไปแล้ว (แอปจะกลับไปใช้ sample)
   *
   * ★ ลบ keyFile ก่อนเสมอ และลบทีละไฟล์ในบล็อก try ของตัวเอง
   *   Windows ล็อกไฟล์ที่ dev server เพิ่งเสิร์ฟไว้ ทำให้ rmSync ได้ EPERM เป็นบางไฟล์
   *   ของเดิมครอบทั้งลูปด้วย try เดียว พอไฟล์ที่สองพังก็ข้ามการแจ้งสถานะไปทั้งหมด
   *   แล้วหน้าเว็บค้างอยู่กับข้อมูลเก่าโดยไม่มีอะไรบอก
   */
  const clearOut = (dir: string, keyFile: string): { ok: boolean; failed: string[] } => {
    if (!existsSync(dir)) return { ok: true, failed: [] };
    const failed: string[] = [];
    const names = readdirSync(dir);
    for (const f of [keyFile, ...names.filter((n) => n !== keyFile)]) {
      const full = resolve(dir, f);
      if (!existsSync(full)) continue;
      try { rmSync(full, { force: true }); } catch { failed.push(f); }
    }
    return { ok: !existsSync(resolve(dir, keyFile)), failed };
  };

  /**
   * สถานะล่าสุดของแต่ละงาน ส่งให้เบราว์เซอร์ผ่าน HMR websocket
   * แดชบอร์ดจะได้ขึ้น "กำลังแปลง…" และรีเฟรชเองตอนเสร็จ ไม่ต้องเดาว่าเสร็จหรือยัง
   */
  type Status = { state: "idle" | "running" | "done" | "error" | "cleared"; message: string; at: number };
  type Job = "rev" | "cr";
  const EVENT: Record<Job, string> = { rev: "etl:status", cr: "costrev:status" };

  const status: Record<Job, Status> = {
    rev: { state: "idle", message: "", at: Date.now() },
    cr: { state: "idle", message: "", at: Date.now() },
  };
  let emit: (job: Job, s: Status) => void = () => {};
  const setStatus = (job: Job, state: Status["state"], message: string) => {
    status[job] = { state, message, at: Date.now() };
    emit(job, status[job]);
  };

  /** งานที่รันอยู่ตอนนี้ (null = ว่าง) กับคิวของงานที่ขอไว้ */
  let busy: Job | null = null;
  const want: Record<Job, boolean> = { rev: false, cr: false };

  type Spec = {
    script: string;
    dir: string;
    out: string;
    emptyLog: string;
    emptyMsg: string;
    clearFailLog: string;
    clearFailMsg: string;
    startLog: (n: number) => string;
    startMsg: (n: number) => string;
    doneMsg: string;
  };

  const SPEC: Record<Job, Spec> = {
    rev: {
      script: "build_json.py", dir: revDir, out: revOut,
      emptyLog: "ไม่มีไฟล์ .xlsx ใน etl/data/revenue/ แล้ว — กลับไปใช้ข้อมูลตัวอย่าง",
      emptyMsg: "ไม่มีไฟล์รายได้จริงแล้ว กลับไปใช้ข้อมูลตัวอย่าง",
      clearFailLog: "✗ ลบ public/data/real/manifest.json ไม่ได้ (ไฟล์ถูกล็อก) — ลบเองแล้วกดรีเฟรช",
      clearFailMsg: "ล้างข้อมูลจริงไม่สำเร็จ — ลบ public/data/real/manifest.json เองแล้วกดรีเฟรช",
      startLog: (n) => `▶ กำลังแปลงไฟล์รายได้จริง ${n} ไฟล์เป็น JSON (python build_json.py --dataset real) …`,
      startMsg: (n) => `กำลังแปลงไฟล์รายได้จริง ${n} ไฟล์ — ไฟล์ละราว 10-20 วินาที`,
      doneMsg: "ข้อมูลรายได้จริงพร้อมแล้ว",
    },
    cr: {
      script: "build_costrev.py", dir: costDir, out: costOut,
      emptyLog: "ไม่มีไฟล์ .xlsx ใน etl/data/Dashboard real data/ — Executive/Dashboard รวม กลับไปใช้ข้อมูลตัวอย่าง",
      emptyMsg: "ไม่มีไฟล์ต้นทุน+รายได้จริงแล้ว กลับไปใช้ข้อมูลตัวอย่าง",
      clearFailLog: "✗ ลบ public/data/real/costrev/manifest.json ไม่ได้ (ไฟล์ถูกล็อก) — ลบเองแล้วกดรีเฟรช",
      clearFailMsg: "ล้างข้อมูลจริงไม่สำเร็จ — ลบ public/data/real/costrev/manifest.json เองแล้วกดรีเฟรช",
      startLog: () => "▶ กำลังแปลงไฟล์ต้นทุน+รายได้รายเที่ยว (python build_costrev.py --dataset real) …",
      startMsg: () => "กำลังแปลงไฟล์ต้นทุน+รายได้รายเที่ยว และจับคู่กับข้อมูลรายได้จริง",
      doneMsg: "ข้อมูลต้นทุน+รายได้รายเที่ยวพร้อมแล้ว",
    },
  };

  /** python ตายเพราะหน่วยความจำไม่พอ — แยกออกจาก error อื่นเพราะวิธีแก้คนละเรื่องกันคนละทาง */
  const outOfMemory = (code: number | null, tail: string) =>
    /MemoryError|Unable to allocate|bad_alloc/i.test(tail) || code === 3221225477 || code === -1073741819;

  const start = (job: Job, log: (m: string) => void, done: () => void) => {
    const spec = SPEC[job];

    // ลบไฟล์ออกจนหมด = ไม่มีข้อมูลจริงแล้ว → ล้าง JSON เก่าทิ้ง ไม่งั้นแดชบอร์ดยังโชว์ชุดเดิมค้างอยู่
    // ลบเฉพาะไฟล์ข้างใน ไม่ลบโฟลเดอร์ — Windows ถือ handle ของโฟลเดอร์ใต้ public/ ไว้ (watcher)
    if (!hasXlsx(spec.dir)) {
      const { ok, failed } = clearOut(spec.out, "manifest.json");
      if (ok) {
        log(spec.emptyLog + (failed.length ? ` (ลบไม่ได้ ${failed.length} ไฟล์ ไม่เป็นไร แอปไม่อ่านแล้ว)` : ""));
        setStatus(job, "cleared", spec.emptyMsg);
      } else {
        log(spec.clearFailLog);
        setStatus(job, "error", spec.clearFailMsg);
      }
      done();
      return;
    }

    const n = readdirSync(spec.dir).filter(isXlsx).length;
    log(spec.startLog(n));
    setStatus(job, "running", spec.startMsg(n));

    const exe = pythonExe();
    const child = spawn(exe, [spec.script, "--dataset", "real"], {
      cwd: etlDir, stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, PYTHONUTF8: "1", PYTHONIOENCODING: "utf-8" },
    });
    let tail = "";
    child.stdout.on("data", (d) => { tail = (tail + d.toString()).slice(-800); });
    child.stderr.on("data", (d) => { tail = (tail + d.toString()).slice(-800); });
    child.on("error", (e) => {
      log(`✗ รัน python ไม่ได้ (${e.message}) — รันเองด้วย: cd etl && python ${spec.script} --dataset real`);
      setStatus(job, "error", `รัน python ไม่ได้: ${e.message}`);
      done();
    });
    child.on("close", (code) => {
      if (code === 0) {
        log(`✓ ${spec.doneMsg}` + (job === "cr" ? " — " + tail.trim().split("\n").slice(-6).join(" | ") : ""));
        setStatus(job, "done", spec.doneMsg);
      } else if (outOfMemory(code, tail)) {
        log(`✗ ${spec.script} หน่วยความจำไม่พอ (exit ${code}) — ปิดโปรแกรมอื่นแล้วลองใหม่\n${tail.trim()}`);
        setStatus(job, "error", "หน่วยความจำไม่พอระหว่างแปลงไฟล์ — ปิดโปรแกรมอื่นแล้วกดรีเฟรชเพื่อลองใหม่");
      } else if (/No module named/.test(tail)) {
        log(`✗ python ที่ใช้ (${exe}) ยังไม่มีไลบรารี — ติดตั้งด้วย: "${exe}" -m pip install -r etl/requirements.txt`);
        setStatus(job, "error", "python ที่ใช้ยังไม่มีไลบรารีที่ต้องใช้ — ดูคำสั่งติดตั้งใน terminal ของ dev server");
      } else {
        log(`✗ ${spec.script} ล้มเหลว (exit ${code})\n${tail.trim()}`);
        setStatus(job, "error", "แปลงไฟล์ไม่สำเร็จ — ดูรายละเอียดใน terminal ของ dev server");
      }
      done();
    });
  };

  /** หยิบงานถัดไปจากคิวมารัน — งานรายได้มาก่อนเพราะ build_costrev อ่านผลของมันไปจับคู่ */
  const pump = (log: (m: string) => void) => {
    if (busy) return;
    const job: Job | null = want.rev ? "rev" : want.cr ? "cr" : null;
    if (!job) return;
    want[job] = false;
    busy = job;
    // อะไรก็ตามที่พังใน plugin นี้ต้องไม่ล้ม dev server — แค่บอกใน terminal แล้วปล่อยแอปรันต่อ
    try {
      start(job, log, () => { busy = null; pump(log); });
    } catch (e) {
      log(`✗ ${(e as Error).message}`);
      busy = null;
    }
  };

  return {
    name: "auto-etl-real",
    apply: "serve",
    configureServer(server) {
      const log = (m: string) => server.config.logger.info(`[etl] ${m}`, { timestamp: true });
      if (!existsSync(revDir)) return;

      emit = (job, st) => server.ws.send({ type: "custom", event: EVENT[job], data: st });
      // แท็บที่เพิ่งเปิด/รีโหลดขอสถานะล่าสุด — ไม่งั้นจะไม่รู้ว่ากำลังแปลงอยู่
      server.ws.on("etl:hello", (_d, c) => c.send({ type: "custom", event: EVENT.rev, data: status.rev }));
      server.ws.on("costrev:hello", (_d, c) => c.send({ type: "custom", event: EVENT.cr, data: status.cr }));

      const timers: Record<Job, NodeJS.Timeout | null> = { rev: null, cr: null };
      const request = (job: Job, delay: number) => {
        if (timers[job]) clearTimeout(timers[job]!);
        timers[job] = setTimeout(() => { want[job] = true; pump(log); }, delay);
      };

      /**
       * ★ ห้ามใช้ server.watcher.add() กับโฟลเดอร์ข้อมูล — โพลเอง
       *
       * chokidar ของ Vite บน Windows เฝ้า "รายไฟล์" ด้วย fs.watch ตอนที่ Explorer ยังคัดลอก
       * ไฟล์ .xlsx ขนาดใหญ่ไม่เสร็จ ไฟล์ถูกล็อก → fs.watch โยน EBUSY → chokidar emit 'error'
       * ที่ไม่มีใครดัก → **node ตายทั้งโปรเซสทันที** (อาการที่ผู้ใช้เห็น: หน้าเว็บขึ้น
       * "Failed to fetch" แล้วรีเฟรชอีกทีก็ localhost ปฏิเสธการเชื่อมต่อ) เกิดขึ้นจริงมาแล้ว
       * ตอนวางไฟล์จริง 29 ไฟล์ ยังไม่ทันได้รัน ETL ด้วยซ้ำ
       *
       * วิธีใหม่: อ่านรายชื่อ+ขนาด+เวลาแก้ไขของไฟล์ทุก 2 วินาที เทียบกับรอบก่อน
       * เปลี่ยน = มีการวาง/ลบ/เขียนไฟล์ · ไฟล์ที่กำลังคัดลอกอยู่ขนาดจะเปลี่ยนทุกรอบ
       * จึงไม่มีทางเริ่ม ETL จนกว่าจะคัดลอกเสร็จจริง (ดีกว่าเดิมที่ยิงตอนเห็นไฟล์โผล่)
       * statSync บนไฟล์ที่ล็อกอยู่โยน error ได้ → ถือว่า "ยังเปลี่ยนอยู่" แล้วรอรอบหน้า
       */
      const signature = (dir: string): string | null => {
        if (!existsSync(dir)) return "";
        try {
          return readdirSync(dir).filter(isXlsx).sort()
            .map((f) => { const st = statSync(resolve(dir, f)); return `${f}|${st.size}|${st.mtimeMs}`; })
            .join("\n");
        } catch { return null; }
      };
      const last: Record<Job, string | null> = { rev: signature(revDir), cr: signature(costDir) };
      const tick = () => {
        for (const job of ["rev", "cr"] as Job[]) {
          const dir = job === "rev" ? revDir : costDir;
          const sig = signature(dir);
          if (sig === null || sig === last[job]) continue;
          last[job] = sig;
          request(job, 2000);
          // ไฟล์รายได้เปลี่ยน = คู่ที่จับได้เปลี่ยน → แปลงชุดต้นทุน+รายได้ใหม่ด้วย (ต่อคิวไว้ ไม่รันซ้อน)
          if (job === "rev" && hasXlsx(costDir)) request("cr", 2500);
        }
      };
      const poll = setInterval(() => { try { tick(); } catch (e) { log(`✗ ${(e as Error).message}`); } }, 2000);
      server.httpServer?.once("close", () => clearInterval(poll));
      // กันไว้อีกชั้น: error จาก watcher ของ Vite เองต้องไม่ล้ม dev server
      server.watcher.on("error", (e) => log(`✗ watcher: ${(e as Error).message}`));

      // มีไฟล์วางไว้แล้วแต่ยังไม่เคยแปลง (เช่นวางตอน server ยังไม่เปิด) → แปลงให้ทันที
      // รอให้ server ขึ้น banner ก่อน เพราะ Vite ล้างหน้าจอตอนสตาร์ท ข้อความก่อนหน้านั้นจะหาย
      const pendingRev = hasXlsx(revDir) && !existsSync(resolve(revOut, "manifest.json"));
      const pendingCr = hasXlsx(costDir) && !existsSync(resolve(costOut, "manifest.json"));
      if (pendingRev || pendingCr) {
        server.httpServer?.once("listening", () => setTimeout(() => {
          if (pendingRev) want.rev = true;
          if (pendingCr) want.cr = true;
          pump(log);
        }, 600));
      }
    },
  };
}

// base ต้องตรงกับชื่อ repo เพราะ GitHub Pages เสิร์ฟที่ path ย่อย
// (https://<user>.github.io/fleet-cost-model/) — ตั้งผิดแล้ว asset 404 ทั้งหน้า
export default defineConfig({
  base: "/fleet-cost-model/",
  plugins: [react(), autoEtl()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
