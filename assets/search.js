// Smart search: turns what people type into filters, following the rules agreed for the pilot.
//  - place ("in New Paltz" = that town; "around/near New Paltz" or just "New Paltz" = town + ~15 min nearby)
//  - "Ulster County" = everything; "Hudson Valley"/"hudson" = everything + a pilot-scope note
//  - dates (a month alone = the whole month), time of day, free / cheap, kids / adults, interests
//  - filler words and greetings are ignored; typos are corrected and announced
//  - anything not mentioned is not filtered

import { parseDates, INTERESTS, drive } from './planner.js';
import { dateObj, isoOf, fmtDate, MONTH_LONG } from './common.js';

const FILLER = new Set(`a an the and or but of on at to for from with by as is are was be been am i im i'm me my we us our you your u it its this that these those there here what whats what's which who how where when why can could would should will do does did any some all every
hi hello hey hiya yo sup howdy greetings thanks thank please pls ok okay yes no good great nice cool fun awesome
show find search look looking see get go going want wanna like love need give list tell
event events activity activities thing things stuff happening happenings going on whats-on options ideas something anything everything
around near nearby close in into within area areas region county valley place places town towns local
day days time times date dates plan plans planning schedule weekend-ish`.split(/\s+/));
const GREETINGS = /^(hi+|hello+|hey+|hiya|yo|sup|howdy|good (morning|afternoon|evening)|how are (you|u)|how's it going|what's up|whats up|test|testing)[\s!?.]*$/i;

const AUDIENCE_KIDS = ['kids', 'kid', 'children', 'child', 'family', 'families', 'toddler', 'toddlers', 'teens', 'teen'];
const AUDIENCE_ADULTS = ['adults', 'adult', 'grown-ups', 'grownups', '21+', 'grown'];
const TIME_WORDS = {
  tonight: { from: 17 * 60, to: 24 * 60, label: 'tonight', today: true },
  morning: { from: 0, to: 12 * 60, label: 'morning' }, mornings: { from: 0, to: 12 * 60, label: 'morning' },
  afternoon: { from: 12 * 60, to: 17 * 60, label: 'afternoon' }, afternoons: { from: 12 * 60, to: 17 * 60, label: 'afternoon' },
  evening: { from: 17 * 60, to: 24 * 60, label: 'evening' }, evenings: { from: 17 * 60, to: 24 * 60, label: 'evening' },
  night: { from: 17 * 60, to: 24 * 60, label: 'evening' }, nights: { from: 17 * 60, to: 24 * 60, label: 'evening' },
  'late night': { from: 21 * 60, to: 24 * 60, label: 'late night' }, latenight: { from: 21 * 60, to: 24 * 60, label: 'late night' }
};
// Category-level words. Anything more specific (jazz, ballet, yoga…) also has to appear in the event text.
const BROAD = new Set(['music', 'concert', 'concerts', 'live music', 'band', 'bands', 'gig', 'gigs', 'movie', 'movies', 'film', 'films', 'cinema', 'screening', 'screenings', 'art', 'arts', 'gallery', 'galleries', 'exhibit', 'exhibits', 'exhibition', 'museum', 'museums', 'theater', 'theatre', 'plays', 'musical', 'musicals', 'food', 'foodie', 'outdoors', 'outdoor', 'nature', 'workshop', 'workshops', 'class', 'classes', 'wellness', 'market', 'markets', 'fair', 'fairs', 'festival', 'festivals', 'book', 'books', 'lecture', 'lectures', 'talks', 'crafts', 'shopping', 'sports']);
const CHEAP = ['cheap', 'budget', 'inexpensive', 'affordable', 'cheapest', 'low-cost', 'lowcost'];
const MONTH_WORDS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december', 'jan', 'feb', 'mar', 'apr', 'jun', 'jul', 'aug', 'sep', 'sept', 'oct', 'nov', 'dec'];
const DATE_WORDS = ['today', 'tomorrow', 'weekend', 'next', 'this', 'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'christmas', 'xmas', 'eve', "new", "year", "years", "year's", 'valentine', "valentine's", 'valentines', 'easter', 'presidents', "presidents'", 'mlk', 'memorial', 'mother', "mother's", 'mothers', 'patrick', "patrick's", 'st', 'thanksgiving', 'nye', 'holiday', 'holidays'];

function lev(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 9;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1), (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) ? d[i - 2][j - 2] + 1 : 99);
  return d[a.length][b.length];
}
const wordRe = w => new RegExp(`(^|[^a-z0-9])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`, 'i');

