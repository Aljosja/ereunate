import os
HERE = os.path.dirname(os.path.abspath(__file__))
SRC_DIR = os.environ.get('SRC_DIR', os.path.join(HERE, 'src'))
import json, re, unicodedata, difflib, sys
sys.path.insert(0, HERE)
from load import BOOKS
from svmap import segments
SRC=SRC_DIR + '/sm/formats/json/'
A=json.load(open(SRC+'DutSVVA.json',encoding='utf-8')); B=json.load(open(SRC+'DutSVV.json',encoding='utf-8'))
Aby={b['name']:b for b in A['books']}; Bby={b['name']:b for b in B['books']}
def norm(t):
    t=unicodedata.normalize('NFKD',t.lower())
    return re.sub(r'[^a-z0-9]','',t)
def clean_b(t):
    t=re.sub(r'\[\([^)]*\)\s*','',t); t=t.replace(']','').replace('[','')
    return re.sub(r'\s+',' ',t).strip()
def build_book(name):
    # native verses from A, in stream order
    order=[]; nat={}
    for c in Aby[name]['chapters']:
        for v in c['verses']:
            for C,V,t in segments(v['text'],c['chapter'],v['verse']):
                if (C,V) not in nat: nat[(C,V)]=[]; order.append((C,V))
                nat[(C,V)].append(t)
    atoks=[]; starts=[]
    for k in order:
        starts.append(len(atoks))
        atoks+= ' '.join(nat[k]).split()
    btoks=[]
    for c in Bby[name]['chapters']:
        for v in c['verses']:
            btoks+=clean_b(v['text']).split()
    an=[norm(x) for x in atoks]; bn=[norm(x) for x in btoks]
    sm=difflib.SequenceMatcher(None,an,bn,autojunk=False)
    # map each a index -> b index
    amap=[None]*(len(an)+1)
    for tag,i1,i2,j1,j2 in sm.get_opcodes():
        for k in range(i1,i2):
            if tag=='equal': amap[k]=j1+(k-i1)
            else: amap[k]=j1+min(k-i1,max(j2-j1-1,0)) if j2>j1 else j1
    amap[len(an)]=len(bn)
    out={}
    bounds_dummy=None
    bounds=[amap[s] for s in starts]+[len(bn)]
    for i,(C,V) in enumerate(order):
        s,e=bounds[i],bounds[i+1]
        out.setdefault(C,{})[V]=' '.join(btoks[s:e])
    # prefer B verbatim where chapter structure is identical
    for c in Bby[name]['chapters']:
        ch=c['chapter']; raw=[v['text'] for v in c['verses']]
        bv=[clean_b(t) for t in raw]
        if ch in out and len(out[ch])==len(bv) and all(bv) and not any('[' in t or ']' in t for t in raw):
            out[ch]={i+1:t for i,t in enumerate(bv)}
    out={c:dict(sorted(out[c].items())) for c in sorted(out)}
    return out, sm.ratio()
if __name__=='__main__':
    res={}; bad=[]
    for bid,_,nm,_,_ in BOOKS:
        out,r=build_book(nm); res[bid]=out
        # validation vs B where counts equal
        for c in Bby[nm]['chapters']:
            ch=c['chapter']; bv=[clean_b(v['text']) for v in c['verses']]
            nv=out.get(ch,{})
            if len(nv)==len(bv) and all(bv):
                for i,t in enumerate(bv):
                    if nv.get(i+1)!=t: bad.append((bid,ch,i+1))
        print(bid, round(r,4), file=sys.stderr)
    print('mismatch in equal-count chapters:',len(bad), bad[:20])
    json.dump(res,open(os.path.join(HERE, 'sv_native.json'),'w',encoding='utf-8'),ensure_ascii=False)
