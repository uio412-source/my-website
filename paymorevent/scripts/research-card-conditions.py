"""Fetch official card documents; retain contextual exclusion evidence per product.

Never supplies issuer-wide defaults or treats missing conditions as no exclusions.
Run with --sample for one product per issuer, or no option for the entire catalog.
"""
from ensure_card_source import ensure_card_data
ensure_card_data()
import concurrent.futures as cf
import hashlib, io, json, re, sys, threading, time, urllib.request
from collections import Counter
from pathlib import Path
from lxml import html

sys.stdout.reconfigure(encoding='utf-8')
ROOT=Path(__file__).resolve().parent.parent
CACHE=ROOT/'scripts'/'card-research-cache'
CACHE.mkdir(exist_ok=True)
from datetime import datetime
from zoneinfo import ZoneInfo
CHECKED=datetime.now(ZoneInfo('Asia/Seoul')).date().isoformat()
CARDS=json.loads((ROOT/'data/cards.json').read_text(encoding='utf-8'))
UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/132.0.0.0 Safari/537.36'

def compact(s):return re.sub(r'\s+',' ',s or '').strip()
def fetch(url):
    key=hashlib.sha256(url.encode()).hexdigest()
    meta=CACHE/(key+'.json'); body=CACHE/(key+'.bin')
    if meta.exists():
        d=json.loads(meta.read_text(encoding='utf-8'))
        if d.get('checkedAt')==CHECKED and not d.get('error') and body.exists():return d,body.read_bytes()
    try:
        with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':UA,'Referer':url}),timeout=18) as r:
            raw=r.read(8_000_000)
            d={'url':url,'resolvedUrl':r.url,'httpStatus':r.status,'contentType':r.headers.get('Content-Type',''),'checkedAt':CHECKED,'bytes':len(raw)}
        body.write_bytes(raw)
    except Exception as e:d={'url':url,'checkedAt':CHECKED,'error':str(e)};raw=b''
    meta.write_text(json.dumps(d,ensure_ascii=False),encoding='utf-8')
    return d,raw

def document_lines(meta,raw):
    if not raw:return [],[]
    if raw.startswith(b'%PDF') or 'application/pdf' in meta.get('contentType',''):
        try:
            from pypdf import PdfReader
            doc=PdfReader(io.BytesIO(raw))
            text='\n'.join(p.extract_text() or '' for p in doc.pages)
            return [compact(x) for x in text.splitlines() if compact(x)],[]
        except Exception as e:return [],[{'parseError':str(e)}]
    ct=meta.get('contentType','')
    enc=re.search(r'charset=([^; ]+)',ct,re.I)
    enc=enc.group(1) if enc else None
    if not enc:
        m=re.search(br'charset=["\s]*([\w-]+)',raw[:5000],re.I)
        enc=m.group(1).decode() if m else 'utf-8'
    try:text=raw.decode(enc,errors='replace')
    except LookupError:text=raw.decode('utf-8',errors='replace')
    root=html.fromstring(text)
    scripts=[(e.get('src'),e.text or '') for e in root.xpath('//script')]
    for e in root.xpath('//script|//style|//noscript|//header|//footer|//nav'):e.drop_tree()
    for e in root.xpath('//br'):e.tail='\n'+(e.tail or '')
    # Block boundaries retain a complete heading and each bullet rather than flattening
    # the entire document into an ambiguous single string.
    for e in root.iter():
        if e.tag in ['p','li','dt','dd','h1','h2','h3','h4','h5','tr','div','section','article']:
            e.tail='\n'+(e.tail or '')
            if e.text:e.text='\n'+e.text
    lines=[compact(x) for x in root.text_content().splitlines() if compact(x)]
    return lines,scripts

SPEND=re.compile(r'(?:전월.{0,100}(?:제외|미포함)|전월.*(?:금액|실적).*산정.*제외|(?:실적|실적산정|실적 산정).{0,60}(?:제외|미포함))')
BENEFIT=re.compile(r'(?:(?:할인|적립|캐시백|서비스|혜택|포인트|마일리지)(?:[()（）/·가-힣A-Za-z ]{0,18})(?:제외 대상|제외대상|제외 항목|제외항목|제외|대상에서 제외)|(?:할인|적립).{0,40}(?:이용금액은|구매금액은).{0,10}제외|(?:할인|적립).{0,20}(?:적용되지 않습니다|제공되지 않습니다|적립되지 않습니다))')
STOP=re.compile(r'^(?:연회비|발급대상|발급 대상|카드발급|유의사항|유의 사항|서비스 제공 조건|혜택 안내|공통 유의|기타 안내|준법|심의|서비스 제공|전월 이용|전월 실적|적립 제외|할인 제외|실적 제외)')

