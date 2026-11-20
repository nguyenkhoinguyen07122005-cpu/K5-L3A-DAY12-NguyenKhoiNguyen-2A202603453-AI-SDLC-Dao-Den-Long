// Test cho cac tinh nang MOI cua Test Contract v1.1 (Ticket-02): moi tinh nang co it nhat 1 kich ban headless.
// Moi test ghi ma tieu chi chap nhan (AC-xx) trong docs/spec/phase-2.md.
import { test } from "node:test";
import assert from "node:assert/strict";
import { run, empty, T, near } from "./helpers.mjs";

const S = T.score;
const at = (r, tick) => r.snaps.find((s) => s.tick === tick);
const evs = (r, name) => r.events.filter((e) => e.name === name);

// ---------- Hop dong / so chuan ----------
test("[AC-01] so chuan Ticket-02 + khoa moi cua contract v1.1", () => {
  const exp = { player_speed: 6, carry_capacity: 10, lantern_cost: 10, pickup_radius: 1, interact_radius: 2, pulse_cost: 3, pulse_radius: 5, night1_duration_s: 300, night2_duration_s: 330, night3_duration_s: 360, flames: 3, invuln_s: 1.5, hit_drop_ratio: 0.5, pulse_stun_s: 2, pulse_push_m: 4, pulse_cooldown_s: 3, safe_radius: 6, shade_speed: 4, shade_hit_radius: 1, fall_enabled: true, dash_speed: 14, dash_duration_s: 0.2, dash_cooldown_s: 1.5 };
  for (const [k, v] of Object.entries(exp)) assert.equal(T[k], v, `tuning.${k}`);
  assert.deepEqual(T.score, { per_mote: 10, per_lantern: 100, per_stun: 5, per_second_left: 2, per_flame_left: 50 });
});

test("[AC-02] --night 1|2|3: night_start, so den (5/6/7), thoi luong (300/330/360), truong snapshot v1.1", () => {
  const want = { 1: [5, 300], 2: [6, 330], 3: [7, 360] };
  for (const n of [1, 2, 3]) {
    const r = run({ night: n, ticks: 0, scenario: empty() });
    assert.equal(r.status, 0);
    assert.deepEqual(r.lines[1], { type: "event", tick: 0, name: "night_start", data: { night: n } });
    const s = r.snaps[0];
    assert.equal(s.night, n);
    assert.equal(s.lanterns.length, want[n][0]);
    assert.equal(s.time_left_s, want[n][1]);
    assert.deepEqual(Object.keys(s.player).sort(), ["carried", "charm_s", "dash_cd_s", "flames", "grounded", "invuln", "pos", "pulse_cd_s", "vel"]);
    assert.deepEqual(s.wind, { active: false, dir_deg: 0 });
    for (const k of ["motes", "drifters", "charms"]) assert.ok(Array.isArray(s[k]), k);
  }
});

test("[AC-03] ban do chuan: toa do den Dem 1/2/3 dung bang Ticket-02", () => {
  const pos = (n) => Object.fromEntries(run({ night: n, ticks: 0, scenario: empty() }).snaps[0].lanterns.map((l) => [l.id, l.pos]));
  assert.deepEqual(pos(1).L1, [0, 0, 25]);
  assert.deepEqual(pos(1).L5, [-23.8, 0, 7.7]);
  assert.deepEqual(pos(2).L4, [70, 0, 20]);
  assert.deepEqual(pos(2).L6, [53, 0, -10]);
  assert.deepEqual(pos(3).L1, [0, 6, 6]);
  assert.deepEqual(pos(3).L7, [-20, 0, -35]);
});

test("[AC-04] 20 dom dom o 20 diem khac nhau luc dau; +1 moi 240 tick vao diem trong; Dem 1 chi co 24 diem nen toi da 24", () => {
  const r = run({ seed: 5, ticks: 3000, every: 120, scenario: { random_shades: false, random_drifters: false } });
  const m0 = at(r, 0).motes;
  assert.equal(m0.length, 20);
  assert.equal(new Set(m0.map((m) => m.pos.join())).size, 20);
  assert.equal(at(r, 240).motes_active, 21);
  assert.equal(at(r, 480).motes_active, 22);
  assert.equal(at(r, 960).motes_active, 24);
  assert.equal(at(r, 3000).motes_active, 24, "het diem trong thi khong sinh them (tran 30 chi dat duoc o Dem 3)");
  const n3 = run({ night: 3, seed: 5, ticks: 3000, every: 3000, scenario: { random_shades: false, random_drifters: false, wind_enabled: false } });
  assert.equal(n3.snaps.at(-1).motes_active, 30, "Dem 3 co 30 diem -> dat tran 30");
});

