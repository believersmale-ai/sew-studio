"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Copy, KeyRound, Loader2, Plus, ShieldCheck, UserCheck, UserX } from "lucide-react";
import { api, apiErrorMessage, apiGet } from "@/lib/api";
import { ADMIN_AREAS } from "@/lib/admin-access";

interface Me { id: string; email: string; fullName: string; isSuper: boolean }
interface AdminRow { id: string; email: string; fullName: string; isSuper: boolean; areas: string[]; disabledAt: string | null; createdAt: string }

const input = "mt-1.5 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-[#800020] focus:ring-4 focus:ring-[#800020]/10";
const card = "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7";
const ghostBtn = "inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50";

function AreaPicker({ value, onChange, disabled }: { value: string[]; onChange: (v: string[]) => void; disabled?: boolean }) {
  return (
    <fieldset disabled={disabled} className="grid gap-2 sm:grid-cols-2">
      <legend className="sr-only">Areas this admin can manage</legend>
      {ADMIN_AREAS.map((a) => (
        <label key={a.key} className="flex items-start gap-2.5 rounded-lg border border-slate-200 p-2.5 text-sm has-[:checked]:border-[#800020]/40 has-[:checked]:bg-[#FBF1F3]">
          <input type="checkbox" className="mt-0.5 size-4 accent-[#800020]" checked={value.includes(a.key)} onChange={(e) => onChange(e.target.checked ? [...value, a.key] : value.filter((k) => k !== a.key))} />
          <span><span className="block font-medium text-slate-900">{a.label}</span><span className="block text-xs text-slate-500">{a.hint}</span></span>
        </label>
      ))}
    </fieldset>
  );
}

function PasswordNotice({ email, password, onClose }: { email: string; password: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      <p className="font-semibold">One-time password for {email}</p>
      <p className="mt-1">Copy it now and send it to them privately. It will not be shown again. They should change it after signing in (on this page).</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <code className="rounded bg-white px-3 py-2 font-mono text-base tracking-wide">{password}</code>
        <button type="button" className={ghostBtn} onClick={async () => { try { await navigator.clipboard.writeText(password); setCopied(true); } catch { /* clipboard unavailable */ } }}><Copy className="size-3.5" />{copied ? "Copied" : "Copy"}</button>
        <button type="button" className={ghostBtn} onClick={onClose}>Done</button>
      </div>
    </div>
  );
}

