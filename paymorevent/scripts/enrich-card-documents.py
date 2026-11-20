"""Collect official product documentation with per-document identity and section provenance.
Uses observed URLs only. Unreadable documents and broad brand guides never prove eligibility.
"""
from ensure_card_source import ensure_card_data
ensure_card_data()
import concurrent.futures as cf, hashlib, io, json, re, time, urllib.request, subprocess, tempfile
from pathlib import Path
from urllib.parse import urljoin,urlparse
from lxml import html
from pypdf import PdfReader
ROOT=Path(__file__).resolve().parent.parent
CACHE=ROOT/'scripts/card-research-cache';CACHE.mkdir(exist_ok=True)
CARDS=json.loads((ROOT/'data/cards.json').read_text())
CHECKED='2026-10-10'; UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/132.0.0.0 Safari/537.36'
def fetch(url):
 key=hashlib.sha256(url.encode()).hexdigest();p=CACHE/(key+'.bin');m=CACHE/(key+'.json')
 if p.exists() and m.exists():return json.loads(m.read_text()),p.read_bytes()
 try:
  with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':UA,'Referer':url}),timeout=12) as r:
   raw=r.read(8_000_000);meta={'url':url,'resolvedUrl':r.url,'contentType':r.headers.get('Content-Type',''),'checkedAt':CHECKED,'bytes':len(raw),'httpStatus':r.status}
  p.write_bytes(raw)
 except Exception as e:raw=b'';meta={'url':url,'checkedAt':CHECKED,'error':str(e)}
 m.write_text(json.dumps(meta,ensure_ascii=False));return meta,raw
def parse(raw):
 if raw.startswith(b'%PDF'):
  with tempfile.NamedTemporaryFile(suffix='.pdf') as f:
   f.write(raw);f.flush()
   r=subprocess.run(['pdftotext','-layout',f.name,'-'],capture_output=True,timeout=15)
   text=r.stdout.decode('utf-8',errors='replace')
   info=subprocess.run(['pdfinfo',f.name],capture_output=True,timeout=5).stdout.decode('utf-8',errors='replace')
   pages=re.search(r'Pages:\s*(\d+)',info)
   return text,int(pages.group(1)) if pages else None
 try:t=raw.decode('utf-8')
 except:t=raw.decode('euc-kr',errors='replace')
 tree=html.fromstring(t)
 for el in tree.xpath('//script|//style|//nav|//header|//footer'):el.drop_tree()
 for el in tree.iter():
  if el.tag in ['br','p','li','h4','h5','div','tr']:el.tail='\n'+(el.tail or '')
 return tree.text_content(),None
def collect(url):
 meta,raw=fetch(url)
 try:
  text,pages=parse(raw) if raw else ('',None)
  lines=[re.sub(r'\s+',' ',l).strip() for l in text.splitlines() if l.strip()]
  meta.update(format='pdf' if raw.startswith(b'%PDF') else 'html',pages=pages,textLines=len(lines),readStatus='read' if len(lines)>5 else 'unreadable',sha256=hashlib.sha256(raw).hexdigest(),lines=lines)
 except Exception as e:meta.update(readStatus='unreadable',parseError=str(e),lines=[])
 return url,meta
# Prior observed document URLs include WCMS service fragments which are the actual terms.
research=json.loads((ROOT/'data/card-research.json').read_text())
urls={d['url'] for r in research for d in r.get('documents',[]) if d.get('kind')!='productPage'}
urls|={c['termsUrl'] for c in CARDS if c.get('termsUrl')}
# Fetch official product pages for discovery of product-specific brochures and service fragments.
urls|={c['sourceUrl'] for c in CARDS}
results={};start=time.time()
with cf.ThreadPoolExecutor(max_workers=36) as pool:
 for url,d in pool.map(collect,sorted(urls)):
  results[url]=d
  if len(results)%100==0: print(json.dumps({'documents':len(results),'total':len(urls),'seconds':round(time.time()-start)}),flush=True)
# Discover only links present in retrieved HTML. Never synthesize card document filenames.
extra=set();perCard={}
for c in CARDS:
 u=c['sourceUrl'];d=results.get(u,{});p=CACHE/(hashlib.sha256(u.encode()).hexdigest()+'.bin')
 paths=[]
 if p.exists() and d.get('format')=='html':
  raw=p.read_bytes().decode('utf-8',errors='replace').replace('\\u002F','/')
  paths=re.findall(r'["\']([^"\'<>\s]+\.pdf(?:\?[^"\'<>\s]*)?)["\']',raw,re.I)
  if 'samsungcard.com' in u:paths+=re.findall(r'(?:serviceUrl|noticeUrl|addServiceUrl):"([^"\s]+\.html)"',raw)
 found=[]
 for path in paths:
  base='https://static11.samsungcard.com' if path.startswith('/wcms/') else u
  url=urljoin(base,path)
  if urlparse(url).hostname and not url.startswith('javascript:') and urlparse(url).hostname.split('.')[-2:]==urlparse(base).hostname.split('.')[-2:]:
   found.append(url)
   if url not in results:extra.add(url)
 perCard[c['id']]=list(dict.fromkeys(found))
with cf.ThreadPoolExecutor(max_workers=36) as pool:
 for url,d in pool.map(collect,sorted(extra)):results[url]=d
# Keep complete extracted text in the source checkout; runtime cards contain compact provenance only.
(ROOT/'data/document-research.json').write_text(json.dumps({'checkedAt':CHECKED,'documents':results,'discovered':perCard},ensure_ascii=False)+'\n')
print(json.dumps({'completed':len(results),'discovered':len(extra),'read':sum(d.get('readStatus')=='read' for d in results.values()),'pdf':sum(d.get('format')=='pdf' for d in results.values()),'seconds':round(time.time()-start)}),flush=True)
