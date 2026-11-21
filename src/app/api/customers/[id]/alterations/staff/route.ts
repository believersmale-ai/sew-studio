import { getTenant } from "@/lib/db/session";
import { getPool } from "@/lib/db/pool";
export async function GET() {
 const ctx = await getTenant();
 if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });
 const { rows } = await getPool().query(
  "select m.user_id as id, p.full_name as name from public.studio_memberships m join public.profiles p on p.id=m.user_id where m.shop_id=$1 and m.status='active' order by p.full_name",
  [ctx.shopId]);
 return Response.json(rows);
}
