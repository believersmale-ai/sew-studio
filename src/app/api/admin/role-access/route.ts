import { NextResponse } from "next/server";
import { getSystemAdminSession } from "@/lib/db/session";
import { getPool } from "@/lib/db/pool";
import type { MenuKey } from "@/lib/menu-config";
import { CONFIGURABLE_MENUS, ROLES, ROLE_LABEL, defaultCell, type AccessCell, type StudioRole } from "@/lib/role-access";
import { invalidateRoleAccessCache, loadRoleOverrides } from "@/lib/role-access.server";

export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "no-store" };
const EDITABLE_ROLES = ROLES.filter((r) => r !== "madam") as Exclude<StudioRole, "madam">[];

async function payload() {
  invalidateRoleAccessCache();
  const overrides = await loadRoleOverrides();
  const matrix: Record<string, Record<string, AccessCell>> = {};
  const defaults: Record<string, Record<string, AccessCell>> = {};
  for (const role of EDITABLE_ROLES) {
    matrix[role] = {}; defaults[role] = {};
    for (const { key } of CONFIGURABLE_MENUS) {
      const d = defaultCell(role, key);
      defaults[role][key] = d;
      matrix[role][key] = overrides.get(`${role}:${key}`) ?? d;
    }
  }
  return {
    roles: EDITABLE_ROLES.map((r) => ({ key: r, label: ROLE_LABEL[r] })),
    menus: CONFIGURABLE_MENUS.map(({ key, label, section }) => ({ key, label, section })),
    matrix, defaults,
  };
}

export async function GET() {
  const session = await getSystemAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { return NextResponse.json(await payload(), { headers: noStore }); }
  catch (error) {
    console.error("[admin/role-access] load failed", error);
    return NextResponse.json({ error: "Could not load role access." }, { status: 500 });
  }
}

/** Body: { matrix: { role: { menuKey: { view, edit } } } }. Only cells that differ from the default are stored. */
export async function PUT(request: Request) {
  const session = await getSystemAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { matrix?: Record<string, Record<string, { view?: unknown; edit?: unknown }>> } | null;
  if (!body?.matrix || typeof body.matrix !== "object") return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const known = new Set<MenuKey>(CONFIGURABLE_MENUS.map((m) => m.key));
  const rows: { role: string; key: string; view: boolean; edit: boolean }[] = [];
  for (const role of EDITABLE_ROLES) {
    const cells = body.matrix[role];
    if (!cells || typeof cells !== "object") continue;
    for (const [key, cell] of Object.entries(cells)) {
      if (!known.has(key as MenuKey) || !cell || typeof cell !== "object") return NextResponse.json({ error: `Unknown setting: ${role}/${key}` }, { status: 400 });
      const view = cell.view === true;
      const edit = view && cell.edit === true;
      const d = defaultCell(role, key as MenuKey);
      if (view !== d.view || edit !== d.edit) rows.push({ role, key, view, edit });
    }
  }

  const client = await getPool().connect();
  try {
    await client.query("begin");
    await client.query("delete from public.system_role_access");
    for (const r of rows) {
      await client.query(
        `insert into public.system_role_access (role, menu_key, can_view, can_edit, updated_by) values ($1, $2, $3, $4, $5)`,
        [r.role, r.key, r.view, r.edit, session.adminId]
      );
    }
    await client.query(
      `insert into public.system_platform_audit_log (admin_id, action, entity, details) values ($1, 'role_access.updated', 'role_access', $2::jsonb)`,
      [session.adminId, JSON.stringify({ overrides: rows.length })]
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => {});
    console.error("[admin/role-access] save failed", error);
    return NextResponse.json({ error: "Could not save role access." }, { status: 500 });
  } finally {
    client.release();
  }
  invalidateRoleAccessCache();
  return NextResponse.json(await payload(), { headers: noStore });
}

export async function DELETE() {
  const session = await getSystemAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await getPool().query("delete from public.system_role_access");
    invalidateRoleAccessCache();
    return NextResponse.json(await payload(), { headers: noStore });
  } catch (error) {
    console.error("[admin/role-access] reset failed", error);
    return NextResponse.json({ error: "Could not reset role access." }, { status: 500 });
  }
}
