/* ===== print.js — production slips, four per US Letter page (2 x 2) ===== */
const PAGE_W = 816, PAGE_H = 1056;              // 8.5 x 11 in at 96 px/in
const M_X = 38, M_Y = 38;                        // ~0.4 in printer margin
const SLOT_W = (PAGE_W - 2 * M_X) / 2, SLOT_H = (PAGE_H - 2 * M_Y) / 2;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nl2br = s => esc(s).replace(/\n/g, '<br>');

const BAKERY = { name: 'Pinho’s Bakery', addr: '1027 Chestnut Street, Roselle, NJ 07203', phone: '(908) 245-2388' };
const SEC_LABEL = { cake: 'Cake — fill & ice', dec: 'Decorate', notes: 'Notes' };
/* ---------- work slip: blocks tagged with the boxed section they belong to ---------- */
function slipBlocks(o, it, opt = {}) {
  const B = []; const tk = typeKeyOf(it);
  const kv = (sec, label, val, cls = '') => B.push({ sec, html: `<div class="blk kvi ${cls}"><span class="kl">${esc(label)}:</span> ${val}</div>` });
  const textBlock = (sec, label, text, cls = '') => B.push({ sec, html: `<div class="blk tb ${cls}">${label ? `<span class="kl">${esc(label)}:</span> ` : ''}<span class="tx">${nl2br(text)}</span></div>`, split: { label, text, cls, sec } });
  // CAKE (filler & icer)
  const prod = [`<span class="ptype">${esc(it.type || 'Product not set')}</span>`];
  if (it.size) prod.push(esc(it.size));
  if ((tk === 'cupcakecake' || tk === 'cupcakes') && it.qty) prod.push(`${esc(it.qty)} cupcakes`);
  else if (it.qty > 1) prod.push(`Qty ${esc(it.qty)}`);
  B.push({ sec: 'cake', html: `<div class="blk bp">${prod.join(' · ')}</div>` });
  if (tk === 'cupcakecake' && it.addons && it.addons.shaped) B.push({ sec: 'cake', html: `<div class="blk shape"><span class="kl">Shape / arrangement:</span> <b>${nl2br(it.shapeDesc || 'see notes')}</b></div>` });
  const gs = groupsOf(it);
  if (tk === 'tier' && (it.tiers || []).length) {
    it.tiers.forEach((t, k) => B.push({ sec: 'cake', html: `<div class="blk tierl"><div class="tierh2">Tier ${k + 1}${k === 0 && it.tiers.length > 1 ? ' (bottom)' : ''}${t.size ? ' · ' + esc(t.size) : ''}</div>
      <div class="kvi"><span class="kl">Flavor:</span> ${esc(flavorLong(t) || '—')}</div><div class="kvi"><span class="kl">Filling:</span> ${esc(fillingLong(t) || '—')}</div></div>` }));
  } else if (gs.length) {
    gs.forEach((g, k) => B.push({ sec: 'cake', html: `<div class="blk grp"><b class="gq">${esc(g.qty || '?')}</b><span><span class="kl">Flavor:</span> ${esc(g.flavor || '—')}${g.filling ? ` · <span class="kl">Filling:</span> ${esc(g.filling)}` : ''} · <span class="kl">Icing:</span> ${esc(g.icing || it.icing || '—')}</span></div>` }));
  } else if (tk !== 'other' || it.flavor) {
    kv('cake', 'Flavor', esc(flavorLong(it) || '—'));
    if (tk === 'standard' || it.filling) kv('cake', 'Filling', esc(fillingLong(it) || (tk === 'single' ? 'None (single layer)' : '—')), fillModeOf(it) === 'half' ? 'half' : '');
  }
  if (!gs.length) kv('cake', 'Icing', esc(it.icing || '—'));
  if (it.plan) B.push({ sec: 'cake', html: `<div class="blk flag plan">EARLY WORK: ${esc(STAGES[it.plan.milestone])} on ${esc(fmtDateMed(it.plan.date))}</div>` });
  // DECORATE
  B.push({ sec: 'dec', html: it.noInscription ? `<div class="blk insc none">NO INSCRIPTION</div>`
    : `<div class="blk insc"><div class="k">Inscription — exactly as written${it.inscriptionColor ? ` · <span class="icol">Writing color: ${esc(it.inscriptionColor)}</span>` : ''}</div><div class="itext">${it.inscription ? '“' + nl2br(it.inscription) + '”' : '<i>Not entered yet</i>'}</div></div>` });
  if (it.colors) textBlock('dec', 'Colors', it.colors);
  if (it.decoration) textBlock('dec', 'Decoration / theme', it.decoration);
  const A = it.addons || {}; const adds = [A.animated && 'Animated picture', A.portrait && 'Personal portrait', A.themeOn && 'Theme decoration', A.figuresOn && 'Figures'].filter(Boolean);
  if (adds.length) kv('dec', 'Add-ons', esc(adds.join(' · ')));
  if ((A.animated || A.portrait) && it.picturePhone) kv('dec', 'Picture contact', `<b>${esc(fmtPhone(it.picturePhone))}</b>`);
  const imgs = mapList(it.images);
  if (opt.receipt && imgs.length) B.push({ sec: 'dec', html: `<div class="blk kvi"><span class="kl">Pictures:</span> ${imgs.map((im, k) => `${k + 1}. ${esc(IMG_PURPOSE[im.purpose] || 'purpose not set')}`).join(' · ')} — <b>view in the app</b></div>` });
  else for (const [k, im] of imgs.entries()) B.push({ sec: 'dec', html: `<div class="blk img"><img src="${esc(blobUrl(im.thumb || im.asset))}" alt=""><div><div class="ipurp">${esc(IMG_PURPOSE[im.purpose] || 'Purpose not set')}</div><div class="iname">Image ${k + 1} of ${imgs.length} — full size in the app</div></div></div>` });
  const ex = extrasOf(it).filter(x => (x.desc || '').trim());
  if (ex.length) B.push({ sec: 'dec', html: `<div class="blk exlst"><span class="kl">Extras:</span> ${ex.map(x => `<span class="exi">${esc(x.desc)}</span>`).join(' · ')}</div>` });
  // NOTES
  if (it.attention && it.attention.on) B.push({ sec: 'notes', html: `<div class="blk flag attn">NEEDS ATTENTION: ${esc(it.attention.reason)}</div>` });
  if (it.requests) textBlock('notes', 'Customer request', it.requests);
  for (const n of mapList(it.notes).filter(n => n.kind === 'cust')) textBlock('notes', 'Customer request', n.text);
  for (const n of mapList(it.notes).filter(n => n.kind !== 'cust')) textBlock('notes', n.kind === 'mgr' ? 'Manager note' : 'Production note', n.text, 'note');
  return B;
}
/** Wrap consecutive blocks of the same section in a labeled box. */
function boxed(blocks, cont) {
  let out = '', cur = null, buf = [];
  const flush = () => { if (cur && buf.length) out += `<div class="sbox s-${cur}"><div class="sbl">${esc(SEC_LABEL[cur] || '')}${cont[cur] ? ' (continued)' : ''}</div>${buf.join('')}</div>`; buf = []; };
  for (const b of blocks) { if (b.sec !== cur) { flush(); cur = b.sec; } buf.push(b.html); }
  flush(); return out;
}
function slipHeader(o, it, partNo, parts) {
  const its = itemsOf(o); const idx = its.findIndex(x => x.id === it.id) + 1;
  const revised = it.printedHash && it.printedHash !== slipHash(o, it);
  return `<div class="sh">
    <div class="sh1"><span class="sday">${esc(DAY_NAMES[weekday(o.pickupDate)] || '')}</span><span class="snum">${esc(itemLabel(o, it))}</span></div>
    <div class="sh2"><span>${esc(fmtDateShort(o.pickupDate))} · ${esc(fmtTime(o.pickupTime))}</span><span class="sof">${its.length > 1 ? `Item ${idx} of ${its.length}` : 'Single item'}</span></div>
    <div class="sh3"><b>${esc(o.customer?.name || '(no name)')}</b> · ${esc(fmtPhone(o.customer?.phone) || 'no phone')}${o.demo ? ' · <b>PRACTICE</b>' : ''}${o.booking === 'draft' ? ' · <b>DRAFT</b>' : ''}</div>
    <div class="sh5"><span class="where">${it.frozen ? '<b>FROZEN</b> · ' : ''}Stored: ${it.storage ? `<b>${esc(it.storage)}</b>` : '<span class="wline"></span>'}</span><span class="rdy"><span class="box ${(it.stage || 0) >= 4 ? 'on' : ''}"></span>READY</span></div>
    ${o.takenBy ? `<div class="sh4">Order taken by: ${esc(o.takenBy)}</div>` : ''}
    ${partNo > 1 ? `<div class="contb">CONTINUED — part ${partNo} of ${parts}</div>` : (parts > 1 ? `<div class="contb soft">Part 1 of ${parts} — more on next slip</div>` : '')}
    ${revised && partNo === 1 ? `<div class="contb">REVISED — replaces earlier slip</div>` : ''}
  </div>`;
}
function slipFooter(o, it, first, partNo, parts) {
  const stamp = `Printed ${esc(fmtStamp(Date.now()))} · rev ${esc(slipHash(o, it))}`;
  if (!first) return `<div class="sf small">${esc(itemLabel(o, it))} continued · part ${partNo} of ${parts} · amounts on part 1<br>${stamp}</div>`;
  const multi = itemsOf(o).length > 1;
  return `<div class="sf">
    <div class="mrow"><span><span class="kl">This item</span> ${esc(fmtMoney(it.priceCents ?? null))}</span><span><span class="kl">${multi ? 'Order total' : 'Total'}</span> ${esc(fmtMoney(o.totalCents ?? null))}</span><span><span class="kl">Paid</span> ${esc(fmtMoney(paidCents(o)))}</span><span><b><span class="kl">Balance</span> ${esc(fmtMoney(balanceCents(o)))}</b></span></div>
    <div class="small">${multi ? 'Total, paid and balance are for the whole order · ' : ''}${stamp}</div>
  </div>`;
}
function workSlot(o, it) { return (body, partNo, parts, cont) => `<div class="slip">${slipHeader(o, it, partNo, parts)}<div class="sb">${boxed(body, cont)}</div>${slipFooter(o, it, partNo === 1, partNo, parts)}</div>`; }
/* ---------- customer copy (receipt to bring at pickup) ---------- */
function customerBlocks(o) {
  const B = []; const its = itemsOf(o);
  its.forEach(it => {
    const insc = it.noInscription ? 'No writing' : it.inscription ? `“${esc(it.inscription)}”${it.inscriptionColor ? ` (${esc(it.inscriptionColor)})` : ''}` : '';
    const ex = extrasOf(it).filter(x => (x.desc || '').trim()).map(x => esc(x.desc));
    const parts = specParts(it).map(esc).join(' · ');
    B.push({ sec: 'items', html: `<div class="blk citem"><div class="cih"><b>${its.length > 1 ? `${esc(it.suffix)} · ` : ''}${esc(specHead(it))}</b><span>${esc(fmtMoney(it.priceCents ?? null))}</span></div>
      ${parts ? `<div class="cid">${parts}</div>` : ''}${insc ? `<div class="cid"><span class="kl">Writing:</span> ${insc}</div>` : ''}${it.decoration ? `<div class="cid"><span class="kl">Design:</span> ${esc(it.decoration)}</div>` : ''}${ex.length ? `<div class="cid"><span class="kl">Extras:</span> ${ex.join(', ')}</div>` : ''}</div>` });
  });
  return B;
}
function custSlot(o) {
  return (body, partNo, parts) => `<div class="slip cust">
    <div class="ch"><div class="cbrand"><span class="cname">Pinho’s</span><span class="csub">Bakery</span></div><div class="cinfo">${esc(BAKERY.addr)}<br>${esc(BAKERY.phone)}</div></div>
    <div class="cord"><div><span class="kl">Order</span><b class="cnum">${esc(orderLabel(o))}</b></div><div class="cpick"><span class="kl">Pickup</span><b>${esc(fmtDateLong(o.pickupDate))}</b><b>${esc(fmtTime(o.pickupTime))}</b></div></div>
    <div class="cwho"><b>${esc(o.customer?.name || '')}</b> · ${esc(fmtPhone(o.customer?.phone))}</div>
    ${partNo > 1 ? `<div class="contb soft">Continued — page ${partNo} of ${parts}</div>` : parts > 1 ? `<div class="contb soft">Page 1 of ${parts}</div>` : ''}
    <div class="sb">${body.map(b => b.html).join('')}</div>
    ${partNo === parts ? `<div class="ctot"><div><span class="kl">Total</span><b>${esc(fmtMoney(o.totalCents ?? null))}</b></div><div><span class="kl">Paid</span><b>${esc(fmtMoney(paidCents(o)))}</b></div><div class="cbal"><span class="kl">Balance due</span><b>${esc(fmtMoney(Math.max(0, balanceCents(o) ?? 0)))}</b></div></div>` : ''}
    <div class="cfoot">Please bring this slip when you pick up your order. Thank you!${o.demo ? ' · PRACTICE' : ''}</div>
  </div>`;
}
/* ---------- splitting: fill a slot, carry overflow onto continuation slips ---------- */
let _meas = null;
function measureBox(w = SLOT_W, h = SLOT_H) {
  if (!_meas) { _meas = document.createElement('div'); _meas.className = 'pg-measure'; document.body.appendChild(_meas); }
  _meas.style.cssText = `position:absolute;left:-30000px;top:0;width:${w}px;height:${h}px;visibility:hidden;`;
  return _meas;
}
function paginate(blocks, slot) {
  const meas = measureBox();
  const contOf = (body) => { const c = {}; for (const b of body) if (b.cont && !c[b.sec]) c[b.sec] = true; return c; };
  const fits = (body, partNo) => { meas.innerHTML = slot(body, partNo, 9, contOf(body)); const b = meas.querySelector('.sb'); return b.scrollHeight <= b.clientHeight + 1; };
  const mk = (sp, text, cont) => ({ sec: sp.sec, cont, html: `<div class="blk tb ${sp.cls}">${sp.label ? `<span class="kl">${esc(sp.label)}${cont ? ' (continued)' : ''}:</span> ` : ''}<span class="tx">${nl2br(text)}</span></div>` });
  const parts = []; let cur = []; const queue = [...blocks]; let guard = 0;
  while (queue.length && guard++ < 2000) {
    const blk = queue.shift(); const partNo = parts.length + 1;
    if (fits([...cur, blk], partNo)) { cur.push(blk); continue; }
    if (blk.split) {
      const words = blk.split.text.split(/(\s+)/); let lo = 0, hi = words.length - 1, best = 0;
      while (lo <= hi) { const mid = (lo + hi) >> 1; if (fits([...cur, mk(blk.split, words.slice(0, mid + 1).join('') + ' …', blk.split.cont)], partNo)) { best = mid + 1; lo = mid + 1; } else hi = mid - 1; }
      if (best >= 8 || (cur.length === 0 && best > 0)) {
        cur.push(mk(blk.split, words.slice(0, best).join('') + ' …', blk.split.cont));
        const sp = { ...blk.split, text: words.slice(best).join('').trim(), cont: true };
        queue.unshift({ ...mk(sp, sp.text, true), split: sp }); parts.push(cur); cur = []; continue;
      }
    }
    if (!cur.length) { cur.push(blk); parts.push(cur); cur = []; continue; }
    parts.push(cur); cur = []; queue.unshift({ ...blk, cont: blk.cont || (parts[parts.length - 1].some(b => b.sec === blk.sec)) });
  }
  if (cur.length || !parts.length) parts.push(cur);
  return parts.map((p, i) => slot(p, i + 1, parts.length, contOf(p)));
}
function fourUp(slips, kindLabel) {
  const pages = [];
  for (let i = 0; i < slips.length; i += 4) {
    const four = slips.slice(i, i + 4);
    const slots = [0, 1, 2, 3].map(k => { const x = M_X + (k % 2) * SLOT_W, y = M_Y + Math.floor(k / 2) * SLOT_H; return `<div class="slot" style="left:${x}px;top:${y}px;width:${SLOT_W}px;height:${SLOT_H}px">${four[k] || ''}</div>`; }).join('');
    pages.push(`<div class="pg">${slots}<div class="cutv" style="left:${PAGE_W / 2}px;top:${M_Y - 18}px;height:${PAGE_H - 2 * M_Y + 36}px"></div>
      <div class="cuth" style="top:${PAGE_H / 2}px;left:${M_X - 18}px;width:${PAGE_W - 2 * M_X + 36}px"></div>
      <div class="cutlbl">${kindLabel} · page ${pages.length + 1} of ${Math.ceil(slips.length / 4)} · cut on the dashed lines</div></div>`);
  }
  return pages;
}
/* ---------- full-page tables: daily manifest and extras list ---------- */
function tablePages({ title, sub, cols, rows, foot }) {
  const meas = measureBox(PAGE_W, PAGE_H);
  const page = (rs, n, N) => `<div class="pg tpg"><div class="tph"><div><div class="tpt">${esc(title)}</div><div class="tps">${esc(sub || '')}</div></div><div class="tpb">Pinho’s Bakery</div></div>
    <div class="sb tbody"><table class="ptab"><colgroup>${cols.map(c => `<col style="width:${c.w}">`).join('')}</colgroup><thead><tr>${cols.map(c => `<th class="${c.cls || ''}">${esc(c.h)}</th>`).join('')}</tr></thead><tbody>${rs.join('')}</tbody></table></div>
    <div class="tpf">${esc(foot || '')}${foot ? ' · ' : ''}Printed ${esc(fmtStamp(Date.now()))} · page ${n} of ${N}</div></div>`;
  const tr = r => `<tr class="${r.cls || ''}">${r.cells.map((c, k) => `<td class="${cols[k].cls || ''}">${c}</td>`).join('')}</tr>`;
  const html = rows.map(tr); const groups = []; let cur = [];
  const fits = rs => { meas.innerHTML = page(rs, 1, 1); const b = meas.querySelector('.sb'); return b.scrollHeight <= b.clientHeight + 1; };
  for (const h of html) { if (fits([...cur, h]) || !cur.length) cur.push(h); else { groups.push(cur); cur = [h]; } }
  if (cur.length || !groups.length) groups.push(cur);
  return groups.map((g, i) => page(g.length ? g : [`<tr><td colspan="${cols.length}" class="none">Nothing to list.</td></tr>`], i + 1, groups.length));
}
const BOX = '<span class="tbox"></span>';
function shortCake(it) { const f = typeKeyOf(it) === 'tier' ? (it.tiers || []).map(t => t.flavor).filter(Boolean).join(' / ') : groupsOf(it).length ? groupsOf(it).map(g => g.flavor).filter(Boolean).join(' / ') : flavorBrief(it); return specHead(it) + (f ? ` · ${f}` : ''); }
function manifestPages(day) {
  const { pick } = dayModel(day);
  const rows = [];
  for (const g of pick) for (const it of itemsOf(g.o)) rows.push({ cls: isCollected(it) ? 'gone' : '', cells: [BOX, esc(fmtTime(g.o.pickupTime)), `<b>${esc(itemLabel(g.o, it))}</b>`, esc(g.o.customer?.name || ''), esc(shortCake(it)),
    it.noInscription ? '<i>No inscription</i>' : esc(it.inscription || '—'), `${it.frozen ? '<b>Frozen</b> ' : ''}${esc(it.storage || '')}${isCollected(it) ? ' <i>(picked up)</i>' : (it.stage || 0) === 4 ? ' <b>Ready</b>' : ''}`] });
  return tablePages({ title: `Daily checklist — ${fmtDateLong(day)}`, sub: `${rows.length} ${rows.length === 1 ? 'item' : 'items'} for pickup · tick each cake when you see it on the floor, in the fridge or in the freezer`,
    cols: [{ h: '✓', w: '28px', cls: 'c' }, { h: 'Time', w: '62px' }, { h: 'Order', w: '72px' }, { h: 'Customer', w: '120px' }, { h: 'Cake', w: '200px' }, { h: 'Inscription', w: '150px' }, { h: 'Where', w: 'auto' }], rows, foot: 'Daily checklist' });
}
function extrasRows(from, to) {
  const rows = [];
  for (const o of confirmedOrders().filter(o => o.pickupDate >= from && o.pickupDate <= to).sort((a, b) => (a.pickupDate + (a.pickupTime || '')).localeCompare(b.pickupDate + (b.pickupTime || '')) || a.num - b.num))
    for (const it of itemsOf(o)) { if (isCollected(it)) continue; for (const x of extrasOf(it)) if ((x.desc || '').trim()) rows.push({ o, it, x }); }
  return rows;
}
function extrasPages(from, to) {
  const list = extrasRows(from, to);
  return tablePages({ title: 'Extras to check', sub: `${list.length} extras on pickups ${fmtDateMed(from)} – ${fmtDateMed(to)} · tick Have if it’s on hand, Order if it still needs ordering`,
    cols: [{ h: 'Pickup', w: '92px' }, { h: 'Order', w: '72px' }, { h: 'Customer', w: '120px' }, { h: 'Cake', w: '180px' }, { h: 'Extra', w: 'auto' }, { h: 'Have', w: '40px', cls: 'c' }, { h: 'Order', w: '44px', cls: 'c' }],
    rows: list.map(({ o, it, x }) => ({ cells: [`${esc(fmtDateMed(o.pickupDate))}<br><small>${esc(fmtTime(o.pickupTime))}</small>`, `<b>${esc(itemLabel(o, it))}</b>`, esc(o.customer?.name || ''), esc(shortCake(it)), `<b>${esc(x.desc)}</b>`, BOX, BOX] })), foot: 'Extras list' });
}
/** Build printable pages. P = { kind, refs, day, from, to } */
function layoutPrint(P, entries) {
  let pages = [], count = 0, extra = 0;
  if (P.kind === 'manifest') { pages = manifestPages(P.day); }
  else if (P.kind === 'extras') { pages = extrasPages(P.from, P.to); }
  else if (P.kind === 'customer') {
    const seen = new Set(); const slips = [];
    for (const e of entries) { if (seen.has(e.o.id)) continue; seen.add(e.o.id); count++; slips.push(...paginate(customerBlocks(e.o), custSlot(e.o))); }
    extra = slips.length - count; pages = fourUp(slips, 'Customer copies');
  } else {
    const slips = []; for (const e of entries) slips.push(...paginate(slipBlocks(e.o, e.it), workSlot(e.o, e.it)));
    count = entries.length; extra = slips.length - count; pages = fourUp(slips, 'Work slips');
    if (P.kind === 'both') {
      const seen = new Set(); const cs = [];
      for (const e of entries) { if (seen.has(e.o.id)) continue; seen.add(e.o.id); cs.push(...paginate(customerBlocks(e.o), custSlot(e.o))); }
      pages = pages.concat(fourUp(cs, 'Customer copies'));
    }
  }
  if (_meas) _meas.innerHTML = '';
  return { pages, count, extra };
}
function loadScript(src) {
  return new Promise((res, rej) => {
    if (document.querySelector(`script[src="${src}"]`) && window.__loaded && window.__loaded[src]) return res();
    const s = document.createElement('script'); s.src = src; s.onload = () => { (window.__loaded = window.__loaded || {})[src] = 1; res(); };
    s.onerror = () => rej({ message: 'The PDF tools could not be loaded. Check the internet connection and try again.' });
    document.head.appendChild(s);
  });
}
async function waitImages(el) {
  await Promise.all([...el.querySelectorAll('img')].map(img => img.complete ? 0 : new Promise(r => { img.onload = img.onerror = r; setTimeout(r, 8000); })));
}
async function makePdf(pages, onProgress) {
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
  if (document.fonts && document.fonts.ready) await document.fonts.ready;
  const host = document.createElement('div'); host.className = 'pdf-host';
  host.style.cssText = 'position:fixed;left:0;top:0;z-index:-50;pointer-events:none;';
  document.body.appendChild(host);
  const pdf = new window.jspdf.jsPDF({ unit: 'in', format: 'letter', orientation: 'portrait', compress: true });
  const scale = pages.length > 12 ? 2 : 2.5;
  try {
    for (let i = 0; i < pages.length; i++) {
      onProgress && onProgress(i + 1, pages.length);
      host.innerHTML = pages[i]; const el = host.firstElementChild; await waitImages(el);
      const c = await window.html2canvas(el, { scale, backgroundColor: '#ffffff', useCORS: true, logging: false, width: PAGE_W, height: PAGE_H, windowWidth: PAGE_W, scrollX: 0, scrollY: 0 });
      if (i) pdf.addPage('letter', 'portrait');
      pdf.addImage(c.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, 8.5, 11);
    }
  } finally { host.remove(); }
  return pdf.output('blob');
}

