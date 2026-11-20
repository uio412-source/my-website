/** Official, public event inventories. Pagination is checked against the issuer's count. */
export type HHLEvent = { issuer: string; title: string; sourceUrl: string; fetchUrl?: string; startsAt: string | null; endsAt: string | null; summary?: string; imageUrl?: string | null };
type Getter = (url: string, init?: RequestInit) => Promise<string>;
const text = (s: unknown) => String(s ?? '').replace(/<br\s*\/?\s*>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
const date = (s: unknown): string | null => { const m = String(s ?? '').match(/(\d{4})\s*[.\/-]?\s*(\d{1,2})\s*[.\/-]?\s*(\d{1,2})/); return m ? `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}` : null; };
const url = (s: string, base: string) => new URL(s.replace(/&amp;/g, '&'), base).href;
const post = (params: Record<string, string>): RequestInit => ({ method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(params).toString() });
const unique = (rows: HHLEvent[]) => [...new Map(rows.map(r => [r.sourceUrl, r])).values()];

export async function discoverHHL(issuer: string, get: Getter): Promise<HHLEvent[]> {
  if (issuer === '하나카드') return hana(get);
  if (issuer === '현대카드') return hyundai(get);
  if (issuer === '롯데카드') return lotte(get);
  return [];
}

async function hana(get: Getter): Promise<HHLEvent[]> {
  const base = 'https://m.hanacard.co.kr';
  const rows: HHLEvent[] = []; let total = 0, totalPages = 1;
  // The website sends an empty category for “전체”. 00000 returns an empty inventory.
  for (let page = 1; page <= totalPages; page++) {
    const j = JSON.parse(await get(`${base}/MKEVT1000M.ajax`, post({ page: String(page), evnCate: '', schTxt: '' })));
    const map = j.DATA?.eventListMap;
    if (String(j.CODE) !== '0' || !map || !Array.isArray(map.list)) throw new Error('하나카드 공식 목록 응답 형식이 변경되었습니다.');
    if (page === 1) { total = Number(map.totalCount); totalPages = Number(map.totalPage); }
    if (!Number.isFinite(total) || !Number.isFinite(totalPages) || totalPages > 100) throw new Error('하나카드 목록 페이지 수를 확인하지 못했습니다.');
    for (const x of map.list) {
      if (!/^\d+$/.test(String(x.EVN_SEQ))) throw new Error('하나카드 공식 이벤트 ID가 없습니다.');
      rows.push({ issuer: '하나카드', title: text([x.ITG_APP_EVN_MC_NM, x.EVN_TIT_NM].filter(Boolean).join(' · ')), sourceUrl: `${base}/MKEVT1010M.web?EVN_SEQ=${x.EVN_SEQ}`, startsAt: date(x.EVN_SDT), endsAt: date(x.EVN_EDT), summary: text(x.ADD_VAR5 || x.EVN_DESC || x.EVN_TIT_NM), imageUrl: x.ADD_VAR2 ? url(x.ADD_VAR2, base) : null });
    }
  }
  const result = unique(rows);
  if (result.length !== total) throw new Error(`하나카드 전체 목록 ${total}건 중 ${result.length}건만 수집되었습니다.`);
  return result;
}

function lotteRows(html: string): HHLEvent[] {
  const base = 'https://www.lottecard.co.kr';
  const rows: HHLEvent[] = [];
  for (const li of html.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)) {
    const h = li[1], id = h.match(/tlfLoad\('\d+'\s*,\s*'click'\s*,\s*'(\d+)'/)?.[1];
    const title = text(h.match(/<b\b[^>]*>([\s\S]*?)<\/b>/i)?.[1]);
    const range = text(h.match(/<span\b[^>]*class=["']date["'][^>]*>([\s\S]*?)<\/span>/i)?.[1]).split(/\s*[~～]\s*/);
    if (!id || !title) continue;
    const image = h.match(/<img\b[^>]*?\s+src=["']([^"']+)["']/i)?.[1];
    rows.push({ issuer: '롯데카드', title, sourceUrl: `${base}/app/LPBNFDA_V300.lc?evnBultSeq=${id}`, startsAt: date(range[0]), endsAt: date(range[1]), summary: title, imageUrl: image ? url(image, base) : null });
  }
  return rows;
}
async function lotte(get: Getter): Promise<HHLEvent[]> {
  const rows: HHLEvent[] = []; let total = 0, totalPages = 1;
  for (let page = 1; page <= totalPages; page++) {
    const j = JSON.parse(await get('https://www.lottecard.co.kr/app/LPBNFDA_A100.lc', post({ bigTabGubun: '2', pageNo: String(page), evnCtgSeq: '9999', tabGubun: '9999' })));
    if (j.Status?.code !== 0 || typeof j.Content !== 'string' || !j.Param) throw new Error('롯데카드 공식 목록 응답 형식이 변경되었습니다.');
    if (Number(j.Param.pageNo) !== page) throw new Error('롯데카드 목록 페이지가 반복되었습니다.');
    if (page === 1) { total = Number(j.Param.totalRowCnt); totalPages = Number(j.Param.totalPage); }
    if (!Number.isFinite(total) || !Number.isFinite(totalPages) || totalPages > 100) throw new Error('롯데카드 목록 페이지 수를 확인하지 못했습니다.');
    rows.push(...lotteRows(j.Content));
  }
  const result = unique(rows);
  if (result.length !== total) throw new Error(`롯데카드 전체 목록 ${total}건 중 ${result.length}건만 수집되었습니다.`);
  return result;
}

async function hyundai(get: Getter): Promise<HHLEvent[]> {
  const base = 'https://www.hyundaicard.com';
  const html = await get(`${base}/cpb/ev/CPBEV0101_01.hc`);
  const rows: HHLEvent[] = [];
  for (const a of html.matchAll(/<a\b[^>]*href=["']([^"']*CPBEV0101_06\.hc\?bnftWebEvntCd=[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const h = a[2], title = text(h.match(/<span\b[^>]*class=["']txt_title["'][^>]*>([\s\S]*?)<\/span>/i)?.[1]);
    if (!title) continue;
    const range = text(h.match(/<span\b[^>]*class=["']txt_date["'][^>]*>([\s\S]*?)<\/span>/i)?.[1]).split(/\s*[~～]\s*/);
    const image = h.match(/<img\b[^>]*?\s+src=["']([^"']+)["']/i)?.[1];
    rows.push({ issuer: '현대카드', title, sourceUrl: url(a[1], base).replace(/&searchWord=$/, ''), startsAt: date(range[0]), endsAt: date(range[1]), summary: title, imageUrl: image ? url(image, base) : null });
  }
  const value = (id: string) => html.match(new RegExp(`id=["']${id}["'][^>]*value=["']([^"']*)`))?.[1];
  let rnum = Number(value('rnum')), index = Number(value('index'));
  const size = Number(value('pageSize')), imagePath = value('imgPath') || '/upload/cpd/mb';
  let total = Number(html.match(/var\s+totCount\s*=\s*["'](\d+)["']/)?.[1]);
  if (!rows.length || !Number.isFinite(total) || !size || !rnum || !index) throw new Error('현대카드 공식 목록의 페이지 정보를 확인하지 못했습니다.');
  let page = 1;
  while (rows.length < total) {
    if (++page > 100) throw new Error('현대카드 목록 페이지 한도를 초과했습니다.');
    const j = JSON.parse(await get(`${base}/cpb/ev/apiCPBEV0101_05s.hc`, post({ rnum: String(rnum), index: String(index), searchWord: '', evntCtgrVl: '' })));
    const b = j.bdy;
    if (!b || !Array.isArray(b.eventList) || !b.eventList.length) throw new Error(`현대카드 전체 목록 ${total}건 중 ${rows.length}건 이후 목록이 비었습니다.`);
    total = Number(b.totalCount);
    for (const x of b.eventList) {
      if (!/^[a-z\d]+$/i.test(String(x.bnftWebEvntCd))) throw new Error('현대카드 공식 이벤트 ID가 없습니다.');
      rows.push({ issuer: '현대카드', title: text(x.bnftEvntNm), sourceUrl: `${base}/cpb/ev/CPBEV0101_06.hc?bnftWebEvntCd=${x.bnftWebEvntCd}`, startsAt: date(x.srtDttm), endsAt: date(x.endDttm), summary: text(x.bnftEvntNm), imageUrl: x.pcLisImgFileNm ? url(`${imagePath}/${x.pcLisImgFileNm}`, base) : null });
    }
    rnum = Number(b.cpbev0101_0103VO?.rnum) + size;
    index = Number(b.cpbev0101_0103VO?.index) + size;
  }
  const result = unique(rows);
  if (result.length !== total) throw new Error(`현대카드 전체 목록 ${total}건 중 ${result.length}건만 수집되었습니다.`);
  return result;
}
