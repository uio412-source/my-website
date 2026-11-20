/** Official public event inventories. Counts/pages are checked before returning. */
export type SKWEvent = { issuer: string; title: string; sourceUrl: string; fetchUrl?: string; startsAt: string | null; endsAt: string | null; summary?: string; imageUrl?: string | null };
type Get = (url: string, init?: RequestInit) => Promise<string>;
const SH = 'https://www.shinhancard.com';
const KB = 'https://card.kbcard.com';
const WR = 'https://pc.wooricard.com';
const text = (h: unknown) => String(h ?? '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();
const date = (x: unknown): string | null => {
 const m = String(x ?? '').match(/^(\d{4})[.\/-]?(\d{2})[.\/-]?(\d{2})(?:$|\s)/);
 if (!m) return null;
 const result = `${m[1]}-${m[2]}-${m[3]}`;
 return Number(m[2]) >= 1 && Number(m[2]) <= 12 && Number(m[3]) >= 1 && Number(m[3]) <= 31 ? result : null;
};
const unique = (rows: SKWEvent[]) => [...new Map(rows.map(r => [r.sourceUrl, r])).values()];
const wrInit = (payload: unknown): RequestInit => ({ method: 'POST', headers: {
 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
 'Proworks-Body': 'Y', 'Proworks-Lang': 'ko', 'X-Requested-With': 'XMLHttpRequest',
 'Referer': WR + '/dcpc/yh1/bnf/bnf02/prgevnt/H1BNF202S00.do',
}, body: JSON.stringify(payload) });

export function parseKBInventory(raw: string): SKWEvent[] {
 return [...raw.matchAll(/<a\b[^>]*href=["']javascript:goDetail\('([0-9]+)'[^>]*>([\s\S]*?)<\/a>/g)].map(m => {
  const title = text(m[2].match(/<span class="subject">([\s\S]*?)<\/span>/)?.[1]);
  const dates = text(m[2].match(/<span class="date">([\s\S]*?)<\/span>/)?.[1]).split('~');
  return { issuer: 'KB국민카드', title, sourceUrl: `${KB}/BON/DVIEW/HBBMCXCRVNEC0001?mainCC=a&eventNum=${m[1]}`, startsAt: date(dates[0]), endsAt: date(dates[1]), imageUrl: m[2].match(/<img[^>]+src="([^"]+)"/)?.[1] ?? null };
 }).filter(r => r.title);
}

export async function discoverSKW(issuer: string, get: Get): Promise<SKWEvent[]> {
 if (issuer === '신한카드') {
  // The renewed website's "전체 이벤트" uses this full JSON, and slices it only in UI.
  const data = JSON.parse(await get(SH + '/mob/static/json/vendor/evnPgsList01.json'));
  if (!Array.isArray(data.root?.evnlist)) throw new Error('신한카드 전체 이벤트 JSON 구조 변경');
  const rows: SKWEvent[] = data.root.evnlist.map((x: Record<string, unknown>) => ({
   issuer, title: text(x.mobWbEvtNm), sourceUrl: new URL(String(x.hpgEvtDlPgeUrlAr), SH).href,
   startsAt: date(x.mobWbEvtStd), endsAt: date(x.mobWbEvtEdd),
   summary: text(x.evtImgSlTilNm), imageUrl: x.hpgEvtCtgImgUrlAr ? new URL(String(x.hpgEvtCtgImgUrlAr), SH).href : null,
  }));
  if (rows.some(r => !r.title || !r.startsAt || !r.endsAt)) throw new Error('신한카드 목록 필수 필드 누락');
  return unique(rows);
 }
 if (issuer === 'KB국민카드') {
  const rows: SKWEvent[] = [];
  for (let page = 1; page <= 100; page++) {
   const raw = await get(`${KB}/BON/DVIEW/HBBMCXCRVNEC0001?isAjax=Y&isNoFrame=Y&pageCount=${page}`);
   const current = parseKBInventory(raw);
   if (!current.length && page === 1) throw new Error('KB국민카드 진행 이벤트 목록 파싱 실패');
   if (current.some(r => !r.startsAt || !r.endsAt)) throw new Error('KB국민카드 목록 기간 누락');
   if (current.length && current.every(r => rows.some(p => p.sourceUrl === r.sourceUrl))) throw new Error('KB국민카드 페이지 번호 무시됨');
   rows.push(...current);
   const pages = [...raw.matchAll(/doSearchSpider\([^,]+,\s*["']([0-9]+)["']/g)].map(m => Number(m[1]));
   if (!pages.some(p => p > page)) return unique(rows);
  }
  throw new Error('KB국민카드 목록 페이지 안전 한도 초과');
 }
 if (issuer === '우리카드') {
  const rows: SKWEvent[] = [];
  let reportedTotal: number | null = null;
  for (let page = 1; page <= 100; page++) {
   const raw = await get(WR + '/dcpc/yh1/bnf/bnf02/prgevnt/getPrgEvntList.pwkjson', wrInit({ bnf02PrgEvntVo: {
    evntCtgrNo: '', searchKwrd: '', sortOrd: '', pageIndex: String(page), pageSize: '15', evntItgCfcd: '',
   }}));
   const data = JSON.parse(raw);
   if (data.elHeader?.resSuc !== true || !Array.isArray(data.prgEvntList)) throw new Error('우리카드 목록 API 오류: ' + (data.elHeader?.resMsg ?? '응답 구조 변경'));
   const list = data.prgEvntList;
   if (list.length && Number.isFinite(Number(list[0].totCnt))) reportedTotal = Number(list[0].totCnt);
   const current: SKWEvent[] = list.map((x: Record<string, unknown>) => ({ issuer,
    title: text(x.cardEvntNm), sourceUrl: `${WR}/dcpc/yh1/bnf/bnf02/prgevnt/movePrgEvntDtl.do?evntSrno=${encodeURIComponent(String(x.evntSrno))}`,
    startsAt: date(x.evntSdt), endsAt: date(x.evntEdt), summary: text(x.evntSumTxt),
    imageUrl: x.fileCoursWeb ? new URL(String(x.fileCoursWeb), WR).href : null,
   }));
   if (current.some(r => !r.title || !r.startsAt || !r.endsAt)) throw new Error('우리카드 목록 필수 필드 누락');
   if (current.length && current.every(r => rows.some(p => p.sourceUrl === r.sourceUrl))) throw new Error('우리카드 목록 페이지 번호 무시됨');
   rows.push(...current);
   const count = unique(rows).length;
   if ((reportedTotal !== null && count >= reportedTotal) || list.length < 15) {
    if (reportedTotal !== null && count !== reportedTotal) throw new Error(`우리카드 목록 누락: 공식 ${reportedTotal}건, 수집 ${count}건`);
    return unique(rows);
   }
  }
  throw new Error('우리카드 목록 페이지 안전 한도 초과');
 }
 throw new Error('지원하지 않는 카드사: ' + issuer);
}

/** Fetch Woori's real CMS body: its human detail URL itself is only a JS shell. */
export async function fetchSKWDetail(event: SKWEvent, get: Get): Promise<string> {
 if (event.issuer !== '우리카드') return get(event.fetchUrl ?? event.sourceUrl);
 const id = new URL(event.sourceUrl).searchParams.get('evntSrno');
 if (!id) throw new Error('우리카드 상세 식별자 누락');
 const raw = await get(WR + '/dcpc/yh1/bnf/bnf02/prgevnt/getPrgEvntDtl.pwkjson', wrInit({ bnf02PrgEvntVo: { evntSrno: id } }));
 const data = JSON.parse(raw);
 if (!Array.isArray(data.prgEvntDtl) || !data.prgEvntDtl.length) throw new Error('우리카드 상세 CMS 없음');
 const x = data.prgEvntDtl[0];
 const unescape = (s: unknown) => String(s ?? '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
 return `<h1>${text(x.cardEvntNm)}</h1><p>${text(x.evntSdt)} ~ ${text(x.evntEdt)}</p><p>${text(x.evntSumTxt)}</p>${unescape(x.pcCmsCntnts)}${unescape(x.atnSbjTxt)}`;
}
