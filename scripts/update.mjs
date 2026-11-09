// Chronogram Calendar pilot — data pipeline.
// Runs in GitHub Actions (free). No API keys needed.
//
//   node scripts/update.mjs            full refresh: Chronogram events + places + OSM restaurants + Google Sheet
//   node scripts/update.mjs --sheet    quick refresh: only re-read the Google Sheet and rebuild the output
//
// Output: data/events.json, data/places.json, data/meta.json
// Caches (so we stay polite and fast): data/cache/*.json

import fs from 'node:fs';
import path from 'node:path';
import * as cheerio from 'cheerio';
import {
  ulsterTownIn, townFromAddress, normalizeCategory, parsePrice, slug, sleep, parseCSV, stripHtml, CATEGORIES, timeForDate
} from './lib.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const CFG = JSON.parse(fs.readFileSync(path.join(ROOT, 'config.json'), 'utf8'));
const DATA = path.join(ROOT, 'data');
const CACHE = path.join(DATA, 'cache');
fs.mkdirSync(CACHE, { recursive: true });

const SHEET_ONLY = process.argv.includes('--sheet');
const UA = 'ChronogramCalendarPilot/1.0 (Ulster County pilot; approved by Chronogram)';

const readJSON = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };
const writeJSON = (f, v, pretty = false) => fs.writeFileSync(f, JSON.stringify(v, null, pretty ? 1 : 0));

const geoCache = readJSON(path.join(CACHE, 'geocode.json'), {});
const detailCache = readJSON(path.join(CACHE, 'chronogram-details.json'), {});

async function get(url, { tries = 3, json = false } = {}) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'en-US' } });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return json ? await r.json() : await r.text();
    } catch (e) {
      if (i === tries - 1) throw e;
      await sleep(1500 * (i + 1));
    }
  }
}

// ---------- Geocoding (US Census first, then OpenStreetMap Nominatim). Both free, no key. ----------
async function geocode(address) {
  if (!address) return null;
  const key = address.toLowerCase().trim();
  if (geoCache[key] !== undefined) return geoCache[key];
  let out = null;
  try {
    const u = 'https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress?benchmark=Public_AR_Current&vintage=Current_Current&format=json&address=' + encodeURIComponent(address);
    const j = await get(u, { json: true });
    const m = j?.result?.addressMatches?.[0];
    if (m) out = { lat: m.coordinates.y, lng: m.coordinates.x, county: (m.geographies?.Counties?.[0]?.BASENAME) || null, src: 'census' };
  } catch {}
  if (!out) {
    try {
      await sleep(1100); // Nominatim asks for max 1 request/second
      const u = 'https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=1&countrycodes=us&q=' + encodeURIComponent(address);
      const j = await get(u, { json: true });
      if (j?.[0]) out = { lat: +j[0].lat, lng: +j[0].lon, county: (j[0].address?.county || '').replace(/ County$/, '') || null, src: 'osm' };
    } catch {}
  }
  geoCache[key] = out;
  return out;
}

// ---------- Chronogram events ----------
// The calendar's JSON-LD dates describe the *series* (a weekly class may say 2021), so the real
// occurrence dates come from crawling the listing one day at a time: EventSearch?narrowByDate=YYYY-MM-DD
const DATE_RE = /\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*\.?,|\b(Through|Continues|Every|Daily|Mondays|Tuesdays|Wednesdays|Thursdays|Fridays|Saturdays|Sundays|First|Second|Third|Fourth|Last)\b|\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2}\b/;
function listingItems($) {
  const out = [];
  $('li.fdn-pres-item').each((_, li) => {
    const a = $(li).find('p.fdn-teaser-headline a').first();
    const url = a.attr('href');
    if (!url || !/\/Event\?oid=/.test(url)) return;
    const title = a.text().replace(/\s+/g, ' ').trim();
    let when = '';
    $(li).find('p, div, span').each((_, el) => {
      if (when) return;
      if ($(el).find('p, div').length) return; // leaf-ish blocks only
      const tx = $(el).text().replace(/\s+/g, ' ').trim();
      if (tx && tx.length < 320 && !tx.includes(title) && DATE_RE.test(tx)) when = tx;
    });
    const img = $(li).find('img').first().attr('src') || null;
    out.push({ url, title, when, thumb: img });
  });
  return out;
}

function eachDay(from, to) {
  const days = []; const d = new Date(from + 'T12:00:00Z'); const end = new Date(to + 'T12:00:00Z');
  for (; d <= end; d.setUTCDate(d.getUTCDate() + 1)) days.push(d.toISOString().slice(0, 10));
  return days;
}

