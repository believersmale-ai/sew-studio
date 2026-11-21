import { getTenant } from "@/lib/db/session";
import { getPool } from "@/lib/db/pool";
export async function GET(){
 const ctx=await getTenant();if(!ctx)return Response.json({error:"Unauthorized"},{status:401});
 if(ctx.role!=="madam")return Response.json({error:"Only the owner can view shop orders"},{status:403});
 const {rows}=await getPool().query("select o.id,o.quantity,o.total,o.customer_name,o.customer_phone,o.customer_email,o.delivery_address,o.delivery_city,o.status,o.payment_status,o.payment_method,o.manual_payment_channel,o.manual_payment_reference,o.manual_payment_submitted_at,o.created_at,p.title,v.size,v.color from public.rtw_orders o join public.rtw_products p on p.id=o.product_id join public.rtw_variants v on v.id=o.variant_id where o.shop_id=$1 order by o.created_at desc limit 200",[ctx.shopId]);
 return Response.json(rows);
}
