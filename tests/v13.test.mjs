// Test cho Test Contract v1.3 (Ticket-04 "Binh minh v1.0.0"): xep hang, soak, lenh bench/soak, export.
// Ma tieu chi AC-90.. nam trong docs/spec/phase-4.md.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CONTRACT, ROOT } from "./helpers.mjs";
import { addEntry, normalize, validName, validEntry } from "../src/shared/leaderboard.mjs";

const tmp = () => mkdtempSync(join(tmpdir(), "ddl4-"));
const entry = (name, score, at, extra = {}) => ({ name, score, nights_won: 1, achieved_at: at, seed: 42, ...extra });

test("[AC-90] contract v1.3: contract_version, bench_cmd, soak_cmd; khoa v1.0-v1.2 con nguyen", () => {
  assert.equal(CONTRACT.contract_version, "1.3");
  assert.equal(CONTRACT.bench_cmd, "node scripts/bench.mjs");
  assert.equal(CONTRACT.soak_cmd, "node scripts/soak.mjs");
  for (const k of ["team", "build_cmd", "run_cmd", "headless_cmd", "tuning"]) assert.ok(k in CONTRACT, k);
  assert.equal(CONTRACT.tuning.fuel_max, 100); // khoa v1.2
});

test("[AC-91] xep hang: ten 3-12 ky tu [A-Za-z0-9_] (chu cai co dau cung duoc)", () => {
  for (const ok of ["abc", "Nguyen_07", "A1b2C3d4E5f6", "Khôi_Nguyên"]) assert.ok(validName(ok), ok);
  for (const bad of ["ab", "abcdefghijklm", "co space", "a-b-c", "", "a!b", 12345, null]) assert.ok(!validName(bad), String(bad));
});

test("[AC-91] xep hang: muc phai du truong (name, score, nights_won 0-3, achieved_at ISO co mui gio, seed)", () => {
  const good = entry("abc", 10, "2026-11-20T16:00:00+07:00");
  assert.ok(validEntry(good));
  for (const bad of [{ ...good, nights_won: 4 }, { ...good, achieved_at: "2026-11-20 16:00" }, { ...good, achieved_at: "2026-11-20T16:00:00" }, { ...good, score: -1 }, { ...good, seed: 1.5 }, { ...good, name: "ab" }]) assert.ok(!validEntry(bad), JSON.stringify(bad));
});

test("[AC-92] xep hang: diem giam dan; bang diem thi ai dat truoc dung tren (so sanh theo thoi diem that, khac mui gio); top 10", () => {
  let list = [];
  list = addEntry(list, entry("late", 100, "2026-11-20T10:00:00Z")).entries;
  list = addEntry(list, entry("early", 100, "2026-11-20T16:30:00+07:00")).entries; // = 09:30Z, som hon
  list = addEntry(list, entry("top", 500, "2026-11-20T12:00:00Z")).entries;
  assert.deepEqual(list.map((e) => e.name), ["top", "early", "late"]);
  for (let i = 0; i < 15; i++) list = addEntry(list, entry(`p${String(i).padStart(2, "0")}x`, i, "2026-11-20T00:00:00Z")).entries;
  assert.equal(list.length, 10);
  assert.equal(list[0].name, "top");
  const r = addEntry(list, entry("zero", 0, "2026-11-21T00:00:00Z"));
  assert.equal(r.rank, null, "diem thap hon het khong vao top 10");
  assert.throws(() => addEntry(list, entry("x", 1, "bad")));
  assert.deepEqual(normalize({ entries: [{ junk: 1 }, entry("okk", 5, "2026-01-01T00:00:00Z")] }).map((e) => e.name), ["okk"], "bo muc hong");
});

