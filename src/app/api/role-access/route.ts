import { getTenant } from "@/lib/db/session";
import { accessMapForRole } from "@/lib/role-access.server";

export const dynamic = "force-dynamic";

/** What the signed-in member's role can see and change, per tool (drives the sidebar and page notices). */
export async function GET() {
  const ctx = await getTenant();
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { access, granted } = await accessMapForRole(ctx.role);
    return Response.json({ role: ctx.role, access, granted }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[role-access] load failed", error);
    return Response.json({ error: "Could not load access settings." }, { status: 500 });
  }
}