// ---------- Lao (dash) ----------
test("[AC-10] dash: 14 m/s trong 12 tick (2.8 m), su kien dash, hoi chieu 1.5 s tinh tu luc bat dau, khong dash lai khi dang hoi", () => {
  const frames = [{ tick: 0, move: [0, 1], dash: true }, { tick: 1, dash: false }, { tick: 20, dash: true }, { tick: 21, dash: false }, { tick: 90, dash: true }];
  const r = run({ ticks: 100, every: 1, scenario: empty(), inputs: { frames } });
  assert.deepEqual(r.events.filter((e) => e.name === "dash").map((e) => e.tick), [1, 91]);
  assert.ok(near(at(r, 12).player.pos[2], 14 * 0.2, 0.01), `sau 12 tick: ${at(r, 12).player.pos}`);
  assert.ok(near(at(r, 13).player.pos[2] - at(r, 12).player.pos[2], 6 / 60, 0.001), "het lao ve toc do chay");
  assert.ok(near(at(r, 1).player.dash_cd_s, 1.5));
  assert.equal(at(r, 91).player.dash_cd_s, 1.5);
  assert.ok(near(at(r, 5).player.vel[2], 14));
});

test("[AC-10] dash khong di chuyen thi lao theo huong dang nhin; khi nhay giu nguyen do cao", () => {
  const f = run({ ticks: 12, every: 12, scenario: empty(), inputs: { frames: [{ tick: 0, dash: true }] } });
  const p = at(f, 12).player.pos;
  assert.ok(near(p[2], 2.8, 0.01) && near(p[0], 0), `huong mac dinh +Z: ${p}`);
  const j = run({ ticks: 8, every: 1, scenario: empty(), inputs: { frames: [{ tick: 0, jump: true, move: [1, 0] }, { tick: 1, jump: false }, { tick: 3, dash: true }] } });
  const ys = [4, 5, 6, 7, 8].map((t) => at(j, t).player.pos[1]);
  assert.ok(ys.every((y) => near(y, ys[0], 1e-9)), `do cao khong doi khi lao: ${ys}`);
});

// ---------- Bục nhảy ----------
test("[AC-11] bục nhảy Dem 2: bay sang dao kia va ha canh an toan (apex ~4.9 m)", () => {
  const r = run({ night: 2, ticks: 150, every: 1, scenario: empty({ player: { pos: [20, 0, 18] } }) });
  const ys = r.snaps.map((s) => s.player.pos[1]);
  assert.ok(Math.max(...ys) > 4.5 && Math.max(...ys) < 5.3, `apex ${Math.max(...ys)}`);
  const f = r.snaps.at(-1).player;
  assert.ok(f.pos[0] > 45 && f.pos[1] === 0 && f.grounded, `ha canh o ${f.pos}`);
  assert.equal(evs(r, "player_hit").length, 0);
});

test("[AC-11] bục nhảy Dem 3: tu tang 1 bay len tang 2 (Y=6) va tha den L1", () => {
  const r = run({
    night: 3, ticks: 140, every: 1,
    scenario: empty({ player: { pos: [0, 3, 13], carried: 10 }, lanterns: [{ id: "L1" }] }),
    inputs: { frames: [{ tick: 120, interact: true }] },
  });
  const f = r.snaps.at(-1).player;
  assert.ok(f.pos[1] === 6 && f.grounded, `o tang 2: ${f.pos}`);
  assert.equal(evs(r, "lantern_lit").length, 1, "L1 (0,6,6) duoc thap");
});

