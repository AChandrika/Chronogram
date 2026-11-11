import { $, esc, MON, CATS, STYLE, svg, studioLink, studioLinkLabel, dateObj, isoOf, fmtDate, fmtDateLong, fmtTime, timeRange, todayISO, loadData, bag } from './common.js';
import { buildPlan, parseQuery } from './planner.js';

const STEPS = [
  { id: 'when', label: 'When' }, { id: 'what', label: 'What' }, { id: 'who', label: 'Who' },
  { id: 'where', label: 'Where' }, { id: 'meals', label: 'Meals' }, { id: 'budget', label: 'Budget' }
];
const WHO = [
  { v: 'solo', label: 'Just me', icon: 'user', hint: 'Go at your own pace' },
  { v: 'couple', label: 'A couple', icon: 'heart', hint: 'Date-friendly picks' },
  { v: 'friends', label: 'Friends', icon: 'users', hint: 'Things to do together' },
  { v: 'family', label: 'Family with kids', icon: 'family', hint: 'Kid-friendly, earlier evenings' }
];
const CUISINES = ['Any', 'American', 'Italian', 'Pizza', 'Thai', 'Mexican', 'Bakery & cafe', 'Bar & pub', 'Vegetarian'];
const BUDGETS = [{ v: 'free', label: 'Free only' }, { v: 25, label: 'Under $25' }, { v: 50, label: 'Under $50' }, { v: null, label: 'Any price' }];
const PACES = [{ v: 'relaxed', label: 'Relaxed', hint: '1–2 things a day' }, { v: 'balanced', label: 'Balanced', hint: '2–3 things a day' }, { v: 'packed', label: 'Packed', hint: 'As much as fits' }];
const RADII = [{ v: 15, label: '15 min' }, { v: 30, label: '30 min' }, { v: 45, label: '45 min' }, { v: null, label: 'Anywhere' }];
const HOURS = [{ v: 'morning', label: 'Morning', icon: 'sunrise' }, { v: 'afternoon', label: 'Afternoon', icon: 'sun' }, { v: 'evening', label: 'Evening', icon: 'moon' }];

let data, today, step = 0, prefs, swap = { exclude: [], excludePlaces: [] }, lastPlan = null;

function defaults() {
  const base = dateObj(today < data.windowStart ? data.windowStart : today);
  const sat = new Date(base); sat.setDate(base.getDate() + ((6 - base.getDay() + 7) % 7));
  return { start: isoOf(sat), count: 1, hours: ['morning', 'afternoon', 'evening'], interests: [], who: null, town: data.topTowns[0] || 'Kingston', radius: 30, meals: { breakfast: 'skip', lunch: 'out', dinner: 'out' }, cuisine: 'Any', budget: null, pace: 'balanced', pinned: [], wellnessFill: false };
}
const load = () => { try { return JSON.parse(localStorage.getItem('cg-prefs') || 'null'); } catch { return null; } };
const save = () => { try { const { pinned, ...rest } = prefs; localStorage.setItem('cg-prefs', JSON.stringify(rest)); } catch {} };
const daysOf = p => Array.from({ length: p.count }, (_, i) => { const d = dateObj(p.start); d.setDate(d.getDate() + i); return isoOf(d); });

// ---------- wizard ----------
function renderSteps() {
  $('#steps').innerHTML = STEPS.map((s, i) => `<li class="${i < step ? 'done' : i === step ? 'current' : ''}"><button data-step="${i}" ${i > step && !prefs._visited?.includes(i) ? 'disabled' : ''}><span class="step-n">${i < step ? svg('check') : i + 1}</span><span class="step-l">${s.label}</span></button></li>`).join('');
  $('#step-count').textContent = `Step ${step + 1} of ${STEPS.length}`;
  $('#back').style.visibility = step === 0 ? 'hidden' : 'visible';
  $('#next').innerHTML = step === STEPS.length - 1 ? `${svg('sparkle')} Build my day` : `Next ${svg('arrow')}`;
}
const choice = (attr, v, cur, label, extra = '') => `<button class="opt ${cur ? 'on' : ''}" data-${attr}="${esc(String(v))}" aria-pressed="${!!cur}">${extra}${label}</button>`;

