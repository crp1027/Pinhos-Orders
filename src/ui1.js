/* ===== ui1.js — shell, Today, rows, selection, batch actions ===== */
const { html, render, useState, useEffect, useRef, useMemo } = htmPreact;

const UI = {
  tab: 'today', day: todayNY(), filter: 'all', q: '', extrasSort: 'needed', sel: new Map(), limit: {},
  detail: null, dialog: null, toasts: [], form: null, print: null, schedView: 'week', schedAnchor: todayNY(),
  search: { q: '', from: addDays(todayNY(), -90), to: addDays(todayNY(), 365), status: 'any', archived: null, loading: false, err: null }
};
function ui(patch) { Object.assign(UI, patch); emit(); }
function useStore() {
  const [, set] = useState(0);
  useEffect(() => { const f = () => set(x => x + 1); Store.listeners.add(f); return () => Store.listeners.delete(f); }, []);
}
let _toastSeq = 0;
function toast(text, kind = 'ok', action = null, ms) {
  const id = ++_toastSeq; UI.toasts = [...UI.toasts, { id, text, kind, action }]; emit();
  setTimeout(() => { UI.toasts = UI.toasts.filter(t => t.id !== id); emit(); }, ms || (action ? 15000 : kind === 'bad' ? 12000 : 5000));
}
function openDialog(d) { ui({ dialog: d }); }
function closeDialog() { ui({ dialog: null }); }
function openDetail(orderId, itemId, extra = {}) { ui({ detail: { orderId, itemId, ...extra } }); }
function goDay(day) { UI.limit = {}; ui({ tab: 'today', day, detail: null }); window.scrollTo && window.scrollTo(0, 0); }
const selKey = (o, it) => o.id + '/' + it.id;

/* ---------- icons (stroke, currentColor) ---------- */
const ICONS = {
  snow: 'M12 2v20M4.9 6l14.2 12M19.1 6L4.9 18M9 3.5l3 2 3-2M9 20.5l3-2 3 2',
  alert: 'M12 3l10 18H2L12 3zM12 10v5M12 18v.01',
  check: 'M4 12l5 5L20 6',
  print: 'M6 9V3h12v6M6 18H4v-7h16v7h-2M7 14h10v7H7z',
  search: 'M11 4a7 7 0 100 14 7 7 0 000-14zM21 21l-5-5',
  left: 'M15 5l-7 7 7 7', right: 'M9 5l7 7-7 7', x: 'M6 6l12 12M18 6L6 18', plus: 'M12 5v14M5 12h14',
  gear: 'M12 9a3 3 0 100 6 3 3 0 000-6zM19 12l2-1-1-3-2 .2-1.3-1.3L17 5l-3-1-1 2h-2l-1-2-3 1 .3 2.2L6 7.5 4 7.2 3 10l2 1v2l-2 1 1 3 2-.3 1.3 1.3L7 20l3 1 1-2h2l1 2 3-1-.3-2.2 1.3-1.3 2 .3 1-3-2-1z',
  refresh: 'M20 11a8 8 0 10-2.3 5.7M20 4v7h-7', box: 'M3 8l9-5 9 5v8l-9 5-9-5zM3 8l9 5 9-5M12 13v8',
  clock: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 7v5l3 2', note: 'M5 3h10l4 4v14H5zM14 3v5h5M8 13h8M8 17h6',
  cal: 'M4 5h16v16H4zM4 10h16M9 3v4M15 3v4', list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  img: 'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15 9h.01', flag: 'M5 21V4h11l-1.5 4L16 12H5'
};
const Icon = ({ n, s = 20 }) => html`<svg class="ic" width=${s} height=${s} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d=${ICONS[n]} /></svg>`;

function useBusy() {
  const [busy, setBusy] = useState(false);
  const run = async fn => {
    if (busy) return; setBusy(true);
    try { await fn(); } catch (e) { console.error(e); toast(errText(e), 'bad'); } finally { setBusy(false); }
  };
  return [busy, run];
}
/* ---------- logo: cursive P with a stalk of wheat ---------- */
const WHEAT = (() => {
  const P = [[16, 56], [25, 41], [34, 26], [47, 8]]; const out = [];
  const bz = t => [0, 1].map(k => (1 - t) ** 3 * P[0][k] + 3 * (1 - t) ** 2 * t * P[1][k] + 3 * (1 - t) * t * t * P[2][k] + t ** 3 * P[3][k]);
  const dz = t => [0, 1].map(k => 3 * (1 - t) ** 2 * (P[1][k] - P[0][k]) + 6 * (1 - t) * t * (P[2][k] - P[1][k]) + 3 * t * t * (P[3][k] - P[2][k]));
  for (const t of [0.46, 0.56, 0.66, 0.76, 0.86]) {
    const [x, y] = bz(t); const [dx, dy] = dz(t); const L = Math.hypot(dx, dy); const nx = -dy / L, ny = dx / L; const a = Math.atan2(dy, dx) * 180 / Math.PI;
    for (const sgn of [1, -1]) out.push({ cx: +(x + sgn * nx * 3.1).toFixed(2), cy: +(y + sgn * ny * 3.1).toFixed(2), rot: +(a + 90 + sgn * -38).toFixed(1) });
  }
  const [x, y] = bz(0.97); out.push({ cx: +x.toFixed(2), cy: +(y - 1).toFixed(2), rot: +(Math.atan2(dz(1)[1], dz(1)[0]) * 180 / Math.PI + 90).toFixed(1) });
  return out;
})();
const Logo = ({ size = 40 }) => html`<svg class="logo" width=${size} height=${size} viewBox="0 0 64 64" role="img" aria-label="Pinho's logo: a script P with a stalk of wheat">
  <rect x="1" y="1" width="62" height="62" rx="15" fill="var(--accent)" />
  <path d="M16 56 C 25 41, 34 26, 47 8" fill="none" stroke="var(--wheat)" stroke-width="1.8" stroke-linecap="round" />
  ${WHEAT.map(g => html`<ellipse cx=${g.cx} cy=${g.cy} rx="1.9" ry="4.1" fill="var(--wheat)" transform=${`rotate(${g.rot} ${g.cx} ${g.cy})`} />`)}
  <text x="31" y="47" text-anchor="middle" font-family="'Great Vibes', 'Brush Script MT', cursive" font-size="46" fill="var(--accent-ink)">P</text>
</svg>`;
const StagePill = ({ s, small }) => html`<span class=${'pill st' + (s || 0) + (small ? ' sm' : '')}>${STAGE_SHORT[s || 0]}</span>`;

