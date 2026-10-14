/* ===== ops.js — every change to an order goes through here ===== */
function itemPatch(itemId, fields) { return { items: { [itemId]: fields } }; }
function stageFields(it, to, now) {
  const f = { stage: to, stageAt: now, stageLog: { [uid()]: { from: it.stage || 0, to, at: now, dev: deviceName() } } };
  const times = { [to]: now };
  for (let s = (it.stage || 0) + 1; s < to; s++) if (!(it.stageTimes && it.stageTimes[s])) times[s] = now; // skipped stages count as done
  for (let s = to + 1; s <= 4; s++) if (it.stageTimes && it.stageTimes[s]) times[s] = null; // moved back: later stages no longer done
  f.stageTimes = times;
  return f;
}
/** Apply a list of {orderId,itemId} changes grouped per order. fieldsFn(order,item,now) -> fields|null */
async function applyToItems(refs, fieldsFn, histFn) {
  const now = Date.now(); const byOrder = new Map(); const applied = [];
  for (const r of refs) {
    const o = getOrder(r.orderId); if (!o) continue; const it = o.items && o.items[r.itemId]; if (!it) continue;
    const item = { ...it, id: r.itemId };
    const f = fieldsFn(o, item, now); if (!f) continue;
    const cur = byOrder.get(o.id) || { o, patch: { items: {} }, labels: [] };
    cur.patch.items[r.itemId] = deepMerge(cur.patch.items[r.itemId] || {}, f);
    cur.labels.push(item.suffix); byOrder.set(o.id, cur);
    applied.push({ orderId: o.id, itemId: r.itemId, before: item, now });
  }
  const errors = [];
  for (const { o, patch, labels } of byOrder.values()) {
    try { await patchOrder(o.id, patch, histFn(o, labels)); }
    catch (e) { errors.push({ o, e }); }
  }
  return { applied: applied.filter(a => !errors.some(x => x.o.id === a.orderId)), errors };
}
function setStage(refs, to) {
  return applyToItems(refs, (o, it, now) => (it.stage || 0) === to ? null : stageFields(it, to, now),
    (o, l) => `Stage set to ${STAGES[to]} (item ${l.join(', ')})`);
}
/** Extra actions chained onto a list update ("Also…"). Returns summary text parts and undo functions. */
async function runChain(refs, al) {
  const parts = [], undos = [], errors = [];
  if (!refs.length || !al) return { parts, undos, errors };
  const any = al.frozen || al.storageOn || al.paid || al.collect;
  if (!any) return { parts, undos, errors };
  await refreshNow(true);
  if (al.frozen) { const r = await setFrozen(refs, true); errors.push(...r.errors); if (r.applied.length) { parts.push(`${r.applied.length} frozen`); undos.push(() => undoBatch('frozen', r.applied, true)); } }
  if (al.storageOn) { const t = (al.storage || '').trim(); const r = await setStorage(refs, t); errors.push(...r.errors); if (r.applied.length) { parts.push(t ? `stored “${t}”` : 'storage cleared'); undos.push(() => undoBatch('storage', r.applied, t)); } }
  if (al.paid) { const r = await payMany(refs.map(x => x.orderId), al.method || 'card'); errors.push(...r.errors); if (r.applied.length) { parts.push(`${r.applied.length} paid (${fmtMoney(r.applied.reduce((a, x) => a + x.amount, 0))})`); undos.push(() => undoPayMany(r.applied)); } }
  if (al.collect) { await refreshNow(true); const r = await collectMany(refs, { note: 'Picked up (chained from list update)' }); errors.push(...r.errors); if (r.applied.length) { parts.push(`${r.applied.length} picked up`); undos.push(() => undoCollectMany(r.applied)); } }
  return { parts, undos, errors };
}
async function undoAll(undos) {
  let reverted = 0, skipped = 0; const rs = [];
  for (const u of [...undos].reverse()) { const r = await u(); rs.unshift(r); skipped += r.skipped || 0; }
  reverted = Math.max(...rs.map(r => r.reverted || 0), 0);
  return { reverted, skipped };
}
/* ----- changed-on-another-device checks ----- */
const CLASH_FIELD = {
  stage: it => it.stage || 0, frozen: it => !!it.frozen, storage: it => it.storage || '', plan: it => it.plan ? it.plan.date + ':' + it.plan.milestone : '',
  collect: it => !!it.collectedAt
};
function clashDesc(kind, it) {
  if (kind === 'stage') return STAGES[it.stage || 0];
  if (kind === 'frozen') return it.frozen ? 'Frozen' : 'Not frozen';
  if (kind === 'storage') return it.storage ? `stored “${it.storage}”` : 'no storage location';
  if (kind === 'plan') return it.plan ? `${STAGE_SHORT[it.plan.milestone]} on ${fmtDateMed(it.plan.date)}` : 'no plan';
  if (kind === 'collect') return it.collectedAt ? `picked up ${fmtTime(nyTimeOf(it.collectedAt))}` : 'not picked up';
  return '';
}
/** Take a snapshot of what this screen shows now, so a later save can tell if another device changed it. */
function seenValues(refs, kind) {
  const m = new Map(); const g = CLASH_FIELD[kind];
  for (const r of refs) { const o = getOrder(r.orderId); const it = o && o.items[r.itemId]; if (it) m.set(r.orderId + '/' + r.itemId, kind === 'paid' ? paidCents(o) : kind === 'cancel' ? o.booking : g(it)); }
  return m;
}
async function findClashes(refs, kind, seen) {
  if (!seen || !seen.size || !Store.db) return [];
  const fresh = await freshOrders(refs.map(r => r.orderId)); const out = [];
  const g = CLASH_FIELD[kind];
  for (const r of refs) {
    const k = r.orderId + '/' + r.itemId; if (!seen.has(k)) continue;
    const o = fresh.get(r.orderId); const it = o && o.items && o.items[r.itemId]; if (!it) continue;
    const now = kind === 'paid' ? paidCents(o) : kind === 'cancel' ? o.booking : g(it);
    if (now !== seen.get(k)) {
      const last = mapList(o.history).sort((a, b) => b.at - a.at)[0];
      out.push({ ...r, label: itemLabel(o, { ...it, id: r.itemId }), now: kind === 'paid' ? `${fmtMoney(now)} paid` : kind === 'cancel' ? now : clashDesc(kind, it), by: last ? `${last.dev}, ${fmtStamp(last.at)}` : '' });
    }
  }
  return out;
}
function setFrozen(refs, on) {
  return applyToItems(refs, (o, it, now) => !!it.frozen === on ? null : ({ frozen: on, frozenAt: now, frozenLog: { [uid()]: { on, at: now, dev: deviceName() } } }),
    (o, l) => `${on ? 'Marked frozen' : 'Marked unfrozen'} (item ${l.join(', ')})`);
}
function setStorage(refs, text) {
  return applyToItems(refs, (o, it, now) => (it.storage || '') === text ? null : ({ storage: text, storageAt: now }),
    (o, l) => text ? `Storage set to "${text}" (item ${l.join(', ')})` : `Storage location cleared (item ${l.join(', ')})`);
}
function setPlan(refs, plan) {
  return applyToItems(refs, (o, it, now) => {
    const same = plan ? (it.plan && it.plan.date === plan.date && it.plan.milestone === plan.milestone) : !it.plan;
    if (same) return null;
    return {
      plan: plan ? { date: plan.date, milestone: plan.milestone, setAt: now, dev: deviceName() } : null,
      planLog: { [uid()]: plan ? { action: it.plan ? 'changed' : 'set', date: plan.date, milestone: plan.milestone, prev: it.plan ? { date: it.plan.date, milestone: it.plan.milestone } : null, at: now, dev: deviceName() } : { action: 'cleared', prev: it.plan ? { date: it.plan.date, milestone: it.plan.milestone } : null, at: now, dev: deviceName() } }
    };
  }, (o, l) => plan ? `Advance work: ${STAGES[plan.milestone]} on ${fmtDateMed(plan.date)} (item ${l.join(', ')})` : `Advance work plan removed (item ${l.join(', ')})`);
}
/** Undo: only revert items whose current value still equals what we applied. */
async function undoBatch(kind, applied, value) {
  let skipped = 0; const refs = [];
  const prev = new Map();
  for (const a of applied) {
    const o = getOrder(a.orderId); const it = o && o.items[a.itemId]; if (!it) { skipped++; continue; }
    let still = false;
    if (kind === 'stage') still = it.stage === value && it.stageAt === a.now;
    if (kind === 'frozen') still = !!it.frozen === value && it.frozenAt === a.now;
    if (kind === 'storage') still = (it.storage || '') === value && it.storageAt === a.now;
    if (kind === 'plan') still = value ? (it.plan && it.plan.setAt === a.now) : !it.plan;
    if (!still) { skipped++; continue; }
    refs.push({ orderId: a.orderId, itemId: a.itemId }); prev.set(a.orderId + '/' + a.itemId, a.before);
  }
  const res = await applyToItems(refs, (o, it, now) => {
    const b = prev.get(o.id + '/' + it.id);
    if (kind === 'stage') {
      const f = stageFields(it, b.stage || 0, now); f.stageAt = b.stageAt || null;
      f.stageTimes = { ...(b.stageTimes || {}) }; for (let s = 0; s <= 4; s++) if (!(s in f.stageTimes)) f.stageTimes[s] = null;
      f.stageLog = { [uid()]: { from: it.stage, to: b.stage || 0, at: now, dev: deviceName(), undo: true } };
      return f;
    }
    if (kind === 'frozen') return { frozen: !!b.frozen, frozenAt: now, frozenLog: { [uid()]: { on: !!b.frozen, at: now, dev: deviceName(), undo: true } } };
    if (kind === 'storage') return { storage: b.storage || '', storageAt: now };
    if (kind === 'plan') return { plan: b.plan || null, planLog: { [uid()]: { action: 'undo', date: b.plan?.date || null, milestone: b.plan?.milestone || null, at: now, dev: deviceName() } } };
  }, (o, l) => `Undo (item ${l.join(', ')})`);
  return { reverted: res.applied.length, skipped, errors: res.errors };
}

