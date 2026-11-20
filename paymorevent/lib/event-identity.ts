/** Stable issuer event identity across desktop, mobile and parameter ordering. */
export function eventSourceKey(o:{sourceUrl:string;sourceDetailUrl?:string}){
 const u=new URL(o.sourceDetailUrl??o.sourceUrl);
 const host=u.hostname.replace(/^(www|m|pc|mobileapps)\./,'');
 if(u.hostname==='kbcard.com'||u.hostname.endsWith('.kbcard.com'))for(const k of ['eventNum','evntId','evntSerno'])if(u.searchParams.has(k))return 'kbcard.com|event='+u.searchParams.get(k);
 for(const k of ['EVN_SEQ','evnBultSeq','pybcUnifEvntNo','EVT_CRT_SQNO','bnftWebEvntCd','cms_id','evntSeq','EVNT_SQ'])if(u.searchParams.has(k))return host+'|'+k+'='+u.searchParams.get(k);
 return u.origin+u.pathname+u.search;
}
