#!/usr/bin/env node
// Soak test (Ticket-04, muc 2): chay headless N Dem lien tiep trong MOT tien trinh, do crash va bo nho.
// Dung: node scripts/soak.mjs --seed 7 --nights 10 --out soak.json
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import v8 from "node:v8";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { createGame, step, nightDuration, TICKS_PER_SECOND } from "../src/core/sim.mjs";
import { createRng } from "../src/core/rng.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const tuning = JSON.parse(readFileSync(join(ROOT, "game.contract.json"), "utf8")).tuning;

const args = process.argv.slice(2);
const get = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const seed0 = Number(get("--seed", 7));
const nights = Number(get("--nights", 10));
const out = get("--out", "soak.json");
if (!Number.isInteger(seed0) || !Number.isInteger(nights) || nights < 1) {
  console.error("Dung: node scripts/soak.mjs --seed 7 --nights 10 --out soak.json");
  process.exit(2);
}

// gc() de RSS phan anh bo nho con giu that, khong phai rac chua don
v8.setFlagsFromString("--expose-gc");
const gc = vm.runInNewContext("gc");
const rssMb = () => {
  gc();
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 300); // cho V8 tra bo nho ve he dieu hanh truoc khi do
  gc();
  return process.memoryUsage().rss / 2 ** 20;
};
const r1 = (v) => Math.round(v * 10) / 10;

// Khoi dong may (khong tinh vao ket qua): Node can vai giay de bien dich JIT va no vung nho tre (young generation),
// nen RSS tang ~3 lan trong 3 Dem dau roi di ngang. Chay nong 3 Dem (moi Dem 14 400 tick) truoc khi do "bo nho luc tai xong" de
// so sanh dau-cuoi phan anh ro ro ri (neu co) thay vi chi phi khoi dong cua runtime. Xem docs/notes/assumptions-phase4.md (P4-3).
function warmUp() {
  for (let n = 1; n <= 3; n++) {
    const g = createGame({ seed: 1, tuning, night: n, scenario: { player: { flames: 1_000_000 } } });
    const rng = createRng(n);
    let move = [0, 0];
    for (let k = 0; k < 14400 && g.state === "playing"; k++) {
      if (k % 30 === 0) move = [Math.cos(rng() * 6.28), Math.sin(rng() * 6.28)];
      step(g, { move, camYawDeg: 0, jump: rng() < 0.05, dash: rng() < 0.03, pulse: rng() < 0.02, interact: rng() < 0.1, pause: false });
    }
  }
}
// lap lai den khi RSS di ngang (tang < 3% giua hai vong, toi da 5 vong): luc do moi la chi phi nen cua runtime
for (let round = 0, prev = 0; round < 5; round++) {
  warmUp();
  const now = rssMb();
  if (prev && now < prev * 1.03) break;
  prev = now;
}

const t0 = process.hrtime.bigint();
const results = [];
let crashes = 0;
let memStart = null;
let game = null;

for (let i = 0; i < nights; i++) {
  const night = (i % 3) + 1; // Dem 1 -> 2 -> 3 xoay vong
  const seed = seed0 + i; // Dem thu i (i = 0..n-1) dung seed 7 + i (xem docs/notes/assumptions-phase4.md)
  try {
    game = createGame({ seed, tuning, night, scenario: {} });
    if (memStart === null) memStart = rssMb(); // sau khi tai xong Dem dau tien
    const rng = createRng(seed + 1_000_003); // nguon ngau nhien cua INPUT, tach khoi RNG cua tro choi
    const maxTicks = Math.round(nightDuration(tuning, night) * TICKS_PER_SECOND) + 5;
    let move = [0, 0];
    for (let k = 0; k < maxTicks && game.state === "playing"; k++) {
      if (k % 30 === 0) {
        const a = rng() * Math.PI * 2;
        move = [Math.cos(a), Math.sin(a)];
      }
      step(game, {
        move,
        camYawDeg: 0,
        jump: rng() < 0.05,
        dash: rng() < 0.03,
        pulse: rng() < 0.02,
        interact: rng() < 0.1,
        pause: false,
      });
    }
    results.push(game.state === "won" ? "won" : "lost");
  } catch (err) {
    crashes++;
    results.push("crash");
    console.error(`Dem ${i + 1} (seed ${seed}) loi: ${err?.stack ?? err}`);
  }
}
// "reset xong Dem cuoi": bo tro choi cu, tao lai man dau, do bo nho
game = createGame({ seed: seed0 + nights - 1, tuning, night: ((nights - 1) % 3) + 1, scenario: {} });
const memEnd = rssMb();
game = null;

const report = {
  nights,
  crashes,
  results,
  mem_start_mb: r1(memStart ?? memEnd),
  mem_end_mb: r1(memEnd),
  duration_s: r1(Number(process.hrtime.bigint() - t0) / 1e9),
};
writeFileSync(out, JSON.stringify(report) + "\n");
console.log(JSON.stringify(report));
console.log(`Dat: crashes = 0 -> ${crashes === 0 ? "co" : "KHONG"}; mem_end <= 1.2 x mem_start -> ${report.mem_end_mb <= 1.2 * report.mem_start_mb ? "co" : "KHONG"}`);