export function TeamAdmin() {
  const [me, setMe] = useState<Me | null>(null);
  const [checking, setChecking] = useState(true);
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string[]>>({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [secret, setSecret] = useState<{ email: string; password: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [form, setForm] = useState({ fullName: "", email: "", areas: [] as string[] });

  const load = useCallback(async () => {
    try {
      const d = await apiGet<{ admins: AdminRow[] }>("/api/admin/admins");
      setAdmins(d.admins); setDrafts({});
    } catch (err) { setError(apiErrorMessage(err, "Could not load the admin team.")); }
  }, []);

  useEffect(() => { apiGet<Me>("/api/admin-auth/me").then(setMe).catch(() => setMe(null)).finally(() => setChecking(false)); }, []);
  useEffect(() => { if (me?.isSuper) void load(); }, [me, load]);

  async function act(key: string, fn: () => Promise<void>) {
    setBusy(key); setError(""); setNotice("");
    try { await fn(); } catch (err) { setError(apiErrorMessage(err, "That did not work. Please try again.")); } finally { setBusy(null); }
  }

  if (checking) return <main className="grid min-h-dvh place-items-center bg-[#FAF6F6]"><Loader2 className="size-6 animate-spin text-[#800020]" aria-label="Loading" /></main>;
  if (!me) return <main className="grid min-h-dvh place-items-center bg-[#FAF6F6] px-5"><section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 text-center shadow-sm"><ShieldCheck className="mx-auto size-8 text-[#800020]" /><h1 className="mt-4 text-xl font-semibold">Platform administrator sign-in required</h1><a className="mt-5 inline-flex h-10 items-center rounded-lg bg-[#800020] px-4 text-sm font-medium text-white" href="/admin">Open admin portal</a></section></main>;

  return (
    <main className="min-h-dvh bg-[#FAF6F6] px-4 py-8 text-slate-900 sm:px-8">
      <div className="mx-auto max-w-4xl space-y-5">
        <a href="/admin" className="text-sm font-medium text-[#800020] hover:underline">← Back to platform admin</a>
        <header>
          <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#85563A]">Platform</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Admin team</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">{me.isSuper ? "Add people to help run the platform and choose exactly which areas each person can manage. You keep full access to everything." : "You can change your own password here. The main administrator decides which areas you can manage."}</p>
        </header>

        {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"><AlertCircle className="mr-2 inline size-4" />{error}</div>}
        {notice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"><CheckCircle2 className="mr-2 inline size-4" />{notice}</div>}
        {secret && <PasswordNotice email={secret.email} password={secret.password} onClose={() => setSecret(null)} />}

        {me.isSuper && (
          <>
            <section className={card}>
              <h2 className="text-lg font-semibold">Add an admin</h2>
              <form className="mt-4 space-y-4" onSubmit={(e) => { e.preventDefault(); void act("create", async () => {
                const r = await api<{ email: string; temporaryPassword: string }>("/api/admin/admins", { method: "POST", body: JSON.stringify(form) });
                setSecret({ email: r.email, password: r.temporaryPassword }); setForm({ fullName: "", email: "", areas: [] }); await load();
              }); }}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-sm font-medium text-slate-700">Name<input required maxLength={120} className={input} value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></label>
                  <label className="block text-sm font-medium text-slate-700">Email<input required type="email" maxLength={200} className={input} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
                </div>
                <div><p className="mb-2 text-sm font-medium text-slate-700">They can manage</p><AreaPicker value={form.areas} onChange={(areas) => setForm({ ...form, areas })} /></div>
                <button disabled={busy === "create"} className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#800020] px-5 text-sm font-medium text-white hover:bg-[#650019] disabled:opacity-60">{busy === "create" ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}Create admin</button>
                <p className="text-xs text-slate-500">They sign in at <strong>/admin</strong> with a one-time password you pass on. They only see the areas you tick.</p>
              </form>
            </section>

            <section className="space-y-3" aria-label="Admins">
              {admins.map((a) => {
                const areas = drafts[a.id] ?? a.areas;
                const dirty = drafts[a.id] !== undefined && JSON.stringify([...drafts[a.id]].sort()) !== JSON.stringify([...a.areas].sort());
                return (
                  <article key={a.id} className={`${card} ${a.disabledAt ? "opacity-70" : ""}`}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div><h3 className="font-semibold">{a.fullName}</h3><p className="text-sm text-slate-500">{a.email}</p></div>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${a.isSuper ? "bg-[#800020]/10 text-[#800020]" : a.disabledAt ? "bg-slate-100 text-slate-600" : "bg-emerald-50 text-emerald-700"}`}>{a.isSuper ? "Main administrator: full access" : a.disabledAt ? "Disabled" : "Active"}</span>
                    </div>
                    {!a.isSuper && (
                      <>
                        <div className="mt-4"><AreaPicker value={areas} disabled={Boolean(a.disabledAt)} onChange={(v) => setDrafts({ ...drafts, [a.id]: v })} /></div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <button type="button" disabled={!dirty || busy === a.id} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#800020] px-3 text-xs font-medium text-white hover:bg-[#650019] disabled:opacity-50"
                            onClick={() => void act(a.id, async () => { await api(`/api/admin/admins/${a.id}`, { method: "PATCH", body: JSON.stringify({ areas }) }); setNotice(`Saved access for ${a.fullName}.`); await load(); })}>Save access</button>
                          <button type="button" disabled={busy === a.id} className={ghostBtn}
                            onClick={() => { if (window.confirm(`Reset the password for ${a.fullName}? They will be signed out.`)) void act(a.id, async () => { const r = await api<{ temporaryPassword?: string }>(`/api/admin/admins/${a.id}`, { method: "PATCH", body: JSON.stringify({ resetPassword: true }) }); if (r.temporaryPassword) setSecret({ email: a.email, password: r.temporaryPassword }); }); }}><KeyRound className="size-3.5" />Reset password</button>
                          <button type="button" disabled={busy === a.id} className={ghostBtn}
                            onClick={() => { const off = !a.disabledAt; if (!off || window.confirm(`Disable ${a.fullName}? They will be signed out and cannot sign in until you enable them again.`)) void act(a.id, async () => { await api(`/api/admin/admins/${a.id}`, { method: "PATCH", body: JSON.stringify({ disabled: off }) }); setNotice(off ? `${a.fullName} is disabled.` : `${a.fullName} can sign in again.`); await load(); }); }}>
                            {a.disabledAt ? <><UserCheck className="size-3.5" />Enable</> : <><UserX className="size-3.5" />Disable</>}</button>
                        </div>
                      </>
                    )}
                  </article>
                );
              })}
            </section>
          </>
        )}

        <ChangePassword />
      </div>
    </main>
  );
}

function ChangePassword() {
  const [f, setF] = useState({ current: "", next: "" });
  const [state, setState] = useState<{ ok: boolean; msg: string } | null>(null);
  const [saving, setSaving] = useState(false);
  return (
    <section className={card}>
      <h2 className="text-lg font-semibold">Change my password</h2>
      <form className="mt-4 grid gap-4 sm:grid-cols-2" onSubmit={async (e) => {
        e.preventDefault(); setSaving(true); setState(null);
        try { await api("/api/admin-auth/change-password", { method: "POST", body: JSON.stringify(f) }); setF({ current: "", next: "" }); setState({ ok: true, msg: "Password changed." }); }
        catch (err) { setState({ ok: false, msg: apiErrorMessage(err, "Could not change the password.") }); } finally { setSaving(false); }
      }}>
        <label className="block text-sm font-medium text-slate-700">Current password<input required type="password" autoComplete="current-password" className={input} value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} /></label>
        <label className="block text-sm font-medium text-slate-700">New password (8+ characters)<input required minLength={8} type="password" autoComplete="new-password" className={input} value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} /></label>
        <div className="flex items-center gap-3 sm:col-span-2">
          <button disabled={saving} className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#800020] px-4 text-sm font-medium text-white hover:bg-[#650019] disabled:opacity-60">{saving && <Loader2 className="size-4 animate-spin" />}Change password</button>
          {state && <span role="status" className={`text-sm ${state.ok ? "text-emerald-700" : "text-red-700"}`}>{state.msg}</span>}
        </div>
      </form>
    </section>
  );
}