function renderStep() {
  const s = STEPS[step].id; let h = '';
  if (s === 'when') {
    const weekends = []; const base = dateObj(today < data.windowStart ? data.windowStart : today);
    const sat = new Date(base); sat.setDate(base.getDate() + ((6 - base.getDay() + 7) % 7));
    for (let i = 0; i < 6; i++) { const d = new Date(sat); d.setDate(sat.getDate() + i * 7); if (isoOf(d) <= data.windowEnd) weekends.push(isoOf(d)); }
    h = `<h2 class="q">When are you going out?</h2>
      <div class="field"><span class="field-label">Quick picks</span><div class="opts">${weekends.map(w => choice('weekend', w, prefs.start === w && prefs.count === 2, `Weekend of ${fmtDate(w).replace(/^\w+, /, '')}`)).join('')}</div></div>
      <div class="field two">
        <label><span class="field-label">Start date</span><input type="date" id="w-start" class="select" min="${data.windowStart}" max="${data.windowEnd}" value="${prefs.start}"></label>
        <div><span class="field-label">How many days?</span><div class="stepper"><button data-count="-1" aria-label="Fewer days">−</button><b>${prefs.count} day${prefs.count > 1 ? 's' : ''}</b><button data-count="1" aria-label="More days">+</button></div></div>
      </div>
      <p class="field-hint">${daysOf(prefs).map(fmtDate).join(' · ')}</p>
      <div class="field"><span class="field-label">What times are you free?</span><div class="cards three">${HOURS.map(x => `<button class="card-opt ${prefs.hours.includes(x.v) ? 'on' : ''}" data-hour="${x.v}" aria-pressed="${prefs.hours.includes(x.v)}">${svg(x.icon)}<b>${x.label}</b></button>`).join('')}</div></div>
      <details class="freetext"><summary>Prefer to type? Describe your day in your own words</summary>
        <form id="free-form"><input id="free" class="select" placeholder="I like live music and art, Dec 19–20, near Kingston, Italian dinner"><button class="btn btn-ghost" type="submit">Plan it</button></form></details>`;
  }
  if (s === 'what') {
    const counts = {}; for (const e of data.events) counts[e.category] = (counts[e.category] || 0) + 1;
    h = `<h2 class="q">What are you in the mood for?</h2><p class="q-sub">Pick as many as you like.</p>
      <div class="cards interest">${CATS.filter(c => counts[c]).map(c => { const [tint, icon] = STYLE[c]; const on = prefs.interests.includes(c); return `<button class="card-opt ${on ? 'on' : ''}" data-int="${esc(c)}" aria-pressed="${on}"><span class="ci t-${tint}">${svg(icon)}</span><b>${esc(c)}</b></button>`; }).join('')}</div>
      <button class="opt surprise ${!prefs.interests.length ? 'on' : ''}" data-int="__any">${svg('sparkle')} Surprise me with a mix</button>
      <label class="toggle wellness-toggle"><input type="checkbox" id="w-well" ${prefs.wellnessFill ? 'checked' : ''}><span><b>Open to yoga or pilates if there's a gap?</b><small>If part of your day is empty, we'll suggest a class or a nearby studio. Seats aren't guaranteed, so we'll flag anything that needs booking.</small></span></label>`;
  }
  if (s === 'who') {
    h = `<h2 class="q">Who's coming?</h2><div class="cards two">${WHO.map(w => `<button class="card-opt big ${prefs.who === w.v ? 'on' : ''}" data-who="${w.v}" aria-pressed="${prefs.who === w.v}">${svg(w.icon)}<b>${w.label}</b><span>${w.hint}</span></button>`).join('')}</div>`;
  }
  if (s === 'where') {
    const towns = [...data.topTowns, ...data.towns.filter(t => !data.topTowns.includes(t)).sort()];
    h = `<h2 class="q">Where are you starting from?</h2>
      <div class="field"><label><span class="field-label">Starting town</span><select id="w-town" class="select big">${towns.map(t => `<option ${prefs.town === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label></div>
      <div class="field"><span class="field-label">How far will you drive?</span><div class="opts">${RADII.map(r => choice('radius', r.v ?? 'any', prefs.radius === r.v, r.label)).join('')}</div></div>`;
  }
  if (s === 'meals') {
    const row = (k, label) => `<div class="meal-row"><b>${label}</b><div class="seg3">${[['out', 'Eat out'], ['home', 'At home'], ['skip', 'Skip']].map(([v, l]) => `<button class="${prefs.meals[k] === v ? 'on' : ''}" data-meal="${k}:${v}" aria-pressed="${prefs.meals[k] === v}">${l}</button>`).join('')}</div></div>`;
    const anyOut = Object.values(prefs.meals).includes('out');
    h = `<h2 class="q">What about meals?</h2><p class="q-sub">We'll fit meals around your plans and pick places close by.</p>
      <div class="meals">${row('breakfast', 'Breakfast')}${row('lunch', 'Lunch')}${row('dinner', 'Dinner')}</div>
      ${anyOut ? `<div class="field"><span class="field-label">Any cuisine you'd like?</span><div class="opts">${CUISINES.map(c => choice('cuisine', c, prefs.cuisine === c, c)).join('')}</div></div>` : ''}`;
  }
  if (s === 'budget') {
    h = `<h2 class="q">Budget and pace</h2>
      <div class="field"><span class="field-label">Ticket budget per person</span><div class="opts">${BUDGETS.map(b => choice('budget', b.v ?? 'any', prefs.budget === b.v, b.label)).join('')}</div></div>
      <div class="field"><span class="field-label">How full should the day be?</span><div class="cards three">${PACES.map(p => `<button class="card-opt ${prefs.pace === p.v ? 'on' : ''}" data-pace="${p.v}" aria-pressed="${prefs.pace === p.v}"><b>${p.label}</b><span>${p.hint}</span></button>`).join('')}</div></div>`;
  }
  $('#step-body').innerHTML = `<div class="step-anim">${h}</div>`;
  renderSteps(); renderSummary();
}

function renderSummary() {
  const it = (i, label, val) => `<li><button data-step="${i}"><span>${label}</span><b>${val}</b>${svg('edit')}</button></li>`;
  const ds = daysOf(prefs);
  const meals = Object.entries(prefs.meals).filter(([, v]) => v !== 'skip').map(([k, v]) => `${k[0].toUpperCase() + k.slice(1)} ${v === 'out' ? 'out' : 'at home'}`).join(', ') || 'No meals';
  const pinned = prefs.pinned.map(id => data.events.find(e => e.id === id)).filter(Boolean);
  $('#summary').innerHTML = `<div class="summary-card"><h2>Your day so far</h2><ul>
    ${it(0, 'When', `${ds.length > 1 ? fmtDate(ds[0]) + ' – ' + fmtDate(ds.at(-1)) : fmtDate(ds[0])}<small>${prefs.hours.length === 3 ? 'All day' : prefs.hours.map(h => h[0].toUpperCase() + h.slice(1)).join(', ')}</small>`)}
    ${it(1, 'What', (prefs.interests.length ? esc(prefs.interests.join(', ')) : 'A bit of everything') + (prefs.wellnessFill ? '<small>Yoga or pilates for gaps</small>' : ''))}
    ${it(2, 'Who', prefs.who ? WHO.find(w => w.v === prefs.who).label : '<i>Not picked yet</i>')}
    ${it(3, 'Where', `${esc(prefs.town)}<small>${prefs.radius ? 'Within ' + prefs.radius + ' min' : 'Anywhere in the county'}</small>`)}
    ${it(4, 'Meals', meals + (prefs.cuisine !== 'Any' && Object.values(prefs.meals).includes('out') ? `<small>${esc(prefs.cuisine)}</small>` : ''))}
    ${it(5, 'Budget', `${BUDGETS.find(b => b.v === prefs.budget).label}<small>${PACES.find(p => p.v === prefs.pace).label} pace</small>`)}
  </ul>${pinned.length ? `<div class="pinned"><span class="field-label">Must include</span>${pinned.map(e => `<span class="tag">${esc(e.title)}</span>`).join('')}</div>` : ''}</div>`;
}

// ---------- build plan ----------
function toParsed() {
  const cz = { 'Bakery & cafe': ['bakery', 'cafe', 'coffee', 'bagel'], 'Bar & pub': ['bar', 'pub'], 'Vegetarian': ['vegetarian', 'vegan'] };
  return {
    days: daysOf(prefs), notes: [], interests: prefs.interests, keywords: [], near: prefs.town,
    budget: prefs.budget === 'free' ? 0 : prefs.budget, cuisines: prefs.cuisine === 'Any' ? [] : (cz[prefs.cuisine] || [prefs.cuisine.toLowerCase()]),
    kids: prefs.who === 'family', dateNight: prefs.who === 'couple', hours: prefs.hours, radiusMin: prefs.radius, meals: prefs.meals,
    pace: prefs.pace === 'balanced' ? null : prefs.pace, wellnessFill: !!prefs.wellnessFill, pinned: prefs.pinned, exclude: swap.exclude, excludePlaces: swap.excludePlaces
  };
}

function build(animate = true) {
  save(); renderSummary();
  const plan = buildPlan(toParsed(), { events: data.events, places: data.places, studios: data.studios, townCenters: data.townCenters, windowStart: data.windowStart, windowEnd: data.windowEnd, windowLabel: data.windowLabel });
  lastPlan = plan;
  $('#wizard').hidden = true; $('#result').hidden = false;
  history.replaceState(null, '', '#p=' + btoa(unescape(encodeURIComponent(JSON.stringify(prefs)))));
  if (animate) {
    $('#result').innerHTML = `<div class="assembling"><span class="spinner"></span><p>Assembling your day…</p></div>`;
    setTimeout(() => renderResult(plan), 650);
  } else renderResult(plan);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function stopHTML(s, d, i) {
  const leg = i > 0 ? d.legs[i - 1] : null;
  let legHTML = '';
  if (leg) legHTML = `<div class="leg"><span>${leg.same ? 'Steps away' : leg.walk ? `${leg.miles} mi · short walk` : `${svg('car')} ${leg.minutes} min drive · ${leg.miles} mi`}</span></div>`;
  else if (i > 0 && s.type === 'home') legHTML = `<div class="leg"><span>${svg('car')} Head home</span></div>`;
  if (s.type === 'home') return legHTML + `<div class="stop"><div class="stop-time">${fmtTime(s.start)}</div><div class="stop-box home-box">${svg('home')}<div><div class="stop-kind">${s.meal}</div><h4>${s.meal} at home</h4></div></div></div>`;
  if (s.type === 'studio') {
    const st = s.item;
    return legHTML + `<div class="stop"><div class="stop-time">${fmtTime(s.start)}<small>approx.</small></div><div class="stop-box studio">
      <div class="stop-kind c-sage">Fits your gap · Drop-in option</div><h4>${esc(st.kinds.join(' / '))} at ${esc(st.name)}</h4><p>${esc(st.town)} · No class time listed here, so check their schedule first.</p>
      ${s.backup ? `<p class="backup">Backup: ${esc(s.backup.name)}, ${esc(s.backup.town)}</p>` : ''}
      <div class="stop-actions"><a href="${esc(studioLink(st))}" target="_blank" rel="noopener">${studioLinkLabel(st)}</a><a href="https://www.openstreetmap.org/?mlat=${st.lat}&mlon=${st.lng}#map=17/${st.lat}/${st.lng}" target="_blank" rel="noopener">Map</a><button class="swap" data-swap-place="${esc(st.id)}">${svg('swap')} Swap</button></div></div></div>`;
  }
  if (s.type === 'meal') {
    const p = s.item;
    return legHTML + `<div class="stop"><div class="stop-time">${fmtTime(s.start)}</div><div class="stop-box meal">
      <div class="stop-kind c-sage">${s.meal}</div><h4>${esc(p.name)}</h4><p>${esc([(p.cuisine || []).slice(0, 2).join(', '), p.town].filter(Boolean).join(' · '))}</p>
      <div class="stop-actions">${p.url ? `<a href="${esc(p.url)}" target="_blank" rel="noopener">Website</a>` : ''}<a href="https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lng}#map=17/${p.lat}/${p.lng}" target="_blank" rel="noopener">Map</a><button class="swap" data-swap-place="${esc(p.id)}">${svg('swap')} Swap</button></div></div></div>`;
  }
  const e = s.item; const [tint, icon] = STYLE[e.category] || STYLE.Community;
  return legHTML + `<div class="stop"><div class="stop-time">${s.flexible ? 'Afternoon<small>open hours</small>' : fmtTime(s.start) + (s.occ?.end ? `<small>to ${fmtTime(s.occ.end)}</small>` : '')}</div>
    <div class="stop-box ev"><button class="stop-open" data-id="${esc(e.id)}"><span class="stop-thumb t-${tint}">${svg(icon)}${e.image ? `<img src="${esc(e.image)}" alt="" loading="lazy" onerror="this.remove()">` : ''}</span>
      <span class="stop-txt"><span class="stop-kind c-${tint}">${s.wellness ? 'Fits your gap · ' : ''}${s.bonus ? 'Something different · ' : ''}${prefs.pinned.includes(e.id) ? 'Your pick · ' : ''}${esc(e.category)}</span><h4>${esc(e.title)}</h4><p>${esc([e.venue, e.town].filter(Boolean).join(' · '))}</p></span></button>
      <div class="stop-actions"><span class="tag ${e.priceMax === 0 ? 'tag-free' : ''}">${esc(e.price || 'Price not listed')}</span>${s.booking?.required ? `<span class="tag tag-book">Book ahead</span>` : ''}${e.ticketUrl ? `<a href="${esc(e.ticketUrl)}" target="_blank" rel="noopener">${s.booking?.required || s.wellness ? 'Check availability' : 'Tickets'}</a>` : (s.booking?.required || s.wellness) && e.url ? `<a href="${esc(e.url)}" target="_blank" rel="noopener">Check availability</a>` : ''}<button class="swap" data-swap="${esc(e.id)}">${svg('swap')} Swap</button></div></div></div>`;
}

function renderResult(plan) {
  const ds = daysOf(prefs); const t = plan.totals;
  const evCount = plan.days.reduce((n, d) => n + d.stops.filter(s => s.type === 'event').length, 0);
  const days = plan.days.map(d => `<div class="day"><h3>${fmtDateLong(d.date)}</h3>${d.stops.map((s, i) => stopHTML(s, d, i)).join('')}
    ${!d.stops.some(s => s.type === 'event') ? `<div class="alts">${d.alternatives.length ? `Nothing matched your answers this day. Also happening:${d.alternatives.map(a => `<button class="link" data-id="${esc(a.id)}">${esc(a.title)}</button>`).join('')}` : 'No events are listed this day yet.'}</div>` : ''}</div>`).join('');
  $('#result').innerHTML = `<div class="result-top">
      <div><p class="eyebrow">Your plan</p><h1 class="wizard-h1">${ds.length > 1 ? `${ds.length} days: ${fmtDate(ds[0])} – ${fmtDate(ds.at(-1))}` : fmtDateLong(ds[0])}</h1></div>
      <div class="result-actions no-print"><button class="btn btn-ghost" data-edit>${svg('edit')} Edit answers</button><button class="btn btn-ghost" data-copy>${svg('link')} Copy link</button><button class="btn btn-ghost" onclick="window.print()">${svg('print')} Print</button></div>
    </div>
    <div class="totals">
      <div class="total"><b>${t.tickets ? '$' + t.tickets + (t.unknown ? '+' : '') : (t.unknown ? 'Varies' : 'Free')}</b><span>tickets per person${t.unknown ? ` · ${t.unknown} not listed` : ''}</span></div>
      <div class="total"><b>${t.driveMin ? t.driveMin + ' min' : '—'}</b><span>driving · ${t.driveMi} mi</span></div>
      <div class="total"><b>${evCount}</b><span>event${evCount === 1 ? '' : 's'}</span></div>
      <div class="total"><b>${plan.days.reduce((n, d) => n + d.stops.filter(s => s.type === 'meal').length, 0)}</b><span>places to eat</span></div>
    </div>
    ${plan.notes.length ? `<div class="notes">${plan.notes.map(n => `<p>${esc(n)}</p>`).join('')}</div>` : ''}
    <div class="days">${days}</div>
    <p class="fine">Drive times are estimates. Check event times with the venue before you go.</p>`;
}

// ---------- detail ----------
function openDetail(id) {
  const e = data.events.find(x => x.id === id); if (!e) return;
  const [tint, icon] = STYLE[e.category] || STYLE.Community;
  $('#detail').innerHTML = `<button class="close" data-close aria-label="Close">${svg('x')}</button>
    <div class="detail-media t-${tint}">${svg(icon)}${e.image ? `<img src="${esc(e.image)}" alt="" onerror="this.remove()">` : ''}</div>
    <div class="detail-body"><div class="row-cat c-${tint}">${esc(e.category)}</div><h2 id="detail-title">${esc(e.title)}</h2>
    <dl class="facts"><dt>${svg('pin')}</dt><dd><b>${esc(e.venue)}</b>${e.address ? '<br>' + esc(e.address) : ''}</dd>${e.price ? `<dt>${svg('ticket')}</dt><dd>${esc(e.price)}</dd>` : ''}</dl>
    ${e.description ? `<p class="desc">${esc(e.description)}</p>` : ''}
    <div class="detail-actions">${e.ticketUrl ? `<a class="btn btn-primary" href="${esc(e.ticketUrl)}" target="_blank" rel="noopener">Get tickets</a>` : ''}${e.url ? `<a class="btn btn-ghost" href="${esc(e.url)}" target="_blank" rel="noopener">View on Chronogram</a>` : ''}</div></div>`;
  $('#detail').showModal();
}

// ---------- wiring ----------
function go(n) { prefs._visited = [...new Set([...(prefs._visited || []), step, n])]; step = Math.max(0, Math.min(STEPS.length - 1, n)); $('#wizard').hidden = false; $('#result').hidden = true; renderStep(); }

function wire() {
  $('#next').onclick = () => {
    if (STEPS[step].id === 'who' && !prefs.who) { prefs.who = 'solo'; }
    if (step === STEPS.length - 1) build(); else go(step + 1);
  };
  $('#back').onclick = () => go(step - 1);
  document.addEventListener('keydown', e => {
    if ($('#wizard').hidden || e.target.matches('input, select, textarea') || $('#detail').open) return;
    if (e.key === 'ArrowRight' || (e.key === 'Enter' && !e.target.matches('button'))) $('#next').click();
    if (e.key === 'ArrowLeft' && step > 0) $('#back').click();
  });
  document.addEventListener('change', e => {
    if (e.target.id === 'w-start' && e.target.value) { prefs.start = e.target.value; renderStep(); }
    if (e.target.id === 'w-town') { prefs.town = e.target.value; renderSummary(); }
    if (e.target.id === 'w-well') { prefs.wellnessFill = e.target.checked; renderSummary(); }
  });
  document.addEventListener('submit', e => {
    if (e.target.id !== 'free-form') return; e.preventDefault();
    const q = $('#free').value.trim(); if (!q) return;
    const p = parseQuery(q, { today: dateObj(today < data.windowStart ? data.windowStart : today), towns: data.towns });
    if (p.days.length) { prefs.start = p.days[0]; prefs.count = Math.min(4, p.days.length); }
    if (p.interests.length) prefs.interests = p.interests.filter(c => c !== 'Family');
    if (p.near) prefs.town = p.near;
    if (p.budget != null) prefs.budget = p.budget === 0 ? 'free' : p.budget <= 25 ? 25 : p.budget <= 50 ? 50 : null;
    if (p.kids) prefs.who = 'family'; else if (p.dateNight) prefs.who = 'couple';
    if (p.cuisines.length) { const c = CUISINES.find(x => x.toLowerCase() === p.cuisines[0]); if (c) prefs.cuisine = c; }
    build();
  });
  document.addEventListener('click', e => {
    const t = e.target.closest('button, [data-id]'); if (!t) { if (e.target.matches('dialog')) e.target.close(); return; }
    const d = t.dataset;
    if (d.step !== undefined) { if ($('#result').hidden === false || +d.step <= step || prefs._visited?.includes(+d.step)) go(+d.step); return; }
    if (d.weekend) { prefs.start = d.weekend; prefs.count = 2; renderStep(); return; }
    if (d.count) { prefs.count = Math.max(1, Math.min(4, prefs.count + +d.count)); renderStep(); return; }
    if (d.hour) { const h = prefs.hours; prefs.hours = h.includes(d.hour) ? (h.length > 1 ? h.filter(x => x !== d.hour) : h) : [...h, d.hour]; renderStep(); return; }
    if (d.int) { prefs.interests = d.int === '__any' ? [] : prefs.interests.includes(d.int) ? prefs.interests.filter(x => x !== d.int) : [...prefs.interests, d.int]; renderStep(); return; }
    if (d.who) { prefs.who = d.who; renderStep(); setTimeout(() => go(step + 1), 250); return; }
    if (d.radius) { prefs.radius = d.radius === 'any' ? null : +d.radius; renderStep(); return; }
    if (d.meal) { const [k, v] = d.meal.split(':'); prefs.meals = { ...prefs.meals, [k]: v }; renderStep(); return; }
    if (d.cuisine) { prefs.cuisine = d.cuisine; renderStep(); return; }
    if (d.budget) { prefs.budget = d.budget === 'any' ? null : d.budget === 'free' ? 'free' : +d.budget; renderStep(); return; }
    if (d.pace) { prefs.pace = d.pace; renderStep(); return; }
    if (d.swap) { swap.exclude.push(d.swap); prefs.pinned = prefs.pinned.filter(x => x !== d.swap); build(false); return; }
    if (d.swapPlace) { swap.excludePlaces.push(d.swapPlace); build(false); return; }
    if (d.edit !== undefined) { swap = { exclude: [], excludePlaces: [] }; go(0); return; }
    if (d.copy !== undefined) { navigator.clipboard?.writeText(location.href); t.innerHTML = `${svg('check')} Link copied`; return; }
    if (d.close !== undefined) { $('#detail').close(); return; }
    if (d.id) openDetail(d.id);
  });
}

(async function init() {
  data = await loadData(); today = todayISO();
  prefs = { ...defaults(), ...(load() || {}), pinned: [] };
  if (prefs.start < data.windowStart || prefs.start > data.windowEnd || prefs.start < today) prefs.start = defaults().start;
  const qs = new URLSearchParams(location.search);
  const from = today < data.windowStart ? data.windowStart : today;
  const nextOcc = e => e.occurrences.find(o => o.date >= from);
  if (qs.get('around')) {
    const e = data.events.find(x => x.id === qs.get('around'));
    if (e && nextOcc(e)) { prefs.pinned = [e.id]; prefs.start = nextOcc(e).date; prefs.count = 1; if (e.town && data.townCenters[e.town]) prefs.town = e.town; }
  }
  if (qs.get('bag')) {
    const items = bag.get().map(id => data.events.find(e => e.id === id)).filter(e => e && nextOcc(e));
    if (items.length) {
      prefs.pinned = items.map(e => e.id);
      const dates = [...new Set(items.map(e => nextOcc(e).date))].sort();
      prefs.start = dates[0]; prefs.count = Math.min(4, Math.round((dateObj(dates.at(-1)) - dateObj(dates[0])) / 864e5) + 1);
      if (items[0].town && data.townCenters[items[0].town]) prefs.town = items[0].town;
    }
  }
  const hp = location.hash.match(/#p=(.+)/);
  wire();
  if (hp) { try { prefs = { ...defaults(), ...JSON.parse(decodeURIComponent(escape(atob(hp[1])))) }; prefs.pinned ||= []; renderSummary(); build(false); return; } catch {} }
  renderStep();
})();
