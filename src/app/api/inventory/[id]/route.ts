import { requireAccess } from "@/lib/role-access.guard";
export async function PATCH(req:Request,{params}:{params:Promise<{id:string}>}){
  const auth=await requireAccess("assets","edit");if("error" in auth)return auth.error;
  const {ctx}=auth,{id}=await params,b=await req.json().catch(()=>({}));
  const data:Record<string,string|number|null>={};
  for(const [key,column,max] of [["name","name",120],["sku","sku",60],["category","category",60],["unit","unit",20],["location","location",120],["supplier","supplier",120],["notes","notes",500]] as const){
    if(key in b)data[column]=String(b[key]??"").trim().slice(0,max)||null;
  }
  if("name" in data && !data.name)return Response.json({error:"Name is required."},{status:400});
  for(const [key,column,max] of [["reorderLevel","reorder_level",100000000],["unitCost","unit_cost",10000000]] as const){
    if(key in b){const v=b[key];if(typeof v!=="number"||!Number.isFinite(v)||v<0||v>max)return Response.json({error:"Invalid "+key},{status:400});data[column]=v;}
  }
  if(!Object.keys(data).length)return Response.json({error:"No fields supplied."},{status:400});
  const {error}=await ctx.db.from("inventory_items").update(data).eq("id",id).eq("shop_id",ctx.shopId);
  return error?Response.json({error:error.message},{status:400}):Response.json({ok:true});
}
