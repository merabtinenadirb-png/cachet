/* Cachet — l'invitation qui tient dans un lien. Aucune dépendance, aucun serveur. */
(() => {
'use strict';
const CFG = window.CACHET || {};
const I18N = window.CACHET_I18N || {};
const PL = CFG.lang || 'fr';
const t = (k, l, vars) => {
  let s = (I18N[l || PL] && I18N[l || PL][k]);
  if (s == null) s = (I18N.fr && I18N.fr[k]);
  if (s == null) s = k;
  if (vars) for (const key in vars) s = s.split('{' + key + '}').join(vars[key]);
  return s;
};
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
function h(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  if (attrs) for (const k in attrs) {
    const v = attrs[k];
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k === 'svg') e.innerHTML = v; // uniquement du SVG généré par ce fichier
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat(3)) { if (c == null || c === false) continue; e.append(c.nodeType ? c : document.createTextNode(String(c))); }
  return e;
}
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
};

/* ───────────── Mesure (compteurs anonymes, aucune donnée personnelle) ───────────── */
const BOT = /bot|crawl|spider|slurp|headless|lighthouse/i;
if (/[?&]notrack/.test(location.search)) store.set('cachet_notrack', true);
const trackOff = !CFG.ns || (!window.__cachetTrack && (navigator.webdriver || BOT.test(navigator.userAgent))) || store.get('cachet_notrack', false);
function track(key) {
  if (trackOff) return;
  try { fetch('https://abacus.jasoncameron.dev/hit/' + CFG.ns + '/' + key, { mode: 'cors', keepalive: true }).catch(() => {}); } catch (e) {}
}
function trackOnce(key, scope) {
  const seen = store.get('cachet_once', {}); const id = scope || key;
  if (seen[id]) return false; seen[id] = 1; store.set('cachet_once', seen); track(key); return true;
}
function recordVisit() {
  const today = new Date().toISOString().slice(0, 10);
  const v = store.get('cachet_v', null);
  const viaInv = CFG.page === 'inv' && location.hash.length > 10;
  if (!v) {
    let src = 'direct';
    try {
      const ref = document.referrer;
      if (ref) {
        const host = new URL(ref).hostname;
        if (host !== location.hostname) src = /google\.|bing\.|duckduckgo|yahoo\.|yandex|ecosia|qwant|search\.brave/.test(host) ? 'search'
          : /facebook|instagram|^t\.co$|twitter|^x\.com$|tiktok|linkedin|pinterest|reddit|youtube|whatsapp|telegram|^t\.me$/.test(host) ? 'social' : 'referral';
      }
    } catch (e) {}
    if (viaInv) src = 'inv';
    store.set('cachet_v', { first: today, last: today, src });
    track('v_new'); track('src_' + src);
  } else if (v.last !== today) {
    if (!v.ret) { v.ret = 1; track('v_ret'); }
    v.last = today; store.set('cachet_v', v);
  }
  try { if (!sessionStorage.getItem('cachet_s')) { sessionStorage.setItem('cachet_s', '1'); track('visit'); } } catch (e) {}
}

/* ───────────── Codec : l'invitation entière dans le lien ───────────── */
const b64u = {
  enc(bytes) { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); },
  dec(str) { const s = atob(str.replace(/-/g, '+').replace(/_/g, '/')); const out = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i); return out; },
  encText(txt) { return b64u.enc(new TextEncoder().encode(txt)); },
  decText(str) { return new TextDecoder().decode(b64u.dec(str)); },
};
async function pipe(bytes, stream) { return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer()); }
function loadScript(src) { return new Promise((ok, ko) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = ko; document.head.append(s); }); }
async function pack(obj) {
  const raw = new TextEncoder().encode(JSON.stringify(obj));
  if ('CompressionStream' in window) {
    try { const z = await pipe(raw, new CompressionStream('deflate-raw')); if (z.length < raw.length) return 'z' + b64u.enc(z); } catch (e) {}
  }
  return 'j' + b64u.enc(raw);
}
async function unpack(str) {
  const kind = str[0]; let bytes = b64u.dec(str.slice(1));
  if (kind === 'z') {
    if ('DecompressionStream' in window) bytes = await pipe(bytes, new DecompressionStream('deflate-raw'));
    else { await loadScript('https://cdn.jsdelivr.net/npm/fflate@0.8.2/umd/index.js'); bytes = window.fflate.inflateSync(bytes); }
  } else if (kind !== 'j') throw new Error('format');
  const obj = JSON.parse(new TextDecoder().decode(bytes));
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error('format');
  return clean(obj);
}

