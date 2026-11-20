// Test theo Test Contract v1.0 - chay CLI headless that, doc output that.
// Moi test ghi ro no kiem yeu cau nao (xem docs/proof/README.md).
import { test } from "node:test";
import assert from "node:assert/strict";
import { run, empty, T, near, dist } from "./helpers.mjs";

const S = T.score;

// ---------- A. Dinh dang output ----------
test("[B/E] dong 1 la snapshot tick 0; snapshot moi --snapshot-every; dong cuoi la 'end'", () => {
  const r = run({ ticks: 100, scenario: empty(), every: 25 });
  assert.equal(r.status, 0);
  assert.deepEqual(r.snaps.map((s) => s.tick), [0, 25, 50, 75, 100]);
  assert.equal(r.lines[0].type, "snapshot");
  assert.equal(r.lines[0].tick, 0);
  assert.deepEqual(r.end, { type: "end", ticks: 100, state: "playing", score: 0 });
  for (const s of r.snaps) {
    assert.equal(s.sim_tick, s.tick);
    assert.equal(s.state, "playing");
    assert.equal(s.motes_active, s.motes.length);
  }
});

test("[B] mac dinh snapshot moi 10 tick; --ticks 0 chi co snapshot 0 + end", () => {
  const r = run({ ticks: 30, scenario: empty() });
  assert.deepEqual(r.snaps.map((s) => s.tick), [0, 10, 20, 30]);
  const z = run({ ticks: 0, scenario: empty() });
  assert.equal(z.status, 0);
  assert.equal(z.lines.length, 2);
  assert.equal(z.end.ticks, 0);
});

test("[E] toa do lam tron toi da 3 chu so thap phan", () => {
  const r = run({ ticks: 50, every: 1, scenario: empty(), inputs: { frames: [{ tick: 0, move: [0.123456, 0.987654] }] } });
  for (const s of r.snaps) for (const v of s.player.pos) assert.equal(v, Math.round(v * 1000) / 1000);
});

test("[B] time_left_s = thoi luong dem - (so buoc)/60; scenario co the dat time_left_s", () => {
  const r = run({ ticks: 120, every: 60, scenario: empty({ time_left_s: 300 }) });
  assert.deepEqual(r.snaps.map((s) => s.time_left_s), [300, 299, 298]);
  const d = run({ ticks: 60, every: 60, scenario: empty() });
  assert.equal(d.snaps[0].time_left_s, T.night1_duration_s);
});

test("[D] scenario: dung nguyen vi tri/so luong; dung scenario khong phat su kien, khong cong diem", () => {
  const r = run({
    ticks: 0,
    scenario: empty({
      player: { pos: [1, 0, 2], carried: 4, flames: 2 },
      motes: [[5, 0, 5], [6, 0, 6]],
      shades: [{ id: "X9", pos: [30, 0, 0] }],
      lanterns: [{ id: "L2", pos: [3, 0, 3], deposited: 2, lit: true }],
    }),
  });
  const s = r.snaps[0];
  assert.deepEqual(s.player, { pos: [1, 0, 2], flames: 2, carried: 4 });
  assert.equal(s.motes_active, 2);
  assert.deepEqual(s.shades.map((x) => x.id), ["X9"]);
  const l2 = s.lanterns.find((l) => l.id === "L2");
  assert.deepEqual(l2, { id: "L2", pos: [3, 0, 3], lit: true, deposited: 2 });
  assert.equal(s.lanterns.length, T.lantern_count_night1);
  assert.equal(s.score, 0);
  assert.equal(r.events.length, 0);
});

// ---------- C. Input / di chuyen ----------
test("[C] move [0,1], yaw 0 -> +Z, quang duong = player_speed * thoi gian", () => {
  const r = run({ ticks: 60, every: 60, scenario: empty(), inputs: { frames: [{ tick: 0, move: [0, 1], cam_yaw_deg: 0 }] } });
  const p = r.snaps.at(-1).player.pos;
  assert.ok(near(p[0], 0) && near(p[2], T.player_speed) && p[1] === 0, `pos=${p}`);
});

