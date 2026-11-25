const names:Record<string,string>={삼성:'삼성카드',국민:'KB국민카드',신한:'신한카드',우리:'우리카드',하나:'하나카드',현대:'현대카드',롯데:'롯데카드',농협:'NH농협카드',BC:'BC카드',새마을:'MG새마을금고',기타:'기타 카드사'};
export function issuerIdentity(issuer:string){
 const raw=issuer.trim();const key=raw.replace(/\s/g,'').replace(/카드$/,'');
 const aliases:Record<string,string>={'KB국민':'국민',KB:'국민','NH농협':'농협',NH:'농협',비씨:'BC'};
 const brand=aliases[key]??key;
 return {key:brand,name:names[brand]??raw};
}
