import { NextResponse } from "next/server";
import { hash } from "@node-rs/argon2";
import { getSystemAdminSession } from "@/lib/db/session";
import { getPool } from "@/lib/db/pool";
import { audit, cleanAreas, generateTempPassword } from "@/lib/admin-team";

export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Body: { fullName?, areas?, disabled?, resetPassword? }. Main administrators cannot be changed here. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSystemAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.isSuper) return NextResponse.json({ error: "Only the main administrator can manage admins." }, { status: 403 });
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const b = (await request.json().catch(() => null)) as { fullName?: unknown; areas?: unknown; disabled?: unknown; resetPassword?: unknown } | null;
  if (!b) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const pool = getPool();
  const target = (await pool.query("select id, email, is_super from public.system_admins where id = $1", [id])).rows[0] as { id: string; email: string; is_super: boolean } | undefined;
  if (!target) return NextResponse.json({ error: "Admin not found." }, { status: 404 });
  if (target.is_super) return NextResponse.json({ error: "A main administrator can only be changed from the server." }, { status: 403 });

  const client = await pool.connect();
  let temporaryPassword: string | undefined;
  try {
    await client.query("begin");
    if (typeof b.fullName === "string") {
      const name = b.fullName.trim().slice(0, 120);
      if (!name) { await client.query("rollback"); return NextResponse.json({ error: "Enter the person's name." }, { status: 400 }); }
      await client.query("update public.system_admins set full_name = $2 where id = $1", [id, name]);
    }
    if (b.areas !== undefined) {
      await client.query("update public.system_admins set areas = $2 where id = $1", [id, cleanAreas(b.areas)]);
    }
    if (typeof b.disabled === "boolean") {
      await client.query("update public.system_admins set disabled_at = $2 where id = $1", [id, b.disabled ? new Date().toISOString() : null]);
      await client.query("update auth.users set banned_until = $2 where id = $1", [id, b.disabled ? "infinity" : null]);
      if (b.disabled) await client.query("delete from private.sessions where user_id = $1", [id]);
    }
    if (b.resetPassword === true) {
      temporaryPassword = generateTempPassword();
      await client.query(
        `insert into private.credentials (user_id, password_hash) values ($1, $2)
           on conflict (user_id) do update set password_hash = excluded.password_hash, updated_at = now()`,
        [id, await hash(temporaryPassword)]
      );
      await client.query("delete from private.sessions where user_id = $1", [id]);
    }
    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => {});
    console.error("[admin/admins] update failed", error);
    return NextResponse.json({ error: "Could not update the admin." }, { status: 500 });
  } finally {
    client.release();
  }
  await audit(session.adminId, "admin.updated", { email: target.email, areas: b.areas !== undefined ? cleanAreas(b.areas) : undefined, disabled: b.disabled, passwordReset: b.resetPassword === true });
  return NextResponse.json({ ok: true, temporaryPassword }, { headers: { "Cache-Control": "no-store" } });
}
