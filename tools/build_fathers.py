"""Kerkvaders per vers uit de Commentaries Database van Historical Christian Faith.

Bron (in SRC_DIR/cdb): https://github.com/HistoricalChristianFaith/Commentaries-Database
  - verzameling: publiek domein; citaten uit publiek-domeinbronnen: publiek domein
  - citaten zonder bron-URL (mogelijk 'fair use' uit moderne vertalingen) worden overgeslagen

Schrijft data/cf/<boek>.json: {"hfst:vers": [[vader, brontitel, citaat, url, soort, vanaf-tot], ...]}
  vader: index in FATHERS; soort: 'k' = klassieke vertaling (NPNF e.d.), 'h' = via historicalchristian.faith
De versnummers worden omgezet van de Engelse (KJV-)indeling naar de SV-indeling.
"""
import os, re, sys, json, tomllib
HERE = os.path.dirname(os.path.abspath(__file__))
SRC_DIR = os.environ.get('SRC_DIR', os.path.join(HERE, 'src'))
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, '..', 'data')
sys.path.insert(0, HERE)
from load import BOOKS as BOOKDEFS
from svmap import segments

FATHERS = [('Augustine of Hippo', 'Augustinus'), ('John Chrysostom', 'Johannes Chrysostomus')]
HCF_NAMES = ['Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy', 'Joshua', 'Judges', 'Ruth', '1 Samuel', '2 Samuel',
             '1 Kings', '2 Kings', '1 Chronicles', '2 Chronicles', 'Ezra', 'Nehemiah', 'Esther', 'Job', 'Psalms', 'Proverbs',
             'Ecclesiastes', 'Song of Solomon', 'Isaiah', 'Jeremiah', 'Lamentations', 'Ezekiel', 'Daniel', 'Hosea', 'Joel', 'Amos',
             'Obadiah', 'Jonah', 'Micah', 'Nahum', 'Habakkuk', 'Zephaniah', 'Haggai', 'Zechariah', 'Malachi',
             'Matthew', 'Mark', 'Luke', 'John', 'Acts', 'Romans', '1 Corinthians', '2 Corinthians', 'Galatians', 'Ephesians',
             'Philippians', 'Colossians', '1 Thessalonians', '2 Thessalonians', '1 Timothy', '2 Timothy', 'Titus', 'Philemon',
             'Hebrews', 'James', '1 Peter', '2 Peter', '1 John', '2 John', '3 John', 'Jude', 'Revelation']
BI = {n: i for i, n in enumerate(HCF_NAMES)}

books = json.load(open(os.path.join(HERE, '..', 'data', 'books.json'), encoding='utf-8'))

# KJV-plaats -> SV-plaats, via de markeringen in DutSVVA (zoals in build_data.py)
A = json.load(open(os.path.join(SRC_DIR, 'sm', 'formats', 'json', 'DutSVVA.json'), encoding='utf-8'))
Aby = {b['name']: b for b in A['books']}
kjv2sv = {}
for bi, bd in enumerate(BOOKDEFS):
    for ch in Aby[bd[2]]['chapters']:
        for v in ch['verses']:
            segs = segments(v['text'], ch['chapter'], v['verse'])
            if segs:
                pick = segs[-1] if bd[0] == 'Ps' else segs[0]
                kjv2sv[(bi, ch['chapter'], v['verse'])] = (pick[0], pick[1])

def to_sv(bi, c, v):
    r = kjv2sv.get((bi, c, v), (c, v))
    nv = books[bi]['v']
    if 1 <= r[0] <= len(nv) and 1 <= r[1] <= nv[r[0] - 1]:
        return r
    if 1 <= c <= len(nv) and 1 <= v <= nv[c - 1]:
        return (c, v)
    return None

def clean(q):
    q = q.replace('\r', '').strip()
    q = re.sub(r'[ \t]+', ' ', q)
    q = re.sub(r'\n{3,}', '\n\n', q)
    return q

out = {}
stats = {'files': 0, 'quotes': 0, 'kept': 0, 'no_url': 0, 'unmapped': 0, 'other_books': 0}
for fi, (folder, _) in enumerate(FATHERS):
    d = os.path.join(SRC_DIR, 'cdb', folder)
    for f in sorted(os.listdir(d)):
        m = re.match(r'^(.*?) (\d+)_(\d+)(?:-(\d+)(?:_(\d+))?)?\.toml$', f)
        if not m:
            continue
        name, c, v = m.group(1), int(m.group(2)), int(m.group(3))
        if name not in BI:
            stats['other_books'] += 1
            continue
        bi = BI[name]
        rng = ''
        if m.group(5):
            rng = f'{c}:{v}-{m.group(4)}:{m.group(5)}'
        elif m.group(4):
            rng = f'{v}-{m.group(4)}'
        stats['files'] += 1
        try:
            data = tomllib.load(open(os.path.join(d, f), 'rb'))
        except Exception:
            continue
        sv = to_sv(bi, c, v)
        if not sv:
            stats['unmapped'] += 1
            continue
        key = f'{sv[0]}:{sv[1]}'
        for e in data.get('commentary', []):
            stats['quotes'] += 1
            url = (e.get('source_url') or '').strip()
            q = clean(e.get('quote') or '')
            if not url or not q:
                stats['no_url'] += 1
                continue
            kind = 'h' if 'historicalchristian.faith' in url else 'k'
            title = (e.get('source_title') or '').strip()
            lst = out.setdefault(bi, {}).setdefault(key, [])
            if any(x[2] == q for x in lst):
                continue
            lst.append([fi, title, q, url, kind, rng])
            stats['kept'] += 1

os.makedirs(os.path.join(OUT, 'cf'), exist_ok=True)
for f in os.listdir(os.path.join(OUT, 'cf')):
    os.remove(os.path.join(OUT, 'cf', f))
index = {}
for bi, verses in out.items():
    with open(os.path.join(OUT, 'cf', f'{bi}.json'), 'w', encoding='utf-8') as fh:
        json.dump(verses, fh, ensure_ascii=False, separators=(',', ':'))
    # per hoofdstuk: welke verzen hebben iets (voor het bolletje in de leestekst)
    idx = {}
    for k, lst in verses.items():
        c, v = k.split(':')
        idx.setdefault(c, []).append(int(v))
    index[bi] = {c: sorted(set(vs)) for c, vs in idx.items()}
with open(os.path.join(OUT, 'cf-index.json'), 'w', encoding='utf-8') as fh:
    json.dump({'fathers': [n for _, n in FATHERS], 'v': index}, fh, separators=(',', ':'))
print(stats, 'boeken', len(out))
