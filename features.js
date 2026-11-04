'use strict';
/* Ereunate – kanttekeningen, verwijzingen, uitleg, Vraag Claude, voortgang en back-up.
   Gebruikt de helpers uit app.js ($, esc, ICON, BOOKS, SV, ORIG, settings, store, …). */

/* ---------- Kanttekeningen laden ---------- */
const KT = {};
function ensureNotes(bi) {
  if (KT[bi]) return Promise.resolve(KT[bi]);
  return loadJSON('kt/' + bi).then(d => (KT[bi] = d));
}
const noteLetter = i => String.fromCharCode(97 + (i % 26)) + (i >= 26 ? String(Math.floor(i / 26)) : '');
function notesFor(bi, c, v) { return (KT[bi] && KT[bi][c - 1] && KT[bi][c - 1][v - 1]) || null; }

/* SV-tekst met onderstreepte trefwoorden en lettertjes */
function svHTML(bi, c, v, text) {
  const notes = settings.marks ? notesFor(bi, c, v) : null;
  if (!notes) return esc(text);
  const toks = text.split(' ');
  const after = {}; const ul = new Array(toks.length).fill(false);
  let covered = -1;
  notes.forEach((n, i) => {
    const end = n[0];
    if (end < 1 || end > toks.length) return;
    (after[end - 1] = after[end - 1] || []).push(i);
    for (let k = Math.max(end - n[1], covered + 1); k < end; k++) ul[k] = true;
    covered = Math.max(covered, end - 1);
  });
  let out = '', inU = false;
  toks.forEach((t, k) => {
    if (ul[k] && !inU) { out += '<span class="kt-u">'; inU = true; }
    out += esc(t);
    if (after[k]) {
      if (inU) { out += '</span>'; inU = false; }
      out += after[k].map(i => `<button class="kt-m" data-n="${i}" aria-label="Kanttekening ${noteLetter(i)}">${noteLetter(i)}</button>`).join('');
    }
    if (inU && !ul[k + 1]) { out += '</span>'; inU = false; }
    if (k < toks.length - 1) out += ' ';
  });
  if (inU) out += '</span>';
  return out;
}

/* ---------- Verwijzingen ---------- */
// r = [boek, hfst, vers, hfst2, vers2], vers 0 = heel hoofdstuk
function refText(r) {
  const [b, c, v, c2, v2] = r;
  let s = BOOKS[b].abbr + ' ' + c;
  if (!v) return c2 && c2 !== c ? s + '-' + c2 : s;
  s += ':' + v;
  if (c2 !== c) s += '-' + c2 + ':' + v2;
  else if (v2 && v2 !== v) s += '-' + v2;
  return s;
}
function refVerses(r) {
  // lijst [hfst, vers] die bij een verwijzing horen (max 12)
  const [b, c, v, c2, v2] = r; const out = [];
  if (!v) { for (let i = 1; i <= Math.min(BOOKS[b].v[c - 1], 5); i++) out.push([c, i]); return out; }
  let cc = c, vv = v;
  while (out.length < 12) {
    out.push([cc, vv]);
    if (cc === c2 && vv >= v2) break;
    if (vv < BOOKS[b].v[cc - 1]) vv++; else { cc++; vv = 1; if (cc > BOOKS[b].v.length) break; }
  }
  return out;
}
function noteHTML(n, i, focus) {
  const text = esc(n[3]).replace(/\{\{(\d+)\}\}/g, (m, k) => {
    const r = n[4][+k];
    return r ? `<button class="ref" data-r="${r.join('.')}">${esc(refText(r))}</button>` : '';
  });
  return `<article class="note${focus ? ' focus' : ''}" data-i="${i}">
    <div class="note-h"><span class="note-l">${noteLetter(i)}</span>${n[2] ? `<span class="note-cw">${esc(n[2])}</span>` : ''}</div>
    <p>${text}</p></article>`;
}

/* ---------- Uitleg online ---------- */
const KING = ['Gn','Ex','Lv','Nm','Dt','Jz','Ri','Ru','1Sm','2Sm','1Kn','2Kn','1Kr','2Kr','Ea','Ne','Es','Jb','Ps','Sp','Pr','Hl','Js','Jr','Kl','Ez','Dn','Hs','Jl','Am','Ob','Jn','Mi','Na','Hk','Zf','Hg','Zc','Ml',
  'Mt','Mk','Lk','Jh','Hd','Rm','1Ko','2Ko','Gl','Ef','Fp','Ko','1Th','2Th','1Tm','2Tm','Tt','Fm','Hb','Jk','1Pt','2Pt','1Jh','2Jh','3Jh','Jd','Op'];