/* ----- single-item actions ----- */
const NOTE_KIND = { cust: 'Customer request', prod: 'Production note', mgr: 'Manager note' };
async function addNote(o, it, kind, text) {
  const now = Date.now();
  await patchOrder(o.id, itemPatch(it.id, { notes: { [uid()]: { kind, text, at: now, dev: deviceName() } } }),
    `${NOTE_KIND[kind] || 'Note'} added (item ${it.suffix})`);
}
/* ----- front-of-house batch actions (deliberate overrides allowed) ----- */
async function collectMany(refs, { markReady, note } = {}) {
  const now = Date.now(); const by = new Map();
  for (const r of refs) { const o = getOrder(r.orderId); const it = o && o.items[r.itemId]; if (!it || it.collectedAt) continue; (by.get(o.id) || by.set(o.id, { o, ids: [] }).get(o.id)).ids.push(r.itemId); }
  const applied = [], errors = [];
  for (const { o, ids } of by.values()) {
    const patch = { items: {} }; const notReady = ids.filter(id => (o.items[id].stage || 0) < 4);
    for (const id of ids) { patch.items[id] = { collectedAt: now, collectedDev: deviceName() }; if (markReady && (o.items[id].stage || 0) < 4) Object.assign(patch.items[id], stageFields({ ...o.items[id], id }, 4, now)); }
    const bal = balanceCents(o);
    if (notReady.length || (bal && bal > 0)) patch.collectionNotes = { [uid()]: { override: true, balance: bal > 0 ? bal : 0, notReady: notReady.length > 0, reason: note || 'Marked picked up from the list', at: now, dev: deviceName() } };
    try {
      await patchOrder(o.id, patch, `Picked up: item ${ids.map(id => o.items[id].suffix).join(', ')} (from list)${bal > 0 ? ` — ${fmtMoney(bal)} balance not recorded as paid` : ''}${notReady.length ? ` — ${notReady.length} not marked Ready` : ''}`);
      for (const id of ids) applied.push({ orderId: o.id, itemId: id, now });
    } catch (e) { errors.push({ o, e }); }
  }
  return { applied, errors };
}
async function undoCollectMany(applied) {
  let n = 0, skipped = 0;
  const by = new Map(); for (const a of applied) { const o = getOrder(a.orderId); const it = o && o.items[a.itemId]; if (!it || it.collectedAt !== a.now) { skipped++; continue; } (by.get(o.id) || by.set(o.id, []).get(o.id)).push(a.itemId); }
  for (const [id, ids] of by) { const patch = { items: {} }; for (const i of ids) patch.items[i] = { collectedAt: null }; await patchOrder(id, patch, 'Undo: picked up'); n += ids.length; }
  return { reverted: n, skipped };
}
async function payMany(orderIds, method) {
  const applied = [], errors = [], skipped = [];
  for (const id of [...new Set(orderIds)]) {
    const o = getOrder(id); if (!o) continue; const bal = balanceCents(o);
    if (bal === null) { skipped.push({ o, why: 'no total entered' }); continue; }
    if (bal <= 0) { skipped.push({ o, why: 'already paid' }); continue; }
    const pid = uid();
    try { await addPayment(o, { id: pid, kind: 'payment', amountCents: bal, date: todayNY(), method, ref: '', fromList: true }); applied.push({ orderId: id, payId: pid, amount: bal }); }
    catch (e) { errors.push({ o, e }); }
  }
  return { applied, errors, skipped };
}
async function undoPayMany(applied) {
  let n = 0;
  for (const a of applied) { const o = getOrder(a.orderId); const p = o && o.payments && o.payments[a.payId]; if (!p || p.voided) continue; await voidPayment(o, { ...p, id: a.payId }, 'Undo of “Mark paid”'); n++; }
  return { reverted: n };
}
async function cancelMany(orderIds, reason) {
  const applied = [], errors = []; const now = Date.now();
  for (const id of [...new Set(orderIds)]) {
    const o = getOrder(id); if (!o || o.booking === 'canceled') continue;
    try { await patchOrder(o.id, { booking: 'canceled', canceledAt: now, cancelReason: reason, prevBooking: o.booking }, `Order canceled from list: ${reason}. Payments kept on record; no refund recorded.`); applied.push({ orderId: id, now, prev: o.booking }); }
    catch (e) { errors.push({ o, e }); }
  }
  return { applied, errors };
}
async function undoCancelMany(applied) {
  let n = 0;
  for (const a of applied) { const o = getOrder(a.orderId); if (!o || o.booking !== 'canceled' || o.canceledAt !== a.now) continue; await patchOrder(o.id, { booking: a.prev || 'confirmed', canceledAt: null }, 'Undo: cancel'); n++; }
  return { reverted: n };
}
async function setAttention(o, it, on, reason) {
  await patchOrder(o.id, itemPatch(it.id, { attention: { on, reason: on ? reason : (it.attention?.reason || ''), at: Date.now() } }),
    on ? `Needs Attention: ${reason} (item ${it.suffix})` : `Attention flag cleared (item ${it.suffix})`);
}
async function addPayment(o, pay) {
  // pay.id is generated when the payment form opens, so repeated taps write the same entry.
  await patchOrder(o.id, { payments: { [pay.id]: { kind: pay.kind || 'payment', amountCents: pay.amountCents, date: pay.date, method: pay.method, ref: pay.ref || '', at: Date.now(), dev: deviceName() } } },
    `${pay.kind === 'refund' ? 'Refund recorded' : 'Payment recorded'}: ${fmtMoney(pay.amountCents)} ${pay.method}${pay.ref ? ' (POS ref ' + pay.ref + ')' : ''}`);
}
async function voidPayment(o, p, reason) {
  await patchOrder(o.id, { payments: { [p.id]: { voided: true, voidReason: reason, voidedAt: Date.now() } } },
    `Payment of ${fmtMoney(p.amountCents)} marked as entered in error: ${reason}`);
}
async function collectItems(o, itemIds, ack) {
  const now = Date.now(); const patch = { items: {} };
  for (const id of itemIds) patch.items[id] = { collectedAt: now, collectedDev: deviceName() };
  if (ack) patch.collectionNotes = { [uid()]: { ...ack, at: now, dev: deviceName() } };
  const labels = itemIds.map(id => o.items[id].suffix).join(', ');
  await patchOrder(o.id, patch, `Collected item ${labels}` + (ack && ack.balance ? ` — left with balance ${fmtMoney(ack.balance)}: ${ack.reason}` : '') + (ack && ack.notReady ? ' — handed over before marked Ready' : ''));
}
async function undoCollect(o, it) {
  await patchOrder(o.id, itemPatch(it.id, { collectedAt: null }), `Collection undone (item ${it.suffix})`);
}
async function cancelOrder(o, reason) {
  await patchOrder(o.id, { booking: 'canceled', canceledAt: Date.now(), cancelReason: reason }, `Order canceled: ${reason}. Payments kept on record; no refund recorded.`);
}
async function restoreOrder(o) {
  await patchOrder(o.id, { booking: 'confirmed', canceledAt: null }, `Order restored to Confirmed`);
}
async function markPrinted(slipsItems) {
  const byOrder = new Map(); const now = Date.now();
  for (const { o, it } of slipsItems) {
    const cur = byOrder.get(o.id) || { items: {} };
    cur.items[it.id] = { printedHash: slipHash(o, it), printedAt: now }; byOrder.set(o.id, cur);
  }
  for (const [id, patch] of byOrder) await patchOrder(id, patch, `Slips marked printed (${Object.keys(patch.items).map(k => getOrder(id)?.items[k]?.suffix).join(', ')})`);
}

