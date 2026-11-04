"""Kanttekeningen en verwijzingen uit STV.osis.xml (jajpater/statenvertaling, CC0).

Schrijft:
  data/kt/<boekindex>.json  per boek: hoofdstukken -> verzen -> 0 of lijst kanttekeningen
                            kanttekening = [positie, aantal woorden trefwoord, trefwoord, tekst, verwijzingen]
                            tekst bevat {{n}} op de plek van verwijzing n
                            verwijzing = [boek, hfst, vers, hfst2, vers2]  (vers 0 = heel hoofdstuk)
  data/refgraph.json        per hoofdstuk: naar welke andere hoofdstukken hoe vaak verwezen wordt
"""
import os, re, sys, json, difflib, unicodedata
HERE = os.path.dirname(os.path.abspath(__file__))
SRC_DIR = os.environ.get('SRC_DIR', os.path.join(HERE, 'src'))
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, '..', 'data')
os.makedirs(os.path.join(OUT, 'kt'), exist_ok=True)

books = json.load(open(os.path.join(HERE, '..', 'data', 'books.json'), encoding='utf-8'))
sv = json.load(open(os.path.join(HERE, '..', 'data', 'sv.json'), encoding='utf-8'))
ids = [b['id'] for b in books]

CODES = {
    'Gen': 'Gen', 'en': 'Gen', 'Exo': 'Exod', 'Lev': 'Lev', 'Num': 'Num', 'Deu': 'Deut', 'Jos': 'Josh', 'os': 'Josh',
    'Jdg': 'Judg', 'Rth': 'Ruth', '1Sa': '1Sam', '2Sa': '2Sam', '1Ki': '1Kgs', '2Ki': '2Kgs', '1Ch': '1Chr',
    '2Ch': '2Chr', 'Ezr': 'Ezra', 'Neh': 'Neh', 'Est': 'Esth', 'Job': 'Job', 'ob': 'Job', 'Psa': 'Ps', 'Pro': 'Prov',
    'Ecc': 'Eccl', 'Son': 'Song', 'Isa': 'Isa', 'Jer': 'Jer', 'Lam': 'Lam', 'Eze': 'Ezek', 'Dan': 'Dan',
    'Hos': 'Hos', 'Joe': 'Joel', 'Joel': 'Joel', 'Amo': 'Amos', 'Oba': 'Obad', 'Jon': 'Jonah', 'Mic': 'Mic',
    'Nah': 'Nah', 'Hab': 'Hab', 'Zep': 'Zeph', 'Hag': 'Hag', 'Zec': 'Zech', 'Zech': 'Zech', 'Mal': 'Mal',
    'Mat': 'Matt', 'Mar': 'Mark', 'Luk': 'Luke', 'Joh': 'John', 'joh': 'John', 'Act': 'Acts', 'Acts': 'Acts',
    'Rom': 'Rom', '1Co': '1Cor', '2Co': '2Cor', 'Gal': 'Gal', 'Eph': 'Eph', 'Phi': 'Phil', 'Col': 'Col',
    '1Th': '1Thess', '2Th': '2Thess', '1Ti': '1Tim', '2Ti': '2Tim', 'Tit': 'Titus', 'Phm': 'Phlm', 'Heb': 'Heb',
    'Jam': 'Jas', '1Pe': '1Pet', '2Pe': '2Pet', '1Jo': '1John', '2Jo': '2John', '3Jo': '3John', 'Jud': 'Jude',
    'Rev': 'Rev',
}
for k in ids:
    CODES.setdefault(k, k)

def nverses(bi, c):
    v = books[bi]['v']
    return v[c - 1] if 1 <= c <= len(v) else 0

def parse_ref(r):
    """'Rom.5.6', 'Joh.11.51-52', 'Pro.8.22-Pro.8.23', 'Psa.23', '3Jo.9-3Jo.10' -> [bi,c,v,c2,v2] of None"""
    def one(p, book=None):
        parts = p.split('.')
        b = CODES.get(parts[0]) if not book or parts[0] in CODES else book
        nums = [int(x) for x in parts[1:] if x.isdigit()] if parts[0] in CODES else [int(x) for x in parts if x.isdigit()]
        if not b or b not in ids or not nums:
            return None
        bi = ids.index(b)
        if len(nums) == 1:
            if len(books[bi]['v']) == 1:
                return bi, 1, nums[0]
            return bi, nums[0], 0
        return bi, nums[0], nums[1]
    if '-' in r:
        a, b = r.split('-', 1)
        s = one(a)
        if not s:
            return None
        if b.isdigit():
            e = (s[0], s[1], int(b)) if s[2] else (s[0], int(b), 0)
        else:
            e = one(b, ids[s[0]])
            if not e or e[0] != s[0]:
                e = s
    else:
        s = one(r); e = s
        if not s:
            return None
    bi, c, v = s
    _, c2, v2 = e
    if not (1 <= c <= len(books[bi]['v'])) or (v and not (1 <= v <= nverses(bi, c))):
        return None
    if not (1 <= c2 <= len(books[bi]['v'])) or (v2 and not (1 <= v2 <= nverses(bi, c2))):
        c2, v2 = c, v
    if (c2, v2) < (c, v):
        c2, v2 = c, v
    return [bi, c, v, c2, v2]

