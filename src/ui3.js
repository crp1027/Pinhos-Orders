/* ===== ui3.js — order form, schedule, search, options ===== */
let _draftTimer = null;
function formForStorage(f) {
  const c = JSON.parse(JSON.stringify(f, (k, v) => (k === 'preview' || k === 'saving' || k === 'err') ? undefined : v));
  c.items.forEach(it => { it.images = it.images.filter(im => im.asset); });
  return c;
}
function persistDraftSoon() {
  clearTimeout(_draftTimer);
  _draftTimer = setTimeout(() => { if (UI.form && UI.form.dirty) lsSet('pb.formdraft', { at: Date.now(), form: formForStorage(UI.form) }); }, 400);
}
function restoreDraft() {
  const d = lsGet('pb.formdraft', null);
  if (d && d.form && d.form.v === 2 && d.form.items && d.form.dirty) {
    d.form.restoredAt = d.at;
    d.form.items = d.form.items.map(x => { const n = { ...blankItem(x.pos), ...x }; n.tiers = (n.tiers || []).map(t => ({ ...blankTier(), ...t })); n.extras = (n.extras || []).map(e => ({ id: e.id || uid(), desc: e.desc || '', amount: e.amount ?? cin(e.cents), isNew: e.isNew })); if (!n.fillMode) n.fillMode = n.filling2 ? 'layer' : 'same'; return n; });
    return d.form;
  }
  return null;
}
function discardLocalDraft() { lsSet('pb.formdraft', undefined); }