const SLUG = ['genesis','exodus','leviticus','numbers','deuteronomy','joshua','judges','ruth','1-samuel','2-samuel','1-kings','2-kings','1-chronicles','2-chronicles','ezra','nehemiah','esther','job','psalms','proverbs','ecclesiastes','song-of-solomon','isaiah','jeremiah','lamentations','ezekiel','daniel','hosea','joel','amos','obadiah','jonah','micah','nahum','habakkuk','zephaniah','haggai','zechariah','malachi',
  'matthew','mark','luke','john','acts','romans','1-corinthians','2-corinthians','galatians','ephesians','philippians','colossians','1-thessalonians','2-thessalonians','1-timothy','2-timothy','titus','philemon','hebrews','james','1-peter','2-peter','1-john','2-john','3-john','jude','revelation'];
const EXT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6"/><path d="M20 4 10 14"/><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/></svg>';
function uitlegHTML(bi, c) {
  const name = esc(BOOKS[bi].name + ' ' + c);
  return `<h3 class="sh-h">Uitleg online</h3>
    <div class="linklist">
      <a href="https://www.kingcomments.com/nl/bijbelstudies/${KING[bi]}/${c}" target="_blank" rel="noopener"><span><b>King Comments</b><small>${name} · kingcomments.com</small></span>${EXT}</a>
      <a href="https://www.studylight.org/commentaries/dut/mhm/${SLUG[bi]}-${c}.html" target="_blank" rel="noopener"><span><b>Matthew Henry</b><small>${name} · studylight.org</small></span>${EXT}</a>
    </div>`;
}

/* ---------- Panelen (op elkaar gestapeld, met terugknop) ---------- */
const sheets = [];
let pendingNav = null;
const scrim = document.createElement('div');
scrim.className = 'scrim'; scrim.hidden = true;
scrim.addEventListener('click', () => history.back());
document.body.appendChild(scrim);

function openSheet({ label, crumb, build }) {
  const trail = sheets.length ? [...sheets[sheets.length - 1].trail, crumb] : [crumb];
  const el = document.createElement('section');
  el.className = 'sheet';
  el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', label);
  sheets.forEach(s => s.el.classList.add('behind'));
  scrim.hidden = false;
  document.body.appendChild(el);
  const s = { el, trail };
  sheets.push(s);
  history.pushState({ sheet: sheets.length }, '', location.href);
  build(el, trail);
  requestAnimationFrame(() => el.classList.add('open'));
  return s;
}
function sheetHead(title, trail) {
  const crumbs = trail.length > 1
    ? `<nav class="crumbs" aria-label="Gevolgde weg"><button class="icon-btn" data-back="1" aria-label="Terug naar ${esc(trail[trail.length - 2])}">${ICON.left}</button>` +
      trail.map((t, i) => i === trail.length - 1
        ? `<span class="crumb cur" aria-current="page">${esc(t)}</span>`
        : `<button class="crumb" data-depth="${i + 1}">${esc(t)}</button>${ICON.right}`).join('') + '</nav>'
    : '';
  return `<div class="grip" aria-hidden="true"></div>${crumbs}
    <div class="sh-top"><h2>${esc(title)}</h2><button class="icon-btn" data-close aria-label="Sluiten">${ICON.x}</button></div>`;
}
function popSheet() {
  const s = sheets.pop();
  if (!s) return;
  s.el.classList.remove('open');
  setTimeout(() => s.el.remove(), 220);
  if (sheets.length) sheets[sheets.length - 1].el.classList.remove('behind');
  else scrim.hidden = true;
}
window.addEventListener('popstate', e => {
  const want = (e.state && e.state.sheet) || 0;
  while (sheets.length > want) popSheet();
  if (pendingNav && sheets.length === 0) { const h = pendingNav; pendingNav = null; location.hash = h; }
});
function closeAll() { if (sheets.length) history.go(-sheets.length); }
function goFromSheet(hash) {
  if (!sheets.length) { location.hash = hash; return; }
  pendingNav = hash; history.go(-sheets.length);
}
document.addEventListener('keydown', e => { if (e.key === 'Escape' && sheets.length) history.back(); });

