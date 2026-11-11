import { $, esc, MON, MONTH_LONG, CATS, STYLE, svg, studioLink, dateObj, isoOf, fmtDate, fmtDateLong, timeRange, todayISO, loadData, bag, dotGrid } from './common.js';
import { buildIndex, parseSearch, runSearch, pills, hasMeaning } from './search.js';
import { bookingOf, drive } from './planner.js';

const PAGE = 40;
let data, idx, today, f, shown = PAGE;

const emptyFilter = () => ({ specificCats: [], cats: [], audience: null, days: null, dayLabel: null, town: null, near: false, time: null, free: false, cheap: false, keywords: [], interestKeywords: [], region: null, notes: [], corrected: [], raw: '' });

// ---------- rendering ----------
function rowHTML(r, showDate = false) {
  const e = r.e, o = r.occ, [tint, icon] = STYLE[e.category] || STYLE.Community;
  const saved = bag.has(e.id);
  const time = e.ongoing ? 'Open hours' : (o.start ? timeRange(o) : 'All day');
  const more = !e.ongoing && e.occurrences.length > 1 ? `<span class="tag">+${e.occurrences.length - 1} more date${e.occurrences.length > 2 ? 's' : ''}</span>` : '';
  return `<article class="row" data-id="${esc(e.id)}" tabindex="0" aria-label="${esc(e.title)}">
    <div class="row-time">${showDate ? `<span class="row-date">${esc(fmtDate(o.date))}</span>` : ''}<b>${esc(time.split('–')[0])}</b>${o.start && o.end ? `<span>to ${esc(time.split('–')[1] || '')}</span>` : ''}</div>
    <div class="row-thumb t-${tint}">${svg(icon)}${e.image ? `<img src="${esc(e.image)}" alt="" loading="lazy" onerror="this.remove()">` : ''}</div>
    <div class="row-main">
      <div class="row-cat c-${tint}">${esc(e.category)}</div>
      <h3>${esc(e.title)}</h3>
      <p class="row-meta">${svg('pin')}<span>${esc([e.venue, e.town].filter(Boolean).join(' · '))}</span></p>
      <div class="row-tags">${e.price ? `<span class="tag ${e.priceMax === 0 ? 'tag-free' : ''}">${esc(e.price)}</span>` : ''}${(b => b.soldOut ? '<span class="tag tag-sold">Sold out</span>' : b.required ? '<span class="tag tag-book">Book ahead</span>' : '')(bookingOf(e))}${r.nearby ? `<span class="tag tag-near">Nearby · ${r.minutes} min</span>` : ''}${more}</div>
    </div>
    <button class="save ${saved ? 'on' : ''}" data-save="${esc(e.id)}" aria-pressed="${saved}" aria-label="${saved ? 'Remove from my day' : 'Save for my day'}" title="${saved ? 'Saved for my day' : 'Save for my day'}">${svg(saved ? 'check' : 'plus')}</button>
  </article>`;
}

