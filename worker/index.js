/* Pinho's Cake Orders — Cloudflare Worker
   - Serves the app behind one staff PIN (cookie lasts 12 hours, or until "Lock").
   - Stores orders and settings in D1 (binding DB), pictures in R2 (binding PICS).
   - Secrets set in the Cloudflare dashboard: STAFF_PIN (required). PRINTER_KEY is used by the receipt printer (phase 3). */
import APP from './app.html';

const SESSION_HOURS = 12;
const SYNCED = /^(orders|settings)\//;          // collections every device keeps a live copy of
const json = (data, status = 200, extra = {}) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra } });
const fail = (code, message, status = 400) => json({ code, message }, status);

/* ---------- database setup (runs once per Worker instance) ---------- */
let schemaReady = null;
function ensureSchema(env) {
  if (!schemaReady) schemaReady = env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS docs (path TEXT PRIMARY KEY, coll TEXT NOT NULL, data TEXT, deleted INTEGER NOT NULL DEFAULT 0, ver INTEGER NOT NULL)`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS docs_ver ON docs(ver)`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS docs_coll ON docs(coll)`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v INTEGER NOT NULL)`),
    env.DB.prepare(`INSERT OR IGNORE INTO meta (k, v) VALUES ('ver', 0)`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS leases (path TEXT PRIMARY KEY, holder TEXT NOT NULL, exp INTEGER NOT NULL)`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS logins (ip TEXT NOT NULL, at INTEGER NOT NULL)`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS assets (id TEXT PRIMARY KEY, type TEXT, size INTEGER, at INTEGER)`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY, created INTEGER NOT NULL, label TEXT, png TEXT, status TEXT NOT NULL, code TEXT, tries INTEGER NOT NULL DEFAULT 0, updated INTEGER)`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS jobs_status ON jobs(status, created)`)
  ]).catch(e => { schemaReady = null; throw e; });
  return schemaReady;
}

/* ---------- PIN sessions ---------- */
const enc = new TextEncoder();
async function hmac(secret, msg) {
  const key = await crypto.subtle.importKey('raw', enc.encode('pinhos:' + secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(msg));
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/[+/=]/g, c => ({ '+': '-', '/': '_', '=': '' }[c]));
}
function cookieOf(req, name) { const m = (req.headers.get('cookie') || '').match(new RegExp('(?:^|; )' + name + '=([^;]+)')); return m ? decodeURIComponent(m[1]) : null; }
async function authed(req, env) {
  if (!env.STAFF_PIN) return false;
  const c = cookieOf(req, 'pb_s'); if (!c) return false;
  const [exp, sig] = c.split('.'); if (!exp || !sig || +exp < Date.now()) return false;
  return sig === await hmac(env.STAFF_PIN, exp);
}
async function login(req, env) {
  const ip = req.headers.get('cf-connecting-ip') || 'local'; const now = Date.now();
  const form = await req.formData(); const pin = String(form.get('pin') || '').trim();
  await env.DB.prepare('DELETE FROM logins WHERE at < ?').bind(now - 15 * 60e3).run();
  const { n } = await env.DB.prepare('SELECT COUNT(*) AS n FROM logins WHERE ip = ?').bind(ip).first();
  if (n >= 10) return loginPage('Too many wrong tries. Wait 15 minutes and try again.', 429);
  if (!env.STAFF_PIN) return loginPage('The PIN has not been set up yet. Add STAFF_PIN in the Cloudflare dashboard.', 500);
  if (pin !== String(env.STAFF_PIN)) { await env.DB.prepare('INSERT INTO logins (ip, at) VALUES (?, ?)').bind(ip, now).run(); return loginPage('That PIN is not right. Try again.', 401); }
  const exp = String(now + SESSION_HOURS * 3600e3);
  const val = exp + '.' + await hmac(env.STAFF_PIN, exp);
  return new Response(null, { status: 303, headers: { location: '/', 'set-cookie': `pb_s=${encodeURIComponent(val)}; Path=/; Max-Age=${SESSION_HOURS * 3600}; HttpOnly; Secure; SameSite=Lax` } });
}
const logout = () => new Response(null, { status: 303, headers: { location: '/', 'set-cookie': 'pb_s=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax' } });
function loginPage(msg = '', status = 200) {
  return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Pinho’s Cake Orders</title><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;700;800&family=Great+Vibes&display=swap">
<style>:root{color-scheme:light}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#FBF7F0;color:#2B2A33;font:17px/1.4 Nunito,system-ui,sans-serif}
form{width:min(360px,calc(100% - 32px));background:#fff;border:1px solid #ECE4D8;border-radius:20px;padding:28px 24px;box-shadow:0 6px 24px rgba(80,60,30,.08);display:flex;flex-direction:column;gap:14px;text-align:center}
h1{margin:0;font:400 3rem/1 'Great Vibes',cursive;color:#3D6FB6}p{margin:0;color:#6E6A73}
input{font:800 1.8rem Nunito,sans-serif;letter-spacing:.4em;text-align:center;padding:12px;border:1.5px solid #DDD3C4;border-radius:999px;outline:none}
input:focus{border-color:#3D6FB6;box-shadow:0 0 0 3px #E6EEF9}button{font:800 1.05rem Nunito,sans-serif;min-height:52px;border:0;border-radius:999px;background:#3D6FB6;color:#fff;cursor:pointer}
.err{color:#B4483C;font-weight:700}</style></head><body>
<form method="post" action="/login"><h1>Pinho’s</h1><p>Cake orders · enter the staff PIN</p>
<input name="pin" type="password" inputmode="numeric" autocomplete="current-password" autofocus required aria-label="Staff PIN">
${msg ? `<p class="err" role="alert">${msg}</p>` : ''}<button type="submit">Unlock</button></form></body></html>`, { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}

/* ---------- documents ---------- */
const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
function merge(a, b) { const out = { ...a }; for (const k of Object.keys(b)) out[k] = isObj(a[k]) && isObj(b[k]) ? merge(a[k], b[k]) : b[k]; return out; }
const collOf = p => p.split('/').slice(0, -1).join('/');
const validPath = p => typeof p === 'string' && /^[A-Za-z0-9_-]+(\/[A-Za-z0-9_.:-]+)+$/.test(p) && p.split('/').length % 2 === 0 && p.length < 300;

async function readDoc(env, path) {
  const r = await env.DB.prepare('SELECT data, deleted, ver FROM docs WHERE path = ?').bind(path).first();
  return r && !r.deleted ? { data: JSON.parse(r.data), ver: r.ver } : { data: null, ver: r ? r.ver : null };
}
const BUMP = env => env.DB.prepare(`UPDATE meta SET v = v + 1 WHERE k = 'ver'`);
async function writeDoc(env, op, path, data) {
  if (!validPath(path)) return fail('invalid_argument', 'Bad document path.');
  const coll = collOf(path);
  if (op === 'delete') {
    await env.DB.batch([BUMP(env), env.DB.prepare(`UPDATE docs SET data = NULL, deleted = 1, ver = (SELECT v FROM meta WHERE k = 'ver') WHERE path = ?`).bind(path)]);
    return json({ ok: true, data: null });
  }
  if (!isObj(data)) return fail('invalid_argument', 'Document data must be an object.');
  if (JSON.stringify(data).length > 900000) return fail('too_large', 'That record is too large to save.');
  if (op === 'set') {
    const body = JSON.stringify(data);
    await env.DB.batch([BUMP(env), env.DB.prepare(`INSERT INTO docs (path, coll, data, deleted, ver) VALUES (?, ?, ?, 0, (SELECT v FROM meta WHERE k = 'ver'))
      ON CONFLICT(path) DO UPDATE SET data = excluded.data, deleted = 0, ver = excluded.ver`).bind(path, coll, body)]);
    return json({ ok: true, data });
  }
  if (op === 'update') {
    for (let i = 0; i < 6; i++) {           // optimistic: re-read and retry if another device wrote in between
      const cur = await env.DB.prepare('SELECT data, deleted, ver FROM docs WHERE path = ?').bind(path).first();
      if (!cur || cur.deleted) return fail('invalid_argument', 'That record no longer exists.', 404);
      const next = merge(JSON.parse(cur.data), data);
      const res = await env.DB.batch([BUMP(env), env.DB.prepare(`UPDATE docs SET data = ?, ver = (SELECT v FROM meta WHERE k = 'ver') WHERE path = ? AND ver = ?`).bind(JSON.stringify(next), path, cur.ver)]);
      if (res[1].meta.changes === 1) return json({ ok: true, data: next });
    }
    return fail('busy', 'Another device is saving this order right now. Try again in a moment.', 409);
  }
  return fail('invalid_argument', 'Unknown operation.');
}
async function sync(env, since) {
  const { v } = await env.DB.prepare(`SELECT v FROM meta WHERE k = 'ver'`).first();
  const rows = since > 0
    ? (await env.DB.prepare(`SELECT path, data, deleted, ver FROM docs WHERE ver > ? AND (coll = 'orders' OR coll = 'settings') ORDER BY ver`).bind(since).all()).results
    : (await env.DB.prepare(`SELECT path, data, deleted, ver FROM docs WHERE deleted = 0 AND (coll = 'orders' OR coll = 'settings')`).all()).results;
  return json({ ver: Math.max(v, ...rows.map(r => r.ver)), reset: since === 0, docs: rows.map(r => ({ path: r.path, data: r.deleted ? null : JSON.parse(r.data) })) });
}
async function query(env, coll, where) {
  const rows = (await env.DB.prepare('SELECT path, data FROM docs WHERE coll = ? AND deleted = 0').bind(coll).all()).results;
  const docs = rows.map(r => ({ path: r.path, data: JSON.parse(r.data) }))
    .filter(d => where.every(([f, op, v]) => { const x = d.data[f]; return op === '>=' ? x >= v : op === '<=' ? x <= v : op === '==' ? x === v : true; }))
    .sort((a, b) => a.path < b.path ? -1 : 1);
  return json({ docs });
}
async function lease(env, { path, holder, ttlMs }) {
  if (!validPath(path) || !holder) return fail('invalid_argument', 'Bad lease request.');
  const now = Date.now(); const exp = now + Math.min(Math.max(+ttlMs || 4000, 500), 120000);
  await env.DB.prepare(`INSERT INTO leases (path, holder, exp) VALUES (?, ?, ?)
    ON CONFLICT(path) DO UPDATE SET holder = excluded.holder, exp = excluded.exp WHERE leases.exp < ? OR leases.holder = excluded.holder`).bind(path, holder, exp, now).run();
  const r = await env.DB.prepare('SELECT holder, exp FROM leases WHERE path = ?').bind(path).first();
  return json(r.holder === holder ? { acquired: true, holder, expiresAt: new Date(r.exp).toISOString() } : { acquired: false, expiresAt: new Date(r.exp).toISOString() });
}

/* ---------- pictures (R2) ---------- */
const IMG_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
async function uploadAsset(req, env) {
  if (!env.PICS) return fail('store_unavailable', 'Picture storage (R2) is not connected.', 503);
  const type = (req.headers.get('content-type') || '').split(';')[0];
  if (!IMG_TYPES.includes(type)) return fail('unsupported_type', 'Use a JPEG or PNG photo.');
  const body = await req.arrayBuffer();
  if (body.byteLength > 20 * 1024 * 1024) return fail('too_large', 'That file is too large.', 413);
  const id = crypto.randomUUID().replace(/-/g, '');
  await env.PICS.put(id, body, { httpMetadata: { contentType: type } });
  await env.DB.prepare('INSERT INTO assets (id, type, size, at) VALUES (?, ?, ?, ?)').bind(id, type, body.byteLength, Date.now()).run();
  return json({ id, contentType: type, sizeBytes: body.byteLength });
}
async function getAsset(env, id) {
  if (!env.PICS || !/^[a-f0-9]{32}$/.test(id)) return new Response('Not found', { status: 404 });
  const obj = await env.PICS.get(id); if (!obj) return new Response('Not found', { status: 404 });
  return new Response(obj.body, { headers: { 'content-type': obj.httpMetadata?.contentType || 'application/octet-stream', 'cache-control': 'private, max-age=31536000, immutable' } });
}

/* ---------- router ---------- */
export default {
  async fetch(req, env) {
    const url = new URL(req.url); const p = url.pathname;
    try {
      await ensureSchema(env);
      if (p.startsWith('/cloudprnt/') && typeof handlePrinter === 'function') return handlePrinter(req, env, url);
      if (p === '/login' && req.method === 'POST') return login(req, env);
      if (p === '/logout') return logout();
      const ok = await authed(req, env);
      if (p === '/' || p === '/index.html') return ok ? new Response(APP, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } }) : loginPage();
      if (!ok) return p.startsWith('/api/') ? fail('revoked', 'Locked. Enter the PIN again.', 401) : Response.redirect(url.origin + '/', 302);
      if (p.startsWith('/a/')) return getAsset(env, decodeURIComponent(p.slice(3)));
      if (p === '/api/sync') return sync(env, +url.searchParams.get('since') || 0);
      if (p === '/api/doc') { const path = url.searchParams.get('path'); if (!validPath(path)) return fail('invalid_argument', 'Bad document path.'); return json(await readDoc(env, path)); }
      if (p === '/api/query') return query(env, url.searchParams.get('coll') || '', JSON.parse(url.searchParams.get('where') || '[]'));
      if (p === '/api/write' && req.method === 'POST') { const b = await req.json(); return writeDoc(env, b.op, b.path, b.data); }
      if (p === '/api/lease' && req.method === 'POST') return lease(env, await req.json());
      if (p === '/api/asset' && req.method === 'POST') return uploadAsset(req, env);
      if (p.startsWith('/api/print') && typeof handlePrintApi === 'function') return handlePrintApi(req, env, url);
      return new Response('Not found', { status: 404 });
    } catch (e) {
      console.error(e);
      return p.startsWith('/api/') ? fail('unavailable', 'The server had a problem: ' + (e && e.message || e), 500) : new Response('The site had a problem. Try again in a moment.', { status: 500 });
    }
  }
};
