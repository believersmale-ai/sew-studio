import { getPool } from "@/lib/db/pool";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function POST(req:Request){
 const b=await req.json().catch(()=>({})),id=String(b.orderId??""),phone=String(b.phone??"").trim();
 if(!uuid.test(id)||phone.length<7||phone.length>30)return Response.json({error:"Valid order number and phone required"},{status:400});
 const {rows}=await getPool().query("select o.id,o.status,o.payment_status,o.payment_method,o.created_at,o.paid_at,o.dispatched_at,o.delivered_at,o.courier,o.tracking_number,o.quantity,o.total,p.title,v.size,v.color from public.rtw_orders o join public.rtw_products p on p.id=o.product_id join public.rtw_variants v on v.id=o.variant_id where o.id=$1 and o.customer_phone=$2",[id,phone]);
 if(!rows.length)return Response.json({error:"Order not found. Check your order number and phone."},{status:404});
 return Response.json(rows[0],{headers:{"Cache-Control":"no-store"}});
}
