/* ===== cloud.js — connects the app to the Cloudflare Worker (replaces Claude's db/assets/downloads) =====
   Same interface the app already uses: db.doc(path).get/set/update/delete/acquire/onSnapshot,
   db.collection(name).where(...).get/onSnapshot, assets.upload, downloads.save.
   Changes from other devices arrive by polling /api/sync every few seconds while the screen is visible. */
(function () {
  window.__cloud = true;
  const POLL_MS = 4000;
  const cache = new Map();              // path -> data (synced paths: orders/*, settings/*)
  let ver = 0, ready = false, readyWaiters = [], failures = 0;
  const listeners = new Set();
  const clone = v => v === undefined ? undefined : JSON.parse(JSON.stringify(v));
  const notify = () => { for (const l of [...listeners]) { try { l(); } catch (e) { console.error(e); } } };

  async function api(url, opts = {}) {
    let r;
    try { r = await fetch(url, { credentials: 'same-origin', ...opts, headers: { ...(opts.body && !(opts.body instanceof Blob) ? { 'content-type': 'application/json' } : {}), ...(opts.headers || {}) } }); }
    catch (e) { throw { code: 'unavailable', message: 'The bakery records could not be reached. Check the internet connection and try again.' }; }
    if (r.status === 401) { location.href = '/'; throw { code: 'revoked', message: 'This device was locked. Enter the PIN again.' }; }
    let body = null; try { body = await r.json(); } catch { }
    if (!r.ok) throw (body && body.code) ? body : { code: r.status >= 500 ? 'unavailable' : 'invalid_argument', message: (body && body.message) || `Server error ${r.status}` };
    return body;
  }
  const post = (url, data) => api(url, { method: 'POST', body: JSON.stringify(data) });

  function apply(docs) {
    for (const d of docs) { if (d.data == null) cache.delete(d.path); else cache.set(d.path, d.data); }
  }
  async function pull() {
    try {
      const r = await api('/api/sync?since=' + ver);
      if (r.reset) cache.clear();
      apply(r.docs); const changed = r.docs.length > 0 || !ready; ver = r.ver; failures = 0;
      if (!ready) { ready = true; readyWaiters.forEach(f => f()); readyWaiters = []; }
      if (changed) notify();
    } catch (e) { failures++; if (failures === 3) console.warn('sync failing', e); }
  }
  const whenReady = () => ready ? Promise.resolve() : new Promise(r => readyWaiters.push(r));
  let timer = null;
  function loop() { clearTimeout(timer); timer = setTimeout(async () => { if (!document.hidden) await pull(); loop(); }, POLL_MS); }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { pull(); loop(); } });
  pull().then(loop);

  const snap = (path, data) => ({ id: path.split('/').pop(), exists: data != null, data: () => clone(data), metadata: { fromCache: false, hasPendingWrites: false } });
  const parentOf = p => p.split('/').slice(0, -1).join('/');

  function docRef(path) {
    return {
      id: path.split('/').pop(), path,
      async get() { const r = await api('/api/doc?path=' + encodeURIComponent(path)); if (r.data == null) cache.delete(path); else if (cache.has(path) || /^(orders|settings)\//.test(path)) cache.set(path, r.data); return snap(path, r.data); },
      async set(data) { const r = await post('/api/write', { op: 'set', path, data }); cache.set(path, r.data); notify(); },
      async update(data) { const r = await post('/api/write', { op: 'update', path, data }); cache.set(path, r.data); notify(); },
      async delete() { await post('/api/write', { op: 'delete', path }); cache.delete(path); notify(); },
      async acquire({ holder, ttlMs }) { return post('/api/lease', { path, holder, ttlMs }); },
      onSnapshot(next, onErr) {
        const f = () => next(snap(path, cache.get(path)));
        whenReady().then(() => { listeners.add(f); f(); });
        return () => listeners.delete(f);
      }
    };
  }
  function query(coll, where) {
    where = where || [];
    const local = () => {
      const docs = [...cache.entries()].filter(([p]) => parentOf(p) === coll)
        .filter(([, b]) => where.every(([f, op, v]) => { const x = b[f]; return op === '>=' ? x >= v : op === '<=' ? x <= v : op === '==' ? x === v : true; }))
        .sort((a, b) => a[0] < b[0] ? -1 : 1).map(([p, b]) => snap(p, b));
      return { docs, size: docs.length, empty: !docs.length, docChanges: () => [], metadata: { fromCache: false, hasPendingWrites: false } };
    };
    const q = {
      where: (f, op, v) => query(coll, [...where, [f, op, v]]), orderBy: () => q, limit: () => q,
      async get() {
        const r = await api('/api/query?coll=' + encodeURIComponent(coll) + '&where=' + encodeURIComponent(JSON.stringify(where)));
        const docs = r.docs.map(d => snap(d.path, d.data));
        if (/^(orders|settings)$/.test(coll)) { for (const d of r.docs) cache.set(d.path, d.data); }
        return { docs, size: docs.length, empty: !docs.length, docChanges: () => [], metadata: { fromCache: false, hasPendingWrites: false } };
      },
      onSnapshot(next) { const f = () => next(local()); whenReady().then(() => { listeners.add(f); f(); }); return () => listeners.delete(f); }
    };
    return q;
  }
  const db = { doc: docRef, collection: c => Object.assign(query(c), { path: c, doc: id => docRef(c + '/' + (id || Math.random().toString(36).slice(2))) }) };

  const assets = {
    async upload(blob) {
      if (blob.size > 20 * 1024 * 1024) throw { code: 'too_large' };
      return api('/api/asset', { method: 'POST', body: blob, headers: { 'content-type': blob.type || 'application/octet-stream' } });
    }
  };
  window.__assetUrl = id => '/a/' + encodeURIComponent(id);

  const downloads = {
    async save({ filename, data }) {
      const url = URL.createObjectURL(data); const a = document.createElement('a');
      a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      return { status: 'saved' };
    }
  };
  const user = { async canEdit() { return true; } };

  /* Receipt printer (Star CloudPRNT via the Worker). Only switched on once the Worker says a printer key is set. */
  const printer = {
    send: jobs => post('/api/print', { jobs }),
    status: () => api('/api/printer'),
    jobs: async ids => (await api('/api/print/jobs?ids=' + ids.map(encodeURIComponent).join(','))).jobs
  };
  const checkPrinter = () => api('/api/printer').then(st => {
    window.__printerInfo = st; const was = !!window.__printer;
    window.__printer = st.configured ? printer : null;
    if (was !== !!window.__printer && typeof window.emit === 'function') window.emit();
  }).catch(() => { });
  checkPrinter(); setInterval(() => { if (!document.hidden) checkPrinter(); }, 60000);

  window.claude = { use: async n => ({ db, assets, downloads, user })[n] || null };
})();
