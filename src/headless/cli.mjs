#!/usr/bin/env node
// Che do headless theo Test Contract v1.1.
//   node src/headless/cli.mjs --seed <int> --night 1|2|3 [--scenario f.json] [--inputs f.json]
//        --ticks <int> --out f.jsonl [--snapshot-every <int>=10]
// Ma thoat: 0 = ok; 2 = file inputs/scenario sai dinh dang; khac 0 = loi khac (stderr co thong bao).
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createGame, step, snapshot, endLine, lanternIds as lanternIdsOf } from "../core/sim.mjs";
import { FormatError, validateInputs, validateScenario } from "../core/validate.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

class UsageError extends Error {}

function parseArgs(argv) {
  const opts = { "snapshot-every": "10" };
  const known = new Set(["seed", "night", "scenario", "inputs", "ticks", "out", "snapshot-every"]);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) throw new UsageError(`tham so la: ${a}`);
    const key = a.slice(2);
    if (!known.has(key)) throw new UsageError(`khong biet tham so --${key}`);
    if (i + 1 >= argv.length) throw new UsageError(`--${key} thieu gia tri`);
    opts[key] = argv[++i];
  }
  const int = (name, min) => {
    const v = opts[name];
    if (v === undefined) throw new UsageError(`thieu --${name}`);
    if (!/^-?\d+$/.test(v) || Number(v) < min) throw new UsageError(`--${name} phai la so nguyen >= ${min}`);
    return Number(v);
  };
  const seed = int("seed", -2147483648);
  const night = int("night", 1);
  if (![1, 2, 3].includes(night)) throw new UsageError("--night phai la 1, 2 hoac 3");
  const ticksN = int("ticks", 0);
  const every = int("snapshot-every", 1);
  if (!opts.out) throw new UsageError("thieu --out");
  return { seed, night, ticksN, every, scenario: opts.scenario, inputs: opts.inputs, out: opts.out };
}

function readJson(path, what) {
  let text;
  try {
    text = readFileSync(path, "utf8");
  } catch (e) {
    throw new FormatError(`${what}: khong doc duoc '${path}' (${e.code ?? e.message})`);
  }
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new FormatError(`${what}: JSON sai cu phap (${e.message})`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const contract = JSON.parse(readFileSync(join(ROOT, "game.contract.json"), "utf8"));
  const tuning = contract.tuning;
  const lanternIds = lanternIdsOf(args.night);

  const scenario = args.scenario ? validateScenario(readJson(args.scenario, "scenario"), lanternIds) : {};
  const frames = args.inputs ? validateInputs(readJson(args.inputs, "inputs")).frames : [];

  const game = createGame({ seed: args.seed, tuning, night: args.night, scenario });
  const lines = [];
  const push = (o) => lines.push(JSON.stringify(o));

  push(snapshot(game)); // tick 0
  push({ type: "event", tick: 0, name: "night_start", data: { night: args.night } });

  const level = { move: [0, 0], camYawDeg: 0, jump: false, interact: false, pulse: false, dash: false, pause: false };
  let fi = 0;
  for (let k = 0; k < args.ticksN && game.state === "playing"; k++) {
    while (fi < frames.length && frames[fi].tick <= k) {
      const f = frames[fi++];
      if (f.move !== undefined) level.move = f.move;
      if (f.cam_yaw_deg !== undefined) level.camYawDeg = f.cam_yaw_deg;
      for (const b of ["jump", "interact", "pulse", "dash", "pause"]) if (f[b] !== undefined) level[b] = f[b];
    }
    for (const ev of step(game, level)) push(ev);
    if (game.tick % args.every === 0) push(snapshot(game));
  }
  push(endLine(game));
  writeFileSync(args.out, lines.join("\n") + "\n");
}

try {
  main();
} catch (e) {
  if (e instanceof FormatError) {
    console.error(`loi dinh dang: ${e.message}`);
    process.exit(2);
  }
  if (e instanceof UsageError) {
    console.error(`loi tham so: ${e.message}`);
    console.error("dung: --seed <int> --night 1|2|3 [--scenario f.json] [--inputs f.json] --ticks <int> --out f.jsonl [--snapshot-every <int>]");
    process.exit(1);
  }
  console.error(`loi: ${e.stack ?? e}`);
  process.exit(1);
}