/* ---------- Verspaneel ---------- */
async function openVerseSheet(bi, c, v, opt = {}) {
  const ref = opt.ref || [bi, c, v, c, v];
  const single = ref[2] && ref[3] === ref[1] && (!ref[4] || ref[4] === ref[2]);
  const title = opt.root ? BOOKS[bi].name + ' ' + c + ':' + v : (single ? BOOKS[bi].name + ' ' + c + ':' + ref[2] : refLabelFull(ref));
  openSheet({
    label: title, crumb: refText(ref),
    build: async (el, trail) => {
      el.innerHTML = sheetHead(title, trail) + '<div class="sh-body"><p class="loading">Laden…</p></div><div class="sh-foot"></div>';
      try { await ensureNotes(bi); } catch { /* zonder kanttekeningen verder */ }
      if (settings.orig) { try { await ensureOrig(origKind(bi)); } catch { /* alleen SV */ } }
      fillVerseSheet(el, bi, ref, opt);
    }
  });
}
function refLabelFull(r) {
  const t = refText(r); const sp = t.indexOf(' ');
  return BOOKS[r[0]].name + t.slice(sp);
}
function fillVerseSheet(el, bi, ref, opt) {
  const verses = refVerses(ref);
  const firstC = verses[0][0];
  let html = '';
  if (!opt.root) {
    html += '<div class="sh-verses">';
    verses.forEach(([c, v]) => {
      const t = SV[bi][c - 1][v - 1];
      const o = settings.orig ? origFor(bi, c, v) : null;
      html += `<div class="sh-verse"><span class="vnum">${verses.length > 1 ? (c !== firstC ? c + ':' : '') + v : ''}</span><div>
        <p class="t-sv" lang="nl">${esc(t)}</p>
        ${o ? `<p class="t-orig" lang="${BOOKS[bi].ot ? 'he' : 'grc'}"${BOOKS[bi].ot ? ' dir="rtl"' : ''}>${esc(o.text)}</p>` : ''}</div></div>`;
    });
    if (!ref[2]) html += `<p class="hint">Eerste verzen van het hoofdstuk.</p>`;
    html += '</div>';
  }
  // kanttekeningen van de getoonde verzen
  const groups = verses.map(([c, v]) => ({ c, v, notes: notesFor(bi, c, v) || [] })).filter(g => g.notes.length);
  const total = groups.reduce((n, g) => n + g.notes.length, 0);
  const allRefs = [];
  groups.forEach(g => g.notes.forEach(n => n[4].forEach(r => { if (!allRefs.some(x => x.join() === r.join())) allRefs.push(r); })));
  html += `<h3 class="sh-h">Kanttekeningen${total ? ' · ' + total : ''}</h3>`;
  if (!total) html += '<p class="hint">Bij dit vers staan geen kanttekeningen.</p>';
  const collapse = total > 4 && opt.focus == null;
  let shown = 0;
  groups.forEach(g => {
    if (groups.length > 1) html += `<p class="sh-sub">Vers ${g.c !== firstC ? g.c + ':' : ''}${g.v}</p>`;
    g.notes.forEach((n, i) => {
      const hide = collapse && shown >= 3;
      html += hide ? noteHTML(n, i).replace('<article class="note', '<article hidden class="note more-note') : noteHTML(n, i, opt.focus === i);
      shown++;
    });
  });
  if (collapse) html += `<button class="more" data-more>Toon nog ${total - 3} kanttekening${total - 3 === 1 ? '' : 'en'}</button>`;
  if (allRefs.length > 2) {
    html += `<button class="more" data-allrefs aria-expanded="false">Alle verwijzingen (${allRefs.length})</button>
      <div class="reflist" hidden>${allRefs.map(r => {
        const [b, c, v] = r; const t = SV[b][c - 1][(v || 1) - 1] || '';
        return `<button class="refrow" data-r="${r.join('.')}"><b>${esc(refText(r))}</b><span>${esc(t.length > 80 ? t.slice(0, 78) + '…' : t)}</span></button>`;
      }).join('')}</div>`;
  }
  html += uitlegHTML(bi, firstC);
  el.querySelector('.sh-body').innerHTML = html;

  const [c0, v0] = verses[0];
  const foot = el.querySelector('.sh-foot');
  foot.innerHTML = (opt.root ? '' : `<button class="btn primary" data-read>${ICON.book}Lees ${esc(BOOKS[bi].abbr)} ${firstC}</button>`) +
    `<button class="btn${opt.root ? ' primary' : ''}" data-claude>${ICON.chat}Vraag Claude</button>` +
    `<button class="btn icon" data-copy aria-label="Vers kopiëren">${ICON.copy}</button>`;

  el.onclick = e => {
    const t = e.target.closest('button'); if (!t) return;
    if (t.dataset.close != null) { closeAll(); return; }
    if (t.dataset.back) { history.back(); return; }
    if (t.dataset.depth) { history.go(-(sheets.length - +t.dataset.depth)); return; }
    if (t.dataset.r) { const r = t.dataset.r.split('.').map(Number); openVerseSheet(r[0], r[1], r[2] || 1, { ref: r }); return; }
    if (t.dataset.more != null) { el.querySelectorAll('.more-note').forEach(n => (n.hidden = false)); t.remove(); return; }
    if (t.dataset.allrefs != null) {
      const list = el.querySelector('.reflist'); list.hidden = !list.hidden;
      t.setAttribute('aria-expanded', String(!list.hidden));
      if (!list.hidden) list.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      return;
    }
    if (t.dataset.read != null) { goFromSheet(readHref(bi, firstC, ref[2] || null)); return; }
    if (t.dataset.claude != null) { openClaudeSheet(bi, ref); return; }
    if (t.dataset.copy != null) {
      const txt = verses.map(([c, v]) => SV[bi][c - 1][v - 1]).join(' ');
      copyText(`${refLabelFull(ref[2] ? ref : [bi, c0, v0, c0, v0])} (SV)\n${txt}`);
    }
  };
  if (opt.focus != null) {
    const n = el.querySelector(`.note[data-i="${opt.focus}"]`);
    if (n) setTimeout(() => n.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 260);
  }
}
async function copyText(t) {
  try { await navigator.clipboard.writeText(t); toast('Gekopieerd.'); }
  catch { toast('Kopiëren lukte niet.'); }
}