/* ───────────── Modèle ───────────── */
const OCC = ['wedding', 'engagement', 'birthday', 'baby', 'party', 'dinner', 'other'];
const LANGS = ['fr', 'en', 'ar'];
const THEMES = {
  ivoire:  { name: { fr: 'Ivoire', en: 'Ivory', ar: 'عاجي' }, seal: '#8a1c2b', bg: '#e9dfcc', paper: '#fbf7ee', free: true },
  nuit:    { name: { fr: 'Nuit', en: 'Night', ar: 'ليل' }, seal: '#b98a2e', bg: '#0b1322', paper: '#121c30', free: true },
  olivier: { name: { fr: 'Olivier', en: 'Olive', ar: 'زيتون' }, seal: '#55653a', bg: '#d9dfcb', paper: '#f7f6ec', free: true },
  zellige: { name: { fr: 'Zellige', en: 'Zellige', ar: 'زليج' }, seal: '#0e5c52', bg: '#0c3530', paper: '#f8f2e4', free: false },
  ornoir:  { name: { fr: 'Or noir', en: 'Black Gold', ar: 'ذهب أسود' }, seal: '#c79f4f', bg: '#070707', paper: '#111110', free: false },
  poudre:  { name: { fr: 'Rose poudré', en: 'Powder Rose', ar: 'وردي ناعم' }, seal: '#b8626d', bg: '#f0d6cf', paper: '#fff8f4', free: false },
};
const FREE_GUESTS = CFG.freeGuests || 10;
const FREE_STEPS = 3;
function clean(o) {
  const s = (v, n) => (typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000b-\u001f]/g, '').slice(0, n).trim() : '');
  const idc = (v) => s(v, 8).replace(/[^A-Za-z0-9]/g, '');
  return {
    v: 1, o: OCC.includes(o.o) ? o.o : 'other', a: s(o.a, 60), b: s(o.b, 60), h: s(o.h, 140),
    d: /^\d{4}-\d\d-\d\d(T\d\d:\d\d)?$/.test(o.d || '') ? o.d : '', pl: s(o.pl, 80), ad: s(o.ad, 140), m: s(o.m, 600), dc: s(o.dc, 80),
    w: typeof o.w === 'string' ? o.w.replace(/\D/g, '').slice(0, 15) : '', th: THEMES[o.th] ? o.th : 'ivoire', l: LANGS.includes(o.l) ? o.l : 'fr',
    pr: Array.isArray(o.pr) ? o.pr.slice(0, 8).map((x) => (Array.isArray(x) ? [s(x[0], 5), s(x[1], 60)] : null)).filter((x) => x && x[1]) : [],
    k: s(o.k, 130), id: idc(o.id), p: idc(o.p), g: Math.max(0, Math.min(99, o.g | 0)),
  };
}
function compact(inv) { const out = {}; for (const k in inv) { const v = inv[k]; if (v === '' || v === 0 || (Array.isArray(v) && !v.length)) continue; out[k] = v; } out.v = 1; return out; }
const hostsOf = (inv, l) => (inv.b ? inv.a + ' ' + t('and', l || inv.l) + ' ' + inv.b : inv.a);
const newId = () => { const A = 'abcdefghijkmnpqrstuvwxyz23456789'; let s = ''; const r = crypto.getRandomValues(new Uint8Array(6)); for (const b of r) s += A[b % A.length]; return s; };
function parseDate(d) { const m = /^(\d{4})-(\d\d)-(\d\d)(?:T(\d\d):(\d\d))?$/.exec(d || ''); if (!m) return null; return { date: new Date(+m[1], +m[2] - 1, +m[3], m[4] ? +m[4] : 0, m[5] ? +m[5] : 0), timed: !!m[4] }; }
const locOf = (l) => (l === 'ar' ? 'ar-u-nu-latn' : l === 'en' ? 'en-GB' : 'fr-FR');
function fmtDate(inv) {
  const p = parseDate(inv.d); if (!p) return { day: '', time: '' };
  let day = '', time = '';
  try { day = new Intl.DateTimeFormat(locOf(inv.l), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(p.date); } catch (e) { day = inv.d.slice(0, 10); }
  if (p.timed) { try { time = new Intl.DateTimeFormat(locOf(inv.l), { hour: '2-digit', minute: '2-digit' }).format(p.date); } catch (e) { time = inv.d.slice(11); } }
  return { day, time };
}
function eventLine(inv) { const f = fmtDate(inv); return t('o_' + inv.o, inv.l) + ' — ' + hostsOf(inv) + (f.day ? ', ' + f.day : ''); }

/* ───────────── Licence Signature (signature ECDSA vérifiée dans le navigateur) ───────────── */
const licCache = new Map();
async function verifyLicense(code) {
  code = (code || '').trim();
  if (licCache.has(code)) return licCache.get(code);
  let ok = false;
  try {
    const m = /^CS1-([SP])([A-Z0-9]{6})-([A-Za-z0-9_-]{86})$/.exec(code);
    if (m && CFG.pub && crypto.subtle) {
      const key = await crypto.subtle.importKey('jwk', CFG.pub, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
      ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, b64u.dec(m[3]), new TextEncoder().encode('CS1.' + m[1] + '.' + m[2]));
    }
  } catch (e) { ok = false; }
  licCache.set(code, ok); return ok;
}

/* ───────────── Le sceau : unique, déterministe, dessiné selon l'angle d'or ───────────── */
function hash32(str) { let x = 2166136261; for (let i = 0; i < str.length; i++) { x ^= str.charCodeAt(i); x = Math.imul(x, 16777619); } return x >>> 0; }
function rng(seed) { return () => { seed = (seed + 0x6D2B79F5) | 0; let x = Math.imul(seed ^ (seed >>> 15), 1 | seed); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; }
function shade(hex, k) { const n = parseInt(hex.slice(1), 16); const c = [n >> 16 & 255, n >> 8 & 255, n & 255].map((v) => Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k))); return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join(''); }
const escXml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function firstLetter(s) { s = (s || '').trim(); if (!s) return ''; const ch = Array.from(s)[0]; return ch.toLocaleUpperCase(); }
function initialsOf(a, b) { const x = firstLetter(a), y = firstLetter(b); return y ? x + '·' + y : x; }
let sealUid = 0;
function sealSVG(text, color, initials) {
  const id = 'sl' + (++sealUid);
  const key = (text || 'cachet').toLowerCase().replace(/\s+/g, ' ').trim() || 'cachet';
  const r = rng(hash32(key)); const f = (n) => n.toFixed(2);
  const lobes = [[3 + Math.floor(r() * 3), 0.9 + r() * 1.2, r() * 6.283], [7 + Math.floor(r() * 4), 0.5 + r() * 0.8, r() * 6.283], [13 + Math.floor(r() * 5), 0.2 + r() * 0.45, r() * 6.283]];
  const N = 72, pts = [];
  for (let i = 0; i < N; i++) { const a = i / N * 6.283185; let rad = 44.6; for (const [fr, amp, ph] of lobes) rad += amp * Math.sin(a * fr + ph); pts.push([50 + rad * Math.cos(a), 50 + rad * Math.sin(a)]); }
  const mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  let d = 'M' + mid(pts[N - 1], pts[0]).map(f).join(' ');
  for (let i = 0; i < N; i++) { const m = mid(pts[i], pts[(i + 1) % N]); d += 'Q' + f(pts[i][0]) + ' ' + f(pts[i][1]) + ' ' + f(m[0]) + ' ' + f(m[1]); }
  d += 'Z';
  const fib = [34, 55, 89][Math.floor(r() * 3)], style = Math.floor(r() * 3), rot = r() * 6.283, GA = 2.399963229728653;
  let marks = '';
  for (let i = 0; i < fib; i++) {
    const rr = 14.6 + 17 * Math.sqrt((i + 0.5) / fib), a = i * GA + rot, x = 50 + rr * Math.cos(a), y = 50 + rr * Math.sin(a), sz = 0.62 + 1.2 * (i / fib);
    const deg = f(a * 57.29578);
    if (style === 0) marks += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(sz)}"/>`;
    else if (style === 1) marks += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(sz * 1.55)}" ry="${f(sz * 0.62)}" transform="rotate(${deg} ${f(x)} ${f(y)})"/>`;
    else marks += `<rect x="${f(x - sz * 0.8)}" y="${f(y - sz * 0.8)}" width="${f(sz * 1.6)}" height="${f(sz * 1.6)}" transform="rotate(${f(a * 57.29578 + 45)} ${f(x)} ${f(y)})"/>`;
  }
  const ini = escXml(initials || firstLetter(text) || 'C');
  const isAr = /[\u0600-\u06FF]/.test(ini);
  const fs = Array.from(initials || 'C').length > 1 ? (isAr ? 10.5 : 11.5) : (isAr ? 14 : 16);
  const txt = `font-family="${isAr ? 'Amiri' : 'Cormorant Garamond'},serif" font-weight="600" font-size="${fs}" text-anchor="middle" direction="${isAr ? 'rtl' : 'ltr'}"`;
  const hi = 'rgba(255,255,255,.34)', lo = 'rgba(0,0,0,.32)';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" class="seal-svg" role="img" aria-hidden="true"><defs>` +
    `<radialGradient id="${id}g" cx="36%" cy="30%" r="78%"><stop offset="0" stop-color="${shade(color, 0.3)}"/><stop offset=".55" stop-color="${color}"/><stop offset="1" stop-color="${shade(color, -0.38)}"/></radialGradient>` +
    `<g id="${id}m">${marks}<circle cx="50" cy="50" r="35.4" fill="none" stroke-width="1.1" stroke="currentColor"/><circle cx="50" cy="50" r="12.4" fill="none" stroke-width=".8" stroke="currentColor"/></g></defs>` +
    `<path d="${d}" fill="${shade(color, -0.5)}" opacity=".35" transform="translate(1.2 2.2)"/>` +
    `<path d="${d}" fill="url(#${id}g)"/>` +
    `<circle cx="50" cy="50" r="38.6" fill="${shade(color, -0.12)}" opacity=".5"/><circle cx="50" cy="50" r="37.6" fill="url(#${id}g)"/>` +
    `<use href="#${id}m" fill="${hi}" color="${hi}" transform="translate(-.45 -.45)"/><use href="#${id}m" fill="${lo}" color="${lo}" transform="translate(.4 .4)"/>` +
    `<text x="49.6" y="${f(50 + fs * 0.33 - 0.4)}" fill="${hi}" ${txt}>${ini}</text><text x="50.4" y="${f(50 + fs * 0.33 + 0.4)}" fill="${lo}" ${txt}>${ini}</text>` +
    `<ellipse cx="36" cy="27" rx="15" ry="7" fill="#fff" opacity=".13" transform="rotate(-32 36 27)"/></svg>`;
}
const sealFor = (inv) => sealSVG((inv.a + ' ' + inv.b).trim(), THEMES[inv.th].seal, initialsOf(inv.a, inv.b));

