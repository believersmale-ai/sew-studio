import { requireAccess } from "@/lib/role-access.guard";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; logId: string }> }) {
  const auth = await requireAccess("asset-register", "edit");
  if ("error" in auth) return auth.error;
  const { ctx } = auth;
  const { id, logId } = await params;
  const { error } = await ctx.db.from("asset_maintenance").delete().eq("id", logId).eq("asset_id", id).eq("shop_id", ctx.shopId);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