/* ---------- shell ---------- */
function App() {
  useStore();
  useEffect(() => { const t = setInterval(emit, 30000); return () => clearInterval(t); }, []);
  if (Store.status === 'nodb') return html`<${Blocked} />`;
  if (!Store.ready && Store.status !== 'error') return html`<div class="boot"><div class="brand big">Pinho’s</div><p>Loading bakery orders…</p></div>`;
  const tabs = [['today', 'Today', 'clock'], ['counter', 'Pickup', 'check'], ['schedule', 'Schedule', 'cal'], ['form', 'New Order', 'plus'], ['search', 'Search', 'search']];
  const goTab = t => {
    if (t === 'form') { const f = UI.form; if (!f || f.saved || (!f.dirty && !f.isNew)) UI.form = restoreDraft() || blankForm(); }
    if (t === 'today') UI.day = UI.day || todayNY();
    ui({ tab: t, detail: null }); window.scrollTo && window.scrollTo(0, 0);
  };
  const screen = { today: TodayScreen, counter: CounterScreen, schedule: ScheduleScreen, form: OrderForm, search: SearchScreen, options: OptionsScreen }[UI.tab] || TodayScreen;
  return html`<div class=${'app' + (UI.sel.size ? ' has-sel' : '')}>
    <header class="top">
      <button class="brand" onClick=${() => goTab('today')} aria-label="Pinho's Bakery — go to Today"><${Logo} size=${42} /><span><b>Pinho’s</b><small>Cake Orders</small></span></button>
      <nav class="tabs" aria-label="Main">${tabs.map(([k, l, i]) => html`<button class=${'tab' + (UI.tab === k ? ' on' : '')} aria-current=${UI.tab === k ? 'page' : null} onClick=${() => goTab(k)}><${Icon} n=${i} />${l}</button>`)}</nav>
      <div class="sync"><${SyncStatus} /></div>
      ${window.__cloud && html`<a class="btn sm ghost" href="/logout" title="Lock this device (PIN needed to get back in)">Lock</a>`}
      <button class=${'iconbtn' + (UI.tab === 'options' ? ' on' : '')} aria-label="Preset options and settings" title="Preset options and settings" onClick=${() => ui({ tab: 'options', detail: null })}><${Icon} n="gear" /></button>
    </header>
    ${Store.mode === 'demo' && html`<div class="banner demo"><b>Practice mode.</b> You are seeing fictional practice orders only. They never count toward real production. <button class="link" onClick=${() => setMode('live')}>Switch to live orders</button>
      ${Store.demoAnchor !== todayNY() && html`<span class="demoold">Practice orders were set up for ${Store.demoAnchor ? fmtDateMed(Store.demoAnchor) : 'an earlier day'}. <button class="btn sm" onClick=${() => openDialog({ type: 'demoReset' })}>Refresh practice orders for today</button></span>`}</div>`}
    ${Store.status === 'error' && html`<div class="banner bad"><b>Live updates stopped.</b> ${errText(Store.error)} <button class="btn sm" onClick=${() => subscribe()}>Reconnect</button></div>`}
    <main id="main"><${screen} /></main>
    <nav class="bottomnav" aria-label="Main">${tabs.map(([k, l, i]) => html`<button class=${UI.tab === k ? 'on' : ''} aria-current=${UI.tab === k ? 'page' : null} onClick=${() => goTab(k)}><${Icon} n=${i} /><span>${l}</span></button>`)}</nav>
    ${UI.sel.size > 0 && html`<${SelectionBar} />`}
    ${UI.detail && html`<${OrderDetail} />`}
    ${UI.print && html`<${PrintView} />`}
    ${UI.review && html`<${ReviewPrint} />`}
    ${UI.dialog && html`<${DialogHost} />`}
    <div class="toasts" role="status" aria-live="polite">${UI.toasts.map(t => html`<div class=${'toast ' + t.kind} key=${t.id}><span>${t.text}</span>${t.action && html`<button class="btn sm" onClick=${() => { UI.toasts = UI.toasts.filter(x => x.id !== t.id); t.action.fn(); emit(); }}>${t.action.label}</button>`}<button class="iconbtn sm" aria-label="Dismiss" onClick=${() => { UI.toasts = UI.toasts.filter(x => x.id !== t.id); emit(); }}><${Icon} n="x" s=${16} /></button></div>`)}</div>
  </div>`;
}
function SyncStatus() {
  const [busy, run] = useBusy();
  const t = Store.lastSync;
  const stale = t && Date.now() - t > 120000;
  return html`<span class=${'synctxt' + (stale ? ' stale' : '')}>${Store.status === 'live' ? (t ? `Updated ${fmtClock(t)}` : 'Connecting…') : Store.status === 'error' ? 'Not updating' : 'Connecting…'}</span>
    <button class="iconbtn sm" aria-label="Refresh now" title="Refresh now" disabled=${busy} onClick=${() => run(async () => { await refreshNow(); toast('Refreshed'); })}><${Icon} n="refresh" s=${18} /></button>`;
}
function Blocked() {
  return html`<div class="boot"><div class="brand big">Pinho’s</div><h1>The bakery records can’t be opened here</h1>
    <p>This page keeps orders in a private shared database. It only works when opened from its Claude link while signed in to the bakery’s authorized account. Nothing is stored in this browser.</p>
    <p>Open the link again from Claude, or ask the owner to share it with your account.</p></div>`;
}