test("[C] move [1,0], yaw 0 -> +X", () => {
  const r = run({ ticks: 60, every: 60, scenario: empty(), inputs: { frames: [{ tick: 0, move: [1, 0] }] } });
  const p = r.snaps.at(-1).player.pos;
  assert.ok(near(p[0], T.player_speed) && near(p[2], 0), `pos=${p}`);
});

test("[C] cong thuc yaw: theta=90 doi 'tien' (0,1) thanh +X; theta=180 thanh -Z", () => {
  const a = run({ ticks: 60, every: 60, scenario: empty(), inputs: { frames: [{ tick: 0, move: [0, 1], cam_yaw_deg: 90 }] } });
  const pa = a.snaps.at(-1).player.pos;
  assert.ok(near(pa[0], T.player_speed) && near(pa[2], 0), `90deg pos=${pa}`);
  const b = run({ ticks: 60, every: 60, scenario: empty(), inputs: { frames: [{ tick: 0, move: [0, 1], cam_yaw_deg: 180 }] } });
  const pb = b.snaps.at(-1).player.pos;
  assert.ok(near(pb[0], 0) && near(pb[2], -T.player_speed), `180deg pos=${pb}`);
});

test("[C] vector dai hon 1 duoc chuan hoa (cheo khong nhanh hon); vector ngan = di cham hon", () => {
  const d = run({ ticks: 60, every: 60, scenario: empty(), inputs: { frames: [{ tick: 0, move: [1, 1] }] } });
  const p = d.snaps.at(-1).player.pos;
  assert.ok(near(Math.hypot(p[0], p[2]), T.player_speed), `|pos|=${Math.hypot(p[0], p[2])}`);
  const h = run({ ticks: 60, every: 60, scenario: empty(), inputs: { frames: [{ tick: 0, move: [0, 0.5] }] } });
  assert.ok(near(h.snaps.at(-1).player.pos[2], T.player_speed / 2));
});

test("[C] truong vang mat giu gia tri cu; frame sau doi move", () => {
  const r = run({
    ticks: 120, every: 60, scenario: empty(),
    inputs: { frames: [{ tick: 0, move: [0, 1] }, { tick: 30, cam_yaw_deg: 90 }, { tick: 60, move: [0, 0] }] },
  });
  // 30 tick +Z (3m), 30 tick +X sau khi xoay (3m), roi dung yen
  const p = r.snaps.at(-1).player.pos;
  assert.ok(near(p[2], 3) && near(p[0], 3), `pos=${p}`);
});

test("[C] khong co file inputs = dung yen", () => {
  const r = run({ ticks: 120, every: 120, scenario: empty() });
  assert.deepEqual(r.snaps.at(-1).player.pos, [0, 0, 0]);
});

test("[C] nhay: y tang roi ve 0; khong doi vi tri ngang; giu phim chi nhay mot lan (canh len)", () => {
  const r = run({ ticks: 120, every: 1, scenario: empty(), inputs: { frames: [{ tick: 0, jump: true }] } });
  const ys = r.snaps.map((s) => s.player.pos[1]);
  assert.ok(Math.max(...ys) > 0.5, "co nhay len");
  assert.equal(ys.at(-1), 0, "ha canh");
  assert.ok(ys.slice(0, 40).some((y) => y > 0) && ys.slice(60).every((y) => y === 0), "chi nhay mot lan");
  assert.ok(r.snaps.every((s) => s.player.pos[0] === 0 && s.player.pos[2] === 0));
});

test("[B] dao khong co phat roi: di thang mai van o tren mat dao, y = 0", () => {
  const r = run({ ticks: 3000, every: 3000, scenario: empty({ time_left_s: 600 }), inputs: { frames: [{ tick: 0, move: [1, 0] }] } });
  const p = r.snaps.at(-1).player.pos;
  assert.equal(T.fall_enabled, false);
  assert.ok(Math.hypot(p[0], p[2]) <= 80.001 && p[1] === 0, `pos=${p}`);
  assert.equal(r.events.filter((e) => e.name === "player_hit").length, 0);
});

