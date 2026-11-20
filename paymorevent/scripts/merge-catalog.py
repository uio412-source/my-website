"""Normalize official-source research snapshots into the Paymorevent catalog.
Usage: python scripts/merge-catalog.py /absolute/research-directory
Input groups are collected from observed official catalog endpoints, not third-party rankings.
Missing monetary conditions are deliberately kept null.
"""
import json,re,sys,hashlib
from pathlib import Path
from collections import Counter
root=Path(__file__).resolve().parent.parent
research=Path(sys.argv[1])
groups=['shinhan-kb','samsung-hyundai','woori-hana','nh-bc-lotte-ibk','regional','internet-cards']
issuer_map={'KB국민':'KB국민카드','국민카드':'KB국민카드','NH농협':'NH농협카드','BC 바로':'BC 바로카드','BC바로카드':'BC 바로카드','수협':'수협은행','우체국':'우체국예금'}
tag_map={'pay':'간편결제','digital':'구독','dining':'외식','shopping':'쇼핑','discount':'할인','points':'포인트','transport':'교통','travel':'여행','telecom':'통신','fuel':'주유','education':'교육','utilities':'공과금','health':'의료','government':'정부지원','personal_business':'개인사업자','premium':'프리미엄','pets':'반려동물','coffee':'커피','mileage':'마일리지','subscription':'구독','general':'기타','other':'기타','overseas':'해외','hotel':'호텔','lounge':'라운지','cashback':'캐시백','cinema':'영화','delivery':'배달','no_spend':'무실적','해외가맹점':'해외','공항라운지':'라운지','카페':'커피','병원':'의료','영화/공연':'영화','비즈니스':'개인사업자','무조건':'무실적'}
patterns={'쇼핑':r'쇼핑|백화점|아울렛|쿠팡|온라인 ?가맹점','마트':r'마트|장보기','커피':r'커피|카페|스타벅스|커피빈','교통':r'대중교통|버스|지하철|K-?패스|교통비','주유':r'주유|충전소','통신':r'통신|휴대폰요금','해외':r'해외 ?(?:결제|가맹점|이용|전 ?가맹점|할인|구매)|국내[·/와\s]*외','라운지':r'라운지','호텔':r'호텔|숙박|숙소|리조트','마일리지':r'마일리지|마일 ?적립','간편결제':r'간편결제|PAYCO|페이코|모니모페이|네이버페이|카카오페이','구독':r'구독|OTT|넷플릭스|유튜브 ?프리미엄|디지털콘텐츠','포인트':r'포인트|적립','캐시백':r'캐시백','외식':r'외식|음식점|레스토랑','배달':r'배달|쿠팡이츠|요기요','바우처':r'바우처','프리미엄':r'프리미엄|플래티넘|플래티늄','교육':r'교육|학원|학습지','의료':r'병원|의료|약국','영화':r'영화|CGV|메가박스','골프':r'골프','편의점':r'편의점','여행':r'여행|항공|호텔|숙박|라운지','개인사업자':r'개인사업자|사업용'}
def text(v):return re.sub(r'\s+',' ',str(v or '')).strip()
def url(v):
 v=text(v)
 if not v:return None
 if v.startswith('//'):v='https:'+v
 return v if v.startswith(('https://','http://')) else None
def money(v):
 if v is None:return None
 if isinstance(v,(int,float)) and v>=0:return int(v)
 return None
def norm_brand(v):
 s=text(v);x=s.lower()
 if 'master' in x or '마스터' in s:return 'Mastercard'
 if 'visa' in x or '비자' in s:return 'Visa'
 if any(t in x for t in ['amex','american express']) or '아멕스' in s or '아메리칸' in s:return 'American Express'
 if 'unionpay' in x or '은련' in s or '유니온페이' in s or '銀聯' in s:return 'UnionPay'
 if 'jcb' in x:return 'JCB'
 if 'diners' in x or '다이너스' in s:return 'Diners Club'
 if '국내전용' in s or '국내 전용' in s or x=='local':return '국내전용'
 return s
