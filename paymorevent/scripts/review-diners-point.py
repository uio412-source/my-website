"""Separate the product's own earning table into service and tier records.
The 2.3% headline belongs to the 3M tier, not the first 1M threshold.
"""
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
cards=json.loads((ROOT/'data/cards.json').read_text())
research=json.loads((ROOT/'data/woori-policy-research.json').read_text())
c=next(c for c in cards if c['id']=='woori-102033');d=research[c['id']]
assert d['readStatus']=='read' and str(d['productCode'])=='102033'
text=' '.join(d['lines'])
for fragment in ['기본적립','0.5%','100만원 이상','1%','300만원 이상','0.3%','5만점','1모아포인트=1꿀=1원']:
 assert fragment in text.replace(' : ',':'),fragment
url=d['url']
def rate(label,pct,minimum,note,cap=None,**more):
 return dict(label=label,spendUnit=100,rewardUnits=pct,rewardUnit='우리WON꿀머니',unitValue=1,minimumSpend=minimum,minimumSpendScope='전월 국내 가맹점 이용액',monthlyCapValue=cap,sourceUrl=url,note=note,verified=True,**more)
c['rewardRates']=[
 rate('국내 기본 적립',1,0,'국내 가맹점 기본 1%, 한도 없음. 롯데·신라면세점 제외.'),
 rate('국내 우리WON페이 · 무실적',1.3,0,'기본 1%+우리WON페이 추가 0.3%. 각각 한도 없음.',channel='우리WON페이'),
 rate('국내 우리WON페이 · 100만원 구간',1.8,1000000,'기본 1%+실적 추가 0.5%+우리WON페이 0.3%=1.8%. 실적 추가분 월 5만점 한도. 당월 100만원 사용 시 18,000원.',fallbackRewardUnits=1.3,additionalMonthlyCapValue=50000,channel='우리WON페이'),
 rate('국내 우리WON페이 · 300만원 구간',2.3,3000000,'기본 1%+실적 추가 1%+우리WON페이 0.3%=2.3%. 0.5%와 1% 구간은 중복 아님. 실적 추가분 월 5만점 한도. 당월 300만원 사용 시 69,000원.',fallbackRewardUnits=1.3,additionalMonthlyCapValue=50000,channel='우리WON페이'),
 rate('해외·롯데/신라면세점 적립',2,0,'월 5만점. 국내 기본·실적 추가·우리WON페이 추가와 중복 제공하지 않음. 해외 이용액은 국내 전월실적에서 제외.',cap=50000),
]
old=next((b for b in c['benefits'] if b['title']=='포인트 적립 서비스'),None)
if old:
 own=next(doc for doc in c['documents'] if doc['url']==url)
 if not any(e['field']=='benefits' and e['scope']=='포인트 적립 서비스' for e in own['excerpts']):own['excerpts'].append(dict(field='benefits',scope='포인트 적립 서비스',text=old['detail']))
 c['benefits'].remove(old)
 new=[]
 for r in c['rewardRates']:
  new.append(dict(category='포인트 적립',title=r['label'],detail=r['note']+' / 상품권 구매·충전, 국세·지방세, 공과금·관리비, 무이자할부 등 적립 제외.',rate=f"{r['rewardUnits']:g}%",cap='실적 추가분 월 5만점' if 'additionalMonthlyCapValue' in r else '월 5만점' if r['monthlyCapValue'] else '한도 없음',minimumSpend=r['minimumSpend'],minimumSpendVerified=True,sourceUrl=url,kind='benefit'))
 c['benefits']=new+c['benefits']
c['minimumSpend']=0;c['rewardModelComplete']=True;c['feeWaivers']=[]
for b in c['benefits']:
 if '보너스' in b['title'] or b['title'] in ['프리미엄 여행 할인권 20만원','국제 브랜드 서비스(해외겸용카드 전용)'] or '바우처' in b['detail'] and '기프트' in b['title']:b['kind']='voucher'
c['databaseAudit'].update(reviewStatus='reviewed',checkedAt=d['checkedAt'],note='상품코드 102033 공식 포인트 적립표와 공통 유의사항 대조. 국내 100만원 1.8%, 300만원 2.3% (우리WON페이 포함). 실적 추가분 월 5만점과 해외·면세점 월 5만점 분리. 연간 보너스·기프트 제외.')
c['description']='국내 기본 1% · 우리WON페이 1.3~2.3% · 해외/면세점 2%. 구간별 추가 적립과 월 한도를 분리한 포인트 카드'
(ROOT/'data/cards.json').write_text(json.dumps(cards,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'id':c['id'],'tier1000000':18000,'tier3000000':69000,'maximum':2.3}))
