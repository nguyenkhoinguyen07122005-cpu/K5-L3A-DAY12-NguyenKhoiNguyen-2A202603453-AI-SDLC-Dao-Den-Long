#!/usr/bin/env node
// Benchmark (Ticket-04, muc 1): mo ban choi 3D trong trinh duyet that (Chrome/Edge) o canh chuan, do khung hinh, ghi bench.json.
// Dung: node scripts/bench.mjs --seed 42 --duration 30 --out bench.json
// Bien moi truong: BENCH_BROWSER=duong/dan/toi/chrome-hoac-edge; BENCH_ARGS="--headless=new --no-sandbox" (them co cho CI).
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import os from "node:os";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveAllowed } from "./static-paths.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CONTRACT = JSON.parse(readFileSync(join(ROOT, "game.contract.json"), "utf8"));
const startEpoch = Date.now() - process.uptime() * 1000; // luc tien trinh bat dau

const args = process.argv.slice(2);
const get = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const seed = Number(get("--seed", 42));
const duration = Number(get("--duration", 30));
const out = get("--out", "bench.json");
if (!Number.isInteger(seed) || !(duration > 0)) {
  console.error("Dung: node scripts/bench.mjs --seed 42 --duration 30 --out bench.json");
  process.exit(2);
}

function findBrowser() {
  if (process.env.BENCH_BROWSER) return process.env.BENCH_BROWSER;
  const c = [];
  if (process.platform === "win32") {
    for (const base of [process.env.PROGRAMFILES, process.env["PROGRAMFILES(X86)"], process.env.LOCALAPPDATA]) {
      if (!base) continue;
      c.push(join(base, "Google", "Chrome", "Application", "chrome.exe"), join(base, "Microsoft", "Edge", "Application", "msedge.exe"));
    }
  } else if (process.platform === "darwin") {
    c.push("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge", "/Applications/Chromium.app/Contents/MacOS/Chromium");
  } else {
    for (const n of ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "microsoft-edge"]) {
      const r = spawnSync("which", [n], { encoding: "utf8" });
      if (r.status === 0) c.push(r.stdout.trim());
    }
  }
  return c.find((p) => existsSync(p));
}
const browser = findBrowser();
if (!browser) {
  console.error("Khong tim thay Chrome/Edge. Cai Google Chrome hoac dat BENCH_BROWSER=<duong dan toi chrome.exe / msedge.exe>.");
  process.exit(3);
}

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".css": "text/css; charset=utf-8", ".png": "image/png" };
let resolveResult;
const gotResult = new Promise((r) => (resolveResult = r));
const server = createServer(async (req, res) => {
  try {
    const path = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (path === "/__bench" && req.method === "POST") {
      let body = "";
      for await (const c of req) body += c;
      res.writeHead(204).end();
      resolveResult(JSON.parse(body));
      return;
    }
    if (path === "/favicon.ico") return void res.writeHead(204).end();
    const file = resolveAllowed(path, ROOT);
    if (!file || !(await stat(file)).isFile()) return void res.writeHead(404).end("404");
    res.writeHead(200, { "Content-Type": TYPES[extname(file)] ?? "application/octet-stream", "Cache-Control": "no-store" }).end(await readFile(file));
  } catch {
    res.writeHead(404).end("404");
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const url = `http://127.0.0.1:${server.address().port}/web/index.html?bench&seed=${seed}&duration=${duration}`;

const profile = mkdtempSync(join(os.tmpdir(), "ddl-bench-"));
const flags = [
  `--user-data-dir=${profile}`, "--no-first-run", "--no-default-browser-check", "--window-size=1280,720", "--window-position=0,0",
  "--disable-gpu-vsync", "--disable-frame-rate-limit", // tat vsync
  "--disable-renderer-backgrounding", "--disable-background-timer-throttling", "--disable-backgrounding-occluded-windows",
  "--enable-precise-memory-info", ...(process.env.BENCH_ARGS ?? "").split(/\s+/).filter(Boolean), `--app=${url}`,
];
const child = spawn(browser, flags, { stdio: "ignore", detached: process.platform !== "win32" });
child.on("error", (e) => {
  console.error(`Khong mo duoc trinh duyet: ${e.message}`);
  process.exit(3);
});
const killBrowser = () => {
  try {
    if (process.platform === "win32") spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    else process.kill(-child.pid, "SIGKILL");
  } catch { /* da thoat */ }
};

const timeout = setTimeout(() => {
  console.error("Het gio cho ket qua tu trinh duyet (kiem tra trinh duyet co mo duoc cua so khong).");
  killBrowser();
  process.exit(1);
}, (duration + 3 + 90) * 1000);

const r = await gotResult;
clearTimeout(timeout);
killBrowser();
server.close();
setTimeout(() => rmSync(profile, { recursive: true, force: true }), 1500).unref();

// ---- cong thuc cua ticket ----
const dts = r.dts;
const N = dts.length;
const sum = dts.reduce((a, b) => a + b, 0);
const sorted = [...dts].sort((a, b) => a - b);
const k = Math.max(1, Math.ceil(0.01 * N));
const worst = sorted.slice(-k);
const p95 = sorted[Math.min(N - 1, Math.ceil(0.95 * N) - 1)]; // phan vi 95 (nearest-rank)
const r1 = (v) => Math.round(v * 10) / 10;
const result = {
  contract_version: CONTRACT.contract_version,
  avg_fps: r1((1000 * N) / sum),
  p1_low_fps: r1(1000 / (worst.reduce((a, b) => a + b, 0) / k)),
  frame_ms_p95: r1(p95),
  frames: N,
  load_ms: Math.round(r.first_frame_epoch_ms - startEpoch),
  peak_mem_mb: null, // ban web: khong do duoc RSS cua trinh duyet tu trong trang (xem notes va README)
  vsync_off: true, // da truyen --disable-gpu-vsync --disable-frame-rate-limit; neu may chan co nay thi README ghi ro
  renderer: `Three.js r160 (WebGL) tren ${r.gpu || "GPU khong ro"}; ${r.ua.match(/(Chrome|Edg)\/[\d.]+/)?.[0] ?? "Chromium"}`,
  os: `${os.type()} ${os.release()} ${os.arch()}, ${os.cpus()[0]?.model ?? "cpu"} x${os.cpus().length}, ${Math.round(os.totalmem() / 2 ** 30)} GB RAM`,
  notes: `peak_mem_mb = null: ban choi chay trong trinh duyet nen khong do duoc RSS tien trinh; dinh JS heap ${r1(r.heap_peak_mb)} MB. Khung 1280x720 ti le 1, 200 Bong Muc + 100 dom dom, cay co/may/den troi tat.`,
};
writeFileSync(out, JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify(result, null, 2));
console.log(`Nguong: avg_fps >= 60 (${result.avg_fps >= 60 ? "dat" : "chua"}), p1_low_fps >= 30 (${result.p1_low_fps >= 30 ? "dat" : "chua"}), load_ms <= 10000 (${result.load_ms <= 10000 ? "dat" : "chua"})`);
process.exit(0);
