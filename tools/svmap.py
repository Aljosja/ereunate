import os
HERE = os.path.dirname(os.path.abspath(__file__))
SRC_DIR = os.environ.get('SRC_DIR', os.path.join(HERE, 'src'))
import json, re
SRC=SRC_DIR + '/sm/formats/json/'
MK=re.compile(r'\[(\d+):(\d+)\]')
def segments(text, ch, vs):
    """split DutSVVA slot text into [(ch,v,text)]"""
    out=[]; pos=0; cur=(ch,vs)
    for m in MK.finditer(text):
        seg=text[pos:m.start()].strip()
        if seg: out.append((cur[0],cur[1],seg))
        mc=int(m.group(1))
        if abs(mc-ch)>1: mc=ch
        cur=(mc,int(m.group(2))); pos=m.end()
    seg=text[pos:].strip()
    if seg: out.append((cur[0],cur[1],seg))
    return out
def sva_native(bookname):
    d=json.load(open(SRC+'DutSVVA.json',encoding='utf-8'))
    b=[x for x in d['books'] if x['name']==bookname][0]
    nat={}
    for c in b['chapters']:
        for v in c['verses']:
            for C,V,t in segments(v['text'],c['chapter'],v['verse']):
                nat.setdefault(C,{}).setdefault(V,[]).append(t)
    return nat
