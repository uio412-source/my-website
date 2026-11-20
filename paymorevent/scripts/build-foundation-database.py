"""Uniform, lossless relational export of EVERY catalog product and benefit.
Explicitly separate source text, extraction candidates and verified calculations.
Never fill an unknown threshold/cap/point value with zero or an issuer default.
"""
import collections,gzip,hashlib,json,re
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo
from lxml import html
from importlib import import_module
extract_table_tiers=import_module('extract-foundation-tiers').extract_table_tiers
ROOT=Path(__file__).resolve().parent.parent
cards=json.loads((ROOT/'data/cards.json').read_text())
source=json.loads((ROOT/'data/document-research.json').read_text())['documents']
day=datetime.now(ZoneInfo('Asia/Seoul')).date().isoformat()
def key(prefix,*parts):return prefix+'-'+hashlib.sha256('|'.join(map(str,parts)).encode()).hexdigest()[:20]
def money(s):
 s=s.replace(',','').replace(' ','');m=re.fullmatch(r'(\d+(?:\.\d+)?)(억|만|천)?(?:원|점|포인트|P|마일)?',s,re.I)
 return float(m[1])*{'억':100000000,'만':10000,'천':1000,None:1}[m[2]] if m else None
def snippets(text,pattern):
 # Retain bounded local statements as candidates, not verified relational joins.
 return list(dict.fromkeys(m.group(0).strip() for m in re.finditer(pattern,text)))
fields={
 '전월실적':r'[^.。\n]{0,40}(?:전월|지난달)[^.。\n]{0,140}',
 '월 한도':r'[^.。\n]{0,30}(?:통합\s*월|월\s*(?:할인|적립|캐시백|이용)?\s*한도|한도\s*없|한도\s*없이)[^.。\n]{0,120}',
 '건별 조건':r'[^.。\n]{0,25}(?:건당|건별|1회|회당)[^.。\n]{0,100}',
 '일·월·연 횟수':r'[^.。\n]{0,20}(?:일|월|연)\s*\d+\s*회[^.。\n]{0,60}',
 '연간 조건':r'[^.。\n]{0,25}(?:연간|연\s*한도|매년|전년도)[^.。\n]{0,100}',
 '공유·선택 조건':r'[^.。\n]{0,30}(?:가족|합산|통합|택\s*1|선택)[^.。\n]{0,110}',
 '기본·추가·초과 관계':r'[^.。\n]{0,30}(?:기본적립|추가적립|추가\s*적립|한도\s*초과|중복)[^.。\n]{0,120}',
 '결제 방식·채널':r'[^.。\n]{0,20}(?:온라인|오프라인|자동납부|자동이체|간편결제|WON페이|KB\s*Pay|삼성페이|해외|국내)[^.。\n]{0,80}',
 '적립 단위·절사':r'[^.。\n]{0,25}(?:[\d,.]+\s*(?:천|만)?\s*원당|절사|소수점|반올림)[^.。\n]{0,100}',
}
refreshPath=ROOT/'data/source-refresh-audit.json.gz'
refresh=json.loads(gzip.decompress(refreshPath.read_bytes())) if refreshPath.exists() else {'records':[]}
attempts={r['url']:r for r in refresh['records']}
out=dict(schemaVersion=2,processedAt=day,products=[],services=[],constraints=[],models=[],paymentRules=[],documents=[],sourceTables=[],sourceRefresh=[],fieldAudit=[],dataDictionary=[])
tableCache={}
def official_tables(url):
 if url in tableCache:return tableCache[url]
 records=[];path=ROOT/'scripts/card-research-cache'/(hashlib.sha256(url.encode()).hexdigest()+'.bin')
 if path.exists():
  raw=path.read_bytes()
  if not raw.startswith(b'%PDF'):
   try:
    try:page=html.fromstring(raw.decode('utf-8'))
    except UnicodeDecodeError:page=html.fromstring(raw.decode('euc-kr',errors='replace'))
    for el in page.xpath('//header|//footer|//nav|//script|//style'):el.drop_tree()
    for i,t in enumerate(page.xpath('//table')):
     body=re.sub(r'\s+',' ',' '.join(t.itertext())).strip()
     if not re.search(r'적립|할인|실적|한도|연회비|포인트|마일',body) or not re.search(r'\d',body):continue
     caption=' '.join(t.xpath('./caption//text()')).strip() or t.get('summary','')
     if not caption:
      h=t.xpath('preceding::*[self::h2 or self::h3 or self::h4 or self::h5][1]')
      caption=re.sub(r'\s+',' ',' '.join(h[0].itertext())).strip() if h else '공식 원문 표'
     occupied={};grid=[]
     for ri,tr in enumerate(t.xpath('./thead/tr|./tbody/tr|./tfoot/tr|./tr')):
      ci=0
      for cell in tr.xpath('./th|./td'):
       while (ri,ci) in occupied:ci+=1
       value=re.sub(r'\s+',' ',' '.join(cell.itertext())).strip()
       rs=min(100,int(cell.get('rowspan','1') or '1'));cl=min(100,int(cell.get('colspan','1') or '1'))
       for rr in range(ri,ri+rs):
        for cc in range(ci,ci+cl):occupied[rr,cc]=value
       ci+=cl
      width=max([cc+1 for rr,cc in occupied if rr==ri],default=0)
      grid.append([occupied.get((ri,cc),'') for cc in range(width)])
     if grid:records.append(dict(tableId=key('table',url,i),caption=caption,grid=grid))
   except (ValueError,TypeError):pass
 tableCache[url]=records;return records
