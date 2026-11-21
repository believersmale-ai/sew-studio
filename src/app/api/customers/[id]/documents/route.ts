import { getTenant } from "@/lib/db/session";
import { getPool } from "@/lib/db/pool";
type Ctx = { params: Promise<{ id: string }> };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const categories = new Set(["sketch", "invoice", "quotation", "fitting_photo", "other"]);
const types = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
const maxBytes = 8 * 1024 * 1024;

export async function GET(_req: Request, { params }: Ctx) {
 const ctx = await getTenant();
 if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });
 const { id } = await params;
 if (!UUID.test(id)) return Response.json({ error: "Not found" }, { status: 404 });
 const { rows } = await getPool().query(
   "select d.id,d.name,d.category,d.created_at,d.upload_id from public.customer_documents d join public.customers c on c.id=d.customer_id and c.shop_id=d.shop_id where d.shop_id=$1 and d.customer_id=$2 order by d.created_at desc limit 100",
   [ctx.shopId,id]);
 return Response.json(rows.map((r) => ({ id:r.id,name:r.name,category:r.category,createdAt:r.created_at,url:`/api/files/${r.upload_id}` })));
}
export async function POST(req: Request, { params }: Ctx) {
 const ctx = await getTenant();
 if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });
 if (ctx.role !== "madam" && ctx.role !== "staff") return Response.json({ error: "Not allowed" }, { status: 403 });
 const { id } = await params;
 if (!UUID.test(id)) return Response.json({ error: "Not found" }, { status: 404 });
 const form = await req.formData().catch(() => null);
 const file = form?.get("file");
 const category = String(form?.get("category") ?? "other");
 if (!(file instanceof File) || !types.has(file.type) || !file.size || file.size > maxBytes || !categories.has(category))
   return Response.json({ error: "Choose a PDF, JPG, PNG or WebP file up to 8 MB and a valid category." }, { status: 400 });
 const name = file.name.slice(0,180).replace(/[\\/\x00-\x1f]/g,"").trim();
 if (!name) return Response.json({ error: "Invalid filename" }, { status: 400 });
 const pool = getPool();
 const client = await pool.connect();
 try {
   await client.query("begin");
   const customer = await client.query("select id from public.customers where id=$1 and shop_id=$2", [id,ctx.shopId]);
   if (!customer.rowCount) { await client.query("rollback"); return Response.json({ error:"Customer not found" },{status:404}); }
   const bytes = Buffer.from(await file.arrayBuffer());
   const uploaded = await client.query("insert into public.uploads(shop_id,kind,content_type,bytes) values($1,'general',$2,$3) returning id", [ctx.shopId,file.type,bytes]);
   const saved = await client.query("insert into public.customer_documents(shop_id,customer_id,upload_id,name,category) values($1,$2,$3,$4,$5) returning id,created_at", [ctx.shopId,id,uploaded.rows[0].id,name,category]);
   await client.query("commit");
   return Response.json({id:saved.rows[0].id,name,category,createdAt:saved.rows[0].created_at,url:`/api/files/${uploaded.rows[0].id}`},{status:201});
 } catch { await client.query("rollback"); return Response.json({error:"Unable to save document"},{status:500}); }
 finally { client.release(); }
}
