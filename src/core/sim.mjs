// Loi mo phong Dao Den Long v1.2 - THUAN va TAT DINH (khong DOM, khong Math.random, khong Date).
// 60 tick/giay. Dung chung cho headless (Test Contract v1.1) va ban choi 3D.
// Thu tu trong mot tick theo Ticket-02: doc input/pause -> bo dem -> di chuyen -> nhat -> tuong tac
//   -> vung an toan -> Toa Sang -> Bong Muc & Gio Lac di chuyen -> cham -> sinh -> thang/thua.
import { createRng } from "./rng.mjs";
import { NIGHTS } from "./maps.mjs";

export const TICKS_PER_SECOND = 60;
const DT = 1 / TICKS_PER_SECOND;

// Hang so the gioi khong nam trong tuning (nguon: Ticket-02 hoac gia dinh, xem docs/notes/assumptions.md)
export const WORLD = {
  gravity: 20,
  jump_speed: 7,
  step_up: 0.35, // do cao toi da leo/bam xuong ma khong tinh la nhay/roi
  fall_y: -10,
  fall_wait: 60,
  respawn_invuln: 90,
  charm_speed: 7.2,
  charm_ticks: 600,
  charm_respawn_ticks: 2700,
  mote_initial: 20,
  mote_cap: 30,
  mote_interval: 240,
  mote_ttl: 480,
  pickup_dy: 1.5,
  drop_ring_min: 1.5,
  drop_ring_max: 2.5,
  pulse_height: 0.8,
  pulse_push_ticks: 15,
  pulse_stun_ticks: 120,
  hit_dy: 1.5,
  recoil_m: 2,
  recoil_ticks: 60,
  evict_ticks: 30,
  shade_first_tick: 300,
  shade_first_count: 2,
  shade_spawn_min_dist: 15,
  shade_detect: 12,
  shade_lose: 18,
  shade_spawning_ticks: 30,
  shade_wander_speed: 2,
  shade_speed_night3: 4.5,
  shade_center_offset: 1,
  drifter_speed: 7,
  drifter_idle_speed: 2,
  drifter_detect: 15,
  drain_range: 2,
  drain_chase: 6,
  drifter_carry_min: 5,
  drifter_touch: 1.2,
  drifter_steal: 3,
  drifter_flee_ticks: 240,
  drifter_drop_flee_ticks: 120,
  drifter_max: 2,
  drifter_interval: 1200,
  drifter_height: 1,
  wind_period: 1800,
  wind_duration: 300,
  wind_warning: 120,
  wind_push: 2,
};

const r3 = (v) => Math.round(v * 1000) / 1000;
const r1 = (v) => Math.round(v * 10) / 10;
// Nhien lieu tinh theo don vi 1/60 (so nguyen) de khong sai so thuc: fuelU = fuel * 60.
const FU = 60;
const isSafe = (g, l) => l.lit && l.fuelU >= g.t.low_fuel_threshold * FU; // Ticket-03: fuel < 30 mat vung an toan, dung 30 van con
const capacity = (g) => Math.min(g.t.capacity_max, g.t.carry_capacity + 2 * g.player.successfulLights);
const d2 = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const d3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const ticks = (seconds) => Math.round(seconds * TICKS_PER_SECOND);
const idNum = (id) => Number(String(id).replace(/\D/g, "")) || 0;
const byId = (a, b) => idNum(a.id) - idNum(b.id) || String(a.id).localeCompare(String(b.id));

const T_FUEL_MAX = (t) => t.fuel_max;

export function nightDuration(tuning, night) {
  return tuning[NIGHTS[night].durationKey];
}

export function lanternIds(night) {
  return NIGHTS[night].lanterns.map(([id]) => id);
}

export function charmIds(night) {
  return NIGHTS[night].charms.map(([id]) => id);
}