/* ---------- Today ---------- */
const FILTERS = [['all', 'All Open'], ['unfinished', 'Unfinished'], ['ready', 'Ready'], ['extras', 'Has Extras'], ['attention', 'Needs Attention'], ['collected', 'Collected']];
function needsAttention(o, it, now) {
  return !isCollected(it) && ((it.attention && it.attention.on) || isOverdue(o, it, now) || reprintNeeded(o, it));
}
function passFilter(o, it, f, now) {
  switch (f) {
    case 'all': return !isCollected(it);
    case 'unfinished': return !isCollected(it) && (it.stage || 0) < 4;
    case 'ready': return readyWaiting(it);
    case 'extras': return !isCollected(it) && hasExtras(it);
    case 'attention': return needsAttention(o, it, now);
    case 'collected': return isCollected(it);
  }
  return true;
}
function confirmedOrders() { return visibleOrders().filter(o => o.booking === 'confirmed'); }
const byTime = (a, b) => (a.o.pickupDate + (a.o.pickupTime || '99')).localeCompare(b.o.pickupDate + (b.o.pickupTime || '99')) || (a.o.num - b.o.num);
function dayModel(day) {
  const pick = [], prep = [], late = []; const today = todayNY();
  for (const o of confirmedOrders()) {
    const its = itemsOf(o);
    if (o.pickupDate === day) pick.push({ o, items: its });
    else if (day === today && o.pickupDate < day && o.pickupDate >= addDays(day, -14) && its.some(it => !isCollected(it))) late.push({ o, items: its });
    else if (o.pickupDate > day) {
      const p = its.filter(it => !isCollected(it) && it.plan && (it.plan.date === day || (day >= today && isCarryover(o, it, day))));
      if (p.length) prep.push({ o, items: p });
    }
  }
  pick.sort(byTime); prep.sort(byTime); late.sort(byTime);
  return { pick, prep, late };
}
function applyFilter(groups, f, q, now) {
  const out = [];
  for (const g of groups) {
    if (q && !matchesQuery(g.o, q)) continue;
    const items = g.items.filter(it => passFilter(g.o, it, f, now));
    if (items.length) out.push({ o: g.o, items });
  }
  return out;
}
function stageCounts(groups) {
  const c = [0, 0, 0, 0, 0]; let collected = 0, items = 0;
  for (const g of groups) for (const it of g.items) { items++; if (isCollected(it)) collected++; else c[it.stage || 0]++; }
  return { c, collected, items, orders: groups.length };
}
function TodayScreen() {
  const day = UI.day; const now = Date.now(); const today = todayNY();
  const { pick, prep, late } = dayModel(day);
  const lateF = applyFilter(late, UI.filter === 'collected' ? 'all' : UI.filter, UI.q, now);
  if (UI.filter === 'needs' || UI.filter === 'awaiting') UI.filter = 'extras';
  const counts = stageCounts(pick);
  const drafts = visibleOrders().filter(o => o.booking === 'draft').length;
  const setF = f => { UI.limit = {}; ui({ filter: f }); };
  const isClosed = isClosedDay(Store.calendar, day);
  return html`<div class="screen today">
    <div class="dayhead">
      <div class="daynav">
        <button class="iconbtn" aria-label="Previous day" onClick=${() => goDay(addDays(day, -1))}><${Icon} n="left" /></button>
        <button class=${'btn sm' + (day === today ? ' on' : '')} onClick=${() => goDay(today)}>Today</button>
        <button class=${'btn sm' + (day === addDays(today, 1) ? ' on' : '')} onClick=${() => goDay(addDays(today, 1))}>Tomorrow</button>
        <label class="vh" for="daypick">Choose a day</label>
        <input id="daypick" type="date" class="dateinp" value=${day} onChange=${e => e.target.value && goDay(e.target.value)} />
        <button class="iconbtn" aria-label="Next day" onClick=${() => goDay(addDays(day, 1))}><${Icon} n="right" /></button>
      </div>
      <h1>${fmtDateLong(day)} <span class="rel">${relDayLabel(day)}${isClosed ? ' · normally closed' : ''}</span></h1>
    </div>
    <div class="findbar">
      <div class="searchbox"><${Icon} n="search" /><label class="vh" for="todayq">Search this day</label>
        <input id="todayq" type="search" placeholder="Name, phone, order #, inscription, theme" value=${UI.q} onInput=${e => { UI.limit = {}; ui({ q: e.target.value }); }} /></div>
      <div class="chips" role="group" aria-label="Filter">${FILTERS.map(([k, l]) => html`<button class=${'chip' + (UI.filter === k ? ' on' : '')} aria-pressed=${UI.filter === k} onClick=${() => setF(k)}>${l}</button>`)}</div>
    </div>
    ${html`
      <div class="countbar">
        <div class="cb-main"><b>${counts.orders}</b> ${counts.orders === 1 ? 'order' : 'orders'} · <b>${counts.items}</b> ${counts.items === 1 ? 'item' : 'items'} for pickup</div>
        <div class="cb-stages">${[0, 1, 2, 3, 4].map(s => html`<span class="cnt"><${StagePill} s=${s} small /> ${counts.c[s]}</span>`)}<span class="cnt"><span class="pill coll sm">Collected</span> ${counts.collected}</span></div>
        <div class="cb-act">
          <button class="btn sm" onClick=${() => openDialog({ type: 'printPick', day })}><${Icon} n="print" s=${18} />Print slips</button>
          ${drafts > 0 && html`<button class="btn sm ghost" onClick=${() => { UI.search = { ...UI.search, status: 'draft', q: '' }; ui({ tab: 'search' }); }}>Drafts (${drafts})</button>`}
        </div>
      </div>
      ${lateF.length > 0 && html`<${Section} key="late" skey="late" title="Not collected from earlier days" sub="Past pickups still waiting: ready and not picked up, or never finished." groups=${lateF} ctx=${{ mode: 'late', day }} empty="" />`}
      <${Section} key=${'p' + day} skey="pick" title=${day === today ? 'Today’s Pickups' : `Pickups · ${fmtDateMed(day)}`} groups=${applyFilter(pick, UI.filter, UI.q, now)} ctx=${{ mode: 'pickup', day }}
        empty=${pick.length ? 'No pickups match this filter.' : (isClosed ? 'No pickups. This is normally a closed day.' : 'No confirmed pickups for this day yet.')} />
      <${Section} key=${'a' + day} skey="prep" title=${`Advance Prep · work planned for ${fmtDateMed(day)}`} sub="Future pickups with early work planned for this day, plus unfinished planned work carried over."
        groups=${applyFilter(prep, UI.filter === 'collected' ? 'all' : UI.filter, UI.q, now)} ctx=${{ mode: 'prep', day }} empty="No advance work planned for this day." />
    `}
  </div>`;
}
/* ---------- list sections & rows ---------- */
function Section({ skey, title, sub, groups, ctx, empty }) {
  const limit = UI.limit[skey] || 60;
  const total = groups.reduce((s, g) => s + g.items.length, 0);
  let shown = 0; const vis = [];
  for (const g of groups) { if (shown >= limit) break; const items = g.items.slice(0, limit - shown); shown += items.length; vis.push({ ...g, items }); }
  const allKeys = groups.flatMap(g => g.items.map(it => [selKey(g.o, it), { orderId: g.o.id, itemId: it.id }]));
  const visKeys = vis.flatMap(g => g.items.map(it => [selKey(g.o, it), { orderId: g.o.id, itemId: it.id }]));
  const selIn = allKeys.filter(([k]) => UI.sel.has(k)).length;
  const addSel = keys => { for (const [k, v] of keys) UI.sel.set(k, v); emit(); };
  const hourGroups = ctx.mode === 'pickup' && total > 15;
  let lastHour = null;
  return html`<section class="sec" aria-label=${title}>
    <div class="sechead">
      <div><h2>${title} <span class="secn">${total} ${total === 1 ? 'item' : 'items'}</span></h2>${sub && html`<p class="muted small">${sub}</p>`}</div>
      ${total > 0 && html`<div class="selctl">
        <button class="btn sm ghost" onClick=${() => addSel(visKeys)}>Select ${shown < total ? `shown (${shown})` : `all ${total}`}</button>
        ${shown < total && html`<button class="btn sm ghost" onClick=${() => addSel(allKeys)}>Select all ${total} matching</button>`}
        ${selIn > 0 && html`<button class="btn sm ghost" onClick=${() => { for (const [k] of allKeys) UI.sel.delete(k); emit(); }}>Unselect ${selIn}</button>`}
      </div>`}
    </div>
    ${total === 0 ? html`<div class="empty">${empty}</div>` : html`<div class="rows" role="list">
      <div class="rowhead" aria-hidden="true"><span></span><span>Pickup</span><span>Order · customer</span><span>Cake</span><span>Stage</span><span>Flags</span><span>Balance</span></div>
      ${vis.map(g => {
        let hdr = null;
        if (hourGroups) {
          const h = (g.o.pickupTime || '--').slice(0, 2);
          if (h !== lastHour) { lastHour = h; const cnt = groups.filter(x => (x.o.pickupTime || '--').slice(0, 2) === h).reduce((s, x) => s + x.items.length, 0); hdr = html`<div class="hourhdr" key=${'h' + h}>${h === '--' ? 'No time' : fmtTime(h + ':00').replace(':00', '')} <span>${cnt} items</span></div>`; }
        }
        return html`${hdr}<${OrderGroup} key=${g.o.id} o=${g.o} items=${g.items} ctx=${ctx} />`;
      })}
    </div>
    ${shown < total && html`<button class="btn wide" onClick=${() => { UI.limit = { ...UI.limit, [skey]: limit + 60 }; emit(); }}>Show ${Math.min(60, total - shown)} more (${total - shown} not shown)</button>`}`}
  </section>`;
}
function OrderGroup({ o, items, ctx }) {
  const all = itemsOf(o);
  if (all.length === 1 && items.length === 1) return html`<${ItemRow} o=${o} it=${items[0]} ctx=${ctx} single />`;
  const ready = all.filter(it => (it.stage || 0) === 4 || isCollected(it)).length;
  const coll = all.filter(isCollected).length;
  const keys = items.map(it => selKey(o, it)); const allSel = keys.every(k => UI.sel.has(k));
  const toggleAll = e => { e.stopPropagation(); for (const it of items) { const k = selKey(o, it); if (allSel) UI.sel.delete(k); else UI.sel.set(k, { orderId: o.id, itemId: it.id }); } emit(); };
  return html`<div class="ogroup" role="listitem">
    <div class="row orow" onClick=${() => openDetail(o.id, items[0].id)}>
      <label class="ck" onClick=${e => e.stopPropagation()}><input type="checkbox" aria-label=${`Select all shown items of order ${orderLabel(o)}`} checked=${allSel} onClick=${toggleAll} /></label>
      <span class="ptime">${ctx.mode !== 'pickup' ? html`<small>${fmtDateMed(o.pickupDate)}</small>` : ''}${fmtTime(o.pickupTime)}</span>
      <span class="who"><b>${orderLabel(o)}</b> ${o.customer?.name}${o.demo ? html` <span class="tag demo">Practice</span>` : ''}</span>
      <span class="spec muted">${all.length} items · ${ready === all.length ? 'all ready' : `${ready} of ${all.length} ready`}${coll ? ` · ${coll} collected` : ''}</span>
      <span class="stg">${ready === all.length ? html`<span class="pill st4 sm">Order ready</span>` : ready > 0 ? html`<span class="pill part sm">Partly ready</span>` : ''}</span>
      <span class="flags"></span>
      <${BalanceCell} o=${o} />
    </div>
    ${items.map(it => html`<${ItemRow} key=${it.id} o=${o} it=${it} ctx=${ctx} child />`)}
  </div>`;
}
function BalanceCell({ o }) {
  const ps = payState(o); const bal = balanceCents(o);
  return html`<button class=${'bal ' + ps.key} onClick=${e => { e.stopPropagation(); openDialog({ type: 'payment', orderId: o.id }); }} title="Order balance — tap to record a payment">
    ${ps.key === 'paid' ? 'Paid' : ps.key === 'credit' ? ps.label : bal === null ? 'No total' : html`<span class="muted xs">Bal</span> ${fmtMoney(bal)}`}</button>`;
}
function rowFlags(o, it, ctx, now) {
  const f = [];
  if (isCollected(it)) f.push(['coll', `Collected ${fmtTime(nyTimeOf(it.collectedAt))}`]);
  else if (isOverdue(o, it, now)) f.push(['bad', 'Past pickup · not ready']);
  else if (readyWaiting(it)) f.push(['good', now > pickupEpoch(o) ? 'Ready · customer late' : 'Ready · awaiting customer']);
  if (it.frozen) f.push(['ice', 'Frozen', 'snow']);
  const nx = extrasOf(it).filter(x => (x.desc || '').trim()).length;
  if (nx) f.push(['warn2', nx === 1 ? 'Extra: ' + extrasOf(it).find(x => (x.desc || '').trim()).desc : `${nx} extras`, 'box']);
  if (it.attention && it.attention.on) f.push(['bad', it.attention.reason || 'Needs attention', 'flag']);
  if (ctx.mode === 'prep' && it.plan) {
    if (planMet(it)) f.push(['good', `Planned ${STAGE_SHORT[it.plan.milestone]} — done`, 'check']);
    else if (it.plan.date < ctx.day) f.push(['bad', `Carried over from ${fmtDateMed(it.plan.date)}: ${STAGE_SHORT[it.plan.milestone]}`]);
    else f.push(['info', `Planned: ${STAGE_SHORT[it.plan.milestone]}`]);
  } else if (it.plan && !isCollected(it)) {
    const t = planTag(it); if (t) f.push(t);
  }
  if (reprintNeeded(o, it)) f.push(['warn', 'Reprint needed', 'print']);
  if (it.price && !it.price.complete && !it.price.override && !it.price.keptAgreed) f.push(['warn', 'Price not final', 'alert']);
  return f;
}
/** Advance-work tag: what was planned ahead, on which day, and whether it's done. */
function planTag(it) {
  if (!it.plan || isCollected(it)) return null;
  const d = DAY_SHORT[weekday(it.plan.date)] + ' ' + fmtDateShort(it.plan.date); const w = STAGE_SHORT[it.plan.milestone];
  if (planMet(it)) return ['good', `${w} ahead ${d} ✓`, 'check'];
  if (it.plan.date < todayNY()) return ['bad', `${w} planned ${d} — not done`];
  return ['info', `${w} planned ${d}`, 'cal'];
}
function ItemRow({ o, it, ctx, single, child }) {
  const now = Date.now(); const k = selKey(o, it); const sel = UI.sel.has(k);
  const toggle = e => { e.stopPropagation(); if (sel) UI.sel.delete(k); else UI.sel.set(k, { orderId: o.id, itemId: it.id }); emit(); };
  const flags = rowFlags(o, it, ctx, now);
  return html`<div class=${'row irow' + (child ? ' child' : '') + (sel ? ' sel' : '') + (isCollected(it) ? ' done' : '')} role=${single ? 'listitem' : null} onClick=${() => openDetail(o.id, it.id)}>
    <label class="ck" onClick=${e => e.stopPropagation()}><input type="checkbox" aria-label=${`Select ${itemLabel(o, it)}`} checked=${sel} onClick=${toggle} /></label>
    <span class="ptime">${child ? '' : html`${ctx.mode !== 'pickup' ? html`<small>${fmtDateMed(o.pickupDate)}</small>` : ''}${fmtTime(o.pickupTime)}`}</span>
    <span class="who">${child ? html`<b>-${it.suffix}</b>` : html`<b>${itemLabel(o, it)}</b> ${o.customer?.name}${o.demo ? html` <span class="tag demo">Practice</span>` : ''}`}</span>
    <span class="spec">${ctx.week && planTag(it) ? html`<span class=${'flag ptag ' + planTag(it)[0]}>${planTag(it)[1]}</span> ` : ''}${specBrief(it)}${it.noInscription ? html` <span class="muted">· No inscription</span>` : it.inscription ? html` <span class="insc-s">“${it.inscription.length > 34 ? it.inscription.slice(0, 32) + '…' : it.inscription}”</span>` : ''}</span>
    <span class="stg"><${StagePill} s=${it.stage} /></span>
    <span class="flags">${flags.map(([c, t, i]) => html`<span class=${'flag ' + c}>${i && html`<${Icon} n=${i} s=${14} />`}${t}</span>`)}</span>
    ${single ? html`<${BalanceCell} o=${o} />` : html`<span class="bal-none" aria-hidden="true"></span>`}
  </div>`;
}

