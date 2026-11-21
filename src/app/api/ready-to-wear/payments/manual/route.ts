import { getPool } from "@/lib/db/pool";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function POST(req:Request){
 const b=await req.json().catch(()=>({}));
 const id=String(b.orderId??""),phone=String(b.phone??"").trim(),channel=String(b.channel??""),reference=String(b.reference??"").trim(),note=String(b.note??"").trim();
 if(!uuid.test(id)||phone.length<7||phone.length>30||!["Mobile Money","Bank transfer"].includes(channel)||reference.length>120||note.length>500||reference.length<4)return Response.json({error:"Invalid payment information"},{status:400});
 const {rowCount}=await getPool().query("update public.rtw_orders set manual_payment_channel=$3,manual_payment_reference=$4,manual_payment_note=$5,manual_payment_submitted_at=now(),payment_status='Pending verification',updated_at=now() where id=$1 and customer_phone=$2 and payment_method='manual' and status='Pending payment' and payment_status in ('Unpaid','Pending verification')",[id,phone,channel,reference||null,note||null]);
 if(!rowCount)return Response.json({error:"Order could not be updated. Check the order number and phone."},{status:409});
 return Response.json({received:true,message:"Payment details submitted. The studio will verify receipt before preparing your order."});
}
