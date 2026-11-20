#!/usr/bin/env node
// Hook "Stop" cua Claude Code: chan agent ket thuc luot khi test dang do.
// Exit code 2 = chan, stderr duoc dua lai cho agent. Cau hinh o .claude/settings.json.
import { spawnSync } from "node:child_process";

const r = spawnSync("npm", ["test", "--silent"], { encoding: "utf8", shell: process.platform === "win32" });
if (r.status !== 0) {
  console.error("Test dang do - hay sua truoc khi ket thuc.\n" + (r.stdout + r.stderr).slice(-2000));
  process.exit(2);
}
