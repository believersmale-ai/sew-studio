"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, BookUser, MessageCircle, Pencil, Phone, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api, apiGet, apiPatch, apiPost } from "@/lib/api";
import { useRole } from "@/stores/role";
import { useRoleAccess } from "@/stores/role-access";
import { formatDate } from "@/lib/format";
import { PageHeader } from "@/components/atelier/PageHeader";
import { SectionCard } from "@/components/atelier/SectionCard";
import { EmptyState } from "@/components/atelier/EmptyState";
import { PremiumButton } from "@/components/atelier/PremiumButton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Supplier = { id: string; name: string; supplies: string; location: string; phone: string; notes: string };
type Artisan = { id: string; name: string; trade: string; phone: string; location: string; rateNote: string; lastUsed: string | null; notes: string };
type Kind = "suppliers" | "artisans";
type Contact = Supplier & Artisan;

const TRADES = ["Machine Repairer", "Electrician", "Plumber", "Carpenter", "Cleaner", "Other"];
const field = "h-10 w-full rounded-lg border border-[#D2B9BF] bg-white px-3 text-sm outline-none focus:border-[#650019] focus:ring-4 focus:ring-[#650019]/10";
const label = "block text-xs font-medium text-stone-600";

const digits = (v: string) => v.replace(/\D/g, "");
/** wa.me needs an international number: 024… becomes 233 24… (Ghana). */
const whatsappHref = (phone: string) => {
  const d = digits(phone);
  if (!d) return "";
  return `https://wa.me/${d.startsWith("0") ? `233${d.slice(1)}` : d}`;
};
const norm = (v: string) => v.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

const EMPTY: Contact = { id: "", name: "", supplies: "", location: "", phone: "", notes: "", trade: "Machine Repairer", rateNote: "", lastUsed: null };

/** Another saved contact that is probably the same person or shop. */
function findDuplicate(list: Contact[], draft: Contact): Contact | undefined {
  const n = norm(draft.name);
  if (!n) return undefined;
  return list.find((c) => {
    if (c.id === draft.id) return false;
    if (norm(c.name) === n) return true;
    if (draft.phone && digits(c.phone) && digits(c.phone) === digits(draft.phone)) return true;
    const sameFirstWord = norm(c.name).split(" ")[0] === n.split(" ")[0];
    return sameFirstWord && Boolean(draft.location) && norm(c.location) === norm(draft.location);
  });
}

