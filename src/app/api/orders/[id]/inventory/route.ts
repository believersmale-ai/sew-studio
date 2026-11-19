import { getTenant } from "@/lib/db/session";
export async function GET(_req:Request,{params}:{params:Promise<{id:string}>}){
  const ctx=await getTenant();if(!ctx)return Response.json({error:"Unauthorized"},{status:401});
  const {id}=await params;
  const canSeeAll=ctx.role==="madam"||ctx.role==="trainer";
  let query=ctx.db.from("orders").select("id").eq("id",id).eq("shop_id",ctx.shopId);
  if(!canSeeAll)query=query.or(`assigned_staff_id.eq.${ctx.userId},assigned_staff_id.is.null`);
  const order=await query.maybeSingle();
  if(order.error)return Response.json({error:order.error.message},{status:500});
  if(!order.data)return Response.json({error:"Order not found"},{status:404});
  const movements=await ctx.db.from("inventory_movements").select("*").eq("shop_id",ctx.shopId).eq("order_id",id).order("created_at",{ascending:false});
  if(movements.error)return Response.json({error:movements.error.message},{status:500});
  const lines=movements.data??[];
  const ids=[...new Set(lines.map(x=>x.item_id))];
  const items=ids.length?await ctx.db.from("inventory_items").select("id,name,unit").eq("shop_id",ctx.shopId).in("id",ids):null;
  if(items?.error)return Response.json({error:items.error.message},{status:500});
  const names=new Map((items?.data??[]).map(x=>[x.id,x]));
  const records=lines.map(x=>({
    id:x.id,itemId:x.item_id,name:names.get(x.item_id)?.name??"Stock item",
    unit:names.get(x.item_id)?.unit??"",type:x.movement_type,quantityDelta:Number(x.quantity_delta),
    unitCost:Number(x.unit_cost_at_movement??0),costImpact:-Number(x.quantity_delta)*Number(x.unit_cost_at_movement??0),
    note:x.note,createdAt:x.created_at,
  }));
  return Response.json({lines:records,totalMaterialCost:records.reduce((n,x)=>n+x.costImpact,0)});
}
