"""Create Korean display translations; retain original names and property identities."""
import concurrent.futures, json, pathlib, re, time, urllib.parse, urllib.request
root = pathlib.Path(__file__).resolve().parents[1]
cache_path = root / 'work/hotel-name-translations.json'
cache = json.loads(cache_path.read_text(encoding='utf-8')) if cache_path.exists() else {}
cache.update(json.loads((root/'data/hotel-display-overrides.json').read_text(encoding='utf-8')))
files = {p: json.loads(p.read_text(encoding='utf-8')) for p in (root/'public/hotels').glob('*.json')}
texts = list(dict.fromkeys(v for entries in files.values() for p in entries for v in [p['name'], p.get('city'), p.get('brand'), p.get('country')] if v))
pending = [v for v in texts if v not in cache]
batches = [pending[i:i+8] for i in range(0,len(pending),8)]
def translate(batch):
    query = '\n'.join(f'[H{i:04d}] {v}' for i,v in enumerate(batch))
    url = 'https://translate.googleapis.com/translate_a/single?'+urllib.parse.urlencode({'client':'gtx','sl':'auto','tl':'ko','dt':'t','q':query})
    for attempt in range(4):
        try:
            j = json.load(urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'}),timeout=30))
            result = ''.join(x[0] for x in j[0] if x[0])
            found = {int(m.group(1)):m.group(2).strip() for m in re.finditer(r'\[H\s*(\d{4})\]\s*(.*?)(?=\[H\s*\d{4}\]|$)',result,re.S|re.I)}
            if set(found)!=set(range(len(batch))):
                return {}
            return {v:found[i].replace('\n',' ').strip() for i,v in enumerate(batch) if found[i]}
        except Exception:
            time.sleep(2*(attempt+1))
    return {}
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as executor:
    for n,result in enumerate(executor.map(translate,batches)):
        cache.update(result)
        if n%20==0:
            cache_path.write_text(json.dumps(cache,ensure_ascii=False),encoding='utf-8')
            print(f'translated {len(cache)} / {len(texts)}',flush=True)
cache_path.write_text(json.dumps(cache,ensure_ascii=False),encoding='utf-8')
def translate_single(value):
    url='https://translate.googleapis.com/translate_a/single?'+urllib.parse.urlencode({'client':'gtx','sl':'auto','tl':'ko','dt':'t','q':value})
    try:
        j=json.load(urllib.request.urlopen(url,timeout=25));return value,''.join(x[0] for x in j[0] if x[0]).strip()
    except Exception:return value,None
remaining=[v for v in texts if v not in cache]
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
    for value,result in executor.map(translate_single,remaining):
        if result:cache[value]=result
cache_path.write_text(json.dumps(cache,ensure_ascii=False),encoding='utf-8')
for p,entries in files.items():
    for hotel in entries:
        hotel['nameKo']=cache.get(hotel['name'], hotel['name'])
        hotel['nameKoEvidence']='display-translation'
        if hotel.get('city'): hotel['cityKo']=cache.get(hotel['city'],hotel['city'])
        if hotel.get('brand'): hotel['brandKo']=cache.get(hotel['brand'],hotel['brand'])
        if hotel.get('country'): hotel['countryKo']=cache.get(hotel['country'],hotel['country'])
    p.write_text(json.dumps(entries,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
print(json.dumps({'localized':len(cache),'pending':len([v for v in texts if v not in cache])}),flush=True)