/* ───────────── Rendu de la carte d'invitation ───────────── */
function googleCal(inv) {
  const p = parseDate(inv.d); if (!p) return '';
  const z = (n) => String(n).padStart(2, '0'); const ymd = (x) => x.getFullYear() + z(x.getMonth() + 1) + z(x.getDate());
  let dates;
  if (p.timed) { const e = new Date(p.date.getTime() + 3 * 3600e3); const hm = (x) => 'T' + z(x.getHours()) + z(x.getMinutes()) + '00'; dates = ymd(p.date) + hm(p.date) + '/' + ymd(e) + hm(e); }
  else { const e = new Date(p.date.getTime() + 86400e3); dates = ymd(p.date) + '/' + ymd(e); }
  const q = new URLSearchParams({ action: 'TEMPLATE', text: t('o_' + inv.o, inv.l) + ' — ' + hostsOf(inv), dates, location: [inv.pl, inv.ad].filter(Boolean).join(', '), details: inv.m });
  return 'https://calendar.google.com/calendar/render?' + q.toString();
}
function icsOf(inv) {
  const p = parseDate(inv.d); if (!p) return '';
  const z = (n) => String(n).padStart(2, '0'); const ymd = (x) => x.getFullYear() + z(x.getMonth() + 1) + z(x.getDate());
  const esc = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
  let st, en;
  if (p.timed) { const e = new Date(p.date.getTime() + 3 * 3600e3); const hm = (x) => 'T' + z(x.getHours()) + z(x.getMinutes()) + '00'; st = 'DTSTART:' + ymd(p.date) + hm(p.date); en = 'DTEND:' + ymd(e) + hm(e); }
  else { const e = new Date(p.date.getTime() + 86400e3); st = 'DTSTART;VALUE=DATE:' + ymd(p.date); en = 'DTEND;VALUE=DATE:' + ymd(e); }
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Cachet//FR', 'BEGIN:VEVENT', 'UID:' + (inv.id || 'cachet') + '@cachet', 'DTSTAMP:' + new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z', st, en,
    'SUMMARY:' + esc(t('o_' + inv.o, inv.l) + ' — ' + hostsOf(inv)), 'LOCATION:' + esc([inv.pl, inv.ad].filter(Boolean).join(', ')), 'DESCRIPTION:' + esc(inv.m), 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
}
function copyText(txt, btn, okLabel) {
  const done = () => { if (!btn) return; const old = btn.textContent; btn.textContent = okLabel || t('r_copied'); btn.classList.add('ok'); setTimeout(() => { btn.textContent = old; btn.classList.remove('ok'); }, 1600); };
  const fallback = () => { try { const ta = h('textarea', { style: 'position:fixed;opacity:0;top:0' }); ta.value = txt; document.body.append(ta); ta.select(); document.execCommand('copy'); ta.remove(); done(); } catch (e) {} };
  try { navigator.clipboard.writeText(txt).then(done, fallback); } catch (e) { fallback(); }
}