// ---------- Ban do: cau, dốc, thap, tang ----------
test("[AC-12] Dem 2: di tu dao A qua cau tre sang dao B khong roi; ra khoi cau thi roi", () => {
  const ok = run({ night: 2, ticks: 800, every: 800, scenario: empty({ time_left_s: 330 }), inputs: { frames: [{ tick: 0, move: [1, 0] }] } });
  assert.equal(evs(ok, "player_hit").length, 0);
  assert.ok(ok.snaps.at(-1).player.pos[0] > 70);
  const bad = run({ night: 2, ticks: 200, every: 200, scenario: empty({ player: { pos: [35, 0, 0] } }), inputs: { frames: [{ tick: 0, move: [0, 1] }] } });
  assert.equal(evs(bad, "player_hit").filter((e) => e.data.by === "fall").length, 1);
});

test("[AC-13] Dem 3: doc 30 do noi tang 0 len tang 1 (Y=3); vach tang 2 khong leo duoc; thap chuong la vat can", () => {
  const ramp = run({ night: 3, ticks: 70, every: 70, scenario: empty({ player: { pos: [25.98, 0, 15] } }), inputs: { frames: [{ tick: 0, move: [-0.866, -0.5] }] } });
  assert.ok(near(ramp.snaps.at(-1).player.pos[1], 3, 0.01), `y=${ramp.snaps.at(-1).player.pos}`);
  const cliff = run({ night: 3, ticks: 60, every: 60, scenario: empty({ player: { pos: [-13, 3, 5] } }), inputs: { frames: [{ tick: 0, move: [1, -0.4] }] } });
  const cp = cliff.snaps.at(-1).player.pos;
  assert.ok(cp[1] <= 3 && Math.hypot(cp[0], cp[2]) >= 7.99, `khong tu leo len tang 2: ${cp}`);
  const tower = run({ night: 3, ticks: 150, every: 150, scenario: empty({ player: { pos: [0, 6, 5] } }), inputs: { frames: [{ tick: 0, move: [0, -1] }] } });
  const p = tower.snaps.at(-1).player.pos;
  assert.ok(Math.hypot(p[0], p[2]) >= 1.99, `tha chuong chan duong: ${p}`);
});

// ---------- Roi / hoi sinh ----------
test("[AC-14] roi khoi dao (Y<-10): -1 lua, mat het dom dom, cho 60 tick, hoi sinh o diem xuat phat voi bat tu 1.5 s", () => {
  const r = run({ ticks: 400, every: 1, scenario: empty({ player: { pos: [39, 0, 0], carried: 6 } }), inputs: { frames: [{ tick: 0, move: [1, 0] }, { tick: 40, move: [0, 0] }] } });
  const fall = evs(r, "player_hit")[0];
  assert.deepEqual(fall.data, { by: "fall", flames: 2, dropped: 0, lost: 6 });
  assert.equal(evs(r, "player_hit").length, 1, "chi tinh mot lan");
  const F = fall.tick;
  assert.ok(at(r, F + 59).player.pos[1] < -9.9, "dang cho");
  const back = at(r, F + 60).player;
  assert.deepEqual([back.pos, back.carried, back.flames], [[0, 0, 0], 0, 2]);
  assert.equal(back.invuln, 1.5);
  assert.deepEqual(back.vel, [0, 0, 0]);
});

test("[AC-14] roi khi con 1 lua -> thua ngay (no_flames)", () => {
  const r = run({ ticks: 400, scenario: empty({ player: { pos: [39, 0, 0], flames: 1 } }), inputs: { frames: [{ tick: 0, move: [1, 0] }] } });
  assert.deepEqual(r.events.at(-1).data, { result: "lost", reason: "no_flames" });
});

