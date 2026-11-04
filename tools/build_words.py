"""Woordinfo: SV-woorden met Strong-nummers, grondtekstwoorden met grammatica, woordenboek.

Bronnen (in SRC_DIR):
  stv/STV.osis.xml                         SV met Strong-nummers per woord (CC0)
  htr/data/gnt.nested.json                 Textus Receptus met Strong en grammatica per woord
  wlc/wlc/*.xml                            Westminster Leningrad Codex met lemma en morfologie (OSHB)
  strongs/greek|hebrew/strongs-*-dictionary.js   Strong's woordenboeken (Open Scriptures, CC BY-SA)

Schrijft:
  data/w/<boek>.json   {"s": SV per hfst/vers [woordpositie, sleutel, ...],
                        "o": grondtekst per hfst/vers [[woord, sleutel, grammaticacode], ...]}
  data/lex.json        {sleutel: [grondvorm, transliteratie, betekenis (Engels), [[SV-weergave, aantal], ...], aantal verzen, [boek, hfst, vers, ...]]}
  data/gram.json       {"g": {code: Nederlandse omschrijving}, "h": {...}}
"""
import os, re, sys, json, glob, difflib, unicodedata, collections
HERE = os.path.dirname(os.path.abspath(__file__))
SRC_DIR = os.environ.get('SRC_DIR', os.path.join(HERE, 'src'))
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, '..', 'data')
os.makedirs(os.path.join(OUT, 'w'), exist_ok=True)
sys.path.insert(0, HERE)
from load import BOOKS as BOOKDEFS

books = json.load(open(os.path.join(HERE, '..', 'data', 'books.json'), encoding='utf-8'))
sv = json.load(open(os.path.join(HERE, '..', 'data', 'sv.json'), encoding='utf-8'))
ids = [b['id'] for b in books]

def norm(t):
    t = unicodedata.normalize('NFKD', t.lower())
    return re.sub(r'[^a-z0-9]', '', t)

# ---------------------------------------------------------------- grammatica Grieks (Robinson-codes)
CASE = {'N': '1e naamval (nominatief)', 'G': '2e naamval (genitief)', 'D': '3e naamval (datief)', 'A': '4e naamval (accusatief)', 'V': 'vocatief'}
NUM = {'S': 'enkelvoud', 'P': 'meervoud'}
GEN = {'M': 'mannelijk', 'F': 'vrouwelijk', 'N': 'onzijdig'}
TENSE = {'P': 'tegenwoordige tijd', 'I': 'imperfectum', 'F': 'toekomende tijd', 'A': 'aoristus', 'R': 'perfectum', 'L': 'plusquamperfectum'}
VOICE = {'A': 'bedrijvend', 'M': 'medium', 'P': 'lijdend', 'E': 'medium of lijdend', 'D': 'medium (deponens)', 'O': 'lijdend (deponens)', 'N': 'medium of lijdend (deponens)', 'Q': 'onpersoonlijk bedrijvend', 'X': ''}
MOOD = {'I': 'aantonende wijs', 'S': 'aanvoegende wijs', 'O': 'wensende wijs', 'M': 'gebiedende wijs', 'N': 'infinitief', 'P': 'deelwoord', 'R': 'gebiedend deelwoord'}
POS = {'N': 'Zelfstandig naamwoord', 'A': 'Bijvoeglijk naamwoord', 'T': 'Lidwoord', 'P': 'Persoonlijk voornaamwoord', 'R': 'Betrekkelijk voornaamwoord',
       'C': 'Wederkerig voornaamwoord', 'D': 'Aanwijzend voornaamwoord', 'K': 'Correlatief voornaamwoord', 'I': 'Vragend voornaamwoord',
       'X': 'Onbepaald voornaamwoord', 'Q': 'Correlatief of vragend voornaamwoord', 'F': 'Wederkerend voornaamwoord', 'S': 'Bezittelijk voornaamwoord'}