async function crawlChronogramByDay() {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  const start = today > CFG.windowStart ? today : CFG.windowStart;
  const byUrl = new Map(); // url -> {url,title,thumb,whens:Set, days: Map(date -> {start,end})}
  for (const day of eachDay(start, CFG.windowEnd)) {
    let added = 0;
    for (let p = 1; p <= 25; p++) {
      let html;
      try { html = await get(`${CFG.chronogramBase}/EventSearch?narrowByDate=${day}&sortType=date&v=d&page=${p}`); }
      catch (e) { console.warn('list failed', day, p, e.message); break; }
      const $ = cheerio.load(html);
      const items = listingItems($);
      const pages = +(($('body').text().match(/page \d+ of (\d+)/i) || [])[1] || 1);
      for (const it of items) {
        let r = byUrl.get(it.url);
        if (!r) { r = { url: it.url, title: it.title, thumb: it.thumb, when: it.when, days: new Map() }; byUrl.set(it.url, r); }
        if (!r.days.has(day)) { r.days.set(day, timeForDate(it.when, day)); added++; }
      }
      await sleep(600);
      if (p >= pages || !items.length) break;
    }
    console.log(`${day}: ${added} occurrences`);
  }
  return [...byUrl.values()];
}

async function eventDetail(url) {
  const c = detailCache[url];
  const fresh = c && (Date.now() - c.fetchedAt) < 4 * 864e5; // refresh every 4 days
  if (fresh) return c;
  const html = await get(url);
  const $ = cheerio.load(html);
  let ld = null;
  $('script[type="application/ld+json"]').each((_, s) => {
    if (ld) return;
    try { const j = JSON.parse($(s).text()); if (j['@type'] === 'Event') ld = j; } catch {}
  });
  const parts = $('title').text().split('|').map(s => s.trim());
  const rawCat = parts.length >= 3 ? parts[parts.length - 2] : '';
  const price = $('.fdn-teaser-ticket-link-price').first().text().trim() || null;
  let tix = null;
  $('a').each((_, a) => {
    const t = $(a).text(); const h = $(a).attr('href') || '';
    if (!tix && /ticket/i.test(t) && /^https?:/.test(h) && !/chronogram\.com/.test(h)) tix = h;
  });
  const rec = { url, ld, rawCat, price, tix, fetchedAt: Date.now() };
  detailCache[url] = rec;
  await sleep(500);
  return rec;
}

async function buildChronogramEvents() {
  const list = await crawlChronogramByDay();
  console.log('Chronogram events in window (all counties):', list.length);
  const out = [];
  for (const item of list) {
    let d;
    try { d = await eventDetail(item.url); } catch (e) { console.warn('detail failed', item.url, e.message); continue; }
    if (!d?.ld) continue;
    const ld = d.ld;
    const address = ld.location?.address || '';
    // Skip clearly non-Ulster venues before spending a geocode on them
    const byTown = ulsterTownIn(townFromAddress(address)) || ulsterTownIn(address);
    const g = await geocode(address);
    const county = g?.county || (byTown ? 'Ulster' : null);
    if ((county || '').toLowerCase() !== CFG.county.toLowerCase()) continue;
    const desc = stripHtml(ld.description || '');
    const pr = parsePrice(d.price);
    const oid = (item.url.match(/oid=(\d+)/) || [])[1] || slug(ld.name);
    const occurrences = [...item.days.entries()].sort().map(([date, t]) => ({ date, start: t.start, end: t.end }));
    const ongoing = /through|continues|daily/i.test(item.when) && occurrences.length > 3 && !occurrences.some(o => o.start);
    out.push({
      id: 'cg-' + oid,
      title: stripHtml(ld.name),
      category: normalizeCategory(d.rawCat, ld.name, desc),
      rawCategory: d.rawCat,
      occurrences, ongoing,
      when: item.when || null,
      venue: ld.location?.name || '', address,
      town: byTown || townFromAddress(address), county,
      lat: g?.lat ?? null, lng: g?.lng ?? null,
      price: pr.label, priceMin: pr.min, priceMax: pr.max,
      image: item.thumb || ld.image?.url || null,
      description: desc.slice(0, 900),
      url: item.url,
      ticketUrl: d.tix,
      source: 'Chronogram'
    });
  }
  return out;
}

