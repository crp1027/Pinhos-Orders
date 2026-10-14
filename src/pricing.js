/* ===== pricing.js — Pinho's current menu and pricing rules (owner's sheet, March 2026) ===== */
const PRODUCTS = [
  { key: 'standard', label: 'Standard cake' }, { key: 'tier', label: 'Tier-style cake' }, { key: 'single', label: 'Single-layer cake' },
  { key: 'cupcakecake', label: 'Cupcake cake' }, { key: 'cupcakes', label: 'Custom cupcakes' }, { key: 'other', label: 'Other / custom' }];
const PRODUCT_LABEL = Object.fromEntries(PRODUCTS.map(p => [p.key, p.label]));
const PRICE_COLS = ['regular', 'extra', 'premcake', 'premium', 'cannoli', 'special'];
const COL_LABEL = { regular: 'Regular filling', extra: 'Extra filling', premcake: 'Red velvet / carrot package (all fillings included)', premium: 'Premium filling', cannoli: 'Cannoli filling', special: 'Tiramisu / tres leches' };
const FILLING_CATS = [['regular', 'Regular fillings'], ['extra', 'Extra fillings'], ['premium', 'Premium fillings'], ['cannoli', 'Cannoli']];
const FLAVOR_KINDS = [['classic', 'Classic'], ['premcake', 'Premium cake (red velvet / carrot)'], ['tresleches', 'Tres leches'], ['tiramisu', 'Tiramisu (fixed recipe)']];
const $ = d => Math.round(d * 100);
const DEFAULT_MENU = {
  rev: 0, effective: 'March 2026',
  standard: [
    { key: 'r7', label: '7-inch round', serv: '6–8', p: [25, 26, 28, 28, 28, 35].map($) },
    { key: 'r8', label: '8-inch round', serv: '10–12', p: [27, 28, 32, 32, 32, 45].map($) },
    { key: 'r10', label: '10-inch round', serv: '15–18', p: [38, 42, 45, 45, 45, 55].map($) },
    { key: 'r12', label: '12-inch round', serv: '20–25', p: [45, 50, 55, 55, 55, 65].map($) },
    { key: 'qs', label: 'Quarter sheet', serv: '18–20', p: [45, 50, 55, 55, 60, 70].map($) },
    { key: 'sq14', label: '14-inch square', serv: '30–35', p: [60, 65, 70, 70, 80, 90].map($), note: 'Read as a 14-inch square from its place on the price sheet; not yet confirmed by the owner.' },
    { key: 'hs', label: 'Half sheet', serv: '40–45', p: [75, 80, 85, 90, 100, 110].map($) },
    { key: 'tqs', label: 'Three-quarter sheet', serv: '55–65', p: [100, 110, 115, 120, 130, 140].map($) },
    { key: 'fs', label: 'Full sheet', serv: '80–100', p: [135, 145, 150, 160, 160, 180].map($) }],
  tier: [
    { key: 't7', label: 'Single 7-inch tier-style', serv: '15', tiers: ['7-inch'], p: $(65) },
    { key: 't8', label: 'Single 8-inch tier-style', serv: '20', tiers: ['8-inch'], p: $(85) },
    { key: 't9h', label: 'Single 9-inch heart tier-style', serv: '20', tiers: ['9-inch heart'], p: $(105) },
    { key: 't10', label: 'Single 10-inch tier-style', serv: '25', tiers: ['10-inch'], p: $(105) },
    { key: 't12', label: 'Single 12-inch tier-style', serv: '30', tiers: ['12-inch'], p: $(135) },
    { key: 't7_10', label: 'Two tiers: 7 + 10 inches', serv: '30–40', tiers: ['10-inch', '7-inch'], p: $(165) },
    { key: 't8_12', label: 'Two tiers: 8 + 12 inches', serv: '40–50', tiers: ['12-inch', '8-inch'], p: $(185) },
    { key: 't8_14', label: 'Two tiers: 8 + 14 inches', serv: '50–60', tiers: ['14-inch', '8-inch'], p: $(235) },
    { key: 't10_14', label: 'Two tiers: 10 + 14 inches', serv: '60–80', tiers: ['14-inch', '10-inch'], p: $(300) },
    { key: 't7_10_14', label: 'Three tiers: 7 + 10 + 14 inches', serv: '100–120', tiers: ['14-inch', '10-inch', '7-inch'], p: $(450), delivery: true }],
  single: [
    { key: 'sl_qs', label: 'Quarter sheet, single layer', p: $(20) },
    { key: 'sl_hs', label: 'Half sheet, single layer', p: $(30) },
    { key: 'sl_fs', label: 'Full sheet, single layer', p: $(50) }],
  cupcake: { classic: $(15), premcake: $(17.5), shaped: $(5) },
  addons: { ganache: $(5), animated: $(5), portrait: $(15), themeStart: $(5), figureStart: $(5), tierTresLeches: $(10) },
  flavors: [
    { id: 'yel', label: 'Yellow', kind: 'classic' }, { id: 'cho', label: 'Chocolate', kind: 'classic' },
    { id: 'ych', label: 'Yellow/chocolate combination', kind: 'classic' },
    { id: 'rv', label: 'Red velvet', kind: 'premcake' }, { id: 'car', label: 'Carrot', kind: 'premcake', noStd: ['r8', 'r12'] },
    { id: 'tl', label: 'Tres leches', kind: 'tresleches' }, { id: 'tir', label: 'Tiramisu', kind: 'tiramisu' }],
  fillings: [
    ...['Strawberry', 'Lemon', 'Pineapple', 'Chocolate pudding', 'Chocolate fudge', 'Vanilla pudding', 'Maple walnut', 'Mocha', 'Whipped cream', 'Buttercream'].map((l, i) => ({ id: 'fr' + i, label: l, cat: 'regular' })),
    ...['Banana cream', 'Cherry', 'Raspberry', 'Raspberry mousse', 'Chocolate mousse', 'Fruit tart custard'].map((l, i) => ({ id: 'fx' + i, label: l, cat: 'extra' })),
    ...['Cream cheese', 'Dulce de leite', 'Dulce de leite mousse', 'Fresh strawberry', 'Banana', 'Fresh pineapple', 'Peaches', 'Pears'].map((l, i) => ({ id: 'fp' + i, label: l, cat: 'premium', fruit: i >= 3 })),
    { id: 'fc', label: 'Cannoli', cat: 'cannoli' }],
  icings: ['Whipped cream', 'Buttercream', 'Chocolate whipped cream', 'Chocolate buttercream', 'Chocolate fudge', 'Maple', 'Mocha', 'Ganache']
    .map((l, i) => ({ id: 'ic' + i, label: l, ganache: l === 'Ganache' }))
};
function menu() { return Store.menu || DEFAULT_MENU; }
const activeOf = list => (list || []).filter(x => !x.retired);
function flavorOf(label) { return (menu().flavors || []).find(f => f.label === label) || null; }
function fillingOf(label) { return (menu().fillings || []).find(f => f.label === label) || null; }
function icingOf(label) { return (menu().icings || []).find(f => f.label === label) || null; }
function sizeRow(typeKey, sizeKey) {
  const m = menu(); const t = typeKey === 'standard' ? m.standard : typeKey === 'tier' ? m.tier : typeKey === 'single' ? m.single : null;
  return t ? t.find(r => r.key === sizeKey) || null : null;
}
function sizeOptions(typeKey) { const m = menu(); return typeKey === 'standard' ? m.standard : typeKey === 'tier' ? m.tier : typeKey === 'single' ? m.single : []; }
/** Legacy (v1) items stored a free-text type; map it to a product key. */
function typeKeyOf(it) {
  if (it.typeKey) return it.typeKey;
  const t = (it.type || '').toLowerCase();
  if (t.includes('tier')) return 'tier'; if (t.includes('cupcake cake')) return 'cupcakecake'; if (t.includes('cupcake')) return 'cupcakes';
  if (t.includes('single')) return 'single'; if (t.includes('round') || t.includes('sheet') || t.includes('standard')) return 'standard';
  return it.type ? 'other' : '';
}
function mixedFlavorLabel(it) { return [it.flavor, it.flavor2].filter(Boolean).join(' + '); }

