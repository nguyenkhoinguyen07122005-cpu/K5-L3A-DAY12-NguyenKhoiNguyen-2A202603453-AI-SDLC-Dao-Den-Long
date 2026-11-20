// Quyet dinh URL nao duoc phuc vu. Tach rieng de test duoc ca duong dan kieu Windows (\) lan POSIX (/).
import path from "node:path";

export const ALLOWED = ["web", "src/core", "src/shared", "game.contract.json"];

/** Tra ve duong dan tep tren dia neu URL duoc phep, nguoc lai null. `p` = path.posix hoac path.win32. */
export function resolveAllowed(urlPath, root, p = path) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return null;
  }
  // Doi het ve dau "/" truoc khi so sanh (Windows normalize() doi "/" thanh "\")
  const rel = p.normalize(decoded).replace(/\\/g, "/").replace(/^\/+/, "");
  if (rel.split("/").includes("..")) return null;
  const ok = ALLOWED.some((a) => rel === a || rel.startsWith(a + "/"));
  if (!ok) return null;
  const file = p.join(root, ...rel.split("/"));
  if (!file.startsWith(p.resolve(root) + p.sep)) return null;
  return file;
}
