import { parseQuery, buildPlan, looksLikePlan, INTERESTS } from './planner.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const CATS = ['All', 'Music', 'Film', 'Arts & Culture', 'Theater & Comedy', 'Food & Drink', 'Family', 'Outdoors', 'Markets & Festivals', 'Classes & Workshops', 'Talks & Literary', 'Wellness', 'Community'];
const STYLE = {
  'Music': ['sand', 'music'], 'Film': ['stone', 'film'], 'Arts & Culture': ['rust', 'palette'], 'Theater & Comedy': ['rust', 'mask'],
  'Food & Drink': ['sage', 'fork'], 'Family': ['sand', 'family'], 'Outdoors': ['sage', 'tree'], 'Markets & Festivals': ['sand', 'bag'],
  'Classes & Workshops': ['stone', 'pencil'], 'Talks & Literary': ['stone', 'book'], 'Wellness': ['sage', 'leaf'], 'Community': ['stone', 'home']
};
const ICONS = {
  music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  film: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M7 4v16M17 4v16M2 9h5M2 15h5M17 9h5M17 15h5"/>',
  palette: '<path d="M12 22a10 10 0 1 1 10-10c0 2.8-2.2 4-4 4h-1.5a2 2 0 0 0-1.5 3.3A2 2 0 0 1 12 22z"/><circle cx="7.5" cy="10.5" r="1"/><circle cx="12" cy="7" r="1"/><circle cx="16.5" cy="10.5" r="1"/>',
  mask: '<path d="M3 4h18v6a9 9 0 0 1-18 0z"/><path d="M8 9h.01M16 9h.01M8 14s1.5 2 4 2 4-2 4-2"/>',
  fork: '<path d="M7 2v9M4 2v5a3 3 0 0 0 6 0V2M7 11v11M17 2c-2 2-3 5-3 8h3v12"/>',
  family: '<circle cx="8" cy="6" r="3"/><circle cx="17" cy="8" r="2"/><path d="M3 21v-4a5 5 0 0 1 10 0v4M14 21v-3a3 3 0 0 1 6 0v3"/>',
  tree: '<path d="m12 2-7 10h4l-4 6h14l-4-6h4z"/><path d="M12 18v4"/>',
  bag: '<path d="M5 8h14l-1 13H6z"/><path d="M9 8a3 3 0 0 1 6 0"/>',
  pencil: '<path d="M17 3l4 4L8 20H4v-4z"/>',
  book: '<path d="M4 4h6a3 3 0 0 1 3 3v14a2 2 0 0 0-2-2H4zM20 4h-6a3 3 0 0 0-3 3"/><path d="M20 4v15h-7"/>',
  leaf: '<path d="M11 20A7 7 0 0 1 4 13C4 7 9 3 20 3c0 11-4 17-9 17z"/><path d="M4 21c4-6 8-9 12-11"/>',
  home: '<path d="M3 11 12 3l9 8v10H3z"/><path d="M9 21v-6h6v6"/>',
  pin: '<path d="M12 22s7-7 7-12a7 7 0 0 0-14 0c0 5 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  ticket: '<path d="M3 8a2 2 0 0 0 0 4v4h18v-4a2 2 0 0 0 0-4V4H3z" transform="translate(0 2)"/>'
};
const svg = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ICONS.home}</svg>`;

const state = { events: [], places: [], meta: null, cat: 'All', date: 'all', customDate: '', town: 'all', text: '', shown: 24, townCenters: {}, towns: [], today: null };

// ---------- helpers ----------
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const dateObj = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, 12); };
const isoOf = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fmtDate = s => { const d = dateObj(s); return `${DOW[d.getDay()]}, ${MON[d.getMonth()]} ${d.getDate()}`; };
const fmtDateLong = s => dateObj(s).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
function fmtTime(t) {
  if (!t) return '';
  let [h, m] = t.split(':').map(Number); const ap = h >= 12 ? 'pm' : 'am'; h = h % 12 || 12;
  return m ? `${h}:${String(m).padStart(2, '0')}${ap}` : `${h}${ap}`;
}
const timeRange = o => o.start ? fmtTime(o.start) + (o.end && o.end !== o.start ? '–' + fmtTime(o.end) : '') : '';

function nextOcc(e) {
  const from = state.dateFrom || state.today;
  return e.occurrences.find(o => o.date >= from) || e.occurrences[e.occurrences.length - 1];
}
function priceLabel(e) { return e.price || ''; }

// ---------- data ----------
async function load() {
  const get = (u, d) => fetch(u, { cache: 'no-cache' }).then(r => r.ok ? r.json() : d).catch(() => d);
  const [events, places, meta] = await Promise.all([get('data/events.json', []), get('data/places.json', []), get('data/meta.json', null)]);
  state.events = events; state.places = places; state.meta = meta;
  const now = new Date(); state.today = isoOf(now);
  state.windowStart = meta?.windowStart || '2026-12-01'; state.windowEnd = meta?.windowEnd || '2027-05-31';
  state.windowLabel = `${fmtMonthYear(state.windowStart)} – ${fmtMonthYear(state.windowEnd)}`;
  $('#window-label').textContent = state.windowLabel;

  // town centers (average of known coordinates), used for "near X"
  const acc = {};
  for (const x of [...events, ...places]) {
    if (!x.town || x.lat == null) continue;
    (acc[x.town] ||= { lat: 0, lng: 0, n: 0, ev: 0 });
    acc[x.town].lat += x.lat; acc[x.town].lng += x.lng; acc[x.town].n++;
    if (x.occurrences) acc[x.town].ev++;
  }
  for (const [t, a] of Object.entries(acc)) state.townCenters[t] = { lat: a.lat / a.n, lng: a.lng / a.n };
  state.towns = Object.keys(acc);
  state.topTowns = Object.entries(acc).filter(([, a]) => a.ev).sort((a, b) => b[1].ev - a[1].ev).slice(0, 10).map(([t]) => t);

  if (meta?.updatedAt) $('#updated').textContent = `Data last updated ${new Date(meta.updatedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })} · ${meta.counts.events} events · ${meta.counts.places} places to eat.`;
}
const fmtMonthYear = s => { const d = dateObj(s); return `${MON[d.getMonth()]} ${d.getFullYear()}`; };

// ---------- filters ----------
function dateRangeFor(key) {
  const t = dateObj(state.today);
  if (key === 'weekend') { const sat = new Date(t); sat.setDate(t.getDate() + ((6 - t.getDay() + 7) % 7) - (t.getDay() === 0 ? 7 : 0)); const sun = new Date(sat); sun.setDate(sat.getDate() + 1); return [isoOf(t.getDay() === 0 ? t : sat), isoOf(sun)]; }
  if (key === 'custom' && state.customDate) return [state.customDate, state.customDate];
  if (/^\d{4}-\d{2}$/.test(key)) { const [y, m] = key.split('-').map(Number); return [`${key}-01`, isoOf(new Date(y, m, 0))]; }
  return [state.today, '9999-12-31'];
}
function filtered() {
  const [from, to] = dateRangeFor(state.date);
  state.dateFrom = from;
  const words = state.text.toLowerCase().split(/\s+/).filter(w => w.length > 1);
  return state.events.filter(e => {
    if (state.cat !== 'All' && e.category !== state.cat) return false;
    if (state.town !== 'all' && e.town !== state.town) return false;
    if (!e.occurrences.some(o => o.date >= from && o.date <= to)) return false;
    if (words.length) {
      const hay = (e.title + ' ' + e.venue + ' ' + e.town + ' ' + e.category + ' ' + e.rawCategory + ' ' + e.description).toLowerCase();
      if (!words.every(w => hay.includes(w))) return false;
    }
    return true;
  }).sort((a, b) => {
    const oa = a.occurrences.find(o => o.date >= from), ob = b.occurrences.find(o => o.date >= from);
    // one-off events before long-running exhibits on the same day
    return (oa.date + (a.ongoing ? 'z' : (oa.start || 'y'))).localeCompare(ob.date + (b.ongoing ? 'z' : (ob.start || 'y')));
  });
}

function renderChips() {
  $('#cat-chips').innerHTML = CATS.map(c => `<button class="chip" data-cat="${esc(c)}" aria-pressed="${state.cat === c}">${esc(c)}</button>`).join('');
  const months = []; for (let d = dateObj(state.windowStart); isoOf(d) <= state.windowEnd; d = new Date(d.getFullYear(), d.getMonth() + 1, 1, 12)) months.push(isoOf(d).slice(0, 7));
  const dateBtns = [['all', 'All dates'], ['weekend', 'This weekend'], ...months.map(m => [m, MON[+m.slice(5) - 1] + (m.endsWith('-01') ? ' ' + m.slice(0, 4) : '')])];
  $('#date-chips').innerHTML = dateBtns.map(([k, l]) => `<button class="chip" data-date="${k}" aria-pressed="${state.date === k}">${l}</button>`).join('') +
    `<label class="chip" aria-pressed="${state.date === 'custom'}">Pick a day <input type="date" id="pick" min="${state.windowStart}" max="${state.windowEnd}" value="${state.customDate}"></label>`;
  $('#town-chips').innerHTML = `<button class="chip" data-town="all" aria-pressed="${state.town === 'all'}">All towns</button>` +
    (state.topTowns || []).map(t => `<button class="chip" data-town="${esc(t)}" aria-pressed="${state.town === t}">${esc(t)}</button>`).join('');
}

function cardHTML(e) {
  const o = nextOcc(e); const d = dateObj(o.date);
  const [tint, icon] = STYLE[e.category] || STYLE.Community;
  const when = e.ongoing ? (e.when || `Through ${fmtDate(e.occurrences.at(-1).date)}`) : `${fmtDate(o.date)}${o.start ? ' · ' + timeRange(o) : ''}`;
  const more = !e.ongoing && e.occurrences.length > 1 ? ` <span class="tag">+${e.occurrences.length - 1} more date${e.occurrences.length > 2 ? 's' : ''}</span>` : '';
  return `<button class="card" data-id="${esc(e.id)}">
    <div class="card-media t-${tint}">
      ${e.image ? `<img src="${esc(e.image)}" alt="" loading="lazy" onerror="this.remove()">` : ''}${svg(icon)}
      <div class="date-badge"><b>${MON[d.getMonth()].toUpperCase()}</b><span>${d.getDate()}</span></div>
      ${priceLabel(e) ? `<div class="price-badge">${esc(priceLabel(e))}</div>` : ''}
    </div>
    <div class="card-body">
      <div class="card-cat c-${tint}">${esc(e.category)}</div>
      <h3>${esc(e.title)}</h3>
      <div class="meta">${svg('pin')}<span>${esc([e.venue, e.town].filter(Boolean).join(' · '))}</span></div>
      <div class="meta">${svg('clock')}<span>${esc(when)}${more}</span></div>
      <div class="card-foot"><i>Ulster County</i><b>Details →</b></div>
    </div>
  </button>`;
}
// image sits above the placeholder icon; if it fails to load, the icon shows
const fixStacking = () => document.querySelectorAll('.card-media img').forEach(img => { img.style.position = 'absolute'; img.style.inset = '0'; });

function renderGrid() {
  const list = filtered();
  const titleBits = [];
  if (state.cat !== 'All') titleBits.push(state.cat);
  $('#list-title').textContent = state.text ? `Results for “${state.text}”` : (titleBits.length ? `${titleBits[0]} in ${state.town === 'all' ? 'Ulster County' : state.town}` : `Coming up in ${state.town === 'all' ? 'Ulster County' : state.town}`);
  $('#count').textContent = `${list.length} event${list.length === 1 ? '' : 's'} found`;
  if (!state.events.length) {
    $('#grid').innerHTML = `<div class="empty"><h3>The calendar is loading its first batch of events</h3><p>Events from Chronogram appear after the first automatic update runs. Check back shortly.</p></div>`;
  } else if (!list.length) {
    $('#grid').innerHTML = `<div class="empty"><h3>Nothing matches yet</h3><p>Try another category or date, or <button class="link" id="reset">clear all filters</button>.</p></div>`;
  } else {
    $('#grid').innerHTML = list.slice(0, state.shown).map(cardHTML).join('');
    fixStacking();
  }
  $('#more').hidden = list.length <= state.shown;
}

// ---------- detail ----------
function openDetail(id) {
  const e = state.events.find(x => x.id === id); if (!e) return;
  const [tint, icon] = STYLE[e.category] || STYLE.Community;
  const upcoming = e.occurrences.filter(o => o.date >= state.today);
  const dates = e.ongoing
    ? `<div class="meta">${svg('clock')}<span>${esc(e.when || `${fmtDate(e.occurrences[0].date)} – ${fmtDate(e.occurrences.at(-1).date)}`)}</span></div>`
    : `<div class="meta">${svg('clock')}<span>${upcoming.length > 1 ? 'Upcoming dates:' : esc(fmtDateLong((upcoming[0] || e.occurrences[0]).date) + (upcoming[0]?.start ? ' · ' + timeRange(upcoming[0]) : ''))}</span></div>
       ${upcoming.length > 1 ? `<div class="dates-list">${upcoming.slice(0, 16).map(o => `<span class="tag">${fmtDate(o.date)}${o.start ? ' · ' + timeRange(o) : ''}</span>`).join('')}${upcoming.length > 16 ? `<span class="tag">+${upcoming.length - 16} more</span>` : ''}</div>` : ''}`;
  const mapQ = encodeURIComponent([e.venue, e.address].filter(Boolean).join(', '));
  $('#detail').innerHTML = `
    <button class="close" aria-label="Close" data-close>×</button>
    <div class="detail-media t-${tint}">${e.image ? `<img src="${esc(e.image)}" alt="" onerror="this.remove()">` : svg(icon)}</div>
    <div class="detail-body">
      <div class="card-cat c-${tint}">${esc(e.category)}</div>
      <h2 id="detail-title">${esc(e.title)}</h2>
      ${dates}
      <div class="meta">${svg('pin')}<span>${esc(e.venue)}${e.address ? '<br>' + esc(e.address) : ''}</span></div>
      ${e.price ? `<div class="meta">${svg('ticket')}<span>${esc(e.price)}</span></div>` : ''}
      ${e.description ? `<p class="desc">${esc(e.description)}</p>` : ''}
      <div class="detail-actions">
        ${e.ticketUrl ? `<a class="btn btn-primary" href="${esc(e.ticketUrl)}" target="_blank" rel="noopener">Get tickets</a>` : ''}
        ${e.url ? `<a class="btn btn-ghost" href="${esc(e.url)}" target="_blank" rel="noopener">View on ${e.source === 'Chronogram' ? 'Chronogram' : 'source'}</a>` : ''}
        ${mapQ ? `<a class="btn btn-ghost" href="https://www.openstreetmap.org/search?query=${mapQ}" target="_blank" rel="noopener">Map</a>` : ''}
        <button class="btn btn-ghost" data-plan-around="${esc(e.id)}">Plan a day around this</button>
      </div>
    </div>`;
  $('#detail').showModal();
}

// ---------- planner UI ----------
function renderPlan(query) {
  const parsed = parseQuery(query, { today: dateObj(state.today), towns: state.towns });
  const plan = buildPlan(parsed, { events: state.events, places: state.places, townCenters: state.townCenters, windowStart: state.windowStart, windowEnd: state.windowEnd, windowLabel: state.windowLabel });
  const el = $('#plan'); el.hidden = false;
  const nDays = parsed.days.length;
  const head = nDays
    ? `Your ${nDays}-day plan${nDays > 1 ? '' : ''}: ${fmtDate(parsed.days[0])}${nDays > 1 ? ' – ' + fmtDate(parsed.days.at(-1)) : ''}`
    : 'Let\'s pick your dates';
  const understood = [
    ...parsed.days.length ? [`<span class="tag rust">${nDays} day${nDays > 1 ? 's' : ''}</span>`] : [],
    ...parsed.interests.map(i => `<span class="tag rust">${esc(i)}</span>`),
    parsed.near ? `<span class="tag">near ${esc(parsed.near)}</span>` : '',
    parsed.budget != null ? `<span class="tag">${parsed.budget === 0 ? 'free only' : 'under $' + parsed.budget}</span>` : '',
    ...parsed.cuisines.map(c => `<span class="tag">${esc(c)} food</span>`)
  ].join('');
  const t = plan.totals;
  const daysHTML = plan.days.map(d => {
    const parts = [];
    d.stops.forEach((s, i) => {
      if (i > 0) {
        const l = d.legs[i - 1];
        if (l) parts.push(`<div class="leg"><div></div><span>${l.same ? 'Steps away' : l.walk ? `${l.miles} mi · short walk` : `🚗 ${l.minutes} min drive · ${l.miles} mi`}</span></div>`);
      }
      if (s.type === 'meal') {
        const p = s.item;
        parts.push(`<div class="stop"><div class="stop-time">${fmtTime(s.start)}</div>
          <div class="stop-box meal"><div class="stop-kind c-sage">${s.meal}</div><h4>${esc(p.name)}</h4>
          <p>${esc([(p.cuisine || []).slice(0, 2).join(', '), p.town].filter(Boolean).join(' · '))}</p>
          <div class="row">${p.url ? `<a href="${esc(p.url)}" target="_blank" rel="noopener">Website →</a>` : ''}<a href="https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lng}#map=17/${p.lat}/${p.lng}" target="_blank" rel="noopener">Map →</a></div></div></div>`);
      } else {
        const e = s.item; const [tint] = STYLE[e.category] || STYLE.Community;
        parts.push(`<div class="stop"><div class="stop-time">${s.flexible ? 'Afternoon<small>open hours</small>' : fmtTime(s.start) + (s.occ?.end ? `<small>to ${fmtTime(s.occ.end)}</small>` : '')}</div>
          <div class="stop-box" data-id="${esc(e.id)}" role="button" tabindex="0"><div class="stop-kind c-${tint}">${s.bonus ? 'Something different · ' : ''}${esc(e.category)}</div><h4>${esc(e.title)}</h4>
          <p>${esc([e.venue, e.town].filter(Boolean).join(' · '))}</p>
          <div class="row"><span>${esc(e.price || 'Price not listed')}</span>${e.ticketUrl ? `<a href="${esc(e.ticketUrl)}" target="_blank" rel="noopener">Tickets →</a>` : ''}</div></div></div>`);
      }
    });
    if (!d.stops.some(s => s.type === 'event')) {
      parts.push(`<div class="alts">${d.alternatives.length ? `Nothing matched your interests this day. Other things happening:` + d.alternatives.map(a => `<button class="link" data-id="${esc(a.id)}">${esc(a.title)}</button>`).join('') : 'No events listed this day yet.'}</div>`);
    }
    return `<div class="day"><h3>${fmtDateLong(d.date)}</h3>${parts.join('')}</div>`;
  }).join('');

  el.innerHTML = `<div class="plan-card">
    <div class="plan-top">
      <div><h2>${esc(head)}</h2><div class="understood">What I picked up: ${understood || '<span class="tag">nothing specific yet</span>'}</div></div>
      <div class="plan-actions"><button class="btn btn-ghost btn-small" id="share">Copy link</button><button class="btn btn-ghost btn-small" onclick="window.print()">Print</button><button class="btn btn-ghost btn-small" id="close-plan">Close</button></div>
    </div>
    ${nDays ? `<div class="totals">
      <div class="total"><b>${t.tickets ? '$' + t.tickets + (t.unknown ? '+' : '') : (t.unknown ? 'Varies' : 'Free')}</b><span>tickets per person${t.unknown ? ` · ${t.unknown} price${t.unknown > 1 ? 's' : ''} not listed` : ''}</span></div>
      <div class="total"><b>${t.driveMin ? t.driveMin + ' min' : '—'}</b><span>total driving · ${t.driveMi} mi</span></div>
      <div class="total"><b>${plan.days.reduce((n, d) => n + d.stops.filter(s => s.type === 'event').length, 0)}</b><span>events picked</span></div>
      <div class="total"><b>${plan.days.reduce((n, d) => n + d.stops.filter(s => s.type === 'meal').length, 0)}</b><span>meal stops</span></div>
    </div>` : ''}
    ${plan.notes.length ? `<div class="notes">${plan.notes.map(n => `<p>${esc(n)}</p>`).join('')}</div>` : ''}
    ${nDays ? `<div class="days">${daysHTML}</div>` : ''}
  </div>`;
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  return parsed;
}

// ---------- wiring ----------
function runQuery(q, { push = true } = {}) {
  q = q.trim();
  $('#q').value = q; autosize();
  if (push) history.replaceState(null, '', q ? '#q=' + encodeURIComponent(q) : location.pathname);
  if (!q) { $('#plan').hidden = true; state.text = ''; renderGrid(); return; }
  if (looksLikePlan(q) || q.split(/\s+/).length > 4) {
    const parsed = renderPlan(q);
    // also narrow the grid underneath to what we understood
    state.text = '';
    state.cat = parsed.interests.length === 1 ? parsed.interests[0] : 'All';
    if (parsed.days.length) { state.date = 'custom'; state.customDate = parsed.days[0]; }
    state.town = parsed.near && state.topTowns.includes(parsed.near) ? parsed.near : 'all';
  } else {
    $('#plan').hidden = true;
    state.text = q; state.cat = 'All'; state.date = 'all'; state.town = 'all';
    document.getElementById('discover').scrollIntoView({ behavior: 'smooth' });
  }
  state.shown = 24; renderChips(); renderGrid();
}

function autosize() { const t = $('#q'); t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 140) + 'px'; }

function wire() {
  $('#search-form').addEventListener('submit', e => { e.preventDefault(); runQuery($('#q').value); });
  $('#q').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); runQuery($('#q').value); } });
  $('#q').addEventListener('input', () => { autosize(); $('#go').textContent = looksLikePlan($('#q').value) || $('#q').value.split(/\s+/).length > 4 ? 'Plan it' : 'Search'; });
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-q],[data-cat],[data-date],[data-town],[data-id],[data-close],[data-plan-around],#more,#reset,#share,#close-plan,[data-focus-search]');
    if (!t) { if (e.target === $('#detail')) $('#detail').close(); return; }
    if (t.dataset.q) { runQuery(t.dataset.q); return; }
    if (t.dataset.cat) { state.cat = t.dataset.cat; state.text = ''; }
    else if (t.dataset.date) { state.date = t.dataset.date; }
    else if (t.dataset.town) { state.town = t.dataset.town; }
    else if (t.dataset.planAround) {
      const ev = state.events.find(x => x.id === t.dataset.planAround); $('#detail').close();
      const o = nextOcc(ev); runQuery(`${ev.category} on ${o.date}${ev.town ? ' near ' + ev.town : ''}`);
      return;
    }
    else if (t.dataset.id) { openDetail(t.dataset.id); return; }
    else if (t.dataset.close !== undefined) { $('#detail').close(); return; }
    else if (t.id === 'more') { state.shown += 24; renderGrid(); return; }
    else if (t.id === 'reset') { Object.assign(state, { cat: 'All', date: 'all', town: 'all', text: '' }); }
    else if (t.id === 'share') { navigator.clipboard?.writeText(location.href); t.textContent = 'Link copied'; return; }
    else if (t.id === 'close-plan') { $('#plan').hidden = true; history.replaceState(null, '', location.pathname); return; }
    else if (t.dataset.focusSearch !== undefined) { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); $('#q').focus(); return; }
    state.shown = 24; renderChips(); renderGrid();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('.stop-box[data-id]')) openDetail(e.target.dataset.id); });
  document.addEventListener('change', e => {
    if (e.target.id === 'pick') { state.customDate = e.target.value; state.date = e.target.value ? 'custom' : 'all'; state.shown = 24; renderChips(); renderGrid(); }
  });
  // rotating example in the placeholder: shows people they can plan, not just search
  const examples = ['Try: I like music and movies, plan Dec 19–20 near Kingston', 'Try: Free things to do with kids this weekend', 'Try: Jazz and dinner in Woodstock on New Year\'s Eve', 'Try: 2 days of art and theater in January, under $50', 'Try: Date night in New Paltz on Valentine\'s Day, Thai food'];
  let i = 0; setInterval(() => { if (!$('#q').value && document.activeElement !== $('#q')) $('#q').placeholder = examples[++i % examples.length]; }, 4000);
}

(async function init() {
  await load();
  wire(); renderChips(); renderGrid();
  const h = decodeURIComponent((location.hash.match(/#q=(.*)/) || [])[1] || '');
  if (h) runQuery(h, { push: false });
})();