/**
 * Starting price for one production item, following the owner's current rules.
 * Returns { calcCents|null, lines:[{label,cents}], issues:[{level:'block'|'quote'|'warn'|'info', text}], complete }.
 * 'block' = cannot price (missing/unavailable choice); 'quote' = staff must enter a price for part of it.
 */
function calcItemPrice(it, m = menu()) {
  const L = [], I = []; const add = (label, cents) => L.push({ label, cents });
  const tk = typeKeyOf(it); const A = it.addons || {}; const ad = m.addons;
  const block = t => I.push({ level: 'block', text: t }), quote = t => I.push({ level: 'quote', text: t }), warn = t => I.push({ level: 'warn', text: t }), info = t => I.push({ level: 'info', text: t });
  const fk = l => (m.flavors || []).find(f => f.label === l);
  const fl = [it.flavor, it.flavor2].filter(Boolean);
  const kinds = fl.map(f => (fk(f) || { kind: 'custom' }).kind);
  let addonsOk = true;
  if (!tk) { block('Choose a product type.'); return done(); }
  if (tk === 'standard') {
    const row = m.standard.find(r => r.key === it.sizeKey);
    if (!row) { block('Choose a size.'); return done(); }
    if (row.note) info(row.note);
    if (!it.flavor) { block('Choose a cake flavor.'); return done(); }
    if (kinds.includes('custom')) quote(`“${fl.find((f, i) => kinds[i] === 'custom')}” is not on the menu, so it has no set price. Enter its price in step 3 (Override the price).`);
    if (kinds.includes('tiramisu')) {
      if (fl.length > 1) { block('Tiramisu is a fixed recipe and can’t be mixed with another cake flavor.'); return done(); }
      add(`${row.label} — tiramisu (fixed recipe)`, row.p[5]); info('Tiramisu filling is fixed. Finishing-option compatibility hasn’t been fully confirmed by the owner.');
    } else if (kinds.includes('tresleches')) {
      if (fl.length > 1) { block('Tres leches can’t be mixed with another cake flavor.'); return done(); }
      add(`${row.label} — tres leches package (all fillings included)`, row.p[5]);
    } else if (kinds.includes('premcake')) {
      for (const f of fl) { const x = fk(f); if (x && (x.noStd || []).includes(row.key)) { block(`${x.label} isn’t available in the ${row.label} size.`); return done(); } }
      add(`${row.label} — ${fl.filter((f, i) => kinds[i] === 'premcake').join(' / ')} package (any filling included)`, row.p[2]);
    } else if (!kinds.includes('custom')) {
      const fills = [it.filling, it.filling2].filter(Boolean);
      if (!fills.length) { block('Choose a filling (standard cakes have two filling layers).'); return done(); }
      let best = null;
      for (const f of fills) {
        const c = fillingOf(f);
        if (!c) { quote(`Filling “${f}” is not on the menu, so it has no set price. Enter its price in step 3 (Override the price).`); continue; }
        const idx = PRICE_COLS.indexOf(c.cat); const p = row.p[idx];
        if (!best || p > best.p) best = { p, cat: c.cat, label: f };
      }
      if (best) add(`${row.label} — ${fl.join(' + ')}, ${COL_LABEL[best.cat].toLowerCase()}${fills.length > 1 ? ' (higher of the two fillings)' : ''}`, best.p);
    }
  } else if (tk === 'tier') {
    const row = m.tier.find(r => r.key === it.sizeKey);
    if (!row) { block('Choose a tier-style size.'); return done(); }
    add(`${row.label} (starting price, all fillings included)`, row.p);
    const tf = [...(it.tiers || []).flatMap(t => [t.flavor, t.flavor2]), it.flavor].filter(Boolean);
    const tk2 = tf.map(f => (fk(f) || { kind: 'custom' }).kind);
    if (tk2.includes('tresleches')) add('Tres leches in a tier-style cake (once per cake)', ad.tierTresLeches);
    if (tk2.includes('tiramisu')) warn('Tiramisu isn’t confirmed for every tier-style size. Check with a manager.');
    if (tf.some(f => (fk(f) || {}).noStd)) warn('The 8/12-inch carrot restriction isn’t confirmed for tier-style cakes. Check with a manager.');
    if (tk2.includes('custom')) quote('A tier uses a flavor that isn’t on the menu. Confirm the price.');
    if (row.delivery) {
      if (A.deliveryCents === null || A.deliveryCents === undefined || A.deliveryCents === '') quote('Three-tier cakes are priced “plus delivery.” Enter the delivery charge (no delivery price is set).');
      else add('Delivery', A.deliveryCents);
    }
  } else if (tk === 'single') {
    const row = m.single.find(r => r.key === it.sizeKey);
    if (!row) { block('Choose a single-layer size.'); return done(); }
    add(`${row.label} (no filling)`, row.p);
    if (kinds.some(k => k !== 'classic')) warn('No flavor upgrade is set for single-layer cakes. Adjust the price manually if one applies.');
  } else if (tk === 'cupcakecake') {
    const gs = groupsOf(it);
    const q = gs.length ? gs.reduce((a, g) => a + (+g.qty || 0), 0) : +it.qty;
    const cfl = gs.length ? gs.map(g => g.flavor).filter(Boolean) : fl;
    if (!(q > 0)) { block('Enter how many cupcakes.'); return done(); }
    if (gs.some(g => !(+g.qty > 0))) { block('Enter how many cupcakes are in each group.'); return done(); }
    if (!cfl.length || (gs.length && gs.some(g => !g.flavor))) { block('Choose a cupcake flavor' + (gs.length ? ' for every group.' : '.')); return done(); }
    if (!gs.length && fl.length > 1) quote('Mixed cupcake flavors have no confirmed price. Enter its price in step 3 (Override the price).');
    const ck = cfl.map(f => (fk(f) || { kind: 'custom' }).kind);
    const odd = cfl.find((f, i) => ck[i] === 'tresleches' || ck[i] === 'tiramisu'); if (odd) quote(`${odd} cupcake cakes have no confirmed price.`);
    const cust = cfl.find((f, i) => ck[i] === 'custom'); if (cust) quote(`“${cust}” is not on the menu.`);
    const prem = ck.includes('premcake');
    if (q % 12 !== 0) quote(`${q} cupcakes isn’t a whole number of dozens. Partial dozens have no confirmed price. Enter its price in step 3 (Override the price).`);
    else { const rate = prem ? m.cupcake.premcake : m.cupcake.classic; add(`${q / 12} dozen ${prem ? 'red velvet / carrot' : 'classic'} × ${fmtMoney(rate)}${prem && gs.length > 1 ? ' (whole order at the higher price)' : ''}`, rate * q / 12); }
    if (A.shaped) add('Shaped arrangement', m.cupcake.shaped);
    if ([it.icing, ...gs.map(g => g.icing)].some(x => icingOf(x)?.ganache)) warn('Ganache on cupcake cakes isn’t confirmed. Add a charge manually if it applies.');
  } else if (tk === 'cupcakes') {
    quote('Individually decorated cupcakes have no menu price. Enter its price in step 3 (Override the price).'); addonsOk = true;
  } else {
    quote('Custom product. Enter its price in step 3 (Override the price).');
  }
  // Finishing and decoration charges (stack; once per complete cake)
  if (tk !== 'cupcakecake' && icingOf(it.icing)?.ganache) add('Ganache icing (once per cake)', ad.ganache);
  if (A.animated) add('Animated picture', ad.animated);
  if (A.portrait) add('Personal portrait', ad.portrait);
  if (A.themeOn) {
    const t = A.themeCents ?? ad.themeStart;
    add('Theme decoration', t);
    if (t < ad.themeStart) warn(`Theme decoration starts at ${fmtMoney(ad.themeStart)}.`);
    if (tk === 'cupcakecake') warn('Theme charges on cupcake cakes aren’t confirmed by the owner.');
  }
  if (A.figuresOn) {
    if (A.figureCents === null || A.figureCents === undefined) quote(`Figures are manager-priced (${fmtMoney(ad.figureStart)} and up). Enter the amount.`);
    else add('Figures (manager-priced)', A.figureCents);
  }
  for (const x of extrasOf(it)) { const c = x.cents ?? null; if ((x.desc || '').trim() && c !== null && !Number.isNaN(c) && c !== 0) add(`Extra: ${x.desc.trim()}`, c); }
  for (const c of A.custom || []) if (c && c.label && c.cents !== null && c.cents !== undefined && !Number.isNaN(c.cents)) add(c.label, c.cents);
  if (A.needsQuote) quote('Custom design work still needs a quote from a manager.');
  if (tk === 'single' && (A.animated || A.portrait || A.themeOn || A.figuresOn)) warn('Decoration charges on single-layer cakes aren’t confirmed by the owner.');
  const printImg = (it.images ? (Array.isArray(it.images) ? it.images : mapList(it.images)) : []).some(im => im.purpose === 'print');
  if (printImg && !A.animated && !A.portrait) info('An image is marked “Print This Image on Cake.” Add the animated picture or portrait charge if it applies.');
  return done();
  function done() {
    const blocked = I.some(x => x.level === 'block');
    const calcCents = blocked || !L.length ? null : L.reduce((s, l) => s + l.cents, 0);
    return { calcCents, lines: L, issues: I, complete: !blocked && !I.some(x => x.level === 'quote') && calcCents !== null };
  }
}
/** Final agreed price of a saved item (override wins). */
function itemPrice(it) { return it.priceCents ?? null; }
function pricingComplete(o) {
  return itemsOf(o).every(it => it.price ? (it.price.override || it.price.complete) : it.priceCents !== null && it.priceCents !== undefined);
}
function bigSizeForDeposit(typeKey, sizeKey) { return ['sq14', 'hs', 'tqs', 'fs', 't8_14', 't10_14', 't7_10_14'].includes(sizeKey); }