// Build once per data load
export function buildIndex(data) {
  const text = e => (e.title + ' ' + e.venue + ' ' + (e.town || '') + ' ' + e.category + ' ' + (e.rawCategory || '') + ' ' + (e.description || '')).toLowerCase();
  const corpus = data.events.map(text).join(' ');
  const vocab = new Set(corpus.match(/[a-z][a-z'-]{2,}/g) || []);
  const towns = [...new Set([...data.towns, 'New Paltz', 'Kingston', 'Woodstock', 'Saugerties', 'Rosendale', 'Stone Ridge', 'High Falls', 'Highland', 'Gardiner', 'Ellenville', 'Phoenicia', 'Accord', 'Kerhonkson', 'Marlboro', 'Port Ewen', 'Mount Tremper', 'Hurley', 'Lake Katrine', 'Esopus', 'Tillson', 'Wallkill', 'Milton', 'Olivebridge', 'Shokan', 'Boiceville', 'Bearsville', 'Napanoch', 'Cragsmoor', 'Rifton', 'Ulster Park', 'Pine Hill', 'Big Indian', 'West Hurley', 'Clintondale', 'Modena', 'Plattekill', 'Cottekill'])];
  const interestWords = INTERESTS.flatMap(i => i.words.map(w => ({ w, cat: i.cat })));
  const known = [...towns.map(t => t.toLowerCase()), ...interestWords.map(x => x.w), ...MONTH_WORDS, ...Object.keys(TIME_WORDS), ...AUDIENCE_KIDS, ...AUDIENCE_ADULTS, ...CHEAP, 'free', 'ulster', 'hudson', ...DATE_WORDS];
  return { text, vocab, towns, interestWords, known, eventText: new Map(data.events.map(e => [e.id, text(e)])) };
}

// ---------- parse text into a filter ----------
export function parseSearch(raw, data, idx, todayStr) {
  const f = { specificCats: [], cats: [], audience: null, days: null, dayLabel: null, town: null, near: false, time: null, free: false, cheap: false, keywords: [], region: null, notes: [], corrected: [], raw };
  let q = ' ' + raw.toLowerCase().replace(/[“”"]/g, ' ').replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim() + ' ';
  if (!raw.trim()) return f;
  if (GREETINGS.test(raw.trim())) { f.greeting = true; return f; }

  // typo correction on single words (only when the word isn't found in any event text)
  const tokens = q.trim().split(' ');
  const fixed = tokens.map(tok => {
    const w = tok.replace(/[^a-z'-]/g, '');
    if (w.length < 4 || FILLER.has(w) || idx.known.includes(w) || idx.vocab.has(w)) return tok;
    let best = null, bd = 9;
    for (const k of idx.known) { if (k.includes(' ')) continue; const d = lev(w, k); if (d < bd) { bd = d; best = k; } }
    const limit = w.length >= 8 ? 2 : 1;
    if (best && bd <= limit) { f.corrected.push(best); return tok.replace(w, best); }
    return tok;
  });
  // multi-word towns with a typo in one word ("new palts")
  let joined = ' ' + fixed.join(' ') + ' ';
  for (const t of idx.towns.filter(t => t.includes(' '))) {
    const tl = t.toLowerCase(); if (joined.includes(' ' + tl + ' ')) continue;
    const n = tl.split(' ').length; const ws = joined.trim().split(' ');
    for (let i = 0; i + n <= ws.length; i++) {
      const cand = ws.slice(i, i + n).join(' ');
      if (cand.length >= 6 && lev(cand, tl) <= 2 && cand[0] === tl[0]) { joined = joined.replace(' ' + cand + ' ', ' ' + tl + ' '); f.corrected.push(t); break; }
    }
  }
  q = joined;

  // region words
  if (/\bulster( county)?\b/.test(q)) { f.region = 'ulster'; q = q.replace(/\bulster( county)?\b/g, ' '); }
  if (/\bhudson( valley)?\b/.test(q) || /\bcatskills?\b/.test(q)) { f.region = 'hudson'; q = q.replace(/\bhudson( valley)?\b|\bcatskills?\b/g, ' '); f.notes.push('This pilot covers Ulster County, so these are Ulster County events.'); }

  // town (longest names first)
  for (const t of [...idx.towns].sort((a, b) => b.length - a.length)) {
    const tl = t.toLowerCase();
    const m = q.match(new RegExp(`(\\b(in|at|around|near|nearby|by|close to)\\s+)?\\b${tl.replace(/\./g, '\\.')}\\b`));
    if (m) { f.town = t; f.near = !m[2] || m[2] !== 'in' && m[2] !== 'at'; q = q.replace(m[0], ' '); break; }
  }

  // dates (a month alone = whole month)
  const d = parseDates(q, dateObj(todayStr), { cap: 400, monthMode: 'month' });
  if (d.days.length) {
    let days = d.days;
    const ws = data.windowStart, we = data.windowEnd;
    if (days.every(x => x < ws)) {
      if (d.relative || /\btonight|today|tomorrow\b/.test(q)) {
        // before the pilot starts: show its first weekend
        const first = dateObj(ws); const sat = new Date(first); sat.setDate(first.getDate() + ((6 - first.getDay() + 7) % 7));
        const sun = new Date(sat); sun.setDate(sat.getDate() + 1);
        days = [isoOf(sat), isoOf(sun)];
        f.notes.push(`The pilot starts ${fmtDate(ws)}, so here's its first weekend (${fmtDate(days[0])} – ${fmtDate(days[1])}).`);
      } else f.notes.push(`The pilot covers ${data.windowLabel}, so there's nothing listed for those dates.`);
    } else if (days.every(x => x > we)) f.notes.push(`The pilot covers ${data.windowLabel}, so there's nothing listed for those dates.`);
    f.days = days;
    f.dayLabel = d.monthOnly ? MONTH_LONG[dateObj(days[0]).getMonth()] : days.length === 1 ? fmtDate(days[0]) : `${fmtDate(days[0])} – ${fmtDate(days.at(-1))}`;
  }
  // strip date words so they don't become keywords
  q = q.replace(/\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}\/\d{1,2}(\/\d{2,4})?\b|\b\d{1,2}(st|nd|rd|th)?\b/g, ' ');
  for (const w of [...MONTH_WORDS, ...DATE_WORDS]) q = q.replace(wordRe(w), ' ');

  // time of day
  if (/\blate night\b/.test(q)) { f.time = TIME_WORDS['late night']; q = q.replace(/\blate night\b/, ' '); }
  for (const [w, v] of Object.entries(TIME_WORDS)) if (!f.time && wordRe(w).test(q)) { f.time = v; q = q.replace(wordRe(w), ' '); }

  // price
  if (/\bfree\b/.test(q)) { f.free = true; q = q.replace(/\bfree\b/g, ' '); }
  for (const w of CHEAP) if (wordRe(w).test(q)) { f.cheap = true; q = q.replace(wordRe(w), ' '); }

  // audience
  for (const w of AUDIENCE_KIDS) if (wordRe(w).test(q)) { f.audience = 'kids'; q = q.replace(wordRe(w), ' '); }
  for (const w of AUDIENCE_ADULTS) if (wordRe(w).test(q)) { f.audience = 'adults'; q = q.replace(wordRe(w), ' '); }

  // interests -> categories (longest phrases first)
  const specific = []; f.interestKeywords = [];
  const SKIP = new Set(['show', 'shows', 'play', 'making', 'learn', 'funny', 'culture', 'community', 'talk']);
  for (const { w, cat } of [...idx.interestWords].sort((a, b) => b.w.length - a.w.length)) {
    if (SKIP.has(w)) continue;
    if (wordRe(w).test(q)) {
      if (BROAD.has(w)) { if (cat !== 'Family' && !f.cats.includes(cat)) f.cats.push(cat); f.interestKeywords.push(w); }
      else { specific.push(w); if (cat !== 'Family' && !f.specificCats.includes(cat)) f.specificCats.push(cat); }
      q = q.replace(wordRe(w), ' ');
    }
  }
  f.keywords = [...specific];

  // what's left: real keywords
  for (const w of q.split(/[^a-z0-9'+-]+/)) {
    const k = w.replace(/^'+|'+$/g, '');
    if (k.length < 2 || FILLER.has(k) || /^\d+$/.test(k)) continue;
    f.keywords.push(k);
  }
  return f;
}

export const hasMeaning = f => !!(f.cats.length || f.audience || f.days || f.town || f.time || f.free || f.cheap || f.keywords.length || f.region);

// ---------- run a filter ----------
const toMin = t => { if (!t) return null; const [h, m] = t.split(':').map(Number); return h * 60 + m; };

export function runSearch(f, data, idx, todayStr) {
  const anchor = f.town ? data.townCenters[f.town] : null;
  const daySet = f.days ? new Set(f.days) : null;
  const from = todayStr < data.windowStart ? data.windowStart : todayStr;

  const occOk = (e, o) => {
    if (daySet ? !daySet.has(o.date) : o.date < from) return false;
    if (f.time) {
      const st = toMin(o.start);
      if (st == null) { if (e.ongoing && f.time.to <= 17 * 60) return true; return false; }
      if (st < f.time.from || st >= f.time.to) return false;
    }
    return true;
  };

  function pass(opts) {
    const out = [];
    for (const e of data.events) {
      // place
      let nearby = false, minutes = null;
      if (f.town && !opts.anyArea) {
        if (e.town === f.town) { /* in town */ }
        else if (f.near && anchor && e.lat != null) { const dr = drive(anchor, e); if (!dr || dr.minutes > 20) continue; nearby = true; minutes = dr.minutes; }
        else continue;
      }
      // category / audience
      if (f.cats.length && !f.cats.includes(e.category)) continue;
      const t = idx.eventText.get(e.id);
      if (f.audience === 'kids' && e.category !== 'Family' && !/\b(kids?|children|family|families|all ages|toddlers?|teens?)\b/.test(t)) continue;
      if (f.audience === 'adults' && e.category === 'Family') continue;
      // price
      if (f.free && e.priceMax !== 0 && !/\bfree\b/i.test(e.price || '')) continue;
      // keywords (whole words)
      let score = 0;
      if (f.keywords.length && !opts.noKeywords) {
        const title = (e.title + ' ' + e.category + ' ' + (e.rawCategory || '') + ' ' + e.venue).toLowerCase();
        let hits = 0;
        for (const k of f.keywords) {
          const re = wordRe(k);
          if (re.test(title)) { score += 10; hits++; } else if (re.test(t)) { score += 3; hits++; }
        }
        if (opts.anyKeyword ? hits === 0 : hits < f.keywords.length) continue;
      }
      for (const k of f.interestKeywords || []) if (wordRe(k).test(e.title.toLowerCase())) score += 2;
      // dates / time
      const occ = e.occurrences.find(o => (opts.anyDate ? (o.date >= from && (!f.time || occOkTime(e, o))) : occOk(e, o)));
      if (!occ) continue;
      out.push({ e, occ, nearby, minutes, score });
    }
    return out;
  }
  const occOkTime = (e, o) => { const st = toMin(o.start); if (st == null) return e.ongoing && f.time.to <= 17 * 60; return st >= f.time.from && st < f.time.to; };

  let results = pass({}); let relaxed = null;
  const keywordsOnly = f.keywords.length && !f.specificCats.length && !f.cats.length && !f.audience && !f.days && !f.town && !f.time && !f.free && !f.cheap && !f.region;
  if (!results.length && keywordsOnly) return { results: [], relaxed: null, nonsense: true };
  if (!results.length && hasMeaning(f)) {
    // closest alternatives, in order of what to give up first
    const tries = [];
    if (f.keywords.length > 1) tries.push([{ anyKeyword: true }, 'Showing events that match some of your words.']);
    if (f.time) tries.push([{ ...{}, _dropTime: true }, `Nothing ${f.time.label === 'tonight' ? 'tonight' : 'in the ' + f.time.label} matches, so here's the rest of the day.`]);
    if (f.town && f.near === false) tries.push([{ _near: true }, `Nothing in ${f.town} itself, so here's what's nearby.`]);
    if (f.town) tries.push([{ anyArea: true }, `Nothing matches in or near ${f.town}, so here's all of Ulster County.`]);
    if (f.days) tries.push([{ anyDate: true }, `Nothing matches on ${f.dayLabel}, so here are other dates.`]);
    if (f.specificCats.length) tries.push([{ noKeywords: true, _cats: f.specificCats }, `Nothing mentions “${f.keywords.join(' ')}” right now, so here's other ${f.specificCats.join(' and ')}.`]);
    else if (f.keywords.length) tries.push([{ noKeywords: true }, `No events mention “${f.keywords.join(' ')}”, so here's everything else that fits.`]);
    for (const [o, msg] of tries) {
      const saveT = f.time, saveN = f.near, saveC = f.cats;
      if (o._cats) f.cats = [...new Set([...f.cats, ...o._cats])];
      if (o._dropTime) f.time = null;
      if (o._near) f.near = true;
      results = pass(o);
      if (o._dropTime) f.time = saveT; if (o._near) f.near = saveN; f.cats = saveC;
      if (results.length) { relaxed = msg; break; }
    }
  }

  // sort
  const key = r => r.occ.date + (r.e.ongoing ? 'z' : (r.occ.start || 'y'));
  if (f.cheap) results.sort((a, b) => ((a.e.priceMin ?? 1e9) - (b.e.priceMin ?? 1e9)) || key(a).localeCompare(key(b)));
  else if (f.keywords.length) results.sort((a, b) => (b.score - a.score) || key(a).localeCompare(key(b)));
  else results.sort((a, b) => (a.nearby - b.nearby) || key(a).localeCompare(key(b)));
  return { results, relaxed };
}

// Human-readable pills for what was understood
export function pills(f) {
  const p = [];
  if (f.region === 'ulster') p.push({ k: 'region', label: 'All of Ulster County' });
  if (f.region === 'hudson') p.push({ k: 'region', label: 'Hudson Valley → Ulster County' });
  if (f.town) p.push({ k: 'town', label: (f.near ? 'In and around ' : 'In ') + f.town });
  if (f.dayLabel) p.push({ k: 'days', label: f.dayLabel });
  if (f.time) p.push({ k: 'time', label: f.time.label[0].toUpperCase() + f.time.label.slice(1) });
  for (const c of f.cats) p.push({ k: 'cat', v: c, label: c });
  if (f.audience) p.push({ k: 'audience', label: f.audience === 'kids' ? 'Kids & family' : 'For adults' });
  if (f.free) p.push({ k: 'free', label: 'Free' });
  if (f.cheap) p.push({ k: 'cheap', label: 'Lowest price first' });
  for (const k of f.keywords) p.push({ k: 'kw', v: k, label: `“${k}”` });
  return p;
}
