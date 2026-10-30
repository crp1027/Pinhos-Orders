/* ===== ui2.js — order detail (tabbed), pickup panel, payments, extras, notes, printing ===== */
/** Single taps re-check the store first, so a change made on another device a moment ago is not silently overwritten. */
async function guardedTap(o, it, kind, go) {
  const ref = [{ orderId: o.id, itemId: it.id }];
  const c = await findClashes(ref, kind, seenValues(ref, kind));
  if (c.length) { toast(`Not changed: another device just set ${c[0].label} to ${c[0].now}${c[0].by ? ` (${c[0].by})` : ''}. Check it, then tap again if needed.`, 'bad'); await refreshNow(true); return false; }
  await go(); return true;
}
async function stageOne(o, it, to) {
  await guardedTap(o, it, 'stage', async () => {
    const res = await setStage([{ orderId: o.id, itemId: it.id }], to);
    if (res.errors.length) throw res.errors[0].e;
    toast(`${itemLabel(o, it)} marked ${STAGES[to]}.`, 'ok', { label: 'Undo', fn: async () => { try { const u = await undoBatch('stage', res.applied, to); toast(u.reverted ? 'Undone.' : 'Not undone: the item changed again since.'); } catch (e) { toast(errText(e), 'bad'); } } });
  });
}
const DETAIL_TABS = [['prod', 'Production'], ['pay', 'Payment & Pickup'], ['notes', 'Notes & History']];
function OrderDetail() {
  const d = UI.detail; const o = d.archived || getOrder(d.orderId);
  const close = () => ui({ detail: null });
  useEffect(() => { const k = e => { if (e.key === 'Escape' && !UI.dialog) close(); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, []);
  if (!o) return html`<div class="sheet-scrim" onClick=${close}><aside class="sheet" onClick=${e => e.stopPropagation()}><div class="shead"><h2>Order not found</h2><button class="iconbtn" aria-label="Close" onClick=${close}><${Icon} n="x" /></button></div><p class="pad">This order is no longer in the live list. Older collected and canceled orders move to the archive; find them in Search.</p></aside></div>`;
  const ro = !!d.archived;
  const items = itemsOf(o); const it = items.find(x => x.id === d.itemId) || items[0];
  const ps = payState(o); const pe = pickupEpoch(o); const now = Date.now();
  const ready = items.filter(x => (x.stage || 0) === 4 || isCollected(x)).length; const coll = items.filter(isCollected).length;
  const hrs = pe ? Math.round((pe - now) / 36e5) : null;
  const tab = d.tab || 'prod'; const setTab = t => ui({ detail: { ...d, tab: t } });
  return html`<div class="sheet-scrim" onClick=${close}>
  <aside class="sheet" role="dialog" aria-modal="true" aria-label=${`Order ${orderLabel(o)}`} onClick=${e => e.stopPropagation()}>
    <div class="shead">
      <div class="sh-title"><h2>${orderLabel(o)} · ${o.customer?.name || '(no name)'}</h2>
        <div class="badges">${o.demo && html`<span class="tag demo">Practice order</span>`}${o.booking === 'draft' && html`<span class="tag draft">Draft</span>`}${o.booking === 'canceled' && html`<span class="tag canceled">Canceled</span>`}${ro && html`<span class="tag">Archived · read only</span>`}${orderClosed(o) && html`<span class="tag coll">Picked up</span>`}${o.pricing && !o.pricing.complete && html`<span class="tag draft">Price not final</span>`}</div></div>
      <button class="iconbtn" aria-label="Close order" onClick=${close}><${Icon} n="x" /></button>
    </div>
    <div class="sbody">
      <div class="osum">
        <div class="pickupbig"><span class="muted xs">PICKUP</span><b>${fmtDateLong(o.pickupDate)} · ${fmtTime(o.pickupTime)}</b>
          ${o.booking === 'confirmed' && !orderClosed(o) && hrs !== null && html`<span class=${'muted' + (pe < now ? ' badtxt' : '')}>${pe < now ? `pickup time passed ${now - pe < 36e5 ? Math.round((now - pe) / 6e4) + ' min ago' : Math.round((now - pe) / 36e5) + ' h ago'}` : pe - now < 36e5 ? `in ${Math.round((pe - now) / 6e4)} min` : hrs < 24 ? `in ${hrs} h` : `in ${Math.round(hrs / 24)} days`}</span>`}</div>
        <div class="kvline"><span>${fmtPhone(o.customer?.phone) || 'No phone'}</span>${o.customer?.email && html`<span>${o.customer.email}</span>`}<span class="muted">Taken by ${o.takenBy || '—'}</span></div>
        <div class="kvline"><span><b>${ready} of ${items.length}</b> ready</span><span><b>${coll} of ${items.length}</b> picked up</span><button class=${'paytag linkish ' + ps.key} onClick=${() => setTab('pay')}>${ps.label}</button></div>
      </div>
      ${o.booking === 'draft' && !ro && html`<div class="callout warn">This is a draft. It is not in production lists or counts until confirmed. <button class="btn sm" onClick=${() => editOrder(o, true)}>Review and confirm</button></div>`}
      ${o.booking === 'canceled' && html`<div class="callout">Canceled ${fmtStamp(o.canceledAt)}: ${o.cancelReason}. Payments recorded: ${fmtMoney(paidCents(o))}. No refund is recorded by canceling; record one only if it was given in the POS.</div>`}
      ${!ro && html`<div class="actbar">
        ${o.booking === 'confirmed' && !orderClosed(o) && html`<button class="btn primary" onClick=${() => setTab('pay')}>Pickup & payment</button>`}
        <button class="btn" onClick=${() => openPrint(items.map(x => ({ orderId: o.id, itemId: x.id })), `Order ${orderLabel(o)}`)}><${Icon} n="print" s=${18} />Print ${items.length > 1 ? `${items.length} slips` : 'slip'}</button>
        <button class="btn" onClick=${() => ui({ review: { orderId: o.id, reprint: true, at: Date.now() } })}><${Icon} n="print" s=${18} />Reprint</button>
        <button class="btn" onClick=${() => openPrint([{ orderId: o.id, itemId: items[0].id }], `Order ${orderLabel(o)}`, 'customer')}><${Icon} n="print" s=${18} />Customer copy</button>
        <button class="btn" onClick=${() => editOrder(o)}>Edit order</button>
        <button class="btn ghost" onClick=${() => openDialog({ type: 'repeat', order: o })}>Repeat order</button>
      </div>`}
      ${ro && html`<div class="actbar"><button class="btn" onClick=${() => openDialog({ type: 'repeat', order: o })}>Repeat order</button><button class="btn" onClick=${() => openPrint(items.map(x => ({ order: o, itemId: x.id })), `Order ${orderLabel(o)}`)}>Print slips</button></div>`}
      ${items.length > 1 && html`<div class="itabs" role="tablist" aria-label="Items">${items.map(x => html`<button role="tab" aria-selected=${x.id === it.id} class=${'itab' + (x.id === it.id ? ' on' : '')} onClick=${() => ui({ detail: { ...d, itemId: x.id } })}>
        <b>${orderLabel(o)}-${x.suffix}</b><span>${x.type || 'Item'}</span>${isCollected(x) ? html`<span class="pill coll sm">Picked up</span>` : html`<${StagePill} s=${x.stage} small />`}</button>`)}</div>`}
      <div class="dtabs" role="tablist" aria-label="Order sections">${DETAIL_TABS.map(([k, l]) => html`<button role="tab" aria-selected=${tab === k} class=${'dtab' + (tab === k ? ' on' : '')} onClick=${() => setTab(k)}>${l}</button>`)}</div>
      ${!it ? html`<p class="pad">This order has no items.</p>`
      : tab === 'prod' ? html`<${ItemPanel} key=${it.id} o=${o} it=${it} ro=${ro || o.booking === 'canceled'} />`
      : tab === 'pay' ? html`<div class="ipanel">${o.booking === 'confirmed' && !ro && html`<${PickupPanel} o=${o} />`}<${PriceBlock} o=${o} it=${it} /><${OrderMoney} o=${o} ro=${ro} /></div>`
      : html`<${NotesPanel} key=${it.id} o=${o} it=${it} ro=${ro} />`}
      ${!ro && tab === 'notes' && html`<div class="danger-zone">${o.booking === 'canceled'
        ? html`<button class="btn" onClick=${() => openDialog({ type: 'confirm', title: 'Restore this order?', body: 'It will return to Confirmed and appear in production lists again.', okLabel: 'Restore order', onOk: () => restoreOrder(o) })}>Restore order</button>`
        : html`<button class="btn danger ghost" onClick=${() => openDialog({ type: 'cancel', orderId: o.id })}>Cancel order…</button>`}</div>`}
    </div>
  </aside></div>`;
}
function editOrder(o, review) {
  UI.form = formFromOrder(o); UI.form.openReview = !!review; ui({ tab: 'form', detail: null }); window.scrollTo && window.scrollTo(0, 0);
}
function ItemPanel({ o, it, ro }) {
  const [busy, run] = useBusy();
  const [back, setBack] = useState(null);
  const [store, setStore] = useState(it.storage || '');
  useEffect(() => setStore(it.storage || ''), [it.storage]);
  const st = it.stage || 0; const coll = isCollected(it);
  const pick = s => {
    if (ro || coll) return;
    if (s === st) return;
    if (s < st) { setBack(s); return; }
    if (s === 4 && it.attention && it.attention.on) { openDialog({ type: 'readyReview', orderId: o.id, itemId: it.id }); return; }
    run(() => stageOne(o, it, s));
  };
  return html`<div class="ipanel">
    ${coll && html`<div class="callout good">Picked up ${fmtStamp(it.collectedAt)}. ${!ro && html`<button class="btn sm ghost" onClick=${() => openDialog({ type: 'confirm', title: 'Undo pickup?', body: `${itemLabel(o, it)} will be marked as not picked up.`, okLabel: 'Undo pickup', onOk: () => undoCollect(o, it) })}>Undo pickup</button>`}</div>`}
    ${reprintNeeded(o, it) && html`<div class="callout warn"><b>Changed Since Printed / Reprint Needed.</b> Printed ${fmtStamp(it.printedAt)}; important details changed after that. <button class="btn sm" onClick=${() => openPrint([{ orderId: o.id, itemId: it.id }], itemLabel(o, it))}>Reprint slip</button></div>`}
    ${isOverdue(o, it) && html`<div class="callout bad">Pickup time has passed and this item is not marked Ready.</div>`}
    <h3 class="ih">Production stage</h3>
    <div class="stages" role="group" aria-label="Production stage">${STAGES.map((name, s) => {
      const t = it.stageTimes && it.stageTimes[s];
      return html`<button class=${'stbtn st' + s + (s === st ? ' on' : '') + (s < st ? ' past' : '')} aria-pressed=${s === st} disabled=${ro || coll || busy} onClick=${() => pick(s)}>
      <span class="stn">${name}</span><span class="stt">${s === 0 ? '' : t && s <= st ? `marked ${fmtStamp(t)}` : s <= st ? 'done' : ''}</span></button>`;
    })}</div>
    ${back !== null && html`<div class="callout warn">Move ${itemLabel(o, it)} back from ${STAGES[st]} to ${STAGES[back]}? <button class="btn sm" disabled=${busy} onClick=${() => run(async () => { await stageOne(o, it, back); setBack(null); })}>Move back</button><button class="btn sm ghost" onClick=${() => setBack(null)}>Keep ${STAGE_SHORT[st]}</button></div>`}
    <p class="muted small">Tap the stage the cake is in. Skipped stages count as done.</p>
    <div class="twocol">
      <div class="box2"><h3 class="ih"><${Icon} n="snow" s=${18} /> Frozen & storage</h3>
        <div class="frow"><button class=${'btn' + (it.frozen ? ' ice on' : '')} disabled=${ro || busy} onClick=${() => run(() => guardedTap(o, it, 'frozen', async () => { const r = await setFrozen([{ orderId: o.id, itemId: it.id }], !it.frozen); if (r.errors.length) throw r.errors[0].e; toast(it.frozen ? 'Marked unfrozen.' : 'Marked frozen.'); }))}>${it.frozen ? 'Frozen — tap to mark Unfrozen' : 'Mark Frozen'}</button></div>
        <label class="fld"><span>Storage location</span><div class="inline"><input value=${store} disabled=${ro} onInput=${e => setStore(e.target.value)} placeholder="e.g. Freezer 2, top shelf" />
          <button class="btn" disabled=${ro || busy || store.trim() === (it.storage || '')} onClick=${() => run(() => guardedTap(o, it, 'storage', async () => { const r = await setStorage([{ orderId: o.id, itemId: it.id }], store.trim()); if (r.errors.length) throw r.errors[0].e; toast('Storage location saved.'); }))}>Save</button></div></label>
      </div>
      <div class="box2"><h3 class="ih">Advance work</h3>
        ${it.plan ? html`<p><b>${STAGES[it.plan.milestone]}</b> on <b>${fmtDateLong(it.plan.date)}</b><br/><span class=${planMet(it) ? 'goodtxt' : it.plan.date < todayNY() ? 'badtxt' : 'muted'}>${planMet(it) ? 'Done — progress has reached this milestone.' : it.plan.date < todayNY() ? 'Not done yet — carried over.' : 'Planned. A plan is not proof the work was done.'}</span></p>`
      : html`<p class="muted">None. Work happens on pickup day (the default).</p>`}
        ${!ro && !coll && html`<button class="btn" onClick=${() => openDialog({ type: 'itemPlan', orderId: o.id, itemId: it.id })}>${it.plan ? 'Change plan…' : 'Plan early work…'}</button>`}
        ${mapList(it.planLog).length > 0 && html`<details class="mini"><summary>Plan history (${mapList(it.planLog).length})</summary><ul>${mapList(it.planLog).map(p => html`<li>${fmtStamp(p.at)} — ${p.action === 'cleared' ? 'plan removed' : p.action === 'undo' ? 'undo' : `${STAGE_SHORT[p.milestone]} on ${fmtDateMed(p.date)}`}${p.prev ? ` (was ${STAGE_SHORT[p.prev.milestone]} ${fmtDateMed(p.prev.date)})` : ''}</li>`)}</ul></details>`}
      </div>
    </div>
    <${SpecBlock} o=${o} it=${it} />
    <${ExtrasBlock} o=${o} it=${it} ro=${ro} />
    ${it.attention && it.attention.on && html`<div class="callout bad"><b>Needs Attention:</b> ${it.attention.reason} <button class="btn sm ghost" onClick=${() => ui({ detail: { ...UI.detail, tab: 'notes' } })}>Open notes</button></div>`}
  </div>`;
}
function NotesPanel({ o, it, ro }) {
  const notes = mapList(it.notes);
  const cust = notes.filter(n => n.kind === 'cust');
  return html`<div class="ipanel">
    <${AttentionCtl} o=${o} it=${it} ro=${ro} />
    <div class="box2"><h3 class="ih"><${Icon} n="note" s=${18} /> Customer Requests</h3>
      <p class="muted small">What the customer asked for. Each addition is dated; earlier wording is never overwritten.</p>
      ${(it.requests || cust.length) ? html`<ul class="notes">${it.requests && html`<li><span class="muted xs">Original order</span><div>${it.requests}</div></li>`}${cust.map(n => html`<li><span class="muted xs">${fmtStamp(n.at)} · ${n.by || n.dev}</span><div>${n.text}</div></li>`)}</ul>` : html`<p class="muted small">None yet.</p>`}
      ${!ro && html`<${NoteAdd} o=${o} it=${it} kind="cust" />`}</div>
    <div class="box2"><h3 class="ih">Staff notes</h3>
      <p class="muted small">Visible to all staff. Never printed on anything given to the customer.</p>
      ${['prod', 'mgr'].map(kind => html`<div class="notecol"><h4>${kind === 'prod' ? 'Production Notes' : 'Manager Notes'}</h4>
        ${notes.filter(n => n.kind === kind).length ? html`<ul class="notes">${notes.filter(n => n.kind === kind).map(n => html`<li><span class="muted xs">${fmtStamp(n.at)} · ${n.dev}</span><div>${n.text}</div></li>`)}</ul>` : html`<p class="muted small">None yet.</p>`}
        ${!ro && html`<${NoteAdd} o=${o} it=${it} kind=${kind} />`}</div>`)}</div>
    <${HistoryBlock} o=${o} open />
  </div>`;
}
function AttentionCtl({ o, it, ro }) {
  const [busy, run] = useBusy(); const [reason, setReason] = useState('');
  const on = it.attention && it.attention.on;
  if (on) return html`<div class="callout bad"><b>Needs Attention:</b> ${it.attention.reason} ${!ro && html`<button class="btn sm" disabled=${busy} onClick=${() => run(() => setAttention(o, it, false))}>Clear flag</button>`}</div>`;
  if (ro) return null;
  return html`<div class="inline attn"><label class="vh" for=${'attn' + it.id}>Reason for Needs Attention</label><input id=${'attn' + it.id} value=${reason} onInput=${e => setReason(e.target.value)} placeholder="Needs Attention reason, e.g. call customer about color" />
    <button class="btn" disabled=${busy || !reason.trim()} onClick=${() => run(async () => { await setAttention(o, it, true, reason.trim()); setReason(''); })}><${Icon} n="flag" s=${16} />Flag</button></div>`;
}
function NoteAdd({ o, it, kind }) {
  const [busy, run] = useBusy(); const [t, setT] = useState('');
  const ph = { cust: 'Add what the customer asked for (dated automatically)', mgr: 'Add a manager note', prod: 'Add a production note' }[kind];
  return html`<div class="noteadd"><label class="vh" for=${'n' + kind + it.id}>${ph}</label>
    <textarea id=${'n' + kind + it.id} rows="2" value=${t} onInput=${e => setT(e.target.value)} placeholder=${ph}></textarea>
    <button class="btn sm" disabled=${busy || !t.trim()} onClick=${() => run(async () => { await addNote(o, it, kind, t.trim()); setT(''); toast(kind === 'cust' ? 'Customer request added.' : 'Note added.'); })}>${busy ? 'Saving…' : kind === 'cust' ? 'Add request' : 'Add note'}</button></div>`;
}
function SpecBlock({ o, it }) {
  const imgs = mapList(it.images); const tk = typeKeyOf(it); const gs = groupsOf(it);
  const R = (k, v) => v ? html`<div class="kv"><span class="k">${k}</span><span class="v">${v}</span></div>` : null;
  const A = it.addons || {};
  const adds = [A.animated && 'Animated picture', A.portrait && 'Personal portrait', A.shaped && 'Shaped arrangement', A.themeOn && 'Theme decoration', A.figuresOn && 'Figures'].filter(Boolean).join(' · ');
  return html`<div class="box2 spec"><h3 class="ih">Cake specification — ${itemLabel(o, it)}</h3>
    <div class="kvgrid">
      ${R('Product', it.type)}${R('Size', it.size)}${R('Quantity', it.qty)}
      ${tk !== 'tier' && !gs.length && R('Flavor', flavorLong(it))}
      ${tk !== 'tier' && !gs.length && R('Filling', fillingLong(it))}${!gs.length && R('Icing', it.icing)}${R('Decoration add-ons', adds)}
      ${(A.animated || A.portrait) && R('Picture contact phone', it.picturePhone ? fmtPhone(it.picturePhone) : 'not entered')}
    </div>
    ${it.shapeDesc && html`<div class="callout info"><b>Shape / arrangement:</b> ${it.shapeDesc}</div>`}
    ${tk === 'tier' && (it.tiers || []).length > 0 && html`<table class="tiers"><thead><tr><th>Tier</th><th>Size</th><th>Flavor</th><th>Filling</th></tr></thead><tbody>${it.tiers.map((t, k) => html`<tr><td>${k + 1}${k === 0 && it.tiers.length > 1 ? ' (bottom)' : ''}</td><td>${t.size}</td><td>${flavorLong(t)}</td><td>${fillingLong(t)}</td></tr>`)}</tbody></table>`}
    ${gs.length > 0 && html`<table class="tiers"><thead><tr><th>Count</th><th>Flavor</th><th>Filling</th><th>Icing</th></tr></thead><tbody>${gs.map(g => html`<tr><td>${g.qty}</td><td>${g.flavor}</td><td>${g.filling || '—'}</td><td>${g.icing || '—'}</td></tr>`)}</tbody></table>`}
    <div class="inscbox">${it.noInscription ? html`<b>NO INSCRIPTION</b>` : html`<span class="muted xs">INSCRIPTION — EXACTLY AS WRITTEN${it.inscriptionColor ? html` · <b>WRITING COLOR: ${it.inscriptionColor.toUpperCase()}</b>` : ''}</span><div class="insctext">${it.inscription ? `“${it.inscription}”` : html`<i>Not entered</i>`}</div>`}</div>
    <div class="kvgrid">${R('Colors', it.colors)}${R('Decoration / theme', it.decoration)}</div>
    ${imgs.length > 0 && html`<div class="imgs">${imgs.map((im, k) => html`<button class="imgcard" onClick=${() => openDialog({ type: 'image', im, label: `${itemLabel(o, it)} · image ${k + 1}` })}>
      <img src=${blobUrl(im.thumb || im.asset)} alt=${`Design image ${k + 1}`} loading="lazy" /><span class=${'purp ' + (im.purpose || 'none')}>${IMG_PURPOSE[im.purpose] || 'Purpose not set'}</span></button>`)}</div>`}
  </div>`;
}
function PriceLines({ lines, issues, total, title, source, agreed }) {
  return html`<div class="pricebox">
    ${title && html`<div class="pbh">${title}</div>`}
    ${lines.length ? html`<table class="plines"><tbody>${lines.map(l => html`<tr><td>${l.label}</td><td>${fmtMoney(l.cents)}</td></tr>`)}</tbody></table>` : ''}
    <div class="ptotal"><span>${source === 'override' ? 'Price (override)' : source === 'agreed' ? 'Agreed price (kept)' : 'Starting price'}</span><b>${fmtMoney(total)}</b></div>
    ${(issues || []).filter(x => x.level !== 'info').map(x => html`<p class=${x.level === 'block' ? 'badtxt small' : 'warnli small'}>${x.level === 'quote' ? 'Needs a price: ' : ''}${x.text}</p>`)}
    ${(issues || []).filter(x => x.level === 'info').map(x => html`<p class="note small">${x.text}</p>`)}
  </div>`;
}
function PriceBlock({ o, it }) {
  const p = it.price;
  return html`<div class="box2"><h3 class="ih">Price — ${itemLabel(o, it)}</h3>
    ${p ? html`<${PriceLines} lines=${p.lines || []} issues=${p.issues} total=${it.priceCents ?? null} source=${p.override ? 'override' : p.keptAgreed ? 'agreed' : 'calc'} />
      ${p.override && html`<p class="muted small">Overridden from ${fmtMoney(p.calcCents)} by staff: “${p.override.reason}”.</p>`}`
    : html`<p>Item price: <b>${fmtMoney(it.priceCents ?? null)}</b></p>`}
  </div>`;
}

/* ---------- pickup (used on the order screen and the front counter) ---------- */
function PickupPanel({ o, onDone }) {
  const items = itemsOf(o); const open = items.filter(it => !isCollected(it));
  const [sel, setSel] = useState(() => new Set(open.filter(it => (it.stage || 0) === 4).map(it => it.id)));
  const [confirm, setConfirm] = useState(false); const [reason, setReason] = useState('');
  const [busy, run] = useBusy(); const [pid, setPid] = useState(uid());
  const bal = balanceCents(o);
  const chosen = [...sel].filter(id => o.items[id] && !o.items[id].collectedAt);
  const notReady = chosen.filter(id => (o.items[id].stage || 0) < 4);
  const needs = (bal !== null && bal > 0) || notReady.length > 0;
  const pay = m => run(async () => { await addPayment(o, { id: pid, kind: 'payment', amountCents: bal, date: todayNY(), method: m, ref: '' }); setPid(uid()); toast(`${fmtMoney(bal)} ${m} recorded. Balance is now $0.00.`); });
  const doHand = async (paidNow) => {
    const ref = chosen.map(id => ({ orderId: o.id, itemId: id }));
    const c = await findClashes(ref, 'collect', seenValues(ref, 'collect'));
    if (c.length) { toast(`Another device already marked ${c.map(x => x.label).join(', ')} picked up.`, 'bad'); return false; }
    const owe = paidNow ? 0 : (bal > 0 ? bal : 0);
    await collectItems(o, chosen, owe > 0 || notReady.length ? { balance: owe, reason: reason.trim() || 'Handed over with override', notReady: notReady.length > 0, override: true } : null);
    setConfirm(false); setReason(''); return true;
  };
  const handOver = () => run(async () => { if (await doHand(false)) { toast(`${chosen.length} ${chosen.length === 1 ? 'item' : 'items'} picked up.${chosen.length === open.length ? ' Order complete.' : ''}`); onDone && onDone(); } });
  const payAndHand = m => run(async () => {
    await addPayment(o, { id: pid, kind: 'payment', amountCents: bal, date: todayNY(), method: m, ref: '' }); setPid(uid());
    if (await doHand(true)) { toast(`${fmtMoney(bal)} ${m} recorded and ${chosen.length} ${chosen.length === 1 ? 'item' : 'items'} picked up.`); onDone && onDone(); }
  });
  if (!open.length) return html`<div class="callout good pickdone"><b>Everything on this order has been picked up.</b> ${items.map(it => html`<span class="muted small">${itemLabel(o, it)} ${fmtStamp(it.collectedAt)}</span>`)}</div>`;
  return html`<div class="box2 pickup">
    <h3 class="ih">Pickup — hand to customer</h3>
    <div class="pickgrid">${items.map(it => {
      const c = isCollected(it); const rd = (it.stage || 0) === 4;
      return html`<label class=${'pickit' + (c ? ' done' : '') + (rd && !c ? ' rdy' : '')}>
        <input type="checkbox" disabled=${c} checked=${c || sel.has(it.id)} onChange=${e => { const n = new Set(sel); e.target.checked ? n.add(it.id) : n.delete(it.id); setSel(n); setConfirm(false); }} />
        <span class="pi-main"><span class=${'bigstat ' + (c ? 'coll' : rd ? 'rdy' : 'wip')}>${c ? html`<${Icon} n="check" s=${22} />PICKED UP` : rd ? html`<${Icon} n="check" s=${22} />READY` : html`<${Icon} n="clock" s=${22} />IN PROGRESS · ${STAGE_SHORT[it.stage || 0]}`}</span>
          <span><b>${itemLabel(o, it)}</b> ${specBrief(it)}</span>
          <span class="pi-meta">${c ? html`<span class="muted small">Picked up ${fmtTime(nyTimeOf(it.collectedAt))}</span>` : ''}
            ${it.frozen && html`<span class="flag ice"><${Icon} n="snow" s=${14} />Frozen</span>`}
            <span class="where">${it.storage ? html`<b>Stored:</b> ${it.storage}` : 'No storage location recorded'}</span>
            ${hasExtras(it) && html`<span class="flag warn2"><${Icon} n="box" s=${14} />Extras: ${extrasOf(it).filter(x => (x.desc || '').trim()).map(x => x.desc).join(', ')}</span>`}</span></span></label>`;
    })}</div>
    <div class="paybig">
      <div><span class="muted xs">${items.length > 1 ? 'BALANCE — WHOLE ORDER' : 'BALANCE'}</span><b class=${'paytag ' + payState(o).key}>${fmtMoney(bal)}</b><span class="muted small">Total ${fmtMoney(o.totalCents ?? null)} · paid ${fmtMoney(paidCents(o))}</span></div>
      ${bal !== null && bal > 0 && html`<div class="paybtns"><span class="muted small">Took it on the POS? Record it:</span>
        <button class="btn foh" disabled=${busy} onClick=${() => pay('card')}>Paid ${fmtMoney(bal)} · Card</button>
        <button class="btn foh" disabled=${busy} onClick=${() => pay('cash')}>Cash</button>
        <button class="btn" disabled=${busy} onClick=${() => pay('other')}>Other</button>
        <button class="btn ghost" onClick=${() => openDialog({ type: 'payment', orderId: o.id })}>Different amount…</button></div>`}
      ${bal === null && html`<p class="muted small">No total entered. <button class="link" onClick=${() => editOrder(o)}>Add a total</button></p>`}
    </div>
    ${confirm ? html`<div class="callout warn"><b>Hand over anyway?</b>
        <ul>${bal > 0 && html`<li>${fmtMoney(bal)} is still owed and not recorded as paid.</li>`}${notReady.length > 0 && html`<li>${notReady.length} ${notReady.length === 1 ? 'item is' : 'items are'} not marked Ready.</li>`}</ul>
        <input aria-label="Reason (optional)" value=${reason} onInput=${e => setReason(e.target.value)} placeholder="Reason (optional), e.g. owner approved" />
        <div class="dlgact"><button class="btn ghost" onClick=${() => setConfirm(false)}>Go back</button><button class="btn primary" disabled=${busy} onClick=${handOver}>Yes, hand over ${chosen.length}</button></div></div>`
      : html`<div class="dlgact">
          ${bal > 0 && chosen.length > 0 && notReady.length === 0 && html`<button class="btn foh big" disabled=${busy} onClick=${() => payAndHand('card')}>Paid by card & hand over</button><button class="btn foh big" disabled=${busy} onClick=${() => payAndHand('cash')}>Paid cash & hand over</button>`}
          <button class="btn primary big" disabled=${busy || !chosen.length} onClick=${() => needs ? setConfirm(true) : handOver()}>${busy ? 'Saving…' : `Hand over ${chosen.length} ${chosen.length === 1 ? 'item' : 'items'}${bal > 0 ? ' (unpaid)' : ''}`}</button></div>`}
  </div>`;
}
function CollectDialog({ orderId }) {
  const o = getOrder(orderId); if (!o) return null;
  return html`<${Modal} title=${`Pickup — ${orderLabel(o)} ${o.customer?.name || ''}`} wide><${PickupPanel} o=${o} onDone=${closeDialog} /></${Modal}>`;
}

function ImageViewer({ im, label }) {
  return html`<${Modal} title=${label} wide><p class=${'purp big ' + (im.purpose || 'none')}>${IMG_PURPOSE[im.purpose] || 'Purpose not set'}</p>
    <img class="fullimg" src=${blobUrl(im.asset)} alt=${label} />${im.note && html`<p class="muted small">${im.note}</p>`}<p class="muted small">${im.name}</p></${Modal}>`;
}
function ExtrasBlock({ o, it, ro }) {
  const ex = extrasOf(it).filter(x => (x.desc || '').trim());
  return html`<div class="box2"><h3 class="ih"><${Icon} n="box" s=${18} /> Extras</h3>
    ${ex.length === 0 ? html`<p class="muted">No extras (toppers, flowers, supplies) for this item.</p>`
      : html`<table class="plines"><tbody>${ex.map(x => html`<tr><td>${x.desc}</td><td>${x.cents !== null && x.cents !== undefined ? fmtMoney(x.cents) : ''}</td></tr>`)}</tbody></table>`}
    <p class="muted small">Extras are due with the pickup. ${!ro && html`<button class="link" onClick=${() => editOrder(o)}>Add or change extras in the order</button>`} · The full list is in Schedule → Extras.</p>
  </div>`;
}
function ReadyReview({ orderId, itemId }) {
  const o = getOrder(orderId); const it = o && { ...o.items[itemId], id: itemId }; const [busy, run] = useBusy();
  if (!o) return null;
  return html`<${Modal} title=${`Ready for Pickup review — ${itemLabel(o, it)}`}>
    ${it.attention && it.attention.on && html`<div class="callout bad"><b>Needs Attention:</b> ${it.attention.reason}</div>`}
    <p>Ready for Pickup means the final check and packaging are complete.</p>
    <div class="dlgact"><button class="btn ghost" onClick=${closeDialog}>Not yet</button>
      <button class="btn primary st4" disabled=${busy} onClick=${() => run(async () => { await stageOne(o, it, 4); closeDialog(); })}>Mark Ready for Pickup anyway</button></div></${Modal}>`;
}
function ItemPlanDialog({ orderId, itemId }) {
  return html`<${BatchDialog} action=${{ kind: 'plan' }} refs=${[{ orderId, itemId }]} />`;
}

/* ---------- money ---------- */
function OrderMoney({ o, ro }) {
  const pays = mapList(o.payments).sort((a, b) => a.at - b.at);
  const multi = itemsOf(o).length > 1; const ps = payState(o);
  return html`<div class="box2 money"><h3 class="ih">${multi ? 'Order-Level Amounts — shared across all items' : 'Order amounts'}</h3>
    <div class="moneyrow"><div><span class="muted xs">AGREED TOTAL</span><b>${fmtMoney(o.totalCents ?? null)}</b></div><div><span class="muted xs">PAID</span><b>${fmtMoney(paidCents(o))}</b></div><div><span class="muted xs">BALANCE</span><b class=${'paytag ' + ps.key}>${fmtMoney(balanceCents(o))}</b></div></div>
    <p class="muted small">Payments are taken on the bakery POS and recorded here by hand. This site does not charge cards and is not connected to the POS.</p>
    ${pays.length ? html`<table class="pays"><thead><tr><th>Date</th><th>Amount</th><th>Method</th><th>POS ref</th><th></th></tr></thead><tbody>${pays.map(p => html`<tr class=${p.voided ? 'voided' : ''}>
      <td>${fmtDateMed(p.date)}${p.deposit ? ' · deposit' : ''}</td><td>${p.kind === 'refund' ? '−' : ''}${fmtMoney(p.amountCents)}${p.kind === 'refund' ? ' refund' : ''}</td><td>${p.method}</td><td>${p.ref || '—'}</td>
      <td>${p.voided ? html`<span class="muted small">Entered in error: ${p.voidReason}</span>` : !ro && html`<button class="btn sm ghost" onClick=${() => openDialog({ type: 'voidPay', orderId: o.id, payId: p.id })}>Correct…</button>`}</td></tr>`)}</tbody></table>`
      : html`<p class="muted">No payments recorded.</p>`}
    ${mapList(o.collectionNotes).map(c => html`<p class="callout">${fmtStamp(c.at)}: ${c.balance ? `Customer left with ${fmtMoney(c.balance)} balance — ${c.reason}` : ''}${c.notReady ? ' Handed over before marked Ready.' : ''}</p>`)}
  </div>`;
}
function PaymentDialog({ orderId }) {
  const o = getOrder(orderId);
  const [id] = useState(uid());
  const bal = o ? balanceCents(o) : null;
  const [v, setV] = useState({ kind: 'payment', amount: bal && bal > 0 ? centsToInput(bal) : '', method: 'card', date: todayNY(), ref: '' });
  const [busy, run] = useBusy();
  if (!o) return null;
  const amt = parseMoney(v.amount); const valid = amt !== null && !Number.isNaN(amt) && amt > 0;
  const after = valid && bal !== null ? bal - (v.kind === 'refund' ? -amt : amt) : null;
  return html`<${Modal} title=${`Record payment — ${orderLabel(o)} ${o.customer?.name || ''}`}>
    <div class="moneyrow"><div><span class="muted xs">TOTAL</span><b>${fmtMoney(o.totalCents ?? null)}</b></div><div><span class="muted xs">PAID</span><b>${fmtMoney(paidCents(o))}</b></div><div><span class="muted xs">BALANCE NOW</span><b>${fmtMoney(bal)}</b></div></div>
    <p class="muted small">Take the payment on the POS first, then record it here.</p>
    <div class="seg">${[['payment', 'Payment'], ['refund', 'Refund given']].map(([k, l]) => html`<button class=${'segb' + (v.kind === k ? ' on' : '')} aria-pressed=${v.kind === k} onClick=${() => setV({ ...v, kind: k })}>${l}</button>`)}</div>
    <div class="frow">
      <label class="fld"><span>Amount</span><input inputmode="decimal" value=${v.amount} onInput=${e => setV({ ...v, amount: e.target.value })} placeholder="0.00" /></label>
      <label class="fld"><span>Date</span><input type="date" value=${v.date} onInput=${e => setV({ ...v, date: e.target.value })} /></label>
    </div>
    <div class="fld"><span>Method</span><div class="seg">${['cash', 'card', 'other'].map(m => html`<button class=${'segb' + (v.method === m ? ' on' : '')} aria-pressed=${v.method === m} onClick=${() => setV({ ...v, method: m })}>${m[0].toUpperCase() + m.slice(1)}</button>`)}</div></div>
    <label class="fld"><span>POS reference (optional)</span><input value=${v.ref} onInput=${e => setV({ ...v, ref: e.target.value })} /></label>
    ${v.amount && !valid && html`<p class="badtxt">Enter an amount greater than zero, like 45 or 45.50.</p>`}
    ${after !== null && html`<p>Balance after this entry: <b>${fmtMoney(after)}</b>${after < 0 ? ' (credit / overpayment)' : ''}</p>`}
    <div class="dlgact"><button class="btn ghost" onClick=${closeDialog}>Cancel</button>
      <button class="btn primary" disabled=${busy || !valid || !v.date} onClick=${() => run(async () => { await addPayment(o, { id, kind: v.kind, amountCents: amt, date: v.date, method: v.method, ref: v.ref.trim() }); closeDialog(); toast(`${v.kind === 'refund' ? 'Refund' : 'Payment'} of ${fmtMoney(amt)} recorded.`); })}>${busy ? 'Saving…' : `Record ${valid ? fmtMoney(amt) : ''} ${v.kind === 'refund' ? 'refund' : 'payment'}`}</button></div></${Modal}>`;
}
function VoidDialog({ orderId, payId }) {
  const o = getOrder(orderId); const p = o && o.payments && { ...o.payments[payId], id: payId };
  const [reason, setReason] = useState(''); const [busy, run] = useBusy();
  if (!p) return null;
  return html`<${Modal} title="Correct a payment entry">
    <p>Mark the ${fmtMoney(p.amountCents)} ${p.method} entry from ${fmtDateMed(p.date)} as entered in error. It stays in the history but no longer counts. Then record the correct amount as a new payment.</p>
    <label class="fld"><span>What was wrong?</span><input value=${reason} onInput=${e => setReason(e.target.value)} placeholder="e.g. typed 54 instead of 45" /></label>
    <div class="dlgact"><button class="btn ghost" onClick=${closeDialog}>Cancel</button>
      <button class="btn danger" disabled=${busy || !reason.trim()} onClick=${() => run(async () => { await voidPayment(o, p, reason.trim()); openDialog({ type: 'payment', orderId }); toast('Entry marked as an error. Record the correct payment now.'); })}>Mark as error</button></div></${Modal}>`;
}
function CancelDialog({ orderId }) {
  const o = getOrder(orderId); const [reason, setReason] = useState(''); const [busy, run] = useBusy();
  if (!o) return null;
  return html`<${Modal} title=${`Cancel order ${orderLabel(o)}?`}>
    <p>The order stays searchable and keeps its payment history (${fmtMoney(paidCents(o))} recorded). Canceling does not record a refund. If money was returned on the POS, record a refund separately.</p>
    <label class="fld"><span>Reason</span><input value=${reason} onInput=${e => setReason(e.target.value)} placeholder="e.g. customer called to cancel" /></label>
    <div class="dlgact"><button class="btn ghost" onClick=${closeDialog}>Keep order</button><button class="btn danger" disabled=${busy || !reason.trim()} onClick=${() => run(async () => { await cancelOrder(o, reason.trim()); closeDialog(); toast('Order canceled. Records and payments kept.'); })}>Cancel order</button></div></${Modal}>`;
}
function HistoryBlock({ o, open }) {
  const h = mapList(o.history).sort((a, b) => b.at - a.at);
  return html`<details class="box2 hist" open=${!!open}><summary><b>Change history</b> (${h.length})</summary>
    <p class="muted small">The bakery uses one shared sign-in, so entries show the device name set on that device, not the employee.</p>
    <ul>${h.map(e => html`<li><span class="muted xs">${fmtStamp(e.at)} · ${e.dev}</span> ${e.text}</li>`)}</ul></details>`;
}
function RepeatDialog({ order }) {
  const hasImg = itemsOf(order).some(it => mapList(it.images).length);
  const [img, setImg] = useState(true);
  return html`<${Modal} title=${`Repeat order ${orderLabel(order)}`}>
    <p>Starts a new order with a new number, copying the customer and the cake specification. Pickup date, progress, payments, work plans, extras status and collection start fresh. Production and manager notes are not copied.</p>
    ${hasImg && html`<label class="check"><input type="checkbox" checked=${img} onChange=${e => setImg(e.target.checked)} /> Copy the design images too</label>`}
    <div class="dlgact"><button class="btn ghost" onClick=${closeDialog}>Cancel</button><button class="btn primary" onClick=${() => { UI.form = formFromRepeat(order, img); ui({ tab: 'form', detail: null, dialog: null }); }}>Start repeat order</button></div></${Modal}>`;
}

/* ---------- printing UI ---------- */
const PRINT_KIND = { slips: 'Work slips', customer: 'Customer copies', both: 'Bakery slips + customer copy', manifest: 'Daily checklist', extras: 'Extras list' };
function openPrint(refs, title, kind = 'slips', more = {}) { ui({ print: { refs, title, kind, ...more }, dialog: null }); }
function PrintPickDialog({ day }) {
  const { pick, prep } = dayModel(day);
  const pk = pick.flatMap(g => g.items.filter(it => !isCollected(it)).map(it => ({ orderId: g.o.id, itemId: it.id })));
  const pr = prep.flatMap(g => g.items.filter(it => !planMet(it)).map(it => ({ orderId: g.o.id, itemId: it.id })));
  const sel = selectedRefs();
  const unprinted = pk.filter(r => { const o = getOrder(r.orderId); const it = o.items[r.itemId]; return !it.printedHash || reprintNeeded(o, { ...it, id: r.itemId }); });
  const nItems = pick.reduce((a, g) => a + g.items.length, 0);
  return html`<${Modal} title="Print">
    <div class="menu">
      <p class="menuh">Work slips (four per page)</p>
      <button class="btn big" disabled=${!pk.length} onClick=${() => openPrint(pk, `Pickups ${fmtDateMed(day)}`)}>Pickups for ${fmtDateMed(day)} — ${pk.length} items</button>
      <button class="btn big" disabled=${!unprinted.length} onClick=${() => openPrint(unprinted, `New & changed slips ${fmtDateMed(day)}`)}>Only new or changed since printed — ${unprinted.length}</button>
      <button class="btn big" disabled=${!pr.length} onClick=${() => openPrint(pr, `Work pile ${fmtDateMed(day)}`)}>Advance work pile for ${fmtDateMed(day)} — ${pr.length} items</button>
      <button class="btn big" disabled=${!sel.length} onClick=${() => openPrint(sel, `${sel.length} selected items`)}>Selected items — ${sel.length}</button>
      <p class="menuh">For the manager and the customer</p>
      <button class="btn big" disabled=${!nItems} onClick=${() => openPrint([], `Checklist ${fmtDateMed(day)}`, 'manifest', { day })}>Daily checklist for ${fmtDateMed(day)} — ${nItems} items on one list</button>
      <button class="btn big" disabled=${!pk.length} onClick=${() => openPrint(pk, `Customer copies ${fmtDateMed(day)}`, 'customer')}>Customer copies for ${fmtDateMed(day)} — ${pick.length} orders</button>
      ${sel.length > 0 && html`<button class="btn big" onClick=${() => openPrint(sel, `${sel.length} selected`, 'customer')}>Customer copies — selected orders</button>`}
    </div><p class="muted small">Collected items and finished advance work are left out of work slips. The checklist lists every pickup that day.</p></${Modal}>`;
}
function PrintView() {
  const P = UI.print; const kind = P.kind || 'slips';
  const canRc = kind === 'slips' || kind === 'customer' || kind === 'both';
  const fmt = canRc ? (P.fmt || (hasPrinter() ? 'receipt' : 'letter')) : 'letter';
  if (fmt === 'receipt') return html`<${ReceiptView} P=${P} kind=${kind} />`;
  const entries = (P.refs || []).map(r => { const o = r.order || getOrder(r.orderId); const raw = o && o.items[r.itemId]; return raw ? { o, it: { ...raw, id: r.itemId } } : null; }).filter(Boolean);
  const sig = kind + (P.day || '') + (P.from || '') + (P.to || '') + '|' + (kind === 'manifest' || kind === 'extras' ? Store.lastSync : entries.map(e => e.o.id + e.it.id + slipHash(e.o, e.it) + (e.it.stage || 0) + paidCents(e.o) + (e.it.storage || '') + !!e.it.frozen).join('|'));
  const lay = useMemo(() => layoutPrint(P, entries), [sig]);
  const [busy, setBusy] = useState(false); const [prog, setProg] = useState(''); const [saved, setSaved] = useState(false); const [err, setErr] = useState('');
  const wrap = useRef(); const [w, setW] = useState(816);
  useEffect(() => { const f = () => wrap.current && setW(wrap.current.clientWidth); f(); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f); }, []);
  const sc = Math.min(1, (w - 8) / PAGE_W);
  const close = () => ui({ print: null });
  const save = async () => {
    if (busy) return; setErr('');
    if (!Store.downloads) { setErr('Saving files is not available in this view, so a PDF cannot be produced here. Try the Claude app or a desktop browser.'); return; }
    setBusy(true);
    try {
      const blob = await makePdf(lay.pages, (i, n) => setProg(`Preparing page ${i} of ${n}…`));
      setProg('Waiting for you to confirm the save…');
      await Store.downloads.save({ filename: `pinhos-${kind}-${(P.title || 'print').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.pdf`, data: blob });
      setSaved(true); setProg('');
    } catch (e) { setProg(''); setErr(e && e.code === 'declined' ? 'The save was canceled. Nothing was printed.' : errText(e)); }
    finally { setBusy(false); }
  };
  const [mbusy, mrun] = useBusy();
  const what = kind === 'slips' ? `${lay.count} ${lay.count === 1 ? 'slip' : 'slips'}${lay.extra > 0 ? ` + ${lay.extra} continuation` : ''} · four per page`
    : kind === 'both' ? `${lay.count} bakery ${lay.count === 1 ? 'slip' : 'slips'} + customer copy · four per page` : kind === 'customer' ? `${lay.count} customer ${lay.count === 1 ? 'copy' : 'copies'}${lay.extra > 0 ? ` + ${lay.extra} continuation` : ''} · four per page` : 'full-page list';
  return html`<div class="printview" role="dialog" aria-modal="true" aria-label="Print preview">
    <div class="pvhead">
      <div><h2>${PRINT_KIND[kind]} — ${P.title}</h2><p class="muted small">${what} · ${lay.pages.length} ${lay.pages.length === 1 ? 'page' : 'pages'} · US Letter, portrait</p></div>
      <div class="pvact">
        ${canRc && html`<${FmtSwitch} P=${P} fmt=${fmt} />`}
        ${kind === 'extras' && html`<div class="seg" role="group" aria-label="Range">${[[7, 'Next 7 days'], [14, '14 days'], [30, '30 days']].map(([n, l]) => html`<button class=${'segb' + (P.to === addDays(P.from, n) ? ' on' : '')} onClick=${() => ui({ print: { ...P, to: addDays(P.from, n) } })}>${l}</button>`)}</div>`}
        <button class="btn primary" disabled=${busy || !lay.pages.length} onClick=${save}><${Icon} n="print" s=${18} />${busy ? 'Working…' : 'Save PDF to print'}</button>
        ${(kind === 'slips' || kind === 'both') && html`<button class=${'btn' + (saved ? ' primary' : '')} disabled=${mbusy || !entries.length || entries[0].o.archived} onClick=${() => mrun(async () => { await markPrinted(entries); toast(`${entries.length} slips marked printed at their current revision.`); close(); })}>I printed these — mark printed</button>`}
        <button class="btn ghost" onClick=${close}>Close</button>
      </div>
    </div>
    ${(prog || err || saved) && html`<div class=${'callout ' + (err ? 'bad' : saved ? 'good' : 'info')}>${err || prog || `PDF saved. Open it and print at 100% (Actual size) on Letter paper.${kind === 'slips' ? ' After the sheet is printed, tap “I printed these”.' : ''}`}</div>`}
    <p class="muted small pvnote">The PDF opens in your device’s viewer; print from there. On iPad use Share → Print.</p>
    <div class="pvpages" ref=${wrap}>${lay.pages.map((p, i) => html`<div class="pvpage" key=${i} style=${{ width: PAGE_W * sc + 'px', height: PAGE_H * sc + 'px' }}><div class="pvscale" style=${{ transform: `scale(${sc})` }} dangerouslySetInnerHTML=${{ __html: p }}></div></div>`)}</div>
  </div>`;
}

/* ---------- receipt printer views ---------- */
function FmtSwitch({ P, fmt }) {
  return html`<div class="seg" role="group" aria-label="Paper">${[['receipt', 'Receipt printer'], ['letter', 'Regular paper (4 per page)']].map(([k, l]) => html`<button class=${'segb' + (fmt === k ? ' on' : '')} aria-pressed=${fmt === k} onClick=${() => ui({ print: { ...P, fmt: k } })}>${l}</button>`)}</div>`;
}
function usePrinterStatus() {
  const [st, setSt] = useState(null); const on = hasPrinter();
  useEffect(() => {
    if (!on) return; let live = true;
    const f = () => window.__printer.status().then(r => live && setSt(r)).catch(() => live && setSt({ online: false, msg: 'Could not check the receipt printer. Check the internet connection.' }));
    f(); const t = setInterval(f, 8000); return () => { live = false; clearInterval(t); };
  }, [on]);
  return st;
}
function PrinterLine() {
  const st = usePrinterStatus();
  if (!hasPrinter()) return html`<div class="pstat"><i></i><span>${window.__cloud && window.__printerInfo && !window.__printerInfo.configured ? window.__printerInfo.msg : 'No receipt printer on this version of the site.'} Printing saves an 80 mm PDF instead.</span></div>`;
  if (!st) return html`<div class="pstat"><i></i><span>Checking the receipt printer…</span></div>`;
  return html`<div class=${'pstat ' + (st.online ? 'on' : 'off')}><i></i><span>${st.msg}</span></div>`;
}
const JOB_TXT = { queued: 'Waiting for printer', sent: 'Printing…', done: 'Printed ✓', error: 'Problem', expired: 'Not picked up', unconfirmed: 'Not confirmed' };
const JOB_FINAL = new Set(['done', 'error', 'expired', 'unconfirmed']);
/** Shared engine: render, send, then follow every job until the printer confirms it. */
function useReceiptPrint() {
  const [phase, setPhase] = useState(''); const [err, setErr] = useState(''); const [res, setRes] = useState(null); const [jobs, setJobs] = useState(null);
  const gen = useRef(0);
  useEffect(() => () => { gen.current++; }, []);
  const run = async (list, entries) => {
    if (phase) return; const g = ++gen.current; setErr(''); setRes(null); setJobs(null); setPhase('Preparing…');
    try {
      const r = await printReceipts(list, (i, n, msg) => setPhase(msg || `Preparing receipt ${i} of ${n}…`));
      if (entries && entries.length && !entries[0].o.archived) { try { await markPrinted(entries); } catch (e) { console.warn(e); } }
      if (g !== gen.current) return;
      setRes(r); setPhase('');
      if (r.jobIds && r.jobIds.length) { setJobs(r.jobIds.map((id, k) => ({ id, label: list[k] && list[k].label, status: 'queued' }))); follow(r.jobIds, g); }
    } catch (e) { if (g !== gen.current) return; setPhase(''); setErr(e && e.code === 'declined' ? 'The save was canceled. Nothing was printed.' : errText(e)); }
  };
  const follow = (ids, g) => {
    let n = 0;
    const tick = async () => {
      if (g !== gen.current) return;
      try { const j = await window.__printer.jobs(ids); if (g !== gen.current) return; setJobs(j); if (j.every(x => JOB_FINAL.has(x.status))) return; } catch { }
      if (++n < 600) setTimeout(tick, n < 30 ? 2000 : 5000);
    };
    setTimeout(tick, 1500);
  };
  let msg = '', bad = false, finished = false;
  if (jobs && jobs.length) {
    const c = k => jobs.filter(j => j.status === k).length;
    const done = c('done'), errs = jobs.filter(j => j.status === 'error'), exp = c('expired'), unc = c('unconfirmed');
    if (errs.length) { bad = true; msg = `The printer reported a problem: ${errs[0].code || 'unknown error'}. Check the paper and lid, then tap Reprint — or use regular paper.`; }
    else if (exp) { bad = true; msg = `The printer didn’t pick up ${exp === 1 ? 'a receipt' : exp + ' receipts'} within 15 minutes. When it’s back online, tap Reprint — or use regular paper.`; }
    else if (unc) { bad = true; msg = `The printer took ${unc === 1 ? 'a receipt' : unc + ' receipts'} but never confirmed printing. Check whether ${unc === 1 ? 'it' : 'they'} came out.`; }
    else if (done === jobs.length) { finished = true; msg = `Printed ${done === 1 ? '1 receipt' : `all ${done} receipts`} ✓`; }
    else msg = `Sent to the receipt printer — ${done} of ${jobs.length} printed so far…`;
  } else if (res) { finished = !!res.pdf; msg = res.pdf ? `Saved an 80 mm PDF with ${res.sent} receipts.` : `Sent ${res.sent} receipts to the printer.`; }
  if (err) bad = true;
  return { run, phase, err, msg, bad, finished, jobs, started: !!(phase || res || err) };
}
function JobList({ jobs }) {
  if (!jobs || !jobs.length) return null;
  return html`<ul class="joblist">${jobs.map(j => html`<li key=${j.id} class=${'js-' + j.status}><span>${(j.label || '').replace(/ bakery$/, ' · bakery slip').replace(/ customer$/, ' · customer copy')}</span><b>${JOB_TXT[j.status] || j.status}</b></li>`)}</ul>`;
}
function PrintStatus({ R }) {
  if (!(R.phase || R.err || R.msg)) return null;
  return html`<div class=${'callout ' + (R.bad ? 'bad' : R.finished ? 'good' : 'info')} role="status">${R.err || R.phase || R.msg}<${JobList} jobs=${R.jobs} /></div>`;
}
function Strips({ list }) {
  return html`<div class="rvstrips">${list.map((r, i) => html`<div class="rvstrip" key=${i}><p class="cap">${r.kind === 'customer' ? 'Customer copy' : 'Bakery slip'} · ${r.label.replace(/ (bakery|customer)$/, '')}</p><div style=${{ zoom: 1.2 }} dangerouslySetInnerHTML=${{ __html: r.html }}></div></div>`)}</div>`;
}
function ReceiptView({ P, kind }) {
  const entries = (P.refs || []).map(r => { const o = r.order || getOrder(r.orderId); const raw = o && o.items[r.itemId]; return raw ? { o, it: { ...raw, id: r.itemId } } : null; }).filter(Boolean);
  const list = receiptSet(entries, { bakery: kind !== 'customer', customer: kind !== 'slips' });
  const R = useReceiptPrint(); const close = () => ui({ print: null });
  const nB = list.filter(x => x.kind === 'bakery').length, nC = list.length - nB;
  return html`<div class="printview" role="dialog" aria-modal="true" aria-label="Receipt preview">
    <div class="pvhead">
      <div><h2>${PRINT_KIND[kind]} — ${P.title}</h2><p class="muted small">${[nB && `${nB} bakery ${nB === 1 ? 'slip' : 'slips'}`, nC && `${nC} customer ${nC === 1 ? 'copy' : 'copies'}`].filter(Boolean).join(' + ')} · 80 mm receipt paper, cut after each</p></div>
      <div class="pvact"><${FmtSwitch} P=${P} fmt="receipt" />
        <button class="btn primary" disabled=${!!R.phase || !list.length} onClick=${() => R.run(list, kind === 'customer' ? [] : entries)}><${Icon} n="print" s=${18} />${R.phase ? 'Working…' : !hasPrinter() ? 'Save 80 mm PDF' : R.started ? 'Reprint' : 'Print on receipt printer'}</button>
        ${hasPrinter() && html`<button class="btn" disabled=${!!R.phase || !list.length} title="Save the same receipts as an 80 mm PDF" onClick=${() => saveReceiptPdf(list)}>80 mm PDF</button>`}
        <button class="btn ghost" onClick=${close}>Close</button></div>
    </div>
    <${PrinterLine} />
    <${PrintStatus} R=${R} />
    <${Strips} list=${list} />
  </div>`;
}
async function saveReceiptPdf(list) {
  try { const pngs = await receiptPngs(list); const blob = await receiptPdf(pngs); await Store.downloads.save({ filename: `pinhos-receipts-${Date.now()}.pdf`, data: blob }); toast('Saved an 80 mm PDF.'); }
  catch (e) { toast(errText(e), 'bad'); }
}
/** Opens after every confirmed save (auto-prints when a receipt printer is connected), and from "Reprint" on an order. */
function ReviewPrint() {
  const Rv = UI.review; const o = getOrder(Rv.orderId);
  const R = useReceiptPrint();
  const items = o ? itemsOf(o) : [];
  const init = useRef(null);
  if (o && !init.current) {
    const changed = items.filter(it => Rv.isNew || Rv.reprint || !it.printedHash || reprintNeeded(o, it)).map(it => it.id);
    init.current = { ids: changed, cust: !!(Rv.isNew || Rv.reprint) };
  }
  const [sel, setSel] = useState(null); const [custSel, setCust] = useState(null);
  const ids = sel || new Set(init.current ? init.current.ids : []);
  const cust = custSel === null ? !!(init.current && init.current.cust) : custSel;
  const close = () => ui({ review: null });
  const entries = items.filter(it => ids.has(it.id)).map(it => ({ o, it }));
  const list = o ? [...entries.map(e => ({ kind: 'bakery', label: `${itemLabel(o, e.it)} bakery`, html: rcWork(o, e.it) })), ...(cust ? [{ kind: 'customer', label: `${orderLabel(o)} customer`, html: rcCustomer(o) }] : [])] : [];
  const nothing = init.current && !init.current.ids.length && !init.current.cust;
  useEffect(() => { if (nothing && !Rv.reprint) ui({ review: null }); }, [nothing]);
  const autoGo = !!(Rv.auto && hasPrinter() && o && list.length && !nothing);
  useEffect(() => { if (autoGo && !R.started) R.run(list, entries); }, [autoGo]);
  if (!o) return html`<div class="printview" role="dialog" aria-modal="true"><p class="muted">Loading the order…</p><button class="btn" onClick=${close}>Close</button></div>`;
  const toggle = id => { const n = new Set(ids); n.has(id) ? n.delete(id) : n.add(id); setSel(n); };
  const what = [entries.length && (entries.length === 1 ? 'bakery slip' : `${entries.length} bakery slips`), cust && 'customer copy'].filter(Boolean).join(' + ');
  const title = Rv.reprint ? `Reprint — Order ${orderLabel(o)}` : Rv.auto && hasPrinter() ? (Rv.isNew ? `Printing Order ${orderLabel(o)}` : `Order ${orderLabel(o)} changed — printing the updated slips`) : Rv.isNew ? `Review & print — Order ${orderLabel(o)}` : `Order ${orderLabel(o)} changed — reprint?`;
  const changedIds = new Set(init.current ? init.current.ids : []);
  return html`<div class="printview" role="dialog" aria-modal="true" aria-label=${title}>
    <div class="pvhead"><div><h2>${title}</h2>
      <p class="muted small">${o.customer?.name || ''} · pickup ${fmtDateMed(o.pickupDate)} ${fmtTime(o.pickupTime)}${!Rv.isNew && !Rv.reprint ? ' · only the slips that changed were picked' : ''}</p></div>
      <div class="pvact"><button class="btn ghost" onClick=${close}>${R.started ? 'Done' : 'Skip for now'}</button></div></div>
    <div class="rvwrap">
      <${Strips} list=${list} />
      <div class="rvpanel">
        <${PrinterLine} />
        <${PrintStatus} R=${R} />
        ${items.length > 1 && html`<div class="fld"><span>Bakery slips</span>${items.map(it => html`<label class="check"><input type="checkbox" checked=${ids.has(it.id)} onChange=${() => toggle(it.id)} /> ${itemLabel(o, it)} · ${specHead(it)}${!Rv.isNew && !Rv.reprint && changedIds.has(it.id) ? html` <span class="tag ex">changed</span>` : ''}</label>`)}</div>`}
        ${items.length === 1 && html`<label class="check"><input type="checkbox" checked=${ids.has(items[0].id)} onChange=${() => toggle(items[0].id)} /> Bakery slip</label>`}
        <label class="check"><input type="checkbox" checked=${cust} onChange=${e => setCust(e.target.checked)} /> Customer copy (one for the whole order)</label>
        <button class="btn primary big" disabled=${!!R.phase || !list.length} onClick=${() => R.run(list, entries)}><${Icon} n="print" />${R.phase ? 'Working…' : !what ? 'Nothing selected' : R.started ? `Reprint ${what}` : `Print ${what}`}</button>
        <button class="btn" disabled=${!entries.length && !cust} onClick=${() => { close(); openPrint(entries.length ? entries.map(e => ({ orderId: o.id, itemId: e.it.id })) : [{ orderId: o.id, itemId: items[0].id }], `Order ${orderLabel(o)}`, entries.length && cust ? 'both' : entries.length ? 'slips' : 'customer', { fmt: 'letter' }); }}>Printer down? Use regular paper (4 per page)</button>
        ${hasPrinter() && html`<button class="btn ghost" disabled=${!list.length || !!R.phase} onClick=${() => saveReceiptPdf(list)}>Save as 80 mm PDF instead</button>`}
      </div>
    </div>
  </div>`;
}
