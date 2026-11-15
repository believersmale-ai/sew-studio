"use client";

import { create } from "zustand";
import { apiGet } from "@/lib/api";
import type { MenuKey } from "@/lib/menu-config";

type Cell = { view: boolean; edit: boolean };
type RoleAccessData = { access: Record<MenuKey, Cell>; granted: MenuKey[] };

type State = { data: RoleAccessData | null; load: () => Promise<void> };

/** What the signed-in role may see/change per tool, as set by the platform admin. */
export const useRoleAccess = create<State>((set) => ({
  data: null,
  load: async () => {
    try {
      const d = await apiGet<RoleAccessData & { role: string }>("/api/role-access");
      set({ data: { access: d.access, granted: d.granted } });
    } catch {
      // If this cannot load, the sidebar falls back to its defaults; the server still enforces access.
    }
  },
}));
