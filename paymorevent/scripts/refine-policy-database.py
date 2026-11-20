"""Rebuild all four payment judgments from product-scoped official policy sections.
No keyword-only exclusion, issuer default, or positive inference from a partial extract.
"""
from ensure_card_source import ensure_card_data
ensure_card_data()
import json,re,html,collections
from datetime import datetime
from zoneinfo import ZoneInfo
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
cards=json.loads((ROOT/'data/cards.json').read_text());research=json.loads((ROOT/'data/document-research.json').read_text());docs=research['documents'];DAY=datetime.now(ZoneInfo('Asia/Seoul')).date().isoformat()
ITEMS={'상품권 가능':r'상품권','관리비':r'(?:아파트\s*|APT\s*)?관리비','국세':r'국세|제세공과금|(?:각종\s*)?세금','지방세':r'지방세|제세공과금|(?:각종\s*)?세금'}
SPEND=re.compile(r'(?:전월.{0,40}(?:실적|이용금액|이용실적|이용액).{0,20}제외\s*(?:대상|항목|금액)|전월실적\s*및\s*연간.{0,20}제외\s*대상|실적\s*(?:산정|합산).{0,15}제외\s*(?:대상|항목)|\[?이용실적\s*제외\s*대상)')
BENEFIT=re.compile(r'^(?:[※*•·\[\s]*)[^,.()\[\]]{0,30}?(?:적립|할인|마일리지|캐시백)(?:\s*서비스)?\s*제외\s*(?:대상|항목|거래|매출|[:：])')
TOKENS=re.compile(r'상품권|선불|세금|국세|지방세|관리비|수수료|연회비|대출|등록금|무이자|취소|보험|공과금|교통|충전|납입|납부|이자|연체|정부지원|포인트|임대료')
STOP=re.compile(r'^(?:유의\s*사항|기타\s*(?:안내|기준)|서비스\s*(?:제공|이용)\s*(?:기준|조건)|발급|계약|상환|상품\s*출시|해외\s*이용\s*안내|전월.{0,15}산정기준|적립\s*기준|할인\s*기준|제공\s*기준|국제\s*브랜드|전월\s*실적|[0-9]+\.\s*[^,]{1,30}(?:서비스|적립|할인))')
def norm(s):return re.sub(r'\s+',' ',html.unescape(s)).strip()
def token(s):return re.sub('[^가-힣a-z0-9]','',s.lower())
def unique(xs):return list(dict.fromkeys(x for x in xs if x))
def scope_before(ls,i,axis):
 if axis=='spend':return '전월실적 (원문 적용 서비스)'
 for l in reversed(ls[max(0,i-45):i+1]):
  if 4<len(l)<75 and re.search(r'(?:기본|특별|추가|NH포인트|ALL 리워드|마일리지|포인트|할인)',l) and not re.search(r'제외|유의|한도|전월|금액|기준|제공|조건|안내|이용 시|예시|[0-9]',l):return l
 return '적립·할인 (원문 적용 서비스)'
def section_text(ls,i):
 l=ls[i];parts=[l]
 # A one-line policy is already complete. Avoid appending a different service.
 if len(l)>95 and l.count(',')>=3:return l,True
 ended=False
 for n in ls[i+1:i+25]:
  if (SPEND.search(n) or BENEFIT.search(n)) or (STOP.search(n) and not TOKENS.search(n)) or (len(n)<65 and re.search(r'(?:기준|안내|방법|서비스|제공|혜택)$',n) and ',' not in n):ended=True;break
  if not TOKENS.search(n) and not parts[-1].endswith((',', '/', '및','·')):
   if len(n)<75:ended=True;break
  parts.append(n)
  if sum(map(len,parts))>2200:break
  if re.search(r'(?:포함되지 않습니다|제외됩니다|제외\s*$)',n) and TOKENS.search(n):ended=True;break
 text=' '.join(parts)
 return text,ended and len(text)>60 and (text.count(',')>=2 or text.count('·')>=3)
