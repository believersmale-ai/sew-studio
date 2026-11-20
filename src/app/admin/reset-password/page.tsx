"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ShieldCheck, Loader2, ArrowLeft } from "lucide-react";
function ResetForm(){
  const params=useSearchParams();
  const token=params.get("token")||"";
  const [password,setPassword]=useState("");
  const [confirm,setConfirm]=useState("");
  const [loading,setLoading]=useState(false);
  const [done,setDone]=useState(false);
  const [error,setError]=useState("");
  async function submit(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault();setError("");
    if(password!==confirm){setError("Passwords do not match.");return;}
    if(password.length<12){setError("Use at least 12 characters.");return;}
    setLoading(true);
    try{
      const res=await fetch("/api/admin-auth/reset-password",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token,password})});
      const data=await res.json().catch(()=>({}));
      if(!res.ok)throw new Error(data.error||"Could not reset password.");
      setPassword("");setConfirm("");setDone(true);
    }catch(e){setError(e instanceof Error?e.message:"Could not reset password.");}
    finally{setLoading(false);}
  }
  return <section className="w-full max-w-[440px] rounded-2xl border border-[#EBDDE1] bg-white p-7 shadow-xl shadow-[#570D29]/5 sm:p-10">
    <span className="mb-7 grid size-12 place-items-center rounded-xl bg-[#650D2C] text-[#E9C68D]"><ShieldCheck className="size-6"/></span>
    <p className="text-xs font-semibold uppercase tracking-[.2em] text-[#946C49]">Sewsiness · Platform operations</p>
    <h1 className="mt-3 font-display text-3xl font-semibold text-[#351322]">Set a new password</h1>
    {done?<p role="status" className="mt-6 text-sm leading-6 text-[#57253B]">Your administrator password has been updated. You can now sign in.</p>:
    !token?<p role="alert" className="mt-6 text-sm text-red-700">This reset link is missing or invalid. Request a new one.</p>:
    <form onSubmit={submit} className="mt-7 space-y-4">
      <label className="block text-sm font-semibold text-[#493A40]">New password<input type="password" required minLength={12} autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} className="mt-2 h-12 w-full rounded-xl border border-[#E6DCE0] px-4 outline-none focus:border-[#800020] focus:ring-4 focus:ring-[#800020]/10"/></label>
      <label className="block text-sm font-semibold text-[#493A40]">Confirm new password<input type="password" required minLength={12} autoComplete="new-password" value={confirm} onChange={e=>setConfirm(e.target.value)} className="mt-2 h-12 w-full rounded-xl border border-[#E6DCE0] px-4 outline-none focus:border-[#800020] focus:ring-4 focus:ring-[#800020]/10"/></label>
      {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
      <button disabled={loading} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#720D31] text-sm font-semibold text-white hover:bg-[#570D29] disabled:opacity-60">{loading&&<Loader2 className="size-4 animate-spin"/>}{loading?"Updating…":"Update password"}</button>
    </form>}
    <Link href={done?"/admin":"/admin/forgot-password"} className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-[#720D31] hover:underline"><ArrowLeft className="size-4"/>{done?"Back to admin sign in":"Request a new link"}</Link>
  </section>;
}
export default function AdminResetPassword(){return <main className="flex min-h-dvh items-center justify-center bg-[#FCF9F8] px-5 py-10"><Suspense fallback={<p>Loading recovery form…</p>}><ResetForm/></Suspense></main>;}
