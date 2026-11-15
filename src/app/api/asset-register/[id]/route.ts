import { requireAccess } from "@/lib/role-access.guard";
import { assetColumns, serializeMaintenance, serializeRegisterAsset } from "@/lib/db/asset-register";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const auth = await requireAccess("asset-register", "view");
  if ("error" in auth) return auth.error;
  const { ctx } = auth;
  const { id } = await params;
  const { data: asset } = await ctx.db.from("assets").select("*").eq("id", id).eq("shop_id", ctx.shopId).maybeSingle();
  if (!asset) return Response.json({ error: "Asset not found." }, { status: 404 });
  const { data: logs } = await ctx.db.from("asset_maintenance").select("*").eq("asset_id", id).eq("shop_id", ctx.shopId).order("serviced_on", { ascending: false });
  return Response.json({ ...serializeRegisterAsset(asset), maintenance: ((logs ?? []) as Record<string, any>[]).map(serializeMaintenance) });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const auth = await requireAccess("asset-register", "edit");
  if ("error" in auth) return auth.error;
  const { ctx } = auth;
  const { id } = await params;
  const parsed = await assetColumns(ctx, await req.json().catch(() => ({})), true);
  if ("error" in parsed) return Response.json({ error: parsed.error }, { status: 400 });
  if (!Object.keys(parsed.values).length) return Response.json({ error: "Nothing to update." }, { status: 400 });
  const { data, error } = await ctx.db.from("assets").update(parsed.values).eq("id", id).eq("shop_id", ctx.shopId).select("*").maybeSingle();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!data) return Response.json({ error: "Asset not found." }, { status: 404 });
  return Response.json(serializeRegisterAsset(data));
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const auth = await requireAccess("asset-register", "edit");
  if ("error" in auth) return auth.error;
  const { ctx } = auth;
  const { id } = await params;
  const { error } = await ctx.db.from("assets").delete().eq("id", id).eq("shop_id", ctx.shopId);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