cards={};provenance={};dedup=[]
for group in groups:
 path=research/(group+'.json')
 if not path.exists():raise SystemExit('Missing final research group: '+group)
 arr=json.loads(path.read_text())
 for raw in arr:
  if raw.get('type') not in ['credit','debit']:continue
  c={k:raw.get(k) for k in ['id','issuer','name','type','annualFeeMin','annualFeeText','brands','benefits','minimumSpend','spendExclusions','benefitExclusions','description','sourceUrl','termsUrl','imageUrl','tags','issuanceStatus','verifiedAt','verificationNote']}
  for k in ['id','issuer','name','description','verificationNote']:c[k]=text(c[k])
  c['issuer']=issuer_map.get(c['issuer'],c['issuer']);c['annualFeeMin']=money(c['annualFeeMin']);c['minimumSpend']=money(c['minimumSpend']);c['annualFeeText']=text(c['annualFeeText']) or '미확인'
  c['brands']=list(dict.fromkeys(norm_brand(b) for b in (c['brands'] or []) if text(b)))
  for k in ['sourceUrl','termsUrl','imageUrl']:c[k]=url(c[k])
  if not c['sourceUrl']:raise ValueError('Missing official source: '+c['id'])
  for k in ['spendExclusions','benefitExclusions']:c[k]=list(dict.fromkeys(text(s) for s in (c[k] or []) if text(s)))
  bs=[]
  for raw_b in c['benefits'] or []:
   b={k:raw_b.get(k) for k in ['category','title','detail','rate','cap','minimumSpend']}
   for k in ['category','title','detail']:b[k]=text(b[k])
   b['category']=tag_map.get(b['category'],b['category']) or '기타';b['title']=b['title'] or b['category'];
   if b['title'] in ['주요 혜택','주요혜택','혜택','혜택 요약'] and b['detail']:b['title']=b['detail'][:65]
   b['rate']=text(b['rate']) or None;b['cap']=text(b['cap']) or None;b['minimumSpend']=money(b['minimumSpend'])
   # Null rather than a false universal monetary condition is intentional.
   if b['detail'] or b['title']:bs.append(b)
  c['benefits']=bs
  tags=[tag_map.get(text(t).lstrip('#'),text(t).lstrip('#')) for t in c['tags'] or [] if text(t)]
  # Inferred semantic tags use only positive benefit titles/summary, never exclusion lists.
  benefit_text=' '.join([c['description']]+[b['title']+' '+b['detail'].split(' 제외')[0][:260] for b in bs])
  benefit_text=' '.join(s for s in re.split(r'(?<=[.!。])\s+',benefit_text) if not re.search(r'제외|제공되지|미제공|이용불가|중단',s))
  for tag,pattern in patterns.items():
   if re.search(pattern,benefit_text,re.I):tags.append(tag)
  if c['minimumSpend']==0 or any(b['minimumSpend']==0 and not re.search(r'무이자|할부|대출|금융서비스',b['title']) for b in bs):tags.append('무실적')
  c['tags']=list(dict.fromkeys(t for t in tags if t not in ['기타','기본','all','none','일반','신용','체크']))
  c['eligibility']=[text(e) for e in raw.get('eligibility',[]) if text(e)]
  if not c['eligibility']:
   match=re.search(r'발급대상\s*[:：]\s*(.{1,180})',c['description'])
   if match:c['eligibility']=[match[1]]
  c['issuanceStatus']=c['issuanceStatus'] if c['issuanceStatus'] in ['confirmed','catalog','unknown'] else 'unknown'
  c['verifiedAt']=c['verifiedAt'] or '2026-10-05'
  if not c['id'] or not c['name']:raise ValueError('Missing product identity')
  # Issuer-local official product IDs are authoritative; keep distribution/design variants explicit.
  if c['id'] in cards:dedup.append(c['id'])
  cards[c['id']]=c
  provenance[c['id']]={'researchGroup':group,'sourceUrl':c['sourceUrl'],'originalBrands':raw.get('brands',[]),'rawSourceData':raw.get('rawSourceData'),'observedAnnualFeeText':raw.get('annualFeeText')}
