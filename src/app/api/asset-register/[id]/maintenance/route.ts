import { ASSET_CONDITIONS, dateOrNull, money, text } from "@/lib/db/studio-modules";
import { requireAccess } from "@/lib/role-access.guard";
import { serializeMaintenance } from "@/lib/db/asset-register";

type Ctx = { params: Promise<{ id: string }> };

/** Logs a service or repair. Also brings the asset's last/next service dates (and optionally its condition) up to date. */
export async function POST(req: Request, { params }: Ctx) {
  const auth = await requireAccess("asset-register", "edit");
  if ("error" in auth) return auth.error;
  const { ctx } = auth;
  const { id } = await params;
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const { data: asset } = await ctx.db.from("assets").select("id, last_service_date").eq("id", id).eq("shop_id", ctx.shopId).maybeSingle();
  if (!asset) return Response.json({ error: "Asset not found." }, { status: 404 });

  const servicedOn = dateOrNull(b.servicedOn) ?? new Date().toISOString().slice(0, 10);
  const { data, error } = await ctx.db.from("asset_maintenance").insert({
    shop_id: ctx.shopId, asset_id: id, serviced_on: servicedOn,
    performed_by: text(b.performedBy, 120) || null, cost: money(b.cost), notes: text(b.notes, 500) || null,
  }).select("*").single();
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const update: Record<string, unknown> = {};
  const last = (asset as Record<string, any>).last_service_date as string | null;
  if (!last || servicedOn >= last) update.last_service_date = servicedOn;
  if ("nextServiceDue" in b) update.next_service_due = dateOrNull(b.nextServiceDue);
  if (typeof b.condition === "string" && ASSET_CONDITIONS.includes(b.condition)) update.condition = b.condition;
  if (b.markInUse === true) update.status = "In Use";
  if (Object.keys(update).length) await ctx.db.from("assets").update(update).eq("id", id).eq("shop_id", ctx.shopId);
  return Response.json(serializeMaintenance(data), { status: 201 });
}
