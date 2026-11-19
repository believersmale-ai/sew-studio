import { requireAccess } from "@/lib/role-access.guard";
export async function POST(req:Request,{params}:{params:Promise<{id:string}>}){
  const auth=await requireAccess("assets","edit");if("error" in auth)return auth.error;
  const {ctx}=auth,{id}=await params,b=await req.json().catch(()=>({}));
  const type=String(b.type??"");
  if(!["receive","issue","return","adjustment"].includes(type))return Response.json({error:"Invalid movement type."},{status:400});
  const qty=b.quantity;
  if(typeof qty!=="number"||!Number.isFinite(qty)||qty===0||Math.abs(qty)>100000000)
    return Response.json({error:"Enter a valid nonzero quantity."},{status:400});
  const delta=type==="issue"?-Math.abs(qty):type==="adjustment"?qty:Math.abs(qty);
  const orderId=typeof b.orderId==="string"&&b.orderId.trim()?b.orderId.trim():null;
  if(orderId && !["issue","return"].includes(type))return Response.json({error:"Only issues and returns can be linked to orders."},{status:400});
  if(orderId){
    const order=await ctx.db.from("orders").select("id").eq("id",orderId).eq("shop_id",ctx.shopId).maybeSingle();
    if(order.error)return Response.json({error:order.error.message},{status:500});
    if(!order.data)return Response.json({error:"Order not found in this studio."},{status:404});
  }
  const item=await ctx.db.from("inventory_items").select("unit_cost").eq("id",id).eq("shop_id",ctx.shopId).maybeSingle();
  if(item.error)return Response.json({error:item.error.message},{status:500});
  if(!item.data)return Response.json({error:"Stock item not found."},{status:404});
  const {error}=await ctx.db.from("inventory_movements").insert({
    shop_id:ctx.shopId,item_id:id,movement_type:type,quantity_delta:delta,order_id:orderId,
    unit_cost_at_movement:Number(item.data.unit_cost),note:String(b.note??"").trim().slice(0,500)||null,
  });
  return error?Response.json({error:error.message},{status:400}):Response.json({ok:true},{status:201});
}
