"""Build scope-aware database records from original official documents and prior evidence.
No positive classifications from an incomplete excerpt or a generic brand brochure.
"""
from ensure_card_source import ensure_card_data
ensure_card_data()
import collections,hashlib,json,re,subprocess,tempfile
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
cards=json.loads((ROOT/'data/cards.json').read_text());previous={r['id']:r for r in json.loads((ROOT/'data/card-research.json').read_text())}
fresh=json.loads((ROOT/'data/document-research.json').read_text());docs=fresh['documents'];discovered=fresh['discovered'];CACHE=ROOT/'scripts/card-research-cache';day=fresh['checkedAt']
patterns={'상품권 가능':r'상품권','관리비':r'(?:아파트\s*)?관리비','국세':r'국세|각종\s*세금|제세공과금','지방세':r'지방세|각종\s*세금|제세공과금'}
def key(s):return re.sub(r'[^가-힣a-z0-9]','',s.lower())
def clean(s,field):
 # End an exclusion section when a new policy heading begins, rather than borrowing its terms.
 if field=='spendExclusions':s=re.split(r'\[?(?:리워드 서비스.{0,30})?(?:포인트|마일리지|할인|적립|혜택)(?:\([^)]*\))?\s*(?:적립\s*)?제외\s*(?:대상|항목)',s,1)[0]
 s=re.split(r'발급 시 유의 사항|연회비 반환|상품 출시일',s,1)[0]
 return re.sub(r'\s+',' ',s).strip()
def dedupe(items):
 items=list(dict.fromkeys(x for x in items if x))
 return [s for s in items if not any(s!=t and len(t)>len(s) and s in t for t in items)]
def sections(lines):
 result=[];scope='공통 안내'
 for i,l in enumerate(lines):
  # Short service titles usually appear before their own requirements.
  if len(l)<100 and re.search(r'적립|할인|라운지|바우처',l) and not re.search(r'제외|유의|기준|조건|안내|한도|대상|변경|금액',l):scope=l
  typ='spendExclusions' if re.search(r'(?:전월.{0,35}(?:실적|이용금액).{0,20}제외|전월실적\s*제외|실적\s*산정.{0,15}제외)',l) else 'benefitExclusions' if re.search(r'(?:할인|적립|혜택|마일리지).{0,15}제외\s*(?:대상|항목|거래)',l) else None
  if not typ:continue
  parts=[l]
  if len(l)<180:
   for nxt in lines[i+1:i+18]:
    if re.search(r'^(?:연회비|유의사항|유의 사항|발급 시|서비스안내|서비스 안내|상품 출시|해외 이용|카드 이용|통합 할인한도)',nxt):break
    if '제외' in nxt and re.search(r'(?:전월|실적|적립|할인|혜택).{0,25}제외\s*(?:대상|항목|거래)',nxt):break
    if len(nxt)<70 and re.search(r'(?:혜택|서비스|적립|할인).{0,10}(?:제공|기준|안내|한도)$',nxt):break
    parts.append(nxt)
    if sum(map(len,parts))>1600:break
  text=clean(' '.join(parts),typ)
  if len(text)>len(l)+10 or (len(l)>90 and re.search(r'상품권|세금|국세|관리비|수수료',text)):
   result.append({'field':typ,'scope':scope,'text':text[:2000]})
 return result
# Poppler correctly decodes old Korean PDFs that pypdf cannot. Retain original document hash.
for url,d in docs.items():
 p=CACHE/(hashlib.sha256(url.encode()).hexdigest()+'.bin')
 if d.get('format')=='pdf' and d.get('readStatus')=='read' and re.search(r'[가-힣]',' '.join(d.get('lines',[]))):continue
 if p.exists() and p.read_bytes()[:4]==b'%PDF':
  r=subprocess.run(['pdftotext','-layout',str(p),'-'],capture_output=True,timeout=20)
  text=r.stdout.decode('utf-8',errors='replace');lines=[re.sub(r'\s+',' ',l).strip() for l in text.splitlines() if l.strip()]
  if len(lines)>5 and re.search(r'[가-힣]',text):d.update(lines=lines,format='pdf',readStatus='read',textLines=len(lines))
  else:d['readStatus']='unreadable'
