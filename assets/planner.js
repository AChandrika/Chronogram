// Rule-based trip planner — no AI service, no API keys, runs entirely in the visitor's browser.
// It reads dates, interests, a town, budget and food wishes out of plain English,
// then builds a day-by-day plan with meals, drive times and ticket prices.

const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const NUMWORDS = { one: 1, two: 2, three: 3, four: 4, a: 1, single: 1, couple: 2 };

export const INTERESTS = [
  { cat: 'Music', words: ['music', 'concert', 'concerts', 'live music', 'band', 'bands', 'jazz', 'folk', 'rock', 'classical', 'orchestra', 'symphony', 'choir', 'dj', 'open mic', 'bluegrass', 'punk', 'hip hop', 'singer', 'songwriter', 'gig', 'gigs', 'blues'] },
  { cat: 'Film', words: ['movie', 'movies', 'film', 'films', 'cinema', 'screening', 'screenings', 'documentary', 'documentaries'] },
  { cat: 'Arts & Culture', words: ['art', 'arts', 'gallery', 'galleries', 'exhibit', 'exhibits', 'exhibition', 'museum', 'museums', 'painting', 'photography', 'culture'] },
  { cat: 'Theater & Comedy', words: ['theater', 'theatre', 'play', 'plays', 'musical', 'musicals', 'comedy', 'stand-up', 'standup', 'improv', 'dance', 'ballet', 'nutcracker', 'opera', 'cabaret', 'show', 'shows', 'funny'] },
  { cat: 'Food & Drink', words: ['food', 'foodie', 'wine', 'beer', 'brewery', 'breweries', 'cider', 'cocktail', 'cocktails', 'tasting', 'tastings', 'distillery'] },
  { cat: 'Family', words: ['kids', 'kid', 'family', 'children', 'child', 'toddler', 'toddlers', 'families'] },
  { cat: 'Outdoors', words: ['outdoors', 'outdoor', 'hike', 'hikes', 'hiking', 'nature', 'ski', 'skiing', 'skate', 'skating', 'trail', 'trails', 'snowshoe', 'birding', 'sports'] },
  { cat: 'Classes & Workshops', words: ['workshop', 'workshops', 'class', 'classes', 'learn', 'craft', 'crafts', 'making'] },
  { cat: 'Talks & Literary', words: ['book', 'books', 'reading', 'readings', 'poetry', 'lecture', 'lectures', 'talk', 'talks', 'author', 'authors', 'literary'] },
  { cat: 'Wellness', words: ['yoga', 'meditation', 'wellness', 'sound bath', 'spa', 'healing', 'mindfulness'] },
  { cat: 'Markets & Festivals', words: ['market', 'markets', 'fair', 'fairs', 'festival', 'festivals', 'holiday market', 'christmas market', 'craft fair', 'shopping'] },
  { cat: 'Community', words: ['community', 'volunteer', 'fundraiser', 'benefit', 'networking'] }
];

const CUISINES = ['pizza', 'italian', 'thai', 'mexican', 'sushi', 'japanese', 'chinese', 'indian', 'french', 'bbq', 'barbecue', 'vegan', 'vegetarian', 'burger', 'burgers', 'bakery', 'coffee', 'cafe', 'brunch', 'diner', 'seafood', 'ramen', 'tacos', 'deli', 'bagels', 'mediterranean', 'american', 'farm-to-table', 'steak', 'dessert', 'ice cream'];

