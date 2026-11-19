import { NextResponse } from "next/server";
import { getTenant } from "@/lib/db/session";

// Read-only discovery for the future studio switcher.
// Deliberately does not change active studio or session: existing RLS still
// derives its shop from profiles.shop_id.
export async function GET() {
  const ctx = await getTenant();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data, error } = await ctx.db
    .from("studio_memberships")
    .select("id,shop_id,role,status,joined_at")
    .eq("user_id", ctx.userId)
    .eq("status", "active")
    .order("joined_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    activeShopId: ctx.shopId,
    switchingEnabled: false,
    memberships: (data ?? []).map((row) => ({
      id: row.id,
      shopId: row.shop_id,
      role: row.role,
      joinedAt: row.joined_at,
      isCurrent: row.shop_id === ctx.shopId,
    })),
  });
}
