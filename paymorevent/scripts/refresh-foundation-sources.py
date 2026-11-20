"""Retry all product-matched official sources, keeping failures and dates explicit.
Fetching a body does not mark any benefit or maximum as manually reviewed.
"""
import concurrent.futures as cf,gzip,hashlib,json,re,time,urllib.request,subprocess,tempfile
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo
from lxml import html
ROOT=Path(__file__).resolve().parent.parent
cards=json.loads((ROOT/'data/cards.json').read_text());research=json.loads((ROOT/'data/document-research.json').read_text())
cache=ROOT/'scripts/card-research-cache';cache.mkdir(exist_ok=True)
urls=sorted({d['url'] for c in cards for d in c.get('documents',[]) if d['kind']!='brand' and d['identityStatus']=='matched' and d['readStatus']=='read'}|{c['sourceUrl'] for c in cards}|{c['termsUrl'] for c in cards if c.get('termsUrl')})
day=datetime.now(ZoneInfo('Asia/Seoul')).date().isoformat();records=[];start=time.time()
prior=ROOT/'data/source-refresh-audit.json.gz'
if prior.exists():
 saved=json.loads(gzip.decompress(prior.read_bytes()))
 if saved['attemptedAt']==day:records=saved['records']
remaining=[u for u in urls if u not in {r['url'] for r in records}]
def fetch(url):
 row=dict(url=url,attemptedAt=day,readStatus='unreadable')
 try:
  with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0','Referer':url}),timeout=15) as resp:
   raw=resp.read(8000000);row.update(httpStatus=resp.status,resolvedUrl=resp.url)
  fmt='pdf' if raw.startswith(b'%PDF') else 'html'
  if fmt=='pdf':
   with tempfile.NamedTemporaryFile(suffix='.pdf') as p:
    p.write(raw);p.flush();text=subprocess.run(['pdftotext','-layout',p.name,'-'],capture_output=True,timeout=15).stdout.decode('utf-8',errors='replace')
  else:
   try:text=raw.decode('utf-8')
   except UnicodeDecodeError:text=raw.decode('euc-kr',errors='replace')
   page=html.fromstring(text)
   for el in page.xpath('//script|//style|//header|//footer|//nav'):el.drop_tree()
   for el in page.iter():
    if el.tag in ['br','p','li','h1','h2','h3','h4','h5','div','tr']:el.tail='\n'+(el.tail or '')
   text=page.text_content()
  lines=[re.sub(r'\s+',' ',s).strip() for s in text.splitlines() if s.strip()]
  # A PDF link returning a site shell / error is not a recovered brochure.
  valid=(len(re.findall('[가-힣]',text))>80 and len(lines)>5 and bool(re.search(r'적립|할인|한도|전월',text))) and not ('.pdf' in url.lower() and fmt!='pdf')
  row.update(format=fmt,sha256=hashlib.sha256(raw).hexdigest(),lineCount=len(lines),bytes=len(raw))
  if valid:
   row['readStatus']='read';(cache/(hashlib.sha256(url.encode()).hexdigest()+'.bin')).write_bytes(raw)
   row['lines']=lines
  else:row['error']='상품 조건 본문/PDF를 확인하지 못한 응답'
 except Exception as e:row['error']=str(e)
 return row
with cf.ThreadPoolExecutor(max_workers=24) as pool:
 for row in pool.map(fetch,remaining):
  records.append(row)
  if len(records)%100==0:print(json.dumps({'attempted':len(records),'total':len(urls),'read':sum(r['readStatus']=='read' for r in records),'seconds':round(time.time()-start)}),flush=True)
# Preserve historical bodies; fresh captures are a separate evidence layer.
payload={'attemptedAt':day,'count':len(records),'read':sum(r['readStatus']=='read' for r in records),'records':records}
with gzip.open(ROOT/'data/source-refresh-audit.json.gz','wb',compresslevel=9) as f:f.write((json.dumps(payload,ensure_ascii=False)+'\n').encode())
print(json.dumps({k:v for k,v in payload.items() if k!='records'}),flush=True)
