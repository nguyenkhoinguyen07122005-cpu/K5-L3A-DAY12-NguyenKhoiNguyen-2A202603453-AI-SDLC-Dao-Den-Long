#!/usr/bin/env node
// May chu tinh toi gian (khong phu thuoc goi ngoai) cho ban choi 3D.
// Dung: npm run play  -> mo http://localhost:8080  (doi cong: PORT=9000 npm run play)
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveAllowed } from "./static-paths.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.PORT ?? 8080);
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};
// Chi phuc vu cac thu muc can cho ban choi (xem static-paths.mjs), khong lo repo (.git, .env...).

const server = createServer(async (req, res) => {
  try {
    let path = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (path === "/favicon.ico") {
      res.writeHead(204).end();
      return;
    }
    if (path === "/") {
      res.writeHead(302, { Location: "/web/index.html" }).end();
      return;
    }
    const file = resolveAllowed(path, ROOT);
    if (!file) {
      res.writeHead(403).end("403");
      return;
    }
    if (!(await stat(file)).isFile()) throw new Error("not file");
    const body = await readFile(file);
    res.writeHead(200, { "Content-Type": TYPES[extname(file)] ?? "application/octet-stream", "Cache-Control": "no-store" }).end(body);
  } catch {
    res.writeHead(404).end("404");
  }
});

server.listen(PORT, () => {
  console.log(`Dao Den Long dang chay: http://localhost:${PORT}  (Ctrl+C de dung)`);
});
