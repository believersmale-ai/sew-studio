import { getTenant } from "@/lib/db/session";
import { getPool } from "@/lib/db/pool";
import { cleanImageRef } from "@/lib/image-ref";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function validVariant(v:any){return v && typeof v.size==="string" && v.size.trim().length>0 && v.size.trim().length<=80 && typeof v.color==="string" && v.color.trim().length>0 && v.color.trim().length<=80 && Number.isInteger(v.stock) && v.stock>=0 && v.stock<=100000;}
function variantKey(v:{size:string;color:string}){return JSON.stringify([v.size.trim().toLowerCase(),v.color.trim().toLowerCase()]);}
export async function GET() {
 const ctx=await getTenant(); if(!ctx)return Response.json({error:"Unauthorized"},{status:401});
 if(ctx.role!=="madam")return Response.json({error:"Only the owner can manage products"},{status:403});
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
 if(!variants.length||variants.length>50||variants.some(v=>!validVariant(v)))return Response.json({error:"Add valid sizes, colours and stock"},{status:400});
 if(new Set(variants.map(variantKey)).size!==variants.length)return Response.json({error:"Duplicate size and colour combinations are not allowed"},{status:400});
 const pool=getPool(),client=await pool.connect();
 try {
  await client.query("BEGIN");
  const {rows}=await client.query("insert into public.rtw_products(shop_id,title,description,category,price,image_url,published) values($1,$2,$3,$4,$5,$6,$7) returning id",[ctx.shopId,title,description,category,price,image??null,b.published===true]);
  for(const v of variants)await client.query("insert into public.rtw_variants(product_id,size,color,stock) values($1,$2,$3,$4)",[rows[0].id,String(v.size).trim(),String(v.color).trim(),v.stock]);
  await client.query("COMMIT");return Response.json({id:rows[0].id},{status:201});
 }catch(err){console.error("Ready-to-wear product creation failed", {shopId:ctx.shopId,code:(err as {code?:string})?.code});return Response.json({error:"Unable to save product; check duplicate sizes and colours"},{status:500})}finally{try{await client.query("ROLLBACK")}catch{}client.release()}
}

export async function PATCH(req:Request){
 const ctx=await getTenant();if(!ctx)return Response.json({error:"Unauthorized"},{status:401});
 if(ctx.role!=="madam")return Response.json({error:"Only the owner can manage products"},{status:403});
 const b=await req.json().catch(()=>null);
 if(b?.action==="add_variant"){
 if(typeof b.id!=="string"||!uuid.test(b.id)||!validVariant(b.variant))return Response.json({error:"Enter a valid size, colour and stock quantity"},{status:400});
 const client=await getPool().connect();
 try{
 await client.query("BEGIN");
 const product=await client.query("select id from public.rtw_products where id=$1 and shop_id=$2 for update",[b.id,ctx.shopId]);
 if(!product.rowCount)return Response.json({error:"Product not found"},{status:404});
 const existing=await client.query("select size,color from public.rtw_variants where product_id=$1",[b.id]);
 if(existing.rows.length>=50)return Response.json({error:"Maximum 50 variants per product"},{status:409});
 if(existing.rows.some(v=>variantKey(v)===variantKey(b.variant)))return Response.json({error:"This size and colour already exists. Adjust its stock instead."},{status:409});
 const result=await client.query("insert into public.rtw_variants(product_id,size,color,stock) values($1,$2,$3,$4) returning id",[b.id,b.variant.size.trim(),b.variant.color.trim(),b.variant.stock]);
 await client.query("COMMIT");return Response.json({id:result.rows[0].id},{status:201});
 }catch{return Response.json({error:"Unable to add variant"},{status:500});}finally{try{await client.query("ROLLBACK")}catch{}client.release()}
 }
 if(b?.action==="edit"){ const title=typeof b.title==="string"?b.title.trim():"",category=typeof b.category==="string"?b.category.trim():"",description=typeof b.description==="string"?b.description.trim():"",price=Number(b.price); const image=b.imageUrl?cleanImageRef(String(b.imageUrl)):null;
 if(typeof b.id!=="string"||!uuid.test(b.id)||!title||title.length>180||!category||category.length>80||description.length>4000||!Number.isFinite(price)||price<=0||price>1000000||image===undefined)return Response.json({error:"Invalid product details"},{status:400});
 try{const r=await getPool().query("update public.rtw_products set title=$3,category=$4,description=$5,price=$6,image_url=$7 where id=$1 and shop_id=$2 returning id",[b.id,ctx.shopId,title,category,description,price,image]);return r.rowCount?Response.json({id:b.id}):Response.json({error:"Product not found"},{status:404});}catch{return Response.json({error:"Unable to edit product"},{status:500});}}
 if(b?.action==="adjust_stock"){if(typeof b.id!=="string"||!uuid.test(b.id)||typeof b.variantId!=="string"||!uuid.test(b.variantId)||!Number.isInteger(b.delta)||b.delta===0||Math.abs(b.delta)>100000)return Response.json({error:"Invalid stock adjustment"},{status:400});try{const r=await getPool().query("update public.rtw_variants v set stock=v.stock+$4 from public.rtw_products p where v.id=$1 and p.id=$2 and p.shop_id=$3 and v.product_id=p.id and v.stock+$4 between 0 and 100000 returning v.stock",[b.variantId,b.id,ctx.shopId,b.delta]);return r.rowCount?Response.json({stock:r.rows[0].stock}):Response.json({error:"Stock adjustment unavailable or exceeds stock limits"},{status:409});}catch{return Response.json({error:"Unable to adjust stock"},{status:500});}}
 if(!b||typeof b.id!=="string"||!uuid.test(b.id)||typeof b.published!=="boolean")return Response.json({error:"Invalid publication request"},{status:400});
 try{const r=await getPool().query("update public.rtw_products set published=$3 where id=$1 and shop_id=$2 returning id",[b.id,ctx.shopId,b.published]);if(!r.rowCount)return Response.json({error:"Product not found"},{status:404});return Response.json({id:b.id,published:b.published});}catch{return Response.json({error:"Unable to update product publication"},{status:500});}
}
