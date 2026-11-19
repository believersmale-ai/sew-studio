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
  const {error}=await ctx.db.from("inventory_movements").insert({
    shop_id:ctx.shopId,item_id:id,movement_type:type,quantity_delta:delta,note:String(b.note??"").trim().slice(0,500)||null,
  });
  return error?Response.json({error:error.message},{status:400}):Response.json({ok:true},{status:201});
}