// ---------------------------------------------------------------- tao tro choi
export function createGame({ seed, tuning, night = 1, scenario = {} }) {
  const map = NIGHTS[night];
  const rng = createRng(seed);
  const sc = scenario;
  const dur = nightDuration(tuning, night);
  const start = [...(sc.player?.pos ?? map.start)];
  const g = {
    seed,
    t: tuning,
    night,
    map,
    rng,
    tick: 0,
    simTick: 0,
    state: "playing",
    paused: false,
    score: 0,
    t0: sc.time_left_s ?? dur,
    player: {
      pos: start,
      vy: 0,
      vel: [0, 0, 0],
      grounded: false,
      carried: sc.player?.carried ?? 0,
      flames: sc.player?.flames ?? tuning.flames,
      invuln: sc.player?.invuln_ticks ?? 0,
      dashCd: sc.player?.dash_cd_ticks ?? 0,
      dashTicks: 0,
      dashDir: [0, 1],
      pulseCd: sc.player?.pulse_cd_ticks ?? 0,
      charm: sc.player?.charm_ticks ?? 0,
      facing: [0, 1],
      launch: null,
      fallWait: 0,
      successfulLights: sc.player?.successful_lights ?? 0,
    },
    lanterns: map.lanterns.map(([id, pos]) => ({ id, pos: [...pos], lit: false, deposited: 0, fuelU: 0, everLit: false, relit: 0 })),
    motes: [],
    shades: [],
    drifters: [],
    charms: map.charms.map(([id, pos]) => ({ id, pos: [...pos], available: true, respawn: 0 })),
    nextMote: 1,
    nextShade: 1,
    nextDrifter: 1,
    randomMotes: sc.random_motes ?? true,
    randomShades: sc.random_shades ?? true,
    randomDrifters: sc.random_drifters ?? map.drifters,
    wind: { enabled: sc.wind_enabled ?? map.wind, active: false, dir: 0 },
    prev: { jump: false, interact: false, pulse: false, dash: false, pause: false },
    result: null,
  };
  const P = g.player;
  const h0 = map.ground(P.pos[0], P.pos[2]);
  P.grounded = h0 != null && P.pos[1] <= h0 + 1e-6;

  for (const u of sc.lanterns ?? []) {
    const l = g.lanterns.find((x) => x.id === u.id);
    if (u.pos) l.pos = [...u.pos];
    if (u.deposited !== undefined) l.deposited = u.deposited;
    if (u.lit !== undefined) l.lit = u.lit;
    else if (u.fuel !== undefined && u.fuel > 0) l.lit = true;
    if (l.lit) {
      l.fuelU = Math.round((u.fuel ?? T_FUEL_MAX(tuning)) * FU); // den dat lit:true ma khong co fuel -> 100
      l.everLit = true;
    }
    if (u.ever_lit !== undefined && !l.lit) l.everLit = u.ever_lit;
    if (u.relit_count !== undefined) l.relit = u.relit_count;
  }
  if (sc.charms) {
    g.charms = sc.charms.map((c) => ({
      id: c.id,
      pos: [...c.pos],
      available: c.available ?? true,
      respawn: c.respawn_ticks ?? 0,
    }));
  }

  // ---- dom dom
  if (sc.motes) {
    for (const m of sc.motes) {
      const o = Array.isArray(m) ? { pos: m } : m;
      g.motes.push({ id: `M${g.nextMote++}`, pos: [...o.pos], kind: o.kind ?? "random", ttl: o.ttl_ticks ?? null, idx: null });
    }
  } else if (g.randomMotes) {
    const n = map.moteSpawn.length;
    const idxs = Array.from({ length: n }, (_, i) => i);
    for (let i = 0; i < WORLD.mote_initial; i++) {
      const j = i + Math.floor(rng() * (n - i));
      [idxs[i], idxs[j]] = [idxs[j], idxs[i]];
      g.motes.push({ id: `M${g.nextMote++}`, pos: [...map.moteSpawn[idxs[i]]], kind: "random", ttl: null, idx: idxs[i] });
    }
  }

  // ---- Bong Muc khai bao trong scenario (thay danh sach ban dau)
  if (sc.shades) {
    const used = new Set(sc.shades.map((s) => s.id).filter(Boolean));
    for (const s of sc.shades) {
      let id = s.id;
      if (!id) {
        while (used.has(`S${g.nextShade}`)) g.nextShade++;
        id = `S${g.nextShade++}`;
        used.add(id);
      }
      {
        const sh = makeShade(g, id, s.pos, s.state ?? "wander", s.state_ticks_left);
        if (sh.state === "drain") {
          const tl = s.target_lantern_id ? g.lanterns.find((x) => x.id === s.target_lantern_id) : g.lanterns.filter((x) => x.lit && d2(sh.pos, x.pos) <= 2 + 1e-9).sort((a, b) => d2(sh.pos, a.pos) - d2(sh.pos, b.pos))[0];
          sh.target = tl?.id ?? null;
          if (!sh.target) sh.state = "wander";
        }
        g.shades.push(sh);
      }
    }
    g.nextShade = Math.max(g.nextShade, ...g.shades.map((s) => idNum(s.id) + 1), 1);
  }
  if (sc.drifters) {
    for (const d of sc.drifters) {
      g.drifters.push({
        id: d.id ?? `D${g.nextDrifter++}`,
        pos: [...d.pos],
        state: d.state ?? "idle",
        stolen: d.stolen ?? 0,
        ticks: d.state_ticks_left ?? (d.state === "flee" ? WORLD.drifter_flee_ticks : 0),
        heading: 0,
        ht: 0,
      });
    }
    g.nextDrifter = Math.max(g.nextDrifter, ...g.drifters.map((d) => idNum(d.id) + 1), 1);
  }
  return g;
}

function defaultStateTicks(state) {
  return { spawning: WORLD.shade_spawning_ticks, stunned: WORLD.pulse_stun_ticks, recoil: WORLD.recoil_ticks }[state] ?? 0;
}

