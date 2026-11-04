"""Bouwt de datasets voor ereunate: sv.json, grc.json, heb.json, map.json, books.json."""
import os
HERE = os.path.dirname(os.path.abspath(__file__))
SRC_DIR = os.environ.get('SRC_DIR', os.path.join(HERE, 'src'))
import json, re, sys, unicodedata, os
sys.path.insert(0, HERE)
from load import BOOKS, load_tr, load_wlc
from svmap import segments

OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, '..', 'data')
os.makedirs(OUT, exist_ok=True)
SRC = SRC_DIR

sv = json.load(open(os.path.join(HERE, 'sv_native.json'), encoding='utf-8'))
sv = {b: {int(c): {int(v): t for v, t in vs.items()} for c, vs in chs.items()} for b, chs in sv.items()}
tr = load_tr()
wl = load_wlc()

# --- native SV -> KJV slot(s), from DutSVVA markers
A = json.load(open(f'{SRC}/sm/formats/json/DutSVVA.json', encoding='utf-8'))
Aby = {b['name']: b for b in A['books']}
def native_to_kjv(name):
    m = {}
    for c in Aby[name]['chapters']:
        for v in c['verses']:
            for C, V, _ in segments(v['text'], c['chapter'], v['verse']):
                lst = m.setdefault((C, V), [])
                if (c['chapter'], v['verse']) not in lst:
                    lst.append((c['chapter'], v['verse']))
    return m

# --- KJV -> WLC from the OSHB verse map
vm = open(f'{SRC}/wlc/wlc/VerseMap.xml', encoding='utf-8').read()
kjv2wlc = {}
remapped_wlc = set()
for w, k in re.findall(r'<verse wlc="([^"]+)" kjv="([^"]+)"', vm):
    w = w.split('!')[0]; k = k.split('!')[0]
    wb, wc, wv = w.split('.'); kb, kc, kv = k.split('.')
    lst = kjv2wlc.setdefault((kb, int(kc), int(kv)), [])
    if (int(wc), int(wv)) not in lst:
        lst.append((int(wc), int(wv)))

def strip_heb(t):
    # vowels houden, cantillatie en meteg weg
    t = re.sub('[֑-ֽ֯]', '', t)
    return re.sub(r'\s+', ' ', t).strip()

books_meta = []
sv_out, grc_out, heb_out, mp = [], [], [], {}
for i, (bid, osis, _, nl, abbr) in enumerate(BOOKS):
    ot = i < 39
    chs = sv[bid]
    nch = max(chs)
    sv_out.append([[chs[c][v] for v in range(1, len(chs[c]) + 1)] for c in range(1, nch + 1)])
    books_meta.append({'id': bid, 'name': nl, 'abbr': abbr, 'ot': ot,
                       'v': [len(chs[c]) for c in range(1, nch + 1)]})
    orig = wl[bid] if ot else tr[bid]
    onch = max(orig)
    arr = []
    for c in range(1, onch + 1):
        vs = orig.get(c, {})
        arr.append([(strip_heb(vs[v]) if ot else vs[v]) for v in range(1, len(vs) + 1)])
    (heb_out if ot else grc_out).append(arr)
    (grc_out if ot else heb_out).append(None)

    # mapping SV -> origineel, alleen voor hoofdstukken met afwijkende telling
    n2k = native_to_kjv(BOOKS[i][2])
    bm = {}
    for c in range(1, nch + 1):
        if len(chs[c]) == len(orig.get(c, {})):
            continue
        for v in range(1, len(chs[c]) + 1):
            refs = []
            for kc, kv in n2k.get((c, v), [(c, v)]):
                if ot:
                    tgt = kjv2wlc.get((bid, kc, kv), [(kc, kv)])
                else:
                    tgt = [(kc, kv)]
                for r in tgt:
                    if r not in refs and r[1] <= len(orig.get(r[0], {})):
                        refs.append(r)
            if refs != [(c, v)]:
                bm[f'{c}:{v}'] = [f'{a}:{b}' for a, b in refs]
    if bm:
        mp[i] = bm

def dump(name, obj):
    with open(os.path.join(OUT, name), 'w', encoding='utf-8') as f:
        json.dump(obj, f, ensure_ascii=False, separators=(',', ':'))
    print(name, os.path.getsize(os.path.join(OUT, name)) // 1024, 'KB')

dump('books.json', books_meta)
dump('sv.json', sv_out)
dump('grc.json', grc_out)
dump('heb.json', heb_out)
dump('map.json', mp)

# --- controle: elke originele vers in afwijkende hoofdstukken gedekt?
missing = []
for i, (bid, *_rest) in enumerate(BOOKS):
    ot = i < 39
    orig = wl[bid] if ot else tr[bid]
    chs = sv[bid]
    covered = set()
    for c in chs:
        for v in chs[c]:
            for r in mp.get(i, {}).get(f'{c}:{v}', [f'{c}:{v}']):
                a, b = map(int, r.split(':'))
                covered.add((a, b))
    for c in orig:
        for v in orig[c]:
            if (c, v) not in covered:
                missing.append((bid, c, v))
print('originele verzen zonder SV-koppeling:', len(missing), missing[:30])
print('SV-verzen met afwijkende koppeling:', sum(len(x) for x in mp.values()))