function render() {
  const hasF = hasMeaning(f);
  const p = pills(f);
  $('#understood').innerHTML = (p.length ? `<span class="understood-label">Showing</span>` + p.map((x, i) => `<button class="pill" data-pill="${i}" aria-label="Remove ${esc(x.label)}">${esc(x.label)} ${svg('x')}</button>`).join('') + `<button class="link clear" data-clear>Clear all</button>` : '');
  syncSidebar();
  const nF = pills(f).length; $('#filters-n').textContent = nF ? `${nF} active` : '';

  let notice = '';
  if (f.corrected.length) notice += `<p class="note">${svg('sparkle')} Showing results for <b>${esc(f.corrected.map(c => c.replace(/\b\w/g, m => m.toUpperCase())).join(', '))}</b>.</p>`;
  for (const n of f.notes) notice += `<p class="note">${esc(n)}</p>`;

  let results, title = 'Coming up';
  if (f.greeting || (f.raw && !hasF)) {
    notice += greetingBox(f.greeting ? 'Hi there!' : 'Let\'s find you something.');
    results = runSearch(emptyFilter(), data, idx, today).results; title = 'Coming up';
  } else {
    const r = runSearch(f, data, idx, today);
    if (r.nonsense) { notice += greetingBox(`Nothing matches “${esc(f.keywords.join(' '))}”.`); results = runSearch(emptyFilter(), data, idx, today).results; }
    else {
      results = r.results;
      if (r.relaxed) notice += `<p class="note note-warn">${esc(r.relaxed)}</p>`;
      if (hasF) title = 'Results';
      if (!results.length) notice += `<div class="empty"><h3>Nothing listed yet</h3><p>Try fewer filters, or <button class="link" data-clear>clear them all</button>.</p></div>`;
    }
  }
  $('#notice').innerHTML = notice;
  $('#results-title').textContent = title;
  if (!data.events.length) { $('#list').innerHTML = `<div class="empty"><h3>The calendar is loading its first events</h3><p>They appear after the first automatic update.</p></div>`; return; }

  // wellness searches also list studios (drop-in options without set class times)
  const wellnessQ = f.cats.includes('Wellness') || f.specificCats.includes('Wellness');
  let studios = [];
  if (wellnessQ && data.studios.length) {
    const kw = f.keywords.find(k => /yoga|pilates|barre|meditation|qigong|tai/.test(k));
    const anchor = f.town ? data.townCenters[f.town] : null;
    studios = data.studios.filter(s => !kw || s.kinds.some(k => k.toLowerCase().includes(kw.replace(/s$/, ''))) || s.name.toLowerCase().includes(kw))
      .filter(s => !f.town || s.town === f.town || (f.near && anchor && s.lat != null && drive(anchor, s).minutes <= 20));
  }
  const studiosHTML = studios.length ? `<div class="ongoing"><h3 class="group-title">Studios with regular classes <span>${studios.length}</span></h3><div class="ongoing-row">${studios.map(s => `<a class="mini" href="${esc(studioLink(s))}" target="_blank" rel="noopener"><span class="mini-thumb t-sage">${svg('leaf')}</span><span class="mini-body"><b>${esc(s.name)}</b><span>${esc(s.kinds.join(' / '))} · ${esc(s.town)} · check class times</span></span></a>`).join('')}</div></div>` : '';
  const ongoing = f.cheap || f.keywords.length ? [] : results.filter(r => r.e.ongoing);
  const dated = f.cheap || f.keywords.length ? results : results.filter(r => !r.e.ongoing);
  $('#count').textContent = `${results.length} event${results.length === 1 ? '' : 's'}`;

  $('#ongoing').innerHTML = studiosHTML + (ongoing.length ? `<div class="ongoing"><h3 class="group-title">Exhibitions and ongoing <span>${ongoing.length}</span></h3><div class="ongoing-row">${ongoing.map(r => {
    const e = r.e, [tint, icon] = STYLE[e.category] || STYLE.Community;
    return `<button class="mini" data-id="${esc(e.id)}"><span class="mini-thumb t-${tint}">${svg(icon)}${e.image ? `<img src="${esc(e.image)}" alt="" loading="lazy" onerror="this.remove()">` : ''}</span><span class="mini-body"><b>${esc(e.title)}</b><span>${esc(e.town || '')} · ${esc(e.when || 'Ongoing')}</span></span></button>`;
  }).join('')}</div></div>` : '');

  const list = dated.slice(0, shown);
  let html = '', last = null;
  const grouped = !(f.cheap || f.keywords.length);
  for (const r of list) {
    if (grouped && r.occ.date !== last) { last = r.occ.date; html += `<h3 class="day-head"><span>${fmtDateLong(r.occ.date)}</span></h3>`; }
    html += rowHTML(r, !grouped);
  }
  $('#list').innerHTML = html;
  $('#more').hidden = dated.length <= shown;
}

function greetingBox(head) {
  const ex = ['Music around Kingston', 'Family events in December', 'Free this weekend', 'Art in Woodstock', 'Theater tonight'];
  return `<div class="hello"><h3>${head}</h3><p>Search by what, where or when, or mix them. For example:</p><div class="hello-ex">${ex.map(x => `<button class="chip" data-q="${esc(x)}">${esc(x)}</button>`).join('')}</div><p class="hello-sub">Or let us <a href="plan.html">plan your whole day</a>. Meanwhile, here's what's coming up.</p></div>`;
}

