// 카드사 이벤트를 이용자가 바로 읽게 정리: 어디서(가맹점) · 얼마나(혜택) · 어떻게(응모) · 누가(대상) · 언제까지
// 카드사 목록에서 긁어온 제목·기간만 있는 이벤트가 많아서, 제목에서 혜택·가맹점·분야를 뽑고 모르는 건 '모름'으로 둡니다.
import type {Offer} from './catalog-types';

// ---------- 문구 정리 ----------
const ENTITY: Record<string, string> = {amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', middot: '·', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', hellip: '…', bull: '•', times: '×', rarr: '→'};
export const decode = (s: string) => s
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&([a-z]+);/gi, (m, n) => ENTITY[n.toLowerCase()] ?? m);
const EMOJI = /[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu;
const tidy = (s: string) => decode(s).replace(EMOJI, '').replace(/\s+/g, ' ').trim();
/** 광고 문구·카드사 자기 이름을 뺀 제목 */
export function cleanTitle(o: Pick<Offer, 'title' | 'issuer'>) {
  let t = tidy(o.title)
    .replace(/^\[([^\]]+)\]\s*/, (all, inner: string) => {
      const parts = inner.split(/\s*[xX×]\s*/).filter(p => !/카드$|^(?:BC|KB|NH|신한|삼성|현대|우리|하나|롯데|농협)/.test(p.trim()));
      return parts.length && parts.length < inner.split(/\s*[xX×]\s*/).length ? parts.join(' ') + ' ' : all;
    })
    .replace(/^(?:BC|KB국민|국민|신한|삼성|현대|우리|하나|롯데|NH농협|농협)\s*카드\s*[xX×]\s*/, '')
    .replace(/[!~]+/g, ' ')
    .replace(/\s*(?:놓치지\s*마세요|지금\s*바로|확인하세요|만나보세요|받아가세요|챙기세요)\.?\s*$/g, '')
    .replace(/^(?:BC|신한|KB국민|국민|삼성|현대|우리|하나|롯데|NH농협|농협)\s*카드\s*(?:전용|회원(?:님)?(?:을)?\s*위한)\s*/, '')
    .replace(/\s+/g, ' ').trim();
  const parts = t.split(/\s+·\s+/);
  if (parts.length === 2 && parts[1].includes(parts[0])) t = parts[1];
  t = t.replace(/\s*(?:특가\s*)?(?:이벤트|프로모션|혜택)$/, '').trim() || t;
  return t;
}

// ---------- 혜택(얼마나) ----------
const FX: Record<string, number> = {'$': 1400, 달러: 1400, 엔: 9.3, 위안: 195, 유로: 1500};
/** num + 단위("만5천", "만", "천") → 원 */
function krw(num: string, scale = '') {
  const n = Number(num.replace(/,/g, '')) || 0;
  const s = scale.replace(/\s+/g, '');
  if (s.startsWith('만')) return n * 10000 + (Number(s.match(/^만(\d+)천/)?.[1] ?? 0) * 1000);
  return s === '천' ? n * 1000 : n;
}
const won = (n: number) => n >= 10000 ? `${Number((n / 10000).toFixed(1)).toLocaleString('ko-KR')}만원` : `${n.toLocaleString('ko-KR')}원`;
const KIND = '즉시\\s*할인|청구\\s*할인|할인\\s*쿠폰|할인|캐시백|캐쉬백|페이백|포인트\\s*백|적립|환급|리워드|쿠폰|상품권|M포인트\\s*사용|포인트\\s*사용|포인트|머니|당첨|행운|증정|혜택';
const KIND_NEAR = new RegExp(`^\\s*(?:[가-힣A-Za-z]{1,6}?\\s*)??(${KIND})`);
const kindOf = (w: string | undefined) => {
  const k = (w ?? '').replace(/\s+/g, '');
  return !k ? '' : /페이백|캐시백|캐쉬백/.test(k) ? '캐시백' : k === '행운' || k === '당첨' ? '당첨(추첨)' : k === '포인트백' ? '포인트 적립' : k === '할인쿠폰' ? '할인 쿠폰' : /M포인트사용|포인트사용/.test(k) ? 'M포인트 사용' : k === '머니' ? '머니 적립' : k === '즉시할인' ? '즉시할인' : k === '청구할인' ? '청구할인' : k;
};
const MONEY = /(최대\s*|월\s*최대\s*|총\s*)?(?:(\$|USD|JPY|EUR)\s*(\d[\d,.]*)|(\d[\d,]*(?:\.\d+)?)\s*(만\s*(?:\d[\d,]*\s*천)?|천)?\s*(원|달러|엔|위안|유로)?)(?:\s*\((?:USD|JPY|EUR)\))?/g;
const NOT_REWARD = /^\s*(?:이상|당|미만|초과|이용|구매|결제|[A-Za-z가-힣]{0,6}카드\s*결제)/;

