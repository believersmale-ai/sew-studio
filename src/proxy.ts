import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getPool } from "@/lib/db/pool";
import { menuForApiPath, menuForPagePath } from "@/lib/menu-config";
import { getPlanEntitlements, requiredPlanForFeature } from "@/lib/plans";
import { effectiveAccess } from "@/lib/role-access.server";

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const menuKey = menuForApiPath(pathname) ?? menuForPagePath(pathname);
  if (menuKey) {
    try {
      const { rows } = await getPool().query(
        "select enabled from public.system_menu_settings where menu_key = $1",
        [menuKey]
      );
      if (rows[0]?.enabled === false) {
        return NextResponse.json(
          { error: "This feature is currently disabled by the platform administrator." },
          { status: 404 }
        );
      }
    } catch (error) {
      console.error("[proxy] could not verify system menu status", error);
      return NextResponse.json({ error: "Feature availability could not be verified." }, { status: 503 });
    }
  }

  const isApiMutation = pathname.startsWith("/api/") && MUTATING_METHODS.has(request.method);
  if (menuKey || isApiMutation) {
    const token = request.cookies.get("sew_session")?.value;
    if (token) {
      try {
        const { rows } = await getPool().query(
          `select sh.plan, sh.trial_ends_at, p.role
             from private.sessions s
             join public.profiles p on p.id = s.user_id
             join public.shops sh on sh.id = p.shop_id
            where s.token_hash = $1 and s.expires_at > now()
            limit 1`,
          [sha256(token)]
        );
        const shop = rows[0] as { plan: string; trial_ends_at: string | null; role: string } | undefined;

        // Per-role access set by a platform admin (/admin/roles). Fails closed.
        if (shop && menuKey && !pathname.startsWith("/api/admin/")) {
          const role = await effectiveAccess(shop.role, menuKey);
          if (!role.view) {
            return NextResponse.json({ error: "Your role does not have access to this page. Ask the studio owner.", code: "ROLE_NO_ACCESS" }, { status: 403 });
          }
          if (isApiMutation && !role.edit) {
            return NextResponse.json({ error: "Your role can view this page but not change it. Ask the studio owner.", code: "ROLE_VIEW_ONLY" }, { status: 403 });
          }
        }

        if (shop) {
          const access = getPlanEntitlements(shop.plan, shop.trial_ends_at);
          const canSubmitUpgradeRequest = pathname === "/api/plan/upgrade-request";
          const isAuthOrPlatformAdmin =
            pathname.startsWith("/api/auth/") ||
            pathname.startsWith("/api/freelancer-auth/") ||
            pathname.startsWith("/api/admin/");

          // Everything stays open to view. New entries and changes pause for a
          // tool outside the studio's plan, and for every tool once an unpaid
          // trial has ended.
          if (isApiMutation && !canSubmitUpgradeRequest && !isAuthOrPlatformAdmin) {
            const paused = menuKey ? !access.canWrite(menuKey) : access.trialExpired;
            if (paused) {
              const message = access.trialExpired
                ? "Your trial has ended, so your studio is view-only. Choose a plan to add new entries. Everything you entered is kept."
                : `This tool is on the ${requiredPlanForFeature(menuKey!) === "pro" ? "Pro" : "Enterprise"} plan. You can still view everything you entered, but adding new entries needs an upgrade.`;
              return NextResponse.json({ error: message, code: "PLAN_VIEW_ONLY" }, { status: 403 });
            }
          }
        }
      } catch (error) {
        console.error("[proxy] could not verify studio plan access", error);
        return NextResponse.json({ error: "Plan access could not be verified." }, { status: 503 });
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/health$|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