// ---------- sidebar ----------
function buildSidebar() {
  const months = []; for (let d = dateObj(data.windowStart); isoOf(d) <= data.windowEnd; d = new Date(d.getFullYear(), d.getMonth() + 1, 1, 12)) months.push(isoOf(d).slice(0, 7));
  $('#f-when').innerHTML = `<button data-when="all">Any time</button><button data-when="weekend">This weekend</button>` + months.map(m => `<button data-when="${m}">${MON[+m.slice(5) - 1]}</button>`).join('');
  $('#f-date').min = data.windowStart; $('#f-date').max = data.windowEnd;
  const counts = {}; for (const e of data.events) counts[e.category] = (counts[e.category] || 0) + 1;
  $('#f-cats').innerHTML = CATS.filter(c => counts[c]).map(c => { const [tint] = STYLE[c]; return `<li><label class="check"><input type="checkbox" value="${esc(c)}"><span class="dot t-${tint}"></span><span>${esc(c)}</span><i>${counts[c]}</i></label></li>`; }).join('');
  const tc = {}; for (const e of data.events) if (e.town) tc[e.town] = (tc[e.town] || 0) + 1;
  $('#f-town').innerHTML = `<option value="">All of Ulster County</option>` + data.topTowns.map(t => `<option value="${esc(t)}">${esc(t)} (${tc[t] || 0})</option>`).join('');
}
function syncSidebar() {
  const whenKey = !f.days ? 'all' : f._when || '';
  document.querySelectorAll('#f-when button').forEach(b => b.setAttribute('aria-pressed', b.dataset.when === whenKey));
  $('#f-date').value = f._when === 'date' ? f.days[0] : '';
  document.querySelectorAll('#f-cats input').forEach(i => { i.checked = f.cats.includes(i.value); });
  $('#f-town').value = f.town && data.topTowns.includes(f.town) ? f.town : '';
  $('#f-near').checked = !!f.near; $('#f-near').disabled = !f.town;
  $('#f-free').checked = f.free; $('#f-kids').checked = f.audience === 'kids';
}
function setWhen(key, val) {
  f._when = key;
  if (key === 'all') { f.days = null; f.dayLabel = null; }
  else if (key === 'weekend') {
    const base = dateObj(today < data.windowStart ? data.windowStart : today);
    const sat = new Date(base); sat.setDate(base.getDate() + ((6 - base.getDay() + 7) % 7) - (base.getDay() === 0 ? 1 : 0));
    const sun = new Date(sat); sun.setDate(sat.getDate() + 1);
    f.days = [isoOf(sat), isoOf(sun)]; f.dayLabel = `${fmtDate(f.days[0])} – ${fmtDate(f.days[1])}`;
  } else if (key === 'date') { f.days = [val]; f.dayLabel = fmtDate(val); }
  else { const [y, m] = key.split('-').map(Number); const days = []; for (let d = new Date(y, m - 1, 1, 12); d.getMonth() === m - 1; d.setDate(d.getDate() + 1)) days.push(isoOf(d)); f.days = days; f.dayLabel = MONTH_LONG[m - 1]; }
}

