// May chu tinh: phai cho phep dung cac tep ban choi can, tren CA Windows (\) lan POSIX (/).
// Loi that da gap: tren Windows, "src\core\sim.mjs" bi chan 403 vi so sanh voi "src/core/".
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { resolveAllowed } from "../scripts/static-paths.mjs";

const cases = [
  ["posix", path.posix, "/home/u/repo"],
  ["win32", path.win32, "D:\\Projects\\repo"],
];

for (const [name, p, root] of cases) {
  test(`[serve] ${name}: cho phep web/, src/core/, game.contract.json`, () => {
    for (const url of ["/web/index.html", "/web/main.js", "/web/vendor/three.module.min.js", "/src/core/sim.mjs", "/src/core/rng.mjs", "/game.contract.json"]) {
      const f = resolveAllowed(url, root, p);
      assert.ok(f, `${name} phai cho phep ${url}`);
      assert.ok(f.startsWith(root), `${f} phai nam trong ${root}`);
    }
  });

  test(`[serve] ${name}: chan .env, .git, package.json, src/headless, traversal`, () => {
    for (const url of ["/.env", "/.git/config", "/package.json", "/src/headless/cli.mjs", "/src/core/../headless/cli.mjs", "/web/../package.json", "/web/%2e%2e/package.json", "/web\\..\\.env", "/..%5c..%5cWindows", "/docs/notes/ai-log.md", "/%zz"]) {
      assert.equal(resolveAllowed(url, root, p), null, `${name} phai chan ${url}`);
    }
  });
}
