"use client";
import {useEffect,useState} from "react";
type Invitation={id:string;role:string;status:string;studio_name:string;expires_at:string};
async function request(method:string,body?:object){
 const res=await fetch("/api/studio-invitations",{method,cache:"no-store",headers:{"Content-Type":"application/json"},...(body?{body:JSON.stringify(body)}:{})});
 const data=await res.json();
 if(!res.ok)throw new Error(data.error||"Invitation request failed");
 return data;
}
export function InviteExistingAccount(){
 const [email,setEmail]=useState("");
 const [role,setRole]=useState("staff");
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState("");
 return <section className="mb-6 rounded-lg border bg-white p-4 space-y-3">
 <h2 className="font-semibold">Invite an existing Sewsiness account</h2>
 <p className="text-sm text-muted-foreground">Use their existing email. No new password is required. Invitations do not grant studio access until membership activation is available.</p>
 <form className="flex flex-wrap items-end gap-3" onSubmit={async e=>{e.preventDefault();setBusy(true);setMessage("");try{await request("POST",{email,role});setMessage("Invitation recorded. The account holder can respond in their studio portal.");setEmail("");}catch(e){setMessage(e instanceof Error?e.message:"Unable to invite");}finally{setBusy(false);}}}>
 <label className="flex-1 min-w-[180px] text-sm">Email<input required type="email" maxLength={254} value={email} onChange={e=>setEmail(e.target.value)} className="block w-full border rounded-md p-2"/></label>
 <label className="text-sm">Role<select value={role} onChange={e=>setRole(e.target.value)} className="block border rounded-md p-2"><option value="staff">Staff</option><option value="trainer">Trainer</option><option value="trainee">Trainee</option></select></label>
 <button disabled={busy} className="rounded-md bg-[#702638] text-white px-4 py-2 min-h-11">{busy?"Sending…":"Invite existing user"}</button>
 </form><p role="status" className="text-sm">{message}</p></section>;
}
export function StudioInvitationInbox(){
 const [items,setItems]=useState<Invitation[]>([]);
 const [error,setError]=useState("");
 const [busy,setBusy]=useState(false);
 async function load(){try{setItems(await request("GET"));setError("");}catch{setError("Could not load studio invitations.");}}
 useEffect(()=>{void load();},[]);
 if(!items.length&&!error)return null;
 return <section className="mx-4 mt-4 rounded-lg border bg-white p-4 space-y-3"><h2 className="font-semibold">Studio invitations</h2>{error&&<p role="alert">{error} <button onClick={load} className="underline">Retry</button></p>}{items.map(i=><div key={i.id} className="border-t pt-3"><p className="font-medium">{i.studio_name} — {i.role}</p>{i.status==="pending"?<div className="flex gap-3">{["accept","decline"].map(action=><button key={action} disabled={busy} className="border rounded-md px-3 py-2 capitalize" onClick={async()=>{setBusy(true);try{await request("PATCH",{id:i.id,action});await load();}catch(e){setError(e instanceof Error?e.message:"Unable to respond");}finally{setBusy(false);}}}>{action}</button>)}</div>:<p className="text-sm">Accepted — awaiting membership activation. No additional studio access has been granted.</p>}</div>)}</section>;
}