coverage=[];seen=set()
for group in ['shinhan-kb','samsung-hyundai','woori-hana','nh-bc-lotte-ibk','regional','internet']:
 path=research/(group+'-coverage.json')
 if not path.exists():continue
 x=json.loads(path.read_text());rows=x if isinstance(x,list) else x.get('coverage',x.get('issuers',[]))
 for raw in rows:
  issuer=issuer_map.get(raw.get('issuer'),raw.get('issuer'))
  if not issuer or issuer in seen:continue
  seen.add(issuer)
  coverage.append(dict(issuer=issuer,sourceUrl=url(raw.get('sourceUrl')),listedCount=sum(c['issuer']==issuer for c in cards.values()),fullyEnumerated=bool(raw.get('fullyEnumerated')),notes=text(raw.get('notes'))))
for issuer in set(c['issuer'] for c in cards.values())-seen:
 c=next(c for c in cards.values() if c['issuer']==issuer);coverage.append(dict(issuer=issuer,sourceUrl=c['sourceUrl'],listedCount=sum(x['issuer']==issuer for x in cards.values()),fullyEnumerated=False,notes='공식 상품 자료 수집. 기관 전체 공개 목록 전수 확인은 미완료.'))
events=json.loads((research/'events.json').read_text())
for e in events:
 e['tags']=list(dict.fromkeys(tag_map.get(t.lstrip('#'),t.lstrip('#')) for t in e['tags']));e['sourceUrl']=url(e['sourceUrl']);e['imageUrl']=url(e['imageUrl'])
 if not e['sourceUrl']:raise ValueError('Missing event source')
ordered=sorted(cards.values(),key=lambda c:(c['issuer'],c['name']))
for name,value in [('cards',ordered),('events',events),('coverage',coverage),('provenance',provenance)]:
 (root/'data'/(name+'.json')).write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n')
summaries=[]
for c in ordered:
 summary=dict(c);summary['benefits']=[dict(b,title=b['title'][:65],detail=b['detail'][:80],cap=None) for b in c['benefits'][:2]];summary['benefitCount']=len(c['benefits']);summary['searchText']=' '.join([c['description']]+[b['title']+' '+b['detail'] for b in c['benefits']]);summary['spendExclusions']=[];summary['benefitExclusions']=[];summary['eligibility']=[];summary['description']=c['description'][:100];summary['annualFeeText']='브랜드별 본인 연회비는 상세 조건 확인';summary['verificationNote']='상세 조건은 상품 상세에서 불러옵니다.';summaries.append(summary)
(root/'data/summaries.json').write_text(json.dumps(summaries,ensure_ascii=False,separators=(',',':'))+'\n')
stats={'cardCount':len(ordered),'issuerCount':len(set(c['issuer'] for c in ordered)),'confirmedCount':sum(c['issuanceStatus']=='confirmed' for c in ordered),'documentCount':sum(bool(c['termsUrl']) for c in ordered)}
(root/'data/stats.json').write_text(json.dumps(stats)+'\n')
(root/'public/catalog-snapshot.json').write_text(json.dumps({'cards':summaries,'stats':stats},ensure_ascii=False,separators=(',',':'))+'\n')
revision=hashlib.sha256(json.dumps([ordered,events],ensure_ascii=False,sort_keys=True).encode()).hexdigest()
(root/'data/revision.json').write_text(json.dumps({'value':revision})+'\n')
print(json.dumps({'products':len(ordered),'issuers':len(set(c['issuer'] for c in ordered)),'credit':sum(c['type']=='credit' for c in ordered),'debit':sum(c['type']=='debit' for c in ordered),'confirmed':sum(c['issuanceStatus']=='confirmed' for c in ordered),'terms':sum(bool(c['termsUrl']) for c in ordered),'annualFees':sum(c['annualFeeMin'] is not None for c in ordered),'events':len(events),'issuersByCount':dict(Counter(c['issuer'] for c in ordered)),'duplicateIds':dedup},ensure_ascii=False,indent=2))
