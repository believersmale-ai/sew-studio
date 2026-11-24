import { enforceShopRateLimit } from "@/lib/ready-to-wear-rate-limit";
import { reconcilePayment } from "@/lib/ready-to-wear-paystack";
export async function POST(req:Request){
 const b=await req.json().catch(()=>({})),reference=String(b?.reference??"");
 if(!/^rtw_[0-9a-f-]{36}$/.test(reference))return Response.json({error:"Invalid reference"},{status:400});
 const limited=await enforceShopRateLimit(req,{scope:"paystack-verify",max:20,seconds:300,identity:reference});if(limited)return limited;
 try{return Response.json(await reconcilePayment(reference))}catch{return Response.json({error:"Payment verification unavailable. Please check again later."},{status:503})}
}
