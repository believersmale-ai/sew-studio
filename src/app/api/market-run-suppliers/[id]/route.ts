import { requireWriter, text } from "@/lib/db/studio-modules";
export async function PATCH(req: Request, {params}: {params:Promise<{id:string}>}) {
 const auth=await requireWriter(); if("error" in auth)return auth.error;
 const {ctx}=auth; const {id}=await params;
 const body=await req.json().catch(()=>({}));
 const patch:Record<string,string|null>={};
 if("name" in body){const name=text(body.name,150);if(!name)return Response.json({error:"Supplier name required."},{status:400});patch.name=name;}
 if("phone" in body)patch.phone=text(body.phone,80)||null;
 if("location" in body)patch.location=text(body.location,200)||null;
 if("notes" in body)patch.notes=text(body.notes,1000)||null;
 if(!Object.keys(patch).length)return Response.json({error:"Nothing to update."},{status:400});
 const {data,error}=await ctx.db.from("market_run_suppliers").update(patch).eq("id",id).eq("shop_id",ctx.shopId).select("id,name,phone,location,notes").maybeSingle();
 if(error)return Response.json({error:error.code==="23505"?"Supplier name already exists.":error.message},{status:error.code==="23505"?409:500});
 if(!data)return Response.json({error:"Supplier not found."},{status:404});
 return Response.json(data);
}
