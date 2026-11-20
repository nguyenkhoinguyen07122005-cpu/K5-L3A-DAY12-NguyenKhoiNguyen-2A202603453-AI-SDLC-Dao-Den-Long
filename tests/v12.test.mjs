// Test cho Test Contract v1.2 (Ticket-03 "Den can dau"): moi luat moi co it nhat 1 kich ban headless.
// Ma tieu chi chap nhan AC-70.. nam trong docs/spec/phase-3.md.
import { test } from "node:test";
import assert from "node:assert/strict";
import { run, empty, T, near } from "./helpers.mjs";

const S = T.score;
const at = (r, tick) => r.snaps.find((s) => s.tick === tick);
const evs = (r, name) => r.events.filter((e) => e.name === name);
const L = (r, tick, id = "L1") => at(r, tick).lanterns.find((l) => l.id === id);
// L1 o goc toa do, nguoi choi ngoai tam an toan / chay; thoi gian dai de khong het dem.
const base = (extra = {}) => empty({ time_left_s: 200, player: { pos: [0, 0, 14] }, ...extra });

test("[AC-70] contract v1.2: khoa tuning moi + khong con per_second_left", () => {
  const exp = { fuel_max: 100, fuel_decay_per_s: 1.0, fuel_per_mote: 10, relight_cost: 5, win_ratio: 0.6, drain_per_s: 5, low_fuel_threshold: 30, capacity_max: 20 };
  for (const [k, v] of Object.entries(exp)) assert.equal(T[k], v, `tuning.${k}`);
});

test("[AC-71] den hao 1 nhien lieu/giay; scenario lit:true khong co fuel -> 100", () => {
  const r = run({ ticks: 600, every: 600, scenario: base({ lanterns: [{ id: "L1", pos: [0, 0, 0], lit: true }] }) });
  assert.equal(L(r, 0).fuel, 100);
  assert.ok(near(L(r, 600).fuel, 90, 0.05), `fuel=${L(r, 600).fuel}`);
});

test("[AC-72] fuel <= 0 -> den tat, deposited 0, ever_lit giu true, su kien lantern_out dung tick", () => {
  const r = run({ ticks: 40, every: 1, scenario: base({ lanterns: [{ id: "L1", pos: [0, 0, 0], lit: true, fuel: 0.5 }] }) });
  const out = evs(r, "lantern_out");
  assert.equal(out.length, 1);
  assert.equal(out[0].tick, 30);
  assert.deepEqual(out[0].data, { lantern_id: "L1" });
  assert.equal(L(r, 29).lit, true);
  assert.deepEqual([L(r, 30).lit, L(r, 30).deposited, L(r, 30).fuel, L(r, 30).ever_lit], [false, 0, 0, true]);
});

test("[AC-73] thap lai ton 5 (da tung sang): +40 diem, +5 diem/dom dom, relight:true, fuel 100, relit_count tang", () => {
  const r = run({
    ticks: 2,
    every: 1,
    scenario: base({ player: { pos: [0, 0, 1], carried: 5 }, lanterns: [{ id: "L1", pos: [0, 0, 0], lit: false, ever_lit: true }] }),
    inputs: { frames: [{ tick: 0, interact: true }] },
  });
  assert.deepEqual(evs(r, "lantern_lit")[0].data, { lantern_id: "L1", relight: true });
  assert.equal(r.end.score, 5 * S.per_mote + S.per_relight);
  const l = L(r, 1);
  assert.deepEqual([l.lit, l.fuel, l.relit_count], [true, 100, 1]);
});

test("[AC-74] lan thap dau ton 10: +100 diem, +5 diem/dom dom, relight:false", () => {
  const r = run({ ticks: 1, scenario: base({ player: { pos: [0, 0, 1], carried: 10 }, lanterns: [{ id: "L1", pos: [0, 0, 0] }] }), inputs: { frames: [{ tick: 0, interact: true }] } });
  assert.deepEqual(evs(r, "lantern_lit")[0].data, { lantern_id: "L1", relight: false });
  assert.equal(r.end.score, 10 * S.per_mote + S.per_lantern);
});

