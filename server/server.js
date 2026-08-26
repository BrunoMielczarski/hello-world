#!/usr/bin/env node
/**
 * Servidor do sistema Protus.
 *
 * Publica o app na rede local e guarda os dados em um banco de dados em
 * arquivo (JSON) no computador que roda o servidor, para que todos os
 * computadores compartilhem o mesmo estoque.
 *
 * Uso: node server/server.js  (opcional: PORT=4040 HOST=0.0.0.0)
 */
const http = require("node:http");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");

const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = process.env.PROTUS_DATA_DIR || path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "protus-db.json");
const BACKUP_DIR = path.join(DATA_DIR, "backups");
const PORT = Number(process.env.PORT) || 4040;
const HOST = process.env.HOST || "0.0.0.0";
const MAX_BODY = 8 * 1024 * 1024;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".md": "text/markdown; charset=utf-8",
};

const emptyDb = () => ({
  rev: 0,
  updatedAt: null,
  state: { materials: [], structures: [], entries: [], orders: [], sequences: { order: 0 } },
});

let db = emptyDb();
let writing = Promise.resolve();

function loadDb() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) return emptyDb();
  try {
    const parsed = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
    return { ...emptyDb(), ...parsed };
  } catch (err) {
    const broken = `${DB_FILE}.corrompido-${Date.now()}`;
    fs.renameSync(DB_FILE, broken);
    console.error(`Banco inválido, arquivo movido para ${broken}. Iniciando vazio.`);
    return emptyDb();
  }
}

/** Grava de forma atômica (arquivo temporário + rename) e mantém um backup diário. */
function saveDb() {
  const snapshot = JSON.stringify(db, null, 2);
  writing = writing.then(async () => {
    const tmp = `${DB_FILE}.tmp`;
    await fsp.writeFile(tmp, snapshot, "utf8");
    await fsp.rename(tmp, DB_FILE);
    const day = new Date().toISOString().slice(0, 10);
    const backup = path.join(BACKUP_DIR, `protus-db-${day}.json`);
    await fsp.mkdir(BACKUP_DIR, { recursive: true });
    await fsp.writeFile(backup, snapshot, "utf8");
  }).catch((err) => console.error("Falha ao gravar o banco", err));
  return writing;
}

const json = (res, status, payload) => {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new Error("Corpo da requisição muito grande."));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function isValidState(state) {
  return (
    state &&
    typeof state === "object" &&
    ["materials", "structures", "entries", "orders"].every((key) => Array.isArray(state[key]))
  );
}

async function handleApi(req, res, pathname) {
  if (pathname === "/api/health") {
    return json(res, 200, { ok: true, rev: db.rev, database: DB_FILE });
  }

  if (pathname === "/api/state") {
    if (req.method === "GET") {
      return json(res, 200, { rev: db.rev, updatedAt: db.updatedAt, state: db.state });
    }
    if (req.method === "PUT" || req.method === "POST") {
      let payload;
      try {
        payload = JSON.parse(await readBody(req));
      } catch (err) {
        return json(res, 400, { error: "JSON inválido." });
      }
      if (!isValidState(payload?.state)) {
        return json(res, 400, { error: "Estado inválido." });
      }
      db.state = payload.state;
      db.rev += 1;
      db.updatedAt = new Date().toISOString();
      await saveDb();
      return json(res, 200, { rev: db.rev, updatedAt: db.updatedAt });
    }
    return json(res, 405, { error: "Método não suportado." });
  }

  return json(res, 404, { error: "Rota não encontrada." });
}

function serveStatic(res, pathname) {
  const relative = pathname === "/" ? "index.html" : decodeURIComponent(pathname).replace(/^\/+/, "");
  const target = path.resolve(ROOT, relative);
  if (!target.startsWith(ROOT + path.sep) && target !== path.join(ROOT, "index.html")) {
    res.writeHead(403).end("Acesso negado");
    return;
  }
  if (target.startsWith(path.join(ROOT, "server", "data"))) {
    res.writeHead(403).end("Acesso negado");
    return;
  }
  fs.stat(target, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Não encontrado");
      return;
    }
    res.writeHead(200, {
      "Content-Type": MIME[path.extname(target).toLowerCase()] || "application/octet-stream",
      "Content-Length": stat.size,
      "Cache-Control": "no-cache",
    });
    fs.createReadStream(target).pipe(res);
  });
}

const server = http.createServer((req, res) => {
  const { pathname } = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  if (pathname.startsWith("/api/")) {
    handleApi(req, res, pathname).catch((err) => {
      console.error(err);
      json(res, 500, { error: "Erro interno do servidor." });
    });
    return;
  }
  serveStatic(res, pathname);
});

function localAddresses() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((iface) => iface && iface.family === "IPv4" && !iface.internal)
    .map((iface) => iface.address);
}

db = loadDb();
server.listen(PORT, HOST, () => {
  const urls = [`http://localhost:${PORT}`, ...localAddresses().map((ip) => `http://${ip}:${PORT}`)];
  console.log("=================================================");
  console.log(" Sistema Protus - servidor de estoque no ar");
  console.log("=================================================");
  console.log(` Banco de dados: ${DB_FILE}`);
  console.log(` Backups diários: ${BACKUP_DIR}`);
  console.log(" Acesse por:");
  urls.forEach((url) => console.log(`   ${url}`));
  console.log(" Login: Protus / Protus@4040");
  console.log(" Para encerrar: Ctrl + C");
});
