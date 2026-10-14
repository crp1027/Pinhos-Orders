/* ===== demo.js — fictional PRACTICE orders, always built around a chosen "today" ===== */
const DEMO_IMGS = { print: { asset: '5421c49c44bfd8e32259346d67c51a53', thumb: '8325305de2e6acb8b024d2ca2b0c7ae0' }, inspire: { asset: 'b51f8c6952b0cef185d82c751bcff5c0', thumb: 'de071c5a04be7bdcba04eeb70c994f6a' } };
function buildDemoOrders(A, imgs = DEMO_IMGS) {
  let r = 7; const rnd = () => { r = (r * 1103515245 + 12345) & 0x7fffffff; return r / 0x7fffffff; };
  const pick = a => a[Math.floor(rnd() * a.length)];
  const T = (d, t) => nyToEpoch(d, t); const D = n => addDays(A, n);
  const nextWd = (from, wd) => { let d = from; while (weekday(d) !== wd) d = addDays(d, 1); return d; };
  const FIRST = ['Ana', 'Marco', 'Lucia', 'Daniel', 'Priya', 'Tomás', 'Grace', 'Kevin', 'Sofia', 'Andre', 'Maya', 'Rui', 'Elena', 'Jamal', 'Inês', 'Victor', 'Carla', 'Owen', 'Beatriz', 'Nadia', 'Hugo', 'Tara', 'Joana', 'Felix', 'Rosa', 'Samir', 'Vera', 'Luis', 'Paula', 'Derek'];
  const LAST = ['Ribeiro', 'Teixeira', 'Okafor', 'Delgado', 'Shah', 'Moreira', 'Kowalski', 'Nunes', 'Brennan', 'Castillo', 'Vieira', 'Lindqvist', 'Amaral', 'Ferraz', 'Duarte', 'Quinlan', 'Sousa', 'Matos', 'Barros', 'Fontaine'];
  const STAFF = ['Maria (practice)', 'Joe (practice)', 'Ines (practice)', 'Carlos (practice)'];
  const INSC = ['Happy Birthday Ava', 'Happy 30th Marcus!', 'Congratulations Grad', 'Happy Anniversary Mom & Dad', 'Feliz Aniversário Avó', 'Welcome Baby Leo', 'Happy Retirement Jim', 'Happy 1st Birthday Mila', 'Parabéns Tiago', 'Best Wishes Sam & Jo', 'Happy Birthday Grandpa', 'Good Luck Rosa'];
  const ICOL = ['Royal blue', 'Pink', 'Black', 'Gold', 'Red', 'Purple', 'White', 'Navy'];
  const THEME = ['Pink and gold sprinkles', 'Soccer ball, green field', 'Simple shell border', 'Flowers on top corner', 'Unicorn horn and ears', 'Blue waves, nautical', 'Graduation cap', 'Dinosaurs', 'Rainbow stripes', 'Hearts around the edge'];
  const COLORS = ['Pink, gold', 'Navy, white', 'Pastel rainbow', 'Green, yellow', 'Lavender', 'Red, white', 'Teal, silver', 'Ivory'];
  const REG = ['Strawberry', 'Lemon', 'Pineapple', 'Chocolate pudding', 'Vanilla pudding', 'Whipped cream', 'Buttercream', 'Mocha'];
  const EXT = ['Banana cream', 'Cherry', 'Raspberry mousse', 'Chocolate mousse'];
  const PREM = ['Cream cheese', 'Dulce de leite', 'Fresh strawberry', 'Fresh pineapple', 'Peaches'];
  const ICE = ['Whipped cream', 'Whipped cream', 'Buttercream', 'Chocolate whipped cream', 'Chocolate buttercream', 'Mocha'];
  let seq = 0; const now0 = T(D(-14), '10:00'); const orders = []; let N = 9001;
  const m = menu();
  function mkItem(i, s) {
    const row = sizeRow(s.typeKey, s.sizeKey);
    const it = {
      suffix: suffixFor(i), pos: i, active: true, typeKey: s.typeKey, type: PRODUCT_LABEL[s.typeKey], sizeKey: s.sizeKey || '', size: row ? row.label : '', qty: s.qty ?? (['standard', 'single'].includes(s.typeKey) ? 1 : null),
      servings: row && row.serv ? row.serv : null, flavor: s.flavor || '', flavor2: s.flavor2 || '', filling: s.filling || '', filling2: s.filling2 || '', fillMode: s.filling2 ? (s.fillMode || 'layer') : '', icing: s.icing || 'Whipped cream', tiers: s.tiers || [],
      groups: s.groups || [], shapeDesc: s.shapeDesc || '', picturePhone: s.picturePhone || '',
      inscription: s.inscription || '', inscriptionColor: s.noInscription ? '' : (s.inscriptionColor || pick(ICOL)), noInscription: !!s.noInscription, colors: s.colors || '', decoration: s.decoration || '',
      addons: { animated: false, portrait: false, themeOn: false, themeCents: null, figuresOn: false, figureCents: null, shaped: false, deliveryCents: null, custom: [], needsQuote: false, ...(s.addons || {}) },
      images: {}, extras: {}, stage: 0, stageAt: null, stageTimes: {}, stageLog: {}, frozen: false, frozenAt: null, frozenLog: {}, storage: s.storage || '', collectedAt: s.collectedAt || null,
      notes: {}, plan: null, planLog: {}, createdAt: now0, attention: s.attention || null, printedHash: s.printedHash || null, printedAt: s.printedAt || null
    };
    if (s.times) { let prev = 0; for (const [st, ep] of Object.entries(s.times)) { it.stageTimes[st] = ep; it.stageLog['l' + (++seq)] = { from: prev, to: +st, at: ep, doneAt: ep, dev: 'Practice data' }; prev = +st; it.stage = +st; it.stageAt = ep; } }
    if (s.frozen) { it.frozen = true; it.frozenAt = it.stageAt || now0; it.frozenLog['f' + (++seq)] = { on: true, at: it.frozenAt, dev: 'Practice data' }; }
    if (s.plan) { it.plan = { ...s.plan, setAt: s.plan.setAt || T(addDays(s.plan.date, -1), '17:05'), dev: 'Practice data' }; it.planLog['p' + (++seq)] = { action: 'set', date: s.plan.date, milestone: s.plan.milestone, at: it.plan.setAt, dev: 'Practice data' }; }
    (s.extras || []).forEach((x, k) => { const c = typeof x[1] === 'number' ? x[1] : x[1] === 'customer' || x[3] ? null : [800, 1200, 1500, 600, 2500][(x[0].length + k) % 5]; it.extras['x' + (++seq)] = { desc: x[0] + (x[1] === 'customer' || x[3] ? ' (customer bringing)' : ''), cents: c, pos: k, at: now0 }; });
    (s.notes || []).forEach(n => { it.notes['n' + (++seq)] = { kind: n[0], text: n[1], at: n[2] || now0, dev: 'Practice data' }; });
    (s.images || []).forEach((im, k) => { it.images['m' + (++seq)] = { ...im, pos: k, removed: false }; });
    const c = calcItemPrice({ ...it, images: s.images || [] }, m);
    const ov = s.override; const final = ov ? ov.cents : c.calcCents;
    it.price = { calcCents: c.calcCents, lines: c.lines, complete: c.complete, issues: c.issues, menuRev: 0, override: ov ? { ...ov, at: now0, dev: 'Practice data' } : null, keptAgreed: false };
    it.priceCents = final;
    return it;
  }
  function mkOrder(date, time, specs, { pays = [], booking = 'confirmed', name, extra = {}, payAll, payPart } = {}) {
    const nm = name || `${pick(FIRST)} ${pick(LAST)}`;
    const ph = `(${pick(['908', '732', '973'])}) 555-01${String(Math.floor(rnd() * 100)).padStart(2, '0')}`;
    const num = N++;
    const o = { num, demo: true, booking, takenBy: pick(STAFF), customer: { name: nm, phone: ph, phoneDigits: phoneDigits(ph), email: '' }, pickupDate: date, pickupTime: time, items: {}, payments: {}, history: {}, editRev: 1, createdAt: now0, updatedAt: now0, ...extra };
    specs.forEach((s, i) => { o.items['i' + (i + 1)] = mkItem(i, s); });
    const its = Object.values(o.items); const sum = its.every(x => x.priceCents !== null) ? its.reduce((a, x) => a + x.priceCents, 0) : null;
    o.totalCents = sum; o.pricing = { complete: its.every(x => x.price.complete || x.price.override), itemsSum: sum, override: null };
    if (payAll && sum) pays = [[sum, payAll, 'card']];
    if (payPart && sum) pays = [[Math.round(sum * 0.4 / 100) * 100, payPart, pick(['card', 'cash'])]];
    pays.forEach((p, k) => { o.payments['y' + (++seq)] = { kind: 'payment', amountCents: p[0], date: p[1], method: p[2], ref: p[3] || '', at: T(p[1], '12:00'), dev: 'Practice data', deposit: k === 0 && pays.length > 1 }; });
    o.history['h' + (++seq)] = { at: now0, text: `Practice order created (fictional) — taken by ${o.takenBy}`, dev: 'Practice data' };
    orders.push({ id: 'demo' + num, ...o }); return o;
  }
  const std = (sizeKey, x = {}) => ({ typeKey: 'standard', sizeKey, flavor: 'Yellow', filling: pick(REG), icing: pick(ICE), inscription: pick(INSC), colors: pick(COLORS), decoration: pick(THEME), ...x });
  const cupcake = (qty, x = {}) => ({ typeKey: 'cupcakecake', qty, flavor: 'Chocolate', icing: 'Buttercream', noInscription: true, decoration: 'Match the cake', ...x });
  const custom = (qty, x = {}) => ({ typeKey: 'cupcakes', qty, flavor: x.groups ? '' : 'Chocolate', icing: x.groups ? '' : 'Buttercream', noInscription: true, decoration: 'Match the cake', override: { cents: qty * 300, reason: 'Practice price: $3.00 each (not a real menu price)' }, ...x });
  // Days: S = practice "special" day (today unless closed Monday), B = busy Saturday, P = day before B
  const S = weekday(A) === 1 ? D(1) : A; const B = nextWd(A, 6); const P = addDays(B, -1); const Y = D(-1);
  // ---- past ----
  mkOrder(Y, '16:00', [std('r8', { flavor: 'Yellow', filling: 'Strawberry', inscription: 'Happy Birthday Nora', times: { 1: T(Y, '08:10'), 2: T(Y, '09:30'), 3: T(Y, '11:00'), 4: T(Y, '13:20') }, storage: 'Front cooler, shelf 2' })], { payAll: D(-5) });
  mkOrder(Y, '14:00', [std('qs', { flavor: 'Chocolate', filling: 'Chocolate mousse', inscription: 'Congratulations Dana', times: { 1: T(Y, '07:40'), 2: T(Y, '09:00'), 3: T(Y, '12:30') } })], { payPart: D(-6) });
  mkOrder(Y, '11:00', [std('r8', { inscription: 'Happy 40th', times: { 2: T(Y, '07:00'), 4: T(Y, '10:00') }, collectedAt: T(Y, '11:12') }), cupcake(12, { times: { 4: T(Y, '10:05') }, collectedAt: T(Y, '11:12') })], { payAll: Y });
  mkOrder(D(-2), '15:30', [std('r7', { inscription: 'Happy Birthday Leo', times: { 4: T(D(-2), '13:00') }, collectedAt: T(D(-2), '15:41') })], { payAll: D(-2) });
  mkOrder(D(-1), '12:00', [std('r8', { flavor: 'Red velvet', filling: 'Cream cheese', inscription: 'Happy Birthday Marisol' })], { pays: [[2000, D(-10), 'card', 'POS 4410']], booking: 'canceled', extra: { canceledAt: T(D(-3), '10:15'), cancelReason: 'Customer called: party postponed' } });
  mkOrder(D(-7), '10:00', [{ typeKey: 'tier', sizeKey: 't8_12', tiers: [{ size: '12-inch', flavor: 'Yellow', filling: 'Fruit tart custard' }, { size: '8-inch', flavor: 'Red velvet', filling: 'Cream cheese' }], icing: 'Buttercream', noInscription: true, decoration: 'White roses cascading', times: { 4: T(D(-7), '08:30') }, collectedAt: T(D(-7), '09:55') }], { payAll: D(-7), name: 'Practice Wedding — Silva/Park' });
  // ---- special practice cases on S ----
  mkOrder(S, '08:00', [std('r8', { inscription: 'Happy Birthday Coach', colors: 'Navy, gold', decoration: 'Whistle and stars', times: { 1: T(Y, '13:00'), 2: T(Y, '15:30') }, plan: { date: Y, milestone: 2 }, storage: 'Walk-in cooler' })], { payAll: D(-4) });
  mkOrder(S, '09:30', [std('r10', { flavor: 'Chocolate', filling: 'Chocolate pudding', filling2: 'Fresh strawberry', inscription: 'Happy 7th Birthday Theo', inscriptionColor: 'Green', colors: 'Green, yellow', decoration: 'Dinosaurs, volcano', times: { 1: T(Y, '17:00') }, frozen: true, storage: 'Freezer 1, top shelf', plan: { date: Y, milestone: 1 }, addons: { themeOn: true, themeCents: 1000 }, extras: [['Dinosaur topper set', 'received', Y]] }), cupcake(24, { decoration: 'Green swirl, dino picks', addons: { shaped: false }, extras: [['Dino cupcake picks (24)', 'ordered', S, false, 'Party store, arriving 8 AM']] })], { payPart: D(-12) });
  mkOrder(S, '10:00', [std('qs', { flavor: 'Chocolate', filling: 'Chocolate mousse', filling2: 'Fresh strawberry', fillMode: 'half', inscription: 'Happy Birthday Jayden', decoration: 'Basketball', addons: { animated: true }, picturePhone: '(732) 555-0144', notes: [['cust', 'Half the cake chocolate mousse, half fresh strawberry. Mark the strawberry side on the box.', now0]], extras: [['Number 7 candle', 300]] })], {});
  mkOrder(S, '11:00', [std('r8', { inscription: 'It’s a Boy!', inscriptionColor: 'Light blue', colors: 'Light blue', decoration: 'Baby blocks', attention: { on: true, reason: 'Call customer: confirm the shade of blue', at: T(Y, '16:00') } })], { pays: [[1000, D(-5), 'cash']] });
  mkOrder(S, '12:00', [cupcake(24, { flavor: '', groups: [{ qty: 12, flavor: 'Red velvet', filling: '', icing: 'Buttercream' }, { qty: 12, flavor: 'Yellow', filling: '', icing: 'Whipped cream' }], inscription: 'Happy Birthday Zoe', noInscription: false, decoration: 'Flower shape', addons: { shaped: true }, shapeDesc: 'One big flower: yellow center (6 yellow), pink petals all around (red velvet)', extras: [['Princess figurines', 'customer', '', true, 'Mom dropping off the day before']] })], { payPart: D(-7) });
  mkOrder(S, '13:00', [std('r8', { flavor: 'Yellow', filling: 'Lemon', inscription: 'Go Tigers!', inscriptionColor: 'Orange', decoration: 'Team logo printed on top', addons: { animated: true }, picturePhone: '(908) 555-0177', images: imgs.print ? [{ ...imgs.print, purpose: 'print', name: 'practice-logo.png' }] : [], printedHash: 'oldrevision', printedAt: T(Y, '17:10'), notes: [['cust', 'Print the attached image on the full top; orange border.', now0]] })], { payAll: D(-3) });
  mkOrder(S, '14:30', [std('r10', { flavor: 'Yellow', flavor2: 'Chocolate', filling: 'Fresh strawberry', filling2: 'Vanilla pudding', icing: 'Buttercream', inscription: 'Feliz Aniversário, Avó Lurdes\nCom muito amor', inscriptionColor: 'Sage green', colors: 'Ivory, blush, sage green',
    decoration: 'Hand-piped garden: peonies, roses, small leaves around the base, and a ribbon band in sage green with a bow at the front', addons: { themeOn: true, themeCents: 1500 },
    images: imgs.inspire ? [{ ...imgs.inspire, purpose: 'inspire', name: 'pinterest-inspiration.jpg' }, { ...imgs.print, purpose: 'recreate', name: 'border-detail.jpg' }] : [],
    notes: [['cust', 'Writing in script, centered, second line smaller. No nuts anywhere near this cake (customer was very clear).', T(D(-12), '11:00')], ['cust', 'Called back: box must fit a small car seat — use the taller box. If peonies can’t be blush, call her before using pink.', T(D(-3), '15:20')],
      ['prod', 'Use the new sage gel color, not the old green. Tips #104 for peonies and #352 leaves. Ribbon must overlap at the front under the bow.', T(Y, '15:00')], ['mgr', 'Regular customer; paid in full. If anything about the colors is uncertain, call her. Do not substitute fillings.', T(Y, '16:40')], ['prod', 'Lettering practice on parchment first. Avó has an accent on the o.', T(Y, '18:00')]],
    extras: [['Sage satin ribbon 1.5 in', 'received', Y], ['Taller cake box 12x12x8', 'ordered', S, false, 'Supplier delivery 9 AM']] })], { payAll: D(-14) });
  mkOrder(S, '15:00', [std('r8', { inscription: 'Happy Retirement Linda', colors: 'Teal, silver', times: { 1: T(Y, '16:00'), 2: T(Y, '18:00'), 3: T(Y, '19:30'), 4: T(Y, '20:10') }, storage: 'Front cooler, shelf 1' })], { payAll: D(-2) });
  mkOrder(S, '16:00', [std('r7', { inscription: 'Happy Birthday Ben', decoration: 'Simple shell border' })], { pays: [[1500, D(-6), 'cash'], [1500, D(-2), 'card']] });
  mkOrder(S, '17:00', [std('r8', { inscription: 'Congratulations Ines', decoration: 'Graduation cap', addons: { themeOn: true, themeCents: 500 } }), std('hs', { flavor: 'Chocolate', filling: 'Cannoli', inscription: 'Class of 2026', decoration: 'School colors' })], { payPart: D(-9) });
  // ---- busy Saturday B (about 100 items including S's if they coincide) ----
  const already = orders.filter(o => o.pickupDate === B).reduce((s, o) => s + Object.keys(o.items).length, 0);
  const target = 100 - 2 - already;
  const times = []; for (let h = 7; h <= 18; h++) for (const mm of ['00', '15', '30', '45']) times.push(`${String(h).padStart(2, '0')}:${mm}`);
  let made = 0, k = 0;
  while (made < target) {
    const tm = times[Math.min(times.length - 1, Math.floor((k / 78) * times.length))] || '12:00'; k++;
    const left = target - made; const n = left >= 3 && rnd() < 0.05 ? 3 : left >= 2 && rnd() < 0.2 ? 2 : 1;
    const specs = []; for (let j = 0; j < n; j++) {
      const idx = made + j; let s;
      if (j === 0) {
        const kind = rnd(); const fl = kind < 0.12 ? 'Red velvet' : kind < 0.18 ? 'Tres leches' : pick(['Yellow', 'Chocolate', 'Yellow', 'Yellow/chocolate combination']);
        const size = pick(['r8', 'r8', 'r7', 'r10', 'r12', 'qs', 'hs']);
        const fcat = rnd(); const fil = fl === 'Tres leches' ? pick(REG) : fcat < 0.65 ? pick(REG) : fcat < 0.85 ? pick(EXT) : pick(PREM);
        s = rnd() < 0.08 ? (() => { const sh = rnd() < 0.4; return cupcake(pick([12, 24, 36]), { flavor: pick(['Chocolate', 'Yellow', 'Red velvet']), inscription: pick(INSC), noInscription: false, addons: { shaped: sh }, shapeDesc: sh ? pick(['Number 1', 'Heart', 'Letter A', 'Soccer ball']) : '' }); })()
          : std(size, { flavor: fl, filling: fil, filling2: rnd() < 0.15 && fl !== 'Tres leches' ? pick(REG) : '', fillMode: rnd() < 0.5 ? 'half' : 'layer', icing: rnd() < 0.08 ? 'Ganache' : pick(ICE), addons: { themeOn: rnd() < 0.2, themeCents: 500, animated: rnd() < 0.08, portrait: rnd() < 0.03 } });
      } else s = cupcake(pick([12, 24, 36]), { decoration: j === 2 ? 'Different design: white with sprinkles' : 'Match the cake' });
      if (j === 0 && s.typeKey === 'standard') {
        const pDone = P < A; // only past work can already be done
        if (tm <= '08:30') { s.plan = { date: P, milestone: 2 }; if (idx % 2 === 0 && (pDone || Y >= D(-1))) { s.times = { 1: T(Y, '15:00') + idx * 60000 }; s.frozen = true; s.storage = 'Freezer 2, rack ' + (1 + idx % 3); } }
        else if (idx % 7 === 3) { s.plan = { date: P, milestone: 1 }; if (idx % 2) { s.times = { 1: T(Y, '19:00') + idx * 60000 }; s.frozen = true; s.storage = 'Freezer 1'; } }
        else if (idx === 40 || idx === 55) s.plan = { date: Y, milestone: 1 }; // planned yesterday, not done: carried over
        else if (idx === 61) { s.plan = { date: Y, milestone: 1 }; s.times = { 1: T(Y, '14:00') }; s.frozen = true; s.storage = 'Freezer 1'; } // done on time
      }
      if (idx % 11 === 4) s.extras = [[pick(['Gold “30” topper', 'Fresh flowers (peonies)', 'Sparkler candles', 'Acrylic name topper']), pick([800, 1200, 1500])]];
      else if (idx % 13 === 6) s.extras = [[pick(['Fresh flowers (roses)', 'Custom topper', 'Edible pearls']), pick([1000, 2000, 500])]];
      else if (idx % 17 === 9) s.extras = [['Wafer paper butterflies', 600]];
      specs.push(s);
    }
    made += n;
    const pr = rnd(); mkOrder(B, tm, specs, pr < 0.65 ? { payPart: D(-8) } : pr < 0.85 ? { payAll: D(-3) } : {});
  }
  mkOrder(B, '11:00', [{ typeKey: 'tier', sizeKey: 't8_12', tiers: [{ size: '12-inch', flavor: 'Chocolate', flavor2: 'Yellow', filling: 'Chocolate mousse', filling2: 'Raspberry mousse', fillMode: 'half' }, { size: '8-inch', flavor: 'Tres leches', filling: 'Strawberry' }], icing: 'Ganache', noInscription: true, colors: 'Ivory, blush', decoration: 'Fresh flowers cascading down one side', plan: { date: P, milestone: 1 }, extras: [['Fresh blush roses (2 dozen)', 4500]] }, custom(36, { decoration: 'Ivory with blush rosette', groups: [{ qty: 18, flavor: 'Chocolate', filling: 'Cannoli', icing: 'Buttercream' }, { qty: 12, flavor: 'Yellow', filling: 'Strawberry', icing: 'Whipped cream' }, { qty: 6, flavor: 'Red velvet', filling: 'Cream cheese', icing: 'Buttercream' }] })], { pays: [[15000, D(-40), 'card'], [5000, D(-14), 'card']], name: 'Practice Wedding — Costa/Reyes' });
  // ---- Sunday after B ----
  const SU = addDays(B, 1);
  ['08:00', '09:00', '09:00', '09:30', '10:00', '10:00', '10:30', '11:00', '11:00', '11:30', '12:00', '12:00', '12:30', '13:00', '13:00', '13:30', '14:00', '14:00', '14:30', '15:00', '15:00', '15:30', '16:00', '16:00', '16:30', '17:00', '17:00', '17:30', '18:00', '18:00']
    .forEach((tm, k2) => { const s = std(pick(['r8', 'r8', 'r10', 'qs']), { flavor: pick(['Yellow', 'Chocolate', 'Red velvet']) }); if (tm === '08:00') s.plan = { date: B, milestone: 2 }; mkOrder(SU, tm, k2 % 4 === 0 ? [s, cupcake(24)] : [s], k2 % 3 ? { payPart: D(-5) } : {}); });
  // ---- next week, including the Wednesday-prep / Thursday-7 AM case ----
  const TH = nextWd(D(3), 4); const WE = addDays(TH, -1); const TU = addDays(TH, -2);
  const few = (d, list) => list.forEach(([tm, s, opt]) => mkOrder(d, tm, Array.isArray(s) ? s : [s], opt || { payPart: D(-2) }));
  few(TU, [['10:00', std('r8', { inscription: 'Happy Birthday Ivo' })], ['12:00', std('hs', { inscription: 'Welcome Back!' })], ['16:00', cupcake(24, { addons: { shaped: true } })]]);
  few(WE, [['09:00', std('r8', { inscription: 'Happy Birthday Kai' })], ['13:00', [std('r10', { inscription: 'Congrats Nurse Pat' }), cupcake(24)]], ['15:00', std('r7', { inscription: 'Happy Birthday Eli', extras: [['Gold “5” topper', 'needs', TU]] })]]);
  few(TH, [
    ['07:00', std('r8', { inscription: 'Happy Birthday Dr. Mendes', colors: 'Navy', decoration: 'Stethoscope', plan: { date: WE, milestone: 2, setAt: T(D(0), '17:10') }, notes: [['mgr', 'Early pickup — ice and freeze the day before (set at the evening review).', T(D(0), '17:10')]] }), { payAll: D(-1) }],
    ['09:00', std('r8', { inscription: 'Happy Birthday Ruth', plan: { date: TU, milestone: 2, setAt: T(D(0), '17:12') } })],
    ['14:00', std('r8', { inscription: 'Happy Birthday Ida', extras: [['Fresh flowers', 'needs', WE]] })], ['16:00', [std('r8', { flavor: 'Tiramisu', filling: '', inscription: 'Happy 16th Bea' }), cupcake(12)]]]);
  const MON = nextWd(D(1), 1);
  mkOrder(MON, '10:00', [std('r8', { inscription: 'Happy Birthday Columbo', decoration: 'Monday pickup agreed by manager' })], { extra: { closedDayOk: true } });
  // ---- future ----
  mkOrder(D(42), '13:00', [{ typeKey: 'tier', sizeKey: 't7_10_14', tiers: [{ size: '14-inch', flavor: 'Yellow', filling: 'Fruit tart custard' }, { size: '10-inch', flavor: 'Chocolate', filling: 'Chocolate mousse' }, { size: '7-inch', flavor: 'Red velvet', filling: 'Cream cheese' }], icing: 'Buttercream', noInscription: true, colors: 'White, gold leaf', decoration: 'Gold leaf accents, sugar flowers', addons: { needsQuote: true }, extras: [['Gold leaf sheets', 'needs', D(35)], ['Cake stand', 'customer', '', true]] }, custom(48, { decoration: 'White with gold dust' })], { pays: [[20000, D(-20), 'card', 'POS 1188']], name: 'Practice Wedding — Almeida/Chen' });
  few(D(49), [['10:00', std('r10', { flavor: 'Carrot', filling: 'Cream cheese', inscription: 'Happy Thanksgiving' })], ['12:00', std('r12', { inscription: 'Happy 80th Birthday Vovô' })], ['14:00', cupcake(36, { decoration: 'Autumn leaves' })]]);
  few(D(70), [['11:00', std('fs', { inscription: 'Happy Holidays — Office Party', filling: 'Cannoli' })], ['15:00', std('r8', { inscription: 'Merry Christmas', icing: 'Ganache' })]]);
  few(D(98), [['12:00', { typeKey: 'single', sizeKey: 'sl_qs', flavor: 'Yellow', icing: 'Whipped cream', inscription: 'Happy 1st Birthday Rafa', decoration: 'Smash cake' }]]);
  mkOrder(D(14), '', [std('r8', { flavor: 'Chocolate', inscription: '', decoration: 'Customer still deciding on a theme' })], { booking: 'draft', name: 'Practice Draft — call back' });
  return { orders, nextNum: N };
}
/** Replace all practice orders with a fresh set built around today. Live orders are never touched. */
async function resetDemoData(onProgress) {
  const removed = await deleteDemoOrders();
  const { orders, nextNum } = buildDemoOrders(todayNY());
  let done = 0; const q = [...orders];
  const worker = async () => { while (q.length) { const o = q.shift(); const { id, ...body } = o; await retry(() => Store.db.doc('orders/' + id).set(body)); done++; onProgress && onProgress(done, orders.length); } };
  await Promise.all([worker(), worker(), worker(), worker()]);
  const cref = Store.db.doc('settings/counter');
  await withLease(cref, async () => { const s = await cref.get(); const d = (s.exists && s.data()) || {}; await cref.set({ next: d.next || 1001, demoNext: nextNum }); });
  await retry(() => Store.db.doc('settings/demo').set({ anchor: todayNY(), at: Date.now(), dev: deviceName() }));
  return { removed, created: orders.length };
}
