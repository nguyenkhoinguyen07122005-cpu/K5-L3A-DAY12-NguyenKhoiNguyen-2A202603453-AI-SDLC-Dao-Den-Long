#!/usr/bin/env node
// Bot tu choi 3 Dem bang loi mo phong that - bang chung man choi THANG DUOC.
// --calm: tat Bong Muc/Gio Lac de chung minh moi den tren moi dao DEU toi duoc (cau, doc, buc nhay).
// Dung: node scripts/bot.mjs [--night 1|2|3] [--seeds 20] [--calm] [--mode good|idle]
//   good: nhat dom dom, thap den gan nhat, toa sang khi Bong Muc den gan.
//   idle: dung yen (phai THUA - chung minh game khong tu thang).
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createGame, step, TICKS_PER_SECOND, nightDuration } from "../src/core/sim.mjs";

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

const level = (y) => (y > 4.5 ? 2 : y > 1.5 ? 1 : 0);

/** Diem trung gian de toi `target`: cau tre (Dem 2), doc/bục nhay (Dem 3). Tra ve toa do can huong toi truoc. */
function waypoint(g, from, target) {
  if (g.night === 2) {
    const side = (p) => (p[0] < 35 ? 0 : 1);
    if (side(from) !== side(target)) {
      const onBridge = from[0] >= 24 && from[0] <= 46 && Math.abs(from[2]) < 3;
      if (!onBridge) return side(from) === 0 ? [24, 0, 0] : [46, 0, 0];
      return side(from) === 0 ? [47, 0, 0] : [23, 0, 0];
    }
  }
  if (g.night === 3) {
    const a = level(from[1]);
    const b = level(target[1]);
    if (b > a) {
      if (a === 0) {
        // len doc gan nhat (30 do hoac 150 do), toi dinh doc roi vao tang 1
        const left = from[0] < 0;
        const ang = ((left ? 150 : 30) * Math.PI) / 180;
        const foot = [30 * Math.cos(ang), 0, 30 * Math.sin(ang)];
        const top = [22.5 * Math.cos(ang), 3, 22.5 * Math.sin(ang)];
        return Math.hypot(from[0] - foot[0], from[2] - foot[2]) > 1.2 && Math.hypot(from[0] - top[0], from[2] - top[2]) > 1 && from[1] < 0.2 ? foot : top;
      }
      if (a === 1 && b === 2) return [0, 3, 13]; // buc nhay
    }
  }
  return target;
}

export function botInput(g, tick) {
  const P = g.player;
  const idle = { move: [0, 0], camYawDeg: 0, jump: false, interact: false, pulse: false, dash: false, pause: false };
  const shade = nearest(g.shades, P.pos);
  const wantPulse = shade && d2(P.pos, shade.pos) < 2.6 && P.carried >= tuning.pulse_cost && P.pulseCd === 0 && shade.state !== "stunned";
  const toward = (pos) => {
    const dx = pos[0] - P.pos[0];
    const dz = pos[2] - P.pos[2];
    const d = Math.hypot(dx, dz) || 1;
    return [dx / d, dz / d];
  };
  const sameLevel = (o) => Math.abs(o.pos[1] - P.pos[1]) < 1.5;
  const lantern = nearest(g.lanterns, P.pos, (l) => !l.lit);
  const needs = lantern ? tuning.lantern_cost - lantern.deposited : 0;
  const carryingEnough = P.carried >= Math.min(needs, tuning.carry_capacity) && P.carried > 0;
  let target;
  if (carryingEnough && lantern) target = lantern.pos;
  else {
    const m = nearest(g.motes, P.pos, (o) => g.night !== 3 || sameLevel(o) || level(o.pos[1]) === 0) ?? nearest(g.motes, P.pos);
    target = m ? m.pos : lantern?.pos;
  }
  const out = { ...idle, pulse: !!wantPulse && tick % 2 === 0 };
  if (target) {
    const closeToLantern = lantern && target === lantern.pos && d2(P.pos, lantern.pos) <= tuning.interact_radius - 0.5 && Math.abs(P.pos[1] - lantern.pos[1]) < 1.5;
    if (closeToLantern) out.interact = tick % 2 === 0; // tao canh len
    else out.move = toward(waypoint(g, P.pos, target));
  }
  // ne Bong Muc dang duoi: cong vector day ra xa, lao khi bi ap sat
  let rx = 0;
  let rz = 0;
  let closest = Infinity;
  for (const sh of g.shades) {
    if (sh.state !== "chase" && sh.state !== "wander") continue;
    const d = d2(P.pos, sh.pos);
    closest = Math.min(closest, d);
    if (d < 8) {
      const w = ((8 - d) / 8) * 2.5;
      rx += ((P.pos[0] - sh.pos[0]) / (d || 1)) * w;
      rz += ((P.pos[2] - sh.pos[2]) / (d || 1)) * w;
    }
  }
  if (rx || rz) {
    let mx = out.move[0] + rx;
    let mz = out.move[1] + rz;
    const l = Math.hypot(mx, mz) || 1;
    const cand = [mx / l, mz / l];
    // khong de ne Bong Muc day minh ra khoi dao / xuong cau
    const safe = (v) => g.map.ground(P.pos[0] + v[0] * 1.5, P.pos[2] + v[1] * 1.5) != null;
    if (safe(cand)) out.move = cand;
    if (closest < 2.2 && P.dashCd === 0 && tick % 2 === 0) out.dash = true;
  }
  return out;
}

export function playBot(seed, mode = "good", night = 1, scenario = {}) {
  const g = createGame({ seed, tuning, night, scenario });
  const maxTicks = Math.round(nightDuration(tuning, night) * TICKS_PER_SECOND) + 5;
  for (let k = 0; k < maxTicks && g.state === "playing"; k++) {
    step(g, mode === "idle" ? { move: [0, 0], camYawDeg: 0 } : botInput(g, k));
  }
  return { seed, state: g.state, reason: g.result?.reason, ticks: g.tick, score: g.score, flames: g.player.flames, lit: g.lanterns.filter((l) => l.lit).length, total: g.lanterns.length };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const get = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
  const n = Number(get("--seeds", 20));
  const mode = get("--mode", "good");
  const night = Number(get("--night", 1));
  const scenario = args.includes("--calm") ? { random_shades: false, random_drifters: false } : {};
  let wins = 0;
  for (let seed = 1; seed <= n; seed++) {
    const r = playBot(seed, mode, night, scenario);
    if (r.state === "won") wins++;
    console.log(`seed ${String(seed).padStart(3)}: ${r.state.padEnd(4)} ${String(r.reason ?? "").padEnd(9)} ${(r.ticks / 60).toFixed(1).padStart(6)}s  diem ${String(r.score).padStart(5)}  mau ${r.flames}  den ${r.lit}/${r.total}`);
  }
  console.log(`\nDem ${night}, che do ${mode}: thang ${wins}/${n}`);
}
