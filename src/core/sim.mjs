// Loi mo phong Dao Den Long - THUAN va TAT DINH (khong DOM, khong Math.random, khong Date).
// 60 tick/giay co dinh. Dung chung cho che do headless (Test Contract v1.0) va ban choi 3D.
//
// Mo hinh tick (theo contract):
//   - snapshot tick 0 = trang thai sau khi dung scenario, truoc khi ap dung input.
//   - buoc k (k = 0..N-1) doc input cua tick k, tao trang thai k+1; su kien ghi tick = k+1.
import { createRng } from "./rng.mjs";

export const TICKS_PER_SECOND = 60;
const DT = 1 / TICKS_PER_SECOND;

// Hang so the gioi KHONG nam trong tuning (xem docs/notes/assumptions.md).
export const WORLD = {
  island_radius: 80, // fall_enabled=false: nguoi choi bi chan o mep dao
  lantern_ring_radius: 28, // 5 den lon xep vong tron quanh tam
  jump_speed: 7,
  gravity: 20,
  initial_motes: 30,
  max_motes: 30,
  mote_spawn_interval_s: 6,
  mote_field_radius: 50,
  initial_shades: 2,
  max_shades: 6,
  shade_spawn_interval_s: 10,
  shade_spawn_min_dist: 25, // cach nguoi choi toi thieu khi xuat hien
  drop_ring_min: 2.5, // dom dom bi danh roi nam trong vong nay quanh nguoi choi
  drop_ring_max: 4,
};

const r3 = (v) => Math.round(v * 1000) / 1000;
const dist2d = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const ticks = (seconds) => Math.round(seconds * TICKS_PER_SECOND);

export function defaultLanternPositions(count) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const a = (i * 2 * Math.PI) / count; // L1 o phia +Z
    out.push([WORLD.lantern_ring_radius * Math.sin(a), 0, WORLD.lantern_ring_radius * Math.cos(a)]);
  }
  return out;
}

/** Tao tro choi. scenario da duoc kiem tra hop le (xem validateScenario). */
export function createGame({ seed, tuning, scenario = {} }) {
  const rng = createRng(seed);
  const sc = scenario;
  const n = tuning.lantern_count_night1;
  const lanternPos = defaultLanternPositions(n);
  const lanterns = lanternPos.map((pos, i) => ({ id: `L${i + 1}`, pos, lit: false, deposited: 0 }));
  for (const u of sc.lanterns ?? []) {
    const l = lanterns.find((x) => x.id === u.id);
    if (u.pos) l.pos = [...u.pos];
    if (u.deposited !== undefined) l.deposited = u.deposited;
    if (u.lit !== undefined) l.lit = u.lit;
  }

  const g = {
    seed,
    t: tuning,
    rng,
    tick: 0,
    state: "playing",
    score: 0,
    t0: sc.time_left_s ?? tuning.night1_duration_s,
    player: {
      pos: [...(sc.player?.pos ?? [0, 0, 0])],
      vy: 0,
      carried: sc.player?.carried ?? 0,
      flames: sc.player?.flames ?? tuning.flames,
      invuln: 0,
      pulseCd: 0,
    },
    lanterns,
    motes: [],
    shades: [],
    nextMote: 1,
    nextShade: 1,
    randomMotes: sc.random_motes ?? true,
    randomShades: sc.random_shades ?? true,
    moteTimer: 0,
    shadeTimer: 0,
    prev: { jump: false, interact: false, pulse: false },
    result: null,
  };

  if (sc.motes) {
    for (const p of sc.motes) g.motes.push({ id: `M${g.nextMote++}`, pos: [...p] });
  } else if (g.randomMotes) {
    for (let i = 0; i < WORLD.initial_motes; i++) g.motes.push({ id: `M${g.nextMote++}`, pos: randomMotePos(g) });
  }

  if (sc.shades) {
    // id ghi trong scenario duoc giu nguyen; con thieu id thi tu sinh, tranh trung
    const used = new Set(sc.shades.map((s) => s.id).filter(Boolean));
    for (const s of sc.shades) {
      let id = s.id;
      if (!id) {
        while (used.has(`S${g.nextShade}`)) g.nextShade++;
        id = `S${g.nextShade++}`;
        used.add(id);
      }
      g.shades.push(newShade(id, s.pos));
    }
  } else if (g.randomShades) {
    for (let i = 0; i < WORLD.initial_shades; i++) {
      g.shades.push(newShade(`S${g.nextShade++}`, randomShadePos(g)));
    }
  }
  return g;
}