// ---------- Pause ----------
test("[AC-15] pause: sim dung hang, state 'paused', su kien paused/resumed, input bi bo qua khi dang tam dung", () => {
  const frames = [{ tick: 0, move: [0, 1] }, { tick: 30, pause: true }, { tick: 31, pause: false }, { tick: 90, pause: true }, { tick: 91, pause: false }];
  const r = run({ ticks: 120, every: 1, scenario: empty(), inputs: { frames } });
  assert.deepEqual(r.events.map((e) => [e.name, e.tick]), [["paused", 31], ["resumed", 91]]);
  const a = at(r, 31);
  assert.equal(a.state, "paused");
  const z = a.player.pos[2];
  for (let t = 32; t <= 90; t++) {
    const s = at(r, t);
    assert.equal(s.state, "paused");
    assert.equal(s.sim_tick, a.sim_tick);
    assert.equal(s.time_left_s, a.time_left_s);
    assert.equal(s.player.pos[2], z);
  }
  assert.equal(at(r, 91).state, "playing");
  assert.equal(at(r, 120).sim_tick, 120 - 60, "tick tong van tang, sim_tick dung khi tam dung");
});

test("[AC-15] pause dong bang bo dem: hoi chieu, bat tu, TTL dom dom roi", () => {
  const frames = [{ tick: 0, dash: true }, { tick: 1, dash: false, pause: true }, { tick: 100, pause: false }, { tick: 101, pause: true }, { tick: 200, pause: false }];
  const r = run({ ticks: 150, every: 1, scenario: empty({ motes: [{ pos: [10, 0, 10], kind: "dropped", ttl_ticks: 30 }] }), inputs: { frames } });
  const p1 = at(r, 2).player;
  const p2 = at(r, 100).player;
  assert.equal(at(r, 2).state, "paused");
  assert.equal(p1.dash_cd_s, p2.dash_cd_s);
  assert.equal(at(r, 100).motes_active, at(r, 2).motes_active, "TTL dung khi tam dung");
});

// ---------- Gio ----------
test("[AC-16] gio manh: bat sau 30 s, keo 5 s, day 2 m/s theo huong dir_deg; canh bao dir truoc 2 s", () => {
  const r = run({ ticks: 2200, every: 1, scenario: empty({ wind_enabled: true, time_left_s: 600 }) });
  assert.equal(at(r, 1700).wind.active, false);
  assert.equal(at(r, 1700).wind.dir_deg, at(r, 1800).wind.dir_deg, "dir da biet tu luc canh bao");
  const dir = at(r, 1800).wind.dir_deg;
  assert.equal(at(r, 1801).wind.active, true);
  assert.equal(at(r, 2105).wind.active, false);
  const p0 = at(r, 1800).player.pos;
  const p1 = at(r, 2100).player.pos;
  assert.ok(near(Math.hypot(p1[0] - p0[0], p1[2] - p0[2]), 10, 0.2), `day ${p0} -> ${p1}`);
  const ang = ((Math.atan2(p1[2] - p0[2], p1[0] - p0[0]) * 180) / Math.PI + 360) % 360;
  assert.ok(Math.abs(ang - dir) < 1 || Math.abs(ang - dir) > 359, `huong ${ang} vs ${dir}`);
});

test("[AC-16] Dem 3 co gio mac dinh, Dem 1/2 khong", () => {
  const w = (n) => run({ night: n, ticks: 2000, every: 2000, scenario: { random_motes: false, random_shades: false, random_drifters: false, motes: [], time_left_s: 600 } }).snaps.at(-1).wind.active;
  assert.equal(w(1), false);
  assert.equal(w(2), false);
  assert.equal(w(3), true);
});

// ---------- Gio Lac ----------
test("[AC-20] Gio Lac duoi khi mang >=5 (<=15 m), cuop min(3, mang) mot lan, khong mat lua, roi bo chay", () => {
  const r = run({ night: 2, ticks: 60, every: 1, scenario: empty({ player: { carried: 6 }, drifters: [{ id: "D1", pos: [8, 1, 0] }] }) });
  const st = evs(r, "drifter_steal");
  assert.equal(st.length, 1);
  assert.deepEqual(st[0].data, { drifter_id: "D1", amount: 3, carried: 3 });
  assert.equal(evs(r, "player_hit").length, 0);
  const d = r.snaps.at(-1).drifters[0];
  assert.equal(d.state, "flee");
  assert.equal(d.stolen, 3);
});

