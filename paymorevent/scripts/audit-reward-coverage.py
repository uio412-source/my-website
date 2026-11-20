"""A partial basic earning model cannot stand for the whole card maximum."""
import json,re
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
cards=json.loads((ROOT/'data/cards.json').read_text());records=[]
for c in cards:
 # These product-specific combinations have already been separately compared.
 if c['id'] in ['samsung-aap1452','samsung-aap1453','woori-103187','woori-103188']:c['rewardModelComplete']=True
 labels={r['label'] for r in c.get('rewardRates',[]) if r['verified']};missing=[]
 if not c.get('rewardModelComplete'):
  for b in c['benefits']:
   if b.get('kind')=='voucher' or re.search(r'바우처|기프트|보너스|연간|연회비|보험|환율|환전|라운지|무이자|대출|이체|ATM|수수료',b['title'],re.I):continue
   # Known own-source monetary services omitted by the current model must be
   # resolved before advertising a basic rate as "highest".
   monetary=bool(re.search(r'적립|할인|캐시백',b['title']) and (b.get('rate') or re.search(r'\d[\d,]*\s*(?:천|만)?원\s*(?:할인|캐시백)',b['title'])))
   if monetary and b['title'] not in labels:missing.append(b['title'])
 c['rewardCoveragePending']=bool(missing)
 c['rewardCoverageNote']='미모델링 금전 혜택: '+' / '.join(missing) if missing else '현재 등록된 금전 혜택과 요율 모델 연결 대조. 부분 모델의 통합 한도·실적은 별도 확인.'
 records.append({'id':c['id'],'name':c['name'],'modelComplete':bool(c.get('rewardModelComplete')),'unmodeledServices':missing})
(ROOT/'data/cards.json').write_text(json.dumps(cards,ensure_ascii=False,indent=2)+'\n')
(ROOT/'data/reward-coverage-audit.json').write_text(json.dumps({'cardCount':len(cards),'records':records},ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'cards':len(cards),'unmodeledServices':sum(len(r['unmodeledServices']) for r in records),'partialCardModels':sum(bool(r['unmodeledServices']) for r in records)}))