function makeShade(g, id, pos, state, stateTicks) {
  const gy = g.map.ground(pos[0], pos[2]) ?? 0;
  return {
    id,
    pos: [...pos],
    gy,
    off: pos[1] - gy,
    state,
    ticks: stateTicks ?? defaultStateTicks(state),
    push: state === "stunned" ? 0 : 0,
    pushDir: [1, 0],
    heading: 0,
    ht: 0,
    evict: false,
    target: null,
    drainTicks: 0,
  };
}

// ---------------------------------------------------------------- tien ich vat ly
function inTower(map, x, z) {
  return map.tower && Math.hypot(x, z) < map.tower.r - 1e-9;
}

/** Cho phep di toi (x,z) khong? Chan: thap chuong, vach dung cao hon y + maxUp. Hu khong (null) thi cho di (roi). */
function okPlayerMove(map, x, z, y, maxUp) {
  if (inTower(map, x, z) && y < map.tower.top - 0.01) return false;
  const h = map.ground(x, z);
  if (h == null) return true;
  return h <= y + maxUp;
}

function tryMovePlayer(map, pos, dx, dz) {
  const y = pos[1];
  const up = WORLD.step_up;
  if (okPlayerMove(map, pos[0] + dx, pos[2] + dz, y, up)) {
    pos[0] += dx;
    pos[2] += dz;
  } else if (dx !== 0 && okPlayerMove(map, pos[0] + dx, pos[2], y, up)) pos[0] += dx;
  else if (dz !== 0 && okPlayerMove(map, pos[0], pos[2] + dz, y, up)) pos[2] += dz;
}

function okShadeMove(map, x, z, gy) {
  if (inTower(map, x, z)) return false;
  const h = map.ground(x, z);
  return h != null && Math.abs(h - gy) <= WORLD.step_up;
}

/** Di chuyen Bong Muc theo (dx,dz); tra true neu di duoc. Cap nhat gy va y. */
function tryMoveShade(g, s, dx, dz) {
  const m = g.map;
  const cand = [[dx, dz]];
  if (dx !== 0) cand.push([dx, 0]);
  if (dz !== 0) cand.push([0, dz]);
  for (const [ax, az] of cand) {
    const nx = s.pos[0] + ax;
    const nz = s.pos[2] + az;
    if (okShadeMove(m, nx, nz, s.gy)) {
      s.pos[0] = nx;
      s.pos[2] = nz;
      s.gy = m.ground(nx, nz);
      s.pos[1] = s.gy + s.off;
      return true;
    }
  }
  return false;
}

/** Day vi tri (x,z) ra mep vung an toan cua moi den da thap (neu dang o ben trong). */
function projectOutSafe(g, pos) {
  for (const l of g.lanterns) {
    if (!isSafe(g, l)) continue;
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
      pos[0] = l.pos[0] + dx * (g.t.safe_radius + 1e-9);
      pos[2] = l.pos[2] + dz * (g.t.safe_radius + 1e-9);
    }
  }
}

function inSafe(g, x, z) {
  return g.lanterns.some((l) => isSafe(g, l) && Math.hypot(x - l.pos[0], z - l.pos[2]) < g.t.safe_radius);
}

function awayDir(from, to) {
  const dx = to[0] - from[0];
  const dz = to[2] - from[2];
  const d = Math.hypot(dx, dz);
  return d < 1e-9 ? [1, 0] : [dx / d, dz / d];
}

function dropMotes(g, count, x, z, y) {
  for (let i = 0; i < count; i++) {
    let p = null;
    for (let tries = 0; tries < 8 && !p; tries++) {
      const a = g.rng() * 2 * Math.PI;
      const r = WORLD.drop_ring_min + g.rng() * (WORLD.drop_ring_max - WORLD.drop_ring_min);
      const px = x + r * Math.cos(a);
      const pz = z + r * Math.sin(a);
      const h = g.map.ground(px, pz);
      if (h != null && Math.abs(h - y) <= WORLD.pickup_dy && !inTower(g.map, px, pz)) p = [px, h, pz];
    }
    g.motes.push({ id: `M${g.nextMote++}`, pos: p ?? [x, y, z], kind: "dropped", ttl: WORLD.mote_ttl, idx: null });
  }
}

function lose(g, emit, reason) {
  g.state = "lost";
  g.result = { result: "lost", reason };
  emit("game_over", { result: "lost", reason });
}

// ---------------------------------------------------------------- mot tick
/**
 * input: { move:[x,z], camYawDeg, jump, interact, pulse, dash, pause }  (muc; canh len tinh ben trong)
 * Tra ve mang su kien. Neu game da ket thuc: khong lam gi.
 */
