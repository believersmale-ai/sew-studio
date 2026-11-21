import { enforceShopRateLimit } from "@/lib/ready-to-wear-rate-limit";
import { getPool } from "@/lib/db/pool";
import { paymentConfiguration, paystackRequest } from "@/lib/ready-to-wear-paystack";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function POST(req:Request){
 const body=await req.json().catch(()=>({})),id=String(body.orderId??"");
 if(!uuid.test(id))return Response.json({error:"Invalid order"},{status:400});
 if(!(await paymentConfiguration()).enabled)return Response.json({error:"Online payments are not enabled"},{status:503});
 const phone=String(body.phone??"").trim();
 if(phone.length<7||phone.length>30)return Response.json({error:"Order phone is required"},{status:400});
 const limited=await enforceShopRateLimit(req,{scope:"paystack-init:"+id,max:8,seconds:3600,identity:phone});if(limited)return limited;
 const pool=getPool();
 const {rows}=await pool.query("select id,customer_email,total,payment_reference,payment_status from public.rtw_orders where id=$1 and customer_phone=$2 and payment_method='paystack' and status='Pending payment'",[id,phone]);
 if(!rows.length)return Response.json({error:"Order is not awaiting payment"},{status:404});
 const order=rows[0];
 if(!order.customer_email)return Response.json({error:"An email address is required to pay online"},{status:400});
 const reference=order.payment_reference||`rtw_${id}`;
 const origin=process.env.NEXT_PUBLIC_APP_URL;
 if(!origin||!/^https:\/\//.test(origin))return Response.json({error:"Secure payment callback URL not configured"},{status:503});
 try{
  const amount=Math.round(Number(order.total)*100);
  if(!Number.isSafeInteger(amount)||amount<100)return Response.json({error:"Invalid payment amount"},{status:400});
  const {rowCount}=await pool.query("update public.rtw_orders set payment_reference=$2,payment_status='Pending verification',updated_at=now() where id=$1 and payment_status in ('Unpaid','Pending verification')",[id,reference]);
  if(!rowCount)return Response.json({error:"Order cannot be paid"},{status:409});
  const data=await paystackRequest("/transaction/initialize",{method:"POST",body:JSON.stringify({email:order.customer_email,amount,currency:"GHS",reference,callback_url:`${origin.replace(/\/$/,"")}/ready-to-wear/payment?reference=${encodeURIComponent(reference)}`,metadata:{rtw_order_id:id}})});
  if(typeof data.authorization_url!=="string"||!data.authorization_url.startsWith("https://checkout.paystack.com/"))throw Error("Invalid payment URL");
  return Response.json({authorizationUrl:data.authorization_url});
 }catch{return Response.json({error:"Unable to initialize secure payment. Please try again."},{status:502})}
}