def extract(ls,url):
 out=[]
 for i,l in enumerate(ls):
  if re.search(r'연회비\s*반환|부가서비스.{0,20}(?:변경|축소)|제외신청|제외조건은.{0,15}참조',l):continue
  axis='spend' if SPEND.search(l) else 'benefit' if BENEFIT.search(l) else None
  # Full single-sentence monthly performance exclusions are explicit too.
  if not axis and re.search(r'전월\s*(?:이용)?\s*실적에\s*포함되지\s*않습니다',l) and TOKENS.search(l):axis='spend'
  if not axis:continue
  if axis=='benefit' and re.search(r'보너스|연간|전년도',l.split(':')[0].split('：')[0]):continue
  text,full=(l,True) if axis=='spend' and re.search(r'포함되지\s*않습니다',l) else section_text(ls,i)
  # Wrapped lists can terminate with the explicit exclusion verb on the next line.
  # Read back only continuation paragraphs; never concatenate a preceding service.
  if axis=='spend' and re.search(r'포함되지\s*않습니다',l):
   preceding=[]
   for prev in reversed(ls[max(0,i-4):i]):
    if TOKENS.search(prev) and (prev.rstrip().endswith(('및',',','·','/')) or (',' in prev and not re.search(r'입니다|됩니다|습니다|기준|제외',prev))):preceding.insert(0,prev)
    else:break
   text=' '.join(preceding+[text]);full=bool(preceding) or full
  if TOKENS.search(text) and len(text)>35:out.append({'axis':axis,'scope':scope_before(ls,i,axis),'text':text[:2200],'full':full,'url':url,'line':i+1})
 return out
