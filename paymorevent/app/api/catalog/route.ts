import { readCatalog } from "@/lib/catalog-db";
export async function GET(){
  try {return Response.json(await readCatalog(),{headers:{"Cache-Control":"no-store"}});}
  catch(error){console.error("Paymorevent catalog read failed",error);return Response.json({error:"상품 DB를 불러오지 못했습니다. 잠시 후 다시 시도하세요."},{status:503});}
}
