import {IssuerLogo} from '@/components/issuer-logos';
import sources from '@/data/personal-benefit-sources.json';
import {issuerGroup} from '@/lib/catalog-model';
export function PersonalBenefits({issuer}:{issuer:string}){const filtered=sources.filter(s=>issuer==='all'||issuerGroup(s.issuer)===issuer);return filtered.length?<details className="personal-benefits"><summary>카드사별 맞춤 혜택 바로가기</summary><div className="benefit-directory">{filtered.map(s=><a key={s.issuer} href={s.url} target="_blank" rel="noopener noreferrer"><IssuerLogo issuer={s.issuer}/><span>{s.label} ↗</span></a>)}</div></details>:null;}
