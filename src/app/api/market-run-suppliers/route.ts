import { getTenant } from "@/lib/db/session";
import { requireWriter, text } from "@/lib/db/studio-modules";

export async function GET() {
  const ctx = await getTenant();
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { data, error } = await ctx.db.from("market_run_suppliers").select("id,name,phone,location,notes").eq("shop_id",ctx.shopId).order("name");
  if (error) return Response.json({error:error.message},{status:500});
  return Response.json(data ?? []);
}
export async function POST(req: Request) {
  const auth = await requireWriter();
  if ("error" in auth) return auth.error;
  const {ctx} = auth;
  const body = await req.json().catch(()=>({}));
  const name = text(body.name,150);
  if (!name) return Response.json({error:"Supplier name is required."},{status:400});
  const {data,error} = await ctx.db.from("market_run_suppliers").insert({shop_id:ctx.shopId,name,phone:text(body.phone,80)||null,location:text(body.location,200)||null,notes:text(body.notes,1000)||null}).select("id,name,phone,location,notes").single();
  if (error) return Response.json({error:error.code==="23505"?"Supplier already exists.":error.message},{status:error.code==="23505"?409:500});
  return Response.json(data,{status:201});
}