test("[AC-93] --export-leaderboard: bang rong -> {entries: []}; co du lieu -> dung thu tu; ma thoat 0; thieu doi so -> 2", () => {
  const dir = tmp();
  const lb = join(dir, "lb.json");
  const out = join(dir, "out.json");
  const run = (args) => spawnSync(process.execPath, [join(ROOT, "scripts", "serve.mjs"), ...args], { encoding: "utf8", env: { ...process.env, LEADERBOARD_FILE: lb } });
  let r = run(["--export-leaderboard", out]);
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(JSON.parse(readFileSync(out, "utf8")), { entries: [] });
  writeFileSync(lb, JSON.stringify({ entries: [entry("low", 5, "2026-11-20T00:00:00Z"), entry("high", 50, "2026-11-20T01:00:00Z")] }));
  r = run(["--export-leaderboard", out]);
  assert.equal(r.status, 0);
  assert.deepEqual(JSON.parse(readFileSync(out, "utf8")).entries.map((e) => e.name), ["high", "low"]);
  writeFileSync(lb, "{ khong phai json");
  assert.equal(run(["--export-leaderboard", out]).status, 0, "file hong -> bang rong, khong crash");
  assert.deepEqual(JSON.parse(readFileSync(out, "utf8")), { entries: [] });
  assert.equal(run(["--export-leaderboard"]).status, 2);
});

test("[AC-93] may chu: POST /api/leaderboard luu xuong dia, con lai sau khi khoi dong lai may chu", async () => {
  const dir = tmp();
  const lb = join(dir, "lb.json");
  const port = 20000 + Math.floor(Math.random() * 20000);
  const start = () => spawn(process.execPath, [join(ROOT, "scripts", "serve.mjs")], { env: { ...process.env, PORT: String(port), LEADERBOARD_FILE: lb }, stdio: "ignore" });
  const wait = async () => {
    for (let i = 0; i < 50; i++) {
      try {
        return await fetch(`http://127.0.0.1:${port}/api/leaderboard`);
      } catch {
        await new Promise((r) => setTimeout(r, 100));
      }
    }
    throw new Error("server khong len");
  };
  let srv = start();
  try {
    await wait();
    const post = await fetch(`http://127.0.0.1:${port}/api/leaderboard`, { method: "POST", body: JSON.stringify(entry("saved_1", 777, "2026-11-20T16:00:00+07:00")) });
    assert.equal(post.status, 200);
    assert.equal((await post.json()).rank, 1);
    const bad = await fetch(`http://127.0.0.1:${port}/api/leaderboard`, { method: "POST", body: JSON.stringify({ name: "x" }) });
    assert.equal(bad.status, 400);
    srv.kill();
    await new Promise((r) => setTimeout(r, 300));
    srv = start();
    const again = await (await wait()).json();
    assert.deepEqual(again.entries.map((e) => [e.name, e.score]), [["saved_1", 777]]);
    assert.ok(existsSync(lb));
  } finally {
    srv.kill();
  }
});

test("[AC-94] soak: --nights 4 -> dung dinh dang, crashes 0, mem_end <= 1.2 x mem_start, results hop le, xoay vong Dem 1-2-3", () => {
  const out = join(tmp(), "soak.json");
  const r = spawnSync(process.execPath, [join(ROOT, "scripts", "soak.mjs"), "--seed", "7", "--nights", "4", "--out", out], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  const j = JSON.parse(readFileSync(out, "utf8"));
  assert.deepEqual(Object.keys(j), ["nights", "crashes", "results", "mem_start_mb", "mem_end_mb", "duration_s"]);
  assert.equal(j.nights, 4);
  assert.equal(j.crashes, 0);
  assert.equal(j.results.length, 4);
  for (const x of j.results) assert.ok(x === "won" || x === "lost", x);
  assert.ok(j.mem_end_mb <= 1.2 * j.mem_start_mb, `${j.mem_end_mb} > 1.2 x ${j.mem_start_mb}`);
  assert.ok(j.duration_s >= 0);
});

test("[AC-94] soak: tat dinh (cung seed -> cung results) va tham so sai -> ma thoat 2", () => {
  const run = (a) => spawnSync(process.execPath, [join(ROOT, "scripts", "soak.mjs"), ...a], { encoding: "utf8" });
  const o1 = join(tmp(), "a.json");
  const o2 = join(tmp(), "b.json");
  run(["--seed", "3", "--nights", "3", "--out", o1]);
  run(["--seed", "3", "--nights", "3", "--out", o2]);
  assert.deepEqual(JSON.parse(readFileSync(o1, "utf8")).results, JSON.parse(readFileSync(o2, "utf8")).results);
  assert.equal(run(["--nights", "0"]).status, 2);
});
