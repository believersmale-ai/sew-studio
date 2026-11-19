import { requireAccess } from "@/lib/role-access.guard";
const clean = (x: unknown, max = 120) => String(x ?? "").trim().slice(0,max);
const amount = (x: unknown) => typeof x === "number" && Number.isFinite(x) && x >= 0 ? x : null;
export async function GET() {
  const auth = await requireAccess("assets","view");
  if ("error" in auth) return auth.error;
  const { ctx } = auth;
  const [items,movements] = await Promise.all([
    ctx.db.from("inventory_items").select("*").eq("shop_id",ctx.shopId).order("name"),
    ctx.db.from("inventory_movements").select("*").eq("shop_id",ctx.shopId).order("created_at",{ascending:false}).limit(100),
  ]);
  if (items.error) return Response.json({error:items.error.message},{status:500});
  if (movements.error) return Response.json({error:movements.error.message},{status:500});
  return Response.json({items:items.data??[],movements:movements.data??[]});
}
export async function POST(req:Request) {
  const auth = await requireAccess("assets","edit");
  if ("error" in auth) return auth.error;
  const {ctx}=auth;
  const b=await req.json().catch(()=>({}));
  const name=clean(b.name),quantity=amount(b.openingQuantity),reorder=amount(b.reorderLevel),cost=amount(b.unitCost);
  if(!name||quantity===null||reorder===null||cost===null||quantity>100000000||reorder>100000000||cost>10000000)
    return Response.json({error:"Enter a name and valid nonnegative stock quantities and costs."},{status:400});
  const {data,error}=await ctx.db.from("inventory_items").insert({
    shop_id:ctx.shopId,name,sku:clean(b.sku,60)||null,category:clean(b.category,60)||"Other",
    unit:clean(b.unit,20)||"pcs",reorder_level:reorder,unit_cost:cost,
    location:clean(b.location)||null,supplier:clean(b.supplier)||null,notes:clean(b.notes,500)||null,
  }).select("*").single();
  if(error)return Response.json({error:error.message},{status:400});
  if(quantity>0){
    const movement=await ctx.db.from("inventory_movements").insert({
      shop_id:ctx.shopId,item_id:data.id,movement_type:"opening",quantity_delta:quantity,note:"Opening balance",
    });
    if(movement.error) return Response.json({error:"Item created but opening balance failed: "+movement.error.message},{status:500});
  }
  return Response.json({id:data.id},{status:201});
}
