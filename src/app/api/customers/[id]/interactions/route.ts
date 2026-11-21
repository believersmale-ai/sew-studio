import { getTenant } from "@/lib/db/session";

type Ctx = { params: Promise<{ id: string }> };
const kinds = new Set(["call", "message", "appointment", "visit", "note"]);

export async function GET(_request: Request, { params }: Ctx) {
  const ctx = await getTenant();
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const { data: customer } = await ctx.db.from("customers").select("id").eq("shop_id", ctx.shopId).eq("id", id).maybeSingle();
  if (!customer) return Response.json({ error: "Customer not found" }, { status: 404 });
  const { data, error } = await ctx.db.from("customer_interactions").select("*").eq("shop_id", ctx.shopId).eq("customer_id", id).order("occurred_at", { ascending: false }).limit(100);
  if (error) return Response.json({ error: "Unable to load activity" }, { status: 500 });
  return Response.json((data ?? []).map((row) => ({ id: row.id, kind: row.kind, subject: row.subject, details: row.details, occurredAt: row.occurred_at })));
}

export async function POST(request: Request, { params }: Ctx) {
  const ctx = await getTenant();
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (ctx.role !== "madam" && ctx.role !== "staff") return Response.json({ error: "Not allowed" }, { status: 403 });
  const { id } = await params;
  const { data: customer } = await ctx.db.from("customers").select("id").eq("shop_id", ctx.shopId).eq("id", id).maybeSingle();
  if (!customer) return Response.json({ error: "Customer not found" }, { status: 404 });
  const body = await request.json().catch(() => ({}));
  const kind = typeof body.kind === "string" ? body.kind : "";
  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  const details = typeof body.details === "string" ? body.details.trim() : "";
  if (!kinds.has(kind) || !subject || subject.length > 200 || details.length > 3000) return Response.json({ error: "Invalid interaction details" }, { status: 400 });
  const date = body.occurredAt ? new Date(body.occurredAt) : new Date();
  if (Number.isNaN(date.getTime())) return Response.json({ error: "Invalid date" }, { status: 400 });
  const { data, error } = await ctx.db.from("customer_interactions").insert({ shop_id: ctx.shopId, customer_id: id, kind: kind as "call" | "message" | "appointment" | "visit" | "note", subject, details: details || null, occurred_at: date.toISOString() }).select("*").single();
  if (error) return Response.json({ error: "Unable to save activity" }, { status: 500 });
  return Response.json({ id: data.id, kind: data.kind, subject: data.subject, details: data.details, occurredAt: data.occurred_at }, { status: 201 });
}
