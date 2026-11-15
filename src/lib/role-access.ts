import { MENU_DEFINITIONS, type MenuKey } from "@/lib/menu-config";

/**
 * What each studio role can see and change, per menu/tool.
 *
 * Defaults live here; a platform admin overrides them in /admin/roles (stored in
 * `system_role_access`). The studio owner is never restricted.
 * This file is safe to import from the browser.
 */

export const ROLES = ["madam", "staff", "trainer", "trainee", "freelancer"] as const;
export type StudioRole = (typeof ROLES)[number];
export const ROLE_LABEL: Record<StudioRole, string> = { madam: "Owner", staff: "Staff", trainer: "Trainer", trainee: "Trainee", freelancer: "Freelancer" };

/** Tools only the owner can use unless an admin grants them to another role. */
export const OWNER_ONLY_BY_DEFAULT: readonly MenuKey[] = ["contacts", "asset-register"];

/** The Dashboard is every role's home page, so it is not configurable. */
export const CONFIGURABLE_MENUS = MENU_DEFINITIONS.filter((m) => m.key !== "dashboard");

/** The menu each role sees out of the box (mirrors the sidebar in AppShell). */
const DEFAULT_NAV: Record<Exclude<StudioRole, "madam">, readonly MenuKey[]> = {
  staff: ["orders", "board", "fittings", "tasks", "community", "portfolio", "webinars"],
  trainer: ["orders", "board", "fittings", "tasks", "community", "curriculum", "webinars", "progress", "portfolio"],
  // Trainees also see Orders and Board when their trainer grants it to them personally.
  trainee: ["tasks", "curriculum", "webinars", "progress", "portfolio", "certificate", "community"],
  freelancer: ["my-jobs", "portfolio", "community"],
};

export interface AccessCell { view: boolean; edit: boolean }

/** What the admin screen shows before any override is saved. */
export function defaultCell(role: StudioRole, key: MenuKey): AccessCell {
  if (role === "madam") return { view: true, edit: true };
  const view = DEFAULT_NAV[role].includes(key);
  return { view, edit: view && role !== "trainee" };
}

/** What the server enforces when no override exists: everything is open except owner-only tools. */
export function enforcedDefault(role: StudioRole, key: MenuKey): AccessCell {
  if (role === "madam") return { view: true, edit: true };
  const open = !OWNER_ONLY_BY_DEFAULT.includes(key);
  return { view: open, edit: open };
}

export type AccessMap = Record<MenuKey, AccessCell>;
