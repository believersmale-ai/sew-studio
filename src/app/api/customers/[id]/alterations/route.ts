import { getTenant } from "@/lib/db/session";
import { getPool } from "@/lib/db/pool";
type Ctx = { params: Promise<{ id: string }> };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const statuses = new Set(["Requested","Assigned","In Progress","Ready","Completed","Cancelled"]);
async function tenantCustomer(id: string, shopId: string) {
 const { rows } = await getPool().query("select id from public.customers where id=$1 and shop_id=$2",[id,shopId]);
 return rows.length > 0;
}
export async function GET(_req: Request,{params}:Ctx) {
 const ctx=await getTenant(); if(!ctx) return Response.json({error:"Unauthorized"},{status:401});
 const {id}=await params; if(!uuid.test(id)||!await tenantCustomer(id,ctx.shopId)) return Response.json({error:"Customer not found"},{status:404});
 const {rows}=await getPool().query(
 "select a.id,a.order_id,a.description,a.status,a.assigned_to,a.due_date,a.completed_at,a.created_at,o.garment_design from public.customer_alterations a join public.orders o on o.id=a.order_id and o.shop_id=a.shop_id and o.customer_id=a.customer_id where a.shop_id=$1 and a.customer_id=$2 order by a.created_at desc limit 100",[ctx.shopId,id]);
 return Response.json(rows.map(r=>({id:r.id,orderId:r.order_id,garment:r.garment_design,description:r.description,status:r.status,assignedTo:r.assigned_to,dueDate:r.due_date,completedAt:r.completed_at,createdAt:r.created_at})));
}
export async function POST(req:Request,{params}:Ctx) {
 const ctx=await getTenant(); if(!ctx) return Response.json({error:"Unauthorized"},{status:401});
 if(!["madam","staff"].includes(ctx.role)) return Response.json({error:"Not allowed"},{status:403});
 const {id}=await params; if(!uuid.test(id)||!await tenantCustomer(id,ctx.shopId)) return Response.json({error:"Customer not found"},{status:404});
 const body=await req.json().catch(()=>({}));
 const orderId=String(body.orderId||""); const description=typeof body.description==="string"?body.description.trim():"";
 const dueDate=body.dueDate?String(body.dueDate):null;
 if(!uuid.test(orderId)||!description||description.length>2000||(dueDate&&!/^\d{4}-\d{2}-\d{2}$/.test(dueDate))) return Response.json({error:"Invalid alteration details"},{status:400});
 const pool=getPool();
 const {rows}=await pool.query("insert into public.customer_alterations(shop_id,customer_id,order_id,description,due_date) select $1,$2,o.id,$4,$5 from public.orders o where o.id=$3 and o.shop_id=$1 and o.customer_id=$2 returning id",[ctx.shopId,id,orderId,description,dueDate]);
 if(!rows.length) return Response.json({error:"Order not found"},{status:404});
 return Response.json({id:rows[0].id},{status:201});
}
export async function PATCH(req:Request,{params}:Ctx) {
 const ctx=await getTenant(); if(!ctx) return Response.json({error:"Unauthorized"},{status:401});
 if(!["madam","staff"].includes(ctx.role)) return Response.json({error:"Not allowed"},{status:403});
 const {id}=await params; if(!uuid.test(id)) return Response.json({error:"Customer not found"},{status:404});
 const body=await req.json().catch(()=>({}));
 if(!uuid.test(String(body.id||""))||!statuses.has(body.status)) return Response.json({error:"Invalid alteration status"},{status:400});
 const assignedTo=body.assignedTo===null?null:body.assignedTo;
 if(assignedTo!==undefined && assignedTo!==null && !uuid.test(String(assignedTo))) return Response.json({error:"Invalid assignee"},{status:400});
 const pool=getPool();
 if(assignedTo) {
  const {rows: members}=await pool.query("select 1 from public.studio_memberships where shop_id=$1 and user_id=$2 and status='active' limit 1",[ctx.shopId,assignedTo]);
  if(!members.length) return Response.json({error:"Assignee is not an active studio member"},{status:400});
 }
 const {rows}=await pool.query(
 "update public.customer_alterations set status=$4, assigned_to=coalesce($5,assigned_to), completed_at=case when $4='Completed' then coalesce(completed_at,now()) else null end, updated_at=now() where id=$1 and shop_id=$2 and customer_id=$3 returning id,status",
 [body.id,ctx.shopId,id,body.status,assignedTo??null]);
 if(!rows.length) return Response.json({error:"Alteration not found"},{status:404});
 return Response.json(rows[0]);
}