export type Value = {text: string; won: number; pct: number; kind: string; raw: string};
/** 제목(없으면 요약)에서 '최대 3만원 캐시백' '10% 할인' '무이자 6개월' '추첨' 같은 혜택 한 줄을 뽑음 */
export function eventValue(o: Pick<Offer, 'title' | 'benefitText' | 'description' | 'cashbackAmount' | 'cashbackIsMaximum'>, title = tidy(o.title)): Value | null {
  for (const src of [title, tidy(o.benefitText ?? '')]) {
    const v = valueIn(src);
    if (v) return v;
  }
  if (o.cashbackAmount) return {text: (o.cashbackIsMaximum ? '최대 ' : '') + won(o.cashbackAmount) + ' 캐시백', won: o.cashbackAmount, pct: 0, kind: '캐시백', raw: ''};
  return null;
}
export function valueIn(t: string): Value | null {
  if (!t || /^공식 (?:진행|목록|혜택)/.test(t)) return null;
  let m = t.match(/(?:최대\s*)?(\d+)\s*개월\s*무이자(?:\s*할부)?|무이자\s*(?:할부)?\s*(?:최대\s*)?(\d+)\s*개월/);
  if (m) return {text: `무이자 최대 ${m[1] ?? m[2]}개월`, won: 0, pct: 0, kind: '무이자', raw: m[0]};
  const money: Value[] = [];
  for (const x of t.matchAll(MONEY)) {
    const [raw, max, cur1, usd, num, scale0, unit] = x;
    const scale = scale0?.replace(/\s+/g, '');
    const n = usd ?? num;
    if (!cur1 && !scale && !unit) continue; // 그냥 숫자
    const tail = t.slice((x.index ?? 0) + raw.length);
    if (NOT_REWARD.test(tail)) continue; // "1만원 이상 결제" 같은 조건 금액
    const cur = cur1 ? (/JPY/i.test(cur1) ? '엔' : /EUR/i.test(cur1) ? '유로' : '$') : unit && FX[unit] ? unit : '';
    const amount = (cur ? FX[cur] : 1) * krw(n, scale);
    if (amount < 100) continue;
    const pre = max ? (/월/.test(max) ? '월 최대 ' : /총/.test(max) ? '총 ' : '최대 ') : '';
    const pts = !unit && !cur1 ? tail.match(/^\s*([가-힣A-Z]{0,4}(?:머니|포인트)|마일(?:리지)?|Mile|P\b|P(?=\s|$|[가-힣]))(\s*사용)?/i) : null;
    if (pts) { money.push({text: `${pre}${n}${scale ?? ''}${pts[1] === 'P' ? 'P' : ' ' + pts[1]}${pts[2] ? ' 사용' : ''}`, won: Math.round(amount), pct: 0, kind: '포인트', raw: (raw + pts[0]).trim()}); continue; }
    const kw = tail.match(KIND_NEAR);
    let kind = kindOf(kw?.[1]) || '혜택';
    if (kind === '혜택') kind = /캐시백|페이백/.test(t) ? '캐시백' : /청구\s*할인/.test(t) ? '청구할인' : /즉시\s*할인/.test(t) ? '즉시할인' : /할인/.test(t) ? '할인' : /적립/.test(t) ? '적립' : '혜택';
    const shown = cur === '$' ? `$${n}` : cur ? `${n}${scale ?? ''}${cur}` : won(amount);
    const near = kw && kw[0].length - kw[1].length <= 3 ? kw[0] : '';
    money.push({text: `${pre}${shown} ${kind}`, won: Math.round(amount), pct: 0, kind, raw: (raw + near).trim()});
  }
  if (money.length) return money.sort((a, b) => b.won - a.won)[0];
  const PCT = /(최대\s*)?(\d+(?:\.\d+)?)\s*%(?:\s*\+\s*(?:추가\s*)?(\d+(?:\.\d+)?)\s*%)?\s*(?:추가\s*)?(즉시\s*할인|청구\s*할인|할인|캐시백|캐쉬백|페이백|포인트\s*백|적립|M포인트\s*사용|포인트|리워드|UP)?/g;
  const pcts = [...t.matchAll(PCT)];
  if (pcts.length) {
    const best = pcts.reduce((a, b) => Number(b[2]) + Number(b[3] ?? 0) > Number(a[2]) + Number(a[3] ?? 0) ? b : a);
    const pct = Number(best[2]) + Number(best[3] ?? 0);
    const kind = kindOf(best[4]) || (/할인/.test(t) ? '할인' : /적립/.test(t) ? '적립' : /캐시백|페이백/.test(t) ? '캐시백' : '할인');
    const many = pcts.length > 1;
    return {text: `${best[1] || many ? '최대 ' : ''}${best[3] ? `${best[2]}+${best[3]}%` : `${best[2]}%`} ${kind === 'UP' ? '추가' : kind}`, won: 0, pct, kind, raw: many ? '' : best[0].trim()};
  }
  if ((m = t.match(/1\s*\+\s*1/))) return {text: '1+1', won: 0, pct: 50, kind: '1+1', raw: m[0]};
  if ((m = t.match(/(\d+)\s*배\s*적립/))) return {text: `${m[1]}배 적립`, won: 0, pct: 0, kind: '적립', raw: m[0]};
  if ((m = t.match(/(최대\s*)?(\d[\d,]*)\s*(?:Mile|마일)/i))) return {text: `${m[1] ? '최대 ' : ''}${m[2]}마일`, won: Number(m[2].replace(/,/g, '')) * 15, pct: 0, kind: '마일', raw: m[0]};
  if ((m = t.match(/(한\s*달|\d+\s*개월)\s*무료/))) return {text: m[0].replace(/\s+/g, ' '), won: 0, pct: 0, kind: '무료', raw: m[0]};
  if (/무료/.test(t)) return {text: '무료', won: 0, pct: 0, kind: '무료', raw: ''};
  if (/추첨|당첨|경품|응모/.test(t)) return {text: '추첨 경품', won: 0, pct: 0, kind: '추첨', raw: ''};
  if (/무이자/.test(t)) return {text: '무이자 할부', won: 0, pct: 0, kind: '무이자', raw: ''};
  return null;
}