function newShade(id, pos) {
  return { id, pos: [...pos], stun: 0, state: "chase" };
}

function randomMotePos(g) {
  const a = g.rng() * 2 * Math.PI;
  const r = Math.sqrt(g.rng()) * WORLD.mote_field_radius;
  return [r3(r * Math.cos(a)), 0, r3(r * Math.sin(a))];
}

function inSafeZone(g, x, z) {
  for (const l of g.lanterns) {
    if (l.lit && Math.hypot(x - l.pos[0], z - l.pos[2]) < g.t.safe_radius) return l;
  }
  return null;
}

function randomShadePos(g) {
  for (let i = 0; i < 12; i++) {
    const a = g.rng() * 2 * Math.PI;
    const r = 35 + g.rng() * 20;
    const p = [r3(r * Math.cos(a)), 1, r3(r * Math.sin(a))];
    if (!inSafeZone(g, p[0], p[2]) && dist2d(p, g.player.pos) >= WORLD.shade_spawn_min_dist) return p;
  }
  // khong tim duoc cho hop le: de o mep xa nhat so voi nguoi choi
  const a = Math.atan2(-g.player.pos[2], -g.player.pos[0]);
  return [r3(50 * Math.cos(a)), 1, r3(50 * Math.sin(a))];
}

/** Day vi tri (x,z) ra khoi vung an toan cua den da thap (neu dang o ben trong). */
function ejectFromSafe(g, pos) {
  for (const l of g.lanterns) {
    if (!l.lit) continue;
    let dx = pos[0] - l.pos[0];
    let dz = pos[2] - l.pos[2];
    const d = Math.hypot(dx, dz);
    if (d < g.t.safe_radius) {
      if (d < 1e-9) {
        dx = 1;
        dz = 0;
      } else {
        dx /= d;
        dz /= d;
      }
      // +1e-9 de sau khi ep ra, khoang cach van >= safe_radius sau lam tron
      pos[0] = l.pos[0] + dx * (g.t.safe_radius + 1e-9);
      pos[2] = l.pos[2] + dz * (g.t.safe_radius + 1e-9);
    }
  }
}

function clampIsland(pos) {
  const d = Math.hypot(pos[0], pos[2]);
  if (d > WORLD.island_radius) {
    pos[0] = (pos[0] / d) * WORLD.island_radius;
    pos[2] = (pos[2] / d) * WORLD.island_radius;
  }
}

/**
 * Chay MOT buoc mo phong.
 * input: { move:[x,z], camYawDeg, jump, interact, pulse }  (muc, khong phai canh)
 * Tra ve mang su kien cua buoc nay. Neu game da ket thuc: khong lam gi.
 */
