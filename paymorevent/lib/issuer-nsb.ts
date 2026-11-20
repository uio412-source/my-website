export type NSBEvent = {
  issuer: string; title: string; sourceUrl: string; fetchUrl?: string;
  startsAt: string | null; startsAtLabel?:string; endsAt: string | null; summary?: string; imageUrl?: string | null;
};
type Getter = (url: string, init?: RequestInit) => Promise<string>;
const today = () => new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
const text = (s: unknown) => String(s ?? '').replace(/<!--[\s\S]*?-->/g, ' ').replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const date = (s: unknown): string | null => {
  const m = String(s ?? '').match(/^(\d{4})[.\/-]?(\d{2})[.\/-]?(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
};
export function nsbPeriod(s: string): [string | null, string | null] {
  // Some official NH lists hide the start date in an HTML comment while displaying the end.
  const t = s.replace(/<!--|-->/g, ' ').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
  const m = t.match(/((?:20)?\d{2})\s*[.\/-]\s*(\d{1,2})\s*[.\/-]\s*(\d{1,2})\s*\.?(?:\s*\([^)]*\))?\s*[~～–—-]\s*(?:((?:20)?\d{2})\s*[.\/-]\s*)?(\d{1,2})\s*[.\/-]\s*(\d{1,2})/);
  const fmt = (y: string, mo: string, d: string) => `${y.length === 2 ? '20' + y : y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  if (m) return [fmt(m[1], m[2], m[3]), fmt(m[4] ?? m[1], m[5], m[6])];
  const received = t.match(/(?:수신일|신청일|등록일)\s*[~～–—-]\s*((?:20)?\d{2})\s*[.\/-]\s*(\d{1,2})\s*[.\/-]\s*(\d{1,2})/);
  if (received) return [null, fmt(received[1], received[2], received[3])];
  const oneDay = t.trim().match(/^((?:20)?\d{2})\s*[.\/-]\s*(\d{1,2})\s*[.\/-]\s*(\d{1,2})\s*(?:\([^)]*\))?(?:\s+\d{1,2}:\d{2}\s*[-~]\s*\d{1,2}:\d{2})?\s*(?:\(카드 승인일 기준\))?$/);
  if (oneDay) { const d = fmt(oneDay[1], oneDay[2], oneDay[3]); return [d, d]; }
  const end = t.match(/((?:20)?\d{2})\s*[.\/-]\s*(\d{1,2})\s*[.\/-]\s*(\d{1,2})\s*까지/);
  return [null, end ? fmt(end[1], end[2], end[3]) : null];
}
function current(e: NSBEvent) { return !e.endsAt || e.endsAt >= today(); }
function dedupe(events: NSBEvent[]) { return [...new Map(events.map(e => [e.sourceUrl, e])).values()]; }
function jsonConst(raw: string, key: string): any {
  const start = raw.match(new RegExp(`(?:const|let|var)\\s+${key}\\s*=\\s*`));
  if (!start || start.index === undefined) throw new Error(`${key} official data missing`);
  const from = start.index + start[0].length;
  let depth = 0, quoted = false, escape = false;
  for (let i = from; i < raw.length; i++) {
    const c = raw[i];
    if (quoted) { if (escape) escape = false; else if (c === '\\') escape = true; else if (c === '"') quoted = false; }
    else if (c === '"') quoted = true;
    else if (c === '{' || c === '[') depth++;
    else if (c === '}' || c === ']') { if (--depth === 0) return JSON.parse(raw.slice(from, i + 1)); }
  }
  throw new Error(`${key} official data truncated`);
}
function splitArgs(s: string): string[] {
  const result: string[] = []; let begin = 0, depth = 0, quote = '', escape = false;
  for (let i = 0; i < s.length; i++) { const c = s[i];
    if (quote) { if (escape) escape = false; else if (c === '\\') escape = true; else if (c === quote) quote = ''; }
    else if (c === '"' || c === "'") quote = c;
    else if ('([{'.includes(c)) depth++;
    else if (')]}'.includes(c)) depth--;
    else if (c === ',' && depth === 0) { result.push(s.slice(begin, i)); begin = i + 1; }
  }
  result.push(s.slice(begin)); return result;
}
function samsungHydration(raw: string): any[] {
  const s = raw.match(/window\.__NUXT__\s*=\s*([\s\S]*?)<\/script>/)?.[1];
  if (!s) throw new Error('Samsung event hydration missing');
  const signature = s.match(/function\(([^)]*)\)\{/), list = s.match(/wcmsEventList:([a-zA-Z_$][\w$]*)/)?.[1], start = s.lastIndexOf('}(');
  if (!signature || !list || start < 0) throw new Error('Samsung event hydration layout changed');
  const names = signature[1].split(','), values = splitArgs(s.slice(start + 2).replace(/\)\);?\s*$/, ''));
  const vars = new Map(names.map((name, i) => [name, values[i]]));
  const resolve = (v: string) => { try { return JSON.parse(vars.get(v) ?? v); } catch { return ''; } };
  const escaped = list.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return [...s.matchAll(new RegExp(`${escaped}\\[\\d+\\]=\\{([^{}]+)\\}`, 'g'))].map(m => {
    const o: Record<string, unknown> = {};
    for (const entry of splitArgs(m[1])) { const at = entry.indexOf(':'); if (at > 0) o[entry.slice(0, at)] = resolve(entry.slice(at + 1)); }
    return o;
  });
}
function samsungJSON(raw: string): any {
  // A few official CMS files contain literal newlines or tabs inside HTML JSON strings.
  // Escape those characters as data; never execute the response as JavaScript.
  let result = '', quoted = false, escaped = false;
  for (const c of raw) {
    if (quoted && !escaped && c.charCodeAt(0) < 32) { result += JSON.stringify(c).slice(1, -1); continue; }
    result += c;
    if (escaped) escaped = false;
    else if (quoted && c === '\\') escaped = true;
    else if (c === '"') quoted = !quoted;
  }
  return JSON.parse(result);
}
export function parseSamsungNSBPeriod(raw: string): [string | null, string | null] {
  const j = samsungJSON(raw);
  const header = nsbPeriod(String(j.evtHeaderTxt ?? ''));
  if (header[1]) return header;
  const html = String(j.wcmsHtml?.htmlText ?? '');
  const labels = [...html.matchAll(/<(?:h[1-6]|dt|strong|p)[^>]*>\s*(?:행사|이벤트|응모|시행)\s*기간\s*[:：]?\s*<\/(?:h[1-6]|dt|strong|p)>\s*([\s\S]{0,500})/g)];
  for (const m of labels) {
    const nearby = text(m[1]).split(/대상카드|대상회원|행사장소|대상차종|혜택제공/)[0];
    const p = nsbPeriod(nearby); if (p[1]) return p;
    const single = nearby.match(/^\s*((?:20)?\d{2}\s*[.\/-]\s*\d{1,2}\s*[.\/-]\s*\d{1,2})(?:\s*\([^)]*\))?/);
    if (single && !/[~～–—]/.test(nearby.slice(0,100))) { const d = nsbPeriod(single[1]); if (d[1]) return d; }
  }
  const body = text(html);
  const labelled = body.match(/(?:행사|이벤트|응모|시행)\s*기간\s*[:：]?\s*([\s\S]{0,150})/)?.[1];
  return labelled ? nsbPeriod(labelled) : [null, null];
}
async function samsung(get: Getter): Promise<NSBEvent[]> {
  let list: any[];
  try { const j = JSON.parse(await get('https://static11.samsungcard.com/wcms/event/general_v2/eventList.json')); if (!Array.isArray(j.eventList)) throw new Error('Samsung eventList missing'); list = j.eventList; }
  catch { list = samsungHydration(await get('https://www.samsungcard.com/home/benefit/event/PGHPPCCBenefitEventViewIndex001')); }
  if (!list.length) throw new Error('Samsung official event list is empty');
  const candidates = dedupe(list.map(x => {
    const [startsAt, endsAt] = nsbPeriod(String(x.evtTodaySubCopy ?? ''));
    const fetchUrl = new URL(String(x.detailUrl), 'https://static11.samsungcard.com').href;
    return { issuer: '삼성카드', title: text(x.evtTodayMainCopy), sourceUrl: `https://www.samsungcard.com/personal/event/ing/UHPPBE1403M0.jsp?cms_id=${encodeURIComponent(x.cmsId)}`, fetchUrl, startsAt, endsAt, startsAtLabel:undefined as string|undefined, imageUrl: x.evtMoaImg ? new URL(x.evtMoaImg, 'https://static11.samsungcard.com').href : null };
  }).filter(e => e.title && e.fetchUrl.includes('/wcms/event/') && current(e)));
  for (let offset = 0; offset < candidates.length; offset += 4) await Promise.all(candidates.slice(offset, offset + 4).map(async e => {
    try {
      const raw = await get(e.fetchUrl!);
      const [start, end] = parseSamsungNSBPeriod(raw);
      if (end) {
        if (e.endsAt && (e.endsAt !== end || (e.startsAt && start && e.startsAt !== start))) {
          e.summary = `공식 목록 기간 ${e.startsAt ?? '미기재'}~${e.endsAt}과 공식 상세 기간 ${start ?? '미기재'}~${end}이 다릅니다. 확인 전 게시를 보류합니다.`;
          e.startsAt = null; e.endsAt = null;
        } else { e.startsAt = start; e.endsAt = end; if(!start&&/수신일/.test(text(samsungJSON(raw).wcmsHtml?.htmlText??'')+' '+text(samsungJSON(raw).evtHeaderTxt)))e.startsAtLabel='수신일'; }
      } else if (!e.endsAt) {
        const detail = samsungJSON(raw), body = text(detail.wcmsHtml?.htmlText ?? '');
        e.summary = /횟수,?\s*기간 제한 없음/.test(body)
          ? '공식 상세에는 기능 설정의 횟수·기간 제한 없음으로 안내되어 있습니다. 별도 이벤트 행사기간은 확인되지 않았습니다.'
          : body ? '공식 상세 본문을 확인했으나 행사기간이 기재되어 있지 않습니다. 현재 진행 이벤트 여부는 추가 확인이 필요합니다.'
          : '공식 상세는 본문 행사기간을 제공하지 않습니다. 이미지 또는 외부 연결 페이지 확인이 필요합니다.';
      }
    } catch { if (!e.endsAt) e.summary = '공식 상세 JSON을 읽지 못해 행사기간을 확인하지 못했습니다. 제목으로 날짜를 추정하지 않습니다.'; }
  }));
  return candidates.filter(current);
}
function parseNHList(raw: string): NSBEvent[] {
  const list = raw.match(/id="evtList"([\s\S]*?)class="page_num"/)?.[1] ?? raw;
  return [...list.matchAll(/<a\b[^>]*onclick="goEvtDtail\('(\d+)(?:\.0)?'[^)]*\)"[^>]*>([\s\S]*?)<\/a>/g)].map(m => {
    const block = m[2], title = text(block.match(/<div\b[^>]*class="tit"[^>]*>([\s\S]*?)<\/div>/)?.[1]);
    const [startsAt, endsAt] = nsbPeriod(block.match(/<div\b[^>]*class="date"[^>]*>([\s\S]*?)<\/div>/)?.[1] ?? '');
    const image = block.match(/<img\b[^>]*src="([^"]+)"/)?.[1]?.trim();
    const url = `https://card.nonghyup.com/servlet/IpCb2002R.act?EVT_CRT_SQNO=${m[1]}`;
    return { issuer: 'NH농협카드', title, sourceUrl: url, fetchUrl: url, startsAt, endsAt, imageUrl: image ? new URL(image, 'https://card.nonghyup.com').href : null };
  }).filter(e => e.title && current(e));
}
async function nh(get: Getter): Promise<NSBEvent[]> {
  const url = 'https://card.nonghyup.com/servlet/IpCb2001R.act';
  const request = (page: number) => get(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ pageNum: String(page), pageSize: '12', ORDER_CONDITION: 'REGISTER', DTL_CNM: '', DTL_CNM_DT: '', SEARCH_TEXT: '' }).toString() });
  const raw = await request(1), total = Number(raw.match(/id="totCnt"[^>]*>(\d+)/)?.[1]);
  if (!Number.isFinite(total)) throw new Error('NH official total count missing');
  const first = parseNHList(raw), all = [...first];
  // Follow the official total instead of imposing a record cap.
  for (let page = 2; page <= Math.ceil(total / 12); page++) {
    const rows = parseNHList(await request(page));
    if (!rows.length) throw new Error(`NH pagination page ${page} returned no records before ${total} official records were collected`);
    all.push(...rows);
  }
  const unique = dedupe(all);
  if (unique.length !== total) throw new Error(`NH official list reconciliation failed: ${unique.length}/${total}`);
  return unique;
}
export function parseBCDetailPeriod(raw: string): [string | null, string | null] {
  const j = jsonConst(raw, 'eventData'); return [date(j.evntStrtDtm), date(j.evntEndDtm)];
}
async function bc(get: Getter): Promise<NSBEvent[]> {
  const main = await get('https://web.paybooc.co.kr/web/evnt/main');
  let data = jsonConst(main, 'evntInfo');
  const rows: any[] = [...(data.evntInqrList ?? [])], seenPages = new Set<number>();
  // Current Paybooc ING response contains the complete list (80 records on 2026-10-07).
  // A future paginated response is followed through its own nextPageNo cursor.
  let next = Number(data.pageDto?.nextPageNo ?? 0);
  while (next > 0) {
    if (seenPages.has(next)) throw new Error('BC pagination repeated a cursor'); seenPages.add(next);
    const query = new URLSearchParams({ reqType: 'more', inqrDv: 'ING', pgeNo: String(next), evntMrktTypCd: '', ordering: '' });
    const j = JSON.parse(await get(`https://web.paybooc.co.kr/web/evnt/lst-evnt-data?${query}`));
    if (j.status?.success === false) throw new Error('BC official list request failed');
    data = j.data;
    if (!Array.isArray(data?.evntInqrList)) throw new Error('BC official event list schema changed');
    rows.push(...data.evntInqrList);
    const following = Number(data.pageDto?.nextPageNo ?? 0);
    if (following === next) break;
    next = following;
  }
  if (!rows.length) throw new Error('BC official event list is empty');
  const unique = [...new Map(rows.filter(x => !x.endEvent).map(x => [x.pybcUnifEvntNo, x])).values()];
  const result: NSBEvent[] = [];
  for (let offset = 0; offset < unique.length; offset += 4) await Promise.all(unique.slice(offset, offset + 4).map(async x => {
    const sourceUrl = `https://web.paybooc.co.kr/web/evnt/evnt-dts?pybcUnifEvntNo=${encodeURIComponent(x.pybcUnifEvntNo)}`;
    let startsAt: string | null = null, endsAt: string | null = null;
    // evntBltn* in the list is publication time, not event time. Read actual evntStrt/End from the official detail.
    try { [startsAt, endsAt] = parseBCDetailPeriod(await get(sourceUrl)); } catch { /* Keep discovery visible to the caller without inventing dates. */ }
    const e = { issuer: 'BC카드', title: text([x.pybcUnifEvntNm1, x.pybcUnifEvntNm2, x.pybcUnifEvntNm3].filter(Boolean).join(' ')), sourceUrl, fetchUrl: sourceUrl, startsAt, endsAt, imageUrl: x.evntBsImgUrlAddr ?? null };
    if (e.title && current(e)) result.push(e);
  }));
  return dedupe(result);
}
export async function discoverNSB(issuer: string, get: Getter): Promise<NSBEvent[]> {
  if (issuer === '삼성카드') return samsung(get);
  if (issuer === 'NH농협카드') return nh(get);
  if (issuer === 'BC카드') return bc(get);
  return [];
}