// ---------- 분야(어디서) ----------
export const FIELDS = ['쇼핑', '해외·여행', '외식·카페', '생활·납부', '교통·차', '문화·레저', '페이·포인트', '무이자 할부', '기타'] as const;
export type Field = typeof FIELDS[number];
const FIELD_RX: [Field, RegExp][] = [
  ['무이자 할부', /무이자/],
  ['문화·레저', /골프|뮤지엄|museum/i],
  ['해외·여행', /해외|여행|항공|공항|라운지|호텔|리조트|숙박|면세|트래블|트립닷컴|trip\.com|아고다|agoda|익스피디아|expedia|호텔스닷컴|hotels\.com|부킹|에어비앤비|클룩|klook|kkday|마이리얼트립|하나투어|모두투어|노랑풍선|인터파크\s*투어|렌터카|렌트카|avis|허츠|grab|로밍|esim|usim|유심|와이파이\s*도시락|포켓\s*와이파이|환전|외화|일본|중국|홍콩|대만|마카오|태국|베트남|싱가포르|필리핀|말레이|인도네시아|발리|미국|하와이|괌|사이판|유럽|영국|프랑스|파리|스페인|이탈리아|독일|호주|캐나다|오사카|도쿄|교토|후쿠오카|삿포로|오키나와|돈키호테|유니온페이|\bUPI\b|JCB|visitbritain|크루즈|소노|휘닉스|용평|모나|엘리시안|콘도|야놀자|여기어때|객실|스카이패스|skypass|아시아나|대한항공|제주항공|진에어|티웨이|에어부산|에어서울|에어프레미아/i],
  ['외식·카페', /커피|카페|스타벅스|투썸|이디야|메가\s*(?:mgc|커피)|컴포즈|빽다방|폴바셋|공차|배달|배민|배달의민족|요기요|쿠팡이츠|땡겨요|맥도날드|버거|롯데리아|kfc|치킨|피자|베이커리|파리바게뜨|뚜레쥬르|던킨|배스킨|레스토랑|다이닝|뷔페|디저트|외식|아웃백|빕스|라멘|식당|맛집|f&b|브런치/i],
  ['생활·납부', /통신|휴대폰|핸드폰|sk\s*텔레콤|skt|\bkt\b|lg\s*u\+?|알뜰폰|요금|공과금|관리비|아파트|세금|국세|지방세|자동차세|재산세|보험|손보|화재|생명|렌탈|정수기|학원|교육|엘리하이|엠베스트|병원|약국|동물병원|유치원|어린이집|등록금|월세|전기료|도시가스|자동납부|정기\s*결제|생활\s*요금|서울시|지역\s*화폐|상권/i],
  ['교통·차', /주유|충전|전기차|\bev\b|택시|카카오\s*t|대리\s*운전|대중교통|교통|버스|지하철|ktx|srt|하이패스|주차|세차|정비|자동차|차량|쏘카|그린카|타이어|오토/i],
  ['쇼핑', /쇼핑|쇼핑몰|백화점|아울렛|마트|이마트|홈플러스|코스트코|트레이더스|쿠팡|11번가|g\s*마켓|지마켓|옥션|ssg|쓱|롯데\s*on|롯데온|컬리|무신사|29cm|w컨셉|지그재그|에이블리|올리브영|다이소|편의점|gs25|\bcu\b|세븐일레븐|이마트24|circle\s*k|홈쇼핑|라이브\s*커머스|스마트스토어|네이버\s*(?:\+|플러스)?\s*스토어|알리|aliexpress|테무|temu|아마존|amazon|큐텐|몰테일|직구|배송|가전|하이마트|전자랜드|삼성전자|lg전자|애플|아이폰|갤럭시|가구|이케아|명품|럭셔리|상품권|e-?쿠폰|기프티콘|구독/i],
  ['문화·레저', /영화|cgv|메가박스|롯데시네마|공연|뮤지컬|콘서트|전시|展|미술|박물관|합창단|오페라|연극|티켓|놀이공원|테마파크|에버랜드|롯데월드|서울랜드|워터파크|아쿠아리움|골프|\bcc\b|스키|헬스|필라테스|스포츠|야구|축구|넷플릭스|유튜브|디즈니|티빙|웨이브|쿠팡플레이|왓챠|멜론|지니|스포티파이|도서|교보|예스24|게임|이모티콘|웹툰|플레이트/i],
  ['페이·포인트', /페이|pay|qr|앱\s*카드|포인트|머니|마일리지\s*전환|출석|첫\s*(?:결제|로그인)|가입|등록/i],
];
export function eventField(o: Pick<Offer, 'title' | 'benefitText' | 'description' | 'tags'>, title = tidy(o.title)): Field {
  for (const text of [title, tidy([o.benefitText, o.description].join(' ')).slice(0, 300)]) {
    for (const [f, rx] of FIELD_RX) if (rx.test(text)) return f;
  }
  return '기타';
}

