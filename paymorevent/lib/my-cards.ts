// 브라우저에만 저장하는 내 목록: 비교함(최대 3장)·내 카드(내 혜택, 최대 12장). 탭·화면끼리 바로 맞춰집니다.
import {useEffect, useState} from 'react';

export const COMPARE_KEY = 'mrcards.compare';
export const MINE_KEY = 'mrcards.mine';
export const MINE_MAX = 12;
export const COMPARE_MAX = 3;
const EVENT = 'mrcards:store';

function read(key: string): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? '[]');
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch { return []; }
}
function write(key: string, ids: string[]) {
  try { localStorage.setItem(key, JSON.stringify(ids)); } catch { /* 사생활 보호 모드 등: 이번 화면에서만 유지 */ }
  window.dispatchEvent(new CustomEvent(EVENT, {detail: {key, ids}}));
}

/** 저장된 id 목록을 읽고, 다른 화면·탭에서 바뀌면 다시 그림 */
export function useStoredIds(key: string) {
  const [ids, setIds] = useState<string[]>(() => read(key));
  useEffect(() => {
    const local = (e: Event) => { const d = (e as CustomEvent<{key: string; ids: string[]}>).detail; if (d?.key === key) setIds(d.ids); };
    const other = (e: StorageEvent) => { if (e.key === key) setIds(read(key)); };
    window.addEventListener(EVENT, local);
    window.addEventListener('storage', other);
    return () => { window.removeEventListener(EVENT, local); window.removeEventListener('storage', other); };
  }, [key]);
  return ids;
}

/** 비교함에 넣거나 빼기. 가득 차 있으면 false */
export function toggleCompare(id: string) {
  const ids = read(COMPARE_KEY);
  if (ids.includes(id)) { write(COMPARE_KEY, ids.filter(x => x !== id)); return true; }
  if (ids.length >= COMPARE_MAX) return false;
  write(COMPARE_KEY, [...ids, id]);
  return true;
}
export const clearCompare = () => write(COMPARE_KEY, []);

/** 내 카드(내 혜택)에 등록하거나 빼기. 가득 차 있으면 false */
export function toggleMine(id: string) {
  const ids = read(MINE_KEY);
  if (ids.includes(id)) { write(MINE_KEY, ids.filter(x => x !== id)); return true; }
  if (ids.length >= MINE_MAX) return false;
  write(MINE_KEY, [...ids, id]);
  return true;
}
