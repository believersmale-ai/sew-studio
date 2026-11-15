import { ASSET_CATEGORIES, ASSET_CONDITIONS, ASSET_STATUSES, dateOrNull, money, serializeAsset, text, type Tenant } from "@/lib/db/studio-modules";

export const serializeRegisterAsset = (a: Record<string, any>) => ({
  ...serializeAsset(a),
  assignedTo: (a.assigned_to as string | null) ?? null,
  notes: (a.notes as string | null) ?? "",
});

export const serializeMaintenance = (m: Record<string, any>) => ({
  id: m.id as string, assetId: m.asset_id as string, servicedOn: m.serviced_on as string,
  performedBy: (m.performed_by as string | null) ?? "", cost: Number(m.cost) || 0, notes: (m.notes as string | null) ?? "",
});

/** True when `id` is a (blank or) member of this studio. */
export async function staffBelongsToShop(ctx: Tenant, id: unknown): Promise<{ ok: true; id: string | null } | { ok: false }> {
  if (id === null || id === undefined || id === "") return { ok: true, id: null };
  if (typeof id !== "string") return { ok: false };
  const { data } = await ctx.db.from("profiles").select("id").eq("id", id).eq("shop_id", ctx.shopId).maybeSingle();
  return data ? { ok: true, id } : { ok: false };
}

const pick = (v: unknown, list: string[]) => (typeof v === "string" && list.includes(v) ? v : undefined);

/** Turns a request body into asset columns. With `partial`, only the keys present are returned. */
export async function assetColumns(ctx: Tenant, b: Record<string, unknown>, partial: boolean): Promise<{ values: Record<string, unknown> } | { error: string }> {
  const v: Record<string, unknown> = {};
  const has = (k: string) => !partial || k in b;
  if (has("name")) { const n = text(b.name, 120); if (!n) return { error: "Name is required." }; v.name = n; }
  if (has("category")) v.category = pick(b.category, ASSET_CATEGORIES) ?? "Machine";
  if (has("condition")) v.condition = pick(b.condition, ASSET_CONDITIONS) ?? "Good";
  if (has("status")) v.status = pick(b.status, ASSET_STATUSES) ?? "In Use";
  if (has("location")) v.location = text(b.location, 120) || null;
  if (has("notes")) v.notes = text(b.notes, 1000) || null;
  if (has("purchaseDate")) v.purchase_date = dateOrNull(b.purchaseDate);
  if (has("lastServiceDate")) v.last_service_date = dateOrNull(b.lastServiceDate);
  if (has("nextServiceDue")) v.next_service_due = dateOrNull(b.nextServiceDue);
  if (has("purchaseCost")) v.purchase_cost = b.purchaseCost === "" || b.purchaseCost == null ? null : money(b.purchaseCost);
  if (has("assignedTo")) {
    const s = await staffBelongsToShop(ctx, b.assignedTo);
    if (!s.ok) return { error: "That team member was not found." };
    v.assigned_to = s.id;
  }
  return { values: v };
}
