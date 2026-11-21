import { getPool } from "@/lib/db/pool";
import { createHmac, timingSafeEqual } from "node:crypto";
import { getSettings } from "@/lib/integration-settings";

export async function paymentConfiguration() {
 const settings = await getSettings(["paystack_secret_key","paystack_enabled"] as const);
 return { enabled: settings.paystack_enabled === "true" && /^sk_(test|live)_/.test(settings.paystack_secret_key), key: settings.paystack_secret_key };
}


export async function paystackSecret() {
 const config=await paymentConfiguration();
 const key=config.key;
 if(!key)throw new Error("PAYSTACK_SECRET_KEY is not configured");
 return key;
}
export async function paystackRequest(path:string, options?:RequestInit){
 const response=await fetch(`https://api.paystack.co${path}`,{
  ...options,headers:{Authorization:`Bearer ${await paystackSecret()}`,"Content-Type":"application/json",...(options?.headers||{})},cache:"no-store"
 });
 const result=await response.json().catch(()=>({}));
 if(!response.ok||result.status!==true)throw new Error("Payment provider request failed");
 return result.data;
}
export async function verifyPaystackSignature(body:string,signature:string|null){
 if(!signature||!/^[a-f0-9]{64}$/i.test(signature))return false;
 const expected=createHmac("sha512",await paystackSecret()).update(body).digest();
 const supplied=Buffer.from(signature,"hex");
 return supplied.length===expected.length&&timingSafeEqual(expected,supplied);
}
export async function reconcilePayment(reference:string){
 if(!/^rtw_[0-9a-f-]{36}$/.test(reference))return {verified:false};
 const transaction=await paystackRequest(`/transaction/verify/${encodeURIComponent(reference)}`);
 if(transaction.reference!==reference||transaction.status!=="success"||transaction.currency!=="GHS")return {verified:false};
 const client=await getPool().connect();
 try{
  await client.query("BEGIN");
  const {rows}=await client.query("select id,total,payment_status,status from public.rtw_orders where payment_reference=$1 for update",[reference]);
  if(!rows.length){await client.query("ROLLBACK");return {verified:false};}
  const order=rows[0],expected=Math.round(Number(order.total)*100);
  if(!Number.isSafeInteger(expected)||transaction.amount!==expected){await client.query("ROLLBACK");return {verified:false};}
  if(order.payment_status==="Paid"){await client.query("COMMIT");return {verified:true,orderId:order.id};}
  if(order.status==="Cancelled"){await client.query("ROLLBACK");return {verified:false};}
  await client.query("update public.rtw_orders set payment_status='Paid',status='Paid',paid_at=now(),updated_at=now() where id=$1",[order.id]);
  await client.query("COMMIT");
  return {verified:true,orderId:order.id};
 }catch(e){await client.query("ROLLBACK");throw e}finally{client.release()}
}