export function step(g, input) {
  const events = [];
  if (g.state === "won" || g.state === "lost") return events;
  const T = g.t;
  const W = WORLD;
  const P = g.player;
  const map = g.map;

  const lvl = {
    jump: !!input.jump,
    interact: !!input.interact,
    pulse: !!input.pulse,
    dash: !!input.dash,
    pause: !!input.pause,
  };
  const edge = (n) => lvl[n] && !g.prev[n];
  const eJump = edge("jump");
  const eInteract = edge("interact");
  const ePulse = edge("pulse");
  const eDash = edge("dash");
  const ePause = edge("pause");
  g.prev = lvl;
  g.tick++;
  const emit = (name, data) => events.push({ type: "event", tick: g.tick, name, data });

  // 1. pause
  if (ePause) {
    if (!g.paused) {
      g.paused = true;
      emit("paused", {});
      return events;
    }
    g.paused = false;
    emit("resumed", {});
  }
  if (g.paused) return events;
  const s0 = g.simTick; // so buoc gameplay da chay truoc buoc nay
  g.simTick = s0 + 1;

  // 2. bo dem
  if (P.invuln > 0) P.invuln--;
  if (P.dashCd > 0) P.dashCd--;
  if (P.pulseCd > 0) P.pulseCd--;
  if (P.charm > 0) P.charm--;
  for (let i = g.motes.length - 1; i >= 0; i--) {
    const m = g.motes[i];
    if (m.kind === "dropped" && --m.ttl <= 0) g.motes.splice(i, 1);
  }
  for (const s of g.shades) {
    if (s.state === "spawning" || s.state === "stunned" || s.state === "recoil") {
      if (--s.ticks <= 0) {
        s.state = "wander";
        s.ticks = 0;
        s.push = 0;
      }
    }
  }
  for (const c of g.charms) if (!c.available && --c.respawn <= 0) (c.available = true), (c.respawn = 0);
  // nhien lieu: hao 1/s + bi hut 5/s moi Bong Muc dang drain (cong don); sau do den het dau thi tat
  {
    const drainers = new Map();
    for (const sh of g.shades) if (sh.state === "drain" && sh.target) drainers.set(sh.target, [...(drainers.get(sh.target) ?? []), sh]);
    for (const l of g.lanterns) {
      if (!l.lit) continue;
      const hit = drainers.get(l.id) ?? [];
      l.fuelU -= T.fuel_decay_per_s + T.drain_per_s * hit.length;
      for (const sh of [...hit].sort(byId)) {
        sh.drainTicks++;
        if (sh.drainTicks % TICKS_PER_SECOND === 0) emit("fuel_drain", { lantern_id: l.id, shade_id: sh.id, fuel: r1(Math.max(0, l.fuelU) / FU) });
      }
    }
    for (const l of g.lanterns) {
      if (l.lit && l.fuelU <= 0) {
        l.lit = false;
        l.fuelU = 0;
        l.deposited = 0;
        emit("lantern_out", { lantern_id: l.id });
      }
    }
  }
  // gio
  if (g.wind.enabled) {
    const ph = s0 % W.wind_period;
    g.wind.active = s0 >= W.wind_period && ph < W.wind_duration;
    if (s0 >= W.wind_period - W.wind_warning && ph === W.wind_period - W.wind_warning) g.wind.dir = Math.floor(g.rng() * 360);
    if (s0 < W.wind_period - W.wind_warning && s0 === 0) g.wind.dir = 0;
  }
  if (P.fallWait > 0 && --P.fallWait === 0) {
    P.pos = [...map.start];
    P.vel = [0, 0, 0];
    P.vy = 0;
    P.grounded = true;
    P.invuln = W.respawn_invuln;
    P.facing = [0, 1];
  }
  const frozen = P.fallWait > 0;

  // 3. di chuyen Mây
  if (!frozen) {
    const speed = P.charm > 0 ? W.charm_speed : T.player_speed;
    let [mx, mz] = input.move ?? [0, 0];
    const len = Math.hypot(mx, mz);
    if (len > 1) {
      mx /= len;
      mz /= len;
    }
    const th = ((input.camYawDeg ?? 0) * Math.PI) / 180;
    const wx = mx * Math.cos(th) + mz * Math.sin(th);
    const wz = -mx * Math.sin(th) + mz * Math.cos(th);
    const wl = Math.hypot(wx, wz);
    if (wl > 1e-9) P.facing = [wx / wl, wz / wl];

    if (eDash && P.dashTicks === 0 && P.dashCd === 0) {
      P.dashTicks = ticks(T.dash_duration_s);
      P.dashDir = wl > 1e-9 ? [wx / wl, wz / wl] : [...P.facing];
      P.dashCd = P.charm > 0 ? 0 : ticks(T.dash_cooldown_s);
      emit("dash", {});
    }
    if (eJump && P.grounded && P.dashTicks === 0 && !P.launch) {
      P.vy = W.jump_speed;
      P.grounded = false;
    }
    // bục nhảy
    if (!P.launch && P.vy <= 0 && P.fallWait === 0) {
      for (const pad of map.pads) {
        const dy = P.pos[1] - pad.pos[1];
        if (d2(P.pos, pad.pos) <= pad.radius && dy >= -0.5 && dy <= 0.25) {
          const dir = pad.dir ?? awayDir(P.pos, pad.target);
          P.launch = [dir[0] * pad.hspeed, dir[1] * pad.hspeed];
          P.vy = pad.vy;
          P.grounded = false;
          break;
        }
      }
    }
    let vx;
    let vz;
    if (P.dashTicks > 0) {
      vx = P.dashDir[0] * T.dash_speed;
      vz = P.dashDir[1] * T.dash_speed;
    } else if (P.launch) {
      [vx, vz] = P.launch;
    } else {
      vx = wx * speed;
      vz = wz * speed;
    }
    P.vel[0] = vx;
    P.vel[2] = vz;
    tryMovePlayer(map, P.pos, vx * DT, vz * DT);
    if (g.wind.active) {
      const a = (g.wind.dir * Math.PI) / 180;
      tryMovePlayer(map, P.pos, Math.cos(a) * W.wind_push * DT, Math.sin(a) * W.wind_push * DT);
    }
    // doc
    if (P.dashTicks > 0) {
      if (P.grounded) {
        const h = map.ground(P.pos[0], P.pos[2]);
        if (h != null && h >= P.pos[1] - W.step_up) P.pos[1] = h;
        else P.grounded = false;
      }
      P.vel[1] = 0;
      P.dashTicks--;
    } else {
      if (P.grounded) {
        const h = map.ground(P.pos[0], P.pos[2]);
        if (h != null && h >= P.pos[1] - W.step_up && h <= P.pos[1] + W.step_up) P.pos[1] = h;
        else P.grounded = false;
      }
      if (!P.grounded || P.vy > 0) {
        P.vy -= W.gravity * DT;
        P.pos[1] += P.vy * DT;
        const h = map.ground(P.pos[0], P.pos[2]);
        if (h != null && P.pos[1] <= h && P.vy <= 0) {
          P.pos[1] = h;
          P.vy = 0;
          P.grounded = true;
          P.launch = null;
        } else P.grounded = false;
      } else P.vy = 0;
      P.vel[1] = P.grounded ? 0 : P.vy;
    }
    // roi khoi dao
    if (P.pos[1] < W.fall_y) {
      const lost = P.carried;
      P.flames--;
      P.carried = 0;
      P.fallWait = W.fall_wait;
      P.vel = [0, 0, 0];
      P.vy = 0;
      P.launch = null;
      P.dashTicks = 0;
      emit("player_hit", { by: "fall", flames: P.flames, dropped: 0, lost });
    }
  }

  // 4. nhat dom dom va bua
  if (!frozen && P.fallWait === 0) {
    for (let i = 0; i < g.motes.length && P.carried < capacity(g); ) {
      const m = g.motes[i];
      if (d2(P.pos, m.pos) <= T.pickup_radius && Math.abs(P.pos[1] - m.pos[1]) <= W.pickup_dy) {
        g.motes.splice(i, 1);
        P.carried++;
        emit("mote_picked", { carried: P.carried });
      } else i++;
    }
    for (const c of g.charms) {
      if (c.available && d2(P.pos, c.pos) <= T.pickup_radius && Math.abs(P.pos[1] - c.pos[1]) <= W.pickup_dy) {
        c.available = false;
        c.respawn = W.charm_respawn_ticks;
        P.charm = W.charm_ticks;
        emit("charm_picked", { charm_id: c.id, charm_ticks: P.charm });
      }
    }
  }

  // 5. tuong tac voi den: thap (10 hoac 5 neu thap lai) hoac cham dau (den dang sang chua day)
  const litNow = [];
  const fuelMaxU = T.fuel_max * FU;
  if (!frozen && eInteract && P.carried > 0) {
    let best = null;
    let bestD = Infinity;
    for (const l of g.lanterns) {
      if (l.lit && l.fuelU >= fuelMaxU) continue; // den day dau khong duoc chon
      const d = d2(P.pos, l.pos);
      if (d <= T.interact_radius && (d < bestD - 1e-12 || (Math.abs(d - bestD) <= 1e-12 && idNum(l.id) < idNum(best.id)))) {
        best = l;
        bestD = d;
      }
    }
    if (best && !best.lit) {
      const cost = best.everLit ? T.relight_cost : T.lantern_cost;
      const amount = Math.min(P.carried, Math.max(0, cost - best.deposited));
      if (amount > 0) {
        P.carried -= amount;
        best.deposited += amount;
        g.score += amount * T.score.per_mote;
        emit("deposit", { lantern_id: best.id, amount, deposited: best.deposited });
        if (best.deposited >= cost) {
          const relight = best.everLit;
          best.lit = true;
          best.fuelU = fuelMaxU;
          best.everLit = true;
          if (relight) best.relit++;
          P.successfulLights++;
          g.score += relight ? T.score.per_relight : T.score.per_lantern;
          litNow.push(best);
          emit("lantern_lit", { lantern_id: best.id, relight });
        }
      }
    } else if (best) {
      const perMoteU = T.fuel_per_mote * FU;
      const used = Math.min(P.carried, Math.ceil((fuelMaxU - best.fuelU) / perMoteU - 1e-9));
      if (used > 0) {
        const before = best.fuelU;
        P.carried -= used;
        best.fuelU = Math.min(fuelMaxU, best.fuelU + perMoteU * used);
        g.score += used * T.score.per_mote;
        emit("refuel", { lantern_id: best.id, amount: used, fuel: r1(best.fuelU / FU) });
        const lowU = T.low_fuel_threshold * FU;
        if (before < lowU && best.fuelU >= lowU) litNow.push(best); // vung an toan hoi lai: day Bong Muc ra
      }
    }
  }

  // 6. vung an toan: Bong Muc dang o trong vung khi den vua thap / duoc cham dau len >= 30 bi day ra mep (toi da 30 tick, khong sat thuong)
  for (const l of litNow) {
    for (const s of g.shades) {
      if (Math.hypot(s.pos[0] - l.pos[0], s.pos[2] - l.pos[2]) < T.safe_radius) s.evict = true;
    }
  }

  // 7. Toa Sang
  if (!frozen && ePulse && P.carried >= T.pulse_cost && P.pulseCd === 0) {
    P.carried -= T.pulse_cost;
    P.pulseCd = ticks(T.pulse_cooldown_s);
    const center = [P.pos[0], P.pos[1] + W.pulse_height, P.pos[2]];
    const stunned = [];
    for (const s of g.shades) {
      if (d3(center, s.pos) <= T.pulse_radius) {
        stunned.push(s.id);
        g.score += s.state === "drain" ? T.score.per_stun_drain : T.score.per_stun; // tong +5, hoac +15 neu ngay truoc do dang drain
        s.state = "stunned";
        s.target = null;
        s.ticks = W.pulse_stun_ticks;
        s.push = W.pulse_push_ticks;
        s.pushDir = awayDir(center, s.pos);
        s.evict = false;
      }
    }
    emit("pulse", { stunned_ids: stunned });
    for (const d of g.drifters) {
      if (d3(center, d.pos) > T.pulse_radius) continue;
      if (d.state === "chase") {
        d.state = "flee";
        d.ticks = W.drifter_flee_ticks;
      } else if (d.state === "flee" && d.stolen > 0) {
        const amount = d.stolen;
        d.stolen = 0;
        d.ticks = W.drifter_drop_flee_ticks;
        const gy = map.ground(d.pos[0], d.pos[2]) ?? 0;
        for (let i = 0; i < amount; i++) g.motes.push({ id: `M${g.nextMote++}`, pos: [d.pos[0], gy, d.pos[2]], kind: "dropped", ttl: W.mote_ttl, idx: null });
        emit("drifter_drop", { drifter_id: d.id, amount });
      }
    }
  }

  // 8. Bong Muc va Gio Lac di chuyen
  const shadeSpeed = g.night === 3 ? W.shade_speed_night3 : T.shade_speed;
  for (const s of g.shades) {
    if (s.evict) {
      let near = null;
      let nd = Infinity;
      for (const l of g.lanterns) {
        if (!isSafe(g, l)) continue;
        const d = Math.hypot(s.pos[0] - l.pos[0], s.pos[2] - l.pos[2]);
        if (d < T.safe_radius && d < nd) (near = l), (nd = d);
      }
      if (s.state === "drain") (s.state = "wander"), (s.target = null);
      if (!near) s.evict = false;
      else {
        const dir = awayDir(near.pos, s.pos);
        const stepLen = Math.min(T.safe_radius / W.evict_ticks, T.safe_radius - nd + 1e-9);
        s.pos[0] += dir[0] * stepLen;
        s.pos[2] += dir[1] * stepLen;
        const nd2 = Math.hypot(s.pos[0] - near.pos[0], s.pos[2] - near.pos[2]);
        if (nd2 >= T.safe_radius) s.evict = false;
        s.gy = map.ground(s.pos[0], s.pos[2]) ?? s.gy;
        s.pos[1] = s.gy + s.off;
      }
      continue;
    }
    if (s.state === "stunned") {
      if (s.push > 0) {
        s.push--;
        const stepLen = T.pulse_push_m / W.pulse_push_ticks;
        if (!tryMoveShade(g, s, s.pushDir[0] * stepLen, s.pushDir[1] * stepLen)) s.push = 0;
        projectOutSafe(g, s.pos);
      }
    } else if (s.state === "recoil") {
      const stepLen = W.recoil_m / W.recoil_ticks;
      tryMoveShade(g, s, s.pushDir[0] * stepLen, s.pushDir[1] * stepLen);
      projectOutSafe(g, s.pos);
    } else if (s.state === "drain" || s.state === "wander" || s.state === "chase") {
      const dist = d2(P.pos, s.pos);
      if (s.state === "drain") {
        const tl = g.lanterns.find((l) => l.id === s.target);
        if (!tl || !tl.lit || tl.fuelU >= T.low_fuel_threshold * FU || d2(s.pos, tl.pos) > W.drain_range + 1e-9) (s.state = "wander"), (s.target = null);
        else if (dist <= W.drain_chase) (s.state = "chase"), (s.target = null);
      }
      if (s.state === "wander" && dist <= W.shade_detect) s.state = "chase";
      else if (s.state === "chase" && dist > W.shade_lose) s.state = "wander";
      if (s.state === "chase") {
        const dir = awayDir(s.pos, P.pos);
        const stepLen = Math.min(shadeSpeed * DT, dist);
        tryMoveShade(g, s, dir[0] * stepLen, dir[1] * stepLen);
      } else if (s.state === "wander") {
        // Ticket-03: chi Bong Muc wander moi chon den yeu (sang, fuel < 30) gan nhat, bang nhau thi id nho hon.
        // Khong co den yeu -> "nhu truoc" (Phase 2): di lang thang theo huong ngau nhien tu RNG (gia dinh P3-3).
        const weak = g.lanterns.filter((l) => l.lit && l.fuelU < T.low_fuel_threshold * FU).sort((a, b) => d2(s.pos, a.pos) - d2(s.pos, b.pos) || idNum(a.id) - idNum(b.id))[0];
        if (weak) {
          const dl = d2(s.pos, weak.pos);
          if (dl > W.drain_range) {
            const dir = awayDir(s.pos, weak.pos);
            const stepLen = Math.min(W.shade_wander_speed * DT, dl - W.drain_range);
            tryMoveShade(g, s, dir[0] * stepLen, dir[1] * stepLen);
          }
          if (d2(s.pos, weak.pos) <= W.drain_range + 1e-9) {
            s.state = "drain";
            s.target = weak.id;
            s.drainTicks = 0;
          }
        } else {
          if (s.ht <= 0) {
            s.heading = g.rng() * 2 * Math.PI;
            s.ht = 120;
          }
          s.ht--;
          const stepLen = W.shade_wander_speed * DT;
          if (!tryMoveShade(g, s, Math.cos(s.heading) * stepLen, Math.sin(s.heading) * stepLen)) s.ht = 0;
        }
      }
      if (s.state !== "drain") projectOutSafe(g, s.pos);
    }
  }
  for (let i = g.drifters.length - 1; i >= 0; i--) {
    const d = g.drifters[i];
    const dist = d2(P.pos, d.pos);
    if (d.state === "idle" || d.state === "chase") d.state = P.carried >= W.drifter_carry_min && dist <= W.drifter_detect ? "chase" : "idle";
    if (d.state === "chase") {
      const dir = awayDir(d.pos, P.pos);
      const stepLen = Math.min(W.drifter_speed * DT, dist);
      d.pos[0] += dir[0] * stepLen;
      d.pos[2] += dir[1] * stepLen;
    } else if (d.state === "flee") {
      const dir = awayDir(P.pos, d.pos);
      d.pos[0] += dir[0] * W.drifter_speed * DT;
      d.pos[2] += dir[1] * W.drifter_speed * DT;
      if (--d.ticks <= 0) g.drifters.splice(i, 1);
    } else {
      if (d.ht <= 0) {
        d.heading = g.rng() * 2 * Math.PI;
        d.ht = 120;
      }
      d.ht--;
      d.pos[0] += Math.cos(d.heading) * W.drifter_idle_speed * DT;
      d.pos[2] += Math.sin(d.heading) * W.drifter_idle_speed * DT;
    }
  }

  // 9. cham: Gio Lac cuop truoc, roi Bong Muc gay hit (xet theo id tang dan)
  if (!frozen) {
    for (const d of [...g.drifters].sort(byId)) {
      if (d.state === "chase" && P.carried > 0 && d2(P.pos, d.pos) <= W.drifter_touch) {
        const amount = Math.min(W.drifter_steal, P.carried);
        P.carried -= amount;
        d.stolen = amount;
        d.state = "flee";
        d.ticks = W.drifter_flee_ticks;
        emit("drifter_steal", { drifter_id: d.id, amount, carried: P.carried });
      }
    }
    for (const s of [...g.shades].sort(byId)) {
      if (s.evict || (s.state !== "wander" && s.state !== "chase")) continue;
      if (d2(P.pos, s.pos) > T.shade_hit_radius || Math.abs(P.pos[1] - s.pos[1]) > W.hit_dy) continue;
      if (P.invuln > 0) continue;
      P.flames--;
      const dropped = Math.floor(P.carried * T.hit_drop_ratio);
      P.carried -= dropped;
      dropMotes(g, dropped, P.pos[0], P.pos[2], P.pos[1]);
      P.invuln = ticks(T.invuln_s);
      s.state = "recoil";
      s.ticks = W.recoil_ticks;
      s.pushDir = awayDir(P.pos, s.pos);
      emit("player_hit", { by: "shade", flames: P.flames, dropped });
    }
  }

  // 10. sinh theo lich (thuc the moi chi tuong tac tu tick sau)
  const now = g.simTick;
  if (g.randomMotes && now % W.mote_interval === 0 && g.motes.length < W.mote_cap) {
    const used = new Set(g.motes.map((m) => m.idx).filter((x) => x != null));
    const free = map.moteSpawn.map((_, i) => i).filter((i) => !used.has(i));
    if (free.length) {
      const idx = free[Math.floor(g.rng() * free.length)];
      g.motes.push({ id: `M${g.nextMote++}`, pos: [...map.moteSpawn[idx]], kind: "random", ttl: null, idx });
    }
  }
  if (g.randomShades) {
    const due = now === W.shade_first_tick ? W.shade_first_count : now > W.shade_first_tick && (now - W.shade_first_tick) % map.shadeInterval === 0 ? 1 : 0;
    for (let i = 0; i < due; i++) {
      if (g.shades.length >= map.shadeMax) break;
      const valid = map.shadeSpawn.filter((p) => d2(p, P.pos) >= W.shade_spawn_min_dist && !inSafe(g, p[0], p[2]));
      if (!valid.length) break;
      const p = valid[Math.floor(g.rng() * valid.length)];
      const id = `S${g.nextShade++}`;
      const gy = map.ground(p[0], p[2]) ?? 0;
      g.shades.push(makeShade(g, id, [p[0], gy + W.shade_center_offset, p[2]], "spawning"));
      emit("shade_spawned", { id });
    }
  }
  if (g.randomDrifters && map.drifters && now % W.drifter_interval === 0 && g.drifters.length < W.drifter_max) {
    const p = map.shadeSpawn[Math.floor(g.rng() * map.shadeSpawn.length)];
    const gy = map.ground(p[0], p[2]) ?? 0;
    g.drifters.push({ id: `D${g.nextDrifter++}`, pos: [p[0], gy + W.drifter_height, p[2]], state: "idle", stolen: 0, ticks: 0, heading: g.rng() * 2 * Math.PI, ht: 120 });
  }

  // 11. thang / thua (Ticket-03): khong con thang som. Het Ngon Lua luon thua truoc; song toi binh minh voi du den sang thi thang
  if (P.flames <= 0) lose(g, emit, "no_flames");
  else if (g.simTick / TICKS_PER_SECOND >= g.t0 - 1e-9) {
    const litList = g.lanterns.filter((l) => l.lit);
    const need = Math.ceil(T.win_ratio * g.lanterns.length - 1e-9);
    if (litList.length >= need) {
      g.state = "won";
      g.result = { result: "won", reason: "dawn_survived" };
      for (const l of litList) g.score += T.score.per_dawn_lantern + Math.floor(l.fuelU / FU + 1e-9);
      g.score += P.flames * T.score.per_flame_left;
      emit("game_over", { result: "won", reason: "dawn_survived" });
    } else lose(g, emit, "dawn");
  }
  return events;
}