/* ---------- Vraag Claude ---------- */
const ASK = [
  { t: 'Letterlijke vertaling', s: 'Woord voor woord, met grondvorm en betekenis',
    q: k => `Geef een zo letterlijk mogelijke Nederlandse vertaling van het ${k}, woord voor woord, met per woord de grondvorm en betekenis. Vergelijk daarna kort met de SV.` },
  { t: 'Waar wijkt de SV af?', s: 'Keuzes van de vertalers en waarom',
    q: k => `Waar kiest de SV een andere weergave dan een letterlijke vertaling uit het ${k} zou geven, en waarom? Let op woordvolgorde, werkwoordstijden en woorden met meerdere betekenissen.` },
  { t: 'Moeilijk te vertalen', s: 'Wat er in het Nederlands verloren gaat',
    q: k => `Welke woorden of constructies in het ${k} laten zich lastig in het Nederlands weergeven? Leg uit wat er bij het vertalen verloren gaat of toegevoegd wordt.` },
  { t: 'Eigen vraag', s: 'Typ zelf wat je wilt weten', q: () => '' }
];
function openClaudeSheet(bi, ref) {
  const verses = refVerses(ref);
  const label = ref[2] ? refLabelFull(ref) : BOOKS[bi].name + ' ' + ref[1];
  const ot = BOOKS[bi].ot;
  const lang = ot ? 'Hebreeuws' : 'Grieks';
  openSheet({
    label: 'Vraag Claude', crumb: 'Claude',
    build: async (el, trail) => {
      try { await ensureOrig(origKind(bi)); } catch { /* alleen SV */ }
      const sv = verses.map(([c, v]) => (verses.length > 1 ? v + ' ' : '') + SV[bi][c - 1][v - 1]).join(' ');
      const orig = verses.map(([c, v]) => { const o = origFor(bi, c, v); return o ? (verses.length > 1 ? v + ' ' : '') + o.text : ''; }).filter(Boolean).join(' ');
      const src = ot ? 'de Hebreeuwse grondtekst (Westminster Leningrad Codex)' : 'de Griekse grondtekst (Textus Receptus)';
      const intro = orig
        ? `Hieronder staat ${label} in de Statenvertaling en in ${src}.\n\nSV: ${sv}\n\n${lang}: ${orig}\n\n`
        : `Hieronder staat ${label} in de Statenvertaling.\n\nSV: ${sv}\n\n`;
      let pick = Math.min(settings.claudeAsk || 0, ASK.length - 1);
      el.innerHTML = sheetHead('Vraag Claude', trail) + `
        <div class="sh-body">
          <div class="chips" style="padding:0;margin-bottom:4px"><span class="chip small soft">${esc(label)}</span><span class="chip small">SV${orig ? ' + ' + lang : ''}</span></div>
          <h3 class="sh-h">Wat wil je weten?</h3>
          <div class="radios" role="radiogroup" aria-label="Wat wil je weten?">
            ${ASK.map((a, i) => `<button class="radio" role="radio" data-i="${i}"><span class="dot"></span><span><b>${a.t}</b><small>${a.s}</small></span></button>`).join('')}
          </div>
          <div class="own" hidden><label for="own-q" class="sh-h" style="display:block">Jouw vraag</label>
            <textarea id="own-q" rows="3" placeholder="Bijv. waarom staat er 'alzo'?"></textarea></div>
          <h3 class="sh-h">Deze vraag gaat naar Claude</h3>
          <pre class="prompt" id="prompt"></pre>
        </div>
        <div class="sh-foot">
          <a class="btn primary" id="go-claude" target="_blank" rel="noopener">Openen in Claude ${EXT}</a>
          <button class="btn" id="copy-q">${ICON.copy}Kopieer</button>
        </div>
        <p class="sh-note">Claude opent in een nieuwe chat met deze vraag. Daarvoor is internet nodig.</p>`;
      const ta = el.querySelector('#own-q');
      const build = () => {
        const own = pick === 3;
        el.querySelector('.own').hidden = !own;
        el.querySelectorAll('.radio').forEach(b => b.setAttribute('aria-checked', String(+b.dataset.i === pick)));
        const q = own ? (ta.value.trim() || '[typ hierboven je vraag]') : ASK[pick].q(lang);
        const prompt = intro + q;
        el.querySelector('#prompt').textContent = prompt;
        el.querySelector('#go-claude').href = 'https://claude.ai/new?q=' + encodeURIComponent(prompt);
        return prompt;
      };
      el.querySelectorAll('.radio').forEach(b => b.onclick = () => { pick = +b.dataset.i; settings.claudeAsk = pick; saveSettings(); build(); if (pick === 3) ta.focus(); });
      ta.oninput = build;
      el.querySelector('#copy-q').onclick = () => copyText(build());
      el.querySelector('[data-close]').onclick = () => closeAll();
      const back = el.querySelector('[data-back]'); if (back) back.onclick = () => history.back();
      el.querySelectorAll('[data-depth]').forEach(b => b.onclick = () => history.go(-(sheets.length - +b.dataset.depth)));
      build();
    }
  });
}