// ---------- 가맹점 (같은 곳 다른 카드사 이벤트 비교용) ----------
const MERCHANTS: [string, RegExp][] = [
  ['아고다', /아고다|agoda/i], ['트립닷컴', /트립닷컴|trip\.com/i], ['호텔스닷컴', /호텔스닷컴|hotels\.com/i], ['익스피디아', /익스피디아|expedia/i],
  ['부킹닷컴', /부킹닷컴|booking\.com/i], ['에어비앤비', /에어비앤비|airbnb/i], ['클룩', /클룩|klook/i], ['KKday', /kkday/i], ['마이리얼트립', /마이리얼트립/],
  ['야놀자', /야놀자/], ['여기어때', /여기어때/], ['알리익스프레스', /알리\s*익스프레스|aliexpress|알리(?=\s|$|에서)/i], ['테무', /테무|temu/i], ['아마존', /아마존|amazon/i],
  ['몰테일', /몰테일/], ['쿠팡이츠', /쿠팡\s*이츠/], ['쿠팡', /쿠팡(?!\s*이츠|플레이)/], ['배달의민족', /배민|배달의\s*민족/], ['요기요', /요기요/], ['스타벅스', /스타벅스|starbucks/i],
  ['이마트', /이마트(?!24)/], ['홈플러스', /홈플러스/], ['롯데마트', /롯데마트/], ['코스트코', /코스트코|costco/i], ['롯데백화점', /롯데백화점/], ['현대백화점', /현대백화점/],
  ['신세계백화점', /신세계백화점/], ['롯데ON', /롯데\s*on|롯데온/i], ['SSG', /ssg|쓱/i], ['11번가', /11번가/], ['G마켓', /g\s*마켓|지마켓/i], ['무신사', /무신사/], ['컬리', /컬리/],
  ['올리브영', /올리브영/], ['다이소', /다이소/], ['넷플릭스', /넷플릭스|netflix/i], ['유튜브', /유튜브|youtube/i], ['티빙', /티빙/], ['CGV', /cgv/i], ['메가박스', /메가박스/],
  ['롯데시네마', /롯데시네마/], ['에버랜드', /에버랜드/], ['롯데월드', /롯데월드/], ['서울랜드', /서울랜드/], ['대한항공', /대한항공|skypass|스카이패스/i], ['아시아나', /아시아나/],
  ['제주항공', /제주항공/], ['진에어', /진에어/], ['티웨이', /티웨이/], ['롯데면세점', /롯데\s*면세점/], ['신라면세점', /신라\s*면세점/], ['신세계면세점', /신세계\s*면세점/],
  ['현대면세점', /현대\s*면세점/], ['인천공항', /인천\s*공항/], ['돈키호테', /돈키호테/], ['애플페이', /애플\s*페이|apple\s*pay/i], ['삼성페이', /삼성\s*페이/], ['네이버페이', /네이버\s*페이|\bnpay\b/i],
  ['카카오페이', /카카오\s*페이/], ['토스', /토스(?!트)/], ['카카오T', /카카오\s*t\b/i], ['쏘카', /쏘카/], ['SK텔레콤', /sk\s*텔레콤|skt/i], ['하이마트', /하이마트/], ['삼성전자', /삼성전자/],
  ['소노', /소노\s*(?:호텔|벨|캄|펠리체|문|리조트)?/], ['휘닉스파크', /휘닉스/], ['메리어트', /메리어트|marriott/i], ['힐튼', /힐튼|hilton/i], ['Grab', /\bgrab\b/i], ['Avis', /\bavis\b/i],
];
export function eventMerchant(title: string) {
  for (const [name, rx] of MERCHANTS) if (rx.test(title)) return name;
  return null;
}