test("[AC-75] tiep dau: dung min(mang theo, ceil((100-fuel)/10)) dom dom, +10 fuel moi dom dom, +5 diem moi dom dom, su kien refuel", () => {
  const a = run({ ticks: 1, every: 1, scenario: base({ player: { pos: [0, 0, 1], carried: 10 }, lanterns: [{ id: "L1", pos: [0, 0, 0], lit: true, fuel: 55 }] }), inputs: { frames: [{ tick: 0, interact: true }] } });
  assert.deepEqual(evs(a, "refuel")[0].data, { lantern_id: "L1", amount: 5, fuel: 100 });
  assert.equal(at(a, 1).player.carried, 5);
  assert.equal(a.end.score, 5 * S.per_mote);
  const b = run({ ticks: 1, every: 1, scenario: base({ player: { pos: [0, 0, 1], carried: 2 }, lanterns: [{ id: "L1", pos: [0, 0, 0], lit: true, fuel: 50 }] }), inputs: { frames: [{ tick: 0, interact: true }] } });
  assert.deepEqual(evs(b, "refuel")[0].data, { lantern_id: "L1", amount: 2, fuel: 70 });
  assert.equal(at(b, 1).player.carried, 0);
});

test("[AC-76] chon den: gan nhat trong cac den 'tiep nhan' (tat, hoac sang chua day); bang nhau -> id nho", () => {
  const r = run({
    ticks: 1,
    scenario: base({ player: { pos: [0, 0, 1], carried: 10 }, lanterns: [{ id: "L2", pos: [1, 0, 1], lit: true, fuel: 50 }, { id: "L1", pos: [-1, 0, 1], lit: true, fuel: 50 }] }),
    inputs: { frames: [{ tick: 0, interact: true }] },
  });
  assert.equal(evs(r, "refuel")[0].data.lantern_id, "L1");
});

test("[AC-77] Bong Muc wander di toi den yeu (fuel < 30), vao 2 m thi drain: dung yen, hut 5/s cong don voi hao 1/s, fuel_drain moi 60 tick", () => {
  const r = run({
    ticks: 130,
    every: 1,
    scenario: base({ lanterns: [{ id: "L1", pos: [0, 0, 0], lit: true, fuel: 20 }], shades: [{ id: "S1", pos: [1.5, 0, 0], state: "wander" }] }),
  });
  const s1 = at(r, 1).shades[0];
  assert.equal(s1.state, "drain");
  // tick 1: tru dau (hao 1/s) roi Bong Muc moi vao 2 m va chuyen drain; tu tick 2 moi bi hut 5/s -> 59 tick hut
  assert.ok(near(L(r, 60).fuel, 20 - 1 - (5 * 59) / 60, 0.06), `fuel@60=${L(r, 60).fuel}`);
  const d = evs(r, "fuel_drain");
  assert.deepEqual(d.map((e) => e.tick), [61, 121]);
  assert.equal(d[0].data.lantern_id, "L1");
  assert.equal(d[0].data.shade_id, "S1");
  assert.deepEqual(at(r, 100).shades[0].pos, at(r, 1).shades[0].pos, "drain dung yen");
});

test("[AC-77] hai Bong Muc cung drain mot den -> hut cong don (1 + 5 + 5 = 11/s)", () => {
  const r = run({
    ticks: 60,
    every: 60,
    scenario: base({ lanterns: [{ id: "L1", pos: [0, 0, 0], lit: true, fuel: 20 }], shades: [{ id: "S1", pos: [1.5, 0, 0], state: "drain", target_lantern_id: "L1" }, { id: "S2", pos: [-1.5, 0, 0], state: "drain", target_lantern_id: "L1" }] }),
  });
  assert.ok(near(L(r, 60).fuel, 9, 0.06), `fuel=${L(r, 60).fuel}`);
});

