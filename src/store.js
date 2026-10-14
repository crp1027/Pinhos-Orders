/* ===== store.js — shared database (db capability), assets, leases ===== */
function lsGet(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } }
function lsSet(k, v) { try { if (v === undefined) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch { } }
const DEV_ID = (() => { let v = lsGet('pb.devid', null); if (!v) { v = uid(10); lsSet('pb.devid', v); } return v; })();
function deviceName() { return lsGet('pb.devname', '') || 'Unnamed device'; }
const sleep = ms => new Promise(r => setTimeout(r, ms));
const blobUrl = id => id ? (window.__assetUrl ? window.__assetUrl(id) : '/_blob/' + id) : '';

const Store = {
  db: null, assets: null, downloads: null,
  ready: false, status: 'connecting', error: null, canEdit: true,
  orders: new Map(), presets: DEFAULT_PRESETS, presetsRev: 0, calendar: DEFAULT_CALENDAR, calRev: 0, menu: null, menuRev: 0, demoAnchor: null,
  lastSync: null, subs: [], listeners: new Set(), chosenMode: lsGet('pb.mode', null), autoMode: 'live',
  get mode() { return this.chosenMode || this.autoMode; }
};
function emit() { for (const f of Store.listeners) { try { f(); } catch (e) { console.error(e); } } }
function setMode(m) { Store.chosenMode = m; lsSet('pb.mode', m); emit(); }

function errText(e) {
  const c = e && e.code;
  const map = {
    unavailable: 'The bakery records could not be reached. Check the internet connection and try again.',
    store_unavailable: 'Image storage could not be reached. Try again.',
    resource_exhausted: 'Too many changes at once. Wait a few seconds and try again.',
    quota_exceeded: 'The records store is full. Older orders need to be archived or practice orders deleted.',
    quota_or_state: 'Image storage is full or unavailable.',
    revoked: 'Access to the bakery records was removed on this device. Reload the page or sign in again.',
    not_granted: 'This device was not given access to the bakery records.',
    invalid_argument: 'The change could not be saved because it was not accepted by the records store.',
    too_large: 'That file is too large.',
    unsupported_type: 'That file type is not supported. Use a JPEG or PNG photo.',
    busy: 'Another device is saving this order right now. Try again in a moment.',
    rate_limited: 'Too many tries in a row. Wait a moment and try again.',
    declined: 'The save was declined.'
  };
  return map[c] || (e && e.message) || 'Something went wrong. Try again.';
}
async function retry(fn) {
  try { return await fn(); }
  catch (e) {
    if (e && (e.code === 'unavailable' || e.code === 'store_unavailable')) { await sleep(400 + Math.random() * 600); return await fn(); }
    throw e;
  }
}
function isObj(v) { return v && typeof v === 'object' && !Array.isArray(v); }
function deepMerge(a, b) {
  const out = { ...a };
  for (const k of Object.keys(b)) out[k] = isObj(a[k]) && isObj(b[k]) ? deepMerge(a[k], b[k]) : b[k];
  return out;
}

async function initStore() {
  const C = window.claude;
  if (!C || typeof C.use !== 'function') { Store.status = 'nodb'; emit(); return; }
  const [db, assets, downloads, user] = await Promise.all(['db', 'assets', 'downloads', 'user'].map(n => C.use(n).catch(() => null)));
  Store.db = db; Store.assets = assets; Store.downloads = downloads;
  try { Store.canEdit = user ? await user.canEdit() : true; } catch { Store.canEdit = true; }
  if (!db) { Store.status = 'nodb'; emit(); return; }
  subscribe();
  setInterval(() => { if (Store.status === 'live' && Store.lastSync && Date.now() - Store.lastSync > 75000) refreshNow(true); }, 30000);
}
function ingestOrders(docs) {
  const m = new Map();
  for (const d of docs) { const v = d.data(); if (v && v.createdAt) m.set(d.id, { ...v, id: d.id }); }
  Store.orders = m; Store.lastSync = Date.now(); Store.status = 'live'; Store.ready = true;
  let real = false; for (const o of m.values()) if (!o.demo) { real = true; break; }
  Store.autoMode = real ? 'live' : 'demo';
}
function subscribe() {
  for (const u of Store.subs) try { u(); } catch { }
  Store.subs = []; Store.status = 'connecting'; Store.error = null; emit();
  const db = Store.db;
  const onErr = e => { Store.status = 'error'; Store.error = e; emit(); };
  Store.subs.push(db.collection('orders').onSnapshot(snap => { ingestOrders(snap.docs); emit(); maybeArchive(); }, onErr));
  Store.subs.push(db.doc('settings/presets').onSnapshot(s => {
    const d = s.exists ? s.data() : null;
    if (d && d.types) { Store.presets = { ...DEFAULT_PRESETS, ...d }; Store.presetsRev = d.rev || 0; }
    emit();
  }, onErr));
  Store.subs.push(db.doc('settings/menu').onSnapshot(s => {
    const d = s.exists ? s.data() : null;
    if (d && d.standard) { Store.menu = { ...DEFAULT_MENU, ...d }; Store.menuRev = d.rev || 0; }
    emit();
  }, onErr));
  Store.subs.push(db.doc('settings/demo').onSnapshot(s => { const d = s.exists ? s.data() : null; Store.demoAnchor = d && d.anchor || null; emit(); }, onErr));
  Store.subs.push(db.doc('settings/calendar').onSnapshot(s => {
    const d = s.exists ? s.data() : null;
    if (d && d.closedWeekdays) { Store.calendar = { closedWeekdays: d.closedWeekdays, exceptions: d.exceptions || {} }; Store.calRev = d.rev || 0; }
    emit();
  }, onErr));
}
async function refreshNow(silent) {
  if (!Store.db) return;
  try { const snap = await Store.db.collection('orders').get(); ingestOrders(snap.docs); emit(); }
  catch (e) { if (!silent) throw e; }
}
function visibleOrders() {
  const demo = Store.mode === 'demo';
  const out = []; for (const o of Store.orders.values()) if (!!o.demo === demo) out.push(o);
  return out;
}
function getOrder(id) { return Store.orders.get(id) || null; }

async function withLease(ref, fn) {
  for (let i = 0; i < 16; i++) {
    let r;
    try { r = await ref.acquire({ holder: DEV_ID, ttlMs: 4000 }); }
    catch (e) { if (e && (e.code === 'capability_removed')) return fn(); throw e; }
    if (r && r.acquired) return fn();
    await sleep(250 + Math.random() * 300);
  }
  throw { code: 'busy' };
}
async function patchOrder(id, patch, hist) {
  const p = { ...patch, updatedAt: Date.now() };
  if (hist) p.history = deepMerge(p.history || {}, { [uid()]: { at: Date.now(), text: hist, dev: deviceName() } });
  await retry(() => Store.db.doc('orders/' + id).update(p));
}
async function claimNumber(demo) {
  const ref = Store.db.doc('settings/counter');
  return withLease(ref, async () => {
    const s = await ref.get(); const d = (s.exists && s.data()) || {};
    const key = demo ? 'demoNext' : 'next';
    let n = d[key] || (demo ? 9001 : 1001);
    const used = new Set(); for (const o of Store.orders.values()) used.add(o.num);
    while (used.has(n)) n++;
    await retry(() => ref.set({ next: d.next || 1001, demoNext: d.demoNext || 9001, ...{ [key]: n + 1 } }));
    return n;
  });
}

/* ----- archive: keeps the live collection small (5,000-document store cap) ----- */
async function maybeArchive() {
  if (Store._archTried || Store.status !== 'live') return; Store._archTried = true;
  try {
    const cutoff = addDays(todayNY(), -21);
    const elig = [...Store.orders.values()].filter(o => o.pickupDate && o.pickupDate < cutoff && (o.booking === 'canceled' || orderClosed(o)));
    if (!elig.length) return;
    const lock = Store.db.doc('settings/archiver');
    const r = await lock.acquire({ holder: DEV_ID, ttlMs: 60000 }); if (!r.acquired) return;
    const byDate = {}; for (const o of elig.slice(0, 120)) (byDate[o.pickupDate] = byDate[o.pickupDate] || []).push(o);
    for (const [date, list] of Object.entries(byDate)) {
      let k = 1;
      while (list.length) {
        const docId = k === 1 ? date : `${date}.${k}`;
        const ref = Store.db.doc('archive/' + docId);
        const s = await ref.get(); const cur = s.exists && s.data() && s.data().orders ? { ...s.data().orders } : {};
        let size = JSON.stringify(cur).length; const moved = [];
        while (list.length && size + JSON.stringify(list[0]).length < 200000) { const o = list.shift(); const { id, ...body } = o; cur[id] = body; moved.push(id); size += JSON.stringify(body).length; }
        if (moved.length) {
          await retry(() => ref.set({ date, orders: cur }));
          for (const id of moved) await retry(() => Store.db.doc('orders/' + id).delete());
        }
        k++; if (k > 20) break;
      }
    }
  } catch (e) { console.warn('archive skipped', e); }
}
async function loadArchive(from, to) {
  const snap = await retry(() => Store.db.collection('archive').where('date', '>=', from).where('date', '<=', to).get());
  const out = [];
  for (const d of snap.docs) { const v = d.data(); for (const [id, o] of Object.entries((v && v.orders) || {})) out.push({ ...o, id, archived: true }); }
  return out;
}

/* ----- presets & calendar ----- */
async function savePresets(next) {
  const ref = Store.db.doc('settings/presets');
  return withLease(ref, async () => {
    const s = await ref.get(); const cur = s.exists ? s.data() : null;
    if (cur && (cur.rev || 0) !== Store.presetsRev) throw { code: 'conflict', message: 'Preset options were changed on another device. Your view has been refreshed; make your change again.' };
    await retry(() => ref.set({ ...next, rev: (cur && cur.rev || 0) + 1, updatedAt: Date.now() }));
  });
}
async function saveMenu(next) {
  const ref = Store.db.doc('settings/menu');
  return withLease(ref, async () => {
    const s = await ref.get(); const cur = s.exists ? s.data() : null;
    if (cur && cur.standard && (cur.rev || 0) !== Store.menuRev) throw { code: 'conflict', message: 'The menu was changed on another device. Your view has been refreshed; make your change again.' };
    await retry(() => ref.set({ ...next, rev: (cur && cur.rev || 0) + 1, updatedAt: Date.now(), updatedDev: deviceName() }));
  });
}
/** Fresh copies of orders straight from the store (used to catch changes made on another device). */
async function freshOrders(ids) {
  const out = new Map();
  await Promise.all([...new Set(ids)].map(async id => { const s = await retry(() => Store.db.doc('orders/' + id).get()); if (s.exists) out.set(id, { ...s.data(), id }); }));
  return out;
}
async function saveCalendar(next) {
  const ref = Store.db.doc('settings/calendar');
  return withLease(ref, async () => {
    const s = await ref.get(); const cur = s.exists ? s.data() : null;
    await retry(() => ref.set({ closedWeekdays: next.closedWeekdays, exceptions: next.exceptions || {}, rev: (cur && cur.rev || 0) + 1, updatedAt: Date.now() }));
  });
}
async function deleteDemoOrders() {
  let n = 0;
  for (const o of [...Store.orders.values()]) if (o.demo) { await retry(() => Store.db.doc('orders/' + o.id).delete()); n++; }
  try {
    const snap = await Store.db.collection('archive').get();
    for (const d of snap.docs) {
      const v = d.data(); const ords = { ...(v.orders || {}) }; let ch = false;
      for (const [id, o] of Object.entries(ords)) if (o.demo) { delete ords[id]; ch = true; n++; }
      if (ch) await retry(() => Store.db.doc('archive/' + d.id).set({ date: v.date, orders: ords }));
    }
  } catch (e) { console.warn(e); }
  return n;
}

/* ----- images ----- */
async function toCanvasBlob(file, maxDim, quality = 0.86) {
  const bmp = await createImageBitmap(file);
  const sc = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * sc); c.height = Math.round(bmp.height * sc);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', quality));
  return { blob, w: bmp.width, h: bmp.height };
}
async function uploadImage(file) {
  if (!Store.assets) throw { code: 'not_granted', message: 'Image upload is not available on this device.' };
  const okType = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(file.type);
  let original = file, note = '';
  if (!okType || file.size > 19.5 * 1024 * 1024) {
    const r = await toCanvasBlob(file, 4096, 0.92); original = r.blob;
    note = !okType ? 'Converted to JPEG for storage.' : 'Reduced to fit the 20 MB storage limit.';
  }
  const thumb = await toCanvasBlob(file, 480, 0.82);
  const up = await retry(() => Store.assets.upload(original));
  const upT = await retry(() => Store.assets.upload(thumb.blob));
  return { asset: up.id, thumb: upT.id, name: file.name || 'photo', note, w: thumb.w, h: thumb.h };
}
