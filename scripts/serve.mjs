#!/usr/bin/env node
// May chu tinh toi gian (khong phu thuoc goi ngoai) cho ban choi 3D.
// Dung: npm run play  -> mo http://localhost:8080  (doi cong: PORT=9000 npm run play)
import { createServer } from "node:http";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveAllowed } from "./static-paths.mjs";
import { addEntry, normalize } from "../src/shared/leaderboard.mjs";

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
// Bang xep hang luu tren dia (Ticket-04): data/leaderboard.json (doi bang bien moi truong LEADERBOARD_FILE).
const LB_FILE = process.env.LEADERBOARD_FILE ?? join(ROOT, "data", "leaderboard.json");
function readBoard() {
  try {
    return normalize(JSON.parse(readFileSync(LB_FILE, "utf8")));
  } catch {
    return []; // chua co hoac hong -> bang rong
  }
}
function writeBoard(entries) {
  mkdirSync(dirname(LB_FILE), { recursive: true });
  const tmp = `${LB_FILE}.tmp`;
  writeFileSync(tmp, JSON.stringify({ entries }, null, 2) + "\n");
  renameSync(tmp, LB_FILE); // ghi nguyen tu: tat may giua chung khong lam hong file
}

// Lenh xuat (khong mo may chu): <run_cmd> --export-leaderboard out.json  ->  {"entries":[...]}
const exportAt = process.argv.indexOf("--export-leaderboard");
if (exportAt !== -1) {
  const out = process.argv[exportAt + 1];
  if (!out) {
    console.error("Dung: node scripts/serve.mjs --export-leaderboard out.json");
    process.exit(2);
  }
  writeFileSync(out, JSON.stringify({ entries: readBoard() }, null, 2) + "\n");
  console.log(`Da xuat ${readBoard().length} muc ra ${out}`);
  process.exit(0);
}

// Chi phuc vu cac thu muc can cho ban choi (xem static-paths.mjs), khong lo repo (.git, .env...).

const server = createServer(async (req, res) => {
  try {
    let path = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (path === "/favicon.ico") {
      res.writeHead(204).end();
      return;
    }
    if (path === "/api/leaderboard") {
      if (req.method === "POST") {
        let body = "";
        for await (const c of req) {
          body += c;
          if (body.length > 4096) throw new Error("qua lon");
        }
        try {
          const r = addEntry(readBoard(), JSON.parse(body));
          writeBoard(r.entries);
          res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(r));
        } catch {
          res.writeHead(400, { "Content-Type": "application/json" }).end(JSON.stringify({ error: "muc xep hang khong hop le" }));
        }
        return;
      }
      res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" }).end(JSON.stringify({ entries: readBoard() }));
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