test("[AC-20] Gio Lac khong quan tam khi mang <5 va ngoai 15 m (idle)", () => {
  const a = run({ night: 2, ticks: 120, every: 120, scenario: empty({ player: { carried: 4 }, drifters: [{ id: "D1", pos: [5, 1, 0] }] }) });
  assert.equal(a.snaps.at(-1).drifters[0].state, "idle");
  const b = run({ night: 2, ticks: 1, every: 1, scenario: empty({ player: { carried: 9 }, drifters: [{ id: "D1", pos: [16, 1, 0] }] }) });
  assert.equal(b.snaps.at(-1).drifters[0].state, "idle");
});

test("[AC-20] pulse len Gio Lac dang duoi -> bo chay khong cuop; pulse len Gio Lac dang mang chiu -> roi het, bien mat sau 120 tick", () => {
  const a = run({ night: 2, ticks: 5, every: 1, scenario: empty({ player: { carried: 8 }, drifters: [{ id: "D1", pos: [3, 1, 0], state: "chase" }] }), inputs: { frames: [{ tick: 0, pulse: true }] } });
  assert.equal(evs(a, "drifter_steal").length, 0);
  assert.equal(a.snaps.at(-1).drifters[0].state, "flee");
  assert.equal(a.snaps.at(-1).drifters[0].stolen, 0);
  const b = run({ night: 2, ticks: 130, every: 1, scenario: empty({ player: { carried: 5 }, drifters: [{ id: "D1", pos: [3, 1, 0], state: "flee", stolen: 4 }] }), inputs: { frames: [{ tick: 0, pulse: true }] } });
  assert.deepEqual(evs(b, "drifter_drop")[0].data, { drifter_id: "D1", amount: 4 });
  assert.equal(at(b, 1).motes.filter((m) => m.kind === "dropped").length, 4);
  assert.equal(at(b, 100).drifters.length, 1);
  assert.equal(at(b, 125).drifters.length, 0);
});

test("[AC-20] Gio Lac tu sinh o Dem 2 luc tick 1200, 2400; toi da 2 con; ID D1, D2", () => {
  const r = run({ night: 2, seed: 4, ticks: 3700, every: 100, scenario: { random_motes: false, random_shades: false, motes: [], time_left_s: 600 } });
  assert.equal(at(r, 1100).drifters.length, 0);
  assert.deepEqual(at(r, 1200).drifters.map((d) => d.id), ["D1"]);
  assert.deepEqual(at(r, 2400).drifters.map((d) => d.id), ["D1", "D2"]);
  assert.equal(at(r, 3600).drifters.length, 2);
  const n1 = run({ night: 1, ticks: 1300, every: 1300, scenario: { random_motes: false, random_shades: false, motes: [], time_left_s: 600 } });
  assert.equal(n1.snaps.at(-1).drifters.length, 0, "Dem 1 khong co Gio Lac");
});

// ---------- Bua Gio ----------
test("[AC-21] Bua Gio: nhat -> su kien, 10 s, chay 7.2 m/s, dash khong hoi chieu, hoi sinh sau 2700 tick", () => {
  const frames = [{ tick: 0, move: [1, 0] }, { tick: 6, dash: true }, { tick: 7, dash: false }, { tick: 30, dash: true }, { tick: 31, dash: false }, { tick: 40, move: [0, 0] }];
  const r = run({ night: 2, ticks: 2800, every: 1, scenario: empty({ player: { pos: [34, 0, 0] }, time_left_s: 600 }), inputs: { frames } });
  assert.deepEqual(evs(r, "charm_picked")[0], { type: "event", tick: 1, name: "charm_picked", data: { charm_id: "C1", charm_ticks: 600 } });
  assert.equal(at(r, 1).charms[0].available, false);
  assert.ok(near(at(r, 1).player.charm_s, 10));
  assert.equal(at(r, 20).player.dash_cd_s, 0, "dash khong co hoi chieu khi co bua");
  assert.ok(evs(r, "dash").length >= 2, "dash lien tiep duoc (phai nhan lai phim)");
  assert.equal(at(r, 700).player.charm_s, 0);
  assert.equal(at(r, 2700).charms[0].available, false);
  assert.equal(at(r, 2701).charms[0].available, true);
});