// ---------- detail + bag ----------
function openDetail(id) {
  const e = data.events.find(x => x.id === id); if (!e) return;
  const [tint, icon] = STYLE[e.category] || STYLE.Community;
  const up = e.occurrences.filter(o => o.date >= (today < data.windowStart ? data.windowStart : today));
  const saved = bag.has(e.id);
  const mapQ = encodeURIComponent([e.venue, e.address].filter(Boolean).join(', '));
  $('#detail').innerHTML = `
    <button class="close" data-close aria-label="Close">${svg('x')}</button>
    <div class="detail-media t-${tint}">${svg(icon)}${e.image ? `<img src="${esc(e.image)}" alt="" onerror="this.remove()">` : ''}</div>
    <div class="detail-body">
      <div class="row-cat c-${tint}">${esc(e.category)}</div>
      <h2 id="detail-title">${esc(e.title)}</h2>
      <dl class="facts">
        <dt>${svg('cal')}</dt><dd>${e.ongoing ? esc(e.when || `${fmtDate(e.occurrences[0].date)} – ${fmtDate(e.occurrences.at(-1).date)}`) : up.length === 1 ? esc(fmtDateLong(up[0].date) + (up[0].start ? ' · ' + timeRange(up[0]) : '')) : `${up.length} upcoming dates<div class="dates">${up.slice(0, 12).map(o => `<span class="tag">${fmtDate(o.date)}${o.start ? ' · ' + timeRange(o) : ''}</span>`).join('')}${up.length > 12 ? `<span class="tag">+${up.length - 12} more</span>` : ''}</div>`}</dd>
        <dt>${svg('pin')}</dt><dd><b>${esc(e.venue)}</b>${e.address ? '<br>' + esc(e.address) : ''}</dd>
        ${e.price ? `<dt>${svg('ticket')}</dt><dd>${esc(e.price)}</dd>` : ''}
      </dl>
      ${e.description ? `<p class="desc">${esc(e.description)}</p>` : ''}
      <div class="detail-actions">
        ${e.ticketUrl ? `<a class="btn btn-primary" href="${esc(e.ticketUrl)}" target="_blank" rel="noopener">Get tickets</a>` : ''}
        <button class="btn btn-ghost" data-save="${esc(e.id)}">${svg(saved ? 'check' : 'plus')} ${saved ? 'Saved for my day' : 'Save for my day'}</button>
        <a class="btn btn-ghost" href="plan.html?around=${encodeURIComponent(e.id)}">Plan a day around this</a>
        ${e.url ? `<a class="btn btn-text" href="${esc(e.url)}" target="_blank" rel="noopener">View on Chronogram</a>` : ''}
        ${mapQ ? `<a class="btn btn-text" href="https://www.openstreetmap.org/search?query=${mapQ}" target="_blank" rel="noopener">Map</a>` : ''}
      </div>
    </div>`;
  if (!$('#detail').open) $('#detail').showModal();
}
function renderBag() {
  const ids = bag.get(); const items = ids.map(id => data.events.find(e => e.id === id)).filter(Boolean);
  $('#bag-fab').hidden = !items.length; $('#bag-count').textContent = items.length;
  $('#bag').innerHTML = `<div class="drawer-head"><h2 id="bag-title">Saved for my day</h2><button class="close" data-close aria-label="Close">${svg('x')}</button></div>
    ${items.length ? `<ul class="bag-list">${items.map(e => { const o = e.occurrences.find(x => x.date >= today) || e.occurrences[0]; return `<li><button class="bag-item" data-id="${esc(e.id)}"><b>${esc(e.title)}</b><span>${fmtDate(o.date)}${o.start ? ' · ' + timeRange(o) : ''} · ${esc(e.town || '')}</span></button><button class="icon-btn" data-save="${esc(e.id)}" aria-label="Remove">${svg('x')}</button></li>`; }).join('')}</ul>
    <div class="drawer-foot"><a class="btn btn-primary btn-block" href="plan.html?bag=1">Plan my day with these</a><button class="link" data-bag-clear>Clear all</button></div>` : `<p class="muted">Tap + on any event to save it here, then plan a day around them.</p>`}`;
}

// ---------- wiring ----------
function search(q, push = true) {
  f = q.trim() ? parseSearch(q, data, idx, today) : emptyFilter();
  if (f.days && MONTH_LONG.includes(f.dayLabel)) f._when = f.days[0].slice(0, 7);
  else if (f.days && f.days.length === 1) f._when = 'date';
  shown = PAGE;
  if (push) history.replaceState(null, '', q.trim() ? '?q=' + encodeURIComponent(q.trim()) : location.pathname);
  render();
}
function edited() { f.raw = hasMeaning(f) ? (f.raw || 'filters') : ''; f.greeting = false; f.notes = []; f.corrected = []; shown = PAGE; $('#q').value = ''; history.replaceState(null, '', location.pathname); render(); }