/* opts : {guest, premium, live (vraie invitation reçue), preview} */
function renderCard(inv, opts = {}) {
  const L = inv.l, T = (k, v) => t(k, L, v), live = !!opts.live;
  const theme = THEMES[inv.th] && (THEMES[inv.th].free || opts.premium || opts.preview) ? inv.th : 'ivoire';
  const view = Object.assign({}, inv, { th: theme });
  const f = fmtDate(view), timers = [];
  const card = h('article', { class: 'card theme-' + theme + (opts.premium ? ' is-premium' : ''), dir: L === 'ar' ? 'rtl' : 'ltr', lang: L });
  card.append(h('div', { class: 'orn orn-top', 'aria-hidden': 'true' }));
  const inner = h('div', { class: 'card-in' }); card.append(inner);
  inner.append(h('div', { class: 'mini-seal', svg: sealFor(view) }));
  inner.append(h('p', { class: 'occ', text: T('o_' + inv.o) }));
  inner.append(h('h1', { class: 'names' + ((inv.a + inv.b).length > 22 ? ' long' : '') }, h('span', { text: inv.a || '…' }), inv.b ? h('span', { class: 'amp', text: L === 'ar' ? 'و' : '&' }) : null, inv.b ? h('span', { text: inv.b }) : null));
  inner.append(h('p', { class: 'head', text: inv.h || T('h_' + inv.o) }));
  inner.append(h('div', { class: 'rule', 'aria-hidden': 'true' }, h('i'), h('b'), h('i')));
  if (f.day) inner.append(h('p', { class: 'date', text: f.day }));
  if (f.time) inner.append(h('p', { class: 'time', text: T('v_at') + ' ' + f.time }));

  const p = parseDate(inv.d);
  if (p) {
    const box = h('div', { class: 'count', 'aria-live': 'off' }); inner.append(box);
    const cells = ['v_days', 'v_hours', 'v_min', 'v_sec'].map((k) => { const n = h('b', { text: '0' }); box.append(h('div', { class: 'cell' }, n, h('span', { text: T(k) }))); return n; });
    const note = h('p', { class: 'count-note', hidden: true }); inner.append(note);
    const tick = () => {
      const now = Date.now(); let diff = p.date.getTime() - now;
      const sameDay = new Date().toDateString() === p.date.toDateString();
      if (diff <= 0) {
        box.hidden = true; note.hidden = false;
        note.textContent = (sameDay || (p.timed && now - p.date.getTime() < 12 * 3600e3)) ? T('v_today') : T('v_past');
        return;
      }
      const s = Math.floor(diff / 1000); const v = [Math.floor(s / 86400), Math.floor(s % 86400 / 3600), Math.floor(s % 3600 / 60), s % 60];
      cells.forEach((c, i) => { const val = String(v[i]).padStart(i ? 2 : 1, '0'); if (c.textContent !== val) c.textContent = val; });
    };
    tick(); timers.push(setInterval(tick, 1000));
  }

  if (inv.pl || inv.ad) {
    const q = encodeURIComponent([inv.pl, inv.ad].filter(Boolean).join(', '));
    inner.append(h('div', { class: 'place' }, inv.pl ? h('strong', { text: inv.pl }) : null, inv.ad ? h('span', { text: inv.ad }) : null,
      h('a', { class: 'btn-line', href: 'https://www.google.com/maps/search/?api=1&query=' + q, target: '_blank', rel: 'noopener', onclick: () => live && track('map_open') }, T('v_map'))));
  }
  if (inv.m) inner.append(h('p', { class: 'msg', text: inv.m }));
  if (inv.pr.length) {
    const steps = inv.pr.slice(0, opts.premium || opts.preview ? 8 : FREE_STEPS);
    inner.append(h('div', { class: 'prog' }, h('h2', { text: T('v_prog') }), h('ul', null, steps.map(([tm, lb]) => h('li', null, h('time', { text: tm || '·' }), h('span', { text: lb }))))));
  }
  if (inv.dc) inner.append(h('p', { class: 'dress' }, h('span', { text: T('v_dress') }), ' ', inv.dc));

  /* Réponse */
  const rsvp = h('section', { class: 'rsvp' }); inner.append(rsvp);
  rsvp.append(h('h2', { text: T('v_rsvp') }));
  const st = { choice: '', n: 1, name: opts.guest || '' };
  const choices = h('div', { class: 'choices', role: 'group' }); rsvp.append(choices);
  const detail = h('div', { class: 'rsvp-detail', hidden: true }); rsvp.append(detail);
  const nameIn = h('input', { type: 'text', class: 'in', placeholder: T('v_name_ph'), maxlength: '40', autocomplete: 'given-name', 'aria-label': T('v_name_ph') });
  nameIn.value = st.name;
  const cnt = h('b', { text: '1' });
  const stepper = h('div', { class: 'stepper' }, h('span', { text: T('v_count') }),
    h('button', { type: 'button', 'aria-label': '−', onclick: () => { st.n = Math.max(1, st.n - 1); upd(); } }, '−'), cnt,
    h('button', { type: 'button', 'aria-label': '+', onclick: () => { st.n = Math.min(12, st.n + 1); upd(); } }, '+'));
  const warn = h('p', { class: 'warn', hidden: true, text: T('v_need_name') });
  const send = h('a', { class: 'btn btn-accent', href: '#', target: '_blank', rel: 'noopener' }, inv.w ? T('v_send_wa') : T('v_send_copy'));
  if (!opts.guest) detail.append(nameIn);
  detail.append(stepper, warn, send);
  const msgOf = () => T('m_' + st.choice, { name: st.name.trim(), n: st.n, event: eventLine(inv) });
  function upd() {
    cnt.textContent = st.n; stepper.hidden = st.choice !== 'yes'; detail.hidden = !st.choice;
    $$('button', choices).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.c === st.choice)));
    if (st.choice && inv.w) send.href = 'https://wa.me/' + inv.w + '?text=' + encodeURIComponent(msgOf()); else send.removeAttribute('href');
  }
  ['yes', 'maybe', 'no'].forEach((c) => choices.append(h('button', { type: 'button', class: 'choice', 'data-c': c, 'aria-pressed': 'false', onclick: () => { st.choice = c; upd(); } }, T('v_' + c))));
  nameIn.addEventListener('input', () => { st.name = nameIn.value; warn.hidden = true; upd(); });
  send.addEventListener('click', (ev) => {
    if (!st.name.trim()) { ev.preventDefault(); warn.hidden = false; nameIn.focus(); return; }
    if (live) track('rsvp_' + st.choice);
    if (!inv.w) { ev.preventDefault(); copyText(msgOf(), send, T('r_copied')); }
  });
  upd();

  /* Calendrier */
  if (p) {
    const ics = h('a', { class: 'btn-line', href: '#', onclick: (ev) => {
      ev.preventDefault(); if (live) track('cal_add');
      try { const url = URL.createObjectURL(new Blob([icsOf(inv)], { type: 'text/calendar' })); const a = h('a', { href: url, download: 'invitation.ics' }); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000); } catch (e) {}
    } }, T('v_ics'));
    inner.append(h('div', { class: 'cal' }, h('span', { text: T('v_cal') }), h('a', { class: 'btn-line', href: googleCal(inv), target: '_blank', rel: 'noopener', onclick: () => live && track('cal_add') }, T('v_gcal')), CFG.single ? null : ics));
  }

  /* Boucle de curiosité : forger son propre sceau */
  const builderUrl = (name) => { const q = new URLSearchParams(); if (name) q.set('n', name); if (inv.id) q.set('p', inv.id + '.' + inv.g); return (CFG.root || '') + (L === 'fr' ? '' : L + '/') + '?' + q.toString() + '#creer'; };
  const goBuild = (ev, name, how) => {
    if (live) { track(how); store.set('cachet_parent', { p: inv.id, g: inv.g, via: 'click' }); }
    if (opts.onCreate) { ev.preventDefault(); opts.onCreate(name); }
  };
  if (!opts.premium) {
    const fz = h('section', { class: 'forge' }); card.append(fz);
    const prev = h('div', { class: 'forge-seal', svg: sealSVG('?', THEMES[theme].seal, '?') });
    const fin = h('input', { type: 'text', class: 'in', placeholder: T('forge_ph'), maxlength: '40', 'aria-label': T('forge_ph') });
    const cta = h('a', { class: 'btn btn-accent', href: builderUrl('') }, T('forge_cta'));
    let forged = false, tm;
    fin.addEventListener('input', () => {
      clearTimeout(tm); tm = setTimeout(() => {
        const v = fin.value.trim(); prev.innerHTML = sealSVG(v || '?', THEMES[theme].seal, firstLetter(v) || '?'); prev.classList.remove('pop'); void prev.offsetWidth; prev.classList.add('pop');
        cta.href = builderUrl(v); if (v && !forged && live) { forged = true; track('forge'); }
      }, 140);
    });
    cta.addEventListener('click', (ev) => goBuild(ev, fin.value.trim(), 'loop_click'));
    fz.append(prev, h('h2', { text: T('forge_title') }), h('p', { text: T('forge_sub') }), h('div', { class: 'forge-row' }, fin, cta));
  }
  const fl = h('a', { class: 'foot-link', href: builderUrl('') }, opts.premium ? T('foot') : T('foot') + ' · ' + T('foot_cta'));
  fl.addEventListener('click', (ev) => goBuild(ev, '', 'loop_click'));
  card.append(h('footer', { class: 'card-foot' }, fl));
  return { el: card, destroy: () => timers.forEach(clearInterval) };
}