changed=collections.Counter();cleaned=0;added=0;complete=0
for c in cards:
 # Drop regulatory disclosures from benefit rows, retaining them as separate policy notes.
 # Remove generated judgments/excerpts before rebuilding. Stale positives must not survive a missing section.
 for e in c.get('paymentEligibility',{}).values():
  if e.get('basis') in ('full_exclusion_list','extracted') and c.get('databaseAudit',{}).get('reviewStatus')!='reviewed':
   for axis in ['spend','benefit']:
    if e.get(axis)=='allowed':e[axis]='unknown'
   e['note']='전체 제외목록을 재검증하기 전에는 가능으로 판정하지 않습니다.'
 if c.get('databaseAudit',{}).get('reviewStatus')!='reviewed':c['eligibilityRules']=[r for r in c.get('eligibilityRules',[]) if r.get('basis')=='manual']
 for cd in c.get('documents',[]):cd['excerpts']=[e for e in cd.get('excerpts',[]) if e['field']=='benefits']
 keep=[]
 for b in c['benefits']:
  if re.search(r'상품\s*출시|부가서비스\s*변경|연회비\s*반환|카드\s*발급\s*(?:안내|유의)',b['title']):c.setdefault('policyNotes',[]).append(b['title']+' : '+b['detail'])
  else:keep.append(b)
 c['benefits']=keep;c['policyNotes']=unique(c.get('policyNotes',[]))
 # Attach newly fetched official search records by exact product code (not product name similarity).
 for url in research['discovered'].get(c['id'],[]):
  d=docs.get(url,{})
  if d.get('productCode') and str(d['productCode'])==c['id'].split('-')[-1] and not any(x['url']==url for x in c.get('documents',[])):
   c.setdefault('documents',[]).append({'url':url,'kind':'product','format':'html','readStatus':'read','identityStatus':'matched','checkedAt':DAY,'sha256':d['sha256'],'excerpts':[]})
 sections=[];alltext=[]
 for cd in c.get('documents',[]):
  d=docs.get(cd['url'],{})
  if cd['identityStatus']!='matched' or d.get('readStatus')!='read' or cd['kind']=='brand':continue
  ls=[norm(s) for s in d.get('lines',[]) if norm(s)];ss=extract(ls,cd['url']);sections+=ss;alltext+=ls
  for s in ss:
   ex={'field':'spendExclusions' if s['axis']=='spend' else 'benefitExclusions','scope':s['scope'],'text':s['text']}
   if not any(x['text']==ex['text'] for x in cd['excerpts']):cd['excerpts'].append(ex)
  # Retain benefit table text without truncating the service to its heading.
  for b in c['benefits']:
   bt=token(b['title']);idx=next((i for i,l in enumerate(ls) if len(bt)>5 and bt==token(l)),None)
   if idx is not None and c['issuerGroup']=='우리':
    part=[]
    for l in ls[idx+1:idx+85]:
     if len(l)<80 and any(token(l)==token(other['title']) and other is not b for other in c['benefits']):break
     part.append(l)
    detail=' '.join(part)
    if len(detail)>len(b['detail']) and len(detail)<6500:b['detail']=detail;b['sourceUrl']=cd['url'];added+=1
 for axis,field in [('spend','spendExclusions'),('benefit','benefitExclusions')]:
  ss=[s['text'] for s in sections if s['axis']==axis]
  # Reject positive-target sentences misfiled as exclusions and references to another section.
  old=[s for s in c[field] if not re.search(r'마일리지는 결제월|적립제외 대상 금액 제외|적립제외 대상금액 제외|^적립\s*대상\s*[:：]|제외조건은.{0,20}참조|내 [‘\']연간 이용실적 제외',s)]
  cleaned+=len(c[field])-len(old)
  # Newly complete section replaces a prior concatenation with identical heading.
  for new in ss:
   prefix=new[:min(30,len(new))]
   old=[s for s in old if not (s.startswith(prefix) and len(s)>len(new)+80)]
  c[field]=unique(old+ss)
 # Fill missing numeric summaries using the actual corresponding benefit, without replacing prose.
 for b in c['benefits']:
  text=b['title']+' '+b['detail'];rat=re.search(r'(?<!\d)(\d+(?:\.\d+)?(?:\s*[~～]\s*\d+(?:\.\d+)?)?\s*%)\s*(?:[가-힣A-Z]*\s*)?(?:적립|할인|캐시백)',text)
  if b['rate'] is None and rat and not re.search(r'대출|연체|보험|무이자',b['title']):b['rate']=rat.group(1);added+=1
  if b['minimumSpend'] is None and re.search(r'전월.{0,20}(?:관계없이|상관없이)|실적조건\s*없음|전월실적\s*조건\s*없|무실적',b['detail']):b['minimumSpend']=0;b['minimumSpendVerified']=True
 # Product representative rules prioritize basic/common earning policies. Service-specific rules stay distinct.
 universal=bool(any(re.search(r'(?:국내외|국내|전|모든).{0,12}(?:가맹점|이용금액|이용액)',b['title']+' '+b['detail']) and re.search(r'적립|할인|캐시백',b['title']) and not re.search(r'바우처|기프트|보너스|연간',b['title']) for b in c['benefits']))
 for item,pat in ITEMS.items():
  old=c.get('paymentEligibility',{}).get(item,{});new={**old,'spend':old.get('spend','unknown'),'benefit':old.get('benefit','unknown'),'sourceUrl':old.get('sourceUrl',c['sourceUrl'])}
  chosen=[]
  for axis in ['spend','benefit']:
   candidates=[s for s in sections if s['axis']==axis]
   # For gifts, an annual lounge/membership exception does not establish monthly spending recognition.
   candidates=[s for s in candidates if not re.search(r'연간|전년도|기프트|보너스|바우처',s['scope'])]
   negatives=[s for s in candidates if re.search(pat,s['text'])]
   positives=[s for s in candidates if s['full'] and not re.search(pat,s['text']) and (axis=='spend' or universal) and not re.search(r'커피|스타벅스|교통|마트|온라인|주유|백화점|라운지',s['scope'])]
   # Differing service policies are not collapsed into an unconditional positive.
   if negatives:
    s=negatives[0];new[axis]='excluded';chosen.append(s)
   elif positives and not any(re.search(pat,s['text']) for s in candidates):
    s=positives[0];new[axis]='allowed';chosen.append(s)
   # Independently reviewed records remain authoritative.
   if c['id'] in ['samsung-aap1452','samsung-aap1453']:new={**old};chosen=[];break
  if chosen:
   s=chosen[0];new.update(sourceUrl=s['url'],basis='full_exclusion_list' if any(x['full'] for x in chosen) else 'explicit',checkedAt=DAY,scope=' / '.join(unique(x['scope'] for x in chosen)),evidence='\n'.join(unique(x['text'] for x in chosen)),note='실적 인정과 적립·할인 제공을 각각 원문에서 대조했습니다. '+('전체 제외목록에 해당 항목이 없는 판정은 원문 적용 서비스에 한합니다. ' if any(new[a]=='allowed' for a in ['spend','benefit']) else '')+'무이자할부·할인받은 거래·선불충전·실제 승인업종 등 공통 조건은 별도로 적용됩니다.')
  if new!=old:changed[item]+=1
  c.setdefault('paymentEligibility',{})[item]=new
  for s in sections:
   if s['axis']=='benefit' and not universal and not re.search(pat,s['text']):continue
   state='excluded' if re.search(pat,s['text']) else 'allowed' if s['full'] else 'unknown'
   rule={'item':'상품권' if item=='상품권 가능' else item,'scope':s['scope'],'spend':state if s['axis']=='spend' else 'unknown','benefit':state if s['axis']=='benefit' else 'unknown','sourceUrl':s['url'],'note':s['text'],'evidence':s['text'],'basis':'full_exclusion_list' if s['full'] else 'explicit','checkedAt':DAY}
   if not any(x['item']==rule['item'] and x['scope']==rule['scope'] and x['sourceUrl']==rule['sourceUrl'] and x.get('evidence')==rule['evidence'] for x in c.get('eligibilityRules',[])):c.setdefault('eligibilityRules',[]).append(rule)
 c['eligibilityRules']=c.get('eligibilityRules',[]) # never borrow a sibling card's conditions
 c['databaseAudit']['note']='商品별 공식 원문의 실적·제공 제외목록을 분리 대조. 표 형태의 요율·한도를 혜택에 보존. 자동 대조와 수동 검토 상태를 구분합니다.'.replace('商品','상품')
 c['databaseAudit']['processedAt']=DAY
 if any(s['full'] for s in sections):complete+=1
 # Correct NH Classy Travel using its own complete policy plus explicit tax inclusion.
 if c['id']=='nh-90010544':
  source=c['sourceUrl'];ls=docs[source]['lines'];full=' '.join(ls);assert '세금 및 공과금' in full and '국내 전월실적' in full
  for item in ['관리비','국세','지방세']:
   c['paymentEligibility'][item]={'spend':'allowed','benefit':'allowed','sourceUrl':source,'note':'국내 가맹점 1.2% 적립, 건당 1만원 이상. 세금·공과금 포함 명시 및 실적/적립 전체 제외목록 대조. 통합 월 10만점, 무이자할부 적립 제외. 해외 4%는 국내 전월실적 100만원 초과 조건.','scope':'국내 기본 적립 / 공통 전월실적','basis':'explicit' if item in ['국세','지방세'] else 'full_exclusion_list','checkedAt':DAY,'evidence':'\n'.join(s['text'] for s in sections),'limit':'국내·해외 통합 월 100,000 NH포인트','channel':'국내가맹점 건당 10,000원 이상. 무이자할부 제외.'}
  c['searchAliases']=unique(c.get('searchAliases',[])+['NH 클래시트래블','클래시트래블','클래시 트래블'])
  c['minimumSpend']=0
  for b in c['benefits']:
   if b['title'].startswith('국내 :'):b.update(minimumSpend=0,minimumSpendVerified=True,rate='1.2%',cap='건당 1만원 이상 / 국내·해외 통합 월 10만 포인트',sourceUrl=source)
   if b['title'].startswith('해외 :'):b.update(minimumSpend=0,minimumSpendVerified=True,rate='3~4%',cap='국내·해외 통합 월 10만 포인트',sourceUrl=source,detail=b['detail'] if ' / 해외 3%는 실적 관계없이 제공, 4%는 국내 전월실적 100만원 초과 시 제공. 국내 실적 산정에 세금·공과금·무이자할부 포함.' in b['detail'] else b['detail']+' / 해외 3%는 실적 관계없이 제공, 4%는 국내 전월실적 100만원 초과 시 제공. 국내 실적 산정에 세금·공과금·무이자할부 포함.')
  c['databaseAudit'].update(reviewStatus='reviewed',note='공식 상품 페이지의 국내·해외 적립 표, 세금 포함, 공통 실적·적립 제외목록을 개별 대조.')
 c.pop('themeTags',None)
(ROOT/'data/cards.json').write_text(json.dumps(cards,ensure_ascii=False,indent=2)+'\n')
report={'checkedAt':DAY,'cards':len(cards),'fullPolicyCards':complete,'judgmentChanges':dict(changed),'benefitFieldsFilled':added,'falseExclusionSectionsRemoved':cleaned,'knownJudgments':{t:{a:collections.Counter(c['paymentEligibility'][t][a] for c in cards) for a in ['spend','benefit']} for t in ITEMS}}
(ROOT/'data/policy-refinement-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps(report,ensure_ascii=False))