WORDS = {'ADV': 'Bijwoord', 'CONJ': 'Voegwoord', 'PREP': 'Voorzetsel', 'PRT': 'Partikel', 'INJ': 'Tussenwerpsel', 'ARAM': 'Aramees woord',
         'HEB': 'Hebreeuws woord', 'COND': 'Voorwaardelijk voegwoord', 'PRT-N': 'Partikel (ontkennend)', 'PRT-I': 'Partikel (vragend)'}
SUFFIX = {'C': 'vergrotende trap', 'S': 'overtreffende trap', 'I': 'vragend', 'N': 'ontkennend', 'PRI': 'eigennaam, onverbuigbaar',
          'NUI': 'telwoord, onverbuigbaar', 'LI': 'letter, onverbuigbaar', 'OI': 'onverbuigbaar', 'ATT': 'Attische vorm', 'ABB': 'afgekort', 'K': 'samengetrokken'}

def greek_gram(code):
    if code in WORDS:
        return WORDS[code]
    parts = code.split('-')
    head = parts[0]
    out = []
    if head.startswith('ADV') or head.startswith('CONJ') or head.startswith('PRT') or head.startswith('COND'):
        base = WORDS.get(head, WORDS.get(head[:3], head))
        out.append(base)
        out += [SUFFIX.get(p, '') for p in parts[1:]]
        return ' · '.join(x for x in out if x)
    if head == 'V':
        tvm = parts[1] if len(parts) > 1 else ''
        m = re.match(r'(\d?)([PIFARL])([AMPEDONQX])([ISOMNPR])', tvm)
        out.append('Werkwoord')
        if m:
            out.append(('tweede ' if m.group(1) == '2' else '') + TENSE[m.group(2)])
            if VOICE[m.group(3)]:
                out.append(VOICE[m.group(3)])
            out.append(MOOD[m.group(4)])
        rest = parts[2:] if len(parts) > 2 else []
        for r in rest:
            if re.fullmatch(r'[123][SP]', r):
                out.append(f'{r[0]}e persoon {NUM[r[1]]}')
            elif re.fullmatch(r'[NGDAV][SP][MFN]', r):
                out += [CASE[r[0]], NUM[r[1]], GEN[r[2]]]
            elif r in SUFFIX:
                out.append(SUFFIX[r])
        return ' · '.join(out)
    if head in POS:
        out.append(POS[head])
        for r in parts[1:]:
            mm = re.fullmatch(r'([123]?)([NGDAV])([SP])([MFN]?)', r)
            if mm:
                if mm.group(1):
                    out.append(f'{mm.group(1)}e persoon')
                out += [CASE[mm.group(2)], NUM[mm.group(3)]]
                if mm.group(4):
                    out.append(GEN[mm.group(4)])
            elif re.fullmatch(r'[123][SP]', r):
                out.append(f'{r[0]}e persoon {NUM[r[1]]}')
            elif r in SUFFIX:
                out.append(SUFFIX[r])
        return ' · '.join(out)
    return code

# ---------------------------------------------------------------- grammatica Hebreeuws (OSHB-codes)
H_STEM = {'q': 'qal', 'N': 'nifal', 'p': 'piël', 'P': 'pual', 'h': 'hifil', 'H': 'hofal', 't': 'hitpaël', 'o': 'poleel', 'O': 'polal',
          'r': 'hitpoleel', 'm': 'poel', 'M': 'poal', 'k': 'palel', 'K': 'pulal', 'Q': 'qal passief', 'l': 'pilpel', 'L': 'polpal',
          'f': 'hitpalpel', 'D': 'nitpaël', 'j': 'pealal', 'i': 'pilel', 'u': 'hotpaal', 'c': 'tifil', 'v': 'hisjtafel', 'w': 'nitpaleel',
          'y': 'nitpoel', 'z': 'hitpoel'}