export function step(g, input) {
  const events = [];
  if (g.state !== "playing") return events;
  const T = g.t;
  const k = g.tick;
  const emit = (name, data) => events.push({ type: "event", tick: k + 1, name, data });
  const P = g.player;

  const edge = (name) => !!input[name] && !g.prev[name];
  const doJump = edge("jump");
  const doInteract = edge("interact");
  const doPulse = edge("pulse");
  g.prev = { jump: !!input.jump, interact: !!input.interact, pulse: !!input.pulse };

  // 1. bo dem thoi gian
  if (P.invuln > 0) P.invuln--;
  if (P.pulseCd > 0) P.pulseCd--;

  // 2. di chuyen (theo camera), nhay
  let [mx, mz] = input.move ?? [0, 0];
  const len = Math.hypot(mx, mz);
  if (len > 1) {
    mx /= len;
    mz /= len;
  }
  const th = ((input.camYawDeg ?? 0) * Math.PI) / 180;
  const wx = mx * Math.cos(th) + mz * Math.sin(th);
  const wz = -mx * Math.sin(th) + mz * Math.cos(th);
  P.pos[0] += wx * T.player_speed * DT;
  P.pos[2] += wz * T.player_speed * DT;
  if (!T.fall_enabled) clampIsland(P.pos);

  if (doJump && P.pos[1] <= 0) P.vy = WORLD.jump_speed;
  if (P.pos[1] > 0 || P.vy > 0) {
    P.vy -= WORLD.gravity * DT;
    P.pos[1] += P.vy * DT;
    if (P.pos[1] <= 0) {
      P.pos[1] = 0;
      P.vy = 0;
    }
  }

  // 3. nhat dom dom (khoang cach ngang <= pickup_radius, con cho trong gio)
  for (let i = 0; i < g.motes.length && P.carried < T.carry_capacity; ) {
    const m = g.motes[i];
    if (dist2d(P.pos, m.pos) <= T.pickup_radius) {
      g.motes.splice(i, 1);
      P.carried++;
      g.score += T.score.per_mote;
      emit("mote_picked", { carried: P.carried });
    } else i++;
  }

  // 4. tuong tac: nap anh sang vao den chua thap gan nhat trong interact_radius
  if (doInteract && P.carried > 0) {
    let best = null;
    let bestD = Infinity;
    for (const l of g.lanterns) {
      if (l.lit) continue;
      const d = dist2d(P.pos, l.pos);
      if (d <= T.interact_radius && d < bestD) {
        best = l;
        bestD = d;
      }
    }
    if (best) {
      const amount = Math.min(P.carried, Math.max(0, T.lantern_cost - best.deposited));
      if (amount > 0) {
        P.carried -= amount;
        best.deposited += amount;
        emit("deposit", { lantern_id: best.id, amount, deposited: best.deposited });
        if (best.deposited >= T.lantern_cost) {
          best.lit = true;
          g.score += T.score.per_lantern;
          emit("lantern_lit", { lantern_id: best.id });
          // dua Bong Muc dang o trong vung an toan moi ra ngoai
          for (const s of g.shades) ejectFromSafe(g, s.pos);
          if (g.lanterns.every((l) => l.lit)) {
            g.score +=
              Math.floor(Math.max(0, g.t0 - (k + 1) / TICKS_PER_SECOND)) * T.score.per_second_left +
              P.flames * T.score.per_flame_left;
            finish(g, emit, "won", "all_lit");
            g.tick = k + 1;
            return events;
          }
        }
      }
    }
  }

  // 5. toa sang: ton pulse_cost anh sang, lam choang + day lui Bong Muc trong pulse_radius
  if (doPulse && P.pulseCd === 0 && P.carried >= T.pulse_cost) {
    P.carried -= T.pulse_cost;
    P.pulseCd = ticks(T.pulse_cooldown_s);
    const stunned = [];
    for (const s of g.shades) {
      if (dist2d(P.pos, s.pos) <= T.pulse_radius) {
        stunned.push(s.id);
        s.stun = ticks(T.pulse_stun_s);
        s.state = "stunned";
        g.score += T.score.per_stun;
        let dx = s.pos[0] - P.pos[0];
        let dz = s.pos[2] - P.pos[2];
        const d = Math.hypot(dx, dz);
        if (d < 1e-9) {
          dx = 1;
          dz = 0;
        } else {
          dx /= d;
          dz /= d;
        }
        s.pos[0] += dx * T.pulse_push_m;
        s.pos[2] += dz * T.pulse_push_m;
        clampIsland(s.pos);
        ejectFromSafe(g, s.pos);
      }
    }
    emit("pulse", { stunned_ids: stunned });
  }

  // 6. Bong Muc: choang / duoi theo nguoi choi (khong vao vung an toan) / cham thi mat mau
  for (const s of g.shades) {
    if (s.stun > 0) {
      s.stun--;
      s.state = s.stun > 0 ? "stunned" : "chase";
      continue;
    }
    const dx = P.pos[0] - s.pos[0];
    const dz = P.pos[2] - s.pos[2];
    const d = Math.hypot(dx, dz);
    const stepLen = Math.min(T.shade_speed * DT, d);
    if (d > 1e-9) {
      s.pos[0] += (dx / d) * stepLen;
      s.pos[2] += (dz / d) * stepLen;
    }
    ejectFromSafe(g, s.pos);
    if (P.invuln === 0 && dist2d(P.pos, s.pos) <= T.shade_hit_radius) {
      P.flames--;
      const dropped = Math.floor(P.carried * T.hit_drop_ratio);
      P.carried -= dropped;
      for (let i = 0; i < dropped; i++) {
        const a = g.rng() * 2 * Math.PI;
        const r = WORLD.drop_ring_min + g.rng() * (WORLD.drop_ring_max - WORLD.drop_ring_min);
        const p = [P.pos[0] + r * Math.cos(a), 0, P.pos[2] + r * Math.sin(a)];
        clampIsland(p);
        g.motes.push({ id: `M${g.nextMote++}`, pos: p });
      }
      P.invuln = ticks(T.invuln_s);
      emit("player_hit", { by: "shade", flames: P.flames, dropped });
      if (P.flames <= 0) {
        finish(g, emit, "lost", "no_flames");
        g.tick = k + 1;
        return events;
      }
    }
  }

  // 7. sinh them dom dom / Bong Muc (chi khi scenario cho phep)
  if (g.randomMotes && ++g.moteTimer >= ticks(WORLD.mote_spawn_interval_s)) {
    g.moteTimer = 0;
    if (g.motes.length < WORLD.max_motes) g.motes.push({ id: `M${g.nextMote++}`, pos: randomMotePos(g) });
  }
  if (g.randomShades && ++g.shadeTimer >= ticks(WORLD.shade_spawn_interval_s)) {
    g.shadeTimer = 0;
    if (g.shades.length < WORLD.max_shades) {
      const id = `S${g.nextShade++}`;
      g.shades.push(newShade(id, randomShadePos(g)));
      emit("shade_spawned", { id });
    }
  }

  // 8. het dem
  g.tick = k + 1;
  if (g.tick / TICKS_PER_SECOND >= g.t0 - 1e-9) finish(g, emit, "lost", "dawn");
  return events;
}

function finish(g, emit, result, reason) {
  g.state = result;
  g.result = { result, reason };
  emit("game_over", { result, reason });
}

export function timeLeft(g) {
  return Math.max(0, g.t0 - g.tick / TICKS_PER_SECOND);
}

export function snapshot(g) {
  return {
    type: "snapshot",
    tick: g.tick,
    sim_tick: g.tick,
    state: g.state,
    time_left_s: r3(timeLeft(g)),
    score: g.score,
    player: { pos: g.player.pos.map(r3), flames: g.player.flames, carried: g.player.carried },
    lanterns: g.lanterns.map((l) => ({ id: l.id, pos: l.pos.map(r3), lit: l.lit, deposited: l.deposited })),
    shades: g.shades.map((s) => ({ id: s.id, pos: s.pos.map(r3), state: s.state })),
    motes_active: g.motes.length,
    motes: g.motes.map((m) => ({ id: m.id, pos: m.pos.map(r3) })),
  };
}

export function endLine(g) {
  return { type: "end", ticks: g.tick, state: g.state, score: g.score };
}
