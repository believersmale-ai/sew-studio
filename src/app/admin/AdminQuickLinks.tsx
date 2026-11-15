"use client";

import { useEffect, useRef, useState } from "react";
import { BookOpen, Globe, KeyRound, LayoutGrid, Megaphone, ShieldCheck, SlidersHorizontal, UsersRound, X } from "lucide-react";
import { apiGet } from "@/lib/api";
import { adminHasArea, type AdminArea } from "@/lib/admin-access";

type LinkDef = { href: string; label: string; hint: string; icon: typeof Globe; area: AdminArea | "super" | "everyone" };
const LINKS: LinkDef[] = [
  { href: "/admin/website", label: "Website content", hint: "Text, pictures and links", icon: Globe, area: "website" },
  { href: "/admin/integrations", label: "Integrations & keys", hint: "Email, notifications, AI", icon: KeyRound, area: "integrations" },
  { href: "/admin/roles", label: "Role access", hint: "Who sees and changes what", icon: ShieldCheck, area: "roles" },
  { href: "/admin/experience", label: "Experience & releases", hint: "Pages on/off, updates", icon: SlidersHorizontal, area: "experience" },
  { href: "/admin/academy", label: "Academy", hint: "Courses and live classes", icon: BookOpen, area: "academy" },
  { href: "/admin/trainings", label: "Public trainings", hint: "Free sessions and sign-ups", icon: Megaphone, area: "trainings" },
  { href: "/admin/team", label: "Admin team", hint: "Add admins, set their access", icon: UsersRound, area: "super" },
];

/** One tidy button instead of a stack of floating links; each admin only sees the areas they may use. */
export function AdminQuickLinks() {
  const [open, setOpen] = useState(false);
  const [admin, setAdmin] = useState<{ isSuper: boolean; areas: string[] } | null>(null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    apiGet<{ isSuper: boolean; areas: string[] }>("/api/admin-auth/me").then(setAdmin).catch(() => setAdmin(null));
  }, []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    const onClick = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("mousedown", onClick); };
  }, [open]);

  if (!admin) return null; // signed out: the sign-in form shows instead
  const links: LinkDef[] = LINKS.filter((l) => (l.area === "everyone" ? true : l.area === "super" ? admin.isSuper : adminHasArea(admin, l.area)));
  if (!admin.isSuper) links.push({ href: "/admin/team", label: "My password", hint: "Change your sign-in password", icon: KeyRound, area: "everyone" });

  return (
    <div ref={box} className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-[60]">
      {open && (
        <nav aria-label="Platform tools" className="absolute bottom-14 right-0 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white p-1.5 shadow-2xl">
          {links.map(({ href, label, hint, icon: Icon }) => (
            <a key={label} href={href} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-[#FBF1F3] focus-visible:bg-[#FBF1F3]">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#800020]/10 text-[#800020]"><Icon className="size-4" aria-hidden="true" /></span>
              <span className="min-w-0"><span className="block text-sm font-semibold text-slate-900">{label}</span><span className="block truncate text-xs text-slate-500">{hint}</span></span>
            </a>
          ))}
        </nav>
      )}
      <button type="button" aria-expanded={open} aria-haspopup="true" onClick={() => setOpen((o) => !o)}
        className="inline-flex h-12 items-center gap-2 rounded-full bg-[#800020] px-5 text-sm font-semibold text-white shadow-xl transition hover:bg-[#650019]">
        {open ? <X className="size-4" aria-hidden="true" /> : <LayoutGrid className="size-4" aria-hidden="true" />}Manage platform
      </button>
    </div>
  );
}