A_STEM = {'q': 'peal', 'Q': 'peil', 'u': 'hitpeel', 'p': 'paël', 'P': 'itpaal', 'M': 'hitpaal', 'a': 'afel', 'h': 'hafel', 's': 'safel',
          'e': 'sjafel', 'H': 'hofal', 'i': 'itpeel', 't': 'hisjtafel', 'v': 'isjtafel', 'w': 'hitafel', 'o': 'poel', 'z': 'itpoel',
          'r': 'hitpoel', 'f': 'hitpalpel', 'b': 'hefal', 'c': 'tifel', 'm': 'poel', 'l': 'palpel', 'L': 'itpalpel', 'O': 'itpolel', 'G': 'ittafal'}
H_CONJ = {'p': 'perfectum', 'q': 'perfectum consecutivum', 'i': 'imperfectum', 'w': 'imperfectum consecutivum', 'h': 'cohortatief',
          'j': 'jussief', 'v': 'imperatief', 'r': 'deelwoord bedrijvend', 's': 'deelwoord lijdend', 'a': 'infinitivus absolutus', 'c': 'infinitivus constructus'}
H_GEN = {'m': 'mannelijk', 'f': 'vrouwelijk', 'c': 'gemeenschappelijk', 'b': 'mannelijk/vrouwelijk'}
H_NUM = {'s': 'enkelvoud', 'p': 'meervoud', 'd': 'tweevoud'}
H_STATE = {'a': 'status absolutus', 'c': 'status constructus', 'd': 'bepaald'}
H_PART = {'a': 'bevestigend partikel', 'd': 'lidwoord', 'e': 'aansporend partikel', 'i': 'vragend partikel', 'j': 'tussenwerpsel',
          'm': 'aanwijzend partikel', 'n': 'ontkennend partikel', 'o': 'lijdend-voorwerpsteken', 'r': 'betrekkelijk partikel'}
H_PRON = {'d': 'aanwijzend voornaamwoord', 'f': 'onbepaald voornaamwoord', 'i': 'vragend voornaamwoord', 'p': 'persoonlijk voornaamwoord', 'r': 'betrekkelijk voornaamwoord'}
H_ADJ = {'a': 'bijvoeglijk naamwoord', 'c': 'hoofdtelwoord', 'g': 'gentilicum (afkomst)', 'o': 'rangtelwoord'}
H_NOUN = {'c': 'zelfstandig naamwoord', 'g': 'gentilicum (afkomst)', 'p': 'eigennaam'}
H_SUF = {'d': 'richtings-he', 'h': 'paragogische he', 'n': 'paragogische noen', 'p': 'voornaamwoordelijk achtervoegsel'}

def pgn(s):
    out = []
    for ch in s:
        if ch in '123':
            out.append(f'{ch}e persoon')
        elif ch in H_GEN:
            out.append(H_GEN[ch])
        elif ch in H_NUM:
            out.append(H_NUM[ch])
    return out

def heb_seg(seg, aram):
    if not seg:
        return ''
    p, rest = seg[0], seg[1:]
    if p == 'V':
        stem = (A_STEM if aram else H_STEM).get(rest[:1], rest[:1])
        conj = H_CONJ.get(rest[1:2], '')
        tail = rest[2:]
        bits = ['werkwoord', stem, conj]
        if conj.startswith('deelwoord'):
            bits += [H_GEN.get(tail[:1], ''), H_NUM.get(tail[1:2], ''), H_STATE.get(tail[2:3], '')]
        else:
            bits += pgn(tail)
        return ' · '.join(b for b in bits if b)
    if p == 'N':
        bits = [H_NOUN.get(rest[:1], 'zelfstandig naamwoord')]
        if rest[:1] == 'p':
            return bits[0]
        bits += [H_GEN.get(rest[1:2], ''), H_NUM.get(rest[2:3], ''), H_STATE.get(rest[3:4], '')]
        return ' · '.join(b for b in bits if b)
    if p == 'A':
        bits = [H_ADJ.get(rest[:1], 'bijvoeglijk naamwoord'), H_GEN.get(rest[1:2], ''), H_NUM.get(rest[2:3], ''), H_STATE.get(rest[3:4], '')]
        return ' · '.join(b for b in bits if b)
    if p == 'P':
        return ' · '.join([H_PRON.get(rest[:1], 'voornaamwoord')] + pgn(rest[1:]))
    if p == 'S':
        return ' · '.join([H_SUF.get(rest[:1], 'achtervoegsel')] + pgn(rest[1:]))
    if p == 'T':
        return H_PART.get(rest[:1], 'partikel')
    if p == 'R':
        return 'voorzetsel' + (' met lidwoord' if rest[:1] == 'd' else '')
    if p == 'C':
        return 'voegwoord'
    if p == 'D':
        return 'bijwoord'
    return seg

