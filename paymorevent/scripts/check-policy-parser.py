"""Regression checks for actual source wording that caused false gift/tax matches."""
from pathlib import Path
s=Path('scripts/refine-policy-database.py').read_text()
# Functions use their defining globals; run the source prefix with one shared namespace.
ns={'__file__':str(Path('scripts/refine-policy-database.py').resolve())};exec(compile(s[:s.index('changed=collections.Counter()')],ns['__file__'],'exec'),ns)
extract=ns['extract']
assert not extract(['마일리지는 결제월 기본적립/추가적립 대상거래의 총 결제금액(적립제외 대상 금액 제외)을 각각 마일리지 적립 단위금액 1,000원으로 나누고, 소수점 첫째 자리에서 반올림하여 결제일 D+3 영업일 이내 적립','유이자할부는 1회차 결제월에 할부매출 전체금액(할부수수료 제외)에 대하여 적립'],'https://example.com')
sections=extract(['SKYPASS 마일리지 적립','적립 제외 : 무이자할부금액, 정부지원금(바우처 이용금액 등), 국세, 지방세, 상품권/선불카드/기프트카드 구매 및 충전 금액, 아파트관리비(임대료)','전월실적 산정','아파트관리비, 상품권 구매, 국세, 지방세, 각종 수수료 및','이자, 연회비, 매출취소금액은 전월 실적에 포함되지 않습니다.'],'https://example.com')
assert any(x['axis']=='benefit' and '기프트카드' in x['text'] for x in sections)
assert any(x['axis']=='spend' and '상품권' in x['text'] and '아파트관리비' in x['text'] for x in sections)
c=next(c for c in ns['cards'] if c['id']=='woori-102488');allsections=[]
for d in c['documents']:allsections+=extract(ns['docs'].get(d['url'],{}).get('lines',[]),d['url'])
for axis in ['spend','benefit']:
 for item,pat in ns['ITEMS'].items():assert any(x['axis']==axis and ns['re'].search(pat,x['text']) for x in allsections),(axis,item)
print({'status':'passed','nestedCalculationRejected':True,'giftVoucherListsRetained':True,'wrappedSpendListsJoined':True,'actualEveryMileAllAxes':True})