test("[AC-21] Bua Gio tang toc chay len 7.2 m/s", () => {
  const r = run({ night: 2, ticks: 60, every: 60, scenario: empty({ player: { pos: [10, 0, 0], charm_ticks: 600 } }), inputs: { frames: [{ tick: 0, move: [0, 1] }] } });
  assert.ok(near(r.snaps.at(-1).player.pos[2], 7.2, 0.01));
});

// ---------- Vung an toan, Bong Muc ----------
test("[AC-30] den vua thap: Bong Muc dang o trong vung an toan bi day ra mep trong <=30 tick, khong sat thuong", () => {
  const r = run({
    ticks: 40, every: 1,
    scenario: empty({ player: { carried: 10 }, lanterns: [{ id: "L1", pos: [0, 0, 1.5] }], shades: [{ id: "S1", pos: [4, 0, 1.5] }] }),
    inputs: { frames: [{ tick: 0, interact: true }] },
  });
  assert.equal(evs(r, "lantern_lit").length, 1);
  assert.equal(evs(r, "player_hit").length, 0);
  const d = (t) => Math.hypot(at(r, t).shades[0].pos[0], at(r, t).shades[0].pos[2] - 1.5);
  assert.ok(d(1) < 6 + 1e-6);
  assert.ok(d(31) >= 6 - 1e-3, `ngoai mep sau 30 tick: ${d(31)}`);
});

test("[AC-31] lich Bong Muc: 2 con luc tick 300, sau do 1 con moi 480/420/360 tick (Dem 1/2/3); toi da 6/8/10", () => {
  const sched = { 1: [300, 300, 780, 1260], 2: [300, 300, 720, 1140], 3: [300, 300, 660, 1020] };
  for (const n of [1, 2, 3]) {
    const r = run({ night: n, seed: 9, ticks: 1300, every: 1300, scenario: { random_motes: false, motes: [], random_drifters: false, time_left_s: 600, player: { carried: 0, flames: 99 } } });
    assert.deepEqual(evs(r, "shade_spawned").map((e) => e.tick).slice(0, 4), sched[n], `night ${n}`);
    assert.deepEqual(evs(r, "shade_spawned").slice(0, 3).map((e) => e.data.id), ["S1", "S2", "S3"]);
  }
});

test("[AC-31] Bong Muc moi sinh o trang thai 'spawning' roi 'wander'; ten trang thai dung quy dinh", () => {
  const r = run({ seed: 2, ticks: 340, every: 1, scenario: empty({ random_shades: true, time_left_s: 600 }) });
  assert.equal(at(r, 300).shades[0].state, "spawning");
  assert.equal(at(r, 340).shades[0].state, "wander");
});

test("[AC-32] diem: +10 moi dom dom nap, +100 moi den, +5 moi Bong Muc bi tia sang (ke ca dang choang)", () => {
  const r = run({
    ticks: 200, every: 1,
    scenario: empty({ player: { carried: 10, flames: 99, invuln_ticks: 1000 }, shades: [{ id: "S1", pos: [0.5, 0.8, 0] }] }),
    inputs: { frames: [{ tick: 0, pulse: true }, { tick: 1, pulse: false }, { tick: 181, pulse: true }, { tick: 182, pulse: false }] },
  });
  assert.equal(evs(r, "pulse").length, 2, "lan 2 sau hoi chieu 3 s van lam moi");
  assert.equal(r.snaps.at(-1).score, 2 * S.per_stun);
});

test("[AC-33] thang o tick het gio van la thang; thang -> game_over won, diem = diem + floor(giay con)*2 + 50*lua", () => {
  const frames = [{ tick: 59, interact: true }];
  const lit = ["L2", "L3", "L4", "L5"].map((id) => ({ id, lit: true }));
  const r = run({ ticks: 100, scenario: empty({ time_left_s: 1, player: { carried: 10 }, lanterns: [{ id: "L1", pos: [0, 0, 1] }, ...lit] }), inputs: { frames } });
  assert.deepEqual(r.events.at(-1), { type: "event", tick: 60, name: "game_over", data: { result: "won", reason: "all_lit" } });
  assert.equal(r.end.score, 100 + 100 + 0 + 3 * S.per_flame_left);
});

