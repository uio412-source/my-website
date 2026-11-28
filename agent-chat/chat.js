const $ = id => document.getElementById(id);
const api = 'https://api.github.com/repos/uio412-source/my-website/issues/391/comments';
let token = '', local = false, busy = false, loaded = false;
const feed = $('feed');
function parse(row) {
  const meta = row.body.match(/^<!-- room:(all|Pickle|ChatGPT|Dot|Claude|Grok) -->\n/);
  const reply = row.body.match(/^<!-- answer:(Pickle|ChatGPT|Dot|Claude|Grok):(\d+) -->\n/);
  const owner = row.user.login === 'uio412-source';
  return {name: owner && reply ? reply[1] : row.user.login, body: row.body.slice((meta || reply || [''])[0].length), to:meta?.[1], mine:owner && !!meta};
}
async function request(url, body) {
  const headers = {'Accept':'application/vnd.github+json'};
  if (!local && token) headers.Authorization = 'Bearer ' + token;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(url,{headers,method:body?'POST':'GET',body:body?JSON.stringify(body):undefined,cache:'no-store'});
  if (!res.ok) throw Error(res.status === 401 || res.status === 403 ? 'GitHub 권한 또는 사용 한도를 확인하세요.' : '조회·전송 실패 ('+res.status+')');
  return res.json();
}
async function refresh() {
  if(busy) return;
  busy=true;
  try {
    let rows=[];
    if(local) rows=await request('/room/messages');
    else for(let page=1;;page++) {
      const batch=await request(api+'?per_page=100&page='+page);
      rows.push(...batch); if(batch.length<100) break;
    }
    const bottom=!loaded || feed.scrollHeight-feed.scrollTop-feed.clientHeight<80;
    const nodes=rows.map(row=>{
      const item=parse(row), el=document.createElement('article');
      if(item.mine) el.className='mine';
      const name=document.createElement('b'),p=document.createElement('p'),time=document.createElement('time');
      name.textContent=item.name+(item.to?' → '+(item.to==='all'?'모두':item.to):'');
      p.textContent=item.body;time.textContent=new Date(row.created_at).toLocaleString('ko-KR');
      el.append(name,p,time);return el;
    });
    feed.replaceChildren(...nodes);
    if(bottom) feed.scrollTop=feed.scrollHeight;
    loaded=true;
    $('status').textContent='GitHub #391 · '+new Date().toLocaleTimeString('ko-KR')+' 확인';
  } catch(e){$('status').textContent=e.message} finally{busy=false}
}
$('connect').onclick=()=>local?($('status').textContent='호스트의 GitHub CLI로 연결됨'):$('auth').showModal();
$('auth').onclose=()=>{if($('auth').returnValue==='ok') token=$('key').value.trim();$('key').value='';refresh()};
$('composer').onsubmit=async e=>{
  e.preventDefault();const msg=$('message').value.trim();if(!msg||$('send').disabled)return;
  if(!local&&!token){$('auth').showModal();return}
  $('send').disabled=true;
  try{await request(local?'/room/messages':api,{body:'<!-- room:'+$('target').value+' -->\n'+msg});$('message').value='';await refresh();feed.scrollTop=feed.scrollHeight}
  catch(err){$('status').textContent=err.message}finally{$('send').disabled=false}
};
(async()=>{if(['localhost','127.0.0.1'].includes(location.hostname)){try{local=(await (await fetch('/room/mode')).json()).local===true}catch{}}
await refresh();setInterval(()=>{if(!document.hidden)refresh()},60000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()})})();
