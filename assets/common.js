// Shared helpers: data loading, formatting, icons, and the "My day" bag.

export const $ = s => document.querySelector(s);
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MONTH_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const dateObj = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, 12); };
export const isoOf = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const fmtDate = s => { const d = dateObj(s); return `${DOW[d.getDay()]}, ${MON[d.getMonth()]} ${d.getDate()}`; };
export const fmtDateLong = s => dateObj(s).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
export function fmtTime(t) {
  if (!t) return '';
  let [h, m] = t.split(':').map(Number); const ap = h >= 12 ? 'pm' : 'am'; h = h % 12 || 12;
  return m ? `${h}:${String(m).padStart(2, '0')}${ap}` : `${h}${ap}`;
}
export const timeRange = o => o && o.start ? fmtTime(o.start) + (o.end && o.end !== o.start ? '–' + fmtTime(o.end) : '') : '';
export const todayISO = () => isoOf(new Date());

export const CATS = ['Music', 'Film', 'Arts & Culture', 'Theater & Comedy', 'Food & Drink', 'Family', 'Outdoors', 'Markets & Festivals', 'Classes & Workshops', 'Talks & Literary', 'Wellness', 'Community'];
export const STYLE = {
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
  ticket: '<path d="M3 7h18v3a2 2 0 0 0 0 4v3H3v-3a2 2 0 0 0 0-4z"/><path d="M14 7v10" stroke-dasharray="2 2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', check: '<path d="m5 12 5 5 9-10"/>', x: '<path d="M6 6l12 12M18 6 6 18"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>', car: '<path d="M5 16V11l2-5h10l2 5v5"/><path d="M3 16h18v3H3z"/><circle cx="7.5" cy="16" r="1.5"/><circle cx="16.5" cy="16" r="1.5"/>',
  swap: '<path d="M7 7h11l-3-3M17 17H6l3 3"/>', arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>', back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  sparkle: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5"/>',
  moon: '<path d="M20 14A8 8 0 0 1 10 4a8 8 0 1 0 10 10z"/>', sunrise: '<path d="M12 3v4M5 10l1.5 1.5M19 10l-1.5 1.5M3 18h18M7 18a5 5 0 0 1 10 0"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>', users: '<circle cx="9" cy="8" r="3.5"/><circle cx="17" cy="9" r="2.5"/><path d="M2 21a7 7 0 0 1 14 0M15 21a5 5 0 0 1 7-4.6"/>',
  heart: '<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/>', print: '<path d="M6 9V3h12v6M6 18H4v-7h16v7h-2M8 14h8v7H8z"/>', link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>', cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>'
};
export const svg = (name, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ICONS.home}</svg>`;

// Studio schedule link: their own website when known, otherwise a web search for their schedule (never Chronogram's listing, which can show old events)
export const studioLink = s => s.website || `https://www.google.com/search?q=${encodeURIComponent(`${s.name} ${s.town} NY class schedule`)}`;
export const studioLinkLabel = s => s.website ? 'See class times' : 'Find class times';

// ---------- data ----------
export async function loadData() {
  const get = (u, d) => fetch(u, { cache: 'no-cache' }).then(r => r.ok ? r.json() : d).catch(() => d);
  const [events, places, meta, studios] = await Promise.all([get('data/events.json', []), get('data/places.json', []), get('data/meta.json', null), get('data/wellness.json', [])]);
  const acc = {};
  for (const x of [...events, ...places]) {
    if (!x.town || x.lat == null) continue;
    (acc[x.town] ||= { lat: 0, lng: 0, n: 0, ev: 0 });
    acc[x.town].lat += x.lat; acc[x.town].lng += x.lng; acc[x.town].n++;
    if (x.occurrences) acc[x.town].ev++;
  }
  const townCenters = {};
  for (const [t, a] of Object.entries(acc)) townCenters[t] = { lat: a.lat / a.n, lng: a.lng / a.n };
  const topTowns = Object.entries(acc).filter(([, a]) => a.ev).sort((a, b) => b[1].ev - a[1].ev).map(([t]) => t);
  const windowStart = meta?.windowStart || '2026-12-01', windowEnd = meta?.windowEnd || '2027-05-31';
  const fmtMY = s => { const d = dateObj(s); return `${MONTH_LONG[d.getMonth()]} ${d.getFullYear()}`; };
  return { events, places, meta, studios, townCenters, towns: Object.keys(townCenters), topTowns, windowStart, windowEnd, windowLabel: `${fmtMY(windowStart)} – ${fmtMY(windowEnd)}` };
}

// ---------- "My day" bag (saved events, kept in this browser) ----------
const BAG_KEY = 'cg-bag';
export const bag = {
  get() { try { return JSON.parse(localStorage.getItem(BAG_KEY) || '[]'); } catch { return []; } },
  set(v) { try { localStorage.setItem(BAG_KEY, JSON.stringify(v)); } catch {} window.dispatchEvent(new Event('bagchange')); },
  has(id) { return this.get().includes(id); },
  toggle(id) { const b = this.get(); this.set(b.includes(id) ? b.filter(x => x !== id) : [...b, id]); },
  clear() { this.set([]); }
};

// ---------- dot-grid spotlight (used on the "Need help planning your day?" card) ----------
export function dotGrid(canvas) {
  const wrap = canvas.parentElement, x = canvas.getContext('2d');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let W, H, dpr = window.devicePixelRatio || 1, mx = -999, my = -999, tx = -999, ty = -999, t = 0, idle = true, visible = true;
  const size = () => { W = wrap.clientWidth; H = wrap.clientHeight; canvas.width = W * dpr; canvas.height = H * dpr; x.setTransform(dpr, 0, 0, dpr, 0, 0); };
  size(); new ResizeObserver(size).observe(wrap);
  wrap.addEventListener('pointermove', e => { const r = wrap.getBoundingClientRect(); tx = e.clientX - r.left; ty = e.clientY - r.top; idle = false; });
  wrap.addEventListener('pointerleave', () => { idle = true; });
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) requestAnimationFrame(frame); }).observe(wrap);
  const G = 20, R = 120;
  function frame() {
    if (!visible) return;
    t += 0.01;
    if (idle) { tx = W * 0.7 + Math.cos(t) * W * 0.2; ty = H * 0.5 + Math.sin(t * 1.3) * H * 0.3; }
    mx += (tx - mx) * 0.12; my += (ty - my) * 0.12;
    x.clearRect(0, 0, W, H);
    for (let gy = G / 2; gy < H; gy += G) for (let gx = G / 2; gx < W; gx += G) {
      const d = Math.hypot(gx - mx, gy - my), k = Math.max(0, 1 - d / R);
      if (k <= 0.02) { x.fillStyle = 'rgba(130,118,104,0.30)'; x.beginPath(); x.arc(gx, gy, 1.2, 0, 7); x.fill(); continue; }
      x.strokeStyle = `rgba(${Math.round(150 + 60 * k)},${Math.round(62 + 40 * k)},36,${0.35 + 0.65 * k})`;
      x.lineWidth = 1.1 + k * 1.5; x.beginPath(); x.arc(gx, gy, 1.8 + k * 5, 0, 7); x.stroke();
    }
    if (!reduce) requestAnimationFrame(frame);
  }
  frame();
}