/* ───────────── Enveloppe scellée + ouverture ───────────── */
function envelopeParts() {
  const id = 'ev' + (++sealUid);
  const grad = (n, a, b) => `<linearGradient id="${id}${n}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(${a})"/><stop offset="1" style="stop-color:var(${b})"/></linearGradient>`;
  const svg = (n, a, b, pts) => `<svg viewBox="0 0 300 200" preserveAspectRatio="none" aria-hidden="true"><defs>${grad(n, a, b)}</defs><polygon points="${pts}" fill="url(#${id}${n})"/><polyline points="${pts}" fill="none" stroke="rgba(0,0,0,.09)" stroke-width="1" vector-effect="non-scaling-stroke"/></svg>`;
  return [h('span', { class: 'env-back' }), h('span', { class: 'env-letter' }),
    h('span', { class: 'env-front', svg: svg('f', '--env', '--env2', '0,0 150,112 300,0 300,200 0,200 0,0') }),
    h('span', { class: 'env-flap', svg: svg('p', '--env2', '--env', '0,0 300,0 150,120 0,0') })];
}
let viewerState = null;
function closeViewer() { const v = $('#viewer'); if (viewerState && viewerState.destroy) viewerState.destroy(); viewerState = null; v.hidden = true; v.replaceChildren(); document.documentElement.classList.remove('viewing'); }
function openViewer(inv, opts = {}) {
  const v = $('#viewer'); if (viewerState && viewerState.destroy) viewerState.destroy();
  v.replaceChildren(); v.hidden = false; document.documentElement.classList.add('viewing');
  const L = inv.l, T = (k, vars) => t(k, L, vars);
  const theme = THEMES[inv.th] && (THEMES[inv.th].free || opts.premium || opts.preview) ? inv.th : 'ivoire';
  v.className = 'viewer theme-' + theme; v.setAttribute('dir', L === 'ar' ? 'rtl' : 'ltr'); v.setAttribute('lang', L);
  if (opts.closable) v.append(h('button', { class: 'viewer-close', type: 'button', onclick: closeViewer, 'aria-label': T('v_close') }, '×'));
  const sealHtml = sealFor(Object.assign({}, inv, { th: theme }));
  const sealBtn = h('button', { class: 'env-seal', type: 'button', 'aria-label': T('v_tap') }, h('span', { class: 'half half-l', svg: sealHtml }), h('span', { class: 'half half-r', svg: sealHtml }));
  const stage = h('div', { class: 'env-stage' },
    h('p', { class: 'env-for', text: opts.guest ? T('v_for', { name: opts.guest }) : T('v_invited') }),
    h('div', { class: 'env' }, envelopeParts(), sealBtn),
    h('p', { class: 'env-from', text: T('v_from', { hosts: hostsOf(inv) }) }),
    h('p', { class: 'env-tap', text: T('v_tap') }));
  v.append(stage);
  const rc = renderCard(inv, opts);
  viewerState = rc;
  const sheet = h('div', { class: 'sheet', hidden: true }, rc.el); v.append(sheet);
  let opened = false;
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  sealBtn.addEventListener('click', () => {
    if (opened) return; opened = true;
    if (opts.live) track('inv_unseal');
    stage.classList.add('opening');
    setTimeout(() => { sheet.hidden = false; stage.classList.add('gone'); v.scrollTop = 0; requestAnimationFrame(() => sheet.classList.add('in')); setTimeout(() => stage.remove(), 700); }, reduce ? 50 : 1750);
  });
  if (opts.skipEnvelope) { opened = true; stage.remove(); sheet.hidden = false; sheet.classList.add('in'); }
  setTimeout(() => { try { sealBtn.focus({ preventScroll: true }); } catch (e) {} }, 60);
}
function showError() {
  const v = $('#viewer'); v.replaceChildren(); v.hidden = false; v.className = 'viewer theme-ivoire'; document.documentElement.classList.add('viewing');
  v.append(h('div', { class: 'env-stage err' }, h('div', { class: 'forge-seal', svg: sealSVG('cachet', '#8a1c2b', 'C') }), h('h1', { text: t('v_err_title') }), h('p', { text: t('v_err_sub') }),
    h('a', { class: 'btn btn-accent', href: (CFG.root || '') + (PL === 'fr' ? '' : PL + '/') }, t('v_err_cta'))));
}

