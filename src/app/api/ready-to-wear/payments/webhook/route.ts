import { verifyPaystackSignature, reconcilePayment } from "@/lib/ready-to-wear-paystack";
export async function POST(req:Request){
 const body=await req.text();
 try{
  if(!await verifyPaystackSignature(body,req.headers.get("x-paystack-signature")))return Response.json({error:"Invalid signature"},{status:401});
  const event=JSON.parse(body);
  if(event.event==="charge.success"&&typeof event.data?.reference==="string")await reconcilePayment(event.data.reference);
  return Response.json({received:true});
 }catch(e){console.error("[rtw] Paystack webhook reconciliation failed",e);return Response.json({error:"Webhook processing failed"},{status:500})}
}