sourceUse=collections.Counter(c['sourceUrl'] for c in cards);termsUse=collections.Counter(c.get('termsUrl') for c in cards if c.get('termsUrl'))
for c in cards:
 r=previous[c['id']];original={d['url']:d for d in r.get('documents',[])}
 urls=list(dict.fromkeys([c['sourceUrl']]+([c['termsUrl']] if c.get('termsUrl') else [])+list(original)+discovered.get(c['id'],[])))
 c['documents']=[];newSections=[]
 for url in urls:
  d=docs.get(url,{});old=original.get(url,{});lines=d.get('lines',[]);ev=[e for e in r.get('evidence',[]) if e.get('sourceUrl')==url]
  isBrand=bool(re.search(r'AMEX_[A-Z]_\d|mastercard|visa[-_].*(?:guide|service)|Terms_sheet_persnal',url,re.I))
  fmt='pdf' if d.get('format')=='pdf' or 'pdf' in old.get('contentType','') or '.pdf' in url.lower() else 'html'
  readable=(d.get('readStatus')=='read' and (fmt=='pdf' or bool(ev) or any(key(b['title']) in key(' '.join(lines)) for b in c['benefits'] if len(key(b['title']))>5))) or (old.get('textLines',0)>5 and (fmt=='pdf' or bool(ev)) and not old.get('identityWarning') and not old.get('error'))
  matched=not isBrand and ((url==c['sourceUrl'] and sourceUse[url]==1) or bool(ev) or (len(key(c['name']))>5 and key(c['name']) in key(' '.join(lines))))
  isCurrent=d.get('readStatus')=='read';sec=sections(lines) if isCurrent and matched else []
  excerpts=dedupe([e['text'] for e in sec]+[clean(e.get('excerpt',''),e['field']) for e in ev]);sources=[]
  for e in sec:sources.append(e)
  for e in ev:
   text=clean(e.get('excerpt',''),e['field'])
   if text and not any(text in s['text'] for s in sources):sources.append({'field':e['field'],'scope':'원문 해당 혜택','text':text[:1600]})
  # Product terms and a generic international-brand guide are distinct document types.
  kind='brand' if isBrand else 'product' if url==c['sourceUrl'] else 'terms' if fmt=='pdf' else 'service'
  c['documents'].append({'url':url,'kind':kind,'format':fmt,'readStatus':'read' if readable else 'unreadable','identityStatus':'brand' if isBrand else 'matched' if matched else 'unconfirmed','checkedAt':day if isCurrent else old.get('checkedAt',day),'pages':d.get('pages'),**({'sha256':d['sha256']} if isCurrent and d.get('sha256') else {}),'excerpts':sources[:8]})
  newSections += [e for e in sec if e['scope']=='공통 안내' or any(key(e['scope']) in key(b['title']) or key(b['title']) in key(e['scope']) for b in c['benefits'] if len(key(b['title']))>5)]
  for b in c['benefits']:
   scoped=[e for e in sec if len(key(b['title']))>5 and (key(e['scope']) in key(b['title']) or key(b['title']) in key(e['scope']))]
   for field in ['spendExclusions','benefitExclusions']:
    found=[e['text'] for e in scoped if e['field']==field]
    if found:b[field]=dedupe(b.get(field,[])+found)
 # Clean concatenated policy boundaries in the historic corpus and add fresh exclusions.
 for field in ['spendExclusions','benefitExclusions']:
  c[field]=dedupe([clean(s,field) for s in c[field]]+[e['text'] for e in newSections if e['field']==field])
 # Prefer a product brochure to a generic brand guide if an actual product URL was observed.
 if not c.get('termsUrl') or any(d['url']==c['termsUrl'] and d['kind']=='brand' for d in c['documents']):
  candidate=next((d for d in c['documents'] if d['kind']=='terms' and d['identityStatus']=='matched' and d['readStatus']=='read'),None)
  if candidate:c['termsUrl']=candidate['url']
 c['eligibilityRules']=[]
 for theme,pattern in patterns.items():
  oldRule=c.get('paymentEligibility',{}).get(theme,{'spend':'unknown','benefit':'unknown','sourceUrl':c['sourceUrl'],'note':'공식 자료 미확인'})
  # Preserve previously individually verified positive rulings, but update negative evidence after boundary cleanup.
  e={**oldRule}
  for axis,field in [('spend','spendExclusions'),('benefit','benefitExclusions')]:
   relevant=[s for s in c[field] if re.search(pattern,s)]
   if e.get(axis)=='excluded' and not relevant:e[axis]='unknown'
   if relevant:
    rule={'item':'상품권' if theme=='상품권 가능' else theme,'scope':'원문 해당 실적·혜택','spend':'excluded' if axis=='spend' else 'unknown','benefit':'excluded' if axis=='benefit' else 'unknown','sourceUrl':c['conditionEvidence']['url'] if c.get('conditionEvidence') else c['sourceUrl'],'note':relevant[0][:1600],'basis':'extracted','checkedAt':r.get('checkedAt','2026-10-06')}
    c['eligibilityRules'].append(rule)
  c.setdefault('paymentEligibility',{})[theme]=e
 c['databaseAudit']={'documentsRead':sum(d['readStatus']=='read' for d in c['documents']),'pdfRead':sum(d['readStatus']=='read' and d['format']=='pdf' and d['identityStatus']=='matched' for d in c['documents']),'spendSections':len(c['spendExclusions']),'benefitSections':len(c['benefitExclusions']),'reviewStatus':'partial' if any(d['readStatus']=='read' and d['identityStatus']=='matched' for d in c['documents']) else 'unreviewed','checkedAt':day,'note':'원문 추출과 수동 검토는 구분합니다. 공통 브랜드 안내는 상품설명서로 계산하지 않습니다. 미확인 판정은 가능 또는 제외로 단정하지 않습니다.'}
 c.pop('themeTags',None)
