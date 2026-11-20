#!/usr/bin/env node
// Sinh bang chung THAT cho mot phase: chay test, luu output nguyen van + commit + thoi gian + may.
// Dung: node scripts/evidence.mjs <so-phase>      (vd: node scripts/evidence.mjs 1)
// Khong sua tay file sinh ra; chay lai moi lan chot phase (truoc khi gan tag).
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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

// 1) Bot tu choi: man choi thang duoc
if (existsSync("scripts/bot.mjs")) {
  const bot = sh("node", ["scripts/bot.mjs", "--seeds", "20", "--mode", "good"]);
  const idle = sh("node", ["scripts/bot.mjs", "--seeds", "3", "--mode", "idle"]);
  writeFileSync(`${dir}/bot-output.txt`, `${stamp}lenh: node scripts/bot.mjs --seeds 20 --mode good\n---\n${bot.stdout}\nlenh: node scripts/bot.mjs --seeds 3 --mode idle\n---\n${idle.stdout}`);
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
  sh("node", ["-e", `require("fs").rmSync("${dir}/.tmp-second.jsonl",{force:true})`]);
  console.log(`Da ghi ${dir}/determinism.txt va sample-run.jsonl (giong het: ${h1 === h2})`);
  if (h1 !== h2) process.exit(1);
}
process.exit(test.status ?? 1);
