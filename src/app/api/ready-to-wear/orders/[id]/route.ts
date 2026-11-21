import { getTenant } from "@/lib/db/session";
import { getPool } from "@/lib/db/pool";
type Ctx={params:Promise<{id:string}>};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const transitions:Record<string,string[]>={Paid:["Processing"],Processing:["Dispatched"],Dispatched:["Delivered"],Delivered:[],Cancelled:[]};
export async function PATCH(req:Request,{params}:Ctx){
 const ctx=await getTenant();if(!ctx)return Response.json({error:"Unauthorized"},{status:401});
 if(ctx.role!=="madam")return Response.json({error:"Only the owner can update deliveries"},{status:403});
 const {id}=await params,b=await req.json().catch(()=>({})),next=String(b.status??"");
 if(!uuid.test(id)||!["Processing","Dispatched","Delivered"].includes(next))return Response.json({error:"Invalid delivery update"},{status:400});
 const courier=String(b.courier??"").trim(),tracking=String(b.trackingNumber??"").trim();
 if(courier.length>150||tracking.length>150||(next==="Dispatched"&&(!courier||!tracking)))return Response.json({error:"Courier and tracking number are required for dispatch"},{status:400});
 const client=await getPool().connect();
 try{
  await client.query("BEGIN");
  const {rows}=await client.query("select status,payment_status from public.rtw_orders where id=$1 and shop_id=$2 for update",[id,ctx.shopId]);
  if(!rows.length){await client.query("ROLLBACK");return Response.json({error:"Order not found"},{status:404})}
  if(rows[0].payment_status!=="Paid"||!transitions[rows[0].status]?.includes(next)){await client.query("ROLLBACK");return Response.json({error:"Invalid status transition or payment not verified"},{status:409})}
  await client.query("update public.rtw_orders set status=$3,courier=case when $3='Dispatched' then $4 else courier end,tracking_number=case when $3='Dispatched' then $5 else tracking_number end,dispatched_at=case when $3='Dispatched' then now() else dispatched_at end,delivered_at=case when $3='Delivered' then now() else delivered_at end,updated_at=now() where id=$1 and shop_id=$2",[id,ctx.shopId,next,courier,tracking]);
  await client.query("COMMIT");return Response.json({id,status:next});
 }catch{await client.query("ROLLBACK");return Response.json({error:"Unable to update delivery"},{status:500})}finally{client.release()}
}
