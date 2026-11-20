"""Extract benefit amounts, never the spend-tier column, from cap tables."""
import json,re
from pathlib import Path
root=Path(__file__).resolve().parent.parent
cards=json.loads((root/'data/cards.json').read_text())
for c in cards:
 for r in c.get('rewardRates',[]):
  if c['id'] in ['nh-90010544','woori-103187','woori-103188','samsung-aap1452','samsung-aap1453']:continue
  note=r['note']
  # Tier tables: 원/P amounts are rewards, whereas 만원 amounts are spend tiers.
  if re.search(r'전월|이용금액대별',note):
   rewards=re.findall(r'([\d,]+)\s*(?:원|P|포인트|점)',note)
   rewards=[int(n.replace(',','')) for n in rewards]
   if rewards:r['monthlyCapValue']=min(rewards)
   else:r['verified']=False
(root/'data/cards.json').write_text(json.dumps(cards,ensure_ascii=False,indent=2)+'\n')
