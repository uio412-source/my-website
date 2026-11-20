import json,pathlib,urllib.request,concurrent.futures
root=pathlib.Path(__file__).resolve().parents[1]
assets={
 '삼성':('samsung','https://www.samsungcard.com/_nuxt/img/foot_logo.7fb3fed.png'),
 '국민':('kb','https://card.kbcard.com/CMN/images/kb-kookmin-card-official-logo.png'),
 '신한':('shinhan','https://www.shinhancard.com/pconts/images/dx/landing/bestcard_sh_logo_bi_2.png'),
 '우리':('woori','https://pc.wooricard.com/dcpc/img/pc/common/h1_logo.png'),
 '하나':('hana','https://m.hanacard.co.kr/images/common/footer-logo.svg'),
 '현대':('hyundai','https://www.hyundaicard.com/docfiles/resources/pc/images/common/logo/logo_hyundaicard_scr.svg'),
 '롯데':('lotte','https://image.lottecard.co.kr/webapp/pc/images/common/logo_default.png'),
 '농협':('nh','https://card.nonghyup.com/images/IP/cc/layout/n_logo.png'),
 'BC':('bc','https://www.bccard.com/images/individual/2016/common/gnb/h1_logo.gif'),
}
(root/'public/issuers').mkdir(exist_ok=True)
def download(item):
 issuer,(key,url)=item
 try:
  r=urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'}),timeout=20);b=r.read()
  if not r.headers.get('content-type','').startswith('image/'):raise ValueError('Not an image')
  filename=key+'.'+url.rsplit('.',1)[1];(root/'public/issuers'/filename).write_bytes(b)
  return issuer,{'image':'/issuers/'+filename,'sourceUrl':url,'checkedAt':'2026-10-06'}
 except Exception as e:print(issuer,str(e));return issuer,None
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as executor:result=dict(executor.map(download,assets.items()))
(root/'data/issuer-logos.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
print('Downloaded',sum(bool(x) for x in result.values()),'logos')
