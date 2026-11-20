export function conflictingEventPeriod(requirements:string[],start:string|null,end:string|null){
 if(!start||!end)return false;
 for(const text of requirements){
  const label=text.match(/(?:행사|예약|결제|응모|참여)\s*(?:\([^)]*\))?\s*기간/);
  if(!label)continue;
  if(label[0].startsWith('행사')&&/숙박|투숙|출발|체류/.test(text.slice(0,label.index)))continue;
  const date=text.slice((label.index??0)+label[0].length).match(/((?:20)?\d{2})\s*[.\/-]\s*(\d{1,2})\s*[.\/-]\s*(\d{1,2})(?:\s*\([^)]*\))?\s*[~～–—-]\s*(?:((?:20)?\d{2})\s*[.\/-]\s*)?(\d{1,2})\s*[.\/-]\s*(\d{1,2})/);
  if(!date)continue;
  const format=(y:string,m:string,d:string)=>(y.length===2?'20'+y:y)+'-'+m.padStart(2,'0')+'-'+d.padStart(2,'0');
  if(format(date[1],date[2],date[3])!==start||format(date[4]??date[1],date[5],date[6])!==end)return true;
 }
 return false;
}