// ---------- 응모·대상·상세 여부 ----------
const BOILER = /공식 목록의 행사명·기간을 확인|공식 진행 이벤트 · 상세|공식 안내에서 대상·참여 조건 확인|공식 혜택·이벤트 확인/;
/** 카드사 상세(또는 수집기가 정리한 조건)까지 본 이벤트인지. 아니면 제목·기간만 아는 것 */
export function isDetailed(o: Offer) {
  return o.verificationLevel === 'official_detail' || /수집/.test(o.verificationNote ?? '') ||
    (!BOILER.test(o.description) && !BOILER.test((o.participation ?? o.requirements).join(' ')) && (o.participation ?? o.requirements).length > 0);
}
/** true 응모 필요 · false 결제만 하면 됨 · null 모름 */
export function entryOf(o: Offer, title = tidy(o.title)): boolean | null {
  if (o.entryRequired === true) return true;
  if (/응모|추첨|당첨|경품|출석|사전\s*신청|참여\s*신청/.test(title + ' ' + (isDetailed(o) ? (o.participation ?? o.requirements).join(' ') : ''))) return true;
  if (o.entryRequired === false && isDetailed(o)) return false;
  return null;
}
/** 대상 카드 한 줄. 모르면 null */
export function targetOf(o: Offer): string | null {
  if (o.cardNames?.length) return o.cardNames.length === 1 ? o.cardNames[0] : `${o.cardNames[0]} 외 ${o.cardNames.length - 1}종`;
  const t = o.cardTarget;
  if (t?.types?.length === 1) return t.types[0] === 'debit' ? '체크카드' : '신용카드';
  if (t?.brands?.length) return t.brands.join('·') + ' 카드';
  if (t?.scope === 'issuer' || (isDetailed(o) && o.cardNames && !o.cardNames.length)) return `${o.issuer} 전체`;
  return null;
}
/** 이름: 제목에서 혜택 문구를 뺀 나머지(가맹점·행사명). 너무 짧아지면 제목 그대로 */
export function eventName(title: string, v: Value | null) {
  if (!v?.raw || !title.includes(v.raw)) return title;
  const rest = title.replace(v.raw, ' ').replace(/\s*(?:혜택|이벤트|프로모션|제공|받기|증정|받으세요|받아가세요|받자|드려요|드립니다|누리세요)\s*$/, '').replace(/\s*(?:결제\s*시|결제하고|결제하면|이용\s*시|구매\s*시|예약\s*시)\s*$/, '')
    .replace(/(?:^|\s)(?:최대|월|총|추가|즉시|청구)\s*$/, '').replace(/\s+·\s*\S{1,3}$/, '').replace(/\s+[이가을를은는도]$/, '')
    .replace(/^[\s&+·,:\-]+|[\s&+·,:\-]+$/g, '').replace(/\s+/g, ' ').trim();
  return rest.replace(/[가-힣A-Za-z0-9)]/g, '').length === rest.length || rest.length < 3 || /^(?:부터|까지|으로|로|에서|을|를|이|가|와|과|및|바로|즉시|추가|더|매달|매월)(?:\s|$)/.test(rest) ? title : rest;
}

