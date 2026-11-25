"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Mail, ShieldCheck, Loader2 } from "lucide-react";
export default function AdminForgotPassword() {
  const [email,setEmail]=useState("");
  const [sent,setSent]=useState(false);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  async function submit(e:React.FormEvent<HTMLFormElement>) {
    e.preventDefault();setLoading(true);setError("");
    try {
      const res=await fetch("/api/admin-auth/forgot-password",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email})});
      if(!res.ok)throw new Error();
      setSent(true);
    } catch {setError("We could not process the request. Please try again.");}
    finally {setLoading(false);}
  }
  return <main className="flex min-h-dvh items-center justify-center bg-[#FCF9F8] px-5 py-10">
    <section className="w-full max-w-[440px] rounded-2xl border border-[#EBDDE1] bg-white p-7 shadow-xl shadow-[#570D29]/5 sm:p-10">
      <span className="mb-7 grid size-12 place-items-center rounded-xl bg-[#650D2C] text-[#E9C68D]"><ShieldCheck className="size-6"/></span>
      <p className="text-xs font-semibold uppercase tracking-[.2em] text-[#946C49]">Sewsiness · Platform operations</p>
      <h1 className="mt-3 font-display text-3xl font-semibold text-[#351322]">Forgot your password?</h1>
      <p className="mt-3 text-sm leading-6 text-slate-600">Enter your administrator email address. If an account matches, we'll email you a secure reset link valid for 30 minutes.</p>
      {sent ? <p role="status" className="mt-7 rounded-xl border border-[#EBDDE1] bg-[#FBF5F7] p-4 text-sm leading-6 text-[#57253B]">If an administrator account matches this email, a recovery link will be sent. Check your inbox and spam folder.</p> :
      <form onSubmit={submit} className="mt-7 space-y-4">
        <label htmlFor="admin-recovery-email" className="block text-sm font-semibold text-[#493A40]">Administrator email</label>
        <div className="relative"><Mail className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-400"/><input id="admin-recovery-email" required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="admin@sewsiness.com" className="h-12 w-full rounded-xl border border-[#E6DCE0] pl-11 pr-4 text-sm outline-none focus:border-[#800020] focus:ring-4 focus:ring-[#800020]/10"/></div>
        {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
        <button disabled={loading} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#720D31] text-sm font-semibold text-white hover:bg-[#570D29] disabled:opacity-60">{loading&&<Loader2 className="size-4 animate-spin"/>}{loading?"Sending…":"Send recovery link"}</button>
      </form>}
      <Link href="/admin" className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-[#720D31] hover:underline"><ArrowLeft className="size-4"/>Back to admin sign in</Link>
    </section>
  </main>;
}
