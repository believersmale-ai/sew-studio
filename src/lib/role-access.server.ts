import { getPool } from "@/lib/db/pool";
import { MENU_DEFINITIONS, type MenuKey } from "@/lib/menu-config";
import { enforcedDefault, type AccessCell, type AccessMap, type StudioRole } from "@/lib/role-access";

type Overrides = Map<string, AccessCell>;
const TTL_MS = 10_000;
const g = globalThis as unknown as { __sewRoleAccess?: { at: number; map: Overrides } };

export function invalidateRoleAccessCache() {
  g.__sewRoleAccess = undefined;
}

/** All saved overrides, keyed "role:menu". Throws if the database cannot be read (callers decide how to fail). */
export async function loadRoleOverrides(): Promise<Overrides> {
  const cached = g.__sewRoleAccess;
  if (cached && Date.now() - cached.at < TTL_MS) return cached.map;
  const { rows } = await getPool().query("select role, menu_key, can_view, can_edit from public.system_role_access");
  const map: Overrides = new Map();
  for (const r of rows as { role: string; menu_key: string; can_view: boolean; can_edit: boolean }[]) {
    map.set(`${r.role}:${r.menu_key}`, { view: r.can_view, edit: r.can_view && r.can_edit });
  }
  g.__sewRoleAccess = { at: Date.now(), map };
  return map;
}

export async function effectiveAccess(role: string, key: MenuKey, overrides?: Overrides): Promise<AccessCell> {
  if (role === "madam") return { view: true, edit: true };
  const o = (overrides ?? (await loadRoleOverrides())).get(`${role}:${key}`);
  return o ?? enforcedDefault(role as StudioRole, key);
}

/** Effective access for every tool, for one role. Also lists tools an admin explicitly granted. */
export async function accessMapForRole(role: string): Promise<{ access: AccessMap; granted: MenuKey[] }> {
  const overrides = await loadRoleOverrides();
  const access = {} as AccessMap;
  const granted: MenuKey[] = [];
  for (const { key } of MENU_DEFINITIONS) {
    access[key] = await effectiveAccess(role, key, overrides);
    if (role !== "madam" && overrides.get(`${role}:${key}`)?.view) granted.push(key);
  }
  return { access, granted };
}
