"""Repair wrapped PDF section headings and separate minimum-spend eligibility."""
import json,re,runpy,sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf-8')
HERE=Path(__file__).resolve().parent
api=runpy.run_path(str(HERE/'research-card-conditions.py'))
path=api['ROOT']/'data/card-research.json'
rows=json.loads(path.read_text(encoding='utf-8'));cache={};repaired=0

for r in rows:
    for field in ['spendExclusions','benefitExclusions']:
        revised=[]
        for excerpt in r.get(field,[]):
            if field=='spendExclusions' and re.search(r'(?:전월|실적).*(?:미만|미달).*제외',excerpt) and not re.search(r'산정|합산|항목|금액에서',excerpt):
                r['benefitExclusions'].append(excerpt)
                for e in r['evidence']:
                    if e['excerpt']==excerpt:e['field']='benefitExclusions'
                continue
            header=len(excerpt)<85 and '제외' in excerpt and excerpt.endswith(('기준','항목','대상','이용금액','항목]','기준]'))
            if header:
                original_header=excerpt
                ev=next((e for e in r['evidence'] if e['excerpt']==excerpt and e['field']==field),None)
                if ev:
                    url=ev['sourceUrl']
                    if url not in cache:
                        meta,raw=api['fetch'](url);cache[url]=api['document_lines'](meta,raw)[0]
                    lines=cache[url]
                    if excerpt in lines:
                        i=lines.index(excerpt);parts=[excerpt]
                        for following in lines[i+1:i+20]:
                            if api['STOP'].search(following) or re.search(r'^(?:기타 기준|카드 이용 유의사항|해외 결제 이용 안내|서비스 제공 기준|유의사항|유의 사항)',following):break
                            parts.append(following)
                            if sum(map(len,parts))>2200:break
                        if len(parts)>1:
                            excerpt=api['compact'](' '.join(parts));ev['excerpt']=excerpt;ev['isFullPolicySection']=True;repaired+=1
                if excerpt==original_header:continue
            revised.append(excerpt)
        r[field]=list(dict.fromkeys(revised))
    r['spendExclusionsStatus']='confirmed_no_requirement' if r['spendExclusionsStatus']=='confirmed_no_requirement' else 'source_excerpt' if r['spendExclusions'] else 'not_confirmed'
    r['benefitExclusionsStatus']='source_excerpt' if r['benefitExclusions'] else 'not_confirmed'
path.write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'repairedWrappedHeadings':repaired,'spend':sum(bool(r['spendExclusions']) for r in rows),'benefit':sum(bool(r['benefitExclusions']) for r in rows)}))