/* ---------- selection bar & batch ---------- */
function selectedRefs() { return [...UI.sel.values()].filter(r => { const o = getOrder(r.orderId); return o && o.items && o.items[r.itemId]; }); }
function SelectionBar() {
  const refs = selectedRefs();
  const orders = new Set(refs.map(r => r.orderId));
  const dates = [...new Set(refs.map(r => getOrder(r.orderId).pickupDate))].sort();
  const scope = dates.length === 0 ? '' : dates.length <= 3 ? 'pickups ' + dates.map(fmtDateMed).join(', ') : `pickups on ${dates.length} dates (${fmtDateMed(dates[0])}–${fmtDateMed(dates[dates.length - 1])})`;
  const act = a => openDialog({ type: 'batch', action: a });
  return html`<div class="selbar" role="region" aria-label="Selected items">
    <div class="selsum"><b>${refs.length} ${refs.length === 1 ? 'item' : 'items'} selected</b> <span>in ${orders.size} ${orders.size === 1 ? 'order' : 'orders'} · ${scope}</span>
      <button class="btn sm ghost" onClick=${() => { UI.sel.clear(); emit(); }}>Clear selection</button></div>
    <div class="selacts wideonly">
      <span class="selgrp">Front counter</span>
      <button class="btn sm foh" onClick=${() => act({ kind: 'collect' })}><${Icon} n="check" s=${16} />Picked Up</button>
      <button class="btn sm foh" onClick=${() => act({ kind: 'paid' })}>Paid</button>
      <button class="btn sm foh danger-o" onClick=${() => act({ kind: 'cancel' })}>Cancel orders</button>
      <span class="selgrp">Production</span>
      ${[1, 2, 3, 4].map(s => html`<button class=${'btn sm stb st' + s} onClick=${() => act({ kind: 'stage', to: s })}>${STAGE_SHORT[s]}</button>`)}
      <button class="btn sm" onClick=${() => act({ kind: 'frozen', on: true })}><${Icon} n="snow" s=${16} />Frozen</button>
      <button class="btn sm" onClick=${() => act({ kind: 'frozen', on: false })}>Unfrozen</button>
      <button class="btn sm" onClick=${() => act({ kind: 'storage' })}>Storage…</button>
      <button class="btn sm" onClick=${() => act({ kind: 'plan' })}>Plan early work…</button>
      <button class="btn sm" onClick=${() => openPrint(refs.map(r => ({ orderId: r.orderId, itemId: r.itemId })), `${refs.length} selected items`)}><${Icon} n="print" s=${16} />Print</button>
      <button class="btn sm ghost" onClick=${() => act({ kind: 'stage', to: 0 })}>Reset to Not Started</button>
    </div>
    <div class="narrowonly selquick">
      <button class="btn foh" onClick=${() => act({ kind: 'collect' })}>Picked Up</button>
      <button class="btn foh" onClick=${() => act({ kind: 'paid' })}>Paid</button>
      <button class="btn primary" onClick=${() => openDialog({ type: 'batchMenu' })}>More…</button>
    </div>
  </div>`;
}
function BatchMenu() {
  const refs = selectedRefs(); const go = a => openDialog({ type: 'batch', action: a });
  return html`<${Modal} title=${`Update ${refs.length} selected items`}>
    <div class="menu">
      <p class="menuh">Front counter</p>
      <button class="btn big foh" onClick=${() => go({ kind: 'collect' })}><${Icon} n="check" />Mark Selected Picked Up</button>
      <button class="btn big foh" onClick=${() => go({ kind: 'paid' })}>Mark Selected Paid</button>
      <button class="btn big danger-o" onClick=${() => go({ kind: 'cancel' })}>Cancel Selected Orders</button>
      <p class="menuh">Production</p>
      ${[1, 2, 3, 4].map(s => html`<button class=${'btn big stb st' + s} onClick=${() => go({ kind: 'stage', to: s })}>Mark Selected ${STAGES[s]}</button>`)}
      <button class="btn big" onClick=${() => go({ kind: 'frozen', on: true })}><${Icon} n="snow" />Mark Selected Frozen</button>
      <button class="btn big" onClick=${() => go({ kind: 'frozen', on: false })}>Mark Selected Unfrozen</button>
      <button class="btn big" onClick=${() => go({ kind: 'storage' })}>Set storage location…</button>
      <button class="btn big" onClick=${() => go({ kind: 'plan' })}>Plan early work…</button>
      <button class="btn big" onClick=${() => { closeDialog(); openPrint(refs, `${refs.length} selected items`); }}><${Icon} n="print" />Print selected slips</button>
      <button class="btn big" onClick=${() => { closeDialog(); openPrint(refs, `${refs.length} selected`, 'customer'); }}><${Icon} n="print" />Print customer copies</button>
      <button class="btn big ghost" onClick=${() => go({ kind: 'stage', to: 0 })}>Reset Selected to Not Started</button>
    </div></${Modal}>`;
}
function partitionForProduction(refs) {
  const ok = [], excluded = [];
  for (const r of refs) {
    const o = getOrder(r.orderId); const it = o && o.items[r.itemId];
    if (!it) continue;
    if (o.booking !== 'confirmed') excluded.push({ r, why: o.booking === 'canceled' ? 'canceled' : 'draft' });
    else if (isCollected(it) || it.active === false) excluded.push({ r, why: 'collected' });
    else ok.push({ r, o, it: { ...it, id: r.itemId } });
  }
  return { ok, excluded };
}
/* "Also…" — chain more updates onto the same list action */
const ALSO0 = { frozen: false, storageOn: false, storage: '', paid: false, method: 'card', collect: false };
function AlsoBox({ al, set, opts }) {
  const ck = (k, label) => html`<label class="check"><input type="checkbox" checked=${!!al[k]} onChange=${e => set({ ...al, [k]: e.target.checked })} /> ${label}</label>`;
  return html`<div class="also"><div class="kl">Also do at the same time</div>
    ${opts.includes('frozen') && ck('frozen', 'Mark frozen')}
    ${opts.includes('storage') && html`<div class="also-row">${ck('storageOn', 'Set storage location')}${al.storageOn && html`<input aria-label="Storage location" value=${al.storage} placeholder="e.g. Walk-in freezer, shelf 2" onInput=${e => set({ ...al, storage: e.target.value })} />`}</div>`}
    ${opts.includes('paid') && html`<div class="also-row">${ck('paid', 'Mark paid (records the full balance)')}${al.paid && html`<div class="seg">${['card', 'cash', 'other'].map(m => html`<button class=${'segb' + (al.method === m ? ' on' : '')} aria-pressed=${al.method === m} onClick=${() => set({ ...al, method: m })}>${m[0].toUpperCase() + m.slice(1)}</button>`)}</div>`}</div>`}
    ${opts.includes('collect') && ck('collect', 'Mark picked up')}
  </div>`;
}
function undoToast(text, fn) {
  toast(text, 'ok', fn ? { label: 'Undo', fn: async () => { try { const u = await fn(); toast(`Undone for ${u.reverted} ${u.reverted === 1 ? 'item' : 'items'}.${u.skipped ? ` ${u.skipped} skipped because they changed again since.` : ''}`); } catch (e) { toast(errText(e), 'bad'); } } } : null);
}
function ClashPanel({ clash, busy, run, onCancel }) {
  const changed = new Set(clash.list.map(c => c.orderId + '/' + c.itemId));
  const rest = clash.targets.filter(r => !changed.has(r.orderId + '/' + r.itemId));
  return html`<div class="callout warn" role="alert"><b>Changed on another device since you looked.</b>
    <ul>${clash.list.map(c => html`<li><b>${c.label}</b> is now ${c.now}${c.by ? html` <span class="muted small">(${c.by})</span>` : ''}</li>`)}</ul>
    <div class="dlgact"><button class="btn ghost" onClick=${onCancel}>Cancel</button>
      ${rest.length > 0 && html`<button class="btn" disabled=${busy} onClick=${() => run(() => clash.go(rest))}>Skip those, update the other ${rest.length}</button>`}
      <button class="btn primary" disabled=${busy} onClick=${() => run(() => clash.go(clash.targets))}>Update all ${clash.targets.length} anyway</button></div></div>`;
}
function BatchBody({ title, children, clash, busy, run, onCancel }) {
  return html`<${Modal} title=${title}>${clash ? html`<${ClashPanel} clash=${clash} busy=${busy} run=${run} onCancel=${onCancel} />` : children}</${Modal}>`;
}
const CANCEL_REASONS = ['Customer canceled', 'Duplicate entry', 'Customer never picked up', 'Entered by mistake'];
function BatchDialog({ action, refs: fixedRefs }) {
  const refs = fixedRefs || selectedRefs();
  const ck = action.kind === 'stage' ? 'stage' : action.kind;
  const [seen] = useState(() => seenValues(refs, ck === 'paid' || ck === 'cancel' ? ck : (CLASH_FIELD[ck] ? ck : 'stage')));
  const [clash, setClash] = useState(null);
  const { ok, excluded } = partitionForProduction(refs);
  const [busy, run] = useBusy();
  const [incBack, setIncBack] = useState(false);
  const [text, setText] = useState('');
  const [pdate, setPdate] = useState(''); const [pms, setPms] = useState(2);
  const [al, setAl] = useState(ALSO0);
  const [method, setMethod] = useState('card'); const [alsoCollect, setAlsoCollect] = useState(false); const [markReady, setMarkReady] = useState(false);
  const [reason, setReason] = useState('Customer canceled');
  const exN = k => excluded.filter(e => e.why === k).length;
  const exLine = excluded.length ? html`<p class="note">Left out: ${[['collected', 'collected'], ['canceled', 'canceled'], ['draft', 'draft']].filter(([k]) => exN(k)).map(([k, l]) => `${exN(k)} ${l}`).join(', ')}. Production updates only apply to confirmed, uncollected items.</p>` : '';
  const close = () => { if (!fixedRefs) UI.sel.clear(); closeDialog(); };
  const report = res => { if (res.errors && res.errors.length) toast(`${res.errors.length} order(s) could not be saved: ${errText(res.errors[0].e)}`, 'bad'); };
  const finish = async (res, label, kind, value, refs2) => {
    const ch = await runChain(refs2 || res.applied.map(a => ({ orderId: a.orderId, itemId: a.itemId })), al);
    close(); report(res); if (ch.errors.length) report({ errors: ch.errors }); const n = res.applied.length;
    const undos = []; if (n) undos.push(() => undoBatch(kind, res.applied, value)); undos.push(...ch.undos);
    undoToast(`${label}: ${n} ${n === 1 ? 'item' : 'items'} updated${ch.parts.length ? ` · also ${ch.parts.join(', ')}` : ''}.`, undos.length ? () => undoAll(undos) : null);
  };
  const guard = (targets, go) => run(async () => {
    const c = await findClashes(targets, ck === 'paid' || ck === 'cancel' ? ck : (CLASH_FIELD[ck] ? ck : 'stage'), seen);
    if (c.length) { setClash({ list: c, targets, go }); return; }
    await go(targets);
  });
  const cp = { clash, busy, run, onCancel: () => setClash(null) };
  if (action.kind === 'stage') {
    const to = action.to;
    const fwd = ok.filter(x => (x.it.stage || 0) < to), same = ok.filter(x => (x.it.stage || 0) === to), back = ok.filter(x => (x.it.stage || 0) > to);
    const target = incBack ? [...fwd, ...back] : fwd;
    const chainTo = [...target, ...same].map(x => x.r);
    return html`<${BatchBody} ...${cp} title=${`Mark selected items ${STAGES[to]}`}>
      <ul class="facts">
        <li><b>${fwd.length}</b> ${fwd.length === 1 ? 'item moves' : 'items move'} forward to ${STAGES[to]}.</li>
        ${same.length > 0 && html`<li><b>${same.length}</b> already ${STAGES[to]} (no change).</li>`}
        ${back.length > 0 && html`<li class="warnli"><b>${back.length}</b> ${back.length === 1 ? 'is' : 'are'} already further along (${[...new Set(back.map(x => STAGE_SHORT[x.it.stage]))].join(', ')}). Marking ${back.length === 1 ? 'it' : 'them'} ${STAGES[to]} would move ${back.length === 1 ? 'it' : 'them'} <b>backward</b>.
          <label class="check"><input type="checkbox" checked=${incBack} onChange=${e => setIncBack(e.target.checked)} /> Also move ${back.length === 1 ? 'this item' : `these ${back.length}`} back to ${STAGES[to]}</label></li>`}
        ${to > 1 && fwd.some(x => (x.it.stage || 0) < to - 1) && html`<li class="muted">Stages skipped on the way are marked done too.</li>`}
      </ul>${to > 0 && html`<${AlsoBox} al=${al} set=${setAl} opts=${to === 4 ? ['frozen', 'storage', 'paid', 'collect'] : ['frozen', 'storage']} />`}${exLine}
      <div class="dlgact"><button class="btn ghost" onClick=${closeDialog}>Cancel</button>
        <button class=${'btn primary stb st' + to} disabled=${busy || !target.length} onClick=${() => guard(target.map(x => x.r), async t => { const res = await setStage(t, to); await finish(res, `Marked ${STAGES[to]}`, 'stage', to, chainTo); })}>${busy ? 'Saving…' : `Mark ${target.length} ${target.length === 1 ? 'Item' : 'Items'} ${STAGES[to]}`}</button></div>
    </${BatchBody}>`;
  }
  if (action.kind === 'frozen') {
    const ch = ok.filter(x => !!x.it.frozen !== action.on);
    return html`<${BatchBody} ...${cp} title=${action.on ? 'Mark selected items Frozen' : 'Mark selected items Unfrozen'}>
      <p><b>${ch.length}</b> ${ch.length === 1 ? 'item' : 'items'} will be marked ${action.on ? 'frozen' : 'unfrozen'}.${ok.length - ch.length ? ` ${ok.length - ch.length} already ${action.on ? 'frozen' : 'unfrozen'}.` : ''} Frozen is a separate indicator; the production stage does not change.</p>
      ${action.on && html`<${AlsoBox} al=${al} set=${setAl} opts=${['storage']} />`}${exLine}
      <div class="dlgact"><button class="btn ghost" onClick=${closeDialog}>Cancel</button>
        <button class="btn primary" disabled=${busy || !ch.length} onClick=${() => guard(ch.map(x => x.r), async t => finish(await setFrozen(t, action.on), action.on ? 'Marked frozen' : 'Marked unfrozen', 'frozen', action.on, ok.map(x => x.r)))}>${busy ? 'Saving…' : `Mark ${ch.length} ${action.on ? 'Frozen' : 'Unfrozen'}`}</button></div></${BatchBody}>`;
  }
  if (action.kind === 'storage') {
    return html`<${BatchBody} ...${cp} title="Set storage location">
      <label class="fld"><span>Storage location for ${ok.length} ${ok.length === 1 ? 'item' : 'items'}</span><input id="batchstore" value=${text} onInput=${e => setText(e.target.value)} placeholder="e.g. Walk-in freezer, shelf 2" /></label>
      <p class="muted small">Leave empty and save to clear the location.</p>
      <${AlsoBox} al=${al} set=${setAl} opts=${['frozen']} />${exLine}
      <div class="dlgact"><button class="btn ghost" onClick=${closeDialog}>Cancel</button>
        <button class="btn primary" disabled=${busy || !ok.length} onClick=${() => guard(ok.map(x => x.r), async t => finish(await setStorage(t, text.trim()), text.trim() ? `Storage set to “${text.trim()}”` : 'Storage cleared', 'storage', text.trim(), ok.map(x => x.r)))}>${busy ? 'Saving…' : 'Save location'}</button></div></${BatchBody}>`;
  }
  if (action.kind === 'plan') {
    const valid = pdate && ok.every(x => pdate <= x.o.pickupDate);
    const after = pdate ? ok.filter(x => pdate > x.o.pickupDate) : [];
    return html`<${BatchBody} ...${cp} title="Plan early work">
      <p>Pickup-day work is the default. Plan early work only for items that should be done ahead.</p>
      <div class="frow">
        <label class="fld"><span>Work day</span><input type="date" value=${pdate} onInput=${e => setPdate(e.target.value)} /></label>
        <div class="fld"><span>Do by end of that day</span><div class="seg">${MILESTONES.map(m => html`<button class=${'segb' + (pms === m ? ' on' : '')} aria-pressed=${pms === m} onClick=${() => setPms(m)}>${STAGES[m]}</button>`)}</div></div>
      </div>
      ${pdate && html`<p class="muted">${ok.length} ${ok.length === 1 ? 'item' : 'items'}: ${STAGES[pms]} on ${fmtDateLong(pdate)}. ${ok.length === 1 ? 'It stays' : 'They stay'} on the pickup-day list too.</p>`}
      ${after.length > 0 && html`<p class="warnli">${after.length} selected ${after.length === 1 ? 'item is' : 'items are'} picked up before that day. Pick an earlier work day.</p>`}
      ${exLine}
      <div class="dlgact">
        <button class="btn ghost" onClick=${closeDialog}>Cancel</button>
        <button class="btn" disabled=${busy || !ok.some(x => x.it.plan)} onClick=${() => guard(ok.map(x => x.r), async t => finish(await setPlan(t, null), 'Advance plan removed', 'plan', null))}>Remove plans</button>
        <button class="btn primary" disabled=${busy || !valid} onClick=${() => guard(ok.map(x => x.r), async t => finish(await setPlan(t, { date: pdate, milestone: pms }), `Planned ${STAGES[pms]} on ${fmtDateMed(pdate)}`, 'plan', { date: pdate, milestone: pms }))}>${busy ? 'Saving…' : 'Save plan'}</button></div></${BatchBody}>`;
  }
  // ----- front-counter actions: deliberate overrides are allowed -----
  if (action.kind === 'collect') {
    const items = refs.map(r => { const o = getOrder(r.orderId); return { r, o, it: { ...o.items[r.itemId], id: r.itemId } }; }).filter(x => x.o.booking !== 'canceled' && !isCollected(x.it));
    const already = refs.length - items.length;
    const notReady = items.filter(x => (x.it.stage || 0) < 4);
    const owing = [...new Map(items.map(x => [x.o.id, x.o])).values()].filter(o => (balanceCents(o) || 0) > 0);
    const owed = owing.reduce((s, o) => s + balanceCents(o), 0);
    return html`<${BatchBody} ...${cp} title=${`Mark ${items.length} ${items.length === 1 ? 'item' : 'items'} Picked Up`}>
      <ul class="facts">
        <li><b>${items.length}</b> ${items.length === 1 ? 'item' : 'items'} in <b>${new Set(items.map(x => x.o.id)).size}</b> ${new Set(items.map(x => x.o.id)).size === 1 ? 'order' : 'orders'} will be marked picked up now.</li>
        ${notReady.length > 0 && html`<li class="warnli"><b>${notReady.length}</b> ${notReady.length === 1 ? 'is' : 'are'} not marked Ready. That's allowed. <label class="check"><input type="checkbox" checked=${markReady} onChange=${e => setMarkReady(e.target.checked)} /> Also mark ${notReady.length === 1 ? 'it' : 'them'} Ready for Pickup</label></li>`}
        ${owing.length > 0 && html`<li class="warnli"><b>${owing.length}</b> ${owing.length === 1 ? 'order shows' : 'orders show'} <b>${fmtMoney(owed)}</b> still owed. Picking up does not record a payment. Use “Paid” if the money was taken.</li>`}
        ${already > 0 && html`<li>${already} already picked up or canceled (left out).</li>`}
      </ul>
      ${owing.length > 0 && html`<${AlsoBox} al=${al} set=${setAl} opts=${['paid']} />`}
      <label class="fld"><span>Note (optional)</span><input value=${text} onInput=${e => setText(e.target.value)} placeholder="e.g. cleared from the board, picked up earlier" /></label>
      <div class="dlgact"><button class="btn ghost" onClick=${closeDialog}>Cancel</button>
        <button class="btn primary" disabled=${busy || !items.length} onClick=${() => guard(items.map(x => x.r), async t => {
          let pay = null; if (al.paid && owing.length) { pay = await payMany(t.map(r => r.orderId), al.method); report(pay); await refreshNow(true); }
          const res = await collectMany(t, { markReady, note: text.trim() }); close(); report(res);
          const undos = []; if (res.applied.length) undos.push(() => undoCollectMany(res.applied)); if (pay && pay.applied.length) undos.push(() => undoPayMany(pay.applied));
          undoToast(`Picked up: ${res.applied.length} ${res.applied.length === 1 ? 'item' : 'items'}${pay && pay.applied.length ? ` · ${pay.applied.length} paid (${fmtMoney(pay.applied.reduce((a, x) => a + x.amount, 0))})` : ''}.`, undos.length ? () => undoAll(undos) : null); })}>${busy ? 'Saving…' : `Mark ${items.length} Picked Up${al.paid && owing.length ? ' + Paid' : ''}`}</button></div></${BatchBody}>`;
  }
  if (action.kind === 'paid') {
    const orders = [...new Map(refs.map(r => [r.orderId, getOrder(r.orderId)])).values()].filter(o => o && o.booking !== 'canceled');
    const due = orders.filter(o => (balanceCents(o) || 0) > 0); const noTotal = orders.filter(o => balanceCents(o) === null); const paid = orders.length - due.length - noTotal.length;
    const sum = due.reduce((s, o) => s + balanceCents(o), 0);
    const firstRefs = due.map(o => refs.find(r => r.orderId === o.id));
    return html`<${BatchBody} ...${cp} title=${`Mark ${due.length} ${due.length === 1 ? 'order' : 'orders'} Paid`}>
      <ul class="facts">
        <li>Records a payment for the full remaining balance on <b>${due.length}</b> ${due.length === 1 ? 'order' : 'orders'}: <b>${fmtMoney(sum)}</b> in total. Take the money on the POS as usual.</li>
        ${paid > 0 && html`<li>${paid} already paid (no change).</li>`}
        ${noTotal.length > 0 && html`<li class="warnli">${noTotal.length} ${noTotal.length === 1 ? 'has' : 'have'} no total entered (${noTotal.map(orderLabel).join(', ')}), so ${noTotal.length === 1 ? 'it' : 'they'} can't be marked paid here. Open the order to enter a total.</li>`}
      </ul>
      <div class="fld"><span>Paid by</span><div class="seg">${['card', 'cash', 'other'].map(m => html`<button class=${'segb' + (method === m ? ' on' : '')} aria-pressed=${method === m} onClick=${() => setMethod(m)}>${m[0].toUpperCase() + m.slice(1)}</button>`)}</div></div>
      <label class="check"><input type="checkbox" checked=${alsoCollect} onChange=${e => setAlsoCollect(e.target.checked)} /> Also mark the selected items picked up</label>
      <div class="dlgact"><button class="btn ghost" onClick=${closeDialog}>Cancel</button>
        <button class="btn primary" disabled=${busy || (!due.length && !alsoCollect)} onClick=${() => guard(firstRefs, async t => {
          const ids = t.map(r => r.orderId); const res = await payMany(ids, method); let col = null;
          if (alsoCollect) col = await collectMany(refs.filter(r => getOrder(r.orderId)?.booking !== 'canceled'), { note: 'Paid and picked up (from list)' });
          close(); report(res); if (col) report(col);
          undoToast(`Recorded ${res.applied.length} ${res.applied.length === 1 ? 'payment' : 'payments'} (${fmtMoney(res.applied.reduce((s, a) => s + a.amount, 0))})${col ? ` and ${col.applied.length} picked up` : ''}.`, res.applied.length || (col && col.applied.length) ? async () => { const a = await undoPayMany(res.applied); const b = col ? await undoCollectMany(col.applied) : { reverted: 0 }; return { reverted: a.reverted + b.reverted }; } : null);
        })}>${busy ? 'Saving…' : `Record ${fmtMoney(sum)} paid${alsoCollect ? ' + picked up' : ''}`}</button></div></${BatchBody}>`;
  }
  if (action.kind === 'cancel') {
    const orders = [...new Map(refs.map(r => [r.orderId, getOrder(r.orderId)])).values()].filter(o => o && o.booking !== 'canceled');
    const selIds = new Set(refs.map(r => r.orderId + '/' + r.itemId));
    const extraItems = orders.reduce((s, o) => s + itemsOf(o).filter(it => !selIds.has(o.id + '/' + it.id)).length, 0);
    const paidSum = orders.reduce((s, o) => s + paidCents(o), 0);
    const firstRefs = orders.map(o => refs.find(r => r.orderId === o.id));
    return html`<${BatchBody} ...${cp} title=${`Cancel ${orders.length} ${orders.length === 1 ? 'order' : 'orders'}`}>
      <ul class="facts">
        <li>Cancels the whole order${orders.length === 1 ? '' : 's'}: ${orders.slice(0, 6).map(o => `${orderLabel(o)} ${o.customer?.name || ''}`).join(', ')}${orders.length > 6 ? '…' : ''}.</li>
        ${extraItems > 0 && html`<li class="warnli">This also cancels <b>${extraItems}</b> other ${extraItems === 1 ? 'item' : 'items'} on those orders that you didn't select. To remove just one item, edit the order instead.</li>`}
        <li>Records stay searchable and payments are kept${paidSum ? ` (${fmtMoney(paidSum)} recorded)` : ''}. No refund is recorded.</li>
      </ul>
      <div class="fld"><span>Reason</span><div class="chips">${CANCEL_REASONS.map(r => html`<button class=${'chip sm' + (reason === r ? ' on' : '')} onClick=${() => setReason(r)}>${r}</button>`)}</div>
        <input aria-label="Reason" value=${reason} onInput=${e => setReason(e.target.value)} /></div>
      <div class="dlgact"><button class="btn ghost" onClick=${closeDialog}>Keep orders</button>
        <button class="btn danger" disabled=${busy || !orders.length || !reason.trim()} onClick=${() => guard(firstRefs, async t => { const res = await cancelMany(t.map(r => r.orderId), reason.trim()); close(); report(res); undoToast(`Canceled ${res.applied.length} ${res.applied.length === 1 ? 'order' : 'orders'}.`, res.applied.length ? () => undoCancelMany(res.applied) : null); })}>${busy ? 'Canceling…' : `Cancel ${orders.length} ${orders.length === 1 ? 'order' : 'orders'}`}</button></div></${BatchBody}>`;
  }
  return null;
}

/* ---------- modal ---------- */
function Modal({ title, children, wide, onClose }) {
  const ref = useRef();
  useEffect(() => { const el = ref.current && ref.current.querySelector('input,select,textarea,button.primary'); if (el && el.focus) el.focus(); }, []);
  const close = onClose || closeDialog;
  return html`<div class="scrim" onClick=${e => { if (e.target === e.currentTarget) close(); }}>
    <div class=${'modal' + (wide ? ' wide' : '')} role="dialog" aria-modal="true" aria-label=${title} ref=${ref} onKeyDown=${e => { if (e.key === 'Escape') close(); }}>
      <div class="mhead"><h2>${title}</h2><button class="iconbtn" aria-label="Close" onClick=${close}><${Icon} n="x" /></button></div>
      <div class="mbody">${children}</div>
    </div></div>`;
}
function DialogHost() {
  const d = UI.dialog;
  const map = {
    batch: BatchDialog, batchMenu: BatchMenu, payment: PaymentDialog, voidPay: VoidDialog, collect: CollectDialog, cancel: CancelDialog,
    printPick: PrintPickDialog, image: ImageViewer, itemPlan: ItemPlanDialog, readyReview: ReadyReview,
    review: ReviewDialog, conflict: ConflictDialog, repeat: RepeatDialog, confirm: ConfirmDialog, demoReset: DemoResetDialog, backup: BackupDialog
  };
  const C = map[d.type]; return C ? html`<${C} ...${d} />` : null;
}
function ConfirmDialog({ title, body, okLabel, danger, onOk }) {
  const [busy, run] = useBusy();
  return html`<${Modal} title=${title}><p>${body}</p><div class="dlgact"><button class="btn ghost" onClick=${closeDialog}>Go back</button>
    <button class=${'btn ' + (danger ? 'danger' : 'primary')} disabled=${busy} onClick=${() => run(async () => { await onOk(); closeDialog(); })}>${busy ? 'Working…' : okLabel}</button></div></${Modal}>`;
}