def hebrew_gram(code):
    aram = code.startswith('A')
    segs = code[1:].split('/')
    core = [x for x in segs if x[:1] != 'S'] or segs[:1]
    mi = segs.index(core[-1])
    main = heb_seg(segs[mi], aram)
    pre = [heb_seg(x, aram) for x in segs[:mi]]
    suf = [heb_seg(x, aram) for x in segs[mi + 1:]]
    out = (main or '')
    out = out[:1].upper() + out[1:]
    if aram:
        out += ' · Aramees'
    extra = []
    if pre:
        extra.append('voorvoegsel: ' + ', '.join(pre))
    if suf:
        extra.append('achtervoegsel: ' + ', '.join(suf))
    return out + ('\n' + '; '.join(extra) if extra else '')

# ---------------------------------------------------------------- woordenboeken
def load_js(path):
    t = open(path, encoding='utf-8').read()
    return json.loads(t[t.index('{', t.index('var ')):t.rstrip().rstrip(';').rindex('}') + 1])
G = load_js(os.path.join(SRC_DIR, 'strongs', 'greek', 'strongs-greek-dictionary.js'))
H = load_js(os.path.join(SRC_DIR, 'strongs', 'hebrew', 'strongs-hebrew-dictionary.js'))
PREFIX_LEX = {
    'Hb': ['בְּ', 'be-', 'voorvoegsel: in, met, door, bij'],
    'Hl': ['לְ', 'le-', 'voorvoegsel: naar, tot, voor, aan'],
    'Hk': ['כְּ', 'ke-', 'voorvoegsel: als, zoals, ongeveer'],
    'Hm': ['מִן', 'min', 'voorzetsel: van, uit, vanaf (ook: meer dan)'],
    'Hc': ['וְ', 've-', 'voorvoegsel: en, maar, toen'],
    'Hd': ['הַ', 'ha-', 'lidwoord: de, het'],
    'Hi': ['הֲ', 'ha-', 'vragend voorvoegsel'],
}
def clean_def(s):
    s = (s or '').strip().strip(';').strip()
    return re.sub(r'\s+', ' ', s)

# ---------------------------------------------------------------- SV met Strong-nummers
stv = open(os.path.join(SRC_DIR, 'stv', 'STV.osis.xml'), encoding='utf-8').read()
V = {m.group(1): m.group(2) for m in re.finditer(r'<verse osisID="([^"]+)">(.*?)</verse>', stv, re.S)}

def stv_tokens(xml, ot):
    xml = re.sub(r'<note.*?</note>', '', xml, flags=re.S)
    chunks = []
    for m in re.finditer(r'<w lemma="([^"]*)"[^>]*>(.*?)</w>|<[^>]+>|([^<]+)', xml, re.S):
        if m.group(3) is not None:
            chunks.append((m.group(3), []))
        elif m.group(2) is not None:
            keys = []
            for i, (lang, num) in enumerate(re.findall(r'strong:([GH])0*(\d+)', m.group(1))):
                n = int(num)
                if lang == 'G' and (n > 5624 or (i > 0 and n >= 5501)):
                    continue   # tijd/wijs-codes, geen woorden
                if lang == 'H' and n > 8674:
                    continue   # stam/tijd-codes, geen woorden
                if (lang == 'H') != ot:
                    continue
                keys.append(lang + str(n))
            chunks.append((re.sub(r'<[^>]+>', '', m.group(2)), keys))
    toks, cur, curk = [], '', set()
    for text, keys in chunks:
        for ch in text:
            if ch.isspace():
                if cur:
                    toks.append((cur, curk)); cur, curk = '', set()
            else:
                cur += ch; curk |= set(keys)
    if cur:
        toks.append((cur, curk))
    return toks

