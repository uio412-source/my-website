"use client";

import { useState } from "react";
import { assetPath } from "@/lib/site-path";
import { CreditCard } from "lucide-react";
import images from "@/data/card-images.json";
import { networkBrands } from "@/lib/card-presentation";
import type { Card } from "@/lib/catalog-types";

export function CardArtwork({card,large=false}:{card:Pick<Card,"id"|"name"|"imageUrl">;large?:boolean}) {
  const [failed,setFailed]=useState(false);
  const cached=images as Record<string,string|null>;
  const source=Object.hasOwn(cached,card.id)?cached[card.id]:card.imageUrl;
  return <div className={large?"card-artwork card-artwork-large":"product-image"}>
    {source&&!failed?<img src={assetPath(source)} alt={`${card.name} 카드 이미지`} loading={large?"eager":"lazy"} decoding="async" onError={()=>setFailed(true)}/>:<div className="artwork-unavailable"><CreditCard size={large?52:38} strokeWidth={1.25} aria-hidden="true"/></div>}
  </div>;
}

function BrandImage({image,label}:{image:string;label:string}) {
  const [failed,setFailed]=useState(false);
  return failed?<span className="brand-image-fallback">{label}</span>:<img src={assetPath(image)} alt={label} decoding="async" onError={()=>setFailed(true)}/>;
}

export function BrandLogos({brands,compact=false}:{brands:string[];compact?:boolean}) {
  return <div className={`network-brands ${compact?"network-brands-compact":""}`} aria-label="발급 가능 브랜드">
    {networkBrands(brands).map(brand=><span className={`network-brand network-${brand.key}`} key={brand.key} title={brand.label}>
      {brand.image?<BrandImage image={brand.image} label={brand.label}/>:<span className="brand-image-fallback">{brand.label}</span>}
      {!compact&&brand.image&&<span>{brand.label}</span>}
    </span>)}
    {!brands.length&&<span className="unknown-value">브랜드 미확인</span>}
  </div>;
}
