"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, RotateCcw, Save, ShieldCheck } from "lucide-react";
import { api, apiErrorMessage, apiGet } from "@/lib/api";

type Cell = { view: boolean; edit: boolean };
type Matrix = Record<string, Record<string, Cell>>;
interface Loaded {
  roles: { key: string; label: string }[];
  menus: { key: string; label: string; section: string }[];
  matrix: Matrix;
  defaults: Matrix;
}

const ghostBtn = "inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50";

export function RolesAdmin() {
  const [data, setData] = useState<Loaded | null>(null);
  const [matrix, setMatrix] = useState<Matrix>({});
  const [authorized, setAuthorized] = useState(false);
  const [checking, setChecking] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const apply = (d: Loaded) => { setData(d); setMatrix(d.matrix); };
  const load = useCallback(async () => {
    setError("");
    try { apply(await apiGet<Loaded>("/api/admin/role-access")); }
    catch (err) { setError(apiErrorMessage(err, "Could not load role access.")); }
  }, []);

  useEffect(() => { apiGet("/api/admin-auth/me").then(() => setAuthorized(true)).catch(() => setAuthorized(false)).finally(() => setChecking(false)); }, []);
  useEffect(() => { if (authorized) void load(); }, [authorized, load]);

  const dirty = useMemo(() => JSON.stringify(matrix) !== JSON.stringify(data?.matrix ?? {}), [matrix, data]);
  const sections = useMemo(() => {
    const order: string[] = [];
    for (const m of data?.menus ?? []) if (!order.includes(m.section)) order.push(m.section);
    return order.map((s) => ({ name: s, menus: (data?.menus ?? []).filter((m) => m.section === s) }));
  }, [data]);

  const setCell = (role: string, key: string, patch: Partial<Cell>) => {
    setSaved(false);
    setMatrix((m) => {
      const cur = m[role][key];
      const next = { ...cur, ...patch };
      if (!next.view) next.edit = false;
      return { ...m, [role]: { ...m[role], [key]: next } };
    });
  };

  async function save() {
    setSaving(true); setError(""); setSaved(false);
    try { apply(await api<Loaded>("/api/admin/role-access", { method: "PUT", body: JSON.stringify({ matrix }) })); setSaved(true); }
    catch (err) { setError(apiErrorMessage(err, "Could not save role access.")); }
    finally { setSaving(false); }
  }
  async function reset() {
    if (!window.confirm("Restore every role to its built-in access? Your changes will be lost.")) return;
    setSaving(true); setError(""); setSaved(false);
    try { apply(await api<Loaded>("/api/admin/role-access", { method: "DELETE" })); setSaved(true); }
    catch (err) { setError(apiErrorMessage(err, "Could not reset role access.")); }
    finally { setSaving(false); }
  }

  if (checking || (authorized && !data && !error)) return <main className="grid min-h-dvh place-items-center bg-[#FAF6F6]"><Loader2 className="size-6 animate-spin text-[#800020]" aria-label="Loading" /></main>;
  if (!authorized) return <main className="grid min-h-dvh place-items-center bg-[#FAF6F6] px-5"><section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 text-center shadow-sm"><ShieldCheck className="mx-auto size-8 text-[#800020]" /><h1 className="mt-4 text-xl font-semibold">Platform administrator sign-in required</h1><a className="mt-5 inline-flex h-10 items-center rounded-lg bg-[#800020] px-4 text-sm font-medium text-white" href="/admin">Open admin portal</a></section></main>;

  return (
    <main className="min-h-dvh bg-[#FAF6F6] px-4 py-8 text-slate-900 sm:px-8">
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm font-medium text-[#800020]">
          <a href="/admin" className="hover:underline">← Back to platform admin</a>
          <a href="/admin/experience" className="hover:underline">Turn pages on/off for everyone →</a>
        </div>
        <header>
          <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#85563A]">Platform</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Role access</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-500">Choose what each role in a studio can <strong>see</strong> in the menu and whether they can <strong>change</strong> things on each page. The studio owner always has full access. Contacts and Asset Register are owner-only until you tick them for another role.</p>
          <p className="mt-2 max-w-3xl text-xs text-slate-500">Unticking “See” hides the page and blocks its data. Some tools also have their own built-in rules that still apply, for example trainees only see Orders and Board when their trainer grants it to them.</p>
        </header>

        {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"><AlertCircle className="mr-2 inline size-4" />{error}</div>}
        {saved && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"><CheckCircle2 className="mr-2 inline size-4" />Saved. Changes apply within a few seconds.</div>}

        {data && (
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left">
                  <th scope="col" className="sticky left-0 z-10 bg-slate-50 px-4 py-3 font-semibold">Page</th>
                  <th scope="col" className="px-3 py-3 text-center font-semibold text-slate-500">Owner</th>
                  {data.roles.map((r) => <th key={r.key} scope="col" className="px-3 py-3 text-center font-semibold">{r.label}</th>)}
                </tr>
                <tr className="border-b border-slate-100 text-xs text-slate-500">
                  <th />
                  <th className="px-3 pb-2 text-center font-normal">always full</th>
                  {data.roles.map((r) => <th key={r.key} className="px-3 pb-2 text-center font-normal"><span className="inline-block w-14">See</span><span className="inline-block w-14">Change</span></th>)}
                </tr>
              </thead>
              <tbody>
                {sections.map((s) => (
                  <FragmentRows key={s.name} name={s.name} colSpan={data.roles.length + 2}>
                    {s.menus.map((m) => (
                      <tr key={m.key} className="border-t border-slate-100">
                        <th scope="row" className="sticky left-0 z-10 bg-white px-4 py-2.5 text-left font-medium">{m.label}</th>
                        <td className="px-3 py-2.5 text-center text-slate-400"><CheckCircle2 className="mx-auto size-4 text-emerald-600" aria-label="Owner has full access" /></td>
                        {data.roles.map((r) => {
                          const cell = matrix[r.key]?.[m.key] ?? { view: false, edit: false };
                          const changed = JSON.stringify(cell) !== JSON.stringify(data.defaults[r.key]?.[m.key]);
                          return (
                            <td key={r.key} className={`px-3 py-2.5 text-center ${changed ? "bg-amber-50/60" : ""}`}>
                              <label className="inline-block w-14"><input type="checkbox" aria-label={`${r.label} can see ${m.label}`} checked={cell.view} onChange={(e) => setCell(r.key, m.key, { view: e.target.checked })} className="size-4 accent-[#800020]" /></label>
                              <label className="inline-block w-14"><input type="checkbox" aria-label={`${r.label} can change ${m.label}`} checked={cell.edit} disabled={!cell.view} onChange={(e) => setCell(r.key, m.key, { edit: e.target.checked })} className="size-4 accent-[#800020] disabled:opacity-30" /></label>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </FragmentRows>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-[#FAF6F6]/95 px-4 py-4 backdrop-blur sm:-mx-8 sm:px-8">
          <div className="flex items-center gap-3">
            <button type="button" onClick={reset} disabled={saving} className={ghostBtn}><RotateCcw className="size-3.5" />Restore built-in access</button>
            {dirty && <button type="button" onClick={() => setMatrix(data?.matrix ?? {})} className={ghostBtn}>Discard changes</button>}
            <span className="hidden text-xs text-slate-500 sm:inline">Highlighted cells differ from the built-in access.</span>
          </div>
          <button type="button" onClick={save} disabled={saving || !dirty} className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#800020] px-5 text-sm font-medium text-white hover:bg-[#650019] disabled:opacity-60">
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}{saving ? "Saving…" : "Save role access"}
          </button>
        </div>
      </div>
    </main>
  );
}

function FragmentRows({ name, colSpan, children }: { name: string; colSpan: number; children: React.ReactNode }) {
  return <><tr className="bg-[#FBF6F7]"><th colSpan={colSpan} scope="colgroup" className="px-4 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[#85563A]">{name}</th></tr>{children}</>;
}
