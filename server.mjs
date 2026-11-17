#!/usr/bin/env node
/**
 * 口袋对话 · 本地服务
 *
 * 作用：把聊天数据存成真文件，而不是浏览器存储。
 *   data/state.json        当前数据（原子写入）
 *   data/backups/*.json    历史快照（自动轮转）
 *   /sdcard/.../koudai/    可选的第二份副本，交给网盘 App 同步
 *
 * 只监听 127.0.0.1，不对外网开放。
 *
 * 用法：
 *   node server.mjs                 # 默认 8080
 *   PORT=8080 KOUDAI_SD=/sdcard/Documents/koudai node server.mjs
 */

import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import url from 'node:url';

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const DATA_DIR = process.env.KOUDAI_DATA || path.join(HERE, 'data');
const STATE_FILE = path.join(DATA_DIR, 'state.json');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const SD_DIR = process.env.KOUDAI_SD || '';
const PORT = Number(process.env.PORT || 8080);
const HOST = '127.0.0.1';
const MAX_BODY = 128 * 1024 * 1024;      // 128 MB
const KEEP_BACKUPS = 40;
const BACKUP_MIN_GAP = 6 * 60 * 1000;    // 至少隔 6 分钟才留一份快照

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
};

/* ---------------- 存储 ---------------- */

let memoryState = null;   // 最近一次读到的状态，避免频繁读盘
let lastBackupAt = 0;
let writeChain = Promise.resolve();

function emptyState() {
  return { version: 1, updatedAt: new Date().toISOString(), convs: {}, meta: {} };
}

async function readState() {
  try {
    const txt = await fsp.readFile(STATE_FILE, 'utf8');
    const j = JSON.parse(txt);
    if (!j.convs) j.convs = {};
    if (!j.meta) j.meta = {};
    return j;
  } catch (e) {
    if (e.code === 'ENOENT') return emptyState();
    console.warn('[warn] state.json 读取失败，先当作空：', e.message);
    return emptyState();
  }
}

async function atomicWrite(file, text) {
  const tmp = file + '.' + process.pid + '.tmp';
  await fsp.writeFile(tmp, text, 'utf8');
  await fsp.rename(tmp, file);
}

/** 连续写入串行化，避免并发 PUT 互相覆盖 */
function queueWrite(fn) {
  writeChain = writeChain.then(fn).catch((e) => console.error('[write] 失败：', e.message));
  return writeChain;
}

async function saveState(state) {
  await fsp.mkdir(DATA_DIR, { recursive: true });
  state.updatedAt = new Date().toISOString();
  const text = JSON.stringify(state);
  await atomicWrite(STATE_FILE, text);
  memoryState = state;

  const now = Date.now();
  if (now - lastBackupAt > BACKUP_MIN_GAP) {
    lastBackupAt = now;
    await makeSnapshot(text);
  }
  return text.length;
}

