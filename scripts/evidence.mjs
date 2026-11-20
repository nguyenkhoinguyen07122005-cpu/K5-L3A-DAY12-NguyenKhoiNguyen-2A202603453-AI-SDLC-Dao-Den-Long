#!/usr/bin/env node
// Sinh bang chung THAT cho mot phase: chay test, luu output nguyen van + commit + thoi gian + may.
// Dung: node scripts/evidence.mjs <so-phase>      (vd: node scripts/evidence.mjs 1)
// Khong sua tay file sinh ra; chay lai moi lan chot phase (truoc khi gan tag).
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";

const phase = process.argv[2];
if (!phase || !/^[1-4]$/.test(phase)) {
  console.error("Dung: node scripts/evidence.mjs <1-4>");
  process.exit(1);
}

const sh = (cmd, args) => spawnSync(cmd, args, { encoding: "utf8", shell: process.platform === "win32" });
const commit = sh("git", ["rev-parse", "HEAD"]).stdout.trim();
const dirty = sh("git", ["status", "--porcelain"]).stdout.trim() !== "";
const test = sh("npm", ["test", "--silent"]);

const dir = `docs/proof/phase-${phase}`;
mkdirSync(dir, { recursive: true });

const header = [
  `phase: ${phase}`,
  `commit: ${commit}${dirty ? " (+ thay doi chua commit)" : ""}`,
  `thoi gian (UTC): ${new Date().toISOString()}`,
  `node: ${process.version}`,
  `may: ${os.type()} ${os.release()} ${os.arch()}, ${os.cpus().length} cpu, ${Math.round(os.totalmem() / 2 ** 30)} GB RAM`,
  `lenh: npm test`,
  `exit code: ${test.status}`,
  "---",
].join("\n");

writeFileSync(`${dir}/test-output.txt`, `${header}\n${test.stdout}${test.stderr}`);
console.log(`Da ghi ${dir}/test-output.txt (exit code ${test.status}${dirty ? ", CANH BAO: cay lam viec chua sach" : ""})`);

// --- Bang chung bo sung (chay that, khong sua tay) ---
const stamp = `commit: ${commit}${dirty ? " (+ thay doi chua commit)" : ""}\nthoi gian (UTC): ${new Date().toISOString()}\n`;

// 1) Bot tu choi: man choi thang duoc (Phase 2+: ca 3 Dem)
if (existsSync("scripts/bot.mjs")) {
  const nights = Number(phase) >= 2 ? [1, 2, 3] : [1];
  let text = "";
  for (const n of nights) {
    const bot = sh("node", ["scripts/bot.mjs", "--night", String(n), "--seeds", "20", "--mode", "good"]);
    const idle = sh("node", ["scripts/bot.mjs", "--night", String(n), "--seeds", "3", "--mode", "idle"]);
    text += `lenh: node scripts/bot.mjs --night ${n} --seeds 20 --mode good\n---\n${bot.stdout}\nlenh: node scripts/bot.mjs --night ${n} --seeds 3 --mode idle\n---\n${idle.stdout}\n`;
    if (n >= 2) {
      const calm = sh("node", ["scripts/bot.mjs", "--night", String(n), "--seeds", "6", "--mode", "good", "--calm"]);
      text += `lenh: node scripts/bot.mjs --night ${n} --seeds 6 --mode good --calm (tat Bong Muc/Gio Lac: chung minh moi den toi duoc)\n---\n${calm.stdout}\n`;
    }
  }
  writeFileSync(`${dir}/bot-output.txt`, `${stamp}${text}`);
  console.log(`Da ghi ${dir}/bot-output.txt`);
}

// 2) Headless: chay vi du cua contract + kiem tra tat dinh bang hash
if (existsSync("docs/samples/scenario.example.json")) {
  const run = (out, extra = []) =>
    sh("node", ["src/headless/cli.mjs", "--seed", "42", "--night", "1", "--ticks", "3000", "--out", out, ...extra]);
  const common = ["--scenario", "docs/samples/scenario.example.json", "--inputs", "docs/samples/inputs.example.json"];
  const a = run(`${dir}/sample-run.jsonl`, common);
  run(`${dir}/.tmp-second.jsonl`, common);
  const hash = (f) => createHash("sha256").update(readFileSync(f)).digest("hex");
  const h1 = hash(`${dir}/sample-run.jsonl`);
  const h2 = hash(`${dir}/.tmp-second.jsonl`);
  const lines = readFileSync(`${dir}/sample-run.jsonl`, "utf8").trim().split("\n");
  writeFileSync(
    `${dir}/determinism.txt`,
    `${stamp}lenh: node src/headless/cli.mjs --seed 42 --night 1 --ticks 3000 --scenario docs/samples/scenario.example.json --inputs docs/samples/inputs.example.json --out sample-run.jsonl (chay 2 lan)\n` +
      `exit code lan 1: ${a.status}\nsha256 lan 1: ${h1}\nsha256 lan 2: ${h2}\ngiong het: ${h1 === h2}\nso dong output: ${lines.length}\ndong cuoi: ${lines.at(-1)}\n`,
  );
  rmSync(`${dir}/.tmp-second.jsonl`, { force: true }); // khong qua shell: chay dung tren Windows
  console.log(`Da ghi ${dir}/determinism.txt va sample-run.jsonl (giong het: ${h1 === h2})`);
  if (h1 !== h2) process.exit(1);
}

// 3) Phase 2+: moi Dem chay du 21 600 tick headless, do thoi gian (<= 30 s) va tat dinh
if (Number(phase) >= 2) {
  const hashOf = (f) => createHash("sha256").update(readFileSync(f)).digest("hex");
  const sc = `${dir}/.tmp-full-scenario.json`;
  writeFileSync(sc, JSON.stringify({ player: { flames: 1000000 }, time_left_s: 360 }));
  let report = `${stamp}Moi Dem chay du 21600 tick (nguoi choi dung yen, 1.000.000 ngon lua de khong thua som, ket thuc o tick 21600 (dawn)), do bang dong ho tuong.\n`;
  let bad = false;
  for (const n of [1, 2, 3]) {
    const out = `${dir}/.tmp-full-${n}.jsonl`;
    const out2 = `${dir}/.tmp-full-${n}b.jsonl`;
    const args = ["src/headless/cli.mjs", "--seed", "42", "--night", String(n), "--ticks", "21600", "--scenario", sc, "--out"];
    const t0 = process.hrtime.bigint();
    const r1 = sh("node", [...args, out]);
    const sec = Number(process.hrtime.bigint() - t0) / 1e9;
    const r2 = sh("node", [...args, out2]);
    const same = hashOf(out) === hashOf(out2);
    const last = readFileSync(out, "utf8").trim().split("\n").at(-1);
    report += `Dem ${n}: exit ${r1.status}, ${sec.toFixed(2)} s (gioi han 30 s), giong het lan 2: ${same}, dong cuoi: ${last}\n`;
    if (r1.status !== 0 || sec > 30 || !same) bad = true;
    rmSync(out, { force: true });
    rmSync(out2, { force: true });
  }
  rmSync(sc, { force: true });
  writeFileSync(`${dir}/perf-fullnight.txt`, report);
  console.log(`Da ghi ${dir}/perf-fullnight.txt`);
  if (bad) process.exit(1);
}
process.exit(test.status ?? 1);