/* ===== receipt printer (Star TSP143IV, 80 mm paper, 576 dots across) ===== */
const RC_W = 256, RC_DOTS = 576, RC_SCALE = RC_DOTS / RC_W;
function rcWork(o, it) { return `<div class="slip rc">${slipHeader(o, it, 1, 1)}<div class="sb">${boxed(slipBlocks(o, it, { receipt: true }), {})}</div>${slipFooter(o, it, true, 1, 1)}</div>`; }
function rcCustomer(o) {
  return `<div class="slip rc rcc">
    <div class="rch"><img class="rlogo" src="${esc(bwLogo())}" alt=""><div class="cname">Pinho’s</div><div class="csub">Bakery</div><div class="cinfo">${esc(BAKERY.addr)}<br>${esc(BAKERY.phone)}</div></div>
    <div class="rcord"><span class="kl">Order</span><b class="cnum">${esc(orderLabel(o))}</b></div>
    <div class="rcpick"><span class="kl">Pickup</span><b>${esc(fmtDateLong(o.pickupDate))}</b><b class="rct">${esc(fmtTime(o.pickupTime))}</b></div>
    <div class="cwho"><b>${esc(o.customer?.name || '')}</b><br>${esc(fmtPhone(o.customer?.phone))}</div>
    <div class="sb">${customerBlocks(o).map(b => b.html).join('')}</div>
    <div class="ctot"><div><span class="kl">Total</span><b>${esc(fmtMoney(o.totalCents ?? null))}</b></div><div><span class="kl">Paid</span><b>${esc(fmtMoney(paidCents(o)))}</b></div><div class="cbal"><span class="kl">Balance due</span><b>${esc(fmtMoney(Math.max(0, balanceCents(o) ?? 0)))}</b></div></div>
    <div class="cfoot">Please bring this receipt when you pick up your order. Thank you!${o.demo ? '<br>PRACTICE ORDER' : ''}</div>
  </div>`;
}
/** Receipts for a set of entries: one bakery slip per item, then one customer copy per order. */
function receiptSet(entries, { bakery = true, customer = true } = {}) {
  const out = []; const seen = new Set();
  if (bakery) for (const e of entries) out.push({ kind: 'bakery', label: `${itemLabel(e.o, e.it)} bakery`, html: rcWork(e.o, e.it), entry: e });
  if (customer) for (const e of entries) { if (seen.has(e.o.id)) continue; seen.add(e.o.id); out.push({ kind: 'customer', label: `${orderLabel(e.o)} customer`, html: rcCustomer(e.o) }); }
  return out;
}
let _bwLogo = null;
function bwLogo() {
  if (_bwLogo) return _bwLogo;
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const k = 2;
  g.fillStyle = '#fff'; g.fillRect(0, 0, 128, 128); g.scale(k, k);
  g.strokeStyle = '#000'; g.lineWidth = 2.6; g.beginPath(); if (g.roundRect) g.roundRect(2, 2, 60, 60, 14); else g.rect(2, 2, 60, 60); g.stroke();
  g.lineWidth = 1.6; g.beginPath(); g.moveTo(16, 56); g.bezierCurveTo(25, 41, 34, 26, 47, 8); g.stroke();
  g.fillStyle = '#000';
  for (const w of WHEAT) { g.save(); g.translate(w.cx, w.cy); g.rotate(w.rot * Math.PI / 180); g.beginPath(); g.ellipse(0, 0, 1.9, 4.1, 0, 0, Math.PI * 2); g.fill(); g.restore(); }
  g.font = `46px 'Great Vibes', 'Brush Script MT', cursive`; g.textAlign = 'center'; g.lineWidth = 5; g.strokeStyle = '#fff'; g.strokeText('P', 31, 47); g.fillText('P', 31, 47);
  const url = c.toDataURL('image/png');
  if (!document.fonts || document.fonts.check(`46px 'Great Vibes'`)) _bwLogo = url;
  return url;
}
async function receiptPngs(list, onProgress) {
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
  if (document.fonts) { try { await document.fonts.load(`46px 'Great Vibes'`); await document.fonts.ready; } catch { } }
  _bwLogo = null;
  const host = document.createElement('div'); host.className = 'pdf-host';
  host.style.cssText = `position:fixed;left:0;top:0;z-index:-50;pointer-events:none;width:${RC_W}px;background:#fff`;
  document.body.appendChild(host); const out = [];
  try {
    for (let i = 0; i < list.length; i++) {
      onProgress && onProgress(i + 1, list.length);
      host.innerHTML = list[i].html.replace(/src="[^"]*" alt="" class="rlogo"|class="rlogo" src="[^"]*"/, `class="rlogo" src="${bwLogo()}"`);
      const el = host.firstElementChild; await waitImages(el);
      const c = await window.html2canvas(el, { scale: RC_SCALE, backgroundColor: '#ffffff', logging: false, width: RC_W, windowWidth: RC_W, scrollX: 0, scrollY: 0 });
      out.push({ ...list[i], png: toMono(c), w: c.width, h: c.height });
    }
  } finally { host.remove(); }
  return out;
}
/** Thermal paper prints black or nothing: turn anti-aliased grey into crisp black/white. */
function toMono(c) {
  const W = RC_DOTS, H = Math.round(c.height * RC_DOTS / c.width);
  const m = document.createElement('canvas'); m.width = W; m.height = H; const g = m.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); g.drawImage(c, 0, 0, W, H);
  const d = g.getImageData(0, 0, W, H); const a = d.data;
  for (let i = 0; i < a.length; i += 4) { const v = (a[i] * 299 + a[i + 1] * 587 + a[i + 2] * 114) / 1000 < 165 ? 0 : 255; a[i] = a[i + 1] = a[i + 2] = v; a[i + 3] = 255; }
  g.putImageData(d, 0, 0); return m.toDataURL('image/png');
}
/** Fallback when no receipt printer is connected: one 80 mm-wide PDF page per receipt. */
async function receiptPdf(pngs) {
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
  const pdf = new window.jspdf.jsPDF({ unit: 'mm', format: [80, 100], orientation: 'portrait', compress: true });
  pngs.forEach((p, i) => { const h = p.h * 72 / p.w + 8; if (i) pdf.addPage([80, h], 'portrait'); else { pdf.deletePage(1); pdf.addPage([80, h], 'portrait'); } pdf.addImage(p.png, 'PNG', 4, 4, 72, p.h * 72 / p.w); });
  return pdf.output('blob');
}
/* The cloud build sets window.__printer = { send(jobs), status(), jobs(ids) }. */
const hasPrinter = () => !!window.__printer;
/** Render and send receipts. Returns { sent, jobIds } or { pdf:true } after saving the fallback PDF. */
async function printReceipts(list, onProgress) {
  const pngs = await receiptPngs(list, onProgress);
  if (hasPrinter()) {
    onProgress && onProgress(0, 0, 'Sending to the receipt printer…');
    const r = await window.__printer.send(pngs.map(p => ({ label: p.label, png: p.png })));
    return { sent: pngs.length, jobIds: r.ids || [] };
  }
  if (!Store.downloads) throw { message: 'No receipt printer is connected here, and saving files is not available in this view.' };
  const blob = await receiptPdf(pngs);
  await Store.downloads.save({ filename: `pinhos-receipts-${Date.now()}.pdf`, data: blob });
  return { pdf: true, sent: pngs.length };
}
