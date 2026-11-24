import { getTenant } from "@/lib/db/session";
import { getPool } from "@/lib/db/pool";
import { cleanImageRef } from "@/lib/image-ref";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function GET() {
 const ctx=await getTenant(); if(!ctx)return Response.json({error:"Unauthorized"},{status:401});
 const {rows}=await getPool().query("select p.*,coalesce(json_agg(json_build_object('id',v.id,'size',v.size,'color',v.color,'stock',v.stock)) filter(where v.id is not null),'[]') as variants from public.rtw_products p left join public.rtw_variants v on v.product_id=p.id where p.shop_id=$1 group by p.id order by p.created_at desc",[ctx.shopId]);
 return Response.json(rows);
}
export async function POST(req:Request) {
 const ctx=await getTenant();if(!ctx)return Response.json({error:"Unauthorized"},{status:401});
 if(ctx.role!=="madam")return Response.json({error:"Only the owner can manage products"},{status:403});
 const b=await req.json().catch(()=>null);
 if(!b||typeof b!=="object"||Array.isArray(b))return Response.json({error:"Invalid product request"},{status:400});
 const title=String(b.title??"").trim(),description=String(b.description??"").trim(),category=String(b.category??"Dresses").trim();
 const price=Number(b.price),image=b.imageUrl?cleanImageRef(String(b.imageUrl)):null;
 if(!title||title.length>180||description.length>4000||category.length>80||!Number.isFinite(price)||price<=0||price>1000000||image===undefined)return Response.json({error:"Invalid product details"},{status:400});
 const variants=Array.isArray(b.variants)?b.variants:[];
 if(!variants.length||variants.length>50||variants.some((v:any)=>!v||!String(v.size??"").trim()||!String(v.color??"").trim()||!Number.isInteger(v.stock)||v.stock<0||v.stock>100000))return Response.json({error:"Add valid sizes, colours and stock"},{status:400});
 const pool=getPool(),client=await pool.connect();
 try {
  await client.query("BEGIN");
  const {rows}=await client.query("insert into public.rtw_products(shop_id,title,description,category,price,image_url,published) values($1,$2,$3,$4,$5,$6,$7) returning id",[ctx.shopId,title,description,category,price,image??null,b.published===true]);
  for(const v of variants)await client.query("insert into public.rtw_variants(product_id,size,color,stock) values($1,$2,$3,$4)",[rows[0].id,String(v.size).trim(),String(v.color).trim(),v.stock]);
  await client.query("COMMIT");return Response.json({id:rows[0].id},{status:201});
 }catch{return Response.json({error:"Unable to save product; check duplicate sizes and colours"},{status:500})}finally{try{await client.query("ROLLBACK")}catch{}client.release()}
}

export async function PATCH(req:Request){
 const ctx=await getTenant();if(!ctx)return Response.json({error:"Unauthorized"},{status:401});
 if(ctx.role!=="madam")return Response.json({error:"Only the owner can manage products"},{status:403});
 const b=await req.json().catch(()=>null);
 if(!b||typeof b.id!=="string"||!uuid.test(b.id)||typeof b.published!=="boolean")return Response.json({error:"Invalid publication request"},{status:400});
 try{const r=await getPool().query("update public.rtw_products set published=$3 where id=$1 and shop_id=$2 returning id",[b.id,ctx.shopId,b.published]);if(!r.rowCount)return Response.json({error:"Product not found"},{status:404});return Response.json({id:b.id,published:b.published});}catch{return Response.json({error:"Unable to update product publication"},{status:500});}
}
