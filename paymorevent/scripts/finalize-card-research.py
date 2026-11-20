"""Add hand-checked, reproducible spending scenarios; no invented global maximum."""
from ensure_card_source import ensure_card_data
ensure_card_data()
import json,sys
from collections import Counter
from pathlib import Path
sys.stdout.reconfigure(encoding='utf-8')
ROOT=Path(__file__).resolve().parent.parent
path=ROOT/'data/card-research.json'
rows=json.loads(path.read_text(encoding='utf-8'))
cards={c['id']:c for c in json.loads((ROOT/'data/cards.json').read_text(encoding='utf-8'))}
lookup={r['id']:r for r in rows}

def scenario(ident,label,spend,benefit,assumptions):
    c=cards[ident];r=lookup[ident]
    r['pickingStatus']='verified_scenario'
    r['pickingScenarios']=[dict(label=label,monthlySpend=spend,monthlyBenefit=benefit,annualFee=c['annualFeeMin'],sourceUrl=c['sourceUrl'],assumptions=assumptions,verified=True,maximumVerified=False)]

scenario('shinhan-201509030001','생활 할인 50만원 구간',500000,34000,[
    '매월 실적 인정 이용금액 500,000원을 유지하고 S& 본인 연회비 15,000원을 12개월로 나누어 차감합니다.',
    '월납요금 70,000원에서 7,000원 할인: 50,000원과 20,000원을 서로 다른 날짜에 결제합니다.',
    'TIME 대상 온라인쇼핑 10,000원 10회와 식음료 10,000원 10회를 각각 오후 9시~오전 9시에 결제하여 20,000원 할인합니다. 일 1회 및 영역별 월 10회 조건을 지킵니다.',
    '주말 마트 70,000원에서 7,000원 할인: 토·일요일 서로 다른 날짜에 50,000원과 20,000원을 결제합니다.',
    '나머지 실적 인정 일반 이용금액 160,000원에는 추가 혜택을 계산하지 않습니다. 할인받은 이용금액도 실적에 포함됩니다.',
    '특화 인테이크몰 20% 할인과 주유 할인은 포함하지 않았으므로 상품 전체의 최대 피킹률이라는 뜻은 아닙니다.'
])

scenario('samsung-aap1483','옵션 1 및 생활 할인 반복 이용',501430,30000,[
    '스타벅스 50%/오픈마켓 7% 할인 옵션을 선택하고 본인 연회비 10,000원을 12개월로 나누어 차감합니다.',
    '포인트 추가 적립이 없는 국내 일반 가맹점의 실적 인정 이용금액 300,000원을 별도로 이용합니다.',
    '스타벅스 20,000원에서 10,000원 할인, 오픈마켓 71,430원에서 월 한도 5,000원 할인합니다.',
    '대중교통/택시 50,000원과 이동통신 자동납부 50,000원에서 각각 5,000원 할인합니다.',
    '영화관 공식 결제 10,000원 1회에서 5,000원 할인합니다. 연 12회 제한에 맞춰 매월 1회씩 이용하는 반복 시나리오입니다.',
    '할인 혜택 적용 거래 전체 이용금액과 대중교통/택시는 전월실적에서 제외되므로 실적용 300,000원을 별도로 포함합니다.',
    '모든 이용처 업종·오프라인·사이렌오더·공식 예매 조건을 만족하는 경우입니다. 상품 전체의 수학적 최대값을 증명한 수치는 아닙니다.'
])

