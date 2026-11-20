// Bao ve ranh gioi "loi thuan": phan hien thi/sang tao KHONG duoc lam doi dau ra headless.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./helpers.mjs";

const coreDir = join(ROOT, "src", "core");
const coreFiles = readdirSync(coreDir).filter((f) => f.endsWith(".mjs"));

test("[purity] src/core khong dung Math.random, Date, performance, process, DOM, mang, file", () => {
  const banned = [/Math\.random/, /\bDate\b/, /performance\./, /\bprocess\./, /\bdocument\b/, /\bwindow\b/, /\bfetch\(/, /from\s+["']node:/, /require\(/];
  for (const f of coreFiles) {
    const src = readFileSync(join(coreDir, f), "utf8").replace(/\/\/.*$/gm, "");
    for (const re of banned) assert.ok(!re.test(src), `${f} dung ${re}`);
  }
});

test("[purity] src/core khong import tu web/ hay headless/ (phu thuoc mot chieu: web -> core)", () => {
  for (const f of coreFiles) {
    const imports = [...readFileSync(join(coreDir, f), "utf8").matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]);
    for (const i of imports) assert.ok(i.startsWith("./"), `${f} import ${i}`);
  }
});

test("[purity] ban choi 3D chi doc trang thai qua API cong khai cua loi (createGame/step/timeLeft)", () => {
  const web = readFileSync(join(ROOT, "web", "main.js"), "utf8");
  const imp = web.match(/import \{([^}]+)\} from "\.\.\/src\/core\/sim\.mjs"/);
  assert.ok(imp, "web/main.js phai import tu src/core/sim.mjs");
  const names = imp[1].split(",").map((x) => x.trim()).sort();
  assert.deepEqual(names, ["TICKS_PER_SECOND", "WORLD", "createGame", "step", "timeLeft"]);
});
