import { defineConfig } from "vitest/config";
import type { Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { spawn } from "node:child_process";
import { existsSync, readdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * รัน ETL ให้เองตอน dev เมื่อไฟล์ .xlsx ใน etl/data/revenue/ เปลี่ยน
 *
 * ผู้ใช้ไม่ต้องเปิด terminal พิมพ์ `python build_json.py --dataset real` เอง —
 * ลากไฟล์ใส่โฟลเดอร์ รอสักครู่ แล้วกด "รีเฟรชข้อมูล" ในแดชบอร์ดก็เห็นผล
 *
 * ทำงานเฉพาะ `vite` (dev) ไม่แตะ build — workflow deploy บังคับ sample อยู่แล้ว
 * ถ้าเครื่องไม่มี python จะขึ้นเตือนใน terminal ของ dev server แล้วข้ามไป แอปยังรันได้ปกติ
 *
 * ★ Excel เขียนไฟล์เป็นช่วง ๆ และตอนคัดลอกไฟล์ใหญ่ก็ยังไม่ครบทันที
 *   จึงหน่วง 2 วินาทีหลังเหตุการณ์สุดท้าย ไม่งั้น ETL อ่านไฟล์ครึ่งเดียวแล้วพัง
 */
function autoEtl(): Plugin {
  // package.json เป็น "type": "module" จึงไม่มี __dirname — หาโฟลเดอร์ของไฟล์นี้จาก import.meta.url
  const here = fileURLToPath(new URL(".", import.meta.url));
  const etlDir = resolve(here, "..", "etl");
  const watchDir = resolve(etlDir, "data", "revenue");
  const realOut = resolve(here, "public", "data", "real", "manifest.json");
  const isXlsx = (f: string) => /\.xlsx$/i.test(f) && !/^~\$/.test(f) && !/\.backup\./i.test(f);

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

  let timer: NodeJS.Timeout | null = null;
  let running = false;
  let queued = false;

  const run = (log: (m: string) => void) => {
    if (running) { queued = true; return; }

    // ลบไฟล์ออกจนหมด = ไม่มีข้อมูลจริงแล้ว → ล้าง JSON เก่าทิ้ง ไม่งั้นแดชบอร์ดยังโชว์ชุดเดิมค้างอยู่
    // ลบเฉพาะไฟล์ข้างใน ไม่ลบโฟลเดอร์ — Windows ถือ handle ของโฟลเดอร์ใต้ public/ ไว้ (watcher)
    // ลบทั้งโฟลเดอร์จะได้ EPERM แล้ว exception ในตัวจับเวลาจะล้ม dev server ทั้งตัว
    if (!readdirSync(watchDir).some(isXlsx)) {
      const realDir = resolve(realOut, "..");
      try {
        if (existsSync(realDir)) {
          for (const f of readdirSync(realDir)) rmSync(resolve(realDir, f), { force: true });
        }
        log("ไม่มีไฟล์ .xlsx ใน etl/data/revenue/ แล้ว — กลับไปใช้ข้อมูลตัวอย่าง (กด “รีเฟรชข้อมูล” ในแดชบอร์ด)");
      } catch (e) {
        log(`✗ ล้าง public/data/real/ ไม่ได้ (${(e as Error).message}) — ลบเองแล้วกดรีเฟรช`);
      }
      return;
    }

    running = true;
    log("▶ กำลังแปลงไฟล์รายได้จริงเป็น JSON (python build_json.py --dataset real) …");
    const exe = pythonExe();
    const child = spawn(exe, ["build_json.py", "--dataset", "real"], {
      cwd: etlDir, stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, PYTHONUTF8: "1", PYTHONIOENCODING: "utf-8" },
    });
    let tail = "";
    child.stdout.on("data", (d) => { tail = (tail + d.toString()).slice(-800); });
    child.stderr.on("data", (d) => { tail = (tail + d.toString()).slice(-800); });
    child.on("error", (e) => {
      running = false;
      log(`✗ รัน python ไม่ได้ (${e.message}) — รันเองด้วย: cd etl && python build_json.py --dataset real`);
    });
    child.on("close", (code) => {
      running = false;
      if (code === 0) log("✓ ข้อมูลรายได้จริงพร้อมแล้ว — กด “รีเฟรชข้อมูล” ในแดชบอร์ดรายได้ได้เลย");
      else if (/No module named/.test(tail)) {
        log(`✗ python ที่ใช้ (${exe}) ยังไม่มีไลบรารี — ติดตั้งด้วย: "${exe}" -m pip install -r etl/requirements.txt`);
      } else log(`✗ ETL ล้มเหลว (exit ${code})\n${tail.trim()}`);
      if (queued) { queued = false; run(log); }
    });
  };

  return {
    name: "auto-etl-real",
    apply: "serve",
    configureServer(server) {
      const log = (m: string) => server.config.logger.info(`[etl] ${m}`, { timestamp: true });
      if (!existsSync(watchDir)) return;
      // อะไรก็ตามที่พังใน plugin นี้ต้องไม่ล้ม dev server — แค่บอกใน terminal แล้วปล่อยแอปรันต่อ
      const safeRun = () => { try { run(log); } catch (e) { log(`✗ ${(e as Error).message}`); } };

      server.watcher.add(watchDir);
      const onFile = (file: string) => {
        if (!file.startsWith(watchDir) || !isXlsx(file.slice(watchDir.length + 1))) return;
        if (timer) clearTimeout(timer);
        timer = setTimeout(safeRun, 2000);
      };
      server.watcher.on("add", onFile);
      server.watcher.on("change", onFile);
      server.watcher.on("unlink", onFile);

      // มีไฟล์วางไว้แล้วแต่ยังไม่เคยแปลง (เช่นวางตอน server ยังไม่เปิด) → แปลงให้ทันที
      // รอให้ server ขึ้น banner ก่อน เพราะ Vite ล้างหน้าจอตอนสตาร์ท ข้อความที่พิมพ์ก่อนหน้านั้นจะหาย
      const pending = readdirSync(watchDir).some(isXlsx);
      if (pending && !existsSync(realOut)) {
        server.httpServer?.once("listening", () => setTimeout(safeRun, 300));
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
