import os
HERE = os.path.dirname(os.path.abspath(__file__))
SRC_DIR = os.environ.get('SRC_DIR', os.path.join(HERE, 'src'))
import json, re, unicodedata, xml.etree.ElementTree as ET
SRC=SRC_DIR
# Canonical order: (id, osis WLC/TR, SV json name, Dutch name, abbr)
BOOKS=[
('Gen','Gen','Genesis','Genesis','Gen'),('Exod','Exod','Exodus','Exodus','Ex'),('Lev','Lev','Leviticus','Leviticus','Lev'),
('Num','Num','Numbers','Numeri','Num'),('Deut','Deut','Deuteronomy','Deuteronomium','Deut'),('Josh','Josh','Joshua','Jozua','Joz'),
('Judg','Judg','Judges','Richteren','Richt'),('Ruth','Ruth','Ruth','Ruth','Ruth'),('1Sam','1Sam','I Samuel','1 Samuël','1 Sam'),
('2Sam','2Sam','II Samuel','2 Samuël','2 Sam'),('1Kgs','1Kgs','I Kings','1 Koningen','1 Kon'),('2Kgs','2Kgs','II Kings','2 Koningen','2 Kon'),
('1Chr','1Chr','I Chronicles','1 Kronieken','1 Kron'),('2Chr','2Chr','II Chronicles','2 Kronieken','2 Kron'),('Ezra','Ezra','Ezra','Ezra','Ezra'),
('Neh','Neh','Nehemiah','Nehemia','Neh'),('Esth','Esth','Esther','Esther','Est'),('Job','Job','Job','Job','Job'),
('Ps','Ps','Psalms','Psalmen','Ps'),('Prov','Prov','Proverbs','Spreuken','Spr'),('Eccl','Eccl','Ecclesiastes','Prediker','Pred'),
('Song','Song','Song of Solomon','Hooglied','Hoogl'),('Isa','Isa','Isaiah','Jesaja','Jes'),('Jer','Jer','Jeremiah','Jeremia','Jer'),
('Lam','Lam','Lamentations','Klaagliederen','Klaagl'),('Ezek','Ezek','Ezekiel','Ezechiël','Ez'),('Dan','Dan','Daniel','Daniël','Dan'),
('Hos','Hos','Hosea','Hosea','Hos'),('Joel','Joel','Joel','Joël','Joël'),('Amos','Amos','Amos','Amos','Am'),
('Obad','Obad','Obadiah','Obadja','Ob'),('Jonah','Jonah','Jonah','Jona','Jona'),('Mic','Mic','Micah','Micha','Mi'),
('Nah','Nah','Nahum','Nahum','Nah'),('Hab','Hab','Habakkuk','Habakuk','Hab'),('Zeph','Zeph','Zephaniah','Zefanja','Zef'),
('Hag','Hag','Haggai','Haggaï','Hag'),('Zech','Zech','Zechariah','Zacharia','Zach'),('Mal','Mal','Malachi','Maleachi','Mal'),
('Matt','Matt','Matthew','Mattheüs','Matt'),('Mark','Mark','Mark','Markus','Mark'),('Luke','Luke','Luke','Lukas','Luk'),
('John','John','John','Johannes','Joh'),('Acts','Acts','Acts','Handelingen','Hand'),('Rom','Rom','Romans','Romeinen','Rom'),
('1Cor','1Cor','I Corinthians','1 Korinthe','1 Kor'),('2Cor','2Cor','II Corinthians','2 Korinthe','2 Kor'),('Gal','Gal','Galatians','Galaten','Gal'),
('Eph','Eph','Ephesians','Efeze','Ef'),('Phil','Phil','Philippians','Filippenzen','Fil'),('Col','Col','Colossians','Kolossenzen','Kol'),
('1Thess','1Thess','I Thessalonians','1 Thessalonicenzen','1 Thess'),('2Thess','2Thess','II Thessalonians','2 Thessalonicenzen','2 Thess'),
('1Tim','1Tim','I Timothy','1 Timotheüs','1 Tim'),('2Tim','2Tim','II Timothy','2 Timotheüs','2 Tim'),('Titus','Titus','Titus','Titus','Tit'),
('Phlm','Phlm','Philemon','Filémon','Filem'),('Heb','Heb','Hebrews','Hebreeën','Hebr'),('Jas','Jas','James','Jakobus','Jak'),
('1Pet','1Pet','I Peter','1 Petrus','1 Petr'),('2Pet','2Pet','II Peter','2 Petrus','2 Petr'),('1John','1John','I John','1 Johannes','1 Joh'),
('2John','2John','II John','2 Johannes','2 Joh'),('3John','3John','III John','3 Johannes','3 Joh'),('Jude','Jude','Jude','Judas','Jud'),
('Rev','Rev','Revelation of John','Openbaring','Openb'),
]
def load_sv():
    d=json.load(open(f'{SRC}/sm/formats/json/DutSVV.json',encoding='utf-8'))
    by={b['name']:b for b in d['books']}
    out={}
    for bid,_,svn,_,_ in BOOKS:
        b=by[svn]; chs={}
        for c in b['chapters']:
            chs[c['chapter']]={v['verse']:v['text'].strip() for v in c['verses']}
        out[bid]=chs
    return out
def load_tr():
    d=json.load(open(f'{SRC}/htr/data/gnt.nested.json',encoding='utf-8'))
    out={}
    for b in d:
        chs={}
        for c in b['chapters']:
            chs[c['chapter']]={v['verse']:v['greek_text'].strip() for v in c['verses']}
        out[b['book_name_osis']]=chs
    return out
NS='{http://www.bibletechnologies.net/2003/OSIS/namespace}'
def heb_text(el):
    parts=[]
    def walk(e):
        tag=e.tag.replace(NS,'')
        if tag=='note': 
            if e.tail: parts.append(e.tail)
            return
        if tag=='seg' and e.get('type') in ('x-pe','x-samekh'):
            if e.tail: parts.append(e.tail)
            return
        if e.text: parts.append(e.text)
        for ch in e: walk(ch)
        if e is not el and e.tail: parts.append(e.tail)
    walk(el)
    s=''.join(parts).replace('/','')
    s=re.sub(r'\s+',' ',s).strip()
    s=s.replace(' ־','־').replace('־ ','־').replace(' ׃','׃')
    return s
def load_wlc():
    out={}
    for bid,osis,_,_,_ in BOOKS[:39]:
        root=ET.parse(f'{SRC}/wlc/wlc/{osis}.xml').getroot()
        chs={}
        for v in root.iter(NS+'verse'):
            _,c,n=v.get('osisID').split('.')
            chs.setdefault(int(c),{})[int(n)]=heb_text(v)
        out[bid]=chs
    return out