export type EventView = {o: Offer; title: string; name: string; value: Value | null; field: Field; merchant: string | null; entry: boolean | null; target: string | null; detailed: boolean};
const cache = new WeakMap<Offer, EventView>();
export function viewOf(o: Offer): EventView {
  const hit = cache.get(o);
  if (hit) return hit;
  const title = cleanTitle(o);
  const value = eventValue(o, title);
  const v: EventView = {o, title, name: eventName(title, value), value, field: eventField(o, title), merchant: eventMerchant(title), entry: entryOf(o, title), target: targetOf(o), detailed: isDetailed(o)};
  cache.set(o, v);
  return v;
}

/** 상세에 보여 줄 조건 줄: 안내 문구·날짜만 있는 줄·너무 긴 원문은 뺌 */
const DATE_ONLY = /^[\s\d.()~월화수목금토일년:-]+$|^(?:이벤트\s*)?(?:기간|응모기간|행사기간)\s*[:：]?\s*[\d.\s()~월화수목금토일년-]+$/;
export function conditionLines(o: Offer, lines: (s: string) => string[]) {
  if (!isDetailed(o)) return [];
  return [...new Set((o.participation?.length ? o.participation : o.requirements).flatMap(lines).map(tidy))]
    .filter(t => t.length > 3 && t.length <= 160 && !DATE_ONLY.test(t) && !BOILER.test(t) && !/^[①-⑳]?\s*$/.test(t)).slice(0, 8);
}

/** 마감까지 남은 날로 묶기 */
export function endBucket(end: string | null, now: string) {
  if (!end) return '기간 확인';
  const d = Math.round((Date.parse(end) - Date.parse(now)) / 864e5);
  return d <= 3 ? '3일 안에 끝나요' : d <= 7 ? '일주일 안에 끝나요' : d <= 31 ? '한 달 안에 끝나요' : '한 달 넘게 남았어요';
}