/* ───────────── Page invitation ───────────── */
async function initInvitation() {
  const raw = location.hash.slice(1);
  if (!raw) { location.replace((CFG.root || '') + (PL === 'fr' ? '' : PL + '/')); return; }
  try {
    const [blob, g] = raw.split('.');
    const inv = await unpack(blob);
    if (!inv.a) throw new Error('empty');
    let guest = ''; if (g) { try { guest = b64u.decText(g).slice(0, 60); } catch (e) {} }
    const premium = inv.k ? await verifyLicense(inv.k) : false;
    const mine = store.get('cachet_my', []).some((x) => x.id === inv.id);
    const live = !mine;
    openViewer(inv, { guest, premium, live });
    document.title = hostsOf(inv) + ' · ' + t('o_' + inv.o, inv.l);
    if (live) {
      track('inv_open');
      if (inv.id) trackOnce('inv_reach', 'reach_' + inv.id);
      if (!store.get('cachet_seen', null)) store.set('cachet_seen', { p: inv.id, g: inv.g });
    }
  } catch (e) { showError(); track('inv_error'); }
}

/* ───────────── Accueil : composition ───────────── */
function initHome() {
  const form = $('#f'); if (!form) return;
  const q = new URLSearchParams(location.search);
  const el = (n) => form.elements[n];
  let license = store.get('cachet_lic', '') || '';
  let licensed = false;
  let editingId = '';
  const draft = store.get('cachet_draft', null);
  const state = clean(Object.assign({ o: 'wedding', th: 'ivoire', l: PL }, draft || {}));
  if (OCC.includes(q.get('o'))) state.o = q.get('o');
  if (q.get('n')) { state.a = q.get('n').slice(0, 60); }
  if (q.get('p')) { const m = /^([A-Za-z0-9]{1,8})\.(\d{1,2})$/.exec(q.get('p')); if (m && !store.get('cachet_parent', null)) store.set('cachet_parent', { p: m[1], g: +m[2], via: 'click' }); }

  /* thèmes */
  const themeBox = $('#themes');
  function drawThemes() {
    themeBox.replaceChildren(...Object.keys(THEMES).map((id) => {
      const th = THEMES[id];
      return h('button', { type: 'button', class: 'swatch' + (state.th === id ? ' on' : ''), 'aria-pressed': String(state.th === id), style: `--sw-bg:${th.bg};--sw-paper:${th.paper}`, onclick: () => { state.th = id; drawThemes(); changed(); } },
        h('span', { class: 'sw-seal', svg: sealSVG((state.a + ' ' + state.b).trim() || 'cachet', th.seal, initialsOf(state.a, state.b) || 'C') }),
        h('span', { class: 'sw-name', text: th.name[PL] }), th.free ? null : h('span', { class: 'sw-lock' + (licensed ? ' open' : ''), text: t('locked') }));
    }));
  }
  /* programme */
  const progBox = $('#prog');
  function drawProg() {
    progBox.replaceChildren(...state.pr.map((row, i) => h('div', { class: 'prog-row' },
      h('input', { type: 'time', class: 'in', value: row[0], 'aria-label': t('prog_time'), oninput: (e) => { row[0] = e.target.value; changed(true); } }),
      h('input', { type: 'text', class: 'in', value: row[1], maxlength: '60', placeholder: t('prog_label'), 'aria-label': t('prog_label'), oninput: (e) => { row[1] = e.target.value; changed(true); } }),
      h('button', { type: 'button', class: 'x', 'aria-label': t('my_del'), onclick: () => { state.pr.splice(i, 1); drawProg(); changed(); } }, '×'))));
    $('#progAdd').hidden = state.pr.length >= 8;
  }
  $('#progAdd').addEventListener('click', () => { state.pr.push(['', '']); drawProg(); const ins = $$('.prog-row input[type=text]', progBox); ins[ins.length - 1].focus(); });

  function fill() {
    el('o').value = state.o; el('a').value = state.a; el('b').value = state.b; el('h').value = state.h; el('h').placeholder = t('h_' + state.o, state.l);
    el('date').value = state.d.slice(0, 10); el('time').value = state.d.slice(11); el('pl').value = state.pl; el('ad').value = state.ad; el('m').value = state.m; el('dc').value = state.dc;
    el('w').value = state.w ? '+' + state.w : ''; el('l').value = state.l;
    drawThemes(); drawProg();
  }
  function read() {
    state.o = el('o').value; state.a = el('a').value; state.b = el('b').value; state.h = el('h').value;
    state.d = el('date').value ? el('date').value + (el('time').value ? 'T' + el('time').value : '') : '';
    state.pl = el('pl').value; state.ad = el('ad').value; state.m = el('m').value; state.dc = el('dc').value; state.w = el('w').value.replace(/\D/g, ''); state.l = el('l').value;
    el('h').placeholder = t('h_' + state.o, state.l);
  }
  let pvTimer, pvCard, started = false;
  function current() { const inv = clean(state); inv.pr = inv.pr.filter((r) => r[1]); return inv; }
  function drawPreview() {
    const box = $('#pv'); if (!box) return;
    if (pvCard) pvCard.destroy();
    const inv = current(); if (!inv.a) inv.a = t('demo_a', inv.l);
    pvCard = renderCard(inv, { preview: true, premium: false, onCreate: () => {} });
    box.className = 'pv-screen theme-' + inv.th; box.replaceChildren(pvCard.el);
  }
  function changed(skipThemes) {
    read(); store.set('cachet_draft', compact(current()));
    if (!started) { started = true; trackOnce('b_start'); }
    if (!skipThemes) drawThemes();
    clearTimeout(pvTimer); pvTimer = setTimeout(drawPreview, 220);
  }
  form.addEventListener('input', (e) => { if (e.target.closest('#prog')) return; changed(e.target.name !== 'a' && e.target.name !== 'b'); });
  form.addEventListener('submit', (e) => e.preventDefault());

  function validate() {
    read(); const errs = [];
    if (!state.a.trim()) errs.push(['a', t('err_a')]);
    if (!state.d) errs.push(['date', t('err_date')]);
    if (state.w && state.w.length < 9) errs.push(['w', t('err_wa')]);
    $$('.err', form).forEach((x) => x.remove()); $$('[aria-invalid]', form).forEach((x) => x.removeAttribute('aria-invalid'));
    errs.forEach(([n, msg]) => { const f = el(n); f.setAttribute('aria-invalid', 'true'); f.closest('.fld').append(h('p', { class: 'err', role: 'alert', text: msg })); });
    if (errs.length) el(errs[0][0]).focus();
    return !errs.length;
  }
  const withLicense = (inv) => { if (licensed) inv.k = license; else inv.k = ''; return inv; };

  $('#btnPreview').addEventListener('click', () => { const inv = current(); if (!inv.a) inv.a = t('demo_a', inv.l); track('b_preview'); openViewer(inv, { preview: true, premium: false, closable: true, guest: '', onCreate: closeViewer }); });
  $('#btnSeal').addEventListener('click', async () => {
    if (!validate()) return;
    const inv = current();
    if (!THEMES[inv.th].free && !licensed) { openPay(); return; }
    if (inv.pr.length > FREE_STEPS && !licensed) { openPay(); return; }
    inv.id = editingId || newId();
    const parent = store.get('cachet_parent', null) || store.get('cachet_seen', null);
    if (parent && parent.p && parent.p !== inv.id) { inv.p = parent.p; inv.g = Math.min(99, (parent.g | 0) + 1); }
    withLicense(inv);
    const blob = await pack(compact(inv));
    const link = CFG.single ? '' : new URL((CFG.root || '') + (inv.l === 'fr' ? '' : inv.l + '/') + 'i/', location.href).href.split('#')[0] + '#' + blob;
    const my = store.get('cachet_my', []).filter((x) => x.id !== inv.id);
    my.unshift({ id: inv.id, blob, ts: Date.now() }); store.set('cachet_my', my.slice(0, 30));
    if (trackOnce('b_seal', 'seal_' + inv.id)) {
      track('occ_' + inv.o); if (licensed) track('b_seal_paid');
      if (trackOnce('creator')) { // une seule fois par créateur : base du NVC
        track(parent && parent.via === 'click' ? 'b_seal_ref' : parent ? 'b_seal_exp' : 'b_seal_org');
        track('gen_' + Math.min(inv.g, 5));
      }
    }
    editingId = inv.id;
    showResult(inv, blob, link); drawMine();
  });

  /* résultat */
  const res = $('#result');
  function showResult(inv, blob, link) {
    res.hidden = false; $('#btnSeal').textContent = t('btn_update');
    const hosts = hostsOf(inv);
    const linkIn = $('#rLink'); linkIn.value = link || '—';
    $('#rLen').textContent = link ? t('r_len', null, { n: link.length }) : 'Aperçu privé : le lien réel est généré sur le site publié.';
    const share = t('share_text', inv.l, { hosts }) + ' ' + link;
    const setLink = (a, href) => { if (link) a.href = href; else a.removeAttribute('href'); };
    $('#rCopy').onclick = (e) => { copyText(link, e.currentTarget); track('share_copy'); };
    setLink($('#rWa'), 'https://wa.me/?text=' + encodeURIComponent(share)); $('#rWa').onclick = () => track('share_wa');
    setLink($('#rOpen'), link);
    $('#rOpen').onclick = (e) => { if (CFG.single) { e.preventDefault(); openViewer(inv, { preview: true, premium: licensed, closable: true, onCreate: closeViewer }); } };
    const qrBox = $('#qrBox'); qrBox.hidden = true; qrBox.replaceChildren();
    $('#rQr').hidden = !link;
    $('#rQr').onclick = async () => {
      track('share_qr');
      try {
        if (!window.qrcode) await loadScript('https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js');
        const qr = window.qrcode(0, 'L'); qr.addData(link, 'Byte'); qr.make();
        qrBox.replaceChildren(h('div', { class: 'qr', svg: qr.createSvgTag({ cellSize: 4, margin: 4, scalable: true }) }), h('p', { class: 'hint', text: t('qr_hint') }));
        qrBox.hidden = false;
      } catch (e) { qrBox.hidden = true; }
    };
    /* plis nominatifs + suivi */
    const gKey = 'cachet_g_' + inv.id; const ta = $('#gNames'); const list = $('#gList');
    let guests = store.get(gKey, []);
    ta.value = guests.map((g) => g.n).join('\n');
    const cycle = ['wait', 'yes', 'maybe', 'no'];
    function drawGuests() {
      const max = licensed ? 300 : FREE_GUESTS;
      const shown = guests.slice(0, max);
      list.replaceChildren(...shown.map((g) => {
        const gl = link ? link + '.' + b64u.encText(g.n) : '';
        const msg = t('share_named', inv.l, { guest: g.n, hosts }) + ' ' + gl;
        const chip = h('button', { type: 'button', class: 'chip st-' + g.s, onclick: () => { g.s = cycle[(cycle.indexOf(g.s) + 1) % 4]; store.set(gKey, guests); drawGuests(); } }, t('rs_' + g.s));
        return h('li', null, h('span', { class: 'g-name', text: g.n }), chip,
          h('a', { class: 'btn-line', href: gl ? 'https://wa.me/?text=' + encodeURIComponent(msg) : null, target: '_blank', rel: 'noopener', onclick: () => track('share_guest') }, t('g_send')),
          h('button', { type: 'button', class: 'btn-line', onclick: (e) => { copyText(msg, e.currentTarget); track('share_guest'); } }, t('g_copy')));
      }));
      const c = { yes: 0, maybe: 0, no: 0, wait: 0 }; shown.forEach((g) => c[g.s]++);
      $('#gSum').textContent = shown.length ? t('rs_sum', null, { y: c.yes, m: c.maybe, n: c.no, w: c.wait }) : '';
      $('#gHint').hidden = !shown.length;
      const lim = $('#gLimit'); lim.hidden = guests.length <= max; lim.firstChild.textContent = t('g_limit', null, { n: FREE_GUESTS }) + ' ';
    }
    $('#gMake').onclick = () => {
      const names = [...new Set(ta.value.split(/\r?\n/).map((s) => s.trim().slice(0, 60)).filter(Boolean))].slice(0, 300);
      const old = Object.fromEntries(guests.map((g) => [g.n, g.s]));
      guests = names.map((n) => ({ n, s: old[n] || 'wait' })); store.set(gKey, guests); drawGuests(); if (names.length) track('guests_made');
    };
    drawGuests();
    res.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* mes invitations */
  async function drawMine() {
    const sec = $('#mine'), ul = $('#mineList'); const my = store.get('cachet_my', []);
    sec.hidden = !my.length; const items = [];
    for (const m of my) {
      try {
        const inv = await unpack(m.blob); const f = fmtDate(Object.assign({}, inv, { l: PL }));
        items.push(h('li', null, h('span', { class: 'm-seal', svg: sealFor(inv) }), h('span', { class: 'm-txt' }, h('strong', { text: hostsOf(inv, PL) }), h('small', { text: t('o_' + inv.o) + (f.day ? ' · ' + f.day : '') })),
          h('button', { type: 'button', class: 'btn-line', onclick: () => { Object.assign(state, inv, { k: '' }); editingId = inv.id; fill(); changed(); $('#creer').scrollIntoView({ behavior: 'smooth' }); } }, t('my_open')),
          h('button', { type: 'button', class: 'x', 'aria-label': t('my_del'), onclick: () => { store.set('cachet_my', store.get('cachet_my', []).filter((x) => x.id !== m.id)); drawMine(); } }, '×')));
      } catch (e) {}
    }
    ul.replaceChildren(...items);
  }

  /* Signature : paiement + code */
  const modal = $('#pay');
  function openPay() { modal.hidden = false; document.documentElement.classList.add('modal-open'); track('pay_open'); setTimeout(() => $('#licIn').focus(), 50); }
  function closePay() { modal.hidden = true; document.documentElement.classList.remove('modal-open'); }
  $$('[data-pay]').forEach((b) => b.addEventListener('click', openPay));
  $$('[data-close]', modal).forEach((b) => b.addEventListener('click', closePay));
  modal.addEventListener('click', (e) => { if (e.target === modal) closePay(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { if (!modal.hidden) closePay(); else if (!$('#viewer').hidden && $('.viewer-close')) closeViewer(); } });
  const payBox = $('#payLinks'); const links = [];
  const order = 'Cachet Signature';
  if (CFG.payUrl) links.push(h('a', { class: 'btn btn-accent', href: CFG.payUrl, target: '_blank', rel: 'noopener', onclick: () => track('pay_click') }, t('pay_go') + ' · ' + (CFG.priceS || '')));
  if (CFG.contactWa) links.push(h('a', { class: 'btn btn-ghost', href: 'https://wa.me/' + String(CFG.contactWa).replace(/\D/g, '') + '?text=' + encodeURIComponent(order), target: '_blank', rel: 'noopener', onclick: () => track('pay_click') }, t('pay_wa')));
  if (CFG.contactEmail) links.push(h('a', { class: 'btn btn-ghost', href: 'mailto:' + CFG.contactEmail + '?subject=' + encodeURIComponent(order), onclick: () => track('pay_click') }, t('pay_mail') + ' — ' + CFG.contactEmail));
  if (!links.length) links.push(h('p', { class: 'soon', text: t('pay_soon') }));
  payBox.replaceChildren(...links);
  async function applyLicense(code, quiet) {
    const ok = await verifyLicense(code);
    licensed = ok; if (ok) { license = code.trim(); store.set('cachet_lic', license); }
    $$('.lic-state').forEach((n) => { n.hidden = !ok; });
    if (!quiet) { const m = $('#licMsg'); m.hidden = false; m.textContent = ok ? t('lic_ok') : t('lic_bad'); m.className = 'lic-msg ' + (ok ? 'ok' : 'bad'); if (ok) trackOnce('lic_ok'); }
    drawThemes(); return ok;
  }
  $('#licForm').addEventListener('submit', async (e) => { e.preventDefault(); const ok = await applyLicense($('#licIn').value); if (ok) setTimeout(closePay, 1100); });

  /* démonstration */
  const demo = () => {
    const d = new Date(Date.now() + 38 * 86400e3); const z = (n) => String(n).padStart(2, '0');
    return clean({ o: 'wedding', a: t('demo_a'), b: t('demo_b'), d: d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()) + 'T19:00', pl: t('demo_place'), ad: t('demo_addr'), m: t('demo_msg'), th: 'ivoire', l: PL, w: '', pr: [['19:00', PL === 'ar' ? 'استقبال الضيوف' : PL === 'en' ? 'Welcome' : 'Accueil des invités'], ['20:30', PL === 'ar' ? 'العشاء' : PL === 'en' ? 'Dinner' : 'Dîner']] });
  };
  const heroEnv = $('#heroEnv'); if (heroEnv) heroEnv.replaceChildren(...envelopeParts(), h('span', { class: 'env-seal', svg: sealFor(demo()) }));
  $$('[data-demo]').forEach((b) => b.addEventListener('click', () => { track('demo_open'); openViewer(demo(), { preview: true, closable: true, guest: t('demo_guest'), onCreate: (name) => { closeViewer(); if (name) { state.a = name; fill(); changed(); } $('#creer').scrollIntoView({ behavior: 'smooth' }); } }); }));
  const logo = $('#logoSeal'); if (logo) logo.innerHTML = sealSVG('cachet', '#8a1c2b', 'C');

  fill(); drawPreview(); drawMine();
  if (license) applyLicense(license, true);
  if (q.get('n') || q.get('o')) store.set('cachet_draft', compact(current()));
}

/* ───────────── Démarrage ───────────── */
window.CachetCore = { pack, unpack, clean, compact, sealSVG, verifyLicense, b64u, openViewer };
function boot() {
  recordVisit();
  if (CFG.page === 'inv') { initInvitation(); window.addEventListener('hashchange', () => location.reload()); }
  else if (CFG.page === 'home') initHome();
  else { const logo = $('#logoSeal'); if (logo) logo.innerHTML = sealSVG('cachet', '#8a1c2b', 'C'); }
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