def norm(t):
    t = unicodedata.normalize('NFKD', t.lower())
    return re.sub(r'[^a-z0-9]', '', t)

def plain(x):
    return re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', x)).strip()

s = open(os.path.join(SRC_DIR, 'stv', 'STV.osis.xml'), encoding='utf-8').read()
V = {m.group(1): m.group(2) for m in re.finditer(r'<verse osisID="([^"]+)">(.*?)</verse>', s, re.S)}

graph = {}
stats = {'notes': 0, 'refs': 0, 'badrefs': 0, 'placed': 0}
for bi, b in enumerate(books):
    out = []
    for c, n in enumerate(b['v'], 1):
        chap = []
        for v in range(1, n + 1):
            xml = V.get(f"{b['id']}.{c}.{v}", '')
            notes = []
            # woordposities van de kanttekeningen in de OSIS-tekst
            pieces = re.split(r'(<note[^>]*>.*?</note>)', xml, flags=re.S)
            otoks = []
            for p in pieces:
                if p.startswith('<note'):
                    body = re.sub(r'^<note[^>]*>|</note>$', '', p, flags=re.S)
                    cwm = re.search(r'<catchWord>(.*?)</catchWord>', body, re.S)
                    cw = plain(cwm.group(1)) if cwm else ''
                    body = re.sub(r'<catchWord>.*?</catchWord>', '', body, flags=re.S)
                    refs = []
                    def repl(m):
                        r = parse_ref(m.group(1))
                        stats['refs'] += 1
                        if not r:
                            stats['badrefs'] += 1
                            return m.group(2)
                        refs.append(r)
                        return '{{%d}}' % (len(refs) - 1)
                    body = re.sub(r'<reference osisRef="([^"]+)">(.*?)</reference>', repl, body, flags=re.S)
                    text = plain(body)
                    text = re.sub(r'\s+([,.;:])', r'\1', text)
                    notes.append([len(otoks), len(cw.split()), cw, text, refs])
                else:
                    otoks += plain(p).split()
            if not notes:
                chap.append(0)
                continue
            # trefwoord opzoeken in de SV-tekst van de app (kanttekeningen staan in de bron achter het vers)
            mine = [norm(t) for t in sv[bi][c - 1][v - 1].split()]
            last = 0
            for nt in notes:
                cw = [x for x in (norm(t) for t in nt[2].split()) if x]
                pos = -1
                if cw:
                    L = len(cw)
                    starts = list(range(last, len(mine) - L + 1)) + list(range(0, min(last, len(mine) - L + 1)))
                    for i in starts:
                        if mine[i:i + L] == cw:
                            pos = i; break
                    if pos < 0:
                        best, bi_ = 0.0, -1
                        for i in range(0, max(1, len(mine) - L + 1)):
                            r = difflib.SequenceMatcher(None, ' '.join(cw), ' '.join(mine[i:i + L])).ratio()
                            if r > best:
                                best, bi_ = r, i
                        if best >= 0.75:
                            pos = bi_
                if pos >= 0:
                    nt[0] = pos + len(cw)
                    nt[1] = len(cw)
                    last = pos + 1
                    stats['placed'] += 1
                else:
                    nt[0] = -1
                    nt[1] = 0
                for r in nt[4]:
                    if r[0] == bi and r[1] == c:
                        continue
                    key = f'{bi}:{c}'
                    tk = (r[0], r[1])
                    graph.setdefault(key, {}).setdefault(tk, 0)
                    graph[key][tk] += 1
            stats['notes'] += len(notes)
            chap.append(notes)
        out.append(chap)
    with open(os.path.join(OUT, 'kt', f'{bi}.json'), 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, separators=(',', ':'))

g2 = {k: sorted([[a, b, n] for (a, b), n in d.items()], key=lambda x: -x[2]) for k, d in graph.items()}
with open(os.path.join(OUT, 'refgraph.json'), 'w', encoding='utf-8') as f:
    json.dump(g2, f, separators=(',', ':'))
print(stats)