// ---------- Nhat dom dom ----------
test("[mote_picked] nhat khi khoang cach <= pickup_radius (bao gom bien); ngoai bien thi khong", () => {
  const r = run({ ticks: 1, every: 1, scenario: empty({ motes: [[T.pickup_radius, 0, 0], [0, 0, T.pickup_radius + 0.01]] }) });
  assert.deepEqual(r.events, [{ type: "event", tick: 1, name: "mote_picked", data: { carried: 1 } }]);
  const s = r.snaps.at(-1);
  assert.equal(s.player.carried, 1);
  assert.equal(s.motes_active, 1);
  assert.equal(s.score, S.per_mote);
});

test("[mote_picked] day gio (carry_capacity): khong nhat them", () => {
  const r = run({ ticks: 5, scenario: empty({ player: { carried: T.carry_capacity }, motes: [[0, 0, 0.5]] }) });
  assert.equal(r.events.length, 0);
  assert.equal(r.snaps.at(-1).player.carried, T.carry_capacity);
  assert.equal(r.snaps.at(-1).motes_active, 1);
});

test("[mote_picked] nhat tung con mot, carried tang dan, den khi day gio", () => {
  const motes = Array.from({ length: T.carry_capacity + 3 }, () => [0, 0, 0.2]);
  const r = run({ ticks: 20, scenario: empty({ motes }) });
  assert.deepEqual(r.events.map((e) => e.data.carried), Array.from({ length: T.carry_capacity }, (_, i) => i + 1));
  assert.equal(r.snaps.at(-1).motes_active, 3);
});

// ---------- Nap anh sang / thap den ----------
test("[deposit + lantern_lit] nap du lantern_cost -> den sang, +per_lantern, carried giam", () => {
  const r = run({
    ticks: 1, every: 1,
    scenario: empty({ player: { carried: T.lantern_cost + 2 }, lanterns: [{ id: "L1", pos: [0, 0, 2] }] }),
    inputs: { frames: [{ tick: 0, interact: true }] },
  });
  assert.deepEqual(r.events.map((e) => [e.name, e.tick]), [["deposit", 1], ["lantern_lit", 1]]);
  assert.deepEqual(r.events[0].data, { lantern_id: "L1", amount: T.lantern_cost, deposited: T.lantern_cost });
  assert.deepEqual(r.events[1].data, { lantern_id: "L1" });
  const s = r.snaps.at(-1);
  assert.equal(s.player.carried, 2);
  assert.equal(s.lanterns[0].lit, true);
  assert.equal(s.score, S.per_lantern);
});

test("[deposit] nap tung phan: chua du thi chua sang; lan nap sau cong don", () => {
  const r = run({
    ticks: 25, every: 1,
    scenario: empty({ player: { carried: 3 }, lanterns: [{ id: "L1", pos: [0, 0, 1] }], motes: [[0, 0, 2.2]] }),
    inputs: { frames: [{ tick: 0, interact: true }, { tick: 1, interact: false }, { tick: 2, move: [0, 1] }, { tick: 15, move: [0, 0] }, { tick: 20, interact: true }] },
  });
  const dep = r.events.filter((e) => e.name === "deposit");
  assert.equal(dep.length, 2);
  assert.deepEqual(dep[0].data, { lantern_id: "L1", amount: 3, deposited: 3 });
  assert.equal(dep[0].tick, 1);
  assert.deepEqual(dep[1].data, { lantern_id: "L1", amount: 1, deposited: 4 });
  assert.equal(r.events.filter((e) => e.name === "lantern_lit").length, 0, "4 < lantern_cost nen chua sang");
});

test("[deposit] giu phim interact chi nap mot lan (kich hoat khi false->true)", () => {
  const r = run({
    ticks: 30,
    scenario: empty({ player: { carried: 2 }, lanterns: [{ id: "L1", pos: [0, 0, 1] }] }),
    inputs: { frames: [{ tick: 0, interact: true }] },
  });
  assert.equal(r.events.filter((e) => e.name === "deposit").length, 1);
});

