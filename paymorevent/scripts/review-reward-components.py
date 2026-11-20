"""Review every product independently. Preserve uncertain fee/spend conditions as null.
Only curated, product-matched earning combinations enter the highest-rate model.
"""
import json,re,collections
from datetime import datetime
from zoneinfo import ZoneInfo
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
cs=json.loads((ROOT/'data/cards.json').read_text());ds=json.loads((ROOT/'data/document-research.json').read_text())['documents'];DAY=datetime.now(ZoneInfo('Asia/Seoul')).date().isoformat()
def rate(label,unit,reward,minSpend,url,note,cap=None):return dict(label=label,spendUnit=unit,rewardUnits=reward,rewardUnit='대한항공 마일',unitValue=20,minimumSpend=minSpend,monthlyCapValue=cap,sourceUrl=url,note=note,verified=True)
def fee(label,value,minimum,url,note,verified=True):return dict(label=label,rate=value,minimumSpend=minimum,channel='해외 가맹점 결제',sourceUrl=url,note=note,verified=verified)
audit=[]
for c in cs:
 matched=[d for d in c.get('documents',[]) if d['kind']!='brand' and d['identityStatus']=='matched' and d['readStatus']=='read']
 lines=[]
 for d in matched:
  for i,l in enumerate(ds.get(d['url'],{}).get('lines',[])):
   if re.search(r'(?:해외|국제.?브랜드).{0,45}수수료.{0,45}면제|수수료.{0,30}면제.{0,30}(?:해외|국제.?브랜드)',l):lines.append((d['url'],' '.join(ds[d['url']]['lines'][max(0,i-2):i+7])))
 for b in c['benefits']:
  if re.search(r'(?:해외|국제.?브랜드).{0,45}수수료.{0,45}면제|수수료.{0,30}면제.{0,30}(?:해외|국제.?브랜드)',b['title']+' '+b['detail']):lines.append((b.get('sourceUrl',c['sourceUrl']),b['title']+' '+b['detail']))
 # Capture all source evidence; never assign an issuer-wide standard fee or copy sibling conditions.
 c['feeWaivers']=[fee('수수료 면제 원문 · 적용 거래 확인 필요',None,None,url,text[:5000],False) for url,text in dict.fromkeys(lines)]
 if c['id']=='woori-102488':
  url='https://m.wooricard.com/ai-data/cardDetail_standardEveryMileSkypass.html'
  f=fee('해외 결제 수수료 1.3% 면제',1.3,0,url,'Mastercard 해외 현지통화 신용 결제: 국제브랜드 1%+해외서비스 0.3%. 해외 온라인 결제 포함. 원화결제 추가 수수료·국내 PG·ATM·현금서비스 제외. 실적 조건 없음.')
  c['feeWaivers']=[f];c['rewardRates']=[rate('국내 기본 적립',1000,1,0,url,'기본 적립 한도 없음. 1마일=20원.'),rate('해외 기본+추가 적립 · 월 100만원까지',1000,2,0,url,'기본 1마일+추가 1마일. 추가 월 1,000마일, 본인+가족 합산. 해외 월 100만원까지 총 2,000마일=40,000원. 추가 한도 초과분 기본 1마일(2%)+수수료 면제 1.3%=3.3%.',40000)]
  c['rewardRates'][1]['feeWaiver']=f;c['rewardModelComplete']=True;c['minimumSpend']=0
  base=c['benefits'][0];base.update(rate='1,000원당 기본 1마일 / 해외 총 2마일',cap='기본 한도 없음 / 해외 추가 월 1,000마일 (본인+가족 합산)',minimumSpend=0,minimumSpendVerified=True,sourceUrl=url)
  c['benefits']=[b for b in c['benefits'] if b['title']!='해외 결제 수수료 면제']+[dict(category='해외 수수료',title='해외 결제 수수료 면제',detail=f['note'],rate='1.3%',cap='해외 추가 적립 월 100만원까지 최고 5.3%, 초과분 3.3%',minimumSpend=0,minimumSpendVerified=True,sourceUrl=url)]
  c['databaseAudit'].update(reviewStatus='reviewed',note='기본·추가 적립표, 본인+가족 합산 한도, Mastercard 해외 결제 수수료, 전월실적·적립 제외 원문 개별 대조.')
 elif c['id'] in ['samsung-aap1450','samsung-aap1451','samsung-aap1484','samsung-aap1485']:
  bs=[b for b in c['benefits'] if '마일' in b['title'] and not re.search(r'연간|기프트|보너스',b['title'])];assert any('2 마일리지' in b['detail'] or '2마일리지' in b['detail'] for b in bs)
  c['rewardRates']=[rate('국내외 기본 적립',1000,1,0,c['sourceUrl'],'기본 적립 전월실적·한도 없음.'),rate('옵션 업종 기본+추가 적립',1000,2,0,c['sourceUrl'],'선택한 국내형/해외형 대상 업종에 한함. 총 2마일, 기본과 추가를 다시 중복 합산하지 않음. 옵션별 월 추가 적립 한도는 상품 혜택표 참조.',80000)]
  c['minimumSpend']=0
 elif c['id']=='hana-9912':
  text=' '.join(b['detail'] for b in c['benefits']);assert '1.2마일리지' in text and '지난달 실적 관계 없이' in text
  c['rewardRates']=[rate('국내 기본 적립',1500,1,0,c['sourceUrl'],'지난달 실적 및 적립 한도 없음.'),rate('해외 적립',1500,1.2,0,c['sourceUrl'],'해외 일시불 이용금액, 지난달 실적 및 적립 한도 없음. 진에어 청구할인 적용 매출 적립 제외.')]
 elif c['id']=='hana-15125':
  text=' '.join(b['detail'] for b in c['benefits']);assert '해외 이용금액 1천원당 2마일리지 50만원 이상 제한없음' in text
  c['rewardRates']=[rate('국내외 기본 적립',1000,1,0,c['sourceUrl'],'실적 조건·적립 한도 없음. 해외 지난달 실적 50만원 미만은 기본 1마일.'),rate('해외 특별 적립',1000,2,500000,c['sourceUrl'],'지난달 실적 50만원 이상. 적립 한도 없음. 해외 수수료는 별도 부과되며 면제로 합산하지 않음.')]
 elif c['id']=='nh-90010544':
  source=c['sourceUrl'];text=' '.join(ds[source]['lines']);assert '0.25%' in text and '1.0%' in text and '전월실적과 관계없이 제공, 한도 없음' in text
  f=fee('Mastercard 해외 결제 수수료 면제',1.25,0,source,'해외서비스 0.25%+국제브랜드 1%. Mastercard 발급·해외 이용 시, 실적·한도 없음. 원화 결제 추가 수수료 및 ATM 인출 제외.')
  c['feeWaivers']=[f]
  for r in c['rewardRates']:
   if r['label'].startswith('해외'):r['feeWaiver']=f
  c['rewardModelComplete']=True
 elif c['id']=='shinhan-202406130001':
  source=c['sourceUrl'];text=' '.join(ds[source]['lines']);assert '0.18%' in text and '국내 이용 추가 적립' in text and '월 5만 포인트' in text
  f=fee('해외 결제 수수료 면제',1.18,0,source,'Mastercard 해외 일시불 결제: 국제브랜드 1%+해외서비스 0.18%. ATM 인출은 국내 전월 40만원 조건으로 별도, 환율우대 가치는 비율에 합산하지 않음.')
  def point(label,pct,minimum,note):return dict(label=label,spendUnit=100,rewardUnits=pct,rewardUnit='마이신한포인트',unitValue=1,minimumSpend=minimum,monthlyCapValue=50000,sourceUrl=source,note=note,verified=True)
  c['rewardRates']=[point('국내 기본 적립',.5,0,'국내 기본·추가 통합 월 5만 포인트.'),point('국내 대상 업종 기본+추가 적립',2,400000,'국내 전월 40만원 이상. 기본 0.5%+추가 1.5%. 국내 통합 월 5만 포인트. 추가 대상 영역의 실제 업종·요일 조건 적용.'),point('해외 일시불 적립',.5,0,'해외 적립 월 5만 포인트. 국내 한도와 별도. 해외 할부전환 제외.')]
  c['rewardRates'][2]['feeWaiver']=f;c['feeWaivers']=[f];c['rewardModelComplete']=True;c['minimumSpend']=0
 elif c['id']=='woori-102722':
  source=next(d['url'] for d in matched if ds.get(d['url'],{}).get('productCode')=='102722');text=' '.join(ds[source]['lines']);assert '(0.3%)' in text and '(1.1%)' in text and '해외신용결제' in text
  f=fee('해외 신용 결제 수수료 면제',1.4,0,source,'국제브랜드 1.1%+해외서비스 0.3%. VISA 해외 신용 결제에 적용. 선불 트래블페이 결제에는 포인트 적립이 제공되지 않으므로 적립과 합산하지 않음. ATM 제외.')
  def point(label,pct,minimum,note):return dict(label=label,spendUnit=100,rewardUnits=pct,rewardUnit='트래블 포인트',unitValue=1,minimumSpend=minimum,monthlyCapValue=None,sourceUrl=source,note=note,verified=True)
  c['rewardRates']=[point('해외 수수료 면제 · 무실적',0,0,'전월실적 없이 해외 결제 수수료만 면제.'),point('국내 트래블 포인트 적립',1,400000,'국내 전월실적 40만원 이상, 적립 한도 없음. 1포인트=1원.'),point('해외 신용 트래블 포인트 적립',2,400000,'국내 전월실적 40만원 이상, 적립 한도 없음. 트래블페이 선불 이용금액은 적립 제외.')]
  c['rewardRates'][0]['feeWaiver']=f;c['rewardRates'][2]['feeWaiver']=f;c['feeWaivers']=[f];c['rewardModelComplete']=True;c['minimumSpend']=0
 # Fully explicit KB waiver percentages are recorded even when other card benefits prevent proving its maximum.
 elif c['id'] in ['kb-09561','kb-09771']:
  b=next(b for b in c['benefits'] if '수수료 면제' in b['title']);assert '1%' in b['detail'] and '0.25%' in b['detail']
  c['feeWaivers']=[fee('해외 결제 수수료 면제',1.25,0,c['sourceUrl'],'국제브랜드 1%+해외서비스 0.25%, 실적 조건 없음. 카드의 다른 혜택과 결제 채널·통합 한도 대조 전에는 최고피킹률을 단정하지 않음.')]
 checks={
 '상품 일치 원문':bool(matched),'혜택 본문':any(len(b['detail'])>30 for b in c['benefits']),
 '실적 제외 원문':bool(c['spendExclusions']),'혜택 제외 원문':bool(c['benefitExclusions']),
 '전월실적':c['minimumSpend'] is not None,'적립 단위·가치':bool(c.get('rewardRates')),
 '상품권·국세·지방세·관리비':all(e[a]!='unknown' for e in c['paymentEligibility'].values() for a in ['spend','benefit']),
 '수수료 조건':not lines or bool(c['feeWaivers']) and all(f['verified'] for f in c['feeWaivers'])}
 audit.append({'id':c['id'],'name':c['name'],'issuer':c['issuer'],'checks':checks,'missing':[k for k,v in checks.items() if not v],'feeEvidenceCount':len(lines),'reviewStatus':c['databaseAudit']['reviewStatus']})
 c['databaseAudit']['processedAt']=DAY
(ROOT/'data/cards.json').write_text(json.dumps(cs,ensure_ascii=False,indent=2)+'\n')
report={'checkedAt':DAY,'cardCount':len(cs),'feeEvidenceCards':sum(bool(a['feeEvidenceCount']) for a in audit),'feeConditionsVerified':sum(bool(c['feeWaivers']) and all(f['verified'] for f in c['feeWaivers']) for c in cs),'records':audit}
(ROOT/'data/product-review-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps({k:v for k,v in report.items() if k!='records'},ensure_ascii=False))