export default function Contacts() {
  const qc = useQueryClient();
  const { role } = useRole();
  const canEdit = useRoleAccess((s) => s.data?.access["contacts"]?.edit) ?? role === "madam";
  const [kind, setKind] = useState<Kind>("suppliers");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Contact | null>(null);

  const suppliers = useQuery<Supplier[]>({ queryKey: ["contacts", "suppliers"], queryFn: () => apiGet<Supplier[]>("/api/contacts/suppliers") });
  const artisans = useQuery<Artisan[]>({ queryKey: ["contacts", "artisans"], queryFn: () => apiGet<Artisan[]>("/api/contacts/artisans") });
  const active = kind === "suppliers" ? suppliers : artisans;
  const list = (active.data ?? []) as Contact[];

  const shown = useMemo(() => {
    const q = norm(search);
    if (!q) return list;
    return list.filter((c) => norm([c.name, c.supplies, c.trade, c.location, c.phone, c.notes].filter(Boolean).join(" ")).includes(q));
  }, [list, search]);

  const refresh = () => qc.invalidateQueries({ queryKey: ["contacts", kind] });
  const onError = (e: Error) => toast.error(e.message);
  const usedToday = useMutation({
    mutationFn: (id: string) => apiPatch(`/api/contacts/artisans/${id}`, { lastUsed: new Date().toISOString().slice(0, 10) }),
    onSuccess: () => { toast.success("Marked as used today"); refresh(); }, onError,
  });

  const noun = kind === "suppliers" ? "Supplier" : "Artisan";
  return (
    <div className="mx-auto w-full max-w-[1100px] p-5 md:p-8">
      <PageHeader eyebrow="Who you buy from & who fixes things" eyebrowIcon={BookUser} title="Contacts" subtitle="Suppliers you buy materials from, and artisans who service your equipment." />

      <div role="tablist" aria-label="Contact type" className="mb-4 inline-flex rounded-lg bg-[#F4ECEE] p-1">
        {(["suppliers", "artisans"] as const).map((k) => (
          <button key={k} role="tab" aria-selected={kind === k} onClick={() => { setKind(k); setSearch(""); }}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${kind === k ? "bg-white text-[#2F151B] shadow-sm" : "text-stone-500 hover:text-[#2F151B]"}`}>
            {k === "suppliers" ? "Suppliers" : "Artisans"}
          </button>
        ))}
      </div>

      <SectionCard
        title={`${list.length} ${kind}`}
        action={canEdit ? <PremiumButton size="sm" onClick={() => setEditing({ ...EMPTY })}><Plus className="size-4" /> Add {noun}</PremiumButton> : undefined}
      >
        {list.length > 3 && (
          <div className="relative border-b border-[#EEDFE3] p-3">
            <Search className="pointer-events-none absolute left-6 top-1/2 size-4 -translate-y-1/2 text-stone-400" aria-hidden="true" />
            <input aria-label={`Search ${kind}`} value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`Search ${kind} by name, item, place or phone`} className={`${field} pl-9`} />
          </div>
        )}
        {active.isLoading ? <p className="p-6 text-sm text-stone-400">Loading…</p>
          : active.isError ? <p role="alert" className="p-6 text-sm text-red-700">Could not load {kind}. Please refresh.</p>
          : !list.length ? (
            <EmptyState icon={BookUser} title={`No ${kind} yet`} description={kind === "suppliers" ? "Save the shops and markets you buy fabric, trims and beads from, so the next trip is quicker." : "Keep the machine repairers and electricians you trust, with what they charge."}
              action={canEdit ? <PremiumButton size="sm" onClick={() => setEditing({ ...EMPTY })}><Plus className="size-4" /> Add {noun}</PremiumButton> : undefined} />
          ) : !shown.length ? <p className="p-6 text-sm text-stone-500">Nothing matches “{search}”.</p>
          : (
            <ul>
              {shown.map((c) => {
                const wa = whatsappHref(c.phone);
                return (
                  <li key={c.id} className="flex flex-wrap items-start justify-between gap-3 border-t border-[#EEDFE3] px-5 py-4 first:border-t-0">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 font-medium text-[#2F151B]">
                        {c.name}
                        {kind === "artisans" && c.trade && <span className="rounded-full bg-[#F7EDF0] px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#800020]">{c.trade}</span>}
                      </p>
                      <p className="mt-0.5 text-sm text-stone-500">
                        {(kind === "suppliers" ? [c.supplies, c.location, c.phone] : [c.phone, c.location, c.lastUsed ? `Last used ${formatDate(c.lastUsed)}` : ""]).filter(Boolean).join(" · ")}
                      </p>
                      {kind === "artisans" && c.rateNote && <p className="mt-0.5 text-sm text-stone-600">{c.rateNote}</p>}
                      {c.notes && <p className="mt-0.5 text-sm text-stone-600">{c.notes}</p>}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {c.phone && <a href={`tel:${digits(c.phone) ? c.phone.replace(/[^\d+]/g, "") : ""}`} aria-label={`Call ${c.name}`} className="grid size-9 place-items-center rounded-lg border border-[#E6D4D8] text-[#650019] hover:bg-[#FBF1F3]"><Phone className="size-4" /></a>}
                      {wa && <a href={wa} target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp ${c.name}`} className="grid size-9 place-items-center rounded-lg border border-[#E6D4D8] text-[#650019] hover:bg-[#FBF1F3]"><MessageCircle className="size-4" /></a>}
                      {canEdit && kind === "artisans" && <button type="button" onClick={() => usedToday.mutate(c.id)} className="h-9 rounded-lg border border-[#E6D4D8] px-3 text-xs font-medium text-[#650019] hover:bg-[#FBF1F3]">Used today</button>}
                      {canEdit && <button type="button" onClick={() => setEditing(c)} aria-label={`Edit ${c.name}`} className="grid size-9 place-items-center rounded-lg text-stone-500 hover:bg-[#F7EFF1] hover:text-[#2F151B]"><Pencil className="size-4" /></button>}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
      </SectionCard>

      {editing && <ContactDialog key={editing.id || "new"} kind={kind} initial={editing} all={list} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refresh(); }} />}
    </div>
  );
}