function MenuSelect({ obj, k, label, id, items, groups, onChange, disabled, placeholder = 'Choose…', other = true }) {
  const all = groups ? groups.flatMap(g => g[1]) : items;
  const val = obj[k] || ''; const known = all.some(x => x.label === val);
  const isOther = obj['_o_' + k] || (val && !known);
  const sv = isOther ? '__other' : val;
  const opt = x => html`<option value=${x.label}>${x.label}${x.hint ? ` — ${x.hint}` : ''}</option>`;
  return html`<div class="fld"><label for=${id}>${label}</label>
    <select id=${id} value=${sv} disabled=${disabled} onChange=${e => { const v = e.target.value; if (v === '__other') { obj['_o_' + k] = true; obj[k] = ''; } else { obj['_o_' + k] = false; obj[k] = v; } onChange(); }}>
      <option value="">${placeholder}</option>
      ${groups ? groups.filter(g => g[1].length).map(([gl, list]) => html`<optgroup label=${gl}>${list.map(opt)}</optgroup>`) : all.map(opt)}
      ${other && html`<option value="__other">Other / custom…</option>`}
    </select>
    ${isOther && html`<input aria-label=${label + ', custom'} value=${val} placeholder="Type it exactly (no set price)" onInput=${e => { obj[k] = e.target.value; onChange(); }} />`}</div>`;
}
function SizeSelect({ it, upd, label = 'Size' }) {
  const rows = sizeOptions(it.typeKey);
  return html`<div class="fld"><label for=${'sz' + it.id}>${label}</label>
    <select id=${'sz' + it.id} value=${it.sizeKey} onChange=${e => {
      it.sizeKey = e.target.value; const row = sizeRow(it.typeKey, it.sizeKey);
      if (it.typeKey === 'tier' && row) it.tiers = row.tiers.map((sz, k) => { const src = it.tiers[k] || it.tiers[0]; return src ? { ...blankTier(), ...src, size: sz } : blankTier(sz); });
      upd();
    }}><option value="">Choose…</option>${rows.map(r => html`<option value=${r.key}>${r.label}${r.serv ? ` · serves ${r.serv}` : ''}</option>`)}</select></div>`;
}
const flavorItems = () => activeOf(menu().flavors).map(f => ({ label: f.label, hint: f.kind === 'premcake' ? 'premium cake' : f.kind === 'tresleches' ? 'can’t be mixed' : f.kind === 'tiramisu' ? 'fixed recipe' : '' }));
const fillingGroups = () => FILLING_CATS.map(([c, l]) => [l, activeOf(menu().fillings).filter(f => f.cat === c).map(f => ({ label: f.label }))]);
const icingItems = () => activeOf(menu().icings).map(i => ({ label: i.label, hint: i.ganache ? `+${fmtMoney(menu().addons.ganache)}` : '' }));
const INK_COLORS = ['Royal blue', 'Pink', 'Red', 'Purple', 'Black', 'White', 'Gold', 'Green', 'Match the trim'];
function startNewOrder() { UI.form = blankForm(); discardLocalDraft(); ui({ tab: 'form', dialog: null }); window.scrollTo && window.scrollTo(0, 0); }
async function doSave(mode) {
  const f = UI.form; if (!f || f.saving) return;
  f.saving = true; f.err = null; f.lastMode = mode; emit();
  try {
    const wasDraft = f.isNew || f.booking === 'draft';
    await saveOrderForm(f, mode, { force: f.force });
    f.force = false; f.dirty = false; discardLocalDraft();
    if (mode === 'confirm' || f.booking === 'confirmed') {
      f.saved = true; closeDialog();
      toast(`Order #${f.num} ${wasDraft ? 'confirmed' : 'saved'} for ${fmtDateMed(f.pickupDate)} ${fmtTime(f.pickupTime)}.`);
      UI.tab = 'today'; UI.day = f.pickupDate; openDetail(f.id, f.items[0].id);
      UI.review = { orderId: f.id, isNew: wasDraft, auto: hasPrinter(), at: Date.now() };
    } else { closeDialog(); toast(`Draft #${f.num} saved. It is not in production lists until confirmed.`); }
  } catch (e) {
    console.error(e);
    if (e && e.code === 'conflict') openDialog({ type: 'conflict' });
    else f.err = errText(e);
  } finally { f.saving = false; emit(); }
}
function staffNames() {
  const seen = new Set(lsGet('pb.staff', []));
  for (const o of visibleOrders()) if (o.takenBy && seen.size < 14) seen.add(o.takenBy);
  return [...seen].slice(0, 10);
}
function OrderForm() {
  let f = UI.form;
  if (!f || f.v !== 2) f = UI.form = restoreDraft() || blankForm();
  const upd = () => { f.dirty = true; persistDraftSoon(); emit(); };
  useEffect(() => { if (f.openReview) { f.openReview = false; openDialog({ type: 'review' }); } }, []);
  const T = (obj, key, label, o = {}) => html`<label class=${'fld' + (o.cls ? ' ' + o.cls : '')}><span>${label}</span>${o.area
    ? html`<textarea rows=${o.rows || 2} value=${obj[key] ?? ''} placeholder=${o.ph || ''} onInput=${e => { obj[key] = e.target.value; upd(); }}></textarea>`
    : html`<input type=${o.type || 'text'} inputmode=${o.im || null} autocomplete=${o.ac || 'off'} list=${o.list || null} value=${obj[key] ?? ''} placeholder=${o.ph || ''} onInput=${e => { obj[key] = e.target.value; upd(); }} />`}${o.help && html`<small class="muted">${o.help}</small>`}</label>`;
  const today = todayNY();
  const nextWd = wd => { let d = today; for (let i = 0; i < 8; i++) { if (weekday(d) === wd && d !== today) return d; d = addDays(d, 1); } return d; };
  const closed = f.pickupDate && isClosedDay(Store.calendar, f.pickupDate);
  const editing = !f.isNew;
  const TT = formTotals(f);
  const title = f.isNew ? (f.repeatOf ? `New order (repeat of #${f.repeatOf})` : 'New order') : `${f.booking === 'draft' ? 'Draft' : 'Edit order'} #${f.num}`;
  const names = staffNames();
  const bigDeposit = f.items.some(it => bigSizeForDeposit(it.typeKey, it.sizeKey));
  return html`<div class="screen form">
    <div class="formhead"><h1>${title}</h1>
      <div class="inline">${f.restoredAt && html`<span class="callout info sm">Restored unsaved entry from ${fmtStamp(f.restoredAt)}.</span>`}
        ${(f.dirty || editing) && html`<button class="btn sm ghost" onClick=${() => openDialog({ type: 'confirm', title: f.isNew ? 'Clear this form?' : 'Discard changes?', body: f.isNew ? 'Everything typed into this new order will be cleared.' : 'Unsaved changes will be lost. The saved order stays as it was.', okLabel: f.isNew ? 'Clear form' : 'Discard changes', danger: true, onOk: async () => { if (f.isNew) startNewOrder(); else { const o = getOrder(f.id); discardLocalDraft(); UI.form = null; ui({ tab: 'today', detail: o ? { orderId: o.id, itemId: itemsOf(o)[0]?.id } : null }); } } })}>${f.isNew ? 'Clear form' : 'Discard changes'}</button>`}</div></div>
    ${f.err && html`<div class="callout bad" role="alert"><b>Not saved.</b> ${f.err} Your entry is still here. <button class="btn sm" onClick=${() => doSave(f.lastMode || 'draft')}>Try again</button></div>`}

    <fieldset class="fs"><legend><span class="stepn">1</span>Customer & pickup</legend>
      <div class="grid2">
        ${T(f.customer, 'name', 'Customer name', { ac: 'off' })}
        ${T(f.customer, 'phone', 'Phone number', { type: 'tel', im: 'tel', help: f.customer.phone && phoneDigits(f.customer.phone).length === 10 ? fmtPhone(f.customer.phone) : 'Any format is fine' })}
        ${T(f.customer, 'email', 'Email (optional)', { type: 'email' })}
        <div class="fld"><label for="takenby">Order taken by (your name)</label>
          <input id="takenby" value=${f.takenBy || ''} autocomplete="off" placeholder="Employee name" onInput=${e => { f.takenBy = e.target.value; upd(); }} />
          ${names.length > 0 && html`<div class="quick">${names.map(n => html`<button class=${'chip sm' + (f.takenBy === n ? ' on' : '')} onClick=${() => { f.takenBy = n; upd(); }}>${n}</button>`)}</div>`}</div>
      </div>
      <div class="grid2">
        <div class="fld"><label for="pdate">Pickup date</label><input id="pdate" type="date" value=${f.pickupDate} onInput=${e => { f.pickupDate = e.target.value; f.allowClosed = false; upd(); }} />
          <div class="quick">${[['Today', today], ['Tomorrow', addDays(today, 1)], ['Sat', nextWd(6)], ['Sun', nextWd(0)]].map(([l, d]) => html`<button class=${'chip sm' + (f.pickupDate === d ? ' on' : '')} onClick=${() => { f.pickupDate = d; f.allowClosed = false; upd(); }}>${l}</button>`)}</div>
          ${f.pickupDate && html`<small class="datebig">${fmtDateLong(f.pickupDate)}</small>`}</div>
        <div class="fld"><label for="ptime">Pickup time</label><input id="ptime" type="time" step="900" value=${f.pickupTime} onInput=${e => { f.pickupTime = e.target.value; upd(); }} />
          ${f.pickupTime && html`<small class="datebig">${fmtTime(f.pickupTime)}</small>`}</div>
      </div>
      ${closed && html`<div class="callout warn">${DAY_NAMES[weekday(f.pickupDate)]}s are normally closed. <label class="check"><input type="checkbox" checked=${f.allowClosed} onChange=${e => { f.allowClosed = e.target.checked; upd(); }} /> Allow a pickup on this date (exception)</label></div>`}
      ${f.pickupDate && f.pickupDate < today && html`<div class="callout warn">That date is in the past.</div>`}
    </fieldset>

    ${f.items.map((it, i) => html`<${ItemForm} key=${it.id} f=${f} it=${it} i=${i} upd=${upd} T=${T} P=${TT.ps[i]} />`)}
    <button class="btn wide" onClick=${() => { const prev = f.items[f.items.length - 1]; const n = blankItem(f.items.length); if (prev) Object.assign(n, { flavor: prev.flavor, icing: prev.icing, colors: prev.colors, decoration: prev.decoration }); f.items.push(n); upd(); }}><${Icon} n="plus" />Add another item to this order</button>
    <p class="muted small">Example: a birthday cake plus 24 matching cupcakes is one order with two items. Cupcakes with different designs can be separate items.</p>

    <${PriceSection} f=${f} TT=${TT} upd=${upd} T=${T} />
    <fieldset class="fs"><legend><span class="stepn">4</span>${f.isNew ? 'Deposit' : 'Payments'}</legend>
      <p class="muted small">No tax is added (the owner’s instruction: cakes are not taxed in NJ).</p>
      ${f.isNew && html`<div class="fld"><span>Deposit taken now (optional)</span>
          <div class="inline"><input inputmode="decimal" aria-label="Deposit amount" value=${f.deposit.amount} placeholder="0.00" onInput=${e => { f.deposit.amount = e.target.value; upd(); }} />
          <div class="seg">${['cash', 'card', 'other'].map(m => html`<button class=${'segb' + (f.deposit.method === m ? ' on' : '')} aria-pressed=${f.deposit.method === m} onClick=${() => { f.deposit.method = m; upd(); }}>${m[0].toUpperCase() + m.slice(1)}</button>`)}</div></div>
          <input aria-label="Deposit POS reference" value=${f.deposit.ref} placeholder="POS reference (optional)" onInput=${e => { f.deposit.ref = e.target.value; upd(); }} />
          ${bigDeposit && html`<small class="muted">The older choices sheet mentions a $20 deposit for 14-inch and larger cakes. This hasn’t been reconfirmed, so it isn’t required here.</small>`}</div>`}
      ${!f.isNew && html`<p class="muted small">Record payments from the order’s Payment & Pickup tab. Changing the total recalculates the balance; recorded payments stay as they are.</p>`}
    </fieldset>
    <div class="formbar">
      <span class="fbtotal">Total <b>${fmtMoney(f.totalOverride.on ? money(f.totalOverride.amount) : TT.sum)}</b>${!TT.complete ? ' · not final' : ''}</span>
      ${(f.isNew || f.booking === 'draft') && html`<button class="btn big" disabled=${f.saving} onClick=${() => doSave('draft')}>${f.saving && f.lastMode === 'draft' ? 'Saving…' : 'Save as draft'}</button>`}
      <button class="btn big primary" disabled=${f.saving} onClick=${() => openDialog({ type: 'review' })}>${f.isNew || f.booking === 'draft' ? 'Review & confirm' : 'Review & save changes'}</button>
    </div>
  </div>`;
}
function PriceSection({ f, TT, upd, T }) {
  const ovOn = f.items.some(it => it.override && it.override.on);
  const reason = (f.items.find(it => it.override && it.override.on && it.override.reason) || {}).override?.reason || '';
  const setOv = on => { f.items.forEach((it, i) => { const p = TT.ps[i]; it.override = on ? { on: true, amount: it.override.amount || cin(p.finalCents ?? p.calc.calcCents), reason: it.override.reason || reason } : { ...it.override, on: false }; }); upd(); };
  return html`<fieldset class="fs"><legend><span class="stepn">3</span>Final price</legend>
    <table class="plines big"><tbody>${f.items.map((it, i) => { const p = TT.ps[i]; return html`<tr><td>Item ${suffixFor(i)} · ${specBrief(p.spec) || 'not described yet'}${p.source === 'override' ? ' (price overridden)' : p.source === 'agreed' ? ' (agreed price kept)' : !p.calc.complete && p.finalCents !== null ? ' (starting price — not final)' : ''}</td><td>${fmtMoney(p.finalCents)}</td></tr>`; })}</tbody>
      <tfoot><tr><td>Order total${TT.sum === null ? ' (some items have no price yet)' : ''}</td><td>${fmtMoney(f.totalOverride.on ? money(f.totalOverride.amount) : TT.sum)}</td></tr></tfoot></table>
    ${f.items.map((it, i) => { const P = TT.ps[i]; return P.changed && !it.override.on && html`<div class="callout warn">Item ${suffixFor(i)} was agreed at <b>${fmtMoney(it.agreedCents)}</b>. With the current choices and menu it would be <b>${fmtMoney(P.calc.calcCents)}</b>.
      <div class="inline"><button class=${'btn sm' + (it.priceChoice !== 'new' ? ' on' : '')} onClick=${() => { it.priceChoice = 'agreed'; upd(); }}>Keep ${fmtMoney(it.agreedCents)}</button><button class=${'btn sm' + (it.priceChoice === 'new' ? ' on' : '')} onClick=${() => { it.priceChoice = 'new'; upd(); }}>Use new price ${fmtMoney(P.calc.calcCents)}</button></div></div>`; })}
    ${!TT.complete && !ovOn && html`<p class="warnli small">Part of this order still needs a price. Use “Override the price” below to enter it, or confirm now and it shows “Price not final” until it’s priced.</p>`}
    <label class="check big"><input type="checkbox" checked=${ovOn} onChange=${e => setOv(e.target.checked)} /> Override the price${f.items.length > 1 ? 's' : ''}</label>
    ${ovOn && html`<div class="ovbox"><div class="grid3">${f.items.map((it, i) => T(it.override, 'amount', f.items.length > 1 ? `Item ${suffixFor(i)} final price` : 'Final price', { im: 'decimal', ph: '0.00', help: `Starting price ${fmtMoney(TT.ps[i].calc.calcCents)}` }))}</div>
      <label class="fld"><span>Reason for the override (required)</span><input value=${reason} placeholder="e.g. manager quote for sculpted design" onInput=${e => { f.items.forEach(it => { if (it.override.on) it.override.reason = e.target.value; }); upd(); }} /></label></div>`}
    ${f.totalOverride.on && html`<div class="callout info">This order’s total was set by hand earlier: ${fmtMoney(money(f.totalOverride.amount))} (“${f.totalOverride.reason}”). <button class="btn sm" onClick=${() => { f.totalOverride.on = false; upd(); }}>Remove and use the item prices</button></div>`}
  </fieldset>`;
}
function FlavorPick({ x, upd, idp, allowMix }) {
  const kind = (flavorOf(x.flavor) || {}).kind;
  return html`<div class="grid2">
      <${MenuSelect} obj=${x} k="flavor" label=${x.mix ? 'Cake flavor (2 layers)' : 'Cake flavor'} id=${'fl' + idp} items=${flavorItems()} onChange=${upd} />
      ${x.mix && html`<${MenuSelect} obj=${x} k="flavor2" label="Different flavor (1 layer)" id=${'fl2' + idp} items=${flavorItems().filter(f => !['Tres leches', 'Tiramisu'].includes(f.label))} onChange=${upd} />`}
    </div>
    ${allowMix && kind !== 'tresleches' && kind !== 'tiramisu' && html`<label class="check"><input type="checkbox" checked=${!!x.mix} onChange=${e => { x.mix = e.target.checked; if (!x.mix) x.flavor2 = ''; upd(); }} /> One cake layer is a different flavor</label>`}`;
}
function FillPick({ x, upd, idp, tiramisu }) {
  if (tiramisu) return html`<div class="fld"><span>Filling</span><p class="fixed">Tiramisu is a fixed recipe — no filling choice.</p></div>`;
  const m = x.fillMode || 'same';
  const lab = m === 'layer' ? ['Filling (1st layer)', 'Filling (2nd layer)'] : m === 'half' ? ['Filling (one half)', 'Filling (other half)'] : ['Filling (both layers)'];
  return html`<div class="fillpick">
    <div class="fld"><span>How are the fillings arranged?</span><div class="seg wrap">${FILL_MODES.map(([k, l]) => html`<button class=${'segb' + (m === k ? ' on' : '')} aria-pressed=${m === k} onClick=${() => { x.fillMode = k; if (k === 'same') x.filling2 = ''; upd(); }}>${l}</button>`)}</div></div>
    <div class="grid2"><${MenuSelect} obj=${x} k="filling" label=${lab[0]} id=${'fi' + idp} groups=${fillingGroups()} onChange=${upd} />
      ${m !== 'same' && html`<${MenuSelect} obj=${x} k="filling2" label=${lab[1]} id=${'fi2' + idp} groups=${fillingGroups()} onChange=${upd} />`}</div>
    ${m === 'half' && html`<small class="muted">Split in half: one side of the cake has one filling, the other side has the other, through every layer.</small>`}
  </div>`;
}
function CupcakeGroups({ it, upd, tk }) {
  const total = it.groups.reduce((a, g) => a + (+g.qty || 0), 0);
  return html`<div class="groups">
    ${it.groups.map((g, k) => html`<div class="grow"><b class="gnum">Group ${k + 1}</b>
      <div class="fld gq"><label for=${`gq${it.id}${k}`}>How many</label><input id=${`gq${it.id}${k}`} inputmode="numeric" value=${g.qty} onInput=${e => { g.qty = e.target.value; upd(); }} /></div>
      <${MenuSelect} obj=${g} k="flavor" label="Flavor" id=${`gf${it.id}${k}`} items=${flavorItems()} onChange=${upd} />
      ${tk === 'cupcakes' && html`<${MenuSelect} obj=${g} k="filling" label="Filling (optional)" id=${`gl${it.id}${k}`} groups=${fillingGroups()} onChange=${upd} />`}
      <${MenuSelect} obj=${g} k="icing" label="Icing" id=${`gi${it.id}${k}`} items=${icingItems()} onChange=${upd} />
      <button class="iconbtn" aria-label=${`Remove group ${k + 1}`} disabled=${it.groups.length < 2} onClick=${() => { it.groups.splice(k, 1); upd(); }}><${Icon} n="x" /></button></div>`)}
    <div class="inline"><button class="btn sm" onClick=${() => { const p = it.groups[it.groups.length - 1] || {}; it.groups.push({ ...blankGroup(), icing: p.icing || '' }); upd(); }}><${Icon} n="plus" s=${16} />Add group</button>
      <span><b>${total}</b> cupcakes in total${total % 12 === 0 && total ? ` (${total / 12} dozen)` : ''}</span></div>
  </div>`;
}
function ItemForm({ f, it, i, upd, T, P }) {
  const fileRef = useRef();
  const sfx = suffixFor(i); const tk = it.typeKey; const A = it.addons;
  const kind = (flavorOf(it.flavor) || {}).kind;
  const row = sizeRow(tk, it.sizeKey);
  const onFiles = async files => {
    for (const file of files) {
      const im = { id: uid(), name: file.name, purpose: '', uploading: true, preview: URL.createObjectURL(file) };
      it.images.push(im); upd();
      try { Object.assign(im, await uploadImage(file), { uploading: false }); }
      catch (e) { im.uploading = false; im.error = errText(e); }
      upd();
    }
  };
  const setType = k => { it.typeKey = k; it.sizeKey = ''; if (k === 'tier') it.tiers = []; if (k !== 'standard') { it.mix = false; } upd(); };
  const chk = (obj, key, label, extra) => html`<label class="check"><input type="checkbox" checked=${!!obj[key]} onChange=${e => { obj[key] = e.target.checked; extra && extra(e.target.checked); upd(); }} /> ${label}</label>`;
  const ad = menu().addons; const cup = tk === 'cupcakecake' || tk === 'cupcakes';
  const toggleGroups = on => { it.groupsOn = on; if (on && !it.groups.length) it.groups = [{ qty: it.qty || '', flavor: it.flavor || '', filling: it.filling || '', icing: it.icing || '' }, { ...blankGroup(), icing: it.icing || '' }]; if (!on && it.groups.length) { const g0 = it.groups[0]; it.qty = String(it.groups.reduce((a, g) => a + (+g.qty || 0), 0) || ''); it.flavor = it.flavor || g0.flavor; it.icing = it.icing || g0.icing; } upd(); };
  return html`<fieldset class="fs item"><legend><span class="stepn">2</span>Item ${sfx}${f.num ? ` · #${f.num}-${sfx}` : ''}${f.items.length > 1 ? ` (${i + 1} of ${f.items.length})` : ''}</legend>
    <div class="itemtools">
      <button class="btn sm ghost" onClick=${() => { const c = JSON.parse(JSON.stringify(formForStorage({ items: [it] }).items[0])); c.id = uid(); c.isNew = true; c.requestsList = []; c.prodList = []; c.images = c.images.map(im => ({ ...im, id: uid() })); c.extras = c.extras.map(x => ({ ...x, id: uid(), isNew: true })); delete c.suffix; c.agreedCents = null; c.savedCalcCents = null; f.items.splice(i + 1, 0, c); upd(); }}>Duplicate item</button>
      ${f.items.length > 1 && html`<button class="btn sm danger ghost" onClick=${() => { if (!it.isNew) (f.removedItems = f.removedItems || []).push(it.id); f.items.splice(i, 1); upd(); }}>Remove item</button>`}
    </div>
    <div class="fld"><span>Product type</span><div class="chips">${PRODUCTS.map(p => html`<button class=${'chip' + (tk === p.key ? ' on' : '')} aria-pressed=${tk === p.key} onClick=${() => setType(p.key)}>${p.label}</button>`)}</div>
      ${tk === 'tier' && html`<small class="muted">Tier-style is Pinho’s tall, formal style. It can be one tall cake or stacked tiers, priced from its own chart.</small>`}</div>
    ${tk === 'other' && html`<div class="grid2">${T(it, 'typeOther', 'Describe the product', { ph: 'e.g. cookie cake' })}${T(it, 'flavor', 'Flavor')}${T(it, 'filling', 'Filling')}${T(it, 'icing', 'Icing / finish')}</div>`}
    ${tk === 'standard' && html`<div class="grid2"><${SizeSelect} it=${it} upd=${upd} /></div>
      <${FlavorPick} x=${it} upd=${upd} idp=${it.id} allowMix />
      <${FillPick} x=${it} upd=${upd} idp=${it.id} tiramisu=${kind === 'tiramisu'} />
      <div class="grid2"><${MenuSelect} obj=${it} k="icing" label="Icing" id=${'ic' + it.id} items=${icingItems()} onChange=${upd} /></div>`}
    ${tk === 'tier' && html`<div class="tiered"><div class="grid2"><${SizeSelect} it=${it} upd=${upd} label="Tier-style size" /></div>
        ${it.tiers.map((t, k) => html`<div class="tierrow"><b>${it.tiers.length > 1 ? `Tier ${k + 1}${k === 0 ? ' (bottom)' : ''}` : 'Cake'} · ${t.size}</b>
          <${FlavorPick} x=${t} upd=${upd} idp=${`${it.id}t${k}`} allowMix />
          <${FillPick} x=${t} upd=${upd} idp=${`${it.id}t${k}`} tiramisu=${(flavorOf(t.flavor) || {}).kind === 'tiramisu'} /></div>`)}
        ${!it.tiers.length && html`<p class="muted small">Choose a size to set up the tiers.</p>`}
        <div class="grid2"><${MenuSelect} obj=${it} k="icing" label="Icing" id=${'ic' + it.id} items=${icingItems()} onChange=${upd} /></div>
        ${row && row.delivery && html`<div class="grid2">${T(A, 'delivery', 'Delivery charge (required for three tiers)', { im: 'decimal', ph: '0.00', help: 'The chart says “plus delivery.” No delivery price is set; enter what was agreed.' })}</div>`}</div>`}
    ${tk === 'single' && html`<div class="grid3"><${SizeSelect} it=${it} upd=${upd} /><${MenuSelect} obj=${it} k="flavor" label="Cake flavor" id=${'fl' + it.id} items=${flavorItems()} onChange=${upd} /><${MenuSelect} obj=${it} k="icing" label="Icing" id=${'ic' + it.id} items=${icingItems()} onChange=${upd} /></div><small class="muted">Single-layer cakes have no filling.</small>`}
    ${cup && html`
      ${!it.groupsOn && html`<div class="grid3">
        <div class="fld"><label for=${'q' + it.id}>How many cupcakes</label><input id=${'q' + it.id} inputmode="numeric" value=${it.qty} onInput=${e => { it.qty = e.target.value; upd(); }} />
          <div class="quick">${[12, 24, 36, 48].map(n => html`<button class=${'chip sm' + (+it.qty === n ? ' on' : '')} onClick=${() => { it.qty = String(n); upd(); }}>${n}</button>`)}</div></div>
        <${MenuSelect} obj=${it} k="flavor" label="Cupcake flavor" id=${'fl' + it.id} items=${flavorItems()} onChange=${upd} />
        ${tk === 'cupcakes' && html`<${MenuSelect} obj=${it} k="filling" label="Filling (optional)" id=${'fi' + it.id} groups=${fillingGroups()} onChange=${upd} />`}
        <${MenuSelect} obj=${it} k="icing" label="Icing" id=${'ic' + it.id} items=${icingItems()} onChange=${upd} /></div>`}
      <label class="check"><input type="checkbox" checked=${!!it.groupsOn} onChange=${e => toggleGroups(e.target.checked)} /> Split into groups with different flavor${tk === 'cupcakes' ? ', filling' : ''} or icing (they stay together as one item)</label>
      ${it.groupsOn && html`<${CupcakeGroups} it=${it} upd=${upd} tk=${tk} />`}
      ${tk === 'cupcakecake' && html`${chk(A, 'shaped', `Shaped arrangement (cupcakes form a shape) +${fmtMoney(menu().cupcake.shaped)}`)}
        ${A.shaped && html`<label class="fld"><span>Describe the shape / arrangement (prints at the top of the slip)</span><textarea rows="2" value=${it.shapeDesc} placeholder="e.g. Number 5, pink and purple swirl, flowers on the top" onInput=${e => { it.shapeDesc = e.target.value; upd(); }}></textarea></label>`}`}
      ${tk === 'cupcakes' && html`<small class="muted">Custom cupcakes have no menu price. Enter the price in step 3. If any group has a pricier filling, charge the whole order at that price.</small>`}`}
    <div class="fld insc-f"><label for=${'in' + it.id}>Inscription — type it exactly as the customer wants it</label>
      <textarea id=${'in' + it.id} rows="2" disabled=${it.noInscription} value=${it.inscription} onInput=${e => { it.inscription = e.target.value; upd(); }}></textarea>
      ${!it.noInscription && html`<div class="fld"><label for=${'icl' + it.id}>Inscription color (writing)</label><input id=${'icl' + it.id} value=${it.inscriptionColor} placeholder="e.g. Royal blue" onInput=${e => { it.inscriptionColor = e.target.value; upd(); }} />
        <div class="quick">${INK_COLORS.map(c => html`<button class=${'chip sm' + (it.inscriptionColor === c ? ' on' : '')} onClick=${() => { it.inscriptionColor = c; upd(); }}>${c}</button>`)}</div></div>`}
      <label class="check big"><input type="checkbox" checked=${it.noInscription} onChange=${e => { it.noInscription = e.target.checked; upd(); }} /> No Inscription</label></div>
    <div class="grid2">${T(it, 'colors', 'Icing / decoration colors')}${T(it, 'decoration', 'Decoration / theme', { area: true })}</div>
    <div class="grid2 notes2">
      <div class="fld"><span>Customer Requests</span>
        ${(it.requestsList || []).length > 0 && html`<ul class="notes">${it.requestsList.map(r => html`<li><span class="muted xs">${r.at ? fmtStamp(r.at) : ''}${r.dev ? ` · ${r.by || r.dev}` : ''}</span><div>${r.text}</div></li>`)}</ul>`}
        <textarea rows="3" aria-label=${(it.requestsList || []).length ? 'Add to customer requests' : 'Customer requests'} value=${it.newRequest} placeholder=${(it.requestsList || []).length ? 'Add a new request (earlier requests stay)' : 'Anything else the customer asked for'} onInput=${e => { it.newRequest = e.target.value; upd(); }}></textarea></div>
      <div class="fld"><span>Production notes</span>
        ${(it.prodList || []).length > 0 && html`<ul class="notes">${it.prodList.map(r => html`<li><span class="muted xs">${r.at ? fmtStamp(r.at) : ''}${r.dev ? ` · ${r.by || r.dev}` : ''}</span><div>${r.text}</div></li>`)}</ul>`}
        <textarea rows="3" aria-label=${(it.prodList || []).length ? 'Add a production note' : 'Production notes'} value=${it.newProd} placeholder="Notes for the bakers and decorators (not shown to the customer)" onInput=${e => { it.newProd = e.target.value; upd(); }}></textarea></div>
    </div>
    ${tk && tk !== 'other' && html`<div class="fld addons"><span>Paid decoration</span>
      <div class="adgrid">
        ${chk(A, 'animated', `Animated picture +${fmtMoney(ad.animated)}`)}
        ${chk(A, 'portrait', `Personal portrait +${fmtMoney(ad.portrait)}`)}
        <div>${chk(A, 'themeOn', `Theme decoration (starts at ${fmtMoney(ad.themeStart)})`, v => { if (v && !A.theme) A.theme = cin(ad.themeStart); })}
          ${A.themeOn && html`<input aria-label="Theme decoration charge" inputmode="decimal" value=${A.theme} onInput=${e => { A.theme = e.target.value; upd(); }} />`}</div>
        <div>${chk(A, 'figuresOn', `Figures (${fmtMoney(ad.figureStart)} and up, manager-priced)`)}
          ${A.figuresOn && html`<input aria-label="Figures charge" inputmode="decimal" placeholder="Amount" value=${A.figure} onInput=${e => { A.figure = e.target.value; upd(); }} />`}</div>
        ${chk(A, 'needsQuote', 'Custom design work still needs a manager’s quote')}
      </div>
      ${(A.animated || A.portrait) && html`<div class="picphone"><label class="fld"><span>Picture contact phone — who is sending the picture?</span>
        <div class="inline"><input type="tel" inputmode="tel" value=${it.picturePhone} placeholder="Phone of the person sending the image" onInput=${e => { it.picturePhone = e.target.value; upd(); }} />
          <button class="btn sm" disabled=${!f.customer.phone} onClick=${e => { e.preventDefault(); it.picturePhone = f.customer.phone; upd(); }}>Same as customer</button></div>
        ${it.picturePhone && phoneDigits(it.picturePhone).length === 10 && html`<small class="muted">${fmtPhone(it.picturePhone)}${phoneDigits(it.picturePhone) === phoneDigits(f.customer.phone) ? ' · same as the customer' : ''}</small>`}</label></div>`}
      ${A.custom.map((c, k) => html`<div class="inline"><input aria-label="Charge description" placeholder="Other charge description" value=${c.label} onInput=${e => { c.label = e.target.value; upd(); }} /><input aria-label="Charge amount" inputmode="decimal" placeholder="0.00" class="amt" value=${c.amount} onInput=${e => { c.amount = e.target.value; upd(); }} /><button class="iconbtn" aria-label="Remove charge" onClick=${() => { A.custom.splice(k, 1); upd(); }}><${Icon} n="x" /></button></div>`)}
      </div>`}
    <div class="fld"><span>Extras (toppers, flowers, supplies) — due with the pickup</span>
      ${it.extras.map((x, k) => html`<div class="exform">
        <input aria-label=${`Extra ${k + 1} description`} value=${x.desc} placeholder="e.g. Gold “30” topper" onInput=${e => { x.desc = e.target.value; upd(); }} />
        <span class="amtwrap"><span aria-hidden="true">$</span><input aria-label=${`Extra ${k + 1} charge`} class="amt" inputmode="decimal" value=${x.amount} placeholder="0.00" onInput=${e => { x.amount = e.target.value; upd(); }} /></span>
        <button class="iconbtn" aria-label="Remove extra" onClick=${() => { if (!x.isNew) (it.removedExtras = it.removedExtras || []).push(x.id); it.extras.splice(k, 1); upd(); }}><${Icon} n="x" /></button></div>`)}
      <button class="btn sm" onClick=${() => { it.extras.push({ id: uid(), desc: '', amount: '', isNew: true }); upd(); }}><${Icon} n="plus" s=${16} />Add extra</button>
      ${it.extras.length > 0 && html`<small class="muted">Each extra’s charge is added to this item’s price as its own line. Leave $0 or blank if there’s no charge.</small>`}</div>
    ${tk && html`<div class="fld"><span>Starting price for item ${sfx}</span>
      <${PriceLines} lines=${P.calc.lines} issues=${P.calc.issues} total=${P.calc.calcCents} source="calc" />
      ${P.source !== 'calc' && html`<p class="muted small">Final price in step 3: <b>${fmtMoney(P.finalCents)}</b> (${P.source === 'override' ? 'overridden' : 'agreed price kept'}).</p>`}</div>`}
    <div class="fld"><span>Design images</span>
      ${Store.assets ? html`<input ref=${fileRef} class="vh" type="file" accept="image/*" multiple onChange=${e => { onFiles([...e.target.files]); e.target.value = ''; }} />
        <button class="btn" onClick=${() => fileRef.current.click()}><${Icon} n="img" />Add photos</button>` : html`<p class="muted small">Image upload is not available on this device (it needs edit access to the site).</p>`}
      ${it.images.map((im, k) => html`<div class="imgrow">
        <img src=${im.preview || blobUrl(im.thumb || im.asset)} alt="" />
        <div class="imgf">${im.uploading ? html`<span class="muted">Uploading ${im.name}…</span>` : im.error ? html`<span class="badtxt">Upload failed: ${im.error}</span>` : html`<span class="muted small">${im.name}${im.note ? ' · ' + im.note : ''}</span>`}
          <label class="vh" for=${'ip' + im.id}>Purpose of image ${k + 1}</label>
          <select id=${'ip' + im.id} class=${im.purpose ? '' : 'need'} value=${im.purpose} onChange=${e => { im.purpose = e.target.value; upd(); }}>
            <option value="">Choose a purpose (required)…</option>${Object.entries(IMG_PURPOSE).map(([v, l]) => html`<option value=${v}>${l}</option>`)}</select></div>
        <button class="iconbtn" aria-label=${`Remove image ${k + 1}`} onClick=${() => { if (im.asset && !f.isNew) (it.removedImages = it.removedImages || []).push(im.id); it.images.splice(k, 1); upd(); }}><${Icon} n="x" /></button></div>`)}
    </div>
    ${it.isNew && html`<details class="more"><summary>Manager note, attention flag and early work (optional)</summary>
      ${T(it, 'mgrNote', 'Manager note', { area: true })}
      <label class="check"><input type="checkbox" checked=${it.attnOn} onChange=${e => { it.attnOn = e.target.checked; upd(); }} /> Needs Attention</label>
      ${it.attnOn && T(it, 'attnReason', 'Reason')}
      <div class="fld"><span>Plan early work (pickup day is the default)</span>
        <div class="frow"><input type="date" aria-label="Advance work date" value=${it.plan?.date || ''} onInput=${e => { it.plan = e.target.value ? { date: e.target.value, milestone: it.plan?.milestone || 2 } : null; upd(); }} />
          ${it.plan && html`<div class="seg">${MILESTONES.map(m => html`<button class=${'segb' + (it.plan.milestone === m ? ' on' : '')} onClick=${() => { it.plan.milestone = m; upd(); }}>${STAGES[m]}</button>`)}</div>`}</div>
        ${it.plan && f.pickupDate && it.plan.date > f.pickupDate && html`<p class="warnli">That day is after the pickup date.</p>`}</div>
    </details>`}
  </fieldset>`;
}
function ReviewDialog() {
  const f = UI.form; if (!f) return null;
  const missing = missingForConfirm(f); const dep = f.isNew ? parseMoney(f.deposit.amount) : null; const TT = formTotals(f); const tot = TT.totalCents;
  const isDraft = f.isNew || f.booking === 'draft';
  return html`<${Modal} title=${isDraft ? 'Review order before confirming' : 'Review changes'} wide>
    <div class="review">
      <div class="rv-when"><span class="muted xs">PICKUP</span><b>${f.pickupDate ? fmtDateLong(f.pickupDate) : 'No date yet'}</b><b>${f.pickupTime ? fmtTime(f.pickupTime) : 'No time yet'}</b></div>
      <p><b>${f.customer.name || '(no name)'}</b> · ${fmtPhone(f.customer.phone) || 'no phone'}${f.customer.email ? ' · ' + f.customer.email : ''} · taken by ${f.takenBy || html`<span class="badtxt">no name</span>`}</p>
      ${f.items.map((it, i) => { const p = TT.ps[i]; const sp = p.spec; return html`<div class="rv-item"><h3>Item ${suffixFor(i)}: ${specBrief(sp) || 'not described yet'} — ${fmtMoney(p.finalCents)}${!p.calc.complete && p.source === 'calc' ? ' (not final)' : ''}</h3>
        ${sp.typeKey === 'tier' && sp.tiers.length > 1 && html`<ul>${sp.tiers.map((t, k) => html`<li>Tier ${k + 1} · ${t.size}: Flavor: ${flavorLong(t) || '—'} · Filling: ${fillingLong(t) || '—'}</li>`)}</ul>`}
        ${sp.typeKey !== 'tier' && fillModeOf(sp) === 'half' && html`<p><b>Filling split in half:</b> ${sp.filling} / ${sp.filling2}</p>`}
        ${sp.shapeDesc && html`<p>Shape: ${sp.shapeDesc}</p>`}
        ${sp.picturePhone && html`<p>Picture contact: ${fmtPhone(sp.picturePhone)}</p>`}
        <p class="rv-insc">${it.noInscription ? html`<b>NO INSCRIPTION</b>` : it.inscription ? html`Inscription: <b>“${it.inscription}”</b>${it.inscriptionColor ? ` in ${it.inscriptionColor}` : ''}` : html`<span class="badtxt">Inscription not entered</span>`}</p>
        ${(it.colors || it.decoration) && html`<p>${[it.colors && 'Colors: ' + it.colors, it.decoration && 'Theme: ' + it.decoration].filter(Boolean).join(' · ')}</p>`}
        ${it.newRequest && html`<p>Customer request: ${it.newRequest}</p>`}
        ${it.images.length > 0 && html`<p>${it.images.length} image(s): ${it.images.map(im => IMG_PURPOSE[im.purpose] || 'purpose not set').join('; ')}</p>`}
        ${sp.extras.length > 0 && html`<p>Extras: ${sp.extras.map(x => x.desc + (x.cents ? ` (${fmtMoney(x.cents)})` : '')).join(', ')}</p>`}
        ${it.newProd && html`<p>Production note: ${it.newProd}</p>`}
        ${it.plan && it.plan.date && html`<p>Early work: ${STAGES[it.plan.milestone]} on ${fmtDateMed(it.plan.date)}</p>`}</div>`; })}
      <p>Order total: <b>${tot === null ? 'not set' : fmtMoney(tot)}</b>${f.totalOverride.on || f.items.some(x => x.override.on) ? ' (includes a price override)' : ''}${dep ? ` · Deposit now: ${fmtMoney(dep)} ${f.deposit.method}` : ''}${tot && dep && !Number.isNaN(dep) ? ` · Balance after deposit: ${fmtMoney(tot - dep)}` : ''}</p>
      ${!TT.complete && html`<p class="warnli small">Price not final: part of this order still needs a price. It will be flagged until a price is entered.</p>`}
    </div>
    ${missing.length > 0 && html`<div class="callout warn"><b>Needed before confirming:</b><ul>${missing.map(m => html`<li>${m}</li>`)}</ul>${isDraft ? 'You can save it as a draft now and finish later.' : ''}</div>`}
    ${f.err && html`<div class="callout bad">${f.err}</div>`}
    <div class="dlgact"><button class="btn ghost" onClick=${closeDialog}>Back to editing</button>
      ${isDraft && html`<button class="btn" disabled=${f.saving} onClick=${() => doSave('draft')}>Save as draft</button>`}
      <button class="btn primary" disabled=${f.saving || missing.length > 0} onClick=${() => doSave('confirm')}>${f.saving ? 'Saving…' : isDraft ? 'Confirm order' : 'Save changes'}</button></div></${Modal}>`;
}

function ConflictDialog() {
  const f = UI.form;
  return html`<${Modal} title="Edited on another device">
    <p>Someone changed order #${f && f.num} on another device after you opened it here. Saving now would replace their changes.</p>
    <div class="menu">
      <button class="btn big" onClick=${() => { const o = getOrder(f.id); if (o) { UI.form = formFromOrder(o); } closeDialog(); toast('Loaded the latest version. Make your changes again.'); }}>Load their version (my unsaved changes are dropped)</button>
      <button class="btn big danger" onClick=${() => { f.force = true; doSave(f.lastMode || 'draft'); }}>Save my version anyway (replaces their changes)</button>
      <button class="btn big ghost" onClick=${closeDialog}>Keep editing</button></div></${Modal}>`;
}

/* ---------- Schedule ---------- */
function weekStartTue(d) { const wd = weekday(d); if (wd === 1) return addDays(d, 1); if (wd === 0) return addDays(d, -5); return addDays(d, -(wd - 2)); }
function buildIndex() {
  const idx = {}; const get = d => idx[d] || (idx[d] = { pick: [], prepG: [], orders: 0, items: 0, unfinished: 0, prep: 0, odd: false });
  for (const o of confirmedOrders()) {
    const its = itemsOf(o); const e = get(o.pickupDate);
    e.pick.push({ o, items: its }); e.orders++; e.items += its.length;
    e.unfinished += its.filter(i => !isCollected(i) && (i.stage || 0) < 4).length;
    if (isClosedDay(Store.calendar, o.pickupDate)) e.odd = true;
    const byDay = {};
    for (const it of its) if (it.plan && !isCollected(it) && it.plan.date !== o.pickupDate) { get(it.plan.date).prep++; (byDay[it.plan.date] = byDay[it.plan.date] || []).push(it); }
    for (const [d, list] of Object.entries(byDay)) get(d).prepG.push({ o, items: list });
  }
  for (const e of Object.values(idx)) { e.pick.sort(byTime); e.prepG.sort(byTime); }
  return idx;
}
function ScheduleScreen() {
  const v = UI.schedView; const idx = buildIndex();
  return html`<div class="screen sched">
    <div class="dayhead"><h1>Schedule</h1>
      <div class="seg" role="group" aria-label="View">${[['week', 'This week (Tue–Sun)'], ['month', 'Month'], ['future', 'Future orders'], ['extras', 'Extras']].map(([k, l]) => html`<button class=${'segb' + (v === k ? ' on' : '')} aria-pressed=${v === k} onClick=${() => ui({ schedView: k })}>${l}</button>`)}</div></div>
    ${v === 'week' && html`<${WeekView} idx=${idx} />`}${v === 'month' && html`<${MonthView} idx=${idx} />`}${v === 'future' && html`<${FutureView} idx=${idx} />`}${v === 'extras' && html`<${ExtrasView} />`}
  </div>`;
}
function DayLoad({ e }) {
  if (!e || !e.items) return html`<span class="muted">No pickups</span>`;
  return html`<span><b>${e.orders}</b> ${e.orders === 1 ? 'order' : 'orders'} · <b>${e.items}</b> ${e.items === 1 ? 'item' : 'items'}${e.unfinished ? html` · <span class="warntxt">${e.unfinished} unfinished</span>` : ''}</span>`;
}
function WeekView({ idx }) {
  const start = weekStartTue(UI.schedAnchor); const days = [0, 1, 2, 3, 4, 5, 6].map(n => addDays(start, n));
  const today = todayNY();
  return html`<div class="weeknav"><button class="iconbtn" aria-label="Previous week" onClick=${() => ui({ schedAnchor: addDays(start, -7) })}><${Icon} n="left" /></button>
      <b>${fmtDateMed(days[0])} – ${fmtDateMed(days[5])}</b><button class="btn sm" onClick=${() => ui({ schedAnchor: today })}>This week</button>
      <button class="iconbtn" aria-label="Next week" onClick=${() => ui({ schedAnchor: addDays(start, 7) })}><${Icon} n="right" /></button></div>
    <p class="muted small">Tick items to plan early work for them, then choose “Plan early work…” below. Blue tags show work already planned ahead; green means it’s done. Tap a day to open its full list.</p>
    <div class="weekdays">${days.map(d => {
      const e = idx[d]; const closed = isClosedDay(Store.calendar, d); const ex = Store.calendar.exceptions[d];
      const groups = e ? e.pick : []; const shown = groups.slice(0, 6);
      const rest = groups.slice(6).reduce((s, g) => s + g.items.length, 0);
      return html`<section class=${'wday' + (d === today ? ' today' : '') + (closed ? ' closed' : '')} aria-label=${fmtDateLong(d)}>
        <div class="wdhead"><button class="link h" onClick=${() => goDay(d)}>${fmtDateMed(d)}${d === today ? ' · Today' : ''}</button>
          <span class="wdtags">${closed && html`<span class="tag">Closed${ex ? ' (exception)' : ''}</span>`}${!closed && ex && html`<span class="tag">Open by exception</span>`}${e && e.odd && closed && html`<span class="flag bad">Pickups on a closed day</span>`}</span>
          <span class="wdload"><${DayLoad} e=${e} />${e && e.prep ? html` · ${e.prep} advance-prep` : ''}</span></div>
        ${shown.length > 0 && html`<div class="rows compact">${shown.map(g => html`<${OrderGroup} key=${g.o.id} o=${g.o} items=${g.items} ctx=${{ mode: 'pickup', day: d, week: true }} />`)}</div>`}
        ${e && e.prepG.length > 0 && html`<div class="wprep"><div class="wprh"><${Icon} n="cal" s=${15} /> Early work planned this day for later pickups (${e.prep})</div>
          <div class="rows compact">${e.prepG.slice(0, 4).map(g => html`<${OrderGroup} key=${'p' + g.o.id} o=${g.o} items=${g.items} ctx=${{ mode: 'prep', day: d, week: true }} />`)}</div>
          ${e.prepG.length > 4 && html`<span class="muted small">+${e.prepG.slice(4).reduce((a, g) => a + g.items.length, 0)} more early-work items · open the day to see them all</span>`}</div>`}
        <div class="wdfoot">${rest > 0 && html`<span class="muted">+${rest} more items</span>`}<button class="btn sm" onClick=${() => goDay(d)}>Open ${DAY_SHORT[weekday(d)]}</button></div>
      </section>`;
    })}</div>`;
}
function MonthView({ idx }) {
  const mk = monthKey(UI.schedAnchor); const first = mk + '-01';
  const lead = (weekday(first) + 5) % 7; // Tue-first columns
  const dim = daysBetween(first, addDays((() => { const [y, m] = mk.split('-').map(Number); return `${m === 12 ? y + 1 : y}-${pad2(m === 12 ? 1 : m + 1)}-01`; })(), 0));
  const cells = []; for (let i = 0; i < lead; i++) cells.push(null); for (let i = 0; i < dim; i++) cells.push(addDays(first, i));
  const today = todayNY();
  const shift = n => { const [y, m] = mk.split('-').map(Number); const t = new Date(Date.UTC(y, m - 1 + n, 1)); ui({ schedAnchor: `${t.getUTCFullYear()}-${pad2(t.getUTCMonth() + 1)}-01` }); };
  return html`<div class="weeknav"><button class="iconbtn" aria-label="Previous month" onClick=${() => shift(-1)}><${Icon} n="left" /></button><b>${fmtMonth(mk)}</b>
      <button class="btn sm" onClick=${() => ui({ schedAnchor: today })}>This month</button><button class="iconbtn" aria-label="Next month" onClick=${() => shift(1)}><${Icon} n="right" /></button></div>
    <div class="month" role="grid">${['Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Mon'].map(d => html`<div class="mhd" role="columnheader">${d}</div>`)}
      ${cells.map(d => d ? (() => { const e = idx[d]; const closed = isClosedDay(Store.calendar, d); return html`<button class=${'mcell' + (d === today ? ' today' : '') + (closed ? ' closed' : '') + (e && e.items ? ' has' : '')} onClick=${() => goDay(d)} aria-label=${`${fmtDateLong(d)}: ${e ? e.items : 0} items`}>
        <span class="mnum">${+d.slice(8)}</span>${e && e.items ? html`<span class="mitems">${e.items}<small> ${e.items === 1 ? 'item' : 'items'}</small></span><span class="mord">${e.orders} ord${e.unfinished && d <= addDays(today, 1) ? html` · <span class="warntxt">${e.unfinished} left</span>` : ''}</span>` : closed ? html`<span class="muted xs">Closed</span>` : ''}
        ${e && e.prep ? html`<span class="mprep">${e.prep} prep</span>` : ''}${e && e.odd && closed ? html`<span class="flag bad xs">closed day</span>` : ''}</button>`; })() : html`<span class="mcell empty"></span>`)}</div>`;
}
function FutureView({ idx }) {
  const today = todayNY(); const [y, m] = monthKey(today).split('-').map(Number);
  const endMonth = addDays(`${m === 12 ? y + 1 : y}-${pad2(m === 12 ? 1 : m + 1)}-01`, -1);
  const dates = Object.keys(idx).filter(d => d > endMonth && idx[d].items).sort();
  const months = {}; for (const d of dates) (months[monthKey(d)] = months[monthKey(d)] || []).push(d);
  if (!dates.length) return html`<div class="empty">No confirmed orders after ${fmtDateMed(endMonth)} yet.</div>`;
  return html`<p class="muted small">Orders picked up after this month, like the binder’s “future orders” section.</p>${Object.entries(months).map(([mk, ds]) => html`<section class="sec"><h2>${fmtMonth(mk)} <span class="secn">${ds.reduce((s, d) => s + idx[d].items, 0)} items</span></h2>
    ${ds.map(d => html`<div class="fday"><button class="link h" onClick=${() => goDay(d)}>${fmtDateMed(d)}</button> <${DayLoad} e=${idx[d]} />
      <div class="rows compact">${idx[d].pick.map(g => html`<${OrderGroup} key=${g.o.id} o=${g.o} items=${g.items} ctx=${{ mode: 'pickup', day: d }} />`)}</div></div>`)}</section>`)}`;
}

function ExtrasView() {
  const today = todayNY(); const days = UI.extrasDays || 14; const to = addDays(today, days);
  const rows = extrasRows(today, to);
  const byDate = {}; for (const r of rows) (byDate[r.o.pickupDate] = byDate[r.o.pickupDate] || []).push(r);
  return html`<div class="weeknav"><b>Extras on upcoming pickups</b>
      <div class="seg" role="group" aria-label="Range">${[[7, 'Next 7 days'], [14, '14 days'], [30, '30 days'], [90, '90 days']].map(([n, l]) => html`<button class=${'segb' + (days === n ? ' on' : '')} aria-pressed=${days === n} onClick=${() => ui({ extrasDays: n })}>${l}</button>`)}</div>
      <button class="btn primary sm" disabled=${!rows.length} onClick=${() => openPrint([], `${fmtDateMed(today)} to ${fmtDateMed(to)}`, 'extras', { from: today, to })}><${Icon} n="print" s=${16} />Print list</button></div>
    <p class="muted small">Every extra on orders picked up ${fmtDateMed(today)} – ${fmtDateMed(to)}, not yet picked up. Print it at the start of the week to check what’s on hand and what still needs ordering.</p>
    ${!rows.length ? html`<div class="empty">No extras on pickups in this range.</div>` : Object.entries(byDate).map(([d, list]) => html`<section class="sec"><h2>${fmtDateLong(d)} <span class="secn">${list.length} ${list.length === 1 ? 'extra' : 'extras'}</span></h2>
      <div class="rows compact">${list.map(({ o, it, x }) => html`<div class="row xrow" onClick=${() => openDetail(o.id, it.id)}>
        <span class="ptime">${fmtTime(o.pickupTime)}</span><span class="who"><b>${itemLabel(o, it)}</b> ${o.customer?.name}</span>
        <span class="spec"><b>${x.desc}</b>${x.cents ? html` <span class="muted">· ${fmtMoney(x.cents)}</span>` : ''}<br /><span class="muted small">${shortCake(it)}</span></span></div>`)}</div></section>`)}`;
}

/* ---------- Search ---------- */
function orderStatusKey(o) {
  if (o.booking === 'draft') return 'draft'; if (o.booking === 'canceled') return 'canceled';
  if (orderClosed(o)) return 'collected';
  const its = itemsOf(o); if (its.length && its.every(i => (i.stage || 0) === 4 || isCollected(i))) return 'ready';
  return 'active';
}
const STATUS_LABEL = { any: 'Any status', draft: 'Drafts', active: 'Confirmed, in progress', ready: 'Ready, not collected', collected: 'Collected', canceled: 'Canceled' };
function SearchScreen() {
  const S = UI.search; const cutoff = addDays(todayNY(), -21);
  const set = p => { UI.search = { ...UI.search, ...p }; emit(); };
  useEffect(() => {
    if (!(S.from && S.from < cutoff) || !Store.db) { if (S.archived) set({ archived: null }); return; }
    let live = true; set({ loading: true, err: null });
    loadArchive(S.from, S.to < cutoff ? S.to : cutoff).then(a => live && set({ archived: a, loading: false })).catch(e => live && set({ loading: false, err: errText(e) }));
    return () => { live = false; };
  }, [S.from, S.to, S.retry]);
  const demo = Store.mode === 'demo';
  const pool = [...visibleOrders(), ...(S.archived || []).filter(o => !!o.demo === demo && !Store.orders.has(o.id))];
  const res = pool.filter(o => (!S.from || (o.pickupDate || '9999') >= S.from) && (!S.to || (o.pickupDate || '0000') <= S.to)
    && (S.status === 'any' || orderStatusKey(o) === S.status) && matchesQuery(o, S.q))
    .sort((a, b) => (b.pickupDate || '').localeCompare(a.pickupDate || '') || (b.pickupTime || '').localeCompare(a.pickupTime || ''));
  const [lim, setLim] = useState(80);
  return html`<div class="screen search"><h1>Search orders</h1>
    <div class="sform">
      <div class="searchbox big"><${Icon} n="search" /><label class="vh" for="sq">Search</label><input id="sq" type="search" value=${S.q} placeholder="Name, phone digits, order #, inscription, theme" onInput=${e => set({ q: e.target.value })} /></div>
      <div class="frow">
        <label class="fld"><span>Pickup from</span><input type="date" value=${S.from} onChange=${e => set({ from: e.target.value })} /></label>
        <label class="fld"><span>to</span><input type="date" value=${S.to} onChange=${e => set({ to: e.target.value })} /></label>
        <label class="fld"><span>Status</span><select value=${S.status} onChange=${e => set({ status: e.target.value })}>${Object.entries(STATUS_LABEL).map(([k, l]) => html`<option value=${k}>${l}</option>`)}</select></label>
      </div>
      <div class="quick">${[['Last 90 days + upcoming', -90], ['Past year', -365], ['Past 3 years', -1095]].map(([l, n]) => html`<button class="chip sm" onClick=${() => set({ from: addDays(todayNY(), n), to: addDays(todayNY(), 730) })}>${l}</button>`)}</div>
    </div>
    ${S.loading && html`<p class="muted">Loading archived orders…</p>`}
    ${S.err && html`<div class="callout bad">Archived orders could not be loaded: ${S.err} <button class="btn sm" onClick=${() => set({ retry: (S.retry || 0) + 1 })}>Try again</button></div>`}
    <div class="inline"><p class="muted small">${res.length} ${res.length === 1 ? 'order' : 'orders'} found${S.from < cutoff ? ' (includes archived orders older than three weeks)' : ''}.</p>
      ${res.length > 0 && html`<button class="btn sm" onClick=${() => saveBackup(res, 'search-results')}><${Icon} n="list" s=${16} />Download these ${res.length} as a spreadsheet</button>`}</div>
    <div class="rows sres">${res.slice(0, lim).map(o => { const its = itemsOf(o); const sk = orderStatusKey(o);
      return html`<div class="row srow" key=${o.id} onClick=${() => openDetail(o.id, its[0]?.id, o.archived ? { archived: o } : {})}>
        <span class="ptime"><small>${fmtDateMed(o.pickupDate)}</small>${fmtTime(o.pickupTime)}</span>
        <span class="who"><b>${orderLabel(o)}</b> ${o.customer?.name || '(no name)'} <span class="muted small">${fmtPhone(o.customer?.phone)}</span>${o.demo ? html` <span class="tag demo">Practice</span>` : ''}</span>
        <span class="spec">${its.length ? specBrief(its[0]) : 'No items'}${its.length > 1 ? ` + ${its.length - 1} more` : ''}${its[0]?.inscription ? html` <span class="insc-s">“${its[0].inscription}”</span>` : ''}</span>
        <span class="stg"><span class=${'tag st-' + sk}>${STATUS_LABEL[sk]}</span></span>
        <span class=${'paytag ' + payState(o).key}>${payState(o).label}</span>
        <button class="btn sm" onClick=${e => { e.stopPropagation(); openDialog({ type: 'repeat', order: o }); }}>Repeat</button></div>`; })}</div>
    ${res.length > lim && html`<button class="btn wide" onClick=${() => setLim(lim + 80)}>Show more (${res.length - lim} more)</button>`}
    ${!res.length && html`<div class="empty">No orders match. Widen the dates or clear the status filter.</div>`}
  </div>`;
}

/* ---------- Options ---------- */
function PresetEditor({ list, title }) {
  const [rows, setRows] = useState(null); const [add, setAdd] = useState(''); const [busy, run] = useBusy();
  const cur = rows || (Store.presets[list] || []).map(p => ({ ...p }));
  const ch = r => setRows([...r]);
  const dirty = rows !== null;
  return html`<div class="box2 pe"><h3 class="ih">${title}</h3>
    <ul class="pelist">${cur.map((p, i) => html`<li class=${p.retired ? 'retired' : ''}>
      <label class="vh" for=${'pe' + list + p.id}>Option name</label>
      <span class=${'pein' + (p.example ? ' hasex' : '')}><input id=${'pe' + list + p.id} value=${p.label} onInput=${e => { p.label = e.target.value; p.example = false; ch(cur); }} />
      ${p.example && html`<span class="tag ex" title="Placeholder — replace with Pinho’s real option">Example</span>`}${p.retired && html`<span class="tag">Retired</span>`}</span>
      <button class="iconbtn sm" aria-label="Move up" disabled=${i === 0} onClick=${() => { [cur[i - 1], cur[i]] = [cur[i], cur[i - 1]]; ch(cur); }}>▲</button>
      <button class="iconbtn sm" aria-label="Move down" disabled=${i === cur.length - 1} onClick=${() => { [cur[i + 1], cur[i]] = [cur[i], cur[i + 1]]; ch(cur); }}>▼</button>
      <button class="btn sm ghost" onClick=${() => { p.retired = !p.retired; ch(cur); }}>${p.retired ? 'Restore' : 'Retire'}</button></li>`)}</ul>
    <div class="inline"><label class="vh" for=${'add' + list}>New option</label><input id=${'add' + list} value=${add} placeholder="Add an option" onInput=${e => setAdd(e.target.value)} />
      <button class="btn sm" disabled=${!add.trim()} onClick=${() => { cur.push({ id: uid(6), label: add.trim() }); setAdd(''); ch(cur); }}>Add</button></div>
    ${dirty && html`<div class="inline"><button class="btn primary sm" disabled=${busy || cur.some(p => !p.label.trim())} onClick=${() => run(async () => { try { await savePresets({ ...Store.presets, [list]: cur.map(p => ({ ...p, label: p.label.trim() })) }); setRows(null); toast(`${title} saved.`); } catch (e) { if (e.code === 'conflict') { setRows(null); } throw e; } })}>${busy ? 'Saving…' : 'Save changes'}</button><button class="btn sm ghost" onClick=${() => setRows(null)}>Undo changes</button></div>`}
  </div>`;
}
function OptionsScreen() {
  const [cal, setCal] = useState(null); const [busy, run] = useBusy(); const [exd, setExd] = useState(''); const [exOpen, setExOpen] = useState(true); const [exNote, setExNote] = useState('');
  const [dev, setDev] = useState(lsGet('pb.devname', '')); const [usage, setUsage] = useState(null); const [delAsk, setDelAsk] = useState(false);
  const c = cal || { closedWeekdays: [...Store.calendar.closedWeekdays], exceptions: { ...Store.calendar.exceptions } };
  const demoCount = [...Store.orders.values()].filter(o => o.demo).length;
  useEffect(() => { Store.assets && Store.assets.list && Store.assets.list().then(r => setUsage(r.usage)).catch(() => { }); }, []);
  return html`<div class="screen options"><h1>Menu, prices & settings</h1>
    ${window.__cloud && html`<${PrinterSettings} />`}
    <section class="sec"><h2>Backup</h2><div class="box2">
      <p>Download a spreadsheet of orders (customer, phone, pickup, cake details, inscription, prices, balance) so you can keep working from paper if the site is ever unavailable. Photos are not included.</p>
      <div class="inline"><button class="btn primary" onClick=${() => openDialog({ type: 'backup' })}><${Icon} n="list" />Download backup…</button><span class="muted small">Tip: download one every week and before busy weekends.</span></div></div></section>
    <${MenuEditor} />
    <section class="sec"><h2>Business days</h2>
      <div class="box2"><p>Closed every week:</p><div class="chips">${DAY_NAMES.map((n, i) => html`<label class=${'chip' + (c.closedWeekdays.includes(i) ? ' on' : '')}><input type="checkbox" class="vh" checked=${c.closedWeekdays.includes(i)} onChange=${e => { const s = new Set(c.closedWeekdays); e.target.checked ? s.add(i) : s.delete(i); setCal({ ...c, closedWeekdays: [...s].sort() }); }} />${n}</label>`)}</div>
        <h4>Exceptions</h4>
        ${Object.keys(c.exceptions).length ? html`<ul class="exl">${Object.entries(c.exceptions).sort().map(([d, x]) => html`<li><b>${fmtDateLong(d)}</b> — ${x.open ? 'Open' : 'Closed'}${x.note ? ` (${x.note})` : ''} <button class="btn sm ghost" onClick=${() => { const e = { ...c.exceptions }; delete e[d]; setCal({ ...c, exceptions: e }); }}>Remove</button></li>`)}</ul>` : html`<p class="muted">No exceptions.</p>`}
        <div class="frow"><label class="fld"><span>Date</span><input type="date" value=${exd} onInput=${e => setExd(e.target.value)} /></label>
          <div class="fld"><span>That day is</span><div class="seg"><button class=${'segb' + (exOpen ? ' on' : '')} onClick=${() => setExOpen(true)}>Open</button><button class=${'segb' + (!exOpen ? ' on' : '')} onClick=${() => setExOpen(false)}>Closed</button></div></div>
          <label class="fld"><span>Note</span><input value=${exNote} onInput=${e => setExNote(e.target.value)} placeholder="e.g. Christmas week" /></label>
          <button class="btn" disabled=${!exd} onClick=${() => { setCal({ ...c, exceptions: { ...c.exceptions, [exd]: { open: exOpen, note: exNote.trim() } } }); setExd(''); setExNote(''); }}>Add exception</button></div>
        ${!Store.canEdit && html`<p class="muted small">Only the owner and people with edit access can change business days.</p>`}
        ${cal && Store.canEdit && html`<div class="inline"><button class="btn primary" disabled=${busy} onClick=${() => run(async () => { await saveCalendar(c); setCal(null); toast('Business days saved.'); })}>Save business days</button><button class="btn ghost" onClick=${() => setCal(null)}>Undo changes</button></div>`}</div></section>
    <section class="sec"><h2>This device</h2><div class="box2">
      <label class="fld"><span>Device name (shown in change history)</span><div class="inline"><input value=${dev} onInput=${e => setDev(e.target.value)} placeholder="e.g. Front counter iPad" /><button class="btn" onClick=${() => { lsSet('pb.devname', dev.trim()); toast('Device name saved on this device.'); emit(); }}>Save</button></div>
        <small class="muted">The shared sign-in can’t tell employees apart, so history records the device, not the person.</small></label>
      <div class="fld"><span>Which orders this device shows</span><div class="seg">
        <button class=${'segb' + (Store.mode === 'live' ? ' on' : '')} aria-pressed=${Store.mode === 'live'} onClick=${() => setMode('live')}>Live orders</button>
        <button class=${'segb' + (Store.mode === 'demo' ? ' on' : '')} aria-pressed=${Store.mode === 'demo'} onClick=${() => setMode('demo')}>Practice orders</button></div>
        <small class="muted">Practice orders are fictional and kept apart from live orders and counts. New orders entered in practice mode are practice orders.</small></div>
    </div></section>
    <section class="sec"><h2>Practice orders</h2><div class="box2">
      <p>${demoCount} practice ${demoCount === 1 ? 'order is' : 'orders are'} in the list${Store.demoAnchor ? `, set up around ${fmtDateLong(Store.demoAnchor)}` : ''}.</p>
      <p><button class="btn" onClick=${() => openDialog({ type: 'demoReset' })}>Refresh practice orders for today</button> <span class="muted small">Replaces all practice orders with a fresh set built around today. Live orders are never touched.</span></p>
      ${!delAsk ? html`<button class="btn danger ghost" disabled=${!demoCount} onClick=${() => setDelAsk(true)}>Delete all practice orders…</button>`
      : html`<div class="callout warn">Delete every practice order permanently? Live orders are not touched. <button class="btn danger sm" disabled=${busy} onClick=${() => run(async () => { const n = await deleteDemoOrders(); setDelAsk(false); setMode('live'); toast(`${n} practice orders deleted.`); })}>Delete practice orders</button> <button class="btn sm ghost" onClick=${() => setDelAsk(false)}>Keep them</button></div>`}
    </div></section>
    <section class="sec"><h2>Sign-in, storage and printing</h2><div class="box2 prose">
      <p>Orders live in this site’s private shared database, not in the browser. Every device signed in to the bakery’s authorized Claude account sees the same records. Other people cannot open the site unless the owner shares it with them, and only accounts with edit access can make changes or upload photos.</p>
      <p>Collected and canceled orders older than three weeks move to an archive automatically. They stay searchable from Search. Images are kept in the site’s file storage${usage ? ` (${(usage.bytes / 1048576).toFixed(1)} MB of ${(usage.maxBytes / 1048576).toFixed(0)} MB used, ${usage.files} files)` : ''}.</p>
      <p>Slips print through a PDF: “Save PDF to print” creates a Letter-size file with four slips per page. Open it and print at Actual size / 100%.</p>
    </div></section>
  </div>`;
}

/* ---------- receipt printer settings (Cloudflare version) ---------- */
function PrinterSettings() {
  const [st, setSt] = useState(window.__printerInfo || null); const R = useReceiptPrint();
  useEffect(() => { let live = true; const f = () => fetch('/api/printer', { credentials: 'same-origin' }).then(r => r.json()).then(x => { if (live) { setSt(x); window.__printerInfo = x; } }).catch(() => { }); f(); const t = setInterval(f, 8000); return () => { live = false; clearInterval(t); }; }, []);
  const copy = async () => { try { await navigator.clipboard.writeText(st.serverUrl); toast('Server URL copied.'); } catch { toast('Select the address and copy it by hand.', 'bad'); } };
  const test = () => R.run([{ kind: 'test', label: 'Test receipt', html: rcTest() }], []);
  return html`<section class="sec"><h2>Receipt printer</h2><div class="box2">
    ${!st ? html`<p class="muted">Checking…</p>` : !st.configured ? html`<p>${st.msg}</p>` : html`
      <div class=${'pstat ' + (st.online ? 'on' : 'off')}><i></i><span>${st.msg}</span></div>
      <div class="fld"><span>Server URL to enter on the printer (CloudPRNT)</span>
        <div class="urlbox"><code>${st.serverUrl}</code><button class="btn sm" onClick=${copy}>Copy</button></div>
        <small class="muted">Keep this address private: anyone who has it can send paper to your printer (they can’t see orders).</small></div>
      <div class="inline"><button class="btn" disabled=${!!R.phase} onClick=${test}><${Icon} n="print" s=${18} />${R.phase ? 'Working…' : 'Print a test receipt'}</button></div>
      <${PrintStatus} R=${R} />`}
  </div></section>`;
}
