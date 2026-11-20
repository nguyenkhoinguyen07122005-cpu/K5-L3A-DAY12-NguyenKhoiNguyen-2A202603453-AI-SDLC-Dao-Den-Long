#!/usr/bin/env node
// Bot tu choi Dem 1 bang loi mo phong that - bang chung man choi THANG DUOC.
// Dung: node scripts/bot.mjs [--seeds 20] [--mode good|idle]
//   good: nhat dom dom, thap den gan nhat, toa sang khi Bong Muc den gan.
//   idle: dung yen (phai THUA - chung minh game khong tu thang).
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createGame, step, TICKS_PER_SECOND } from "../src/core/sim.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const tuning = JSON.parse(readFileSync(join(ROOT, "game.contract.json"), "utf8")).tuning;
const d2 = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);

function nearest(list, from, pred = () => true) {
  let best = null;
  let bd = Infinity;
  for (const o of list) {
    if (!pred(o)) continue;
    const d = d2(from, o.pos);
    if (d < bd) {
      bd = d;
      best = o;
    }
  }
  return best;
}

export function botInput(g, tick) {
  const P = g.player;
  const idle = { move: [0, 0], camYawDeg: 0, jump: false, interact: false, pulse: false };
  const shade = nearest(g.shades, P.pos);
  const wantPulse = shade && d2(P.pos, shade.pos) < 4 && P.carried >= tuning.pulse_cost && P.pulseCd === 0 && shade.state !== "stunned";
  const toward = (pos) => {
    const dx = pos[0] - P.pos[0];
    const dz = pos[2] - P.pos[2];
    const d = Math.hypot(dx, dz) || 1;
    return [dx / d, dz / d];
  };
  const lantern = nearest(g.lanterns, P.pos, (l) => !l.lit);
  const needs = lantern ? tuning.lantern_cost - lantern.deposited : 0;
  const carryingEnough = P.carried >= Math.min(needs, tuning.carry_capacity) && P.carried > 0;
  let target;
  if (carryingEnough && lantern) target = lantern.pos;
  else {
    const m = nearest(g.motes, P.pos);
    target = m ? m.pos : lantern?.pos;
  }
  const out = { ...idle, pulse: !!wantPulse && tick % 2 === 0 };
  if (target) {
    const closeToLantern = lantern && target === lantern.pos && d2(P.pos, lantern.pos) <= tuning.interact_radius - 0.5;
    if (closeToLantern) out.interact = tick % 2 === 0; // tao canh len
    else out.move = toward(target);
  }
  return out;
}

export function playBot(seed, mode = "good") {
  const g = createGame({ seed, tuning, scenario: {} });
  const maxTicks = Math.round(tuning.night1_duration_s * TICKS_PER_SECOND) + 5;
  for (let k = 0; k < maxTicks && g.state === "playing"; k++) {
    step(g, mode === "idle" ? { move: [0, 0], camYawDeg: 0 } : botInput(g, k));
  }
  return { seed, state: g.state, reason: g.result?.reason, ticks: g.tick, score: g.score, flames: g.player.flames, lit: g.lanterns.filter((l) => l.lit).length };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const get = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
  const n = Number(get("--seeds", 20));
  const mode = get("--mode", "good");
  let wins = 0;
  for (let seed = 1; seed <= n; seed++) {
    const r = playBot(seed, mode);
    if (r.state === "won") wins++;
    console.log(`seed ${String(seed).padStart(3)}: ${r.state.padEnd(4)} ${String(r.reason ?? "").padEnd(9)} ${(r.ticks / 60).toFixed(1).padStart(6)}s  diem ${String(r.score).padStart(5)}  mau ${r.flames}  den ${r.lit}/5`);
  }
  console.log(`\nche do ${mode}: thang ${wins}/${n}`);
}
