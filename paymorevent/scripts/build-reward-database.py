"""Structure monetary rates from each benefit's own official text.
Mileage/ALL valuation assumptions are explicit inputs, not issuer marketing values.
Only unambiguous rates become numerical models; unsupported point values remain unknown.
"""
from ensure_card_source import ensure_card_data
ensure_card_data()
import json,re,collections
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
cs=json.loads((ROOT/'data/cards.json').read_text());woori=json.loads((ROOT/'data/woori-policy-research.json').read_text());DAY='2026-10-10'
def row(label,spendUnit,reward,unit,value,minSpend,cap,url,note):return {'label':label,'spendUnit':spendUnit,'rewardUnits':reward,'rewardUnit':unit,'unitValue':value,'minimumSpend':minSpend,'monthlyCapValue':cap,'sourceUrl':url,'note':note,'verified':True}
count=0
for c in cs:
 rates=[]
 for b in c['benefits']:
  if b.get('kind')=='voucher' or re.search(r'바우처|기프트|보너스|연간|연회비|무이자|수수료|라운지|보험|등급|놀이공원|주유|리터',b['title']):continue
  text=b['title']+' '+b['detail'];source=b.get('sourceUrl',c['sourceUrl']);minimum=b['minimumSpend'];unlimited=bool(re.search(r'한도\s*(?:없|없이|제한\s*없)|적립\s*한도\s*없|제한없음',text+' '+(b['cap'] or '')))
  # A single percentage already attached to the benefit is an auditable basic earning model.
  rr=b.get('rate') or ''
  if re.fullmatch(r'\d+(?:\.\d+)?\s*%',rr) and re.search(r'적립|할인|캐시백',b['title']):
   pct=float(rr.replace('%','').strip())
   if 0<pct<=100 and minimum is not None:
    cap=None;cm=re.search(r'(?:월|매월)[^0-9]{0,15}(\d+(?:\.\d+)?)(만|천)?\s*(?:원|포인트|점)(?:\s*(?:한도|까지|할인|적립))?',b['cap'] or '')
    if cm:cap=float(cm.group(1))*({'만':10000,'천':1000}.get(cm.group(2),1))
    if re.search(r'전월|이용금액대별',b['cap'] or ''):
     amounts=re.findall(r'([\d,]+)\s*(?:원|P|포인트|점)',b['cap'] or '')
     if amounts:cap=min(int(n.replace(',','')) for n in amounts)
     else:continue
    if unlimited or cap is not None:rates.append(row(b['title'],100,pct,'원',1,minimum,cap,source,b['cap'] or '한도 없음'))
  if re.search(r'대한항공|스카이패스|SKYPASS',text+' '+c['name'],re.I):
   unit=re.search(r'(\d[\d,]*)\s*원\s*당\s*(\d+(?:\.\d+)?)\s*마일',text)
   if unit and minimum is not None and unlimited:
    rates.append(row(b['title'],float(unit[1].replace(',','')),float(unit[2]),'대한항공 마일',20,minimum,None,source,'대한항공 1마일=20원 평가. '+(b['cap'] or '공식 적립 한도 없음')))
 if c['id'] in ['samsung-aap1452','samsung-aap1453']:
  base='https://static11.samsungcard.com/wcms/svc/1212906_38558.html';source=next((d['url'] for d in c['documents'] if '368395' in d['url']),c['sourceUrl'])
  rates=[row('기본 적립 · 국내외 가맹점',1000,1,'대한항공 마일',20,0,None,base,'1,000원당 1마일, 적립한도 없음. 상품권 구매 기본 적립 가능. 세금·무이자할부·선불충전 등 제외.'),row('특별 적립 · 선택형 대상 업종',1000,2,'대한항공 마일',20,0,80000,source,'기본 1마일+추가 1마일. 옵션별 대상 업종에만 제공, 추가 적립 월 2,000마일 한도. 추가 한도 초과는 기본 적립. 두 적립률을 중복 합산하지 않음.')]
  for b in c['benefits']:
   if '추가' in b['title'] and '마일' in b['title']:b['rate']='1,000원당 총 2마일';b['cap']='추가 적립 월 2,000마일';b['detail']+=' / 기본+추가 합계 1,000원당 2마일, 대한항공 1마일 20원 가정 시 4%. 추가 한도 초과 기본 2%.'
   elif '마일' in b['title']:b['rate']='1,000원당 1마일';b['cap']='기본 적립 한도 없음'
  c['minimumSpend']=0
 if c['id']=='nh-90010544':
  source=c['sourceUrl'];rates=[row('국내 기본 적립',100,1.2,'NH포인트',1,0,100000,source,'건당 1만원 이상. 세금·공과금·관리비 포함, 국내·해외 통합 월 10만점.'),row('해외 기본 적립',100,3,'NH포인트',1,0,100000,source,'해외 3% 무실적, 국내·해외 통합 월 10만점.'),row('해외 우대 적립',100,4,'NH포인트',1,1000001,100000,source,'국내 전월실적 100만원 초과 (100만원 이상이 아님). 국내·해외 통합 월 10만점. 세금·공과금 국내 실적 포함.')]
 if c['id'] in ['woori-103187','woori-103188']:
  d=woori[c['id']];source=d['url'];inf=c['id']=='woori-103187';basic=1.3 if inf else 1;special=5 if inf else 3;other=3 if inf else 2;cap=(4000 if inf else 2000)*30
  rates=[row('국내 기본 적립',3000,basic,'ALL 리워드 포인트',30,0,None,source,' 계산은 사용자 지정 30원 가치. 적립한도 없음.'),row('아코르 호텔 숙박·식음 특별 적립',3000,special,'ALL 리워드 포인트',30,500000,cap,source,f'특별 적립 통합 월 {4000 if inf else 2000:,}포인트. 기본 적립과 중복 제공하지 않으며 한도 초과는 기본 적립.'),row('해외 가맹점 특별 적립' if inf else '해외·커피·뷰티·백화점·애슬레저',3000,other,'ALL 리워드 포인트',30,500000,cap,source,'특별 적립 한도 공유. 실제 승인 업종 및 오프라인 조건 적용.')]
  # Split the single opaque table into customer-readable benefits; preserve original text as an official excerpt.
  old=next((b for b in c['benefits'] if b['title']=='ALL 리워드 포인트 적립'),None)
  if old is None:
   c['rewardRates']=rates;count+=1;continue
  new=[]
  for r in rates:
   new.append({'kind':'benefit','category':'호텔 포인트','title':r['label'],'detail':f"3,000원당 {r['rewardUnits']:g} ALL 포인트. 원화 환산 {r['rewardUnits']*30/3000*100:.2f}%. "+r['note']+' / '+old['detail'],'rate':f"3,000원당 {r['rewardUnits']:g} ALL 포인트",'cap':'한도 없음' if r['monthlyCapValue'] is None else f"특별적립 통합 월 {4000 if inf else 2000:,} ALL 포인트",'minimumSpend':r['minimumSpend'],'minimumSpendVerified':True,'sourceUrl':source,'spendExclusions':c['spendExclusions'],'benefitExclusions':c['benefitExclusions']})
  c['benefits']=[b for b in c['benefits'] if b is not old]+new
  # Keep ordinary spending earning first, before membership gifts and free services.
  c['benefits']=new+[b for b in c['benefits'] if b not in new]
  for b in c['benefits']:
   if re.search(r'기프트|보너스',b['title']):b['kind']='voucher'
  c['minimumSpend']=0;c['description']='국내 기본 적립과 아코르 호텔·해외 특별 적립, ALL 멤버십 및 공항 서비스'
  c['databaseAudit'].update(reviewStatus='reviewed',note='해당 상품코드 공식 전체 콘텐츠의 포인트 적립표·통합 한도·전월 및 적립 제외목록을 개별 대조. 회원등급 연간 실적은 월 실적과 구분.')
 c['rewardRates']=rates;count+=bool(rates)
(ROOT/'data/cards.json').write_text(json.dumps(cs,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'structuredRateCards':count,'structuredRates':sum(len(c['rewardRates']) for c in cs)}))