# ---------------------------------------------------------------- grondtekst per woord
htr = json.load(open(os.path.join(SRC_DIR, 'htr', 'data', 'gnt.nested.json'), encoding='utf-8'))
TRW = {b['book_name_osis']: {c['chapter']: {v['verse']: [(w['greek'], 'G%d' % w['strong'] if w['strong'] else '', w['grammar']) for w in v['words']]
                                             for v in c['verses']} for c in b['chapters']} for b in htr}
gram_g = {}
for b in htr:
    for c in b['chapters']:
        for v in c['verses']:
            for w in v['words']:
                if w['grammar'] not in gram_g:
                    gram_g[w['grammar']] = greek_gram(w['grammar'])

NS = '{http://www.bibletechnologies.net/2003/OSIS/namespace}'
CANT = re.compile('[֑-ֽ֯]')
gram_h = {}
def wlc_book(osis):
    import xml.etree.ElementTree as ET
    root = ET.parse(os.path.join(SRC_DIR, 'wlc', 'wlc', osis + '.xml')).getroot()
    out = {}
    for v in root.iter(NS + 'verse'):
        _, c, n = v.get('osisID').split('.')
        words = []
        def walk(e, in_note=False):
            tag = e.tag.replace(NS, '')
            if tag == 'note':
                return
            if tag == 'w':
                lemma = e.get('lemma') or ''
                morph = e.get('morph') or ''
                nums = re.findall(r'\d+', lemma)
                if nums:
                    key = 'H%d' % int(nums[-1])
                else:
                    letters = [x.strip() for x in lemma.split('/') if x.strip()]
                    key = 'H' + letters[-1][:1] if letters else ''
                    if key == 'Hm':
                        key = 'H4480'
                surface = CANT.sub('', ''.join(e.itertext()).replace('/', ''))
                if morph and morph not in gram_h:
                    gram_h[morph] = hebrew_gram(morph)
                words.append([surface, key, morph])
                return
            for ch in e:
                walk(ch)
        walk(v)
        out.setdefault(int(c), {})[int(n)] = words
    return out

# ---------------------------------------------------------------- compacte codering
PREFIX_NUM = {'Hb': -1, 'Hl': -2, 'Hk': -3, 'Hc': -4, 'Hd': -5, 'Hi': -6}
def enc(key):
    if not key:
        return 0
    if key in PREFIX_NUM:
        return PREFIX_NUM[key]
    try:
        return int(key[1:])
    except ValueError:
        return 0
G_CODES = sorted(gram_g)
G_IDX = {c: i for i, c in enumerate(G_CODES)}
heb_text = json.load(open(os.path.join(HERE, '..', 'data', 'heb.json'), encoding='utf-8'))
def heb_tokens(t):
    out = []
    for x in re.split(r'[\s\u05BE]+', t):
        x = re.sub('[\u05C3\u05C0]', '', x)
        if re.search('[\u05D0-\u05EA]', x):
            out.append(x)
    return out

