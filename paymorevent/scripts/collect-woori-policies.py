"""Read each product's official published search content by exact product code.
The HTML search payload includes the full service text omitted by the page shell.
"""
from ensure_card_source import ensure_card_data
ensure_card_data()
import json,re,urllib.request,urllib.parse,concurrent.futures as cf,hashlib
from pathlib import Path
from datetime import datetime
from zoneinfo import ZoneInfo
DAY=datetime.now(ZoneInfo('Asia/Seoul')).date().isoformat()
from lxml import html
ROOT=Path(__file__).resolve().parent.parent
cards=json.loads((ROOT/'data/cards.json').read_text());research=json.loads((ROOT/'data/document-research.json').read_text());cache=ROOT/'scripts/card-research-cache';cache.mkdir(exist_ok=True)
UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/132.0.0.0 Safari/537.36'
def collect(c):
 url='https://m.wooricard.com/dcmw/mobile/totSearch.do?gubn=01&mGubn=M&searchTerm='+urllib.parse.quote(c['name']);path=cache/('woori-search-'+c['id']+'.html')
 try:
  if path.exists() and datetime.fromtimestamp(path.stat().st_mtime,ZoneInfo('Asia/Seoul')).date().isoformat()==DAY:raw=path.read_bytes()
  else:
   with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':UA,'Referer':'https://m.wooricard.com/'}),timeout=20) as r:raw=r.read(10000000)
   path.write_bytes(raw)
  tree=html.fromstring(raw);data=json.loads(tree.get_element_by_id('sData').text)['data'];record=next((x for x in data.get('PRODUCT',[]) if str(x['CD_PRD_CD'])==c['id'].split('-')[-1]),None)
  if not record:return c['id'],None
  text=html.unescape(record['BDT_CNTNTS']) if hasattr(html,'unescape') else record['BDT_CNTNTS'];lines=[re.sub(r'\s+',' ',l).strip() for l in text.splitlines() if l.strip()]
  return c['id'],{'url':url,'resolvedUrl':url,'checkedAt':DAY,'format':'html','readStatus':'read','lines':lines,'sha256':hashlib.sha256(text.encode()).hexdigest(),'productCode':record['CD_PRD_CD'],'productName':re.sub('<[^>]+>','',record['CD_PRD_NM']),'contentPath':record.get('CNTNTS_URL'),'pages':None}
 except Exception as e:return c['id'],{'error':str(e),'url':url}
results={}
with cf.ThreadPoolExecutor(max_workers=16) as pool:
 for id,d in pool.map(collect,[c for c in cards if c['issuerGroup']=='우리']):
  if d and d.get('readStatus')=='read':research['documents'][d['url']]=d;research['discovered'][id]=list(dict.fromkeys([*research['discovered'].get(id,[]),d['url']]))
  results[id]=d
(ROOT/'data/woori-policy-research.json').write_text(json.dumps(results,ensure_ascii=False)+'\n');(ROOT/'data/document-research.json').write_text(json.dumps(research,ensure_ascii=False)+'\n')
print(json.dumps({'products':len(results),'read':sum(d is not None and d.get('readStatus')=='read' for d in results.values())}))
