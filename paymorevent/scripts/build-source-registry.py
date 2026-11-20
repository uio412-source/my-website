import json,hashlib
from pathlib import Path
from urllib.parse import urljoin,urlparse
from lxml import html
root=Path(__file__).resolve().parent.parent
cards=json.loads((root/'data/cards.json').read_text());coverage=json.loads((root/'data/coverage.json').read_text());rows=[];seen=set()
def add(issuer,kind,url,note):
 if not url or urlparse(url).scheme!='https' or (issuer,kind,url) in seen:return
 seen.add((issuer,kind,url));rows.append(dict(id=hashlib.sha256((issuer+'|'+kind+'|'+url).encode()).hexdigest()[:24],issuer=issuer,kind=kind,url=url,note=note))
for c in coverage:add(c['issuer'],'product_list',c.get('sourceUrl'),'기존 공식 목록의 변경 감지. 동적 목록·페이지네이션은 별도 대조 필요.')
for issuer in sorted(set(c['issuer'] for c in cards)):
 own=[c for c in cards if c['issuer']==issuer]
 if not any(r['issuer']==issuer and r['kind']=='product_list' for r in rows):add(issuer,'product_sample',own[0]['sourceUrl'],'상품목록 진입 URL 추가 확인 필요. 개별 상품으로 전체 목록 확인을 대체하지 않음.')
 for c in own[:15]:
  url=c['sourceUrl'];p=root/'scripts/card-research-cache'/(hashlib.sha256(url.encode()).hexdigest()+'.bin')
  if not p.exists():continue
  raw=p.read_bytes()
  if raw.startswith(b'%PDF'):continue
  try:page=html.fromstring(raw.decode('utf-8',errors='replace'))
  except Exception:continue
  for a in page.xpath('//a[@href]'):
   text=' '.join(a.itertext()).strip();href=a.get('href','')
   if ('상품공시' in text or '상품 공시' in text or '서비스 변경' in text) and not href.startswith(('javascript:','#')):
    full=urljoin(url,href)
    if urlparse(full).hostname==urlparse(url).hostname:add(issuer,'disclosure',full,'공식 페이지에서 관측한 공시·서비스변경 진입 링크. '+text[:60])
(root/'data/card-source-hosts.json').write_text(json.dumps(sorted(set(urlparse(u).hostname for c in cards for u in [c['sourceUrl'],c.get('termsUrl')]+[d['url'] for d in c.get('documents',[])] if u and urlparse(u).scheme=='https')))+'\n')
(root/'data/card-source-registry.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'issuers':len(set(c['issuer'] for c in cards)),'sources':len(rows),'disclosure':sum(r['kind']=='disclosure' for r in rows)}))
