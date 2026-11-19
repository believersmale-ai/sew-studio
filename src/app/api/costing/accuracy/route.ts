import {getTenant} from "@/lib/db/session";
import {sumLines,type CostLine} from "@/lib/order-cost-reconciliation";
export async function GET(){
 const ctx=await getTenant();
 if(!ctx)return Response.json({error:"Unauthorized"},{status:401});
 if(ctx.role!=="madam")return Response.json({error:"Owner access required"},{status:403});
 const {data:orders,error:ordersError}=await ctx.db.from("orders").select("id,garment_design,status,order_date").eq("shop_id",ctx.shopId).in("status",["Completed","Collected/Delivered"]);
 if(ordersError)return Response.json({error:ordersError.message},{status:500});
 const {data:costs,error}=await ctx.db.from("order_cost_reconciliations").select("*").eq("shop_id",ctx.shopId).not("reconciled_at","is",null);
 if(error)return Response.json({error:error.message},{status:500});
 const map=new Map((orders??[]).map(x=>[x.id,x]));
 const rows=(costs??[]).flatMap(c=>{
  const order=map.get(c.order_id);if(!order||!c.actual_lines)return [];
  const estimated=sumLines(c.estimated_lines as CostLine[]),actual=sumLines(c.actual_lines as CostLine[]),price=Number(c.quoted_price);
  return [{orderId:order.id,garment:order.garment_design,date:order.order_date,reconciledAt:c.reconciled_at,quotedPrice:price,estimatedCost:estimated,actualCost:actual,estimatedProfit:price-estimated,actualProfit:price-actual,accuracy:estimated===0?(actual===0):Math.abs(actual-estimated)/estimated<=0.1}];
 }).sort((a,b)=>b.date.localeCompare(a.date));
 const accurate=rows.filter(x=>x.accuracy).length;
 const monthly=new Map<string,{month:string;total:number;accurate:number;estimatedCost:number;actualCost:number;profit:number}>();
 for(const row of rows){
   const month=String(row.reconciledAt).slice(0,7);
   const value=monthly.get(month)??{month,total:0,accurate:0,estimatedCost:0,actualCost:0,profit:0};
   value.total++;if(row.accuracy)value.accurate++;
   value.estimatedCost+=row.estimatedCost;value.actualCost+=row.actualCost;value.profit+=row.actualProfit;
   monthly.set(month,value);
 }
 const trend=[...monthly.values()].sort((a,b)=>a.month.localeCompare(b.month)).map(x=>({...x,accuracyPercent:Math.round(x.accurate/x.total*1000)/10}));
 return Response.json({rows,trend,total:rows.length,accurate,accuracyPercent:rows.length?Math.round(accurate/rows.length*1000)/10:null});
}