# ---------------------------------------------------------------- per boek
H_IDX = {}
render = collections.defaultdict(collections.Counter)
occ = collections.defaultdict(list)
stats = collections.Counter()
for bi, b in enumerate(books):
    ot = b['ot']
    s_out = []
    for c, n in enumerate(b['v'], 1):
        chap = []
        for v in range(1, n + 1):
            mine = sv[bi][c - 1][v - 1].split()
            stats['svtok'] += len(mine)
            theirs = stv_tokens(V.get(f"{b['id']}.{c}.{v}", ''), ot)
            sm = difflib.SequenceMatcher(None, [norm(t) for t, _ in theirs], [norm(t) for t in mine], autojunk=False)
            flat = []
            seen = set()
            for tag, i1, i2, j1, j2 in sm.get_opcodes():
                if tag == 'equal' or (tag == 'replace' and i2 - i1 == j2 - j1):
                    for k in range(i2 - i1):
                        keys = sorted(theirs[i1 + k][1])
                        if keys:
                            stats['tagged'] += 1
                        for key in keys:
                            flat += [j1 + k, enc(key)]
                            w = re.sub(r'[^\w\-]', '', mine[j1 + k])
                            if w:
                                w = w if w.isupper() and len(w) > 1 else w.lower()
                                render[key][w] += 1
                            if key not in seen:
                                seen.add(key)
                                occ[key].append((bi, c, v))
            chap.append(flat)
        s_out.append(chap)
    if ot:
        src = wlc_book(BOOKDEFS[bi][1])
    else:
        src = TRW[BOOKDEFS[bi][1]]
    o_out = []
    for c in range(1, max(src) + 1):
        vs = src.get(c, {})
        chap = []
        for v in range(1, (max(vs) if vs else 0) + 1):
            words = vs.get(v, [])
            if ot:
                flat = []
                for w in words:
                    flat += [enc(w[1]), H_IDX.setdefault(w[2], len(H_IDX))]
                toks = heb_tokens(heb_text[bi][c - 1][v - 1]) if c - 1 < len(heb_text[bi]) and v - 1 < len(heb_text[bi][c - 1]) else []
                if len(toks) != len(words):
                    flat.append('|'.join(w[0] for w in words))
                    stats['heb_surface_stored'] += 1
            else:
                flat = []
                for w in words:
                    flat += [enc(w[1]), G_IDX[w[2]]]
            chap.append(flat)
        o_out.append(chap)
    with open(os.path.join(OUT, 'w', f'{bi}.json'), 'w', encoding='utf-8') as f:
        json.dump({'s': s_out, 'o': o_out}, f, ensure_ascii=False, separators=(',', ':'))

# ---------------------------------------------------------------- woordenboek
def entry(key):
    if key in PREFIX_LEX:
        return list(PREFIX_LEX[key])
    e = (G if key[0] == 'G' else H).get(key)
    if not e:
        return None
    lemma = e.get('lemma', '')
    tl = e.get('translit') or e.get('xlit') or ''
    d = clean_def(e.get('strongs_def'))
    kd = clean_def(e.get('kjv_def'))
    if kd:
        d = (d + ' — KJV: ' + kd) if d else 'KJV: ' + kd
    return [lemma, tl, d]
lex = {'G': {}, 'H': {}}
keys = set(render) | set(occ) | set(PREFIX_LEX)
for bi in range(66):
    o = json.load(open(os.path.join(OUT, 'w', f'{bi}.json'), encoding='utf-8'))['o']
    lang = 'H' if books[bi]['ot'] else 'G'
    for ch in o:
        for flat in ch:
            nums = [x for x in flat if isinstance(x, int)][0::2]
            for n in nums:
                if n > 0:
                    keys.add(lang + str(n))
inv = {v: k for k, v in PREFIX_NUM.items()}
for key in sorted(keys):
    e = entry(key)
    if not e:
        continue
    refs = occ.get(key, [])
    top = [[w, n] for w, n in render[key].most_common(8)]
    lex[key[0]][str(enc(key))] = e + [top, len(refs), [x for r in refs[:60] for x in r]]
for lang in 'GH':
    with open(os.path.join(OUT, f'lex-{lang.lower()}.json'), 'w', encoding='utf-8') as f:
        json.dump(lex[lang], f, ensure_ascii=False, separators=(',', ':'))
H_CODES = sorted(H_IDX, key=H_IDX.get)
with open(os.path.join(OUT, 'gram.json'), 'w', encoding='utf-8') as f:
    json.dump({'g': [gram_g[c] for c in G_CODES], 'gc': G_CODES, 'h': [hebrew_gram(c) for c in H_CODES], 'hc': H_CODES}, f, ensure_ascii=False, separators=(',', ':'))
print(dict(stats), 'gekoppeld: %.1f%%' % (100 * stats['tagged'] / stats['svtok']), 'lex', len(lex['G']), len(lex['H']), 'gram', len(G_CODES), len(H_CODES))