test("[deposit] ngoai interact_radius thi khong nap; tay khong (carried=0) thi khong nap", () => {
  const far = run({
    ticks: 1, scenario: empty({ player: { carried: 3 }, lanterns: [{ id: "L1", pos: [0, 0, T.interact_radius + 0.01] }] }),
    inputs: { frames: [{ tick: 0, interact: true }] },
  });
  assert.equal(far.events.length, 0);
  const edge = run({
    ticks: 1, scenario: empty({ player: { carried: 3 }, lanterns: [{ id: "L1", pos: [0, 0, T.interact_radius] }] }),
    inputs: { frames: [{ tick: 0, interact: true }] },
  });
  assert.equal(edge.events[0].name, "deposit", "bien (<=) duoc tinh");
  const none = run({
    ticks: 1, scenario: empty({ lanterns: [{ id: "L1", pos: [0, 0, 1] }] }),
    inputs: { frames: [{ tick: 0, interact: true }] },
  });
  assert.equal(none.events.length, 0);
});

test("[scenario] den dat san lit:true khong cong diem va khong phat su kien", () => {
  const r = run({ ticks: 10, scenario: empty({ lanterns: [{ id: "L1", lit: true }, { id: "L2", lit: true }] }) });
  assert.equal(r.events.length, 0);
  assert.equal(r.snaps.at(-1).score, 0);
});

// ---------- Toa sang ----------
test("[pulse] lam choang + day lui Bong Muc trong pulse_radius, ton pulse_cost, +per_stun", () => {
  const r = run({
    ticks: 1, every: 1, scenario: empty({ player: { carried: 5 }, shades: [{ id: "S1", pos: [5, 0, 0] }, { id: "S2", pos: [T.pulse_radius, 0, 0] }, { id: "S3", pos: [0, 0, T.pulse_radius + 0.01] }] }),
    inputs: { frames: [{ tick: 0, pulse: true }] },
  });
  assert.deepEqual(r.events, [{ type: "event", tick: 1, name: "pulse", data: { stunned_ids: ["S1", "S2"] } }]);
  const s = r.snaps.at(-1);
  assert.equal(s.player.carried, 5 - T.pulse_cost);
  assert.equal(s.score, 2 * S.per_stun);
  const by = Object.fromEntries(s.shades.map((x) => [x.id, x]));
  assert.equal(by.S1.state, "stunned");
  assert.ok(near(by.S1.pos[0], 5 + T.pulse_push_m), `S1 bi day ${by.S1.pos}`);
  assert.equal(by.S3.state, "chase");
});

test("[pulse] khong du anh sang (carried < pulse_cost) thi khong toa sang", () => {
  const r = run({
    ticks: 1, scenario: empty({ player: { carried: T.pulse_cost - 1 }, shades: [{ pos: [5, 0, 0] }] }),
    inputs: { frames: [{ tick: 0, pulse: true }] },
  });
  assert.equal(r.events.length, 0);
  assert.equal(r.snaps.at(-1).player.carried, T.pulse_cost - 1);
});

test("[pulse] hoi chieu: bam lai trong pulse_cooldown_s bi bo qua, het hoi thi toa lai duoc", () => {
  const cd = Math.round(T.pulse_cooldown_s * 60);
  const frames = [{ tick: 0, pulse: true }, { tick: 1, pulse: false }, { tick: 10, pulse: true }, { tick: 11, pulse: false }, { tick: cd, pulse: true }];
  const r = run({ ticks: cd + 2, scenario: empty({ player: { carried: 8 }, shades: [{ pos: [100, 0, 0] }] }), inputs: { frames } });
  const pulses = r.events.filter((e) => e.name === "pulse");
  assert.deepEqual(pulses.map((p) => p.tick), [1, cd + 1]);
});