// ---------- Chronogram places (dining) ----------
async function buildChronogramPlaces() {
  const out = new Map();
  for (const [id, label] of Object.entries(CFG.chronogramDiningCategories)) {
    for (let p = 1; p <= 30; p++) {
      let html;
      try { html = await get(`${CFG.chronogramBase}/LocationSearch?locationCategory=${id}&page=${p}`); } catch { break; }
      const $ = cheerio.load(html);
      const items = $('li.fdn-pres-item');
      if (!items.length) break;
      let added = 0;
      items.each((_, li) => {
        const a = $(li).find('p.fdn-teaser-headline a').first();
        const url = a.attr('href'); if (!url) return;
        const name = a.clone().children().remove().end().text().replace(/\s+/g, ' ').trim();
        const spans = $(li).find('p.fdn-teaser-infoline').first().find('span').map((_, s) => $(s).text().trim()).get();
        const street = spans[0] || ''; const town = spans[1] || '';
        const tags = $(li).find('.fdn-teaser-tag-link').map((_, t) => $(t).text().trim()).get().filter(t => !/sponsored|distribution|smartcard|menu/i.test(t));
        const prev = out.get(url);
        if (prev) { prev.cuisine = [...new Set([...prev.cuisine, label])]; return; }
        out.set(url, { name, street, town, cuisine: [label], tags, url });
        added++;
      });
      if (!added) break;
      await sleep(600);
    }
  }
  const places = [];
  for (const p of out.values()) {
    const ulsterTown = ulsterTownIn(p.town);
    if (!ulsterTown) continue; // pilot: Ulster County only
    const address = `${p.street}, ${p.town}, NY`;
    const g = await geocode(address);
    if (!g) continue;
    places.push({ id: 'cgp-' + ((p.url.match(/oid=(\d+)/) || [])[1] || slug(p.name)), name: p.name, cuisine: p.cuisine, tags: p.tags, address, town: ulsterTown, lat: g.lat, lng: g.lng, url: p.url, source: 'Chronogram' });
  }
  return places;
}

// ---------- OpenStreetMap restaurants (free, no key) ----------
async function buildOsmPlaces() {
  const q = `[out:json][timeout:90];area["name"="Ulster County"]["admin_level"="6"]["boundary"="administrative"]->.a;
  nwr["amenity"~"^(restaurant|cafe|bar|pub|fast_food|ice_cream)$"]["name"](area.a);out center tags;`;
  try {
    const r = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(q) });
    const j = await r.json();
    return j.elements.map(el => {
      const t = el.tags || {};
      const lat = el.lat ?? el.center?.lat, lng = el.lon ?? el.center?.lon;
      const town = t['addr:city'] || null;
      const cuisine = (t.cuisine || t.amenity).split(';').map(c => c.replace(/_/g, ' ').replace(/\b\w/g, m => m.toUpperCase()));
      return {
        id: 'osm-' + el.type[0] + el.id, name: t.name, cuisine, tags: [t.amenity],
        address: [t['addr:housenumber'], t['addr:street']].filter(Boolean).join(' ') + (town ? `, ${town}` : ''),
        town: town ? (ulsterTownIn(town) || town) : null, lat, lng,
        url: t.website || t['contact:website'] || null, hours: t.opening_hours || null, source: 'OpenStreetMap'
      };
    }).filter(p => p.lat && p.lng);
  } catch (e) { console.warn('OSM failed', e.message); return []; }
}

// ---------- Google Sheet (manual additions / hides) ----------
async function readSheet() {
  try {
    const csv = await get(CFG.googleSheetCsv);
    if (/<html/i.test(csv.slice(0, 200))) throw new Error('Sheet is not shared as "Anyone with the link"');
    return parseCSV(csv);
  } catch (e) { console.warn('Sheet read failed:', e.message); return []; }
}

