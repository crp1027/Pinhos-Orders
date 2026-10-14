/* ===== lib.js — time (America/New_York), money, ids, order model ===== */
const TZ = 'America/New_York';
const STAGES = ['Not Started', 'Filled', 'Iced', 'Decorated', 'Ready for Pickup'];
const STAGE_SHORT = ['Not Started', 'Filled', 'Iced', 'Decorated', 'Ready'];
const MILESTONES = [1, 2, 3]; // Filled, Iced, Decorated
const EXTRA_STATUS = {
  needs: 'Needs Ordering', ordered: 'Ordered', received: 'Received', customer: 'Customer Bringing'
};
const IMG_PURPOSE = {
  print: 'Print This Image on Cake', recreate: 'Recreate This Design', inspire: 'Inspiration Only'
};
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MON_SHORT = MONTHS.map(m => m.slice(0, 3));

function uid(n = 12) {
  const a = new Uint8Array(n); crypto.getRandomValues(a);
  return Array.from(a, b => 'abcdefghijkmnpqrstuvwxyz23456789'[b % 32]).join('');
}

/* ---------- time ---------- */
const _fmtParts = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
});
function nyParts(epoch) {
  const o = {};
  for (const p of _fmtParts.formatToParts(new Date(epoch))) o[p.type] = p.value;
  return { y: +o.year, m: +o.month, d: +o.day, H: +o.hour % 24, M: +o.minute, S: +o.second };
}
const pad2 = n => String(n).padStart(2, '0');
function nyDateOf(epoch) { const p = nyParts(epoch); return `${p.y}-${pad2(p.m)}-${pad2(p.d)}`; }
function nyTimeOf(epoch) { const p = nyParts(epoch); return `${pad2(p.H)}:${pad2(p.M)}`; }
function todayNY() { return nyDateOf(Date.now()); }
function nyOffsetMin(epoch) {
  const p = nyParts(epoch);
  return (Date.UTC(p.y, p.m - 1, p.d, p.H, p.M, p.S) - Math.floor(epoch / 1000) * 1000) / 60000;
}
/** Wall-clock date + time in New York -> epoch ms (DST-aware). */
function nyToEpoch(dateStr, timeStr = '00:00') {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  const [H, M] = (timeStr || '00:00').split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, H, M);
  let e = guess - nyOffsetMin(guess) * 60000;
  const off2 = nyOffsetMin(e);
  e = guess - off2 * 60000;
  return e;
}
function parseD(s) { const [y, m, d] = s.split('-').map(Number); return { y, m, d }; }
function addDays(s, n) {
  const { y, m, d } = parseD(s); const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${pad2(t.getUTCMonth() + 1)}-${pad2(t.getUTCDate())}`;
}
function weekday(s) { const { y, m, d } = parseD(s); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); }
function daysBetween(a, b) { const A = parseD(a), B = parseD(b); return Math.round((Date.UTC(B.y, B.m - 1, B.d) - Date.UTC(A.y, A.m - 1, A.d)) / 864e5); }
function fmtDateLong(s) { if (!s) return '—'; const { y, m, d } = parseD(s); return `${DAY_NAMES[weekday(s)]}, ${MONTHS[m - 1]} ${d}, ${y}`; }
function fmtDateMed(s) { if (!s) return '—'; const { m, d } = parseD(s); return `${DAY_SHORT[weekday(s)]} ${MON_SHORT[m - 1]} ${d}`; }
function fmtDateShort(s) { if (!s) return '—'; const { m, d } = parseD(s); return `${MON_SHORT[m - 1]} ${d}`; }
function fmtTime(t) {
  if (!t) return '—'; const [H, M] = t.split(':').map(Number);
  const h = H % 12 || 12; return `${h}:${pad2(M)} ${H < 12 ? 'AM' : 'PM'}`;
}
function fmtStamp(epoch) {
  if (!epoch) return '—'; const s = nyDateOf(epoch);
  return `${fmtDateMed(s)}, ${fmtTime(nyTimeOf(epoch))}`;
}
function fmtClock(epoch) {
  const p = nyParts(epoch); const h = p.H % 12 || 12;
  return `${h}:${pad2(p.M)}:${pad2(p.S)} ${p.H < 12 ? 'AM' : 'PM'}`;
}
function relDayLabel(s) {
  const t = todayNY(); const n = daysBetween(t, s);
  if (n === 0) return 'Today'; if (n === 1) return 'Tomorrow'; if (n === -1) return 'Yesterday';
  return DAY_NAMES[weekday(s)];
}
function monthKey(s) { return s.slice(0, 7); }
function fmtMonth(k) { const [y, m] = k.split('-').map(Number); return `${MONTHS[m - 1]} ${y}`; }

/* ---------- money (integer cents) ---------- */
function parseMoney(str) {
  if (str === null || str === undefined) return null;
  const s = String(str).replace(/[$,\s]/g, '');
  if (s === '') return null;
  if (!/^-?\d*(\.\d{0,2})?$/.test(s) || s === '.' || s === '-') return NaN;
  const neg = s.startsWith('-'); const [w, f = ''] = s.replace('-', '').split('.');
  const c = (parseInt(w || '0', 10) * 100) + parseInt((f + '00').slice(0, 2), 10);
  return neg ? -c : c;
}
function fmtMoney(c) {
  if (c === null || c === undefined || Number.isNaN(c)) return '—';
  const neg = c < 0; const a = Math.abs(c);
  const s = '$' + Math.floor(a / 100).toLocaleString('en-US') + '.' + pad2(a % 100);
  return neg ? '−' + s : s;
}
function centsToInput(c) { return c === null || c === undefined ? '' : (c / 100).toFixed(2); }

/* ---------- phone ---------- */
function phoneDigits(p) { let d = String(p || '').replace(/\D/g, ''); if (d.length === 11 && d[0] === '1') d = d.slice(1); return d; }
function fmtPhone(p) {
  const d = phoneDigits(p);
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  return String(p || '').trim();
}

/* ---------- hashing (reprint detection) ---------- */
function fnv(str) { let h = 0x811c9dc5; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(36); }

/* ---------- order model ---------- */
const byPos = (a, b) => (a.pos ?? 0) - (b.pos ?? 0);
function itemsOf(o, includeRemoved = false) {
  return Object.entries(o.items || {}).map(([id, it]) => ({ ...it, id }))
    .filter(it => includeRemoved || it.active !== false).sort(byPos);
}
function mapList(m) { return Object.entries(m || {}).map(([id, v]) => ({ ...v, id })).filter(v => !v.removed).sort((a, b) => (a.pos ?? a.at ?? 0) - (b.pos ?? b.at ?? 0)); }
function orderLabel(o) { return o.num ? `#${o.num}` : '#(new)'; }
function itemLabel(o, it) { return `${orderLabel(o)}-${it.suffix}`; }
function pickupEpoch(o) { return nyToEpoch(o.pickupDate, o.pickupTime || '00:00'); }
function paidCents(o) {
  let s = 0; for (const p of mapList(o.payments)) if (!p.voided) s += (p.kind === 'refund' ? -1 : 1) * (p.amountCents || 0);
  return s;
}
function balanceCents(o) { return o.totalCents === null || o.totalCents === undefined ? null : o.totalCents - paidCents(o); }
function payState(o) {
  const paid = paidCents(o); const bal = balanceCents(o);
  if (o.booking === 'canceled') return { key: 'canceled', label: paid ? `Canceled · ${fmtMoney(paid)} paid, no refund recorded` : 'Canceled · nothing paid' };
  if (bal === null) return { key: 'nototal', label: paid ? `Paid ${fmtMoney(paid)} · no total` : 'No total entered' };
  if (bal < 0) return { key: 'credit', label: `Credit ${fmtMoney(-bal)}` };
  if (bal === 0) return { key: 'paid', label: 'Paid' };
  if (paid === 0) return { key: 'unpaid', label: `Unpaid ${fmtMoney(bal)}` };
  return { key: 'part', label: `Part Paid · ${fmtMoney(bal)} due` };
}
function isCollected(it) { return !!it.collectedAt; }
function orderClosed(o) { const its = itemsOf(o); return its.length > 0 && its.every(isCollected); }
function extrasOf(it) { return Array.isArray(it.extras) ? it.extras.filter(x => x && !x.removed) : mapList(it.extras); }
function hasExtras(it) { return extrasOf(it).some(x => (x.desc || '').trim()); }
function planMet(it) { return !!(it.plan && (it.stage || 0) >= it.plan.milestone); }
function isOverdue(o, it, now = Date.now()) { return !isCollected(it) && (it.stage || 0) < 4 && now > pickupEpoch(o); }
function readyWaiting(it) { return !isCollected(it) && (it.stage || 0) === 4; }
function isCarryover(o, it, day) {
  return !!(it.plan && !planMet(it) && !isCollected(it) && it.plan.date < day && o.pickupDate > day);
}
/* ---------- cake description (labels: Flavor / Filling / Icing everywhere) ---------- */
const FILL_MODES = [['same', 'Same throughout'], ['layer', 'Different per layer'], ['half', 'Split in half']];
/** How the two filling slots are used: same | layer (1st/2nd layer) | half (left/right half, through every layer). */
function fillModeOf(x) { const m = x.fillMode || (x.filling2 ? 'layer' : 'same'); return m !== 'same' && !x.filling2 ? 'same' : m; }
function fillingBrief(x) {
  if (!x.filling) return ''; const m = fillModeOf(x);
  if (m === 'same' || (m === 'layer' && x.filling2 === x.filling)) return x.filling;
  return `${x.filling} / ${x.filling2} (${m === 'half' ? 'split in half' : 'by layer'})`;
}
function fillingLong(x) {
  if (!x.filling) return ''; const m = fillModeOf(x);
  if (m === 'half') return `SPLIT IN HALF — one half ${x.filling}, other half ${x.filling2} (every layer)`;
  if (m === 'layer' && x.filling2 !== x.filling) return `${x.filling} (1st layer) + ${x.filling2} (2nd layer)`;
  return x.filling;
}
function flavorBrief(x) { return x.flavor2 ? `${x.flavor} + ${x.flavor2} layer` : (x.flavor || ''); }
function flavorLong(x) { return x.flavor2 ? `${x.flavor} (2 layers) + ${x.flavor2} (1 layer)` : (x.flavor || ''); }
function groupsOf(it) { return (it.groups || []).filter(g => g && (+g.qty > 0 || g.flavor || g.filling || g.icing)); }
function groupBrief(g) { return `${g.qty || '?'} × ` + ([g.flavor && `Flavor: ${g.flavor}`, g.filling && `Filling: ${g.filling}`, g.icing && `Icing: ${g.icing}`].filter(Boolean).join(' · ') || 'not described'); }
function specHead(it) {
  const tk = typeKeyOf(it); let head;
  if (tk === 'tier') head = it.size || 'Tier-style cake';
  else if (tk === 'cupcakecake') head = `${it.qty || '?'}-count cupcake cake${it.addons && it.addons.shaped ? ' (shaped)' : ''}`;
  else if (tk === 'cupcakes') head = `${it.qty || '?'} custom cupcakes`;
  else if (tk === 'standard') head = it.size ? `${it.size} cake` : 'Cake';
  else if (tk === 'single') head = it.size || 'Single-layer cake';
  else head = [it.size, it.type].filter(Boolean).join(' ') || 'Item';
  if ((tk === 'standard' || tk === 'single') && it.qty > 1) head = `${it.qty} × ${head}`;
  return head;
}
function specParts(it) {
  const tk = typeKeyOf(it); const P = []; const tiers = it.tiers || []; const gs = groupsOf(it);
  if (tk === 'tier' && tiers.length) {
    if (tiers.length === 1) { const t = tiers[0]; if (t.flavor) P.push(`Flavor: ${flavorBrief(t)}`); if (t.filling) P.push(`Filling: ${fillingBrief(t)}`); }
    else P.push(tiers.map((t, k) => `Tier ${k + 1}: Flavor: ${flavorBrief(t) || '—'}, Filling: ${fillingBrief(t) || '—'}`).join(' | '));
  } else if (gs.length) {
    P.push(gs.map(groupBrief).join(' | '));
    return P;
  } else {
    if (it.flavor) P.push(`Flavor: ${flavorBrief(it)}`);
    const fb = fillingBrief(it); if (fb) P.push(`Filling: ${fb}`);
  }
  if (it.icing) P.push(`Icing: ${it.icing}`);
  return P;
}
function specBrief(it) { return [specHead(it), specParts(it).join(' · ')].filter(Boolean).join(' — '); }
/** Content that matters on a printed slip; a change means "Reprint Needed". */
function slipHash(o, it) {
  const notes = mapList(it.notes).map(n => n.text);
  return fnv(JSON.stringify([o.num, o.customer?.name, o.customer?.phone, o.pickupDate, o.pickupTime,
    it.suffix, it.type, it.size, it.qty, it.servings, it.flavor, it.flavor2, it.filling, it.filling2, it.icing, it.tiers,
    it.inscription, it.inscriptionColor, it.noInscription, it.colors, it.decoration, it.requests, it.addons, it.priceCents, o.takenBy,
    mapList(it.images).map(i => [i.asset, i.purpose]), extrasOf(it).map(x => [x.desc, x.customer]),
    it.plan ? [it.plan.date, it.plan.milestone] : null, notes, o.totalCents].concat(slipHashMore(it))));
}
function slipHashMore(it) {
  const ex = extrasOf(it).map(x => x.cents ?? null);
  const used = it.fillMode || groupsOf(it).length || it.shapeDesc || it.picturePhone || ex.some(c => c !== null);
  return used ? [[it.fillMode || '', groupsOf(it), it.shapeDesc || '', it.picturePhone || '', ex]] : [];
}
function reprintNeeded(o, it) { return !!it.printedHash && it.printedHash !== slipHash(o, it); }
function searchHaystack(o) {
  const its = itemsOf(o, true);
  return [o.num, o.customer?.name, o.customer?.email, phoneDigits(o.customer?.phone), o.takenBy,
    ...its.map(i => [i.inscription, i.decoration, i.colors, i.flavor, i.type, i.size, ...groupsOf(i).map(g => g.flavor), ...extrasOf(i).map(x => x.desc)].join(' '))].join(' ').toLowerCase();
}
function matchesQuery(o, q) {
  q = (q || '').trim().toLowerCase(); if (!q) return true;
  const hay = searchHaystack(o); const d = q.replace(/\D/g, '');
  return q.split(/\s+/).every(t => {
    const td = t.replace(/^#/, '');
    if (/^\d+(-[a-z])?$/i.test(td)) {
      const [n, suf] = td.split('-');
      if (String(o.num) === n && (!suf || itemsOf(o).some(i => i.suffix.toLowerCase() === suf.toLowerCase()))) return true;
      if (n.length >= 3 && phoneDigits(o.customer?.phone).includes(n)) return true;
      return false;
    }
    return hay.includes(t);
  }) || (d.length >= 4 && phoneDigits(o.customer?.phone).includes(d));
}
function suffixFor(i) { let s = ''; i++; while (i > 0) { const r = (i - 1) % 26; s = String.fromCharCode(65 + r) + s; i = Math.floor((i - 1) / 26); } return s; }

/* ---------- presets ---------- */
const DEFAULT_PRESETS = {
  types: [
    { id: 't1', label: 'Round cake' }, { id: 't2', label: 'Sheet cake' }, { id: 't3', label: 'Tier cake' },
    { id: 't4', label: 'Cupcake cake' }, { id: 't5', label: 'Custom cupcakes' }],
  sizes: [
    { id: 'z1', label: '8-inch round' }, { id: 'z2', label: 'Quarter sheet' },
    { id: 'z3', label: '6-inch round', example: true }, { id: 'z4', label: '10-inch round', example: true },
    { id: 'z5', label: 'Half sheet', example: true }, { id: 'z6', label: 'Full sheet', example: true }],
  flavors: [{ id: 'f1', label: 'Yellow' }, { id: 'f2', label: 'Chocolate' }, { id: 'f3', label: 'Marble', example: true }],
  fillings: [{ id: 'l0', label: 'No filling', example: true }, { id: 'l1', label: 'Custard', example: true }, { id: 'l2', label: 'Strawberry', example: true }, { id: 'l3', label: 'Chocolate mousse', example: true }],
  icings: [{ id: 'i1', label: 'Whipped cream', example: true }, { id: 'i2', label: 'Buttercream', example: true }, { id: 'i3', label: 'Fondant', example: true }]
};
const PRESET_LISTS = [
  ['types', 'Product types'], ['sizes', 'Sizes'], ['flavors', 'Cake flavors'], ['fillings', 'Fillings'], ['icings', 'Icings']];
const DEFAULT_CALENDAR = { closedWeekdays: [1], exceptions: {} };
function isClosedDay(cal, s) {
  const ex = cal.exceptions && cal.exceptions[s];
  if (ex) return !ex.open;
  return (cal.closedWeekdays || []).includes(weekday(s));
}
