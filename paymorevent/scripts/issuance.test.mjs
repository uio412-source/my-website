import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {
  EMPTY_PROFILE, addMonths, judge, judgeReviewed, loadProfiles, profileIssuerFor, ruleLine, rulesFor, targetKey,
} from '../lib/issuance-events.ts';

const {events} = JSON.parse(readFileSync(new URL('../data/issuance-events.json', import.meta.url)));
const now = '2026-11-28';
const clean = {...EMPTY_PROFILE, holding: 'none', noReward: true};
const get = id => {
  const actual = events.find(event => event.id === id);
  // Deliberate fixture, independent of the current month’s regeneration.
  return actual ?? novemberRows.find(row => row.id === id);
};
const novemberRows = JSON.parse(readFileSync(new URL('./fixtures/issuance-november-2026.json', import.meta.url)));
const fixture = id => {
  const row = novemberRows.find(event => event.id === id);
  assert.ok(row);
  return row;
};
const sample = {...fixture('ajd-408'), id: 'synthetic-reviewed'};
const review = {issuer: '롯데카드', coverage: 'complete'};
const pay = (window, scope = 'issuer-all') => ({...review, payment: {scope, window}});
const statuses = (e, profile) => judge(e, profile, now).status;

test('롯데 행사 시작 기준: 5월 결제는 현재로부터 6개월이 지나도 제외', () => {
  const e = fixture('ajd-408');
  assert.equal(statuses(e, {...clean, lastCreditPayment: '2026-05-03'}), 'blocked');
  assert.equal(statuses(e, {...clean, lastPayment: '2026-05-03', targetCardUnused: true}), 'unknown');
  assert.equal(statuses(e, {...clean, lastCreditPayment: '2026-04-30'}), 'unknown');
  assert.match(ruleLine(e), /26\.05\.01~26\.10\.31 롯데카드 개인 신용카드/);
});

test('우리 지정 기간: 양끝 포함, 이후 최신 결제만으로 과거 이력 확인 불가', () => {
  const e = fixture('ajd-394');
  for (const lastCreditPayment of ['2026-05-01', '2026-05-03', '2026-10-31']) {
    assert.equal(statuses(e, {...clean, lastCreditPayment}), 'blocked');
  }
  const later = judge(e, {...clean, lastCreditPayment: '2026-11-01'}, now);
  assert.equal(later.status, 'unknown');
  assert.match(later.reasons[0], /지정 기간 전체/);
});

test('현대 대상 카드 미사용 체크가 다른 현대카드 결제를 무시하지 않음', () => {
  const e = fixture('ajd-389');
  assert.equal(statuses(e, {...clean, lastPayment: '2026-11-27', targetCardUnused: true}), 'blocked');
  assert.match(ruleLine(e), /현대카드 전체 카드/);
});

test('네이버페이 BC 목록의 정확한 일상의 기쁨 건은 IBK 입력, 6개월 추정 폐기', () => {
  const e = fixture('naver-20261027002805865293');
  assert.equal(profileIssuerFor(e), 'IBK기업은행');
  assert.equal(statuses(e, {...clean, noReward: false, lastPayment: '2025-01-01', lastReward: '2025-09-01', targetCardUnused: true}), 'unknown');
  assert.match(ruleLine(e), /IBK.*2년/);
  assert.equal(profileIssuerFor({...e, id: 'other-bc-promotion'}), 'BC카드');
});

test('현재 데이터에서 네 캠페인 발췌/범위 확인, 회차·원문이나 URL 변경 시 재검수', () => {
  for (const example of novemberRows) {
    assert.ok(rulesFor(example));
    const e = get(example.id);
    // A legitimate refresh can change an excerpt; only the exact review match may apply.
    if (e.url === example.url && e.startsAt === example.startsAt && e.endsAt === example.endsAt && e.eligibilityRuleText === example.eligibilityRuleText) {
      assert.ok(rulesFor(e));
    } else {
      assert.equal(rulesFor(e), undefined);
    }
    assert.equal(rulesFor({...example, eligibilityRuleText: '조건 변경'}), undefined);
    assert.equal(rulesFor({...example, url: 'https://example.org/other'}), undefined);
    assert.equal(rulesFor({...example, startsAt: '2026-12-01', endsAt: '2026-12-31'}), undefined);
    assert.equal(judge(example, clean, '2026-12-01').label, '종료');
    assert.equal(judge(example, clean, '2026-10-31').label, '시작 전');
  }
});