/* ----- order form -> document ----- */
const blankAddons = () => ({ animated: false, portrait: false, themeOn: false, theme: '', figuresOn: false, figure: '', shaped: false, delivery: '', custom: [], needsQuote: false });
const blankTier = (size = '') => ({ size, flavor: '', flavor2: '', mix: false, filling: '', filling2: '', fillMode: 'same' });
const blankGroup = () => ({ qty: '', flavor: '', filling: '', icing: '' });
function blankItem(pos = 0) {
  return {
    id: uid(), pos, typeKey: '', typeOther: '', sizeKey: '', qty: '', servings: '', flavor: '', flavor2: '', mix: false, filling: '', filling2: '', fillMode: 'same', icing: '', tiers: [],
    groupsOn: false, groups: [], shapeDesc: '', picturePhone: '', newProd: '', prodList: [],
    inscription: '', inscriptionColor: '', noInscription: false, colors: '', decoration: '', newRequest: '', requestsList: [], images: [], extras: [],
    addons: blankAddons(), override: { on: false, amount: '', reason: '' }, priceChoice: 'agreed', agreedCents: null, savedCalcCents: null,
    plan: null, prodNote: '', mgrNote: '', attnOn: false, attnReason: '', isNew: true
  };
}
function blankForm() {
  return {
    v: 2, id: uid(16), num: null, isNew: true, baseEditRev: 0, customer: { name: '', phone: '', email: '' }, takenBy: '',
    pickupDate: '', pickupTime: '', totalOverride: { on: false, amount: '', reason: '' }, items: [blankItem(0)], deposit: { id: uid(), amount: '', method: 'card', ref: '' },
    allowClosed: false, savedAt: null
  };
}
const cin = c => c === null || c === undefined ? '' : centsToInput(c);
function addonsToForm(a) {
  a = a || {};
  return { ...blankAddons(), animated: !!a.animated, portrait: !!a.portrait, themeOn: !!a.themeOn, theme: cin(a.themeCents), figuresOn: !!a.figuresOn, figure: cin(a.figureCents),
    shaped: !!a.shaped, delivery: cin(a.deliveryCents), custom: (a.custom || []).map(c => ({ label: c.label, amount: cin(c.cents) })), needsQuote: !!a.needsQuote };
}
function itemToForm(it, keepIds) {
  const tk = typeKeyOf(it);
  const reqs = mapList(it.notes).filter(n => n.kind === 'cust');
  if (it.requests) reqs.unshift({ id: 'legacy', text: it.requests, at: it.createdAt || null, dev: 'original order' });
  const prods = mapList(it.notes).filter(n => n.kind === 'prod');
  const gs = groupsOf(it);
  return {
    ...blankItem(it.pos), id: keepIds ? it.id : uid(), pos: it.pos, suffix: it.suffix, typeKey: tk, typeOther: tk === 'other' ? (it.type || '') : '', sizeKey: it.sizeKey || '',
    qty: it.qty ?? '', servings: it.servings ?? '', flavor: it.flavor || '', flavor2: it.flavor2 || '', mix: !!it.flavor2, filling: it.filling || '', filling2: it.filling2 || '', fillMode: fillModeOf(it),
    icing: it.icing || '', tiers: (it.tiers || []).map(t => ({ ...blankTier(), ...t, mix: !!t.flavor2, fillMode: fillModeOf(t) })),
    groupsOn: gs.length > 0, groups: gs.map(g => ({ ...blankGroup(), ...g, qty: g.qty ?? '' })), shapeDesc: it.shapeDesc || '', picturePhone: it.picturePhone || '', prodList: prods, inscription: it.inscription || '', inscriptionColor: it.inscriptionColor || '', noInscription: !!it.noInscription,
    colors: it.colors || '', decoration: it.decoration || '', requestsList: reqs, addons: addonsToForm(it.addons),
    override: it.price && it.price.override ? { on: true, amount: cin(it.price.override.cents), reason: it.price.override.reason || '' } : { on: false, amount: '', reason: '' }
  };
}
function formFromOrder(o) {
  const ov = o.pricing && o.pricing.override;
  return {
    v: 2, id: o.id, num: o.num, isNew: false, booking: o.booking, baseEditRev: o.editRev || 0, demo: !!o.demo, takenBy: o.takenBy || '',
    customer: { name: o.customer?.name || '', phone: o.customer?.phone || '', email: o.customer?.email || '' },
    pickupDate: o.pickupDate || '', pickupTime: o.pickupTime || '',
    totalOverride: ov ? { on: true, amount: cin(ov.cents), reason: ov.reason || '' } : { on: false, amount: '', reason: '' },
    savedTotalCents: o.totalCents ?? null,
    items: itemsOf(o).map(it => ({
      ...itemToForm(it, true), images: mapList(it.images).map(i => ({ ...i })), extras: extrasOf(it).map(x => ({ id: x.id, desc: x.desc || '', amount: cin(x.cents) })), isNew: false,
      agreedCents: it.priceCents ?? null, savedCalcCents: it.price ? it.price.calcCents : null, priceChoice: 'agreed'
    })),
    removedItems: [], deposit: { id: uid(), amount: '', method: 'card', ref: '' }, allowClosed: !!(o.pickupDate && isClosedDay(Store.calendar, o.pickupDate))
  };
}
/** Copy an old order's specification for a repeat order. Notes, payments, progress and plans are not copied. */
function formFromRepeat(o, copyImages) {
  const f = blankForm();
  f.customer = { name: o.customer?.name || '', phone: o.customer?.phone || '', email: o.customer?.email || '' };
  f.repeatOf = o.num;
  f.items = itemsOf(o).map((it, i) => {
    const x = itemToForm(it, false);
    x.newRequest = x.requestsList.map(r => r.text).join('\n'); x.requestsList = []; x.prodList = []; x.override = { on: false, amount: '', reason: '' };
    x.images = copyImages ? mapList(it.images).map(im => ({ ...im, id: uid() })) : [];
    x.extras = extrasOf(it).map(e => ({ id: uid(), desc: e.desc || '', amount: cin(e.cents), isNew: true }));
    x.pos = i; x.isNew = true; return x;
  });
  return f;
}
const money = v => { const p = parseMoney(v); return p === null || Number.isNaN(p) ? null : p; };
function addonsFromForm(a) {
  return {
    animated: !!a.animated, portrait: !!a.portrait, themeOn: !!a.themeOn, themeCents: a.themeOn ? (money(a.theme) ?? menu().addons.themeStart) : null,
    figuresOn: !!a.figuresOn, figureCents: a.figuresOn ? money(a.figure) : null, shaped: !!a.shaped, deliveryCents: money(a.delivery),
    custom: (a.custom || []).filter(c => c.label && money(c.amount) !== null).map(c => ({ label: c.label.trim(), cents: money(c.amount) })), needsQuote: !!a.needsQuote
  };
}
function specFromFormItem(it) {
  const num = v => (v === '' || v === null || v === undefined || Number.isNaN(+v)) ? null : +v;
  const tk = it.typeKey; const row = sizeRow(tk, it.sizeKey);
  const fl1 = fl => fl && (flavorOf(fl) || {}).kind;
  const tir = fl1(it.flavor) === 'tiramisu';
  const usesFilling = tk === 'standard' || tk === 'cupcakes' || tk === 'other';
  const twoFill = x => (x.fillMode || 'same') !== 'same';
  const useGroups = (tk === 'cupcakecake' || tk === 'cupcakes') && it.groupsOn && (it.groups || []).length > 0;
  const groups = useGroups ? it.groups.map(g => ({ qty: num(g.qty), flavor: g.flavor || '', filling: tk === 'cupcakes' ? (g.filling || '') : '', icing: g.icing || '' })) : [];
  return {
    typeKey: tk, type: tk === 'other' ? (it.typeOther || 'Custom item') : (PRODUCT_LABEL[tk] || ''), sizeKey: row ? row.key : '', size: row ? row.label : '',
    qty: useGroups ? groups.reduce((a, g) => a + (g.qty || 0), 0) : num(it.qty), servings: num(it.servings) ?? (row && row.serv ? row.serv : null),
    flavor: tk === 'tier' || useGroups ? '' : it.flavor, flavor2: (tk === 'standard' && it.mix) ? it.flavor2 : '',
    filling: useGroups ? '' : usesFilling && !tir ? it.filling : (tir ? 'Tiramisu (fixed recipe)' : ''), filling2: tk === 'standard' && !tir && twoFill(it) ? it.filling2 : '',
    fillMode: tk === 'standard' && !tir && twoFill(it) ? it.fillMode : '', icing: useGroups ? '' : it.icing,
    tiers: tk === 'tier' ? it.tiers.map(t => ({ size: t.size || '', flavor: t.flavor || '', flavor2: t.mix ? (t.flavor2 || '') : '', filling: t.filling || '', filling2: twoFill(t) ? (t.filling2 || '') : '', fillMode: twoFill(t) ? t.fillMode : '' })) : [],
    groups, shapeDesc: tk === 'cupcakecake' && it.addons.shaped ? (it.shapeDesc || '').trim() : '',
    picturePhone: (it.addons.animated || it.addons.portrait) ? (it.picturePhone || '').trim() : '',
    extras: (it.extras || []).filter(x => (x.desc || '').trim()).map(x => ({ id: x.id, desc: x.desc.trim(), cents: money(x.amount) })),
    inscription: it.noInscription ? '' : it.inscription, inscriptionColor: it.noInscription ? '' : (it.inscriptionColor || ''), noInscription: !!it.noInscription,
    colors: it.colors, decoration: it.decoration, addons: addonsFromForm(it.addons), images: it.images
  };
}
/** Price for a form item: { calc, finalCents, source:'calc'|'override'|'agreed', changed } */
function formItemPrice(it) {
  const spec = specFromFormItem(it); const calc = calcItemPrice(spec);
  const ov = it.override && it.override.on ? money(it.override.amount) : null;
  if (it.override && it.override.on) return { spec, calc, finalCents: ov, source: 'override', changed: false };
  const changed = !it.isNew && it.agreedCents !== null && calc.calcCents !== it.savedCalcCents && calc.calcCents !== it.agreedCents;
  if (changed && it.priceChoice !== 'new') return { spec, calc, finalCents: it.agreedCents, source: 'agreed', changed };
  return { spec, calc, finalCents: calc.calcCents, source: 'calc', changed };
}
function formTotals(f) {
  const ps = f.items.map(formItemPrice);
  const sum = ps.every(p => p.finalCents !== null) ? ps.reduce((s, p) => s + p.finalCents, 0) : null;
  const partial = ps.reduce((s, p) => s + (p.finalCents || 0), 0);
  const complete = ps.every(p => p.source === 'override' || p.source === 'agreed' || p.calc.complete);
  const ov = f.totalOverride && f.totalOverride.on ? money(f.totalOverride.amount) : null;
  return { ps, sum, partial, complete, totalCents: f.totalOverride && f.totalOverride.on ? ov : sum };
}
function missingForConfirm(f) {
  const m = [];
  if (!f.customer.name.trim()) m.push('Customer name');
  if (phoneDigits(f.customer.phone).length < 7) m.push('Phone number');
  if (!(f.takenBy || '').trim()) m.push('Order taken by (employee name)');
  if (!f.pickupDate) m.push('Pickup date');
  if (!f.pickupTime) m.push('Pickup time');
  if (f.pickupDate && isClosedDay(Store.calendar, f.pickupDate) && !f.allowClosed) m.push('Pickup date is a closed day — allow it as an exception or pick another day');
  if (!f.items.length) m.push('At least one item');
  const T = formTotals(f);
  f.items.forEach((it, i) => {
    const L = `Item ${suffixFor(i)}`; const tk = it.typeKey; const kind = (flavorOf(it.flavor) || {}).kind;
    if (!tk) m.push(`${L}: product type`);
    if (tk === 'other' && !it.typeOther.trim()) m.push(`${L}: describe the product`);
    if (['standard', 'tier', 'single'].includes(tk) && !it.sizeKey) m.push(`${L}: size`);
    const grp = (tk === 'cupcakecake' || tk === 'cupcakes') && it.groupsOn;
    const two = (x, w) => { if ((x.fillMode || 'same') !== 'same' && !x.filling2) m.push(`${L}: ${w}second filling (${x.fillMode === 'half' ? 'other half' : '2nd layer'})`); if (x.mix && !x.flavor2) m.push(`${L}: ${w}second cake flavor`); };
    if (tk === 'tier') it.tiers.forEach((t, k) => { if (!t.flavor) m.push(`${L}: tier ${k + 1} cake flavor`); two(t, `tier ${k + 1} `); });
    else if (grp) { if (!it.groups.length) m.push(`${L}: add at least one cupcake group`); it.groups.forEach((g, k) => { if (!(+g.qty > 0)) m.push(`${L}: group ${k + 1} count`); if (!g.flavor) m.push(`${L}: group ${k + 1} flavor`); }); }
    else if (tk && tk !== 'other' && !it.flavor) m.push(`${L}: cake flavor`);
    if (tk === 'standard' && kind !== 'tiramisu') { if (!it.filling) m.push(`${L}: filling`); two(it, ''); }
    if ((tk === 'cupcakecake' || tk === 'cupcakes') && !grp && !(+it.qty > 0)) m.push(`${L}: how many cupcakes`);
    if (tk === 'cupcakecake' && it.addons.shaped && !(it.shapeDesc || '').trim()) m.push(`${L}: describe the shape / arrangement`);
    it.extras.forEach((x, k) => { if ((x.desc || '').trim() && Number.isNaN(parseMoney(x.amount))) m.push(`${L}: extra ${k + 1} price is not a valid amount`); });
    if (!it.noInscription && !it.inscription.trim()) m.push(`${L}: inscription (or tick No Inscription)`);
    it.images.forEach((im, k) => { if (!im.purpose) m.push(`${L}: purpose for image ${k + 1}`); if (im.uploading) m.push(`${L}: image ${k + 1} still uploading`); });
    const p = T.ps[i];
    for (const x of p.calc.issues) if (x.level === 'block' && it.typeKey && !(it.override && it.override.on)) m.push(`${L}: ${x.text}`);
    if (it.override && it.override.on) { if (money(it.override.amount) === null) m.push(`${L}: override price amount`); if (!it.override.reason.trim()) m.push(`${L}: reason for the price override`); }
  });
  if (f.totalOverride && f.totalOverride.on) { if (money(f.totalOverride.amount) === null) m.push('Order total override amount'); if (!f.totalOverride.reason.trim()) m.push('Reason for the order total override'); }
  if (f.isNew && Number.isNaN(parseMoney(f.deposit.amount))) m.push('Deposit is not a valid amount');
  return m;
}
/** Save the order form. mode: 'draft' | 'confirm'. Returns the saved order id. */
async function saveOrderForm(f, mode, { force } = {}) {
  const db = Store.db; const ref = db.doc('orders/' + f.id); const now = Date.now();
  const demo = f.isNew ? Store.mode === 'demo' : !!f.demo;
  if (!f.num) f.num = await claimNumber(demo);
  const T = formTotals(f);
  const itemsMap = {};
  f.items.forEach((it, i) => {
    const P = T.ps[i]; const { images: _imgs, extras: _ex, ...spec } = P.spec;
    const base = { ...spec, pos: i, suffix: suffixFor(i), active: true, priceCents: P.finalCents,
      price: { calcCents: P.calc.calcCents, lines: P.calc.lines, complete: P.calc.complete, issues: P.calc.issues, menuRev: Store.menuRev || 0,
        override: P.source === 'override' ? { cents: P.finalCents, reason: it.override.reason.trim(), at: now, dev: deviceName() } : null, keptAgreed: P.source === 'agreed' } };
    const images = {}; it.images.forEach((im, k) => { if (!im.asset) return; images[im.id] = { asset: im.asset, thumb: im.thumb || im.asset, purpose: im.purpose || '', name: im.name || '', note: im.note || '', pos: k, removed: false }; });
    for (const im of it.removedImages || []) images[im] = { removed: true };
    const extras = {}; it.extras.forEach((x, k) => {
      if (!(x.desc || '').trim()) { if (!x.isNew) extras[x.id] = { removed: true, removedAt: now }; return; }
      extras[x.id] = { desc: x.desc.trim(), cents: money(x.amount), pos: k, at: x.at || now };
    });
    for (const xid of it.removedExtras || []) extras[xid] = { removed: true };
    Object.assign(base, { images, extras });
    const notes = {};
    if (it.newRequest && it.newRequest.trim()) notes[uid()] = { kind: 'cust', text: it.newRequest.trim(), at: now, dev: deviceName(), by: (f.takenBy || '').trim() };
    if (it.newProd && it.newProd.trim()) notes[uid()] = { kind: 'prod', text: it.newProd.trim(), at: now, dev: deviceName(), by: (f.takenBy || '').trim() };
    if (it.isNew) {
      Object.assign(base, { stage: 0, stageAt: null, stageTimes: {}, stageLog: {}, frozen: false, storage: '', collectedAt: null, createdAt: now });
      if (it.mgrNote && it.mgrNote.trim()) notes[uid()] = { kind: 'mgr', text: it.mgrNote.trim(), at: now, dev: deviceName() };
      if (it.attnOn) base.attention = { on: true, reason: it.attnReason || 'See notes', at: now };
      if (it.plan && it.plan.date) base.plan = { date: it.plan.date, milestone: it.plan.milestone, setAt: now, dev: deviceName() };
    }
    if (Object.keys(notes).length || it.isNew) base.notes = notes;
    itemsMap[it.id] = base;
  });
  for (const id of f.removedItems || []) itemsMap[id] = { active: false, removedAt: now };
  const totOv = f.totalOverride && f.totalOverride.on ? { cents: T.totalCents, reason: f.totalOverride.reason.trim(), at: now } : null;
  const fields = {
    num: f.num, demo, takenBy: (f.takenBy || '').trim(),
    customer: { name: f.customer.name.trim(), phone: f.customer.phone.trim(), phoneDigits: phoneDigits(f.customer.phone), email: (f.customer.email || '').trim() },
    pickupDate: f.pickupDate || '', pickupTime: f.pickupTime || '', totalCents: T.totalCents, items: itemsMap, updatedAt: now,
    pricing: { complete: T.complete || !!totOv, itemsSum: T.sum, override: totOv }
  };
  if (fields.takenBy) { const recent = lsGet('pb.staff', []).filter(n => n !== fields.takenBy); lsSet('pb.staff', [fields.takenBy, ...recent].slice(0, 12)); }
  if (f.repeatOf) fields.repeatOf = f.repeatOf;
  if (f.allowClosed && f.pickupDate && isClosedDay(Store.calendar, f.pickupDate)) fields.closedDayOk = true;
  if (f.isNew) {
    const dep = parseMoney(f.deposit.amount);
    const doc = {
      ...fields, booking: mode === 'confirm' ? 'confirmed' : 'draft', createdAt: now, editRev: 1, payments: {},
      history: { [uid()]: { at: now, text: (mode === 'confirm' ? 'Order created and confirmed' : 'Draft saved') + (fields.takenBy ? ` — taken by ${fields.takenBy}` : ''), dev: deviceName() } }
    };
    if (dep && dep > 0) {
      doc.payments[f.deposit.id] = { kind: 'payment', amountCents: dep, date: todayNY(), method: f.deposit.method, ref: f.deposit.ref || '', at: now, dev: deviceName(), deposit: true };
      doc.history[uid()] = { at: now, text: `Deposit recorded: ${fmtMoney(dep)} ${f.deposit.method}`, dev: deviceName() };
    }
    // set() with the id chosen when the form opened: a repeated tap rewrites the same order, never a second one.
    await retry(() => ref.set(doc));
    afterSave(f, 1); f.booking = doc.booking; f.demo = demo;
    return f.id;
  }
  await withLease(ref, async () => {
    const s = await ref.get(); const cur = s.exists ? s.data() : null;
    if (!cur || !cur.createdAt) throw { code: 'gone', message: 'This order no longer exists. It may have been archived.' };
    if ((cur.editRev || 0) !== f.baseEditRev && !force) throw { code: 'conflict', current: cur, message: 'This order was edited on another device after you opened it.' };
    const patch = { ...fields, editRev: (cur.editRev || 0) + 1 };
    if (mode === 'confirm' && cur.booking === 'draft') patch.booking = 'confirmed';
    const histText = mode === 'confirm' && cur.booking === 'draft' ? 'Draft confirmed' : `Order details edited${force ? ' (overwrote changes from another device)' : ''}`;
    const totalNote = (cur.totalCents ?? null) !== T.totalCents ? ` · total ${fmtMoney(cur.totalCents ?? null)} → ${fmtMoney(T.totalCents)}` : '';
    const dateNote = (cur.pickupDate !== fields.pickupDate || cur.pickupTime !== fields.pickupTime) ? ` · pickup ${fmtDateMed(cur.pickupDate)} ${fmtTime(cur.pickupTime)} → ${fmtDateMed(fields.pickupDate)} ${fmtTime(fields.pickupTime)}` : '';
    const diff = describeChanges(cur, fields);
    await retry(() => ref.update({ ...patch, history: { [uid()]: { at: now, text: histText + totalNote + dateNote + (diff ? ` · ${diff}` : ''), dev: deviceName() } } }));
    afterSave(f, patch.editRev); if (patch.booking) f.booking = patch.booking;
  });
  return f.id;
}
function afterSave(f, rev) {
  f.isNew = false; f.baseEditRev = rev; f.removedItems = [];
  f.items.forEach(it => {
    it.isNew = false; it.removedExtras = []; it.removedImages = [];
    it.extras = it.extras.filter(x => (x.desc || '').trim()); it.extras.forEach(x => { x.isNew = false; });
    if (it.newRequest && it.newRequest.trim()) { it.requestsList = [...(it.requestsList || []), { id: uid(), text: it.newRequest.trim(), at: Date.now(), dev: deviceName() }]; it.newRequest = ''; }
    if (it.newProd && it.newProd.trim()) { it.prodList = [...(it.prodList || []), { id: uid(), text: it.newProd.trim(), at: Date.now(), dev: deviceName() }]; it.newProd = ''; }
    const p = formItemPrice(it); it.agreedCents = p.finalCents; it.savedCalcCents = p.calc.calcCents; it.priceChoice = 'agreed';
  });
}
/** Plain-language list of the most important spec changes (for the change history). */
function describeChanges(cur, next) {
  const out = [];
  for (const [id, n] of Object.entries(next.items || {})) {
    const c = cur.items && cur.items[id]; if (!c || n.active === false) continue;
    const sfx = n.suffix || c.suffix;
    for (const [k, l] of [['size', 'size'], ['flavor', 'flavor'], ['flavor2', 'second flavor'], ['filling', 'filling'], ['filling2', 'second filling'], ['fillMode', 'filling layout'], ['icing', 'icing'], ['qty', 'quantity'], ['inscription', 'inscription'], ['inscriptionColor', 'inscription color'], ['colors', 'colors'], ['priceCents', 'price']]) {
      const a = c[k] ?? '', b = n[k] ?? '';
      if (k === 'priceCents' ? a !== b : String(a) !== String(b)) out.push(`${sfx} ${l}: ${k === 'priceCents' ? fmtMoney(a === '' ? null : a) : (a || '—')} → ${k === 'priceCents' ? fmtMoney(b === '' ? null : b) : (b || '—')}`);
    }
  }
  return out.slice(0, 8).join('; ');
}