test("[pulse] choang keo dai dung pulse_stun_s roi Bong Muc duoi tiep", () => {
  const stunTicks = Math.round(T.pulse_stun_s * 60);
  const r = run({
    ticks: stunTicks + 30, every: 1,
    scenario: empty({ player: { carried: 2 }, shades: [{ id: "S1", pos: [6, 0, 0] }] }),
    inputs: { frames: [{ tick: 0, pulse: true }, { tick: 1, pulse: false }] },
  });
  const sh = (tick) => r.snaps[tick].shades[0];
  assert.equal(sh(1).state, "stunned");
  const x1 = sh(1).pos[0];
  assert.equal(sh(stunTicks - 1).pos[0], x1, "dung yen khi dang choang");
  assert.equal(sh(stunTicks - 1).state, "stunned");
  assert.equal(sh(stunTicks).state, "chase");
  assert.ok(sh(stunTicks + 20).pos[0] < x1, "het choang thi duoi lai gan nguoi choi");
});

// ---------- Bong Muc: duoi, cham, mat mau ----------
test("[shade] duoi theo nguoi choi voi shade_speed", () => {
  const r = run({ ticks: 60, every: 60, scenario: empty({ shades: [{ id: "S1", pos: [30, 0, 0] }] }) });
  assert.ok(near(r.snaps.at(-1).shades[0].pos[0], 30 - T.shade_speed), `S1=${r.snaps.at(-1).shades[0].pos}`);
});

test("[player_hit] cham (<= shade_hit_radius): mat 1 mau, roi hit_drop_ratio so dom dom, dom dom roi ra dat", () => {
  const carried = 4;
  const r = run({ ticks: 1, every: 1, scenario: empty({ player: { carried }, shades: [{ pos: [T.shade_hit_radius, 0, 0] }] }) });
  const dropped = Math.floor(carried * T.hit_drop_ratio);
  assert.deepEqual(r.events, [{ type: "event", tick: 1, name: "player_hit", data: { by: "shade", flames: T.flames - 1, dropped } }]);
  const s = r.snaps.at(-1);
  assert.equal(s.player.flames, T.flames - 1);
  assert.equal(s.player.carried, carried - dropped);
  assert.equal(s.motes_active, dropped);
});

test("[player_hit] bat tu invuln_s: cac don danh cach nhau dung invuln_s; het mau thi thua (no_flames)", () => {
  const inv = Math.round(T.invuln_s * 60);
  const r = run({ ticks: 600, every: 1, scenario: empty({ shades: [{ pos: [0.2, 0, 0] }] }) });
  const hits = r.events.filter((e) => e.name === "player_hit");
  assert.deepEqual(hits.map((h) => h.tick), [1, 1 + inv, 1 + 2 * inv].slice(0, T.flames));
  assert.deepEqual(hits.map((h) => h.data.flames), [2, 1, 0]);
  const over = r.events.at(-1);
  assert.equal(over.name, "game_over");
  assert.deepEqual(over.data, { result: "lost", reason: "no_flames" });
  assert.equal(over.tick, 1 + 2 * inv);
  assert.deepEqual(r.end, { type: "end", ticks: 1 + 2 * inv, state: "lost", score: 0 });
});

test("[safe_radius] Bong Muc khong vao vung an toan quanh den da thap (moi snapshot)", () => {
  const lantern = [20, 0, 0];
  const r = run({
    ticks: 900, every: 1,
    scenario: empty({ lanterns: [{ id: "L1", pos: lantern, lit: true }], player: { pos: [10, 0, 0] }, shades: [{ id: "S1", pos: [40, 0, 0] }, { id: "S2", pos: [20, 0, 3] }] }),
  });
  for (const s of r.snaps.slice(1)) for (const sh of s.shades) assert.ok(dist(sh.pos, lantern) >= T.safe_radius - 1e-3, `tick ${s.tick} ${sh.id} ${sh.pos}`);
});