/* ---------- Gelezen hoofdstukken ---------- */
let READ = store.get('read', {});        // { boekindex: [hoofdstukken] }
function isRead(bi, c) { return !!(READ[bi] && READ[bi].includes(c)); }
function setRead(bi, c, on) {
  const set = new Set(READ[bi] || []);
  if (on) set.add(c); else set.delete(c);
  if (set.size) READ[bi] = [...set].sort((a, b) => a - b); else delete READ[bi];
  store.set('read', READ);
}
function toggleRead(bi, c) { setRead(bi, c, !isRead(bi, c)); }
function readCount(bi) { return (READ[bi] || []).length; }

/* ---------- Voortgang ---------- */
let REFGRAPH = null;
const prog = { t: null, open: null };
async function renderProgress() {
  view.dataset.view = 'voortgang';
  if (!prog.t) prog.t = BOOKS[pos.b].ot ? 'OT' : 'NT';
  const totalCh = BOOKS.reduce((n, b) => n + b.v.length, 0);
  const readCh = Object.values(READ).reduce((n, a) => n + a.length, 0);
  const doneBooks = BOOKS.filter((b, i) => readCount(i) === b.v.length).map(b => b.name);
  view.innerHTML = `
    <header class="top"><h1 class="page-title">Voortgang</h1><div style="height:8px"></div></header>
    <main class="scroll search-page"><div class="results" id="prog">
      <section class="card stat" aria-label="Totaal">
        <div><b class="big">${readCh}</b> van ${totalCh} hoofdstukken gelezen</div>
        <div class="bar-bg" role="progressbar" aria-valuenow="${readCh}" aria-valuemin="0" aria-valuemax="${totalCh}" aria-label="Hoofdstukken gelezen"><div style="width:${(readCh / totalCh * 100).toFixed(1)}%"></div></div>
        <small>${doneBooks.length ? (doneBooks.length === 1 ? '1 boek' : doneBooks.length + ' boeken') + ' helemaal uit: ' + esc(doneBooks.slice(0, 4).join(', ')) + (doneBooks.length > 4 ? ' en meer' : '') + '.' : 'Vink onderaan een hoofdstuk af, of hieronder hele boeken.'}</small>
      </section>
      <h2 class="group-h">Aanbevolen om nu te lezen</h2>
      <p class="meta" style="margin-top:-6px">Hoofdstukken waar de kanttekeningen bij wat je las het vaakst naar verwijzen.</p>
      <div id="recs"><p class="loading">Even rekenen…</p></div>
      <div class="row-h"><h2 class="group-h">Per boek</h2>
        <div class="seg small" role="group" aria-label="Testament"><button id="p-ot">OT</button><button id="p-nt">NT</button></div></div>
      <div class="booklist" id="booklist"></div>
      <h2 class="group-h">Back-up</h2>
      <section class="card stat">
        <small>Je gelezen hoofdstukken en instellingen staan alleen op deze telefoon. Maak af en toe een back-up, bijvoorbeeld naar je bestanden of cloud.</small>
        <div class="btnrow"><button class="btn primary" id="bk-out">${ICON.dl}Back-up maken</button>
        <label class="btn" for="bk-in">${ICON.up}Terugzetten</label><input type="file" id="bk-in" accept="application/json,.json" hidden></div>
      </section>
    </div></main>`;
  $('#p-ot').onclick = () => { prog.t = 'OT'; prog.open = null; fillBooks(); };
  $('#p-nt').onclick = () => { prog.t = 'NT'; prog.open = null; fillBooks(); };
  $('#bk-out').onclick = exportBackup;
  $('#bk-in').onchange = e => importBackup(e.target.files[0]);
  fillBooks();
  try { REFGRAPH = REFGRAPH || await loadJSON('refgraph'); } catch { /* geen aanbevelingen */ }
  if (view.dataset.view === 'voortgang') fillRecs();
}
function fillRecs() {
  const box = $('#recs'); if (!box) return;
  if (!REFGRAPH) { box.innerHTML = '<p class="hint">Aanbevelingen zijn nu niet beschikbaar.</p>'; return; }
  const score = {}, from = {};
  Object.entries(READ).forEach(([b, chs]) => chs.forEach(c => {
    (REFGRAPH[b + ':' + c] || []).forEach(([tb, tc, n]) => {
      if (isRead(tb, tc)) return;
      const k = tb + ':' + tc;
      score[k] = (score[k] || 0) + n;
      (from[k] = from[k] || {})[b + ':' + c] = ((from[k] || {})[b + ':' + c] || 0) + n;
    });
  }));
  const top = Object.entries(score).sort((a, b) => b[1] - a[1]).slice(0, 3);
  if (!top.length) { box.innerHTML = '<p class="hint">Vink hoofdstukken af die je gelezen hebt. Dan zie je hier wat daar het meest mee samenhangt.</p>'; return; }
  box.innerHTML = top.map(([k, n]) => {
    const [b, c] = k.split(':').map(Number);
    const src = Object.entries(from[k]).sort((a, b2) => b2[1] - a[1]).slice(0, 2)
      .map(([s]) => { const [sb, sc] = s.split(':').map(Number); return BOOKS[sb].abbr + ' ' + sc; });
    return `<a class="card rec" href="${readHref(b, c)}"><span><b>${esc(BOOKS[b].name)} ${c}</b>
      <small><em>${n} verwijzing${n === 1 ? '' : 'en'}</em> · vooral vanuit ${esc(src.join(' en '))}</small></span>${ICON.right}</a>`;
  }).join('');
}
function fillBooks() {
  $('#p-ot').setAttribute('aria-pressed', String(prog.t === 'OT'));
  $('#p-nt').setAttribute('aria-pressed', String(prog.t === 'NT'));
  const from = prog.t === 'OT' ? 0 : 39, to = prog.t === 'OT' ? 39 : 66;
  let html = '';
  for (let i = from; i < to; i++) {
    const b = BOOKS[i], n = b.v.length, r = readCount(i), done = r === n;
    html += `<div class="bookrow${prog.open === i ? ' open' : ''}">
      <button class="bk" data-b="${i}" aria-expanded="${prog.open === i}">
        <span class="bk-name${done ? ' done' : ''}">${esc(b.name)}</span>
        <span class="bar-bg"><span style="width:${(r / n * 100).toFixed(1)}%"></span></span>
        <span class="bk-n${done ? ' done' : ''}">${done ? ICON.check + n : r + '/' + n}</span>
      </button>`;
    if (prog.open === i) {
      html += `<div class="bk-detail"><div class="grid6">` +
        b.v.map((_, k) => `<button class="cell${isRead(i, k + 1) ? ' read' : ''}" data-ch="${k + 1}" aria-pressed="${isRead(i, k + 1)}" aria-label="${esc(b.name)} ${k + 1}">${k + 1}</button>`).join('') +
        `</div><div class="btnrow"><button class="btn" data-all>${ICON.check}Heel boek gelezen</button>${r ? '<button class="btn" data-none>Wissen</button>' : ''}</div></div>`;
    }
    html += '</div>';
  }
  const box = $('#booklist');
  box.innerHTML = html;
  box.onclick = e => {
    const t = e.target.closest('button'); if (!t) return;
    if (t.dataset.b) { const b = +t.dataset.b; prog.open = prog.open === b ? null : b; fillBooks(); return; }
    const bi = prog.open;
    if (t.dataset.ch) { toggleRead(bi, +t.dataset.ch); }
    else if (t.dataset.all != null) { BOOKS[bi].v.forEach((_, k) => setRead(bi, k + 1, true)); }
    else if (t.dataset.none != null) { delete READ[bi]; store.set('read', READ); }
    else return;
    const y = $('.scroll').scrollTop; renderProgressKeep(y);
  };
}
function renderProgressKeep(y) { renderProgress().then(() => {}); requestAnimationFrame(() => { const s = $('.scroll'); if (s) s.scrollTop = y; }); }