test("[AC-78] drain -> chase khi May vao trong 6 m; drain -> wander khi den duoc cham len >= 30 hoac den tat", () => {
  const chase = run({ ticks: 2, every: 1, scenario: base({ player: { pos: [0, 0, 5] }, lanterns: [{ id: "L1", pos: [0, 0, 0], lit: true, fuel: 20 }], shades: [{ pos: [1.5, 0, 0], state: "drain", target_lantern_id: "L1" }] }) });
  assert.equal(at(chase, 1).shades[0].state, "chase");
  const refill = run({ ticks: 2, every: 1, scenario: base({ player: { pos: [0, 0, 1], carried: 3, invuln_ticks: 600 }, lanterns: [{ id: "L1", pos: [0, 0, 0], lit: true, fuel: 20 }], shades: [{ pos: [4, 0, 4], state: "drain", target_lantern_id: "L1" }] }), inputs: { frames: [{ tick: 0, interact: true }] } });
  assert.notEqual(at(refill, 2).shades[0].state, "drain");
  const out = run({ ticks: 2, every: 1, scenario: base({ lanterns: [{ id: "L1", pos: [0, 0, 0], lit: true, fuel: 0.01 }], shades: [{ pos: [1.5, 0, 0], state: "drain", target_lantern_id: "L1" }] }) });
  assert.equal(at(out, 2).shades[0].state, "wander");
});

test("[AC-79] Toa Sang trung Bong Muc dang drain -> +15 diem (thuong +5); roi vao stunned", () => {
  const frames = [{ tick: 0, pulse: true }];
  const drain = run({ ticks: 2, every: 1, scenario: base({ player: { pos: [0, 0, 3], carried: 3 }, lanterns: [{ id: "L1", pos: [0, 0, 0], lit: true, fuel: 20 }], shades: [{ pos: [1.5, 0, 0], state: "drain", target_lantern_id: "L1" }] }), inputs: { frames } });
  assert.equal(drain.end.score, S.per_stun_drain);
  assert.equal(at(drain, 1).shades[0].state, "stunned");
  const plain = run({ ticks: 2, scenario: base({ player: { pos: [0, 0, 3], carried: 3 }, shades: [{ pos: [3, 0, 3], state: "wander" }] }), inputs: { frames } });
  assert.equal(plain.end.score, S.per_stun);
});

test("[AC-80] den fuel < 30 mat vung an toan (Bong Muc khong bi day ra); fuel >= 30 thi van an toan", () => {
  const safe = run({ ticks: 3, every: 1, scenario: base({ player: { pos: [0, 0, 20] }, lanterns: [{ id: "L1", pos: [0, 0, 0], lit: true, fuel: 60 }], shades: [{ pos: [3, 0, 0], state: "wander" }] }) });
  assert.ok(Math.hypot(...[0, 2].map((i) => at(safe, 3).shades[0].pos[i])) >= 6 - 0.01, "den du dau: Bong Muc bi day ra mep 6 m");
  const weak = run({ ticks: 3, every: 1, scenario: base({ player: { pos: [0, 0, 20] }, lanterns: [{ id: "L1", pos: [0, 0, 0], lit: true, fuel: 25 }], shades: [{ pos: [3, 0, 0], state: "wander" }] }) });
  assert.ok(Math.hypot(...[0, 2].map((i) => at(weak, 3).shades[0].pos[i])) < 6, "den yeu: khong con vung an toan");
});

test("[AC-81] tiep dau len >= 30 khi Bong Muc dang o trong 6 m -> bi day ra mep trong <= 30 tick, khong sat thuong", () => {
  const r = run({
    ticks: 40,
    every: 1,
    scenario: base({ player: { pos: [0, 0, 1], carried: 3, invuln_ticks: 0 }, lanterns: [{ id: "L1", pos: [0, 0, 0], lit: true, fuel: 20 }], shades: [{ pos: [2.5, 0, 0], state: "stunned", state_ticks_left: 200 }] }),
    inputs: { frames: [{ tick: 0, interact: true }] },
  });
  assert.equal(evs(r, "refuel").length, 1);
  assert.equal(evs(r, "player_hit").length, 0);
});

