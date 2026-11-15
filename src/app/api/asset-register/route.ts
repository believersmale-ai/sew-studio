import { requireAccess } from "@/lib/role-access.guard";
import { assetColumns, serializeRegisterAsset } from "@/lib/db/asset-register";

export async function GET() {
  const auth = await requireAccess("asset-register", "view");
  if ("error" in auth) return auth.error;
  const { ctx } = auth;
  const [assets, staff, logs] = await Promise.all([
    ctx.db.from("assets").select("*").eq("shop_id", ctx.shopId).order("name"),
    ctx.db.from("profiles").select("id, full_name, is_active").eq("shop_id", ctx.shopId).order("full_name"),
    ctx.db.from("asset_maintenance").select("asset_id, cost").eq("shop_id", ctx.shopId),
  ]);
  if (assets.error) return Response.json({ error: assets.error.message }, { status: 500 });
  const names = new Map<string, string>();
  for (const s of (staff.data ?? []) as Record<string, any>[]) names.set(s.id, s.full_name);
  const totals = new Map<string, { count: number; cost: number }>();
  for (const l of (logs.data ?? []) as Record<string, any>[]) {
    const t = totals.get(l.asset_id) ?? { count: 0, cost: 0 };
    t.count += 1; t.cost += Number(l.cost) || 0; totals.set(l.asset_id, t);
  }
  return Response.json({
    assets: ((assets.data ?? []) as Record<string, any>[]).map((a) => ({
      ...serializeRegisterAsset(a),
      assignedName: a.assigned_to ? names.get(a.assigned_to) ?? "" : "",
      maintenanceCount: totals.get(a.id)?.count ?? 0,
      maintenanceCost: totals.get(a.id)?.cost ?? 0,
    })),
    staff: ((staff.data ?? []) as Record<string, any>[]).filter((s) => s.is_active !== false).map((s) => ({ id: s.id as string, name: s.full_name as string })),
  });
}

export async function POST(req: Request) {
  const auth = await requireAccess("asset-register", "edit");
  if ("error" in auth) return auth.error;
  const { ctx } = auth;
  const parsed = await assetColumns(ctx, await req.json().catch(() => ({})), false);
  if ("error" in parsed) return Response.json({ error: parsed.error }, { status: 400 });
  const { data, error } = await ctx.db.from("assets").insert({ shop_id: ctx.shopId, ...parsed.values }).select("*").single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(serializeRegisterAsset(data), { status: 201 });
}
