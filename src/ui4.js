/* ===== ui4.js — front counter, backup export, practice refresh, menu & price editor ===== */

/* ---------- Pickup (front counter) ---------- */
function counterGroups() {
  const today = todayNY(); const orders = confirmedOrders();
  const waiting = [], notReady = [], done = [];
  for (const o of orders) {
    const its = itemsOf(o); const open = its.filter(it => !isCollected(it));
    if (o.pickupDate === today || (o.pickupDate < today && o.pickupDate >= addDays(today, -14) && open.length)) {
      if (!open.length) { if (its.some(it => it.collectedAt && nyDateOf(it.collectedAt) === today)) done.push(o); }
      else if (open.some(it => (it.stage || 0) === 4)) waiting.push(o);
      else notReady.push(o);
    }
  }
  const t = (a, b) => (a.pickupDate + a.pickupTime).localeCompare(b.pickupDate + b.pickupTime);
  return { waiting: waiting.sort(t), notReady: notReady.sort(t), done: done.sort(t) };
}
function CounterCard({ o, on, pick }) {
  const its = itemsOf(o); const ready = its.filter(it => (it.stage || 0) === 4 && !isCollected(it)); const coll = its.filter(isCollected).length;
  const late = Date.now() > pickupEpoch(o) && its.some(it => !isCollected(it));
  const ps = payState(o); const where = [...new Set(ready.map(it => it.storage).filter(Boolean))].join(', ');
  const open = its.filter(it => !isCollected(it)); const st = !open.length ? 'coll' : open.every(it => (it.stage || 0) === 4) ? 'rdy' : ready.length ? 'part' : 'wip';
  return html`<button class=${'ccard' + (on ? ' on' : '')} onClick=${() => pick(o.id)}>
    <span class=${'ccstat ' + st}>${st === 'coll' ? html`<${Icon} n="check" s=${26} /><b>PICKED UP</b>` : st === 'rdy' ? html`<${Icon} n="check" s=${26} /><b>READY</b>` : st === 'part' ? html`<${Icon} n="clock" s=${26} /><b>PART READY</b>` : html`<${Icon} n="clock" s=${26} /><b>IN PROGRESS</b>`}</span>
    <span class="cc-time">${o.pickupDate !== todayNY() ? html`<small>${fmtDateMed(o.pickupDate)}</small>` : ''}${fmtTime(o.pickupTime)}${late ? html`<small class="badtxt">late</small>` : ''}</span>
    <span class="cc-main"><b>${o.customer?.name}</b> <span class="muted">${orderLabel(o)}${o.demo ? ' · Practice' : ''}</span>
      <span class="cc-sub">${its.length} ${its.length === 1 ? 'item' : 'items'} · ${ready.length} ready${coll ? ` · ${coll} picked up` : ''}${where ? ` · ${where}` : ''}</span></span>
    <span class=${'cc-bal paytag ' + ps.key}>${ps.key === 'paid' ? 'Paid' : ps.key === 'nototal' ? 'No total' : ps.key === 'credit' ? 'Credit' : fmtMoney(balanceCents(o))}</span></button>`;
}
function CounterScreen() {
  const [q, setQ] = useState(''); const [selId, setSelId] = useState(null);
  const inp = useRef();
  useEffect(() => { inp.current && inp.current.focus(); }, []);
  const sel = selId ? getOrder(selId) : null;
  const today = todayNY();
  let found = null;
  if (q.trim()) found = confirmedOrders().filter(o => matchesQuery(o, q)).sort((a, b) => Math.abs(daysBetween(today, a.pickupDate)) - Math.abs(daysBetween(today, b.pickupDate)) || (a.pickupTime || '').localeCompare(b.pickupTime || '')).slice(0, 30);
  const G = counterGroups();
  const pick = id => setSelId(id);
  const list = found ? html`<div class="cgroup"><h2>${found.length ? `Matches (${found.length})` : 'No matching orders'}</h2>${found.map(o => html`<${CounterCard} key=${o.id} o=${o} on=${o.id === selId} pick=${pick} />`)}</div>`
    : html`${[['Ready — waiting for customer', G.waiting], ['Not ready yet', G.notReady], ['Picked up today', G.done]].map(([t, l]) => html`<div class="cgroup"><h2>${t} <span class="secn">${l.length}</span></h2>
        ${l.length ? l.map(o => html`<${CounterCard} key=${o.id} o=${o} on=${o.id === selId} pick=${pick} />`) : html`<p class="muted small">None.</p>`}</div>`)}`;
  return html`<div class="screen counter">
    <div class="dayhead"><h1>Pickup counter</h1><span class="muted">${fmtDateLong(today)}</span></div>
    <div class=${'cwrap' + (sel ? ' has' : '')}>
      <div class="clist">
        <div class="searchbox big"><${Icon} n="search" /><label class="vh" for="cq">Find the customer</label>
          <input id="cq" ref=${inp} type="search" value=${q} placeholder="Customer name, phone or order #" onInput=${e => setQ(e.target.value)} /></div>
        ${list}
      </div>
      <div class="cpanel">${sel ? html`
        <button class="btn sm ghost narrowonly" onClick=${() => setSelId(null)}><${Icon} n="left" s=${16} />Back to list</button>
        <div class="cphead"><h2>${sel.customer?.name} <span class="muted">${orderLabel(sel)}</span></h2>
          <p><b>${fmtDateMed(sel.pickupDate)} · ${fmtTime(sel.pickupTime)}</b> · ${fmtPhone(sel.customer?.phone)} · <button class="link" onClick=${() => openDetail(sel.id, itemsOf(sel)[0]?.id, { tab: 'prod' })}>Open full order</button></p></div>
        <${PickupPanel} key=${sel.id} o=${sel} />` : html`<div class="empty">Search or tap a customer to see their cake, where it’s stored, and what they owe.</div>`}</div>
    </div>
  </div>`;
}