scenario('hyundai-zroe3','실적 제한 없는 월 100만원 일반 이용',1000000,8000,[
    '할인 제외 거래가 아닌 국내 일반 가맹점에서 매월 1,000,000원을 이용합니다.',
    '실적·한도 제한 없이 0.8% 청구 할인으로 월 8,000원을 받고 본인 연회비 15,000원을 12개월로 나누어 차감합니다.',
    '긴급할인 선지급 포인트 서비스는 이용하지 않는 것으로 가정합니다.',
    '공과금·관리비·상품권·등록금·보험·무이자할부 등 공식 할인 제외 거래 및 국제브랜드·해외수수료는 대상 이용금액에 포함하지 않습니다.',
    '연회비 포함 피킹률은 월 지출액에 따라 바뀝니다. 이용금액이 커질수록 0.8%에 접근하며 유한한 최대 지출 시나리오가 존재하지 않습니다.'
])
zr=lookup['hyundai-zroe3'];zr['spendExclusions']=['전월 실적 요건 없음: 실적·한도 제한 없이 국내외 가맹점 이용 금액의 0.8% 청구 할인.'];zr['spendExclusionsStatus']='confirmed_no_requirement'
zr['evidence'].append({'field':'spendExclusions','excerpt':'실적ㆍ한도 제한 없이 국내외 가맹점 이용 금액의 0.8% 청구 할인','sourceUrl':cards['hyundai-zroe3']['termsUrl'],'checkedAt':'2026-10-06','documentKind':'terms','isFullPolicySection':True})

scenario('shinhan-201905230001','대한항공 마일 국내 항공업종 이용',500000,0,[
    '매월 신한카드 등록 국내 항공업종에서 500,000원을 일시불로 이용하며 전월 실적 500,000원을 유지합니다.',
    '1,000원당 기본 1마일과 항공업종 추가 1마일을 합쳐 월 1,000 대한항공 마일을 적립합니다. 추가 적립 500마일은 월 한도 2,000마일 이내입니다.',
    '대한항공 마일 가치는 사용자가 지정한 1마일당 20원으로 환산합니다. 실제 마일 사용처에 따른 현금 절약액을 보장하는 값은 아닙니다.',
    '본인 연회비 49,000원을 12개월로 나누어 차감하며 AMEX 기간 한정 해외 1% 포인트·라운지·추가적립2는 포함하지 않습니다.',
    '마일 적립 제외 항목 및 각종 신한카드 할인 서비스 적용 거래는 이용하지 않습니다. 상품 전체의 최대 피킹률을 증명한 수치는 아닙니다.'
])
lookup['shinhan-201905230001']['pickingScenarios'][0]['miles']=1000

for r in rows:
    c=cards[r['id']]
    for key in ['spendExclusions','benefitExclusions','evidence','documents','pickingScenarios']:r.setdefault(key,[])
    r.setdefault('pickingStatus','not_verified')
    if 'www.bccard.com/app/card/' in c['sourceUrl']:
        r['issuerGroup']='BC';r['issuerGroupEvidence']={'sourceUrl':c['sourceUrl'],'reason':'BC카드 공식 개별 상품 페이지에 등록된 상품','checkedAt':'2026-10-06'}
    elif c['issuer']=='SC제일은행' and ('현대카드' in c['name'] or c['id'] in ['sc-6296','sc-6295','sc-6273']):
        r['issuerGroup']='현대';r['issuerGroupEvidence']={'sourceUrl':c['termsUrl'] or c['sourceUrl'],'reason':'상품명과 개별 상품설명서가 SC제일은행-현대카드임을 명시','checkedAt':'2026-10-06'}
    elif c['issuer']=='SC제일은행' and ('삼성' in c['name'] or c['id'] in ['sc-4231','sc-5350']):
        r['issuerGroup']='삼성';r['issuerGroupEvidence']={'sourceUrl':c['termsUrl'] or c['sourceUrl'],'reason':'상품명이 SC제일은행 삼성카드 제휴 상품임을 명시','checkedAt':'2026-10-06'}

path.write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
summary={'products':len(rows),'spendSourceExcerpts':sum(bool(r['spendExclusions']) for r in rows),'benefitSourceExcerpts':sum(bool(r['benefitExclusions']) for r in rows),'bothSourceExcerpts':sum(bool(r['spendExclusions']) and bool(r['benefitExclusions']) for r in rows),'verifiedPickingScenarios':sum(r['pickingStatus']=='verified_scenario' for r in rows),'byIssuer':{issuer:{'total':sum(r['issuer']==issuer for r in rows),'spend':sum(r['issuer']==issuer and bool(r['spendExclusions']) for r in rows),'benefit':sum(r['issuer']==issuer and bool(r['benefitExclusions']) for r in rows)} for issuer in sorted(set(r['issuer'] for r in rows))}}
print(json.dumps(summary,ensure_ascii=False,indent=2))
