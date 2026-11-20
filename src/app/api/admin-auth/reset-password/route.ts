import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { hash } from "@node-rs/argon2";
import { getPool } from "@/lib/db/pool";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const token = typeof body.token === "string" ? body.token : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!/^[a-f0-9]{64}$/.test(token) || password.length < 12 || password.length > 200) {
    return NextResponse.json({ error: "Invalid reset link or password. Use at least 12 characters." }, { status: 400 });
  }
  const db = getPool();
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const digest = createHash("sha256").update(token).digest("hex");
    const { rows } = await client.query(
      `select t.id, t.admin_id from private.admin_password_reset_tokens t
       join auth.users u on u.id = t.admin_id
       join public.system_admins sa on sa.id = u.id
       where t.token_hash = $1 and t.used_at is null and t.expires_at > now() and (u.banned_until is null or u.banned_until <= now()) and sa.disabled_at is null
       for update of t`,
      [digest],
    );
    if (!rows.length) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "This recovery link is invalid or expired." }, { status: 400 });
    }
    const passwordHash = await hash(password);
    await client.query("update private.credentials set password_hash = $2, updated_at = now() where user_id = $1", [rows[0].admin_id, passwordHash]);
    await client.query("update private.admin_password_reset_tokens set used_at = now() where admin_id = $1 and used_at is null", [rows[0].admin_id]);
    await client.query("COMMIT");
    return NextResponse.json({ ok: true });
  } catch {
    await client.query("ROLLBACK").catch(() => {});
    return NextResponse.json({ error: "Unable to reset password right now." }, { status: 500 });
  } finally {
    client.release();
  }
}
