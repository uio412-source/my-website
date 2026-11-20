import { readCard } from "@/lib/catalog-db";
export async function GET(_request:Request,context:{params:Promise<{id:string}>}) {
  const {id}=await context.params;
  if(id.length>160)return Response.json({error:"올바른 상품이 아닙니다."},{status:400});
  try{const card=await readCard(id);return card?Response.json(card,{headers:{"Cache-Control":"private, max-age=300"}}):Response.json({error:"상품을 찾지 못했습니다."},{status:404});}
  catch(error){console.error("Paymorevent card detail failed",error);return Response.json({error:"상세 조건을 불러오지 못했습니다."},{status:503});}
}