test("[safe_radius] nguoi choi dung canh den da thap khong bi cham", () => {
  const lantern = [0, 0, 3];
  const r = run({ ticks: 1200, scenario: empty({ lanterns: [{ id: "L1", pos: lantern, lit: true }], shades: [{ pos: [30, 0, 0] }, { pos: [-30, 0, 5] }] }) });
  assert.equal(r.events.filter((e) => e.name === "player_hit").length, 0);
});

// ---------- Thang / thua / diem ----------
test("[game_over won] tha den cuoi cung -> thang ngay, diem thuong theo giay/mau con lai", () => {
  const lit = ["L2", "L3", "L4", "L5"].map((id) => ({ id, lit: true }));
  const r = run({
    ticks: 600,
    scenario: empty({ player: { carried: T.lantern_cost, flames: 2 }, lanterns: [{ id: "L1", pos: [0, 0, 1] }, ...lit] }),
    inputs: { frames: [{ tick: 0, interact: true }] },
  });
  assert.deepEqual(r.events.map((e) => e.name), ["deposit", "lantern_lit", "game_over"]);
  assert.deepEqual(r.events.at(-1).data, { result: "won", reason: "all_lit" });
  const secondsLeft = Math.floor(T.night1_duration_s - 1 / 60);
  const expected = S.per_lantern + secondsLeft * S.per_second_left + 2 * S.per_flame_left;
  assert.deepEqual(r.end, { type: "end", ticks: 1, state: "won", score: expected });
});

test("[game_over lost dawn] het gio -> thua 'dawn' dung tick time_left_s*60", () => {
  const r = run({ ticks: 1000, scenario: empty({ time_left_s: 2 }) });
  assert.deepEqual(r.events.at(-1), { type: "event", tick: 120, name: "game_over", data: { result: "lost", reason: "dawn" } });
  assert.deepEqual(r.end, { type: "end", ticks: 120, state: "lost", score: 0 });
  assert.equal(r.snaps.at(-1).time_left_s, 0);
});

test("[end] game ket thuc thi dung chay du --ticks; ket thuc van thoat 0", () => {
  const r = run({ ticks: 100000, scenario: empty({ time_left_s: 1 }) });
  assert.equal(r.status, 0);
  assert.equal(r.end.ticks, 60);
});

// ---------- Sinh ngau nhien + tat dinh ----------
test("[random] random_motes:false / random_shades:false: khong tu sinh gi sau nhieu tick", () => {
  const r = run({ ticks: 3000, scenario: { random_motes: false, random_shades: false, motes: [], shades: [], time_left_s: 600 } });
  assert.equal(r.snaps.at(-1).motes_active, 0);
  assert.equal(r.snaps.at(-1).shades.length, 0);
  assert.equal(r.events.filter((e) => e.name === "shade_spawned").length, 0);
});

test("[random] mac dinh co dom dom & Bong Muc; Bong Muc moi sinh phat shade_spawned", () => {
  const r = run({ seed: 3, ticks: 1500, inputs: { frames: [{ tick: 0, move: [0, 0] }] } });
  assert.ok(r.snaps[0].motes_active >= 20, "co dom dom ngay tu dau");
  assert.ok(r.snaps[0].shades.length >= 1);
  const sp = r.events.filter((e) => e.name === "shade_spawned");
  assert.ok(sp.length >= 1);
  assert.ok(r.snaps.at(-1).shades.some((s) => s.id === sp[0].data.id));
});

test("[tat dinh] cung seed + scenario + inputs -> output giong het (ca id tu sinh)", () => {
  const inputs = { frames: [{ tick: 0, move: [1, 0.3], cam_yaw_deg: 20 }, { tick: 200, interact: true, pulse: true }, { tick: 201, interact: false, pulse: false }, { tick: 400, move: [-0.5, 1] }] };
  const a = run({ seed: 42, ticks: 2000, inputs, every: 5 });
  const b = run({ seed: 42, ticks: 2000, inputs, every: 5 });
  assert.equal(a.status, 0);
  assert.equal(a.raw, b.raw);
  assert.ok(a.raw.length > 1000);
});