function wire() {
  $('#search-form').addEventListener('submit', e => { e.preventDefault(); search($('#q').value); document.querySelector('.results').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-pill],[data-clear],[data-when],[data-q],[data-save],[data-id],[data-close],[data-bag-clear],#more,#bag-fab');
    if (!t) { if (e.target.matches('dialog')) e.target.close(); return; }
    if (t.dataset.save) { e.stopPropagation(); bag.toggle(t.dataset.save); render(); if ($('#detail').open) openDetail(t.dataset.save); return; }
    if (t.dataset.pill !== undefined) {
      const x = pills(f)[+t.dataset.pill];
      if (x.k === 'region') f.region = null; if (x.k === 'town') { f.town = null; f.near = false; } if (x.k === 'days') { f.days = null; f.dayLabel = null; f._when = 'all'; }
      if (x.k === 'time') f.time = null; if (x.k === 'cat') f.cats = f.cats.filter(c => c !== x.v); if (x.k === 'audience') f.audience = null;
      if (x.k === 'free') f.free = false; if (x.k === 'cheap') f.cheap = false; if (x.k === 'kw') { f.keywords = f.keywords.filter(k => k !== x.v); f.specificCats = []; }
      return edited();
    }
    if (t.dataset.clear !== undefined) { $('#q').value = ''; return search(''); }
    if (t.dataset.when) { setWhen(t.dataset.when); return edited(); }
    if (t.dataset.q) { $('#q').value = t.dataset.q; return search(t.dataset.q); }
    if (t.dataset.close !== undefined) { t.closest('dialog').close(); return; }
    if (t.dataset.bagClear !== undefined) { bag.clear(); render(); return; }
    if (t.id === 'more') { shown += PAGE; render(); return; }
    if (t.id === 'bag-fab') { renderBag(); $('#bag').showModal(); return; }
    if (t.dataset.id) { if ($('#bag').open) $('#bag').close(); openDetail(t.dataset.id); }
  });
  document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('.row')) openDetail(e.target.dataset.id); });
  $('#f-cats').addEventListener('change', e => { const v = e.target.value; f.cats = e.target.checked ? [...f.cats, v] : f.cats.filter(c => c !== v); edited(); });
  $('#f-date').addEventListener('change', e => { if (e.target.value) setWhen('date', e.target.value); else setWhen('all'); edited(); });
  $('#f-town').addEventListener('change', e => { f.town = e.target.value || null; f.region = null; if (!f.town) f.near = false; edited(); });
  $('#f-near').addEventListener('change', e => { f.near = e.target.checked; edited(); });
  $('#f-free').addEventListener('change', e => { f.free = e.target.checked; edited(); });
  $('#f-kids').addEventListener('change', e => { f.audience = e.target.checked ? 'kids' : null; edited(); });
  window.addEventListener('bagchange', renderBag);
  $('#filters-toggle').addEventListener('click', e => { const sb = document.querySelector('.sidebar'); sb.classList.toggle('open'); e.currentTarget.setAttribute('aria-expanded', sb.classList.contains('open')); });
  // rotating examples in the search box
  const ex = ['Try “family events in December”', 'Try “music around New Paltz”', 'Try “free things to do this weekend”', 'Try “theater in Kingston tonight”', 'Try “cheap art in Woodstock”'];
  let i = 0; setInterval(() => { const q = $('#q'); if (!q.value && document.activeElement !== q) q.placeholder = ex[++i % ex.length]; }, 4000);
}

(async function init() {
  data = await loadData(); idx = buildIndex(data); today = todayISO();
  $('#window-label').textContent = data.windowLabel;
  if (data.meta?.updatedAt) $('#updated').textContent = `Data updated ${new Date(data.meta.updatedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })} · ${data.events.length} events · ${data.places.length} places to eat.`;
  buildSidebar(); wire(); renderBag();
  dotGrid(document.querySelector('.plan-card canvas'));
  const q = new URLSearchParams(location.search).get('q') || '';
  $('#q').value = q; search(q, false);
})();