/* ---------- Back-up ---------- */
function exportBackup() {
  const data = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k.startsWith('ereunate:')) data[k.slice(9)] = JSON.parse(localStorage.getItem(k));
  }
  const payload = { app: 'ereunate', format: 1, exportedAt: new Date().toISOString(), data };
  const name = 'ereunate-backup-' + new Date().toISOString().slice(0, 10) + '.json';
  const blob = new Blob([JSON.stringify(payload, null, 1)], { type: 'application/json' });
  const file = new File([blob], name, { type: 'application/json' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    navigator.share({ files: [file], title: 'Ereunate back-up' }).catch(() => {});
    return;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function importBackup(file) {
  if (!file) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      const p = JSON.parse(r.result);
      if (p.app !== 'ereunate' || !p.data) throw new Error('geen ereunate-back-up');
      const n = p.data.read ? Object.values(p.data.read).reduce((x, a) => x + a.length, 0) : 0;
      if (!confirm(`Back-up van ${p.exportedAt ? new Date(p.exportedAt).toLocaleDateString('nl-NL') : 'onbekende datum'} terugzetten (${n} gelezen hoofdstukken)? Wat nu op deze telefoon staat wordt vervangen.`)) return;
      Object.keys(localStorage).filter(k => k.startsWith('ereunate:')).forEach(k => localStorage.removeItem(k));
      Object.entries(p.data).forEach(([k, v]) => localStorage.setItem('ereunate:' + k, JSON.stringify(v)));
      location.reload();
    } catch (e) {
      toast('Dit bestand is geen geldige back-up.');
    }
  };
  r.readAsText(file);
}
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