function ContactDialog({ kind, initial, all, onClose, onSaved }: { kind: Kind; initial: Contact; all: Contact[]; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<Contact>(initial);
  const isNew = !initial.id;
  const noun = kind === "suppliers" ? "supplier" : "artisan";
  const dup = useMemo(() => findDuplicate(all, f), [all, f]);
  const set = <K extends keyof Contact>(k: K, v: Contact[K]) => setF((x) => ({ ...x, [k]: v }));
  const body = kind === "suppliers"
    ? { name: f.name, supplies: f.supplies, location: f.location, phone: f.phone, notes: f.notes }
    : { name: f.name, trade: f.trade, phone: f.phone, location: f.location, rateNote: f.rateNote, lastUsed: f.lastUsed || "", notes: f.notes };

  const save = useMutation({
    mutationFn: () => (isNew ? apiPost(`/api/contacts/${kind}`, body) : apiPatch(`/api/contacts/${kind}/${initial.id}`, body)),
    onSuccess: () => { toast.success(isNew ? `Added ${f.name}` : "Saved"); onSaved(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: () => api(`/api/contacts/${kind}/${initial.id}`, { method: "DELETE" }),
    onSuccess: () => { toast.success("Removed"); onSaved(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const trades = TRADES.includes(f.trade) || !f.trade ? TRADES : [f.trade, ...TRADES];

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isNew ? `Add ${noun}` : `Edit ${noun}`}</DialogTitle>
          <DialogDescription>{kind === "suppliers" ? "Where you buy materials from." : "Someone you call when equipment needs fixing."}</DialogDescription>
        </DialogHeader>
        <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); if (f.name.trim()) save.mutate(); }}>
          <label className={`${label} sm:col-span-2`}>Name<input autoFocus className={`${field} mt-1`} value={f.name} maxLength={120} onChange={(e) => set("name", e.target.value)} placeholder={kind === "suppliers" ? "e.g. Makola Textiles" : "e.g. Kwame Osei"} required /></label>
          {dup && <p role="status" className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 sm:col-span-2"><AlertTriangle className="mt-0.5 size-3.5 shrink-0" />Looks like “{dup.name}” is already saved. Check you are not adding the same {noun} twice.</p>}
          {kind === "suppliers"
            ? <label className={`${label} sm:col-span-2`}>What they sell<input className={`${field} mt-1`} value={f.supplies} maxLength={200} onChange={(e) => set("supplies", e.target.value)} placeholder="e.g. Lace, crepe, satin, linings" /></label>
            : <label className={label}>Trade<select className={`${field} mt-1`} value={f.trade} onChange={(e) => set("trade", e.target.value)}>{trades.map((t) => <option key={t}>{t}</option>)}</select></label>}
          <label className={label}>Phone<input type="tel" inputMode="tel" className={`${field} mt-1`} value={f.phone} maxLength={40} onChange={(e) => set("phone", e.target.value)} placeholder="024 400 1122" /></label>
          <label className={kind === "suppliers" ? `${label} sm:col-span-2` : label}>Where they are<input className={`${field} mt-1`} value={f.location} maxLength={120} onChange={(e) => set("location", e.target.value)} placeholder="e.g. Makola Market, Accra" /></label>
          {kind === "artisans" && <>
            <label className={label}>What they charge<input className={`${field} mt-1`} value={f.rateNote} maxLength={200} onChange={(e) => set("rateNote", e.target.value)} placeholder="e.g. GHS 80 per service call" /></label>
            <label className={label}>Last used<input type="date" className={`${field} mt-1`} value={f.lastUsed ?? ""} onChange={(e) => set("lastUsed", e.target.value || null)} /></label>
          </>}
          <label className={`${label} sm:col-span-2`}>Notes<textarea rows={2} maxLength={500} className={`${field} mt-1 h-auto py-2`} value={f.notes} onChange={(e) => set("notes", e.target.value)} placeholder="e.g. Best prices on Saturday mornings" /></label>
          <div className="flex items-center justify-between gap-3 pt-2 sm:col-span-2">
            {!isNew ? <button type="button" onClick={() => { if (window.confirm(`Remove ${initial.name}?`)) del.mutate(); }} className="inline-flex items-center gap-1.5 text-sm font-medium text-red-700 hover:underline"><Trash2 className="size-4" />Remove</button> : <span />}
            <PremiumButton type="submit" loading={save.isPending} disabled={!f.name.trim()}>{isNew ? `Add ${noun}` : "Save changes"}</PremiumButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