for c in cards:
 matched=[d for d in c.get('documents',[]) if d['kind']!='brand' and d['identityStatus']=='matched' and d['readStatus']=='read']
 docids={d['url']:key('doc',d['url']) for d in c.get('documents',[])}
 docmap={d['url']:d for d in matched}
 missing=[]
 out['products'].append(dict(cardId=c['id'],issuer=c['issuer'],name=c['name'],type=c['type'],minimumSpend=c['minimumSpend'],annualFee=c['annualFeeMin'],sourceUrl=c['sourceUrl'],termsUrl=c.get('termsUrl'),sourceCount=len(matched),pdfCount=sum(d['format']=='pdf' for d in matched),serviceCount=len(c['benefits']),modelCount=len(c.get('rewardRates',[])),modelComplete=c.get('rewardModelComplete',False),reviewStatus=c['databaseAudit']['reviewStatus']))
 for d in c.get('documents',[]):
  out['documents'].append(dict(cardId=c['id'],documentId=docids[d['url']],**d))
  a=attempts.get(d['url'])
  out['sourceRefresh'].append(dict(cardId=c['id'],name=c['name'],documentId=docids[d['url']],sourceUrl=d['url'],kind=d['kind'],identityStatus=d['identityStatus'],attemptedAt=a.get('attemptedAt') if a else None,readStatus=a.get('readStatus') if a else '이번 재확보 대상 외',format=a.get('format') if a else d['format'],sha256=a.get('sha256') if a else d.get('sha256'),note=a.get('error','본문 재확보. 개별 혜택·한도 대조 완료와 구별합니다.') if a else '브랜드/미일치 자료는 해당 상품 혜택 근거로 대체하지 않습니다.'))
  if a and a['readStatus']!='read':out['fieldAudit'].append(dict(cardId=c['id'],name=c['name'],serviceId=None,scope=d['kind'],field='공식 원문 재확보',status='확인 필요',sourceUrl=d['url'],note=a.get('error','확보 실패. 기존 자료 날짜를 유지합니다.')))
 for d in matched:
  for t in official_tables(d['url']):
   for rowno,row in enumerate(t['grid'],1):out['sourceTables'].append(dict(cardId=c['id'],name=c['name'],documentId=docids[d['url']],tableId=t['tableId'],scope=t['caption'],row=rowno,cells=row,sourceUrl=d['url'],checkedAt=d['checkedAt'],status='원문 표 · 열 관계 보존'))
 used=collections.Counter()
 for i,b in enumerate(c['benefits']):
  identity=(b['title'],b['category']);used[identity]+=1
  sid=key('svc',c['id'],*identity,used[identity]);url=b.get('sourceUrl',c['sourceUrl']);own=docmap.get(url)
  # A source URL alone does not prove that this particular service was read.
  body=' '.join(source.get(url,{}).get('lines',[]));plain=lambda s:re.sub(r'\s+','',s)
  sourceMatch=bool(own and len(plain(b['title']))>3 and plain(b['title']) in plain(body))
  models=[r for r in c.get('rewardRates',[]) if r['label']==b['title'] and r['verified']]
  minimumVerified=b.get('minimumSpendVerified',False) or bool(models) and c.get('rewardModelComplete',False)
  text=' '.join([b['title'],b['detail'],b.get('cap') or ''])
  status='개별 대조' if c['databaseAudit']['reviewStatus']=='reviewed' and own else '원문 추출' if sourceMatch else '근거 대조 필요'
  service=dict(serviceId=sid,cardId=c['id'],name=c['name'],title=b['title'],category=b['category'],kind=b.get('kind','benefit'),rateText=b.get('rate'),minimumSpendCandidate=b['minimumSpend'],minimumSpend=b['minimumSpend'] if minimumVerified else None,minimumSpendStatus='대조' if minimumVerified else '미확인' if b['minimumSpend'] is None else '추출 후보',capText=b.get('cap'),detail=b['detail'],spendExclusions=b.get('spendExclusions',[]),benefitExclusions=b.get('benefitExclusions',[]),documentId=docids.get(url),sourceUrl=url,sourceMatch=sourceMatch,sourceCheckedAt=own.get('checkedAt') if own else None,status=status)
  out['services'].append(service)
  for f,pat in fields.items():
   quotes=snippets(text,pat)
   if quotes:out['constraints'].append(dict(constraintId=key('clause',sid,f),cardId=c['id'],serviceId=sid,field=f,quote='\n'.join(quotes),sourceUrl=url,documentId=docids.get(url),status='대조' if status=='개별 대조' else '원문 후보'))
  servicegaps=[]
  if not own:servicegaps.append('혜택에 연결된 상품 일치 원문')
  if b.get('kind')!='voucher':
   if b['minimumSpend'] is None:servicegaps.append('혜택별 전월실적')
   elif not minimumVerified:servicegaps.append('전월실적 구간 대조')
   if not b.get('cap') and not re.search(r'한도\s*(?:없|제한\s*없)',text):servicegaps.append('월·영역·건별 한도')
  for f in servicegaps:out['fieldAudit'].append(dict(cardId=c['id'],name=c['name'],serviceId=sid,scope=b['title'],field=f,status='확인 필요',sourceUrl=url,note='같은 카드사의 기본값이나 다른 상품 조건으로 보충하지 않습니다.'))
 for n,r in enumerate(c.get('rewardRates',[])):
  sid=next((s['serviceId'] for s in reversed(out['services']) if s['cardId']==c['id'] and s['title']==r['label']),None)
  out['models'].append(dict(modelId=key('model',c['id'],r['label']),cardId=c['id'],name=c['name'],serviceId=sid,**r,cardMaximumComplete=c.get('rewardModelComplete',False)))
 # Keep representative search judgments and service-level rules distinct.
 for item,e in c.get('paymentEligibility',{}).items():out['paymentRules'].append({**e,'ruleId':key('rule',c['id'],'대표',item),'cardId':c['id'],'name':c['name'],'item':item,'scope':'검색 대표 판정'})
 for e in c.get('eligibilityRules',[]):out['paymentRules'].append(dict(ruleId=key('rule',c['id'],e['item'],e.get('scope',''),e.get('evidence','')),cardId=c['id'],name=c['name'],**e))
 # Gift purchase and prepaid reload are different filters. Only explicit scoped
 # negatives are added here; absence from an excerpt does not imply eligibility.
 for d in matched:
  for e in d['excerpts']:
   if e['field'] not in ['spendExclusions','benefitExclusions']:continue
   for item,pat in [('상품권 구매',r'상품권.{0,20}(?:구매|구입)|상품권/'),('선불·기프트 충전',r'(?:선불|기프트).{0,25}충전'),('공과금',r'공과금|공공요금'),('4대보험',r'4대\s*보험|건강보험|국민연금'),('등록금',r'등록금')]:
    if re.search(pat,e['text']):out['paymentRules'].append(dict(ruleId=key('rule',c['id'],item,e['scope'],e['text'],e['field']),cardId=c['id'],name=c['name'],item=item,scope=e['scope'],spend='excluded' if e['field']=='spendExclusions' else 'unknown',benefit='excluded' if e['field']=='benefitExclusions' else 'unknown',basis='explicit',evidence=e['text'],note='해당 원문 서비스 범위의 명시적 제외. 반대 축은 별도 확인.',sourceUrl=d['url'],documentId=docids[d['url']],checkedAt=d['checkedAt']))
 for f,ok in [('상품 일치 원문',bool(matched)),('실적 제외 원문',bool(c['spendExclusions'])),('혜택 제외 원문',bool(c['benefitExclusions'])),('전체 금전 혜택 계산 모델',c.get('rewardModelComplete',False))]:
  out['fieldAudit'].append(dict(cardId=c['id'],name=c['name'],serviceId=None,scope='상품 전체',field=f,status='확보' if ok else '확인 필요',sourceUrl=c['sourceUrl'],note='본문 확보·자동 추출·개별 대조는 서로 다른 상태입니다.'))
 # A product remains in the master table even if no benefits were obtainable.
 if not c['benefits']:out['fieldAudit'].append(dict(cardId=c['id'],name=c['name'],serviceId=None,scope='상품 전체',field='혜택 본문',status='확인 필요',sourceUrl=c['sourceUrl'],note='본문 수집 실패 상품도 전체 DB에서 누락하지 않습니다.'))