function to24(t) {
  if (!t) return null;
  const m = String(t).trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?$/i);
  if (!m) return null;
  let h = +m[1]; const mi = m[2] || '00'; const ap = (m[3] || '').toLowerCase();
  if (ap.startsWith('p') && h < 12) h += 12; if (ap.startsWith('a') && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${mi}`;
}
function toISODate(d) {
  if (!d) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  const m = d.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) return `${m[3].length === 2 ? '20' + m[3] : m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  const t = new Date(d); return isNaN(t) ? null : t.toISOString().slice(0, 10);
}

async function sheetRows(rows) {
  const events = [], places = [], hide = new Set();
  for (const r of rows) {
    const type = (r.type || 'event').toLowerCase();
    if (type === 'hide') { if (r.link) hide.add(r.link.trim()); if (r.title) hide.add(r.title.trim().toLowerCase()); continue; }
    if (!r.title) continue;
    const address = r.address || [r.venue, r.town, 'NY'].filter(Boolean).join(', ');
    const g = await geocode(address) || (r.town ? await geocode(`${r.town}, Ulster County, NY`) : null);
    const town = ulsterTownIn(r.town) || ulsterTownIn(address) || r.town || null;
    if (type === 'restaurant' || type === 'food') {
      if (!g) continue;
      places.push({ id: 'sh-' + slug(r.title), name: r.title, cuisine: (r.category || 'Restaurant').split(/[;,]/).map(s => s.trim()), tags: [], address, town, lat: g.lat, lng: g.lng, url: r.link || null, source: 'Chronogram team' });
      continue;
    }
    const pr = parsePrice(r.price);
    const sd = toISODate(r.start_date);
    if (!sd) continue;
    const ed = toISODate(r.end_date) || sd;
    const days = eachDay(sd, ed < sd ? sd : ed);
    events.push({
      id: 'sh-' + slug(r.title + '-' + sd), title: r.title,
      category: CATEGORIES.includes(r.category) ? r.category : normalizeCategory(r.category, r.title, r.description),
      rawCategory: r.category || '',
      occurrences: days.map(date => ({ date, start: to24(r.start_time), end: to24(r.end_time) })),
      ongoing: days.length > 3 && !r.start_time, when: null,
      venue: r.venue || '', address, town, county: CFG.county, lat: g?.lat ?? null, lng: g?.lng ?? null,
      price: pr.label, priceMin: pr.min, priceMax: pr.max,
      image: r.image_url || null,
      description: r.description || '', url: r.link || null, ticketUrl: r.link || null, source: 'Chronogram team'
    });
  }
  return { events, places, hide };
}

// ---------- Main ----------
const inWindow = e => {
  e.occurrences = (e.occurrences || []).filter(o => o.date >= CFG.windowStart && o.date <= CFG.windowEnd);
  return e.occurrences.length > 0;
};

async function main() {
  const rawEventsFile = path.join(CACHE, 'chronogram-events.json');
  const rawPlacesFile = path.join(CACHE, 'places-base.json');
  let cgEvents, basePlaces;

  if (SHEET_ONLY && fs.existsSync(rawEventsFile)) {
    cgEvents = readJSON(rawEventsFile, []);
    basePlaces = readJSON(rawPlacesFile, []);
  } else {
    cgEvents = await buildChronogramEvents();
    writeJSON(rawEventsFile, cgEvents);
    writeJSON(path.join(CACHE, 'geocode.json'), geoCache);
    writeJSON(path.join(CACHE, 'chronogram-details.json'), detailCache);
    const cgp = await buildChronogramPlaces();
    const osm = await buildOsmPlaces();
    basePlaces = [...cgp, ...osm];
    writeJSON(rawPlacesFile, basePlaces);
  }

  const sheet = await sheetRows(await readSheet());

  let events = cgEvents
    .filter(e => !sheet.hide.has(e.url) && !sheet.hide.has(e.title.toLowerCase()))
    .map(e => ({ ...e, occurrences: [...e.occurrences] }))
    .filter(inWindow);
  events = [...events, ...sheet.events.filter(inWindow)];
  const firstKey = e => e.occurrences[0].date + (e.occurrences[0].start || '');
  events.sort((a, b) => firstKey(a).localeCompare(firstKey(b)));

  // de-duplicate places (Chronogram listing wins over OSM when names match nearby)
  const places = [];
  for (const p of [...sheet.places, ...basePlaces]) {
    const dup = places.find(q => q.name.toLowerCase().replace(/[^a-z]/g, '') === p.name.toLowerCase().replace(/[^a-z]/g, '') && Math.abs(q.lat - p.lat) < 0.01 && Math.abs(q.lng - p.lng) < 0.01);
    if (!dup) places.push(p);
  }

  writeJSON(path.join(DATA, 'events.json'), events);
  writeJSON(path.join(DATA, 'places.json'), places);
  writeJSON(path.join(DATA, 'meta.json'), {
    updatedAt: new Date().toISOString(), windowStart: CFG.windowStart, windowEnd: CFG.windowEnd, county: CFG.county,
    counts: { events: events.length, places: places.length, sheetEvents: sheet.events.length, sheetPlaces: sheet.places.length }
  }, true);
  writeJSON(path.join(CACHE, 'geocode.json'), geoCache);
  writeJSON(path.join(CACHE, 'chronogram-details.json'), detailCache);
  console.log(`Done: ${events.length} events, ${places.length} places.`);
}

main().catch(e => { console.error(e); process.exit(1); });
