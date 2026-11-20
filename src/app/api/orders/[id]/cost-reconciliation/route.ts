import { getTenant } from "@/lib/db/session";
import { validLines, sumLines, type CostLine } from "@/lib/order-cost-reconciliation";
type Ctx={params:Promise<{id:string}>};
async function ownerOrder(id:string){
 const ctx=await getTenant();
 if(!ctx)return {error:Response.json({error:"Unauthorized"},{status:401})};
 if(ctx.role!=="madam")return {error:Response.json({error:"Only the studio owner can reconcile costs."},{status:403})};
 const {data:order,error}=await ctx.db.from("orders").select("id,status,garment_design").eq("id",id).eq("shop_id",ctx.shopId).maybeSingle();
 if(error)return {error:Response.json({error:error.message},{status:500})};
 if(!order)return {error:Response.json({error:"Order not found"},{status:404})};
 return {ctx,order};
}
export async function GET(_req:Request,{params}:Ctx){
 const {id}=await params;const result=await ownerOrder(id);
 if("error" in result)return result.error;
 const {ctx,order}=result;
 const {data,error}=await ctx.db.from("order_cost_reconciliations").select("*").eq("order_id",id).eq("shop_id",ctx.shopId).maybeSingle();
 if(error)return Response.json({error:error.message},{status:500});
 if(!data)return Response.json({error:"This order has no saved cost snapshot. Reconcile it through the legacy order costing flow."},{status:404});
 const estimatedLines=data.estimated_lines as CostLine[],actualLines=data.actual_lines as CostLine[]|null;
 const estimatedCost=sumLines(estimatedLines),actualCost=actualLines?sumLines(actualLines):null,price=Number(data.quoted_price);
 return Response.json({orderId:id,status:order.status,quotedPrice:price,estimatedLines,actualLines,estimatedCost,actualCost,estimatedProfit:price-estimatedCost,actualProfit:actualCost===null?null:price-actualCost,reconciledAt:data.reconciled_at});
}
export async function PATCH(req:Request,{params}:Ctx){
 const {id}=await params;const result=await ownerOrder(id);
 if("error" in result)return result.error;
 const {ctx,order}=result;
 if(!["Completed","Collected/Delivered"].includes(order.status))return Response.json({error:"Complete or deliver the order before final cost reconciliation."},{status:409});
 const body=await req.json().catch(()=>({}));
 const lines=validLines(body.actualLines);
 if(!lines||!lines.length)return Response.json({error:"Provide valid actual cost lines."},{status:400});
 const {data:existing}=await ctx.db.from("order_cost_reconciliations").select("estimated_lines").eq("order_id",id).eq("shop_id",ctx.shopId).maybeSingle();
 if(!existing)return Response.json({error:"Original estimate not found."},{status:404});
 const estimateKeys=new Set((existing.estimated_lines as CostLine[]).map(x=>x.key));
 if((existing.estimated_lines as CostLine[]).some(x=>!lines.some(y=>y.key===x.key)))return Response.json({error:"Keep all original lines; change their amounts or add extra costs."},{status:400});
 if(lines.some(x=>!estimateKeys.has(x.key)&&!x.key.startsWith("extra_")))return Response.json({error:"Additional costs need an extra_ key."},{status:400});
 const {error}=await ctx.db.from("order_cost_reconciliations").update({actual_lines:lines,reconciled_at:new Date().toISOString()}).eq("order_id",id).eq("shop_id",ctx.shopId);
 if(error)return Response.json({error:error.message},{status:500});
 return GET(req,{params:Promise.resolve({id})});
}
