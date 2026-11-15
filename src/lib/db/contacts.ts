// Shared request handling for the two Contacts lists (suppliers and artisans).
import { requireAccess } from "@/lib/role-access.guard";
import { dateOrNull, text } from "@/lib/db/studio-modules";

type Field = { key: string; col: string; max: number; kind?: "text" | "phone" | "date"; required?: boolean };
export interface ContactConfig { table: "suppliers" | "artisans"; noun: string; fields: Field[]; order: string }

export const SUPPLIERS: ContactConfig = {
  table: "suppliers", noun: "Supplier", order: "name",
  fields: [
    { key: "name", col: "name", max: 120, required: true },
    { key: "supplies", col: "supplies", max: 200 },
    { key: "location", col: "location", max: 120 },
    { key: "phone", col: "phone", max: 40, kind: "phone" },
    { key: "notes", col: "notes", max: 500 },
  ],
};
export const ARTISANS: ContactConfig = {
  table: "artisans", noun: "Artisan", order: "name",
  fields: [
    { key: "name", col: "name", max: 120, required: true },
    { key: "trade", col: "trade", max: 60 },
    { key: "phone", col: "phone", max: 40, kind: "phone" },
    { key: "location", col: "location", max: 120 },
    { key: "rateNote", col: "rate_note", max: 200 },
    { key: "lastUsed", col: "last_used", max: 10, kind: "date" },
    { key: "notes", col: "notes", max: 500 },
  ],
};

const PHONE_RE = /^\+?[\d\s()-]{6,}$/;

function serialize(cfg: ContactConfig, row: Record<string, any>) {
  const out: Record<string, unknown> = { id: row.id };
  for (const f of cfg.fields) out[f.key] = f.kind === "date" ? row[f.col] ?? null : row[f.col] ?? "";
  return out;
}

/** Reads the request body into column values. Returns an error message when something is invalid. */
function parse(cfg: ContactConfig, b: Record<string, unknown>, partial: boolean): { values: Record<string, unknown> } | { error: string } {
  const values: Record<string, unknown> = {};
  for (const f of cfg.fields) {
    if (partial && !(f.key in b)) continue;
    if (f.kind === "date") { values[f.col] = dateOrNull(b[f.key]); continue; }
    const v = text(b[f.key], f.max);
    if (f.required && !v) return { error: `${f.key === "name" ? "Name" : f.key} is required.` };
    if (f.kind === "phone" && v && !PHONE_RE.test(v)) return { error: "Enter a valid phone number." };
    values[f.col] = f.required ? v : v || (f.key === "trade" ? "Other" : null);
  }
  return { values };
}

export async function listContacts(cfg: ContactConfig) {
  const auth = await requireAccess("contacts", "view");
  if ("error" in auth) return auth.error;
  const { ctx } = auth;
  const { data, error } = await ctx.db.from(cfg.table).select("*").eq("shop_id", ctx.shopId).order(cfg.order);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json((data ?? []).map((r: Record<string, any>) => serialize(cfg, r)));
}

export async function createContact(cfg: ContactConfig, req: Request) {
  const auth = await requireAccess("contacts", "edit");
  if ("error" in auth) return auth.error;
  const { ctx } = auth;
  const parsed = parse(cfg, await req.json().catch(() => ({})), false);
  if ("error" in parsed) return Response.json({ error: parsed.error }, { status: 400 });
  const { data, error } = await ctx.db.from(cfg.table).insert({ shop_id: ctx.shopId, ...parsed.values }).select("*").single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(serialize(cfg, data), { status: 201 });
}

export async function updateContact(cfg: ContactConfig, req: Request, id: string) {
  const auth = await requireAccess("contacts", "edit");
  if ("error" in auth) return auth.error;
  const { ctx } = auth;
  const parsed = parse(cfg, await req.json().catch(() => ({})), true);
  if ("error" in parsed) return Response.json({ error: parsed.error }, { status: 400 });
  if (!Object.keys(parsed.values).length) return Response.json({ error: "Nothing to update." }, { status: 400 });
  const { data, error } = await ctx.db.from(cfg.table).update(parsed.values).eq("id", id).eq("shop_id", ctx.shopId).select("*").maybeSingle();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!data) return Response.json({ error: `${cfg.noun} not found.` }, { status: 404 });
  return Response.json(serialize(cfg, data));
}

export async function deleteContact(cfg: ContactConfig, id: string) {
  const auth = await requireAccess("contacts", "edit");
  if ("error" in auth) return auth.error;
  const { ctx } = auth;
  const { error } = await ctx.db.from(cfg.table).delete().eq("id", id).eq("shop_id", ctx.shopId);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
