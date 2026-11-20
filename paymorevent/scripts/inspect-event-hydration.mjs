import fs from 'node:fs';import vm from 'node:vm';
const h=fs.readFileSync('work/event-sources/samsung-events.html','utf8');
const s=h.match(/<script>\s*window\.__NUXT__\s*=([\s\S]*?)<\/script>/)?.[1];
if(s){const v=vm.runInNewContext(s,{}, {timeout:1000});fs.writeFileSync('work/event-sources/samsung-hydration.json',JSON.stringify(v,null,2));console.log(Object.keys(v));console.log(JSON.stringify(v).slice(0,2000));}
for(const n of ['hana-random','hana-ai','hana-shinsegae']){let t=fs.readFileSync('work/event-sources/'+n+'.txt','utf8');console.log(n,t.slice(1000,2800));}