async function makeSnapshot(text) {
  try {
    await fsp.mkdir(BACKUP_DIR, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    await atomicWrite(path.join(BACKUP_DIR, 'state-' + stamp + '.json'), text);
    const files = (await fsp.readdir(BACKUP_DIR)).filter((f) => f.startsWith('state-')).sort();
    const extra = files.length - KEEP_BACKUPS;
    for (let i = 0; i < extra; i++) await fsp.unlink(path.join(BACKUP_DIR, files[i])).catch(() => {});
  } catch (e) {
    console.warn('[warn] 快照失败：', e.message);
  }
}

/** 把当前数据再复制一份到外部目录（交给网盘同步） */
async function copyToSd(text) {
  if (!SD_DIR) return { ok: false, reason: '未配置 KOUDAI_SD' };
  try {
    await fsp.mkdir(SD_DIR, { recursive: true });
    const stamp = new Date().toISOString().slice(0, 10);
    await atomicWrite(path.join(SD_DIR, 'koudai-' + stamp + '.json'), text);
    await atomicWrite(path.join(SD_DIR, 'koudai-latest.json'), text);
    return { ok: true, dir: SD_DIR };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

/* ---------------- HTTP ---------------- */

function send(res, status, body, type) {
  res.writeHead(status, {
    'Content-Type': type || 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(body);
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(new Error('too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function serveStatic(req, res, pathname) {
  let rel = decodeURIComponent(pathname);
  if (rel === '/' || rel === '') rel = '/index.html';
  const file = path.join(HERE, rel);
  const root = path.resolve(HERE);
  if (!path.resolve(file).startsWith(root + path.sep) && path.resolve(file) !== root) {
    send(res, 403, 'forbidden');
    return;
  }
  try {
    const st = await fsp.stat(file);
    if (st.isDirectory()) { send(res, 404, 'not found'); return; }
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Length': st.size,
      'Cache-Control': 'no-cache',
    });
    fs.createReadStream(file).pipe(res);
  } catch (e) {
    send(res, 404, 'not found');
  }
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://' + (req.headers.host || HOST));

  try {
    if (u.pathname === '/api/health') {
      send(res, 200, JSON.stringify({ ok: true, dataDir: DATA_DIR, sd: SD_DIR || null }), 'application/json');
      return;
    }

    if (u.pathname === '/api/state' && req.method === 'GET') {
      const st = memoryState || (await readState());
      memoryState = st;
      send(res, 200, JSON.stringify(st), 'application/json');
      return;
    }

    if (u.pathname === '/api/state' && (req.method === 'PUT' || req.method === 'POST')) {
      const text = await readBody(req, MAX_BODY);
      let parsed;
      try { parsed = JSON.parse(text); } catch (e) { send(res, 400, 'bad json'); return; }
      if (typeof parsed !== 'object' || parsed === null) { send(res, 400, 'bad state'); return; }
      const bytes = await queueWrite(() => saveState(parsed));
      send(res, 200, JSON.stringify({ ok: true, bytes }), 'application/json');
      return;
    }

    if (u.pathname === '/api/backup' && (req.method === 'GET' || req.method === 'HEAD')) {
      const st = memoryState || (await readState());
      const stamp = new Date().toISOString().slice(0, 10);
      const body = JSON.stringify(st, null, 2);
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': 'attachment; filename="koudai-' + stamp + '.json"',
        'Content-Length': Buffer.byteLength(body),
        'Cache-Control': 'no-store',
      });
      res.end(req.method === 'HEAD' ? undefined : body);
      return;
    }

    if (u.pathname === '/api/backup' && req.method === 'POST') {
      const st = memoryState || (await readState());
      const text = JSON.stringify(st);
      await queueWrite(() => makeSnapshot(text));
      const sd = await copyToSd(text);
      send(res, 200, JSON.stringify({ ok: true, snapshot: true, sd }), 'application/json');
      return;
    }

    if (u.pathname === '/api/delete' && req.method === 'POST') {
      const body = await readBody(req, 1024 * 1024);
      let convId = null;
      try { convId = JSON.parse(body).convId; } catch (e) {}
      const st = memoryState || (await readState());
      if (convId && st.convs[convId]) {
        delete st.convs[convId];
        await queueWrite(() => saveState(st));
      }
      send(res, 200, JSON.stringify({ ok: true }), 'application/json');
      return;
    }

    if (u.pathname.startsWith('/api/')) { send(res, 404, 'no such api'); return; }

    // 数据目录和开发脚本不对外提供
    if (u.pathname.startsWith('/data/') || u.pathname.startsWith('/dev/') ||
        u.pathname === '/server.mjs' || u.pathname.startsWith('/server.mjs')) {
      send(res, 404, 'not found');
      return;
    }

    await serveStatic(req, res, u.pathname);
  } catch (e) {
    if (String(e.message) === 'too large') { send(res, 413, 'too large'); return; }
    console.error('[error]', e);
    send(res, 500, 'server error');
  }
});

await fsp.mkdir(DATA_DIR, { recursive: true });
const initial = await readState();
memoryState = initial;
if (!fs.existsSync(STATE_FILE)) await atomicWrite(STATE_FILE, JSON.stringify(initial));

server.listen(PORT, HOST, () => {
  console.log('口袋对话 本地服务已启动');
  console.log('  地址：http://' + HOST + ':' + PORT + '/');
  console.log('  数据：' + STATE_FILE);
  console.log('  快照：' + BACKUP_DIR + '（最多 ' + KEEP_BACKUPS + ' 份）');
  console.log('  外部副本：' + (SD_DIR || '（未配置 KOUDAI_SD）'));
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => { server.close(() => process.exit(0)); });
}
