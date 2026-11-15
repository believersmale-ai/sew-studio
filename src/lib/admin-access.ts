/**
 * Platform-admin areas. A "super" admin can do everything; any other admin can
 * only use the areas ticked for them in /admin/team. Safe to import anywhere.
 */
export const ADMIN_AREAS = [
  { key: "website", label: "Website content", hint: "Edit the public website, its pictures and links", href: "/admin/website" },
  { key: "integrations", label: "Integrations & keys", hint: "Email, notification webhook and AI keys", href: "/admin/integrations" },
  { key: "roles", label: "Role access", hint: "Choose what each studio role sees and changes", href: "/admin/roles" },
  { key: "experience", label: "Experience & releases", hint: "Switch pages on/off, publish updates", href: "/admin/experience" },
  { key: "academy", label: "Academy", hint: "Courses, lessons and live classes", href: "/admin/academy" },
  { key: "trainings", label: "Public trainings", hint: "Free sessions and sign-ups", href: "/admin/trainings" },
  { key: "studios", label: "Studios", hint: "View studios, suspend or reinstate them", href: "/admin" },
  { key: "audit", label: "Activity log", hint: "See who changed what", href: "/admin" },
] as const;

export type AdminArea = (typeof ADMIN_AREAS)[number]["key"];
export const ADMIN_AREA_KEYS: readonly string[] = ADMIN_AREAS.map((a) => a.key);

export const adminHasArea = (admin: { isSuper: boolean; areas: readonly string[] }, area: AdminArea) =>
  admin.isSuper || admin.areas.includes(area);

/** Which area guards an admin API path. "super" = only super admins. null = not an admin API. */
export function adminAreaForPath(pathname: string): AdminArea | "super" | null {
  if (!pathname.startsWith("/api/admin/")) return null;
  const rest = pathname.slice("/api/admin/".length);
  const head = rest.split("/")[0];
  switch (head) {
    case "website-content": case "site-images": return "website";
    case "integrations": return "integrations";
    case "role-access": return "roles";
    case "menus": case "platform-settings": case "releases": return "experience";
    case "academy": return "academy";
    case "trainings": return "trainings";
    case "shops": return "studios";
    case "audit-log": return "audit";
    default: return "super"; // includes /api/admin/admins and anything added later
  }
}
