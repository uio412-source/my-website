"""Known source caps: extra miles versus ALL total special points.
Do not apply these product-specific limits to other cards of the same issuer.
"""
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
cards=json.loads((ROOT/'data/cards.json').read_text())
for c in cards:
 for r in c.get('rewardRates',[]):
  if c['id'] in ['samsung-aap1452','samsung-aap1453'] and r['rewardUnits']==2:
   r.update(fallbackRewardUnits=1,additionalMonthlyCapUnits=2000,monthlyCapValue=None)
   prefix='기본 1마일+추가 1마일. 추가 적립만 월 2,000마일 한도, 기본 한도 없음. 특별 업종 이용액 월 200만원까지 4%, 초과분 기본 2%. '
   if not r['note'].startswith(prefix):r['note']=prefix+r['note']
  elif c['id']=='woori-102488' and r['rewardUnits']==2:
   assert '1,000' in r['note'] or '1000' in r['note'] or '100만원' in r['note']
   r.update(fallbackRewardUnits=1,additionalMonthlyCapUnits=1000,monthlyCapValue=None)
  elif c['id'] in ['woori-103187','woori-103188'] and r['minimumSpend']>0:
   r.update(fallbackRewardUnits=1.3 if c['id']=='woori-103187' else 1,specialRewardCapUnits=4000 if c['id']=='woori-103187' else 2000,monthlyCapValue=None)
  elif c['id']=='nh-90010544':r['monthlyCapUnits']=100000
  elif c['id']=='shinhan-202406130001':r['monthlyCapUnits']=50000
(ROOT/'data/cards.json').write_text(json.dumps(cards,ensure_ascii=False,indent=2)+'\n')
print('Reviewed cap quantities normalized; no issuer-wide inference.')