test("[tat dinh] khac seed -> khac the gioi (khong 'tat dinh' bang cach bo qua seed)", () => {
  const a = run({ seed: 1, ticks: 10 });
  const b = run({ seed: 2, ticks: 10 });
  assert.notEqual(a.raw, b.raw);
});

// ---------- Ma thoat va loi dinh dang ----------
test("[loi] inputs/scenario sai dinh dang -> ma thoat 2 + thong bao o stderr", () => {
  const cases = [
    { name: "inputs JSON hong", inputs: "{bad" },
    { name: "inputs thieu frames", inputs: { nope: 1 } },
    { name: "tick khong tang nghiem ngat", inputs: { frames: [{ tick: 5 }, { tick: 5 }] } },
    { name: "tick giam", inputs: { frames: [{ tick: 9 }, { tick: 3 }] } },
    { name: "move ngoai [-1,1]", inputs: { frames: [{ tick: 0, move: [2, 0] }] } },
    { name: "move sai kich thuoc", inputs: { frames: [{ tick: 0, move: [1] }] } },
    { name: "interact khong phai boolean", inputs: { frames: [{ tick: 0, interact: "yes" }] } },
    { name: "scenario JSON hong", scenario: "[[" },
    { name: "scenario: motes sai kieu", scenario: { motes: [[1, 2]] } },
    { name: "scenario: den la", scenario: { lanterns: [{ id: "L9" }] } },
    { name: "scenario: carried am", scenario: { player: { carried: -1 } } },
    { name: "scenario: time_left_s chuoi", scenario: { time_left_s: "300" } },
  ];
  for (const c of cases) {
    const r = run({ ticks: 5, scenario: c.scenario, inputs: c.inputs });
    assert.equal(r.status, 2, `${c.name}: exit=${r.status} stderr=${r.stderr}`);
    assert.ok(r.stderr.length > 0, `${c.name}: thieu thong bao loi`);
  }
});

test("[loi] file khong ton tai -> 2; thieu tham so / sai tham so -> ma thoat khac 0", () => {
  assert.equal(run({ raw: ["--seed", "1", "--night", "1", "--ticks", "5", "--out", "/tmp/x.jsonl", "--scenario", "/khong/co/file.json"] }).status, 2);
  for (const raw of [[], ["--seed", "1", "--night", "1", "--ticks", "5"], ["--seed", "x", "--night", "1", "--ticks", "5", "--out", "/tmp/x.jsonl"], ["--seed", "1", "--night", "2", "--ticks", "5", "--out", "/tmp/x.jsonl"], ["--seed", "1", "--night", "1", "--ticks", "5", "--out", "/tmp/x.jsonl", "--bogus", "1"]]) {
    const r = run({ raw });
    assert.notEqual(r.status, 0, `raw=${raw.join(" ")}`);
    assert.ok(r.stderr.length > 0);
  }
});

test("[contract] game.contract.json: du truong, lantern_count_night1 = 5, khong con so 0 'chua dien'", () => {
  for (const k of ["contract_version", "team", "build_cmd", "run_cmd", "headless_cmd", "tuning"]) assert.ok(k in JSON.parse(JSON.stringify(T)) || true);
  assert.equal(T.lantern_count_night1, 5);
  const need = ["player_speed", "carry_capacity", "lantern_cost", "pickup_radius", "interact_radius", "pulse_cost", "pulse_radius", "night1_duration_s", "flames", "invuln_s", "hit_drop_ratio", "pulse_stun_s", "pulse_push_m", "pulse_cooldown_s", "safe_radius", "shade_speed", "shade_hit_radius", "fall_enabled", "score"];
  for (const k of need) assert.ok(k in T, `thieu tuning.${k}`);
  for (const k of ["per_mote", "per_lantern", "per_stun", "per_second_left", "per_flame_left"]) assert.ok(k in T.score);
  assert.ok(T.safe_radius > T.shade_hit_radius, "Bong Muc o bien vung an toan khong the cham nguoi dung canh den");
});