test('검수 안 된 행사에 이전 집계 추정이나 체크를 근거로 초록 배지 금지', () => {
  for (const e of events.filter(e => !rulesFor(e))) {
    const verdict = judge(e, {...clean, noPayment: true, targetCardUnused: true}, now);
    assert.notEqual(verdict.status, 'ok');
    assert.notEqual(verdict.status, 'target');
    assert.equal(ruleLine(e), null);
  }
});

test('검수 완료된 명시적 롤링만 대기일 계산, 만료 전에 충족 못하면 차단', () => {
  const rules = pay({kind: 'rolling', months: 6});
  const p = {...clean, lastPayment: '2026-05-30'};
  assert.deepEqual(judgeReviewed(sample, rules, p, now),
    {status: 'wait', label: '2일 뒤 가능', from: '2026-11-30', days: 2, reasons: ['최근 6개월 롯데카드 전체 카드 결제 이력']});
  assert.equal(judgeReviewed(sample, rules, p, '2026-11-30').status, 'ok');
  assert.equal(judgeReviewed(sample, rules, {...p, lastPayment: '2026-06-01'}, now).status, 'blocked');
  assert.equal(addMonths('2024-08-31', 6), '2025-02-28');
  assert.equal(addMonths('2024-08-31', -6), '2024-02-29');
});

test('보유·탈회·혜택 수령 검증: 후속 조건 미입력을 참여 가능이나 대기로 처리하지 않음', () => {
  const rules = {...review, holder: 'no-current-holder', reward: {kind: 'rolling', months: 12}, cancellation: {kind: 'all'}};
  assert.equal(judgeReviewed(sample, rules, {...clean, holding: 'holding'}, now).status, 'blocked');
  assert.equal(judgeReviewed(sample, rules, clean, now).status, 'unknown');
  assert.equal(judgeReviewed(sample, rules, {...clean, noCancellation: true}, now).status, 'ok');
  assert.equal(judgeReviewed(sample, rules, {...clean, canceledAt: '2026-01-01'}, now).status, 'blocked');
  assert.equal(judgeReviewed(sample, rules, {...clean, noCancellation: true, noReward: false, lastReward: '2026-11-01'}, now).status, 'blocked');
});

test('상품 미사용 확인은 같은 카드사 내 다른 행사·다른 상품·다른 기간에 공유되지 않음', () => {
  const a = {...review, targetUnused: {product: '정확한 카드 A'}};
  const b = {...review, targetUnused: {product: '정확한 카드 B'}};
  const key = targetKey(sample, a);
  const legacy = {...clean, targetCardUnused: true};
  assert.equal(judgeReviewed(sample, a, legacy, now).status, 'target');
  assert.equal(judgeReviewed(sample, a, legacy, now, key).status, 'ok');
  assert.equal(judgeReviewed(sample, b, legacy, now, key).status, 'target');
  assert.equal(judgeReviewed({...sample, id: 'second-offer'}, a, legacy, now, key).status, 'target');
  assert.equal(judgeReviewed({...sample, startsAt: '2026-11-02'}, a, legacy, now, key).status, 'target');
  assert.equal(judgeReviewed(sample, {...a, coverage: 'partial'}, legacy, now, key).status, 'unknown');
});

test('이전 저장값에서 카드사 공통 대상카드 체크는 가져오지 않음', () => {
  const before = globalThis.localStorage;
  try {
    Object.defineProperty(globalThis, 'localStorage', {configurable: true, value: {getItem: () =>
      JSON.stringify({'롯데카드': {lastPayment: '2026-05-03', targetCardUnused: true}})}});
    const p = loadProfiles()['롯데카드'];
    assert.equal(p.lastPayment, '2026-05-03');
    assert.equal(p.lastCreditPayment, null);
    assert.equal(Object.hasOwn(p, 'targetCardUnused'), false);
  } finally {
    Object.defineProperty(globalThis, 'localStorage', {configurable: true, value: before});
  }
});

test('잘못된 날짜·범위·빈 검수 규칙을 참여 가능으로 표시하지 않음', () => {
  for (const lastPayment of ['2026-02-31', '2026-12-01', '임의']) {
    assert.equal(judgeReviewed(sample, pay({kind: 'all'}), {...clean, lastPayment}, now).status, 'unknown');
  }
  assert.equal(judgeReviewed(sample, review, clean, now).status, 'unknown');
  assert.equal(judgeReviewed(sample, pay({kind: 'fixed', from: '2026-10-31', through: '2026-05-01'}), {...clean, noPayment: true}, now).status, 'unknown');
  assert.equal(judgeReviewed(sample, {...review, targetUnused: {product: ''}}, clean, now).status, 'unknown');
});
