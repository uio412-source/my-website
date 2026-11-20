"""Extract typed thresholds/caps while preserving original table relationships.
These are source figures, not proof that all caps can be attained simultaneously.
"""
import collections,re
AMOUNT=r'(\d[\d,]*(?:\.\d+)?(?:억|만|천)?(?:\d+(?:\.\d+)?(?:만|천))?원)'
def money_value(text):
 text=re.sub(r'[\s,()]','',text)
 unit=re.search(r'(원|포인트|마일|점|P)$',text,re.I)
 if not unit:return None
 number=text[:unit.start()]
 tokens=re.findall(r'(\d+(?:\.\d+)?)(억|만|천)?',number)
 if ''.join(n+(u or '') for n,u in tokens)!=number:return None
 return sum(float(n)*{'억':100000000,'만':10000,'천':1000,'':1}[u] for n,u in tokens),unit[1]
def threshold(text):
 text=re.sub(r'[\s,]','',text)
 parts=re.findall(AMOUNT+r'(이상|초과|미만|이하)',text)
 if not parts:return None
 lower=upper=None;lowInclusive=upInclusive=None
 for number,op in parts:
  amount=money_value(number)
  if amount is None:return None
  if op in ['이상','초과']:lower=amount[0];lowInclusive=op=='이상'
  else:upper=amount[0];upInclusive=op=='이하'
 if lower is None:return None
 return dict(minimumSpend=lower,minimumInclusive=lowInclusive,maximumSpend=upper,maximumInclusive=upInclusive)
def extract_table_tiers(rows,key):
 groups=collections.defaultdict(list);out=[]
 for row in rows:groups[(row['cardId'],row['tableId'])].append(row)
 for group in groups.values():
  grid=[r['cells'] for r in group];body=' '.join(' '.join(row) for row in grid)
  if not re.search(r'전월|지난달',body) or not re.search(r'한도|할인율|적립률|적립율',body):continue
  def emit(row,ci,figure,tier,headers,orientation):
   value=money_value(figure)
   pct=re.fullmatch(r'\s*(\d+(?:\.\d+)?)\s*%\s*',figure)
   if not value and not pct:return
   # Accept numerical figures only under a cap/rate header in this source table.
   if not re.search(r'한도|할인율|적립률|적립율',headers):return
   cap=value[0] if value and '한도' in headers else None
   rate=float(pct[1]) if pct and re.search(r'할인율|적립률|적립율',headers) else None
   if cap is None and rate is None:return
   out.append(dict(tierId=key('tier',row['cardId'],row['tableId'],row['row'],ci,tier['minimumSpend']),cardId=row['cardId'],name=row['name'],serviceId=None,tableId=row['tableId'],scope=row['scope'],field=headers,**tier,ratePercent=rate,capAmount=cap,capUnit=value[1] if value else None,relation=orientation,status='표 수치 추출 · 혜택별 적용 대조 필요',quote=' | '.join(row['cells']),documentId=row['documentId'],sourceUrl=row['sourceUrl']))
  for ri,row in enumerate(group):
   for ci,cell in enumerate(row['cells']):
    tier=threshold(cell)
    if not tier:continue
    # Row-oriented: a threshold column beside named cap/rate columns.
    if ri>0:
     thresholdHeader=' '.join(g[ci] for g in grid[:ri] if ci<len(g))
     if re.search(r'전월|지난달|실적',thresholdHeader):
      for other,figure in enumerate(row['cells']):
       if other==ci:continue
       headers=' / '.join(dict.fromkeys(g[other] for g in grid[:ri] if other<len(g) and re.search(r'한도|할인율|적립률|적립율',g[other])))
       if headers:emit(row,other,figure,tier,headers,'같은 행의 실적·요율·한도')
    # Column-oriented: cap headers above thresholds, amounts below them.
    headers=' / '.join(dict.fromkeys(g[ci] for g in grid[:ri] if ci<len(g) and re.search(r'한도|할인율|적립률|적립율',g[ci])))
    if headers:
     for later in group[ri+1:]:
      if ci>=len(later['cells']):continue
      if threshold(later['cells'][ci]):break
      emit(later,ci,later['cells'][ci],tier,headers,'같은 열의 실적·요율·한도')
 # Repeated rowspan captions may lead to identical source figures. Keep one key.
 return list({r['tierId']:r for r in out}.values())