/* ---------- Backup export (spreadsheet / CSV) ---------- */
function csvCell(v) { const s = v === null || v === undefined ? '' : String(v); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
function ordersToCSV(orders) {
  const H = ['Order #', 'Item', 'Booking', 'Pickup date', 'Day', 'Pickup time', 'Customer', 'Phone', 'Email', 'Taken by', 'Product', 'Size', 'Qty', 'Servings', 'Cake flavor', 'Filling', 'Icing', 'Tiers',
    'Inscription', 'Inscription color', 'Colors', 'Decoration / theme', 'Customer requests', 'Paid decoration', 'Extras', 'Stage', 'Frozen', 'Storage', 'Picked up', 'Item price', 'Price note',
    'Order total (shared)', 'Paid (shared)', 'Balance (shared)', 'Production notes', 'Manager notes', 'Practice order'];
  const rows = [H];
  const sorted = [...orders].sort((a, b) => ((a.pickupDate || '') + (a.pickupTime || '')).localeCompare((b.pickupDate || '') + (b.pickupTime || '')) || a.num - b.num);
  for (const o of sorted) for (const it of itemsOf(o)) {
    const notes = mapList(it.notes); const A = it.addons || {};
    rows.push([o.num, `${o.num}-${it.suffix}`, o.booking, o.pickupDate, o.pickupDate ? DAY_NAMES[weekday(o.pickupDate)] : '', fmtTime(o.pickupTime), o.customer?.name, fmtPhone(o.customer?.phone), o.customer?.email, o.takenBy,
      it.type, it.size, it.qty, it.servings, groupsOf(it).length ? groupsOf(it).map(groupBrief).join(' | ') : flavorLong(it), fillingLong(it), it.icing,
      (it.tiers || []).map(t => `${t.size}: Flavor ${flavorLong(t) || '-'} / Filling ${fillingLong(t) || '-'}`).join('; '),
      it.noInscription ? 'NO INSCRIPTION' : it.inscription, it.inscriptionColor, it.colors, it.decoration,
      [it.requests, ...notes.filter(n => n.kind === 'cust').map(n => n.text)].filter(Boolean).join(' | '),
      [A.animated && 'Animated picture', A.portrait && 'Portrait', A.shaped && `Shaped${it.shapeDesc ? ': ' + it.shapeDesc : ''}`, A.themeOn && 'Theme', A.figuresOn && 'Figures', it.picturePhone && `Picture contact ${fmtPhone(it.picturePhone)}`, ...(A.custom || []).map(c => c.label)].filter(Boolean).join(', '),
      extrasOf(it).filter(x => (x.desc || '').trim()).map(x => `${x.desc}${x.cents ? ` (${fmtMoney(x.cents)})` : ''}`).join('; '), STAGES[it.stage || 0], it.frozen ? 'Yes' : '', it.storage, it.collectedAt ? fmtStamp(it.collectedAt) : '',
      it.priceCents === null || it.priceCents === undefined ? '' : (it.priceCents / 100).toFixed(2), it.price ? (it.price.override ? `Override: ${it.price.override.reason}` : it.price.complete ? '' : 'Not final') : '',
      o.totalCents === null || o.totalCents === undefined ? '' : (o.totalCents / 100).toFixed(2), (paidCents(o) / 100).toFixed(2), balanceCents(o) === null ? '' : (balanceCents(o) / 100).toFixed(2),
      notes.filter(n => n.kind === 'prod').map(n => n.text).join(' | '), notes.filter(n => n.kind === 'mgr').map(n => n.text).join(' | '), o.demo ? 'Yes' : '']);
  }
  return rows.map(r => r.map(csvCell).join(',')).join('\r\n');
}
async function saveBackup(orders, tag) {
  if (!Store.downloads) { toast('Saving files isn’t available in this view. Try the Claude app or a desktop browser.', 'bad'); return false; }
  try {
    await Store.downloads.save({ filename: `pinhos-orders-${tag}-${todayNY()}.csv`, data: new Blob(['﻿' + ordersToCSV(orders)], { type: 'text/csv' }) });
    toast(`Spreadsheet saved (${orders.length} orders). It opens in Excel, Numbers or Google Sheets.`); return true;
  } catch (e) { if (e && e.code !== 'declined') toast(errText(e), 'bad'); return false; }
}
function BackupDialog() {
  const [scope, setScope] = useState('upcoming'); const [busy, run] = useBusy();
  const today = todayNY(); const live = visibleOrders();
  const pickFor = async () => {
    if (scope === 'upcoming') return live.filter(o => o.booking !== 'canceled' && (o.pickupDate || '9999') >= addDays(today, -30));
    if (scope === 'live') return live;
    const arch = await loadArchive('2000-01-01', addDays(today, -1)); const demo = Store.mode === 'demo';
    return [...live, ...arch.filter(o => !!o.demo === demo && !Store.orders.has(o.id))];
  };
  return html`<${Modal} title="Download a backup">
    <p>Saves a spreadsheet (CSV) with one row per cake: order number, customer, phone, pickup, cake details, inscription and color, extras, stage, prices and balance. Photos are not included.</p>
    <div class="menu">${[['upcoming', 'Upcoming orders + the last 30 days (recommended)'], ['live', 'Everything in the current list'], ['all', 'Everything, including archived orders']].map(([k, l]) => html`<label class="check"><input type="radio" name="bscope" checked=${scope === k} onChange=${() => setScope(k)} /> ${l}</label>`)}</div>
    ${Store.mode === 'demo' && html`<p class="note">This device is in practice mode, so the backup contains practice orders. Switch to live orders for a real backup.</p>`}
    <div class="dlgact"><button class="btn ghost" onClick=${closeDialog}>Cancel</button><button class="btn primary" disabled=${busy} onClick=${() => run(async () => { const list = await pickFor(); if (await saveBackup(list, scope)) closeDialog(); })}>${busy ? 'Preparing…' : 'Download spreadsheet'}</button></div></${Modal}>`;
}
function DemoResetDialog() {
  const [busy, run] = useBusy(); const [prog, setProg] = useState('');
  return html`<${Modal} title="Refresh practice orders for today">
    <p>Deletes every practice order and creates a fresh fictional set around today: a ~100-item busy Saturday, early prep, frozen cakes, extras, deposits, multi-item orders and a Wednesday-prep / Thursday-7 AM example.</p>
    <p class="muted small">Live orders are never touched. This takes up to a minute.</p>
    ${prog && html`<p class="callout info">${prog}</p>`}
    <div class="dlgact"><button class="btn ghost" disabled=${busy} onClick=${closeDialog}>Cancel</button>
      <button class="btn primary" disabled=${busy} onClick=${() => run(async () => { setProg('Removing old practice orders…'); const r = await resetDemoData((d, n) => setProg(`Creating practice orders… ${d} of ${n}`)); closeDialog(); setMode('demo'); goDay(todayNY()); toast(`Practice orders refreshed: ${r.created} created for ${fmtDateMed(todayNY())}.`); })}>${busy ? 'Working…' : 'Refresh practice orders'}</button></div></${Modal}>`;
}

/* ---------- Menu & prices editor ---------- */
const OPEN_QUESTIONS = [
  '“14-inch” on the sheet is read as a 14-inch square (its place under Square Cakes). Owner hasn’t confirmed.',
  'Cupcake cakes: minimum quantity, partial dozens, mixed flavors and filling availability aren’t set, so those need a manual price.',
  'Whether ganache and theme charges apply to cupcake cakes, and which add-ons apply to single-layer cakes.',
  'Whether the 8/12-inch carrot restriction also applies to tier-style cakes, and whether tiramisu is offered in every tier-style size.',
  'Delivery price for three-tier cakes (“plus delivery”).',
  'Whether the $20 deposit for 14-inch and larger cakes is still current.',
  'What separates an “animated picture” from a “personal portrait,” and how multiple prints are charged.',
  'Business review only (not changed): red velvet/carrot packages can cost less than a classic cake with the same costly filling (e.g. half-sheet: $85 vs $100 with cannoli).'];
function PriceIn({ get, set, label, ch }) {
  return html`<input class="pin" inputmode="decimal" aria-label=${label} defaultValue=${centsToInput(get())} onChange=${e => { const v = parseMoney(e.target.value); if (v !== null && !Number.isNaN(v)) { set(v); ch(); } else e.target.value = centsToInput(get()); }} />`;
}
function ListEd({ list, catKey, cats, title, flag, ch }) {
  return html`<div class="box2 pe"><h3 class="ih">${title}</h3><ul class="pelist">${list.map((x, i) => html`<li key=${x.id} class=${x.retired ? 'retired' : ''}>
      <span class="pein"><input aria-label="Name" defaultValue=${x.label} onChange=${e => { x.label = e.target.value.trim() || x.label; ch(); }} /></span>
      ${cats && html`<select aria-label="Price category" value=${x[catKey]} onChange=${e => { x[catKey] = e.target.value; ch(); }}>${cats.map(([k, l]) => html`<option value=${k}>${l}</option>`)}</select>`}
      ${flag && html`<label class="check sm"><input type="checkbox" checked=${!!x[flag[0]]} onChange=${e => { x[flag[0]] = e.target.checked; ch(); }} />${flag[1]}</label>`}
      <button class="btn sm ghost" onClick=${() => { x.retired = !x.retired; ch(); }}>${x.retired ? 'Restore' : 'Retire'}</button></li>`)}</ul>
    <button class="btn sm" onClick=${() => { list.push({ id: uid(6), label: 'New option', ...(cats ? { [catKey]: cats[0][0] } : {}) }); ch(); }}><${Icon} n="plus" s=${16} />Add</button></div>`;
}
function MenuEditor() {
  const [m, setM] = useState(null); const [ver, setVer] = useState(0); const [busy, run] = useBusy();
  const cur = m || JSON.parse(JSON.stringify(menu()));
  const ch = () => setM({ ...cur });
  return html`<section class="sec" key=${ver}><h2>Menu & prices <span class="secn">effective ${cur.effective || 'March 2026'}${Store.menuRev ? ` · revision ${Store.menuRev}` : ' · from the owner’s price sheet'}</span></h2>
    <p class="callout info">The order form uses these prices to give staff a starting price; staff can override any price with a reason. Changing a price here never changes an order that was already agreed — if a saved order would come out different, the form asks which price to keep.</p>
    <div class="box2"><h3 class="ih">Standard cakes (three layers, two fillings)</h3><div class="tscroll"><table class="ptable"><thead><tr><th>Size</th><th>Serves</th><th>Regular filling</th><th>Extra filling</th><th>Red velvet / carrot (any filling)</th><th>Premium filling</th><th>Cannoli filling</th><th>Tiramisu / tres leches</th></tr></thead>
      <tbody>${cur.standard.map(r => html`<tr><td>${r.label}</td><td>${r.serv}</td>${r.p.map((c, k) => html`<td><${PriceIn} ch=${ch} label=${`${r.label} ${PRICE_COLS[k]}`} get=${() => r.p[k]} set=${v => { r.p[k] = v; }} /></td>`)}</tr>`)}</tbody></table></div>
      <p class="muted small">Carrot is not available in 8-inch or 12-inch (set on the Carrot flavor).</p></div>
    <div class="twocol">
      <div class="box2"><h3 class="ih">Tier-style cakes (starting prices, all fillings included)</h3><table class="ptable"><tbody>${cur.tier.map(r => html`<tr><td>${r.label}${r.delivery ? ' (plus delivery)' : ''}</td><td>${r.serv}</td><td><${PriceIn} ch=${ch} label=${r.label} get=${() => r.p} set=${v => { r.p = v; }} /></td></tr>`)}</tbody></table></div>
      <div class="box2"><h3 class="ih">Other prices</h3><table class="ptable"><tbody>
        ${cur.single.map(r => html`<tr><td>${r.label}</td><td><${PriceIn} ch=${ch} label=${r.label} get=${() => r.p} set=${v => { r.p = v; }} /></td></tr>`)}
        <tr><td>Cupcake cake, classic — per dozen</td><td><${PriceIn} ch=${ch} label="classic dozen" get=${() => cur.cupcake.classic} set=${v => { cur.cupcake.classic = v; }} /></td></tr>
        <tr><td>Cupcake cake, red velvet / carrot — per dozen</td><td><${PriceIn} ch=${ch} label="premium dozen" get=${() => cur.cupcake.premcake} set=${v => { cur.cupcake.premcake = v; }} /></td></tr>
        <tr><td>Shaped cupcake arrangement</td><td><${PriceIn} ch=${ch} label="shaped" get=${() => cur.cupcake.shaped} set=${v => { cur.cupcake.shaped = v; }} /></td></tr>
        ${[['ganache', 'Ganache icing (once per cake)'], ['animated', 'Animated picture'], ['portrait', 'Personal portrait'], ['themeStart', 'Theme decoration — starting price'], ['figureStart', 'Figures — starting price'], ['tierTresLeches', 'Tres leches in a tier-style cake (once)']].map(([k, l]) => html`<tr><td>${l}</td><td><${PriceIn} ch=${ch} label=${l} get=${() => cur.addons[k]} set=${v => { cur.addons[k] = v; }} /></td></tr>`)}
      </tbody></table></div>
    </div>
    <div class="pegrid">
      <${ListEd} ch=${ch} list=${cur.flavors} title="Cake flavors" catKey="kind" cats=${FLAVOR_KINDS} />
      <${ListEd} ch=${ch} list=${cur.fillings} title="Fillings" catKey="cat" cats=${FILLING_CATS} />
      <${ListEd} ch=${ch} list=${cur.icings} title="Icings" flag=${['ganache', 'charged as ganache']} />
    </div>
    ${!Store.canEdit && html`<p class="callout warn">Only the owner and people with edit access can change menu prices. You can see them here.</p>`}
    ${m && Store.canEdit && html`<div class="savebar"><b>Unsaved menu changes.</b><button class="btn primary" disabled=${busy} onClick=${() => run(async () => { try { await saveMenu(cur); setM(null); setVer(ver + 1); toast('Menu & prices saved. New prices apply to new quotes.'); } catch (e) { if (e.code === 'conflict') { setM(null); setVer(ver + 1); } throw e; } })}>${busy ? 'Saving…' : 'Save menu & prices'}</button><button class="btn ghost" onClick=${() => { setM(null); setVer(ver + 1); }}>Discard changes</button></div>`}
    <details class="box2"><summary><b>Rules still to confirm with the owner</b> (${OPEN_QUESTIONS.length})</summary><ul>${OPEN_QUESTIONS.map(q => html`<li>${q}</li>`)}</ul>
      <p class="muted small">Until confirmed, the order form flags these cases for a manual price instead of guessing.</p></details>
  </section>`;
}
