// Shared helpers for the data pipeline.

// Towns, villages and hamlets in Ulster County, NY (used when geocoding can't tell us the county).
export const ULSTER_TOWNS = [
  'Kingston', 'New Paltz', 'Saugerties', 'Woodstock', 'Rosendale', 'Stone Ridge', 'High Falls',
  'Marbletown', 'Rochester', 'Accord', 'Kerhonkson', 'Ellenville', 'Wawarsing', 'Napanoch',
  'Phoenicia', 'Shandaken', 'Mount Tremper', 'Mt. Tremper', 'Mt Tremper', 'Pine Hill', 'Big Indian',
  'Shokan', 'West Shokan', 'Olive', 'Olivebridge', 'Boiceville', 'West Hurley', 'Hurley',
  'Lake Katrine', 'Ulster Park', 'Esopus', 'Port Ewen', 'Rifton', 'Highland', 'Lloyd', 'Clintondale',
  'Milton', 'Marlboro', 'Marlborough', 'Plattekill', 'Modena', 'Wallkill', 'Shawangunk', 'Gardiner',
  'Tillson', 'Bloomington', 'Cottekill', 'Glasco', 'West Camp', 'Malden-on-Hudson', 'Bearsville',
  'Lake Hill', 'Willow', 'Mount Marion', 'Ruby', 'Walker Valley', 'Denning', 'Hardenburgh',
  'Connelly', 'Eddyville', 'Spring Glen', 'Cragsmoor', 'Zena', 'Shady', 'Krumville', 'Samsonville',
  'Chichester', 'Allaben', 'Ulster', 'Town of Ulster', 'Wilbur', 'Sawkill', 'Kripplebush'
];

const TOWN_RE = new RegExp('\\b(' + ULSTER_TOWNS.map(t => t.replace(/[.]/g, '\\.')).join('|') + ')\\b', 'i');

export function ulsterTownIn(text = '') {
  const m = String(text).match(TOWN_RE);
  return m ? canonicalTown(m[1]) : null;
}

export function canonicalTown(t) {
  const x = t.toLowerCase();
  if (x.startsWith('mt')) return 'Mount Tremper';
  if (x === 'marlborough') return 'Marlboro';
  if (x === 'town of ulster') return 'Ulster';
  return ULSTER_TOWNS.find(u => u.toLowerCase() === x) || t;
}

// Pull "Town" out of "20 Carroll St, Poughkeepsie, NY 12603"
export function townFromAddress(addr = '') {
  const parts = String(addr).split(',').map(s => s.trim()).filter(Boolean);
  if (parts.length >= 3) return parts[parts.length - 2];
  if (parts.length === 2 && /NY/.test(parts[1])) return parts[0];
  return null;
}

// Map Chronogram's categories onto the app's categories.
export const CATEGORIES = [
  'Music', 'Film', 'Arts & Culture', 'Theater & Comedy', 'Food & Drink', 'Family', 'Outdoors',
  'Classes & Workshops', 'Talks & Literary', 'Wellness', 'Markets & Festivals', 'Community'
];

export function normalizeCategory(raw = '', title = '', desc = '') {
  // Chronogram lists several ("Comedy, Food & Wine, Nightlife"): the first one is the main one
  const first = String(raw).split(',')[0];
  const hit = first && mapOne(first.toLowerCase());
  if (hit) return hit;
  return mapOne(String(raw).toLowerCase()) || fallback((raw + ' ' + title).toLowerCase());
}

function mapOne(r) {
  if (/holiday/.test(r)) return 'Markets & Festivals';
  if (/spiritual/.test(r)) return 'Wellness';
  if (/nightlife|cabaret/.test(r)) return /comedy/.test(r) ? 'Theater & Comedy' : 'Music';
  if (/craft beverage|cocktail/.test(r)) return 'Food & Drink';
  if (/science|technology|business|networking|pets|open house|parties|benefit/.test(r)) return 'Community';
  return mapBase(r);
}

function fallback(all) {
  if (/concert|band|live music|jazz|quartet|orchestra|symphony|choir/.test(all)) return 'Music';
  if (/screening|film|movie/.test(all)) return 'Film';
  if (/market|festival|fair/.test(all)) return 'Markets & Festivals';
  if (/hike|walk|trail/.test(all)) return 'Outdoors';
  return 'Community';
}

