// 심의일·확인일은 종료일이 아니다. 공식 종료 상태와 날짜만 표시한다.
const kstDay = () => new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);

export function discontinuedBadge(status?: 'active' | 'discontinued', date?: string | null, today = kstDay()) {
  if (status !== 'discontinued') return null;
  const day = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(date + 'T00:00:00Z') : null;
  if (!day || !Number.isFinite(day.getTime()) || day.toISOString().slice(0, 10) !== date) return {ended: true, label: '단종'};
  const ended = date! <= today;
  return {ended, label: (ended ? '단종' : '발급 종료 예정') + '(' + date!.slice(2).replaceAll('-', '.') + ')'};
}
