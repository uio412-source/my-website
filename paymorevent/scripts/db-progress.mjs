// 푸터의 'DB 작업' 진행률 — data/collect-queue.json(tools/data/queue.py가 만듦)을 빌드 때 줄여서 넣습니다.
//   상품설명서     cards 중 status가 done인 카드
//   브랜드 서비스  brandPrograms 중 done인 프로그램(발레만 넣어 둔 valet-only는 아직으로 봄)
//   이벤트 출처    eventSources 중 최근 7일 안에 모은 곳(lastCollected) — 이벤트는 날마다 바뀌어서 한 번 모은 걸로 끝나지 않음
export const RECENT_DAYS = 7;

export function dbProgress(queue, today) {
  const counts = queue?.counts;
  if (!counts?.cards?.total || !counts?.brandPrograms?.total || !Array.isArray(queue.eventSources)) return null;
  const since = new Date(Date.parse(today) - (RECENT_DAYS - 1) * 864e5).toISOString().slice(0, 10);
  const sources = queue.eventSources;
  return {
    asOf: today,
    rows: [
      {label: '상품설명서', done: counts.cards.done, total: counts.cards.total, unit: '종'},
      {label: '브랜드 서비스', done: counts.brandPrograms.done, total: counts.brandPrograms.total, unit: '개'},
      {label: '이벤트 출처', done: sources.filter(s => s.lastCollected && s.lastCollected >= since).length, total: sources.length, unit: '곳'},
    ],
  };
}

/** 한국 날짜(YYYY-MM-DD) */
export const kstToday = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
