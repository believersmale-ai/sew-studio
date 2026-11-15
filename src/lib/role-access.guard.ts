import { getTenant } from "@/lib/db/session";
import type { MenuKey } from "@/lib/menu-config";
import { effectiveAccess } from "@/lib/role-access.server";

/** Signed-in studio member who may `view` or `edit` the tool, or a ready-made error Response. */
export async function requireAccess(key: MenuKey, mode: "view" | "edit") {
  const ctx = await getTenant();
  if (!ctx) return { error: Response.json({ error: "Unauthorized" }, { status: 401 }) } as const;
  let allowed: boolean;
  try {
    allowed = (await effectiveAccess(ctx.role, key))[mode];
  } catch (error) {
    console.error("[role-access] could not verify access", error);
    return { error: Response.json({ error: "Access could not be verified." }, { status: 503 }) } as const;
  }
  if (!allowed) {
    const msg = mode === "edit" ? "Your role can view this page but not change it. Ask the studio owner." : "Your role does not have access to this page. Ask the studio owner.";
    return { error: Response.json({ error: msg }, { status: 403 }) } as const;
  }
  return { ctx } as const;
}