def exclusions(lines):
    spend=[];benefit=[];evidence=[]
    for i,line in enumerate(lines):
        if re.search(r'부가서비스.*(?:변경|축소)|연회비 반환|연회비 반환 금액|반환 금액에서 제외',line):continue
        contextual_benefit=bool('제외' in line and re.search(r'할인|적립|캐시백|상품권|선불|동물병원|무이자|결합상품|대리점|인앱|임대매장',line))
        typ='spend' if SPEND.search(line) else 'benefit' if BENEFIT.search(line) or contextual_benefit else None
        if not typ:continue
        # Do not interpret one transaction's exclusion as an exhaustive policy.
        heading=bool(re.search(r'(?:전월|실적|할인|적립|캐시백).*(?:제외 대상|제외대상|제외 항목|제외항목|제외 매출|제외매출|제외 기준)|제외.*(?:대상|항목|기준|이용금액)',line))
        excerpt=[line]
        if heading and len(line)<85:
            for following in lines[i+1:i+17]:
                if re.search(r'^(?:기타 기준|카드 이용 유의사항|해외 결제 이용 안내|서비스 제공 기준)',following):break
                if STOP.search(following) or (len(following)<70 and re.search(r'(?:서비스|할인|적립).*(?:안내|제공|한도|기준)$',following)):break
                excerpt.append(following)
                if sum(map(len,excerpt))>2200:break
        full=compact(' '.join(excerpt))
        if len(full)>15 and full not in (spend if typ=='spend' else benefit):
            (spend if typ=='spend' else benefit).append(full)
            evidence.append({'field':'spendExclusions' if typ=='spend' else 'benefitExclusions','excerpt':full,'line':i+1,'isFullPolicySection':heading})
    return spend,benefit,evidence

def research(c):
    documents=[];se=[];be=[];ev=[]
    for url,kind in [(c['sourceUrl'],'productPage'),(c.get('termsUrl'),'terms')]:
        if not url:continue
        meta,raw=fetch(url)
        lines,scripts=document_lines(meta,raw)
        s,b,e=exclusions(lines)
        documents.append({**meta,'kind':kind,'textLines':len(lines),'spendSections':len(s),'benefitSections':len(b),**({'parseError':scripts[0]['parseError']} if scripts and isinstance(scripts[0],dict) else {})})
        # Catalog pages reused for several products cannot evidence product conditions.
        identity=bool(c['name'].replace(' ','') in ''.join(lines).replace(' ',''))
        shared=sum(x['sourceUrl']==c['sourceUrl'] for x in CARDS)>1
        if kind=='productPage' and shared and not identity:
            documents[-1]['identityWarning']='Shared catalog page does not identify this product.'
            continue
        for item in e:item.update(sourceUrl=url,checkedAt=CHECKED,documentKind=kind)
        se.extend(s);be.extend(b);ev.extend(e)
        if s and b:break
    se=list(dict.fromkeys(se));be=list(dict.fromkeys(be))
    status='verified' if se and be else 'partial' if se or be else 'missing'
    return {'id':c['id'],'name':c['name'],'issuer':c['issuer'],'checkedAt':CHECKED,'status':status,
        'spendExclusions':se,'benefitExclusions':be,'evidence':ev,'documents':documents,
        'spendExclusionsStatus':'source_excerpt' if se else 'not_confirmed',
        'benefitExclusionsStatus':'source_excerpt' if be else 'not_confirmed',
        'pickingStatus':'not_verified','pickingScenarios':[],
        'researchNote':'공식 원문에서 상품 조건의 문맥을 추출했습니다. 원문 발췌에는 혜택별 조건이 포함될 수 있습니다. 미확인은 제외 항목 없음이라는 뜻이 아닙니다.'}

def main():
    arr=CARDS
    if '--sample' in sys.argv:
        arr=list({c['issuer']:c for c in reversed(CARDS)}.values())
    out=ROOT/'data'/('card-research-sample.json' if '--sample' in sys.argv else 'card-research.json')
    results=[];start=time.time()
    with cf.ThreadPoolExecutor(max_workers=18) as pool:
        tasks={pool.submit(research,c):c for c in arr}
        for fut in cf.as_completed(tasks):
            c=tasks[fut]
            try:results.append(fut.result())
            except Exception as e:results.append({'id':c['id'],'name':c['name'],'issuer':c['issuer'],'status':'error','error':str(e),'checkedAt':CHECKED})
            if len(results)%40==0 or len(results)==len(arr):
                out.write_text(json.dumps(sorted(results,key=lambda x:x['id']),ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
                print(json.dumps({'completed':len(results),'total':len(arr),'seconds':round(time.time()-start),'status':dict(Counter(r['status'] for r in results))},ensure_ascii=False),flush=True)
    out.write_text(json.dumps(sorted(results,key=lambda x:x['id']),ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps([{'issuer':r['issuer'],'status':r['status'],'spend':len(r.get('spendExclusions',[])),'benefit':len(r.get('benefitExclusions',[])),'documents':r.get('documents')} for r in results],ensure_ascii=False) if '--sample' in sys.argv else str(out))

if __name__=='__main__':main()
