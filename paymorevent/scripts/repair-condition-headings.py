"""Expand below-list headings using each product's already fetched official page."""
import importlib.util,json,re
from pathlib import Path
root=Path(__file__).resolve().parent.parent
spec=importlib.util.spec_from_file_location('research',root/'scripts/research-card-conditions.py')
r=importlib.util.module_from_spec(spec);spec.loader.exec_module(r)
records=json.loads((root/'data/card-research.json').read_text(encoding='utf-8'))
byid={x['id']:x for x in records};changed=[]
placeholder=lambda s:len(s)<100 and bool(re.search(r'(?:아래|하단).*(?:제외|참조)',s))
expense=re.compile(r'대출|현금서비스|카드론|연회비|수수료|이자|기프트|선불|거래.?취소|상품권|지방세|국세|4대보험|납입금|등록금|관리비|도시가스|전기요금|전기료')
stop=re.compile(r'제공|적립 제외|할인 제외|포인트 적립|월간|가족카드|카드서비스|이용안내|반환|혜택|신청|^\d+ / \d+')
for c in r.CARDS:
 if not c['spendExclusions'] or not all(placeholder(x) for x in c['spendExclusions']):continue
 meta,raw=r.fetch(c['sourceUrl']);lines,_=r.document_lines(meta,raw);found=[]
 for i,line in enumerate(lines):
  if line not in c['spendExclusions'] or '아래' not in line:continue
  parts=[]
  for nxt in lines[i+1:i+20]:
   if stop.search(nxt) or not expense.search(nxt):break
   parts.append(nxt)
  if parts:
   excerpt=' '.join([line,*parts]);found.append(excerpt)
   x=byid[c['id']];x.setdefault('evidence',[]).append({'field':'spendExclusions','excerpt':excerpt,'line':i+1,'isFullPolicySection':True,'sourceUrl':c['sourceUrl'],'checkedAt':r.CHECKED,'documentKind':'productPage'})
 if found:
  x=byid[c['id']];x['spendExclusions']=list(dict.fromkeys([v for v in x.get('spendExclusions',[]) if not placeholder(v)]+found));x['spendExclusionsStatus']='source_excerpt';changed.append(c['id'])
 # Explicit product evidence takes precedence over a bank-level grouping.
 if c['issuer']=='NH농협카드' and ('비씨' in c['name'] or any('카드서비스는 비씨카드 전산상' in v for v in lines)):
  byid[c['id']]['issuerGroup']='BC'
(root/'data/card-research.json').write_text(json.dumps(records,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'repaired':len(changed),'ids':changed}))
