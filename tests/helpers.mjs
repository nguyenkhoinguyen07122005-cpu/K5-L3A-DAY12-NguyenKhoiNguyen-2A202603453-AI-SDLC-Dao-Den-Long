// Tien ich cho test: chay CLI headless that (tien trinh con) va doc JSONL.
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const CONTRACT = JSON.parse(readFileSync(join(ROOT, "game.contract.json"), "utf8"));
export const T = CONTRACT.tuning;
const CLI = join(ROOT, "src", "headless", "cli.mjs");

/** Chay headless. opts: {seed, ticks, scenario, inputs, every, raw: [...tham so tho]} */
export function run({ seed = 1, ticks = 60, scenario, inputs, every, raw } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "ddl-"));
  const out = join(dir, "out.jsonl");
  const args = raw ?? ["--seed", String(seed), "--night", "1", "--ticks", String(ticks), "--out", out];
  if (!raw) {
    if (scenario !== undefined) {
      const p = join(dir, "sc.json");
      writeFileSync(p, typeof scenario === "string" ? scenario : JSON.stringify(scenario));
      args.push("--scenario", p);
    }
    if (inputs !== undefined) {
      const p = join(dir, "in.json");
      writeFileSync(p, typeof inputs === "string" ? inputs : JSON.stringify(inputs));
      args.push("--inputs", p);
    }
    if (every !== undefined) args.push("--snapshot-every", String(every));
  }
  const r = spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8" });
  let lines = [];
  try {
    lines = readFileSync(out, "utf8").trim().split("\n").map((l) => JSON.parse(l));
  } catch {
    /* khong co output (loi) */
  }
  return {
    status: r.status,
    stderr: r.stderr,
    lines,
    raw: (() => {
      try {
        return readFileSync(out, "utf8");
      } catch {
        return "";
      }
    })(),
    snaps: lines.filter((l) => l.type === "snapshot"),
    events: lines.filter((l) => l.type === "event"),
    end: lines.at(-1),
  };
}

/** Scenario "san khau trong": khong sinh ngau nhien, khong con nao, 5 den dat xa nguoi choi. */
export function empty(extra = {}) {
  return { random_motes: false, random_shades: false, motes: [], shades: [], ...extra };
}

export const near = (a, b, eps = 1e-3) => Math.abs(a - b) <= eps;
export const dist = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