dictionary=[
 ('상품','cardId','카드사+고유 상품코드. 같은 상품명·브랜드·신용/체크를 임의 병합하지 않음'),
 ('혜택','serviceId','상품별 혜택의 고유키. 혜택과 실적/한도/제외조건은 이 키로 연결'),
 ('공식자료','documentId','URL 기반 고유키. 원문 해시·실제 확보일·상품 일치·PDF/HTML·읽기 상태 별도'),
 ('실적','minimumSpend','혜택별 전월 실적. 확인된 무실적만 0, 미확인은 공란. 국내 한정과 해외 포함 구별'),
 ('실적','minimumSpendCandidate','구형 DB/자동 추출 값. 확인값과 분리하며 계산에 자동 채택하지 않음'),
 ('요율','rewardUnits / spendUnit','사용 단위당 총 적립 단위. 기본+추가 중복과 구간별 대안을 구분'),
 ('가치','unitValue','원화 환산. 아코르=30원·힐튼=6원·매리어트=8원·유니마일=1원·대한항공=20원·기타 항공=12원·현금성=1원은 사용자 가정, 미확인 포인트에 1원을 넣지 않음'),
 ('한도','monthlyCapValue','총 적립/할인 월 한도(원화). 확인된 무제한만 공란; 상태·근거를 함께 참조'),
 ('한도','additionalMonthlyCapValue','기본을 제외한 추가분 한도. 총 적립 한도와 혼동하지 않음'),
 ('한도','additionalMonthlyCapUnits','추가 마일/포인트 한도. 단위 가치가 바뀌면 원화 한도도 같이 바뀜'),
 ('한도','specialRewardCapUnits','특별적립 총 포인트 한도. 이 포인트를 소진한 이후의 사용액은 기본률로 적립'),
 ('기본','fallbackRewardUnits','추가 한도 초과 후 기본 적립 단위. 동일 결제에 적용하는 기준'),
 ('계산','최소 실적 구간','전월 조건 충족+당월 같은 금액 사용. MIN(적립액,한도)/사용액. 무실적은 단위 비율'),
 ('계산','카드 전체 최고','전체 금전 혜택·통합 한도·업종 배분 대조 완료 때만 확정. 부분 혜택 계산과 구별'),
 ('결제','spend / benefit','상품권·충전·국세·지방세·관리비 각각 전월실적 인정과 혜택 제공을 별도 판정'),
 ('후보','원문 후보','전월/월/건/연 한도·횟수·결제채널의 근거 발췌. 표 열 관계는 별도 대조 필요'),
 ('제외','연회비·바우처','피킹률에서 연회비 차감하지 않음. 바우처·연간 기프트·연간 보너스·비금전 서비스 제외'),
 ('상태','확인 필요','0%, 무실적, 한도 없음, 적립 가능을 의미하지 않음'),
]
out['dataDictionary']=[dict(group=g,field=f,definition=t) for g,f,t in dictionary]
out['tiers']=extract_table_tiers(out['sourceTables'],key)
for r in out['models']:
 out['tiers'].append(dict(tierId=key('tier',r['modelId']),cardId=r['cardId'],name=r['name'],serviceId=r['serviceId'],tableId=None,scope=r['label'],field='요율 모델',minimumSpend=r['minimumSpend'],minimumInclusive=True,maximumSpend=None,maximumInclusive=None,ratePercent=r['rewardUnits']*r['unitValue']/r['spendUnit']*100,capAmount=r.get('additionalMonthlyCapUnits',r.get('specialRewardCapUnits',r.get('monthlyCapUnits',r.get('additionalMonthlyCapValue',r['monthlyCapValue'])))),capUnit=r['rewardUnit'] if any(k in r for k in ['additionalMonthlyCapUnits','specialRewardCapUnits','monthlyCapUnits']) else '원',relation='기본·추가·초과는 적립 모델 참조',status='전체 모델 대조' if r['cardMaximumComplete'] else '부분 모델',quote=r['note'],documentId=None,sourceUrl=r['sourceUrl']))
out['statistics']={k:len(out[k]) for k in ['products','services','constraints','tiers','models','paymentRules','documents','sourceTables','sourceRefresh','fieldAudit']}
assert len(out['products'])==len(cards)==len({p['cardId'] for p in out['products']})
assert len(out['services'])==sum(len(c['benefits']) for c in cards)
assert len({s['serviceId'] for s in out['services']})==len(out['services'])
(ROOT/'work').mkdir(exist_ok=True)
(ROOT/'work/card-foundation.json').write_text(json.dumps(out,ensure_ascii=False)+'\n')
with gzip.open(ROOT/'data/card-foundation.json.gz','wb',compresslevel=9) as f:f.write((json.dumps(out,ensure_ascii=False)+'\n').encode())
print(json.dumps(out['statistics'],ensure_ascii=False))