# Individually reviewed Samsung basic mileage policy. Exhaustive list + universal basic accrual,
# not omission from a short excerpt. Gift certificate purchase != issuer prepaid-card recharge.
base='https://static11.samsungcard.com/wcms/svc/1212906_38558.html'
raw=docs.get(base,{}).get('lines',[])
if not raw:
 p=CACHE/(hashlib.sha256(base.encode()).hexdigest()+'.bin')
 if p.exists():
  from lxml import html
  raw=[re.sub(r'\s+',' ',html.fromstring(p.read_bytes().decode('utf-8')).text_content()).strip()]
full=' '.join(raw)
assert '국내외 가맹점' in full and '선불카드 충전' in full and '국세/지방세/공과금' in full and '상품권' not in full
policy=full[full.index('마일리지 적립 제외 대상'):full.index('유의사항')]
for c in cards:
 if c['id'] not in ['samsung-aap1452','samsung-aap1453']:continue
 c['searchAliases']=['삼성 앤마일리지','앤마일리지','앤마','삼성 앤마']
 c['paymentEligibility']['상품권 가능']={'spend':'unknown','benefit':'allowed','sourceUrl':base,'scope':'기본 마일리지 적립','basis':'full_exclusion_list','checkedAt':day,'evidence':policy,'limit':'기본 1,000원당 1마일. 추가 적립은 선택형 업종·한도를 별도 적용.','channel':'상품권 구매 거래에 대한 기본 적립. 선불카드 충전·무이자할부·삼성카드 할인 적용 거래는 별도 제외.','note':'국내외 가맹점 기본 적립과 전체 마일리지 제외목록을 대조했습니다. 상품권 구매는 기본 적립 대상이며 선불카드 충전은 제외됩니다. 기본 적립의 무실적 조건과 라운지 실적 인정은 별개입니다.'}
 c['paymentEligibility']['관리비']={'spend':'unknown','benefit':'allowed','sourceUrl':base,'scope':'기본 마일리지 적립','basis':'full_exclusion_list','checkedAt':day,'evidence':policy,'note':'전 가맹점 기본 적립 및 전체 마일리지 제외목록 검토. 아파트관리비는 목록에 없으므로 기본 적립 대상. 무이자할부·삼성카드 할인 적용 거래 등 공통 제외 조건은 적용됩니다.'}
 for t in ['국세','지방세']:c['paymentEligibility'][t]={'spend':'unknown','benefit':'excluded','sourceUrl':base,'scope':'기본·추가 마일리지','checkedAt':day,'basis':'explicit','evidence':policy,'note':'공식 마일리지 적립 제외 대상에 국세/지방세/공과금이 명시되어 있습니다. 기본 적립의 실적 요건과 다른 서비스 실적을 구분합니다.'}
 c['benefitExclusions']=dedupe([policy,'선택형 추가 적립: 해외형/국내형 옵션별 대상 업종에만 적용. 백화점 내 일부 임대매장·식품매장 제외. 해당 카드는 택시 이용 시에도 마일리지 적립.'])
 c['eligibilityRules']=[{'item':'상품권','scope':'기본 마일리지','spend':'unknown','benefit':'allowed','sourceUrl':base,'note':c['paymentEligibility']['상품권 가능']['note'],'basis':'full_exclusion_list','checkedAt':day},{'item':'선불카드 충전','scope':'마일리지','spend':'unknown','benefit':'excluded','sourceUrl':base,'note':'삼성유포인트카드·삼성전자 멤버십 BLUE 삼성선불카드·삼성올앳카드 등 선불카드 충전 제외.','basis':'explicit','checkedAt':day},{'item':'상품권','scope':'추가 적립','spend':'unknown','benefit':'unknown','sourceUrl':c['sourceUrl'],'note':'국내형/해외형 선택 옵션과 실제 승인 업종을 별도 확인합니다. 기본 적립 가능을 추가 적립 가능으로 확대하지 않습니다.','basis':'manual','checkedAt':day}]
 for b in c['benefits']:
  if '마일리지' in b['title']:
   b['sourceUrl']=base if '추가' not in b['title'] else next((d['url'] for d in c['documents'] if '368395' in d['url']),c['sourceUrl']);b['minimumSpend']=0;b['minimumSpendVerified']=True;b['benefitExclusions']=[policy]
 c['databaseAudit'].update(reviewStatus='reviewed',benefitSections=len(c['benefitExclusions']),note='기본 마일리지·상품권/선불카드 구분·세금 제외를 공식 전체 원문으로 수동 검토. 라운지 실적과 추가 적립 업종은 별도 규칙 적용.')
(ROOT/'data/cards.json').write_text(json.dumps(cards,ensure_ascii=False,indent=2)+'\n')
# Retain full extracted documents outside runtime summaries for reproducible future research.
(ROOT/'data/document-research.json').write_text(json.dumps(fresh,ensure_ascii=False)+'\n')
report={'checkedAt':day,'cards':len(cards),'productPdfCards':sum(c['databaseAudit']['pdfRead']>0 for c in cards),'linkedDocumentCards':sum(bool(c.get('termsUrl')) for c in cards),'reviewed':sum(c['databaseAudit']['reviewStatus']=='reviewed' for c in cards),'documentsRead':sum(d.get('readStatus')=='read' for d in docs.values()),'pdfDocumentsRead':sum(d.get('readStatus')=='read' and d.get('format')=='pdf' for d in docs.values()),'unreadable':sum(d.get('readStatus')!='read' for d in docs.values()),'discoveredUrls':sum(len(u) for u in discovered.values())}
(ROOT/'data/database-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps(report,ensure_ascii=False))