function mapBase(r) {
  if (/music|concert|jazz|dj|open mic/.test(r)) return 'Music';
  if (/film|movie|cinema/.test(r)) return 'Film';
  if (/theat|comedy|dance|perform|opera|cabaret/.test(r)) return 'Theater & Comedy';
  if (/food|drink|wine|beer|dining|tasting/.test(r)) return 'Food & Drink';
  if (/kid|family|children|teen/.test(r)) return 'Family';
  if (/outdoor|hike|nature|garden|sport|recreation/.test(r)) return 'Outdoors';
  if (/market|festival|fair|holiday|craft/.test(r)) return 'Markets & Festivals';
  if (/workshop|class|education/.test(r)) return 'Classes & Workshops';
  if (/lecture|talk|literar|book|reading|poetry/.test(r)) return 'Talks & Literary';
  if (/health|wellness|yoga|spiritual|meditat/.test(r)) return 'Wellness';
  if (/art|exhibit|gallery|museum|photo/.test(r)) return 'Arts & Culture';
  if (/club|organization|community|civic|fundrais|benefit|volunteer|support/.test(r)) return 'Community';
  return null;
}

// "$0-$72" -> {min:0,max:72}; "Free" -> {min:0,max:0}
export function parsePrice(p) {
  if (!p) return { label: null, min: null, max: null };
  const s = String(p).trim();
  if (/free/i.test(s)) return { label: 'Free', min: 0, max: 0 };
  const nums = (s.match(/\d+(?:\.\d+)?/g) || []).map(Number);
  if (!nums.length) return { label: s, min: null, max: null };
  const min = Math.min(...nums), max = Math.max(...nums);
  let label = min === max ? `$${min}` : `$${min}–$${max}`;
  if (max === 0) label = 'Free';
  return { label, min, max };
}

export function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
}

export const sleep = ms => new Promise(r => setTimeout(r, ms));

// Minimal CSV parser (handles quotes, commas and newlines inside quotes)
export function parseCSV(text) {
  const rows = []; let row = []; let cell = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  const head = (rows.shift() || []).map(h => h.trim().toLowerCase());
  return rows.filter(r => r.some(x => x.trim())).map(r => Object.fromEntries(head.map((h, i) => [h, (r[i] || '').trim()])));
}

export function stripHtml(s = '') {
  return String(s).replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
}

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };

function hhmm(h, m, ap) {
  h = +h; m = m ? +m : 0;
  if (ap === 'p' && h < 12) h += 12;
  if (ap === 'a' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
// "7:30-9:30 p.m." | "4 p.m.-12 a.m." | "7 p.m." | "2-4 & 7-9 p.m." | "noon"
export function parseTimeRange(s = '') {
  const t = s.toLowerCase().replace(/noon/g, '12 p.m.').replace(/midnight/g, '12 a.m.');
  const m = t.match(/(\d{1,2})(?::(\d{2}))?\s*(a|p)?\.?m?\.?\s*(?:-|–|to)\s*(\d{1,2})(?::(\d{2}))?\s*(a|p)\.?m\.?/);
  if (m) {
    const endAp = m[6]; let startAp = m[3];
    if (!startAp) startAp = +m[1] === 12 ? 'p' : (+m[1] > +m[4] && endAp === 'p') ? 'a' : endAp;
    return { start: hhmm(m[1], m[2], startAp), end: hhmm(m[4], m[5], endAp) };
  }
  const one = t.match(/(\d{1,2})(?::(\d{2}))?\s*(a|p)\.?m\.?/);
  if (one) return { start: hhmm(one[1], one[2], one[3]), end: null };
  return { start: null, end: null };
}
// Find the time for a given date inside listing text like "Fri., Dec. 11, 7 p.m., Sat., Dec. 12, 4 p.m. and Sun., Dec. 13, 2 p.m."
export function timeForDate(when = '', isoDate) {
  const [, mo, da] = isoDate.split('-').map(Number);
  const segs = when.split(/(?:,|\band\b)\s*(?=(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*\.?,)/);
  for (const seg of segs) {
    const m = seg.match(/(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*\.?,\s*([A-Za-z]{3,5})\.?\s+(\d{1,2})(.*)/);
    if (m) {
      const mm = MONTHS[m[1].toLowerCase().slice(0, 3)];
      if (mm === mo && +m[2] === da) return parseTimeRange(m[3]);
    }
  }
  // recurring text ("Mondays, 11 a.m.-2 p.m.") or single listing: first time range found
  return parseTimeRange(when);
}

