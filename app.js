'use strict';
/* Ereunate – Statenvertaling met grondtekst. Geen frameworks, werkt offline. */

/* ---------- Opslag ---------- */
const store = {
  get(k, d) { try { const v = localStorage.getItem('ereunate:' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('ereunate:' + k, JSON.stringify(v)); } catch { /* geen opslag beschikbaar */ } }
};
const settings = Object.assign(
  { sv: true, orig: true, layout: 'stack', size: 18, showOrigInSearch: true, wholeWords: true, exact: false, scope: 'all' },
  store.get('settings', {})
);
const saveSettings = () => store.set('settings', settings);
let pos = store.get('pos', { b: 42, c: 1 });   // standaard: Johannes 1
let recent = store.get('recent', []);
const browse = { t: null, b: null };

/* ---------- Data ---------- */
let BOOKS = null, MAP = null, SV = null;
const ORIG = { grc: null, heb: null };
const pending = {};
function loadJSON(name) {
  if (!pending[name]) {
    pending[name] = fetch('data/' + name + '.json').then(r => {
      if (!r.ok) throw new Error('Kon ' + name + ' niet laden');
      return r.json();
    }).catch(e => { delete pending[name]; throw e; });
  }
  return pending[name];
}
async function ensureOrig(kind) { if (!ORIG[kind]) ORIG[kind] = await loadJSON(kind); return ORIG[kind]; }
const origKind = bi => (BOOKS[bi].ot ? 'heb' : 'grc');

/* ---------- Hulpjes ---------- */
const $ = (s, el = document) => el.querySelector(s);
const view = $('#view');
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ICON = {
  down: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>',
  left: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>',
  right: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>',
  search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  go: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg>'
};
const bookById = id => BOOKS.findIndex(b => b.id.toLowerCase() === String(id || '').toLowerCase());
const readHref = (bi, c, v) => '#/lezen/' + BOOKS[bi].id + '/' + c + (v ? '/' + v : '');
const refLabel = (bi, c, v) => BOOKS[bi].name + ' ' + c + (v ? ':' + v : '');
function applySize() { document.documentElement.style.setProperty('--size', settings.size + 'px'); }

/* ---------- Tekstplaatsen herkennen ("joh 3:16", "1 kor 13", "ps 23") ---------- */
const fold = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const EXTRA_ALIASES = {
  Gen: ['gn'], Exod: ['exo', 'exod'], Deut: ['dt'], Josh: ['jozua'], Judg: ['ri', 'richteren', 're'],
  Ps: ['psalm', 'psalmen', 'psa'], Prov: ['spreuken'], Eccl: ['prediker', 'pr'], Song: ['hl', 'hooglied'],
  Isa: ['jesaja'], Lam: ['kl'], Ezek: ['eze', 'ezech'], Matt: ['mt', 'mat'], Mark: ['mk', 'mar', 'mr'],
  Luke: ['lk', 'lu'], John: ['jh', 'jn'], Acts: ['hnd', 'hd'], Phlm: ['flm', 'filemon'], Heb: ['heb'],
  '1Pet': ['1pe', '1pet'], '2Pet': ['2pe', '2pet'], Rev: ['op', 'opb', 'apk'], Esth: ['ester'], Joel: ['joel']
};
let aliasList = null;
function buildAliases() {
  aliasList = [];
  BOOKS.forEach((b, i) => {
    const keys = new Set([fold(b.name), fold(b.abbr), fold(b.id)].map(k => k.replace(/[\s.]/g, '')));
    (EXTRA_ALIASES[b.id] || []).forEach(k => keys.add(k));
    keys.forEach(k => aliasList.push({ k, i }));
  });
}
function findBook(raw) {
  const key = fold(raw).replace(/[\s.]/g, '');
  if (!key) return -1;
  const exact = aliasList.find(a => a.k === key);
  if (exact) return exact.i;
  const pre = aliasList.find(a => a.k.startsWith(key) && key.length >= 2);
  return pre ? pre.i : -1;
}
function parseRef(q) {
  const m = String(q).trim().match(/^([1-3]?\s*\.?\s*[^\d\s:.,][^\d:,]*?)\.?\s*(\d{1,3})(?:\s*[:.,]\s*(\d{1,3}))?\s*$/u);
  if (!m) return null;
  const bi = findBook(m[1]);
  if (bi < 0) return null;
  const c = +m[2], v = m[3] ? +m[3] : null;
  if (c < 1 || c > BOOKS[bi].v.length) return null;
  if (v && (v < 1 || v > BOOKS[bi].v[c - 1])) return null;
  return { b: bi, c, v };
}

/* ---------- Router ---------- */
function parseHash() {
  const h = location.hash.replace(/^#\/?/, '');
  const [path, qs] = h.split('?');
  const parts = path.split('/').filter(Boolean).map(decodeURIComponent);
  return { view: parts[0] || 'lezen', parts, params: new URLSearchParams(qs || '') };
}
function setTab(name) {
  document.querySelectorAll('.tabbar a').forEach(a => {
    if (a.dataset.tab === name) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  const read = document.querySelector('.tabbar a[data-tab="lezen"]');
  read.href = readHref(pos.b, pos.c);
}
function route() {
  const r = parseHash();
  if (r.view === 'bladeren') renderBrowse();
  else if (r.view === 'zoeken') renderSearch(r);
  else renderRead(r);
  setTab(r.view === 'bladeren' || r.view === 'zoeken' ? r.view : 'lezen');
}

/* =====================================================================
   LEZEN
   ===================================================================== */
function addRecent(b, c) {
  recent = [{ b, c }, ...recent.filter(x => !(x.b === b && x.c === c))].slice(0, 6);
  store.set('recent', recent);
}
function origFor(bi, c, v) {
  const data = ORIG[origKind(bi)];
  if (!data || !data[bi]) return null;
  const own = c + ':' + v;
  const refs = (MAP[bi] && MAP[bi][own]) || [own];
  const parts = [];
  refs.forEach(r => {
    const [oc, ov] = r.split(':').map(Number);
    const t = data[bi][oc - 1] && data[bi][oc - 1][ov - 1];
    if (t) parts.push(t);
  });
  if (!parts.length) return null;
  return { text: parts.join(' '), label: refs.length > 1 || refs[0] !== own ? refs.join(', ') : null };
}

function renderRead(r) {
  let bi = r.parts[1] != null ? bookById(r.parts[1]) : pos.b;
  if (bi < 0) bi = findBook(r.parts[1]);          // ook #/lezen/jes/53 of #/lezen/Johannes/3
  const known = bi >= 0;
  if (!known) bi = pos.b;
  const nch = BOOKS[bi].v.length;
  let c = (known && parseInt(r.parts[2], 10)) || (bi === pos.b ? pos.c : 1);
  c = Math.min(Math.max(c, 1), nch);
  const target = parseInt(r.parts[3], 10) || null;
  const sameChapter = view.dataset.view === 'lezen' && pos.b === bi && pos.c === c;
  pos = { b: bi, c }; store.set('pos', pos); addRecent(bi, c);

  const book = BOOKS[bi];
  const kindName = book.ot ? 'Hebreeuws' : 'Grieks';
  const prev = c > 1 ? { b: bi, c: c - 1 } : bi > 0 ? { b: bi - 1, c: BOOKS[bi - 1].v.length } : null;
  const next = c < nch ? { b: bi, c: c + 1 } : bi < BOOKS.length - 1 ? { b: bi + 1, c: 1 } : null;

  if (!sameChapter) {
    view.dataset.view = 'lezen';
    view.innerHTML = `
      <header class="top">
        <div class="bar">
          <a class="title-btn" href="#/bladeren" aria-label="${esc(book.name)} ${c}, kies boek of hoofdstuk"><span>${esc(book.name)} ${c}</span>${ICON.down}</a>
          <a class="icon-btn" ${prev ? `href="${readHref(prev.b, prev.c)}"` : 'aria-disabled="true"'} aria-label="Vorig hoofdstuk">${ICON.left}</a>
          <a class="icon-btn" ${next ? `href="${readHref(next.b, next.c)}"` : 'aria-disabled="true"'} aria-label="Volgend hoofdstuk">${ICON.right}</a>
        </div>
        <div class="hdr-body" style="padding-top:2px">
          <div class="chips" role="group" aria-label="Teksten tonen">
            <button class="chip" id="t-sv">SV</button>
            <button class="chip" id="t-orig">${kindName}</button>
          </div>
          <div class="toolrow" style="padding:0">
            <div class="seg" role="group" aria-label="Indeling">
              <button id="l-stack">Onder elkaar</button>
              <button id="l-cols">Naast elkaar</button>
            </div>
            <button class="size-btn sm" id="s-down" aria-label="Kleinere tekst">A</button>
            <button class="size-btn lg" id="s-up" aria-label="Grotere tekst">A</button>
          </div>
        </div>
      </header>
      <main class="scroll" id="reader-scroll"><div class="reader" id="reader"></div></main>`;
    $('#t-sv').onclick = () => { settings.sv = !settings.sv; saveSettings(); fillReader(bi, c, null, prev, next); };
    $('#t-orig').onclick = () => { settings.orig = !settings.orig; saveSettings(); fillReader(bi, c, null, prev, next); };
    $('#l-stack').onclick = () => { settings.layout = 'stack'; saveSettings(); fillReader(bi, c, null, prev, next); };
    $('#l-cols').onclick = () => { settings.layout = 'cols'; saveSettings(); fillReader(bi, c, null, prev, next); };
    $('#s-down').onclick = () => { settings.size = Math.max(14, settings.size - 1); saveSettings(); applySize(); };
    $('#s-up').onclick = () => { settings.size = Math.min(28, settings.size + 1); saveSettings(); applySize(); };
    addSwipe($('#reader-scroll'), prev, next);
  }
  fillReader(bi, c, target, prev, next, !sameChapter);
}

function syncReaderControls() {
  const both = settings.sv && settings.orig;
  const cols = both && settings.layout === 'cols';
  const set = (id, on) => { const el = $('#' + id); if (el) el.setAttribute('aria-pressed', on ? 'true' : 'false'); };
  set('t-sv', settings.sv); set('t-orig', settings.orig);
  set('l-stack', !cols); set('l-cols', cols);
  $('#l-cols').disabled = !both;
  ['t-sv', 't-orig'].forEach(id => {
    const el = $('#' + id); const on = el.getAttribute('aria-pressed') === 'true';
    el.innerHTML = (on ? ICON.check : '') + el.textContent.trim();
  });
}

async function fillReader(bi, c, target, prev, next, resetScroll) {
  syncReaderControls();
  const box = $('#reader');
  const book = BOOKS[bi];
  const kind = origKind(bi);
  if (settings.orig && !ORIG[kind]) {
    if (!settings.sv) box.innerHTML = '<p class="loading">Grondtekst laden…</p>';
    else draw(true);
    try { await ensureOrig(kind); } catch { /* toon wat er is */ }
    if (pos.b !== bi || pos.c !== c) return;
  }
  draw(false);

  function draw(origPending) {
    const both = settings.sv && settings.orig;
    const cols = both && settings.layout === 'cols';
    const lang = book.ot ? 'he' : 'grc';
    const dir = book.ot ? ' dir="rtl"' : '';
    const tagPrefix = book.ot ? 'Hebr. ' : 'Gr. ';
    const verses = SV[bi][c - 1];
    let html = '';
    if (!settings.sv && !settings.orig) {
      html = '<p class="empty">Zet hierboven minstens één tekst aan om te lezen.</p>';
    } else {
      verses.forEach((t, i) => {
        const v = i + 1;
        let body = '';
        if (settings.sv) body += `<p class="t-sv" lang="nl">${esc(t)}</p>`;
        if (settings.orig && !origPending) {
          const o = origFor(bi, c, v);
          if (o) {
            const tag = o.label ? `<span class="ref-tag">${esc(tagPrefix + o.label)}</span>` : '';
            body += `<p class="t-orig${settings.sv ? '' : ' solo'}" lang="${lang}"${dir}>${tag}${esc(o.text)}</p>`;
          } else if (cols) body += '<p class="t-orig"></p>';
        }
        html += `<div class="verse${v === target ? ' target' : ''}" id="v${v}"><span class="vnum">${v}</span><div class="vbody${cols ? ' cols' : ''}">${body}</div></div>`;
      });
    }
    html += '<nav class="chap-nav" aria-label="Hoofdstukken">' +
      (prev ? `<a href="${readHref(prev.b, prev.c)}">${ICON.left}${esc(BOOKS[prev.b].abbr)} ${prev.c}</a>` : '') +
      (next ? `<a class="next" href="${readHref(next.b, next.c)}">${esc(BOOKS[next.b].abbr)} ${next.c}${ICON.right}</a>` : '') +
      '</nav>';
    html += `<p class="source">SV: Statenvertaling, editie 1888 (publiek domein) · ${book.ot
      ? 'Hebreeuws: Westminster Leningrad Codex (publiek domein), via Open Scriptures Hebrew Bible'
      : 'Grieks: Textus Receptus, Scrivener 1894 (publiek domein)'}</p>`;
    box.innerHTML = html;
    if (target) {
      const el = $('#v' + target);
      if (el) el.scrollIntoView({ block: 'center' });
    } else if (resetScroll) {
      $('#reader-scroll').scrollTop = 0;
      resetScroll = false;
    }
  }
}

function addSwipe(el, prev, next) {
  let x0 = null, y0 = null;
  el.addEventListener('touchstart', e => { if (e.touches.length === 1) { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; } }, { passive: true });
  el.addEventListener('touchend', e => {
    if (x0 == null) return;
    const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
    x0 = null;
    if (Math.abs(dx) > 90 && Math.abs(dy) < 50) {
      const t = dx < 0 ? next : prev;
      if (t) location.hash = readHref(t.b, t.c);
    }
  }, { passive: true });
}

/* =====================================================================
   BLADEREN
   ===================================================================== */
function renderBrowse() {
  view.dataset.view = 'bladeren';
  browse.b = pos.b; browse.t = BOOKS[pos.b].ot ? 'OT' : 'NT';
  const rec = recent.map((x, i) =>
    `<a class="chip small${i === 0 ? ' soft' : ''}" href="${readHref(x.b, x.c)}">${esc(BOOKS[x.b].abbr)} ${x.c}</a>`).join('');
  view.innerHTML = `
    <header class="top">
      <h1 class="page-title">Bladeren</h1>
      <div class="hdr-body">
        <form class="field" id="goto" role="search">
          ${ICON.go}
          <label for="goto-in" class="sr-only">Ga naar tekstplaats</label>
          <input id="goto-in" type="text" inputmode="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Ga naar… bijv. joh 3:16 of ps 23" enterkeyhint="go">
        </form>
        <p class="hint" id="goto-hint" hidden></p>
        ${rec ? `<div class="chips"><span class="label">Recent</span>${rec}</div>` : ''}
        <div class="seg" role="group" aria-label="Testament">
          <button id="t-ot">Oude Testament</button>
          <button id="t-nt">Nieuwe Testament</button>
        </div>
      </div>
    </header>
    <main class="scroll"><div class="browse" id="browse"></div></main>`;
  $('#goto').addEventListener('submit', e => {
    e.preventDefault();
    const ref = parseRef($('#goto-in').value);
    const hint = $('#goto-hint');
    if (ref) { location.hash = readHref(ref.b, ref.c, ref.v); return; }
    hint.hidden = false; hint.className = 'hint err';
    hint.textContent = 'Niet herkend. Probeer bijvoorbeeld "joh 3:16", "1 kor 13" of "ps 23".';
  });
  $('#goto-in').addEventListener('input', e => {
    const ref = parseRef(e.target.value); const hint = $('#goto-hint');
    if (ref) { hint.hidden = false; hint.className = 'hint'; hint.textContent = 'Enter: ' + refLabel(ref.b, ref.c, ref.v); }
    else hint.hidden = true;
  });
  $('#t-ot').onclick = () => { if (browse.t !== 'OT') { browse.t = 'OT'; browse.b = 0; fillBrowse(); } };
  $('#t-nt').onclick = () => { if (browse.t !== 'NT') { browse.t = 'NT'; browse.b = 39; fillBrowse(); } };
  fillBrowse();
}
function fillBrowse() {
  $('#t-ot').setAttribute('aria-pressed', browse.t === 'OT' ? 'true' : 'false');
  $('#t-nt').setAttribute('aria-pressed', browse.t === 'NT' ? 'true' : 'false');
  const from = browse.t === 'OT' ? 0 : 39, to = browse.t === 'OT' ? 39 : 66;
  const book = BOOKS[browse.b];
  let html = '<div class="grid4" role="group" aria-label="Boeken">';
  for (let i = from; i < to; i++) {
    html += `<button class="cell" data-b="${i}" aria-label="${esc(BOOKS[i].name)}" aria-pressed="${i === browse.b}">${esc(BOOKS[i].abbr)}</button>`;
  }
  html += '</div>';
  const n = book.v.length;
  html += `<section aria-label="Hoofdstukken"><div class="chap-head"><h2>${esc(book.name)}</h2><span>${n} ${n === 1 ? 'hoofdstuk' : 'hoofdstukken'}</span></div>
    <div class="grid6" id="chapters" style="margin-top:10px">`;
  for (let c = 1; c <= n; c++) {
    const cur = browse.b === pos.b && c === pos.c;
    html += `<a class="cell" href="${readHref(browse.b, c)}" aria-label="${esc(book.name)} ${c}"${cur ? ' aria-current="page"' : ''}>${c}</a>`;
  }
  html += '</div></section>';
  const box = $('#browse');
  box.innerHTML = html;
  box.querySelectorAll('button.cell').forEach(btn => btn.onclick = () => {
    browse.b = +btn.dataset.b; fillBrowse();
    const ch = $('#chapters'); if (ch) ch.parentElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

/* =====================================================================
   ZOEKEN
   ===================================================================== */
const HEB_POINTS = /[֑-ׇֽֿׁׂׅׄ]/g;
function normalize(text, kind) {
  let s = text.normalize('NFD');
  if (kind === 'heb') s = s.replace(HEB_POINTS, '').replace(/־/g, ' ');
  s = s.replace(/[̀-ͯ]/g, '').toLowerCase();
  if (kind === 'grc') s = s.replace(/ς/g, 'σ');
  return s.replace(/[-‐-—]/g, ' ').replace(/[^\p{L}\p{N}\s]/gu, '');
}
function normWithMap(text, kind) {
  let s = ''; const map = [];
  for (let i = 0; i < text.length; i++) {
    const n = normalize(text[i], kind);
    for (const ch of n) { s += ch; map.push(i); }
  }
  return { s, map };
}
const INDEX = {};
function getIndex(kind) {
  if (INDEX[kind]) return INDEX[kind];
  const src = kind === 'sv' ? SV : ORIG[kind];
  const rows = [];
  src.forEach((book, bi) => {
    if (!book) return;
    book.forEach((ch, ci) => ch.forEach((t, vi) => rows.push({ b: bi, c: ci + 1, v: vi + 1, s: normalize(t, kind) })));
  });
  INDEX[kind] = rows;
  return rows;
}
const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function makeMatcher(q, kind) {
  const nq = normalize(q, kind).replace(/\s+/g, ' ').trim();
  if (nq.length < 2) return null;
  const terms = settings.exact ? [nq] : [...new Set(nq.split(' '))];
  const whole = settings.wholeWords && kind !== 'heb';   // Hebreeuws plakt voorvoegsels aan woorden
  const wrap = e => whole ? '(?<![\\p{L}\\p{N}])' + e + '(?![\\p{L}\\p{N}])' : e;
  const pat = t => wrap(t.split(' ').map(reEsc).join('\\s+'));
  const tests = terms.map(t => new RegExp(pat(t), 'u'));
  const all = new RegExp(terms.map(pat).join('|'), 'gu');
  return { tests, all };
}
function highlight(text, kind, matcher) {
  const { s, map } = normWithMap(text, kind);
  const ranges = [];
  matcher.all.lastIndex = 0;
  let m;
  while ((m = matcher.all.exec(s))) {
    if (!m[0].length) { matcher.all.lastIndex++; continue; }
    ranges.push([map[m.index], map[m.index + m[0].length - 1] + 1]);
  }
  if (!ranges.length) return esc(text);
  let out = '', at = 0;
  ranges.forEach(([a, b]) => {
    if (a < at) a = at;
    if (b <= a) return;
    // combinerende tekens direct na een treffer horen erbij
    while (b < text.length && /[̀-֑ͯ-ׇֽֿׁׂׅׄ]/.test(text[b])) b++;
    out += esc(text.slice(at, a)) + '<mark>' + esc(text.slice(a, b)) + '</mark>';
    at = b;
  });
  return out + esc(text.slice(at));
}
const scriptOf = q => /[֐-׿]/.test(q) ? 'heb' : /[Ͱ-Ͽἀ-῿]/.test(q) ? 'grc' : 'sv';
function inScope(bi) {
  const s = settings.scope;
  if (s === 'all') return true;
  if (s === 'ot') return bi < 39;
  if (s === 'nt') return bi >= 39;
  if (s === 'gosp') return bi >= 39 && bi <= 42;
  if (s === 'epis') return bi >= 44 && bi <= 64;
  return String(bi) === s;
}

let searchState = { q: '', hits: [], shown: 0, kind: 'sv', matcher: null };
function renderSearch(r) {
  view.dataset.view = 'zoeken';
  const q = r.params.has('q') ? r.params.get('q') : store.get('lastQuery', '');
  const opts = [['all', 'Hele Bijbel'], ['ot', 'Oude Testament'], ['nt', 'Nieuwe Testament'], ['gosp', 'Evangeliën'], ['epis', 'Brieven']];
  let sel = opts.map(([v, l]) => `<option value="${v}">${l}</option>`).join('');
  sel += '<optgroup label="Oude Testament">' + BOOKS.slice(0, 39).map((b, i) => `<option value="${i}">${esc(b.name)}</option>`).join('') + '</optgroup>';
  sel += '<optgroup label="Nieuwe Testament">' + BOOKS.slice(39).map((b, i) => `<option value="${i + 39}">${esc(b.name)}</option>`).join('') + '</optgroup>';
  view.innerHTML = `
    <header class="top">
      <h1 class="page-title">Zoeken</h1>
      <div class="hdr-body">
        <form class="field" id="sform" role="search">
          ${ICON.search}
          <label for="q" class="sr-only">Zoek op woord, zin of tekstplaats</label>
          <input id="q" type="search" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search" placeholder="Woord, zin, Grieks of Hebreeuws" value="${esc(q)}">
          <button type="button" class="icon-btn" id="qclear" aria-label="Zoekterm wissen">${ICON.x}</button>
        </form>
        <div class="chips" role="group" aria-label="Zoekopties">
          <span class="chip-select"><span id="scope-label" aria-hidden="true"></span>${ICON.down}<label for="scope" class="sr-only">Zoeken in</label><select id="scope">${sel}</select></span>
          <button class="chip small" id="o-whole">Hele woorden</button>
          <button class="chip small" id="o-exact">Exacte zin</button>
          <button class="chip small" id="o-orig">Grondtekst tonen</button>
        </div>
      </div>
    </header>
    <main class="scroll search-page" id="sscroll"><div class="results" id="results"></div></main>`;
  $('#scope').value = settings.scope;
  if ($('#scope').value !== settings.scope) { settings.scope = 'all'; $('#scope').value = 'all'; }
  const scopeLabel = () => { const s = $('#scope'); $('#scope-label').textContent = s.options[s.selectedIndex].text; };
  scopeLabel();
  const input = $('#q');
  let timer = null;
  const go = () => runSearch(input.value);
  input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(go, 250); });
  $('#sform').addEventListener('submit', e => { e.preventDefault(); clearTimeout(timer); input.blur(); go(); });
  $('#qclear').onclick = () => { input.value = ''; go(); input.focus(); };
  $('#scope').onchange = e => { settings.scope = e.target.value; saveSettings(); scopeLabel(); go(); };
  const toggle = (id, key) => { $('#' + id).onclick = () => { settings[key] = !settings[key]; saveSettings(); syncSearchChips(); go(); }; };
  toggle('o-whole', 'wholeWords'); toggle('o-exact', 'exact'); toggle('o-orig', 'showOrigInSearch');
  syncSearchChips();
  runSearch(q);
  if (!q) setTimeout(() => input.focus(), 50);
}
function syncSearchChips() {
  [['o-whole', 'wholeWords'], ['o-exact', 'exact'], ['o-orig', 'showOrigInSearch']].forEach(([id, key]) => {
    const el = $('#' + id); if (!el) return;
    const label = el.textContent.trim();
    el.setAttribute('aria-pressed', settings[key] ? 'true' : 'false');
    el.innerHTML = (settings[key] ? ICON.check : '') + label;
  });
}

async function runSearch(q) {
  q = q.trim();
  store.set('lastQuery', q);
  history.replaceState(null, '', '#/zoeken' + (q ? '?q=' + encodeURIComponent(q) : ''));
  const box = $('#results');
  if (!box) return;
  const ref = parseRef(q);
  const gotoCard = ref ? `<a class="card goto" href="${readHref(ref.b, ref.c, ref.v)}">Ga naar ${esc(refLabel(ref.b, ref.c, ref.v))}${ICON.right}</a>` : '';
  const kind = scriptOf(q);
  if (kind !== 'sv' && !ORIG[kind]) {
    box.innerHTML = gotoCard + '<p class="loading">Grondtekst laden…</p>';
    try { await ensureOrig(kind); } catch { /* hieronder afgevangen */ }
    if ($('#q') && $('#q').value.trim() !== q) return;   // er is intussen verder getypt
  }
  if (settings.showOrigInSearch && q && (!ORIG.grc || !ORIG.heb)) {
    // SV-resultaten meteen tonen, grondtekst erbij zodra die geladen is
    Promise.all([ensureOrig('grc'), ensureOrig('heb')]).then(() => {
      if ($('#q') && $('#q').value.trim() === q && searchState.q === q) runSearch(q);
    }).catch(() => {});
  }
  const matcher = makeMatcher(q, kind);
  if (!matcher) {
    box.innerHTML = gotoCard || `<p class="empty">Zoek op een woord of zin in de Statenvertaling, of typ Grieks of Hebreeuws om in de grondtekst te zoeken.<br><br>Een tekstplaats als <b>joh 3:16</b> werkt ook.</p>`;
    return;
  }
  if (kind !== 'sv' && !ORIG[kind]) { box.innerHTML = gotoCard + '<p class="empty">De grondtekst kon niet worden geladen.</p>'; return; }
  const hits = [];
  for (const row of getIndex(kind)) {
    if (!inScope(row.b)) continue;
    if (matcher.tests.every(t => t.test(row.s))) hits.push(row);
  }
  searchState = { q, hits, shown: 0, kind, matcher };
  box.innerHTML = gotoCard + `<p class="meta">${hits.length === 0 ? 'Geen treffers' : hits.length === 1 ? '1 vers' : hits.length.toLocaleString('nl-NL') + ' verzen'}${kind !== 'sv' ? ' in de ' + (kind === 'grc' ? 'Griekse' : 'Hebreeuwse') + ' tekst' : ''}</p>`;
  $('#sscroll').scrollTop = 0;
  showMore();
}
function showMore() {
  const box = $('#results');
  const { hits, kind, matcher } = searchState;
  const old = $('#more'); if (old) old.remove();
  const start = searchState.shown, end = Math.min(hits.length, start + 100);
  let html = '';
  let lastGroup = start > 0 ? (hits[start - 1].b < 39 ? 'ot' : 'nt') : null;
  for (let i = start; i < end; i++) {
    const h = hits[i];
    const g = h.b < 39 ? 'ot' : 'nt';
    if (g !== lastGroup) { html += `<h2 class="group-h">${g === 'ot' ? 'Oude Testament' : 'Nieuwe Testament'}</h2>`; lastGroup = g; }
    const svText = kind === 'sv' ? SV[h.b][h.c - 1][h.v - 1] : null;
    let lines = '';
    if (kind === 'sv') {
      lines += `<span class="txt" lang="nl">${highlight(svText, 'sv', matcher)}</span>`;
      if (settings.showOrigInSearch) {
        const o = origFor(h.b, h.c, h.v);
        if (o) lines += `<span class="orig" lang="${h.b < 39 ? 'he' : 'grc'}"${h.b < 39 ? ' dir="rtl"' : ''}>${esc(o.text)}</span>`;
      }
      html += `<a class="card" href="${readHref(h.b, h.c, h.v)}"><span class="ref">${esc(refLabel(h.b, h.c, h.v))}</span>${lines}</a>`;
    } else {
      // treffer in de grondtekst (eigen nummering): toon ook de bijbehorende SV
      const otext = ORIG[kind][h.b][h.c - 1][h.v - 1];
      const svRef = svRefFor(h.b, h.c, h.v);
      lines += `<span class="orig" lang="${kind === 'heb' ? 'he' : 'grc'}"${kind === 'heb' ? ' dir="rtl"' : ''}>${highlight(otext, kind, matcher)}</span>`;
      if (svRef) lines += `<span class="txt" lang="nl">${esc(SV[h.b][svRef.c - 1][svRef.v - 1])}</span>`;
      const tgt = svRef || { c: h.c, v: h.v };
      const own = svRef && (svRef.c !== h.c || svRef.v !== h.v) ? ` <span class="ref-tag">${kind === 'heb' ? 'Hebr.' : 'Gr.'} ${h.c}:${h.v}</span>` : '';
      html += `<a class="card" href="${readHref(h.b, tgt.c, tgt.v)}"><span class="ref">${esc(refLabel(h.b, tgt.c, tgt.v))}${own}</span>${lines}</a>`;
    }
  }
  searchState.shown = end;
  box.insertAdjacentHTML('beforeend', html);
  if (end < hits.length) {
    box.insertAdjacentHTML('beforeend', `<button class="more" id="more">Meer tonen (${(hits.length - end).toLocaleString('nl-NL')} over)</button>`);
    $('#more').onclick = showMore;
  }
}
// grondtekst-vers -> eerste SV-vers dat ernaar verwijst
let reverseMap = null;
function svRefFor(bi, c, v) {
  if (!reverseMap) {
    reverseMap = {};
    Object.entries(MAP).forEach(([b, m]) => Object.entries(m).forEach(([sv, refs]) => refs.forEach(r => {
      const k = b + '|' + r;
      if (!reverseMap[k]) reverseMap[k] = sv;
    })));
  }
  const hit = reverseMap[bi + '|' + c + ':' + v];
  if (hit) { const [sc, sv] = hit.split(':').map(Number); return { c: sc, v: sv }; }
  const own = MAP[bi] && MAP[bi][c + ':' + v];
  if (own) return null;   // dit nummer is in de SV een ander vers; geen directe tegenhanger
  const ch = SV[bi][c - 1];
  return ch && ch[v - 1] != null ? { c, v } : null;
}

/* =====================================================================
   Start en service worker
   ===================================================================== */
function toast(msg, actionLabel, action) {
  const t = $('#toast');
  t.innerHTML = `<span>${esc(msg)}</span>` + (actionLabel ? `<button type="button">${esc(actionLabel)}</button>` : '');
  t.hidden = false;
  if (actionLabel) t.querySelector('button').onclick = () => { t.hidden = true; action(); };
  else setTimeout(() => { t.hidden = true; }, 3500);
}
function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('sw.js').then(reg => {
    const offer = w => toast('Er is een nieuwe versie.', 'Vernieuwen', () => w.postMessage('skipWaiting'));
    if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w.addEventListener('statechange', () => {
        if (w.state === 'installed') {
          if (navigator.serviceWorker.controller) offer(w);
          else toast('Klaar voor offline gebruik.');
        }
      });
    });
    setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
  }).catch(() => {});
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (!reloading) { reloading = true; location.reload(); } });
}

async function start() {
  applySize();
  view.innerHTML = '<p class="loading">Bijbel laden…</p>';
  try {
    [BOOKS, MAP, SV] = await Promise.all([loadJSON('books'), loadJSON('map'), loadJSON('sv')]);
  } catch (e) {
    view.innerHTML = '<p class="empty">De teksten konden niet worden geladen. Open de app één keer met internet, daarna werkt hij offline.</p>';
    return;
  }
  buildAliases();
  if (!BOOKS[pos.b]) pos = { b: 42, c: 1 };
  window.addEventListener('hashchange', route);
  route();
  registerSW();
}
start();
