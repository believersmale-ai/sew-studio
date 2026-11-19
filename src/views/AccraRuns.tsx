"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Download, Plus, Trash2, Truck } from "lucide-react";
import { toast } from "sonner";
import { api, apiGet, apiPatch, apiPost } from "@/lib/api";
import { useRole } from "@/stores/role";
import { formatCurrency, formatDate, todayISO } from "@/lib/format";
import type { Settings } from "@/lib/types";
import { PageHeader } from "@/components/atelier/PageHeader";
import { SectionCard } from "@/components/atelier/SectionCard";
import { EmptyState } from "@/components/atelier/EmptyState";
import { PremiumButton } from "@/components/atelier/PremiumButton";

type Item = { id: string; description: string; obtained: boolean; plannedCost: number; actualCost: number };
type Trip = { id: string; tripDate: string; status: "Planned" | "Logged"; notes: string; items: Item[] };

const field = "h-10 rounded-lg border border-[#D2B9BF] bg-white px-3 text-sm outline-none focus:border-[#650019] focus:ring-4 focus:ring-[#650019]/10";

/** Market Runs: plan a buying trip, tick items off, and record what was actually spent. */
export default function AccraRuns() {
  const qc = useQueryClient();
  const { role } = useRole();
  const canEdit = role !== "trainee";
  const { data: trips, isLoading } = useQuery<Trip[]>({ queryKey: ["accra-runs"], queryFn: () => apiGet<Trip[]>("/api/accra-runs") });
  const { data: settings } = useQuery<Settings>({ queryKey: ["settings"], queryFn: () => apiGet<Settings>("/api/settings") });
  const currency = settings?.currency || "GHS";
  const refresh = () => qc.invalidateQueries({ queryKey: ["accra-runs"] });
  const onError = (e: Error) => toast.error(e.message);

  const [date, setDate] = useState(todayISO());
  const [filter, setFilter] = useState<"All" | "Planned" | "Logged">("All");
  const visibleTrips = (trips ?? []).filter(t => filter === "All" || t.status === filter);
  const plannedTotal = visibleTrips.reduce((sum,t) => sum + t.items.reduce((n,i)=>n+i.plannedCost,0),0);
  const spentTotal = visibleTrips.reduce((sum,t) => sum + t.items.reduce((n,i)=>n+i.actualCost,0),0);
  const exportCsv = () => {
    const escape = (v: string | number) => '"' + String(v).replaceAll('"','""') + '"';
    const rows = [["Trip date","Status","Notes","Item","Obtained","Planned cost","Actual cost"],...visibleTrips.flatMap(t => t.items.length ? t.items.map(i => [t.tripDate,t.status,t.notes ?? "",i.description,i.obtained ? "Yes" : "No",i.plannedCost,i.actualCost]) : [[t.tripDate,t.status,t.notes ?? "","","",0,0]])];
    const csv = "\uFEFF" + rows.map(row => row.map(escape).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
    const link = document.createElement("a"); link.href=url; link.download="sewsiness-market-runs.csv"; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
  };
  const addTrip = useMutation({ mutationFn: () => apiPost("/api/accra-runs", { tripDate: date }), onSuccess: () => { toast.success("Trip planned"); refresh(); }, onError });

  return (
    <div className="p-5 md:p-8 max-w-[1000px] mx-auto w-full">
      <PageHeader eyebrow="Studio" eyebrowIcon={Truck} title="Market Runs" subtitle="Plan a buying trip, tick off what you got, and record what you really spent." />
      {canEdit && (
        <div className="mb-5 flex flex-wrap items-end gap-3">
          <label className="text-xs font-medium text-stone-600">Trip date<input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${field} mt-1 block`} /></label>
          <PremiumButton onClick={() => addTrip.mutate()} disabled={addTrip.isPending}><Plus className="size-4" /> Plan a trip</PremiumButton>
        </div>
      )}
      {!isLoading && !!trips?.length && <div className="mb-5 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl border border-[#EEDFE3] bg-white p-4"><p className="text-xs text-stone-500">Planned purchases</p><p className="text-xl font-semibold tabular-nums">{formatCurrency(plannedTotal,currency)}</p></div>
          <div className="rounded-xl border border-[#EEDFE3] bg-white p-4"><p className="text-xs text-stone-500">Actual spending</p><p className="text-xl font-semibold tabular-nums">{formatCurrency(spentTotal,currency)}</p></div>
          <div className="rounded-xl border border-[#EEDFE3] bg-white p-4"><p className="text-xs text-stone-500">Difference (plan − actual)</p><p className={`text-xl font-semibold tabular-nums ${spentTotal>plannedTotal?"text-red-700":"text-emerald-700"}`}>{formatCurrency(plannedTotal-spentTotal,currency)}</p></div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="text-xs font-medium text-stone-600">Show trips <select className={`${field} ml-2`} value={filter} onChange={e=>setFilter(e.target.value as typeof filter)}><option>All</option><option>Planned</option><option>Logged</option></select></label>
          <PremiumButton variant="outline" size="sm" onClick={exportCsv}><Download className="size-4"/> Export CSV</PremiumButton>
        </div>
      </div>}
      {isLoading ? <p className="text-sm text-stone-400">Loading…</p> : !trips?.length ? (
        <SectionCard><EmptyState icon={Truck} title="No trips yet" description="Plan your next trip to the market, then list what you need to buy." action={canEdit ? <PremiumButton size="sm" onClick={() => addTrip.mutate()} disabled={addTrip.isPending}><Plus className="size-4" /> Plan your first trip</PremiumButton> : undefined} /></SectionCard>
      ) : visibleTrips.length === 0 ? <SectionCard><p className="p-4 text-sm text-stone-500">No {filter.toLowerCase()} trips match this filter.</p></SectionCard> : (
        <div className="space-y-5">{visibleTrips.map((t) => <TripCard key={t.id} trip={t} currency={currency} canEdit={canEdit} onChange={refresh} onError={onError} />)}</div>
      )}
    </div>
  );
}

function TripCard({ trip, currency, canEdit, onChange, onError }: { trip: Trip; currency: string; canEdit: boolean; onChange: () => void; onError: (e: Error) => void }) {
  const [desc, setDesc] = useState("");
  const [cost, setCost] = useState("");
  const [notes, setNotes] = useState(trip.notes ?? "");
  const planned = trip.items.reduce((n, i) => n + i.plannedCost, 0);
  const actual = trip.items.reduce((n, i) => n + i.actualCost, 0);
  const done = trip.items.filter((i) => i.obtained).length;
  const base = `/api/accra-runs/${trip.id}`;
  const addItem = useMutation({ mutationFn: () => apiPost(`${base}/items`, { description: desc, plannedCost: Number(cost) || 0 }), onSuccess: () => { setDesc(""); setCost(""); onChange(); }, onError });
  const patchItem = useMutation({ mutationFn: ({ id, body }: { id: string; body: object }) => apiPatch(`${base}/items/${id}`, body), onSuccess: onChange, onError });
  const delItem = useMutation({ mutationFn: (id: string) => api(`${base}/items/${id}`, { method: "DELETE" }), onSuccess: onChange, onError });
  const patchTrip = useMutation({ mutationFn: (body: object) => apiPatch(base, body), onSuccess: onChange, onError });
  const delTrip = useMutation({ mutationFn: () => api(base, { method: "DELETE" }), onSuccess: () => { toast.success("Trip deleted"); onChange(); }, onError });

  return (
    <SectionCard
      title={`${formatDate(trip.tripDate)} · ${trip.status}`}
      action={canEdit ? (
        <div className="flex gap-2">
          <PremiumButton size="sm" variant="outline" onClick={() => patchTrip.mutate({ status: trip.status === "Planned" ? "Logged" : "Planned" })}>{trip.status === "Planned" ? "Mark as logged" : "Reopen"}</PremiumButton>
          <PremiumButton size="sm" variant="ghost" aria-label="Delete trip" onClick={() => { if (window.confirm("Delete this trip and its list?")) delTrip.mutate(); }}><Trash2 className="size-4" /></PremiumButton>
        </div>
      ) : undefined}
    >
      <div className="px-4 pt-3 space-y-1"><p className="text-xs text-stone-500">{done} of {trip.items.length} obtained · planned {formatCurrency(planned, currency)} · spent {formatCurrency(actual, currency)}</p><p className={`text-xs font-medium ${actual>planned?"text-red-700":"text-emerald-700"}`}>{actual>planned ? "Over plan by " : "Remaining against plan: "}{formatCurrency(Math.abs(planned-actual),currency)}</p></div>
      <div className="px-4 py-3 border-b border-[#EEDFE3] space-y-2">
        <label htmlFor={`market-notes-${trip.id}`} className="block text-xs font-medium text-stone-600">Trip notes, supplier details and purchase references</label>
        <textarea id={`market-notes-${trip.id}`} maxLength={1000} rows={2} disabled={!canEdit} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Suppliers, market location, receipt numbers, transport notes…" className={`${field} w-full min-h-20 py-2`} />
        {canEdit && <PremiumButton size="sm" variant="outline" disabled={patchTrip.isPending || notes === (trip.notes ?? "")} onClick={()=>patchTrip.mutate({notes})}>Save trip notes</PremiumButton>}
      </div>
      <ul className="divide-y divide-[#EEDFE3]">
        {trip.items.map((i) => (
          <li key={i.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
            <button type="button" disabled={!canEdit} aria-label={i.obtained ? "Mark not got" : "Mark as got"} onClick={() => patchItem.mutate({ id: i.id, body: { obtained: !i.obtained } })}
              className={`grid size-6 place-items-center rounded-md border ${i.obtained ? "border-[#650019] bg-[#650019] text-white" : "border-[#D2B9BF] bg-white"}`}>{i.obtained && <Check className="size-4" />}</button>
            <span className={`min-w-0 flex-1 text-sm ${i.obtained ? "text-stone-400 line-through" : "text-[#2F151B]"}`}>{i.description}</span>
            <span className="text-xs text-stone-500">plan {formatCurrency(i.plannedCost, currency)}</span>
            <input key={i.actualCost} type="number" min={0} step="0.01" disabled={!canEdit} defaultValue={i.actualCost || ""} placeholder="Spent" aria-label="Amount spent"
              onBlur={(e) => { const v = Number(e.target.value) || 0; if (v !== i.actualCost) patchItem.mutate({ id: i.id, body: { actualCost: v } }); }} className={`${field} h-8 w-24 text-right`} />
            {canEdit && <button type="button" aria-label="Remove item" onClick={() => delItem.mutate(i.id)} className="text-stone-400 hover:text-red-700"><Trash2 className="size-4" /></button>}
          </li>
        ))}
        {trip.items.length === 0 && <li className="px-4 py-4 text-sm text-stone-400">Nothing on the list yet.</li>}
      </ul>
      {canEdit && (
        <form className="flex flex-wrap gap-2 border-t border-[#EEDFE3] p-4" onSubmit={(e) => { e.preventDefault(); if (desc.trim()) addItem.mutate(); }}>
          <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="What to buy (e.g. 6 yards lace)" maxLength={200} className={`${field} min-w-0 flex-1`} />
          <input type="number" min={0} step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="Planned cost" className={`${field} w-32`} />
          <PremiumButton type="submit" size="md" disabled={addItem.isPending}><Plus className="size-4" /> Add</PremiumButton>
        </form>
      )}
    </SectionCard>
  );
}
