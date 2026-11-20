"""Supplement the official-card audit using observed WCMS fragment links.
Run after research-card-conditions.py finishes.
"""
import concurrent.futures as cf
import json,re,runpy,sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf-8')
HERE=Path(__file__).resolve().parent
api=runpy.run_path(str(HERE/'research-card-conditions.py'))
ROOT=api['ROOT'];fetch=api['fetch'];parse=api['document_lines'];extract=api['exclusions']
CARDS=api['CARDS']

def samsung(c):
    meta,raw=fetch(c['sourceUrl'])
    t=raw.decode('utf-8',errors='replace').replace('\\u002F','/')
    m=re.search(r'htmlList:\{feeUrl:.*?\}',t)
    if not m:return c['id'],[]
    paths=re.findall(r'(?:addServiceUrl|noticeUrl):"([^"]+\.html)"',m[0])
    paths+=re.findall(r'serviceUrl:"(/wcms/svc/[^"]+\.html)"',t)
    paths=list(dict.fromkeys(paths))
    result=[]
    for path in paths:
        url='https://static11.samsungcard.com'+path
        dm,db=fetch(url);lines,_=parse(dm,db);s,b,e=extract(lines)
        for ev in e:ev.update(sourceUrl=url,checkedAt=dm['checkedAt'],documentKind='officialWcms')
        result.append((s,b,e,{**dm,'kind':'officialWcms','textLines':len(lines),'discoveredFrom':c['sourceUrl']}))
    return c['id'],result

def main():
    path=ROOT/'data/card-research.json'
    arr=json.loads(path.read_text(encoding='utf-8'));mapping={r['id']:r for r in arr}
    cards=[c for c in CARDS if c['issuer']=='삼성카드']
    count=0
    with cf.ThreadPoolExecutor(max_workers=14) as pool:
        for ident,parts in pool.map(samsung,cards):
            r=mapping[ident]
            for s,b,e,d in parts:
                r['spendExclusions'].extend(s);r['benefitExclusions'].extend(b);r['evidence'].extend(e);r['documents'].append(d)
            count+=1
            if count%30==0:print('Samsung official fragments',count,'/',len(cards),flush=True)
    for r in arr:
        for key in ['spendExclusions','benefitExclusions']:
            r[key]=list(dict.fromkeys(r.get(key,[])))
            r[key+'Status']='source_excerpt' if r[key] else 'not_confirmed'
        r['status']='verified' if r['spendExclusions'] and r['benefitExclusions'] else 'partial' if r['spendExclusions'] or r['benefitExclusions'] else 'missing'
    path.write_text(json.dumps(arr,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'products':len(arr),'both':sum(r['status']=='verified' for r in arr),'spend':sum(bool(r['spendExclusions']) for r in arr),'benefit':sum(bool(r['benefitExclusions']) for r in arr)},ensure_ascii=False))

if __name__=='__main__':main()