test("[AC-82] suc chua = 10 + 2 x so lan thap thanh cong (toi da 20); scenario successful_lights", () => {
  assert.equal(at(run({ ticks: 0, scenario: base() }), 0).player.capacity, 10);
  assert.equal(at(run({ ticks: 0, scenario: base({ player: { successful_lights: 3 } }) }), 0).player.capacity, 16);
  assert.equal(at(run({ ticks: 0, scenario: base({ player: { successful_lights: 40 } }) }), 0).player.capacity, 20);
  const r = run({ ticks: 1, every: 1, scenario: base({ player: { pos: [0, 0, 1], carried: 10 }, lanterns: [{ id: "L1", pos: [0, 0, 0] }] }), inputs: { frames: [{ tick: 0, interact: true }] } });
  assert.equal(at(r, 1).player.capacity, 12);
});

test("[AC-83] nhat dom dom toi suc chua moi (khong qua cap 10 ban dau, nhieu hon sau khi thap den)", () => {
  const motes = Array.from({ length: 14 }, (_, i) => ({ id: `M${i + 1}`, pos: [0.05 * i, 0, 14] }));
  const a = run({ ticks: 3, every: 3, scenario: base({ motes }) });
  assert.equal(at(a, 3).player.carried, 10);
  const b = run({ ticks: 3, every: 3, scenario: base({ motes, player: { pos: [0, 0, 14], successful_lights: 2 } }) });
  assert.equal(at(b, 3).player.carried, 14);
});

test("[AC-84] thang chi o binh minh va can du den: khong thang som; dawn_survived tinh diem 50 + floor(fuel)/den + 50/ngon lua", () => {
  const r = run({
    ticks: 200,
    scenario: empty({ time_left_s: 1, player: { pos: [0, 0, 14], flames: 3 }, lanterns: [{ id: "L1", lit: true, fuel: 80 }, { id: "L2", lit: true, fuel: 50 }, { id: "L3", lit: true, fuel: 10 }, { id: "L4" }, { id: "L5" }] }),
  });
  assert.deepEqual(r.events.at(-1).data, { result: "won", reason: "dawn_survived" });
  assert.equal(r.end.ticks, 60);
  const f = (v) => Math.floor(v - 1); // 1 giay hao 1
  assert.equal(r.end.score, 3 * S.per_dawn_lantern + f(80) + f(50) + f(10) + 3 * S.per_flame_left);
});

test("[AC-85] scenario v1.2 sai dinh dang -> ma thoat 2 (fuel am, target_lantern_id la, successful_lights am)", () => {
  const bad = [
    { lanterns: [{ id: "L1", fuel: -1 }] },
    { lanterns: [{ id: "L1", ever_lit: "yes" }] },
    { player: { successful_lights: -1 } },
    { shades: [{ pos: [0, 0, 0], state: "drain", target_lantern_id: "L9" }] },
  ];
  for (const s of bad) assert.equal(run({ ticks: 1, scenario: s }).status, 2, JSON.stringify(s));
  assert.equal(run({ ticks: 1, scenario: empty({ shades: [{ pos: [1, 0, 0], state: "drain", target_lantern_id: "L1" }] }) }).status, 0);
});

test("[AC-86] tat dinh: cung seed + dau vao -> cung dong ra, ke ca khi co hut dau", () => {
  const sc = { random_motes: true, time_left_s: 240, player: { flames: 1000 }, lanterns: [{ id: "L1", lit: true, fuel: 25 }, { id: "L2", lit: true, fuel: 28 }] };
  assert.equal(run({ seed: 5, ticks: 3000, scenario: sc }).raw, run({ seed: 5, ticks: 3000, scenario: sc }).raw);
});
