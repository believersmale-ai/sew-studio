import { createHmac } from "node:crypto";
import { getPool } from "@/lib/db/pool";
type Limit = { scope:string; max:number; seconds:number; identity?:string };
export async function enforceShopRateLimit(req:Request, limit:Limit):Promise<Response|null>{
 // Do not trust forwarded-for headers: this is an application-level limiter keyed by
 // stable order identifiers or a keyed IP fingerprint supplied by the trusted proxy.
 const fingerprint=limit.identity?.trim();
 if(!fingerprint)return Response.json({error:"Request identity required"},{status:400});
 const secret=process.env.RTW_RATE_LIMIT_SECRET||process.env.SETTINGS_ENCRYPTION_KEY;
 if(!secret) return Response.json({error:"Checkout protection is not configured"},{status:503});
 const bucket=createHmac("sha256",secret).update(limit.scope+"|"+fingerprint).digest("hex");
 try{
  const {rows}=await getPool().query(
   `insert into public.rtw_request_limits(bucket,count,expires_at)
    values($1,1,now()+($2::integer*interval '1 second'))
    on conflict(bucket) do update set
      count=case when rtw_request_limits.expires_at<=now() then 1 else rtw_request_limits.count+1 end,
      expires_at=case when rtw_request_limits.expires_at<=now() then now()+($2::integer*interval '1 second') else rtw_request_limits.expires_at end
    returning count,expires_at`,[bucket,limit.seconds]);
  if(rows[0].count>limit.max)return Response.json({error:"Too many requests. Try again later."},{status:429,headers:{"Retry-After":String(limit.seconds)}});
  return null;
 }catch(e){console.error("[rtw] rate limiter unavailable",e);return Response.json({error:"Checkout temporarily unavailable"},{status:503})}
}