// ---------- dates ----------
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const mk = (y, m, d) => new Date(y, m, d, 12);
const addDays = (d, n) => mk(d.getFullYear(), d.getMonth(), d.getDate() + n);
function nthWeekday(y, m, wd, n) { // n=-1 => last
  if (n > 0) { const f = mk(y, m, 1); return addDays(f, ((wd - f.getDay() + 7) % 7) + 7 * (n - 1)); }
  const l = mk(y, m + 1, 0); return addDays(l, -((l.getDay() - wd + 7) % 7));
}
function easter(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25),
    g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4,
    l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451), mo = Math.floor((h + l - 7 * m + 114) / 31), da = ((h + l - 7 * m + 114) % 31) + 1;
  return mk(y, mo - 1, da);
}
function holidays(y) {
  return [
    [/christmas eve/, mk(y, 11, 24)], [/christmas|xmas/, mk(y, 11, 25)], [/new year'?s eve|nye/, mk(y, 11, 31)],
    [/new year'?s( day)?/, mk(y, 0, 1)], [/mlk|martin luther king/, nthWeekday(y, 0, 1, 3)],
    [/valentine/, mk(y, 1, 14)], [/presidents'? day/, nthWeekday(y, 1, 1, 3)], [/st\.? patrick|saint patrick/, mk(y, 2, 17)],
    [/easter/, easter(y)], [/mother'?s day/, nthWeekday(y, 4, 0, 2)], [/memorial day/, nthWeekday(y, 4, 1, -1)],
    [/thanksgiving/, nthWeekday(y, 10, 4, 4)], [/cinco de mayo/, mk(y, 4, 5)]
  ];
}
// pick the year that puts (month, day) on/after today (within ~11 months)
function inferYear(m, d, today) {
  let y = today.getFullYear();
  if (mk(y, m, d) < addDays(today, -1)) y++;
  return y;
}
function weekendOf(d) { // Sat+Sun on/after d (if d is Sun, the Sat before)
  if (d.getDay() === 0) return [addDays(d, -1), d];
  const sat = addDays(d, (6 - d.getDay() + 7) % 7);
  return [sat, addDays(sat, 1)];
}
function range(a, b) { const out = []; for (let d = a; d <= b && out.length < 31; d = addDays(d, 1)) out.push(d); return out; }

export function parseDates(qRaw, today) {
  const q = ' ' + qRaw.toLowerCase().replace(/(\d+)(st|nd|rd|th)\b/g, '$1').replace(/[–—]/g, '-').replace(/\s+/g, ' ') + ' ';
  const notes = [];
  let days = [];
  const mon = '(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\\.?';

  // day count: "2 days", "two days", "3-day", "a weekend"
  let count = null;
  const cm = q.match(/\b(\d|one|two|three|four|a|single|couple(?: of)?)[ -]?(day|days|night|nights)\b/);
  if (cm) count = +cm[1] || NUMWORDS[cm[1].replace(' of', '')] || null;
  const cm2 = q.match(/\b(\d|one|two|three|four|couple(?: of)?) (holidays|days off)\b/);
  if (!count && cm2) count = +cm2[1] || NUMWORDS[cm2[1].replace(' of', '')] || null;

  // ISO dates
  for (const m of q.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) days.push(mk(+m[1], +m[2] - 1, +m[3]));

  // numeric 12/19, 12/19/26, ranges 12/19-12/21 or 12/19-21
  if (!days.length) {
    for (const m of q.matchAll(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?(?:\s*(?:-|to|through|thru|until)\s*(?:(\d{1,2})\/)?(\d{1,2})(?:\/\d{2,4})?)?/g)) {
      const mo = +m[1] - 1, da = +m[2]; if (mo > 11 || da > 31) continue;
      const y = m[3] ? (+m[3] < 100 ? 2000 + +m[3] : +m[3]) : inferYear(mo, da, today);
      const a = mk(y, mo, da);
      if (m[5]) { const mo2 = m[4] ? +m[4] - 1 : mo; const b = mk(mo2 < mo ? y + 1 : y, mo2, +m[5]); days.push(...range(a, b)); }
      else days.push(a);
    }
  }

  // "dec 19-21", "december 19 to january 2", "dec 19 and 20", "dec 19, 20"
  if (!days.length) {
    const re = new RegExp(`\\b${mon}\\s+(\\d{1,2})(?:,?\\s*(?:(-|to|through|thru|until)|(and|&|,))\\s*(?:${mon}\\s+)?(\\d{1,2})\\b)?`, 'g');
    for (const m of q.matchAll(re)) {
      const mo = MONTHS[m[1].slice(0, 3)], da = +m[2];
      const y = inferYear(mo, da, today);
      const a = mk(y, mo, da);
      // groups: 1 month, 2 day, 3 range word, 4 list word, 5 second month, 6 second day
      if (m[6]) {
        const mo2 = m[5] ? MONTHS[m[5].slice(0, 3)] : mo;
        const b = mk(mo2 < mo ? y + 1 : y, mo2, +m[6]);
        if (m[3]) days.push(...range(a, b)); else days.push(a, b);
      } else days.push(a);
    }
    // "19-20 december"
    if (!days.length) {
      for (const m of q.matchAll(new RegExp(`\\b(\\d{1,2})(?:\\s*(?:-|to|and|&)\\s*(\\d{1,2}))?\\s+(?:of\\s+)?${mon}`, 'g'))) {
        const mo = MONTHS[m[3].slice(0, 3)]; const y = inferYear(mo, +m[1], today);
        days.push(...(m[2] ? range(mk(y, mo, +m[1]), mk(y, mo, +m[2])) : [mk(y, mo, +m[1])]));
      }
    }
  }

  // holidays
  if (!days.length) {
    for (const y of [today.getFullYear(), today.getFullYear() + 1]) {
      for (const [re, d] of holidays(y)) {
        if (re.test(q) && d >= addDays(today, -1) && !days.length) {
          if (/weekend/.test(q)) days.push(...(d.getDay() === 1 ? [addDays(d, -2), addDays(d, -1), d] : weekendOf(d)));
          else days.push(d);
        }
      }
    }
  }

  // relative words
  if (!days.length) {
    if (/\b(today|tonight)\b/.test(q)) days.push(today);
    else if (/\btomorrow\b/.test(q)) days.push(addDays(today, 1));
    else if (/\bnext weekend\b/.test(q)) days.push(...weekendOf(addDays(weekendOf(today)[0], 7)));
    else if (/\b(this )?weekend\b/.test(q)) days.push(...weekendOf(today));
    else {
      const wm = q.match(/\b(this|next)?\s*(sunday|monday|tuesday|wednesday|thursday|friday|saturday)s?\b/);
      if (wm) {
        const wd = WEEKDAYS.indexOf(wm[2]);
        let d = addDays(today, (wd - today.getDay() + 7) % 7);
        if (wm[1] === 'next' && d - today < 6 * 864e5) d = addDays(d, 7);
        days.push(d);
      }
    }
  }

  // just a month: "in january" -> first weekend of that month
  if (!days.length) {
    const mm = q.match(new RegExp(`\\b${mon}\\b`));
    if (mm && !/\bmay i\b/.test(q)) {
      const mo = MONTHS[mm[1].slice(0, 3)]; const y = inferYear(mo, 28, today);
      const first = weekendOf(mk(y, mo, 1));
      days.push(...(count && count > 2 ? range(first[0], addDays(first[0], count - 1)) : first));
      notes.push(`You named a month, so I picked its first weekend. Add exact dates to change it.`);
    }
  }

  // expand a single start date to N days
  if (days.length === 1 && count && count > 1) days = range(days[0], addDays(days[0], count - 1));
  // nothing at all but "N days" -> next weekend-ish
  const hadDates = days.length > 0;
  if (!days.length && count) { const [sat] = weekendOf(addDays(today, 1)); days = range(sat, addDays(sat, count - 1)); notes.push('No dates given, so I used the next weekend.'); }

  // unique + sorted + cap
  const seen = new Set();
  days = days.filter(d => { const k = iso(d); if (seen.has(k)) return false; seen.add(k); return true; }).sort((a, b) => a - b);
  if (days.length > 4) { notes.push(`That's ${days.length} days, so the plan covers the first 4. Narrow the dates for a different stretch.`); days = days.slice(0, 4); }
  return { days: days.map(iso), hadDates, count, notes };
}

// ---------- interests, place, budget ----------
const hasWord = (q, w) => new RegExp(`(^|[^a-z])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`).test(q);

export function parseQuery(qRaw, { today, towns }) {
  const q = qRaw.toLowerCase();
  const d = parseDates(qRaw, today);
  const interests = new Set(); const keywords = [];
  for (const it of INTERESTS) for (const w of it.words) if (hasWord(q, w)) { interests.add(it.cat); keywords.push(w); }
  // "food" / "dinner" alone means meals, not food events
  const wantsFoodEvents = /\b(wine|beer|brewery|cider|cocktail|tasting|distillery)\b/.test(q);
  if (!wantsFoodEvents && interests.has('Food & Drink') && !/food (event|festival)/.test(q)) interests.delete('Food & Drink');
  let near = null;
  for (const t of [...towns].sort((a, b) => b.length - a.length)) if (hasWord(q, t.toLowerCase())) { near = t; break; }
  let budget = null;
  if (/\bfree\b/.test(q)) budget = 0;
  const bm = q.match(/(?:under|less than|below|max|budget(?: of)?|cheaper than)\s*\$?\s*(\d+)/);
  if (bm) budget = +bm[1];
  const cuisines = CUISINES.filter(c => hasWord(q, c));
  const kids = /\b(kids?|children|family|toddlers?)\b/.test(q);
  const dateNight = /\b(date night|romantic|date|anniversary|valentine)\b/.test(q);
  if (kids) interests.add('Family');
  const noFood = /\b(no food|skip (the )?food|no meals|no restaurants)\b/.test(q);
  return { ...d, interests: [...interests], keywords, near, budget, cuisines, kids, noFood, dateNight };
}

export function looksLikePlan(q) {
  return /\b(plan|planning|itinerary|trip|weekend|days?|nights?|holidays?|date night|visit|visiting|i like|i love|i'm into|interested|tonight|tomorrow|christmas|new year|valentine|easter)\b/i.test(q)
    || /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2}\b/i.test(q)
    || /\b\d{1,2}\/\d{1,2}\b/.test(q);
}

// ---------- geometry ----------
export function miles(a, b) {
  if (!a || !b || a.lat == null || b.lat == null) return null;
  const R = 3958.8, toR = x => x * Math.PI / 180;
  const dLat = toR(b.lat - a.lat), dLng = toR(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toR(a.lat)) * Math.cos(toR(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
// Road distance ≈ 1.3 × straight line; ~32 mph average on Ulster County roads, +4 min to park.
export function drive(a, b) {
  const m = miles(a, b); if (m == null) return null;
  if (m < 0.15) return { miles: 0, minutes: 0, same: true };
  const road = m * 1.3;
  return { miles: Math.round(road * 10) / 10, minutes: Math.max(3, Math.round(road / 32 * 60 + 4)), walk: road < 0.5 };
}

const toMin = t => { if (!t) return null; const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const fromMin = m => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

// ---------- planner ----------
export function buildPlan(parsed, data) {
  const { events, places, townCenters } = data;
  const notes = [...parsed.notes];
  const anchor = parsed.near ? townCenters[parsed.near] : null;
  const used = new Set(); const usedPlaces = new Set();
  const interests = new Set(parsed.interests);

  function score(e) {
    let s = 0;
    const text = (e.title + ' ' + e.description + ' ' + e.rawCategory).toLowerCase();
    if (interests.size) {
      if (interests.has(e.category)) s += 10;
      else if ([...interests].some(c => e.rawCategory && INTERESTS.find(i => i.cat === c).words.some(w => e.rawCategory.toLowerCase().includes(w)))) s += 6;
      const title = e.title.toLowerCase();
      let kw = 0; for (const w of parsed.keywords) if (w.length > 2) { if (hasWord(title, w)) kw += 5; else if (hasWord(text, w)) kw += 1.5; }
      s += Math.min(kw, 7);
      if (s < 4) return -Infinity; // needs a category match or a clear title match
    } else {
      s += 5;
      // no stated interests: favor things people go out for, not classes or support groups
      if (/Wellness|Classes|Community/.test(e.category)) s -= 3;
      if (parsed.dateNight) { if (/Music|Theater|Arts|Food/.test(e.category)) s += 3; const st = e.occurrences.find(o => o.start)?.start; if (st && st >= '17:00') s += 2; }
    }
    if (parsed.budget != null) {
      if (e.priceMin == null) s -= 2;
      else if (e.priceMin > parsed.budget) return -Infinity;
    }
    if (parsed.kids && e.category === 'Family') s += 4;
    if (anchor) { const m = miles(anchor, e); if (m != null) { if (m > 20) return -Infinity; s -= Math.max(0, m - 3) * 0.5; } }
    if (e.ongoing) s -= 3;
    if (e.image) s += 0.5;
    if (e.price) s += 0.3;
    return s;
  }

  const days = parsed.days.map(date => {
    const pool = events
      .map(e => ({ e, occ: e.occurrences.find(o => o.date === date) }))
      .filter(x => x.occ && !used.has(x.e.id))
      .map(x => ({ ...x, s: score(x.e) }))
      .filter(x => x.s > -Infinity)
      .sort((a, b) => b.s - a.s);

    const chosen = [];
    const cats = {};
    const fits = (st, en, loc) => chosen.every(c => {
      const gap = Math.max(20, (drive(c.e, loc)?.minutes || 20) + 10);
      return en + gap <= c.st || st >= c.en + gap;
    });
    for (const x of pool) {
      if (chosen.filter(c => !c.e.ongoing).length >= 3) break;
      if (x.e.ongoing || !x.occ.start) continue;
      const st = toMin(x.occ.start); let en = toMin(x.occ.end);
      if (en == null || en <= st) en = st + 120;
      if (en - st > 300) en = st + 180; // long open-house style events: plan ~3h
      const adj = x.s - (cats[x.e.category] ? 4 : 0);
      if (adj < 0 && interests.size) continue;
      if (!fits(st, en, x.e)) continue;
      chosen.push({ ...x, st, en }); cats[x.e.category] = 1;
    }
    // daytime filler: an exhibit or all-day event if the day is thin before 4pm
    const hasDaytime = chosen.some(c => c.st < 16 * 60);
    if (!hasDaytime) {
      const fill = pool.find(x => (x.e.ongoing || !x.occ.start) && !chosen.some(c => c.e.id === x.e.id));
      if (fill) {
        const st = 13 * 60 + 30, en = st + 90;
        if (fits(st, en, fill.e)) chosen.push({ ...fill, st, en, flexible: true });
      }
    }
    // thin day: suggest one daytime outing outside the stated interests ("something different")
    if (chosen.length < 2 && interests.size) {
      const near = anchor || chosen[0]?.e;
      const extra = events
        .map(e => ({ e, occ: e.occurrences.find(o => o.date === date) }))
        .filter(x => x.occ && !used.has(x.e.id) && !chosen.some(c => c.e.id === x.e.id))
        .filter(x => parsed.budget == null || (x.e.priceMin ?? 0) <= parsed.budget)
        .map(x => {
          const st = x.occ.start ? toMin(x.occ.start) : 13 * 60 + 30;
          let en = x.occ.end ? toMin(x.occ.end) : st + 120; if (en <= st || en - st > 300) en = st + Math.min(180, Math.max(90, en - st));
          const m = near ? (miles(near, x.e) ?? 15) : 5;
          return { ...x, st, en, flexible: !x.occ.start, s: 5 - m * 0.3 + (x.e.image ? 1 : 0) - (/Wellness|Classes|Community/.test(x.e.category) ? 3 : 0) };
        })
        .filter(x => x.st >= 10 * 60 && x.st <= 16 * 60 && fits(x.st, x.en, x.e))
        .sort((a, b) => b.s - a.s)[0];
      if (extra) chosen.push({ ...extra, bonus: true });
    }
    chosen.sort((a, b) => a.st - b.st);
    chosen.forEach(c => used.add(c.e.id));

    // meals
    const stops = chosen.map(c => ({ type: 'event', item: c.e, start: fromMin(c.st), end: fromMin(c.en), flexible: !!c.flexible || !c.occ.start, occ: c.occ, bonus: !!c.bonus }));
    if (!parsed.noFood && places.length) {
      const pickPlace = (near, lunch) => {
        const ref = near && near.lat != null ? near : anchor;
        if (!ref) return null;
        let best = null, bestS = -Infinity;
        for (const p of places) {
          if (usedPlaces.has(p.id)) continue;
          const m = miles(ref, p); if (m == null || m > 12) continue;
          const tags = (p.tags || []).join(' ').toLowerCase(), cz = (p.cuisine || []).join(' ').toLowerCase();
          if (lunch && /\b(bar|pub)\b/.test(tags) && !/restaurant/.test(tags)) continue;
          let s = -m;
          if (p.source !== 'OpenStreetMap') s += 1.5; // Chronogram listings first
          if (parsed.cuisines.some(c => cz.includes(c) || p.name.toLowerCase().includes(c))) s += 6;
          if (/ice cream|fast food/.test(cz + ' ' + tags)) s -= 3;
          if (/\b(bar|pub)\b/.test(cz + ' ' + tags) && !/dining|restaurant|italian|american|thai|french|pizza|mediterranean/.test(cz)) s -= 2;
          if (!lunch && /bagel|deli|bakery|coffee|cafe/.test(cz + ' ' + tags)) s -= 3;
          if (lunch && /bar\b/.test(cz)) s -= 2;
          if (s > bestS) { bestS = s; best = p; }
        }
        if (best) usedPlaces.add(best.id);
        return best;
      };
      const daytime = stops.filter(s => toMin(s.start) < 15 * 60);
      if (daytime.length || stops.length === 0) {
        const ref = daytime.reduce((b, s) => (!b || Math.abs(toMin(s.start) - 750) < Math.abs(toMin(b.start) - 750)) ? s : b, null);
        let lt = 12 * 60 + 15;
        // move lunch so it doesn't collide
        for (const s of stops) { const a = toMin(s.start), b = toMin(s.end); if (lt < b && lt + 60 > a) lt = (a - 75 >= 11 * 60) ? a - 75 : b + 15; }
        const p = pickPlace(ref?.item || null, true);
        if (p && lt <= 15 * 60) stops.push({ type: 'meal', meal: 'Lunch', item: p, start: fromMin(lt), end: fromMin(lt + 60) });
      }
      const evening = stops.find(s => s.type === 'event' && toMin(s.start) >= 17 * 60);
      let dt, ref;
      const free = t => !stops.some(s => t < toMin(s.end) + 10 && t + 75 + 10 > toMin(s.start));
      const ok = t => t != null && t >= 16 * 60 + 30 && t <= 21 * 60 + 30 && free(t);
      if (evening) {
        ref = evening.item;
        const before = stops.filter(s => toMin(s.end) <= toMin(evening.start)).pop();
        const cands = [toMin(evening.start) - 100, toMin(evening.start) - 90, before ? toMin(before.end) + 20 : null, toMin(evening.end) + 15];
        dt = cands.find(ok) ?? null;
        if (dt === toMin(evening.end) + 15) ref = evening.item;
      } else { const last = [...stops].filter(s => s.type === 'event').pop(); dt = Math.max(18 * 60, last ? toMin(last.end) + 30 : 18 * 60 + 30); ref = last?.item || null; }
      if (dt != null && free(dt)) {
        const p = pickPlace(ref, false);
        if (p) stops.push({ type: 'meal', meal: 'Dinner', item: p, start: fromMin(dt), end: fromMin(dt + 75) });
      }
    }
    stops.sort((a, b) => toMin(a.start) - toMin(b.start));
    const legs = stops.slice(1).map((s, i) => drive(stops[i].item, s.item));

    let alternatives = [];
    if (!chosen.length) {
      alternatives = events.filter(e => e.occurrences.some(o => o.date === date) && !used.has(e.id)).slice(0, 4);
    }
    return { date, stops, legs, alternatives };
  });

  // totals
  let tickets = 0, unknown = 0, driveMin = 0, driveMi = 0, free = 0;
  for (const d of days) {
    for (const s of d.stops) if (s.type === 'event') { if (s.item.priceMin == null) unknown++; else { tickets += s.item.priceMin; if (s.item.priceMax === 0) free++; } }
    for (const l of d.legs) if (l) { driveMin += l.minutes; driveMi += l.miles; }
  }
  for (const c of parsed.interests) {
    if (parsed.days.length && !events.some(e => e.category === c && e.occurrences.some(o => parsed.days.includes(o.date)))) notes.push(`No ${c} events are listed for these dates yet.`);
  }
  if (!events.length) notes.push('The calendar has no events loaded yet. They appear after the first data update runs.');
  if (parsed.days.length && parsed.days.every(dt => dt < data.windowStart || dt > data.windowEnd)) {
    notes.push(`The pilot covers ${data.windowLabel}. Try dates in that range.`);
  }
  if (parsed.near && !anchor) notes.push(`I couldn't place ${parsed.near} on the map, so distances may be rough.`);
  if (!parsed.days.length) notes.push('Add dates (like "Dec 19–20" or "this weekend") and I\'ll build a full day-by-day plan.');
  return { days, notes, totals: { tickets, unknown, driveMin, driveMi: Math.round(driveMi * 10) / 10, free } };
}