// ---------------------------------------------------------------- doc trang thai
export function timeLeft(g) {
  return Math.max(0, g.t0 - g.simTick / TICKS_PER_SECOND);
}

const sec = (t) => r3(t / TICKS_PER_SECOND);

export function snapshot(g) {
  const P = g.player;
  return {
    type: "snapshot",
    tick: g.tick,
    sim_tick: g.simTick,
    night: g.night,
    state: g.paused ? "paused" : g.state,
    time_left_s: r3(timeLeft(g)),
    score: g.score,
    wind: { active: g.wind.active, dir_deg: g.wind.dir },
    player: {
      pos: P.pos.map(r3),
      vel: P.vel.map(r3),
      grounded: P.grounded,
      flames: P.flames,
      carried: P.carried,
      capacity: capacity(g),
      invuln: sec(P.invuln),
      dash_cd_s: sec(P.dashCd),
      pulse_cd_s: sec(P.pulseCd),
      charm_s: sec(P.charm),
    },
    lanterns: g.lanterns.map((l) => ({ id: l.id, pos: l.pos.map(r3), lit: l.lit, deposited: l.deposited, fuel: l.lit ? r1(l.fuelU / FU) : 0, ever_lit: l.everLit, relit_count: l.relit })),
    shades: g.shades.map((s) => ({ id: s.id, pos: s.pos.map(r3), state: s.state, state_ticks_left: s.ticks })),
    motes_active: g.motes.length,
    motes: g.motes.map((m) => ({ id: m.id, pos: m.pos.map(r3), kind: m.kind, ttl_s: m.ttl == null ? null : sec(m.ttl) })),
    drifters: g.drifters.map((d) => ({ id: d.id, pos: d.pos.map(r3), state: d.state, stolen: d.stolen })),
    charms: g.charms.map((c) => ({ id: c.id, available: c.available, respawn_s: sec(c.respawn) })),
  };
}

export function endLine(g) {
  return { type: "end", ticks: g.tick, state: g.state, score: g.score };
}
