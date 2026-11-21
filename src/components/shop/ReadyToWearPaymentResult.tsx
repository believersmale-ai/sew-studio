"use client";
import { useEffect,useState } from "react";
import { useSearchParams } from "next/navigation";
export default function PaymentResult(){
 const params=useSearchParams(),reference=params.get("reference"),[state,setState]=useState("Verifying your payment securely…"),[verified,setVerified]=useState(false);
 useEffect(()=>{if(!reference){setState("Missing payment reference. Contact the seller.");return;}fetch("/api/ready-to-wear/payments/verify",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({reference})}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error||"Verification failed");if(d.verified){setVerified(true);setState(`Payment confirmed. Your order number is ${d.orderId}. The seller will prepare your delivery.`)}else setState("Payment is not yet confirmed. If you were charged, please contact the seller with your reference.")}).catch(()=>setState("We could not verify the payment right now. Please do not pay again until the seller checks the transaction."))},[reference]);
 return <main className="grid min-h-screen place-items-center bg-[#faf5f5] p-4"><section className="w-full max-w-lg rounded-2xl border border-[#eedfe3] bg-white p-8 text-center"><h1 className="font-serif text-3xl text-[#800020]">{verified?"Payment confirmed":"Payment status"}</h1><p role="status" className="mt-5 text-stone-700">{state}</p>{reference&&<p className="mt-4 break-all text-xs text-stone-500">Reference: {reference}</p>}</section></main>
}