test("[AC-33] Dem 3: 7 den, thang khi thap het", () => {
  const lit = ["L2", "L3", "L4", "L5", "L6", "L7"].map((id) => ({ id, lit: true }));
  const r = run({ night: 3, ticks: 5, scenario: empty({ player: { pos: [0, 6, 5], carried: 10 }, lanterns: [{ id: "L1" }, ...lit] }), inputs: { frames: [{ tick: 0, interact: true }] } });
  assert.equal(r.end.state, "won");
});

test("[AC-34] thu tu trong tick: Gio Lac cuop truoc, Bong Muc cham sau; bat tu khong chan viec cuop", () => {
  const r = run({
    night: 2, ticks: 3, every: 1,
    scenario: empty({ player: { carried: 6, invuln_ticks: 100 }, drifters: [{ id: "D1", pos: [0.5, 1, 0], state: "chase" }], shades: [{ pos: [0.5, 0, 0] }] }),
  });
  assert.equal(evs(r, "drifter_steal").length, 1, "bat tu khong ngan viec cuop");
  assert.equal(evs(r, "player_hit").length, 0, "Bong Muc cham luc bat tu khong lam gi");
});

// ---------- dinh dang scenario / inputs v1.1 ----------
test("[AC-40] scenario/inputs v1.1 sai dinh dang -> ma thoat 2; dung dinh dang thi chay", () => {
  const bad = [
    { scenario: { shades: [{ pos: [0, 0, 0], state: "dance" }] } },
    { scenario: { drifters: [{ pos: [0, 1] }] } },
    { scenario: { drifters: [{ pos: [0, 1, 0], state: "angry" }] } },
    { scenario: { charms: [{ id: "C1" }] } },
    { scenario: { player: { invuln_ticks: -1 } } },
    { scenario: { wind_enabled: "yes" } },
    { inputs: { frames: [{ tick: 0, pause: 1 }] } },
    { inputs: { frames: [{ tick: 0, dash: "x" }] } },
  ];
  for (const c of bad) assert.equal(run({ night: 2, ticks: 3, ...c }).status, 2, JSON.stringify(c));
  const good = run({
    night: 2, ticks: 3,
    scenario: empty({ player: { invuln_ticks: 5, dash_cd_ticks: 5, pulse_cd_ticks: 5, charm_ticks: 5 }, shades: [{ id: "S1", pos: [30, 0, 0], state: "stunned", state_ticks_left: 7 }], drifters: [{ id: "D1", pos: [0, 1, 9], state: "idle", stolen: 0 }], charms: [{ id: "C1", pos: [35, 0, 0], available: false, respawn_ticks: 10 }] }),
  });
  assert.equal(good.status, 0);
  assert.equal(good.snaps[0].shades[0].state_ticks_left, 7);
  assert.equal(good.snaps[0].player.charm_s, 5 / 60 > 0 ? Math.round((5 / 60) * 1000) / 1000 : 0);
  assert.equal(good.snaps[0].charms[0].available, false);
});

test("[AC-40] den L6/L7 chi hop le o Dem 2/3", () => {
  assert.equal(run({ night: 1, ticks: 1, scenario: { lanterns: [{ id: "L6" }] } }).status, 2);
  assert.equal(run({ night: 2, ticks: 1, scenario: empty({ lanterns: [{ id: "L6" }] }) }).status, 0);
  assert.equal(run({ night: 3, ticks: 1, scenario: empty({ lanterns: [{ id: "L7" }] }) }).status, 0);
});

// ---------- Hieu nang ----------
test("[AC-50] headless nguyen mot dem (21 600 tick) <= 30 s, deterministic", () => {
  const t0 = Date.now();
  const a = run({ night: 3, seed: 11, ticks: 21600, scenario: { random_motes: true, time_left_s: 360, player: { flames: 1000000 } } });
  const ms = Date.now() - t0;
  assert.equal(a.status, 0);
  assert.equal(a.end.ticks, 21600, "chay du mot Dem (dawn)");
  assert.ok(ms <= 30000, `mat ${ms} ms`);
  const b = run({ night: 3, seed: 11, ticks: 21600, scenario: { random_motes: true, time_left_s: 360, player: { flames: 1000000 } } });
  assert.equal(a.raw, b.raw);
});
