"""Flat PDF text does not establish a complete exclusion list in column layouts."""
import json
from pathlib import Path
root=Path(__file__).resolve().parent.parent
cards=json.loads((root/'data/cards.json').read_text());changed=0
for c in cards:
 if c['databaseAudit']['reviewStatus']=='reviewed':continue
 pdfs={d['url'] for d in c.get('documents',[]) if d['format']=='pdf'}
 for e in [*c['paymentEligibility'].values(),*c.get('eligibilityRules',[])]:
  if e.get('basis')!='full_exclusion_list' or e.get('sourceUrl') not in pdfs:continue
  for axis in ['spend','benefit']:
   if e[axis]=='allowed':e[axis]='unknown';changed+=1
  if 'PDF 열 배치에서' not in e.get('note',''):e['note']=e.get('note','')+' PDF 열 배치에서 제외목록 전체 범위가 검증되지 않아 항목 부재만으로 가능을 단정하지 않습니다.'
(root/'data/cards.json').write_text(json.dumps(cards,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'unverifiedPdfPositiveAxesDeferred':changed}))
