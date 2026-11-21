import { getPool } from "@/lib/db/pool";
type Ctx={params:Promise<{shopId:string}>};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function GET(_req:Request,{params}:Ctx){
 const {shopId}=await params;if(!uuid.test(shopId))return Response.json({error:"Invalid shop"},{status:400});
 const {rows}=await getPool().query("select p.id,p.title,p.description,p.category,p.price,p.image_url,coalesce(json_agg(json_build_object('id',v.id,'size',v.size,'color',v.color,'stock',v.stock)) filter(where v.id is not null),'[]') as variants from public.rtw_products p left join public.rtw_variants v on v.product_id=p.id where p.shop_id=$1 and p.published=true group by p.id order by p.created_at desc",[shopId]);
 return Response.json(rows,{headers:{"Cache-Control":"no-store"}});
}
export async function POST(req:Request,{params}:Ctx){
 const {shopId}=await params;if(!uuid.test(shopId))return Response.json({error:"Invalid shop"},{status:400});
 const b=await req.json().catch(()=>({}));
 const quantity=Number(b.quantity),productId=String(b.productId??""),variantId=String(b.variantId??"");
 const name=String(b.name??"").trim(),phone=String(b.phone??"").trim(),email=String(b.email??"").trim(),address=String(b.address??"").trim(),city=String(b.city??"").trim(),notes=String(b.notes??"").trim();
 if(!uuid.test(productId)||!uuid.test(variantId)||!Number.isInteger(quantity)||quantity<1||quantity>20||name.length<2||name.length>150||phone.length<7||phone.length>30||address.length<8||address.length>500||!city||city.length>120||email.length>200||notes.length>1000)return Response.json({error:"Please provide valid order and delivery details"},{status:400});
 const client=await getPool().connect();
 try{
  await client.query("BEGIN");
  const {rows}=await client.query("select v.id,v.stock,p.price from public.rtw_variants v join public.rtw_products p on p.id=v.product_id where p.shop_id=$1 and p.published=true and p.id=$2 and v.id=$3 for update of v",[shopId,productId,variantId]);
  if(!rows.length||rows[0].stock<quantity){await client.query("ROLLBACK");return Response.json({error:"This size or colour is out of stock"},{status:409})}
  const total=(Number(rows[0].price)*quantity).toFixed(2);
  await client.query("update public.rtw_variants set stock=stock-$2 where id=$1",[variantId,quantity]);
  const order=await client.query("insert into public.rtw_orders(shop_id,product_id,variant_id,quantity,unit_price,total,customer_name,customer_phone,customer_email,delivery_address,delivery_city,delivery_notes) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) returning id,status,payment_status",[shopId,productId,variantId,quantity,rows[0].price,total,name,phone,email||null,address,city,notes||null]);
  await client.query("COMMIT");
  return Response.json({orderId:order.rows[0].id,status:"Pending payment",paymentStatus:"Unpaid",total,message:"Order received. Payment instructions will be provided by the seller; do not send money until confirmed."},{status:201});
 }catch{return Response.json({error:"Unable to place order"},{status:500})}finally{try{await client.query("ROLLBACK")}catch{}client.release()}
}
