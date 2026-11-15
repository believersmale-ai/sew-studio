import { NextResponse } from "next/server";
import { hash, verify } from "@node-rs/argon2";
import { getSystemAdminSession } from "@/lib/db/session";
import { getPool } from "@/lib/db/pool";

export const dynamic = "force-dynamic";

/** Lets any signed-in platform admin change their own password (new admins start with a one-time password). */
export async function POST(request: Request) {
  const session = await getSystemAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = (await request.json().catch(() => null)) as { current?: unknown; next?: unknown } | null;
  if (!b || typeof b.current !== "string" || typeof b.next !== "string") return NextResponse.json({ error: "Enter your current and new password." }, { status: 400 });
  if (b.next.length < 8 || b.next.length > 200) return NextResponse.json({ error: "Use a new password of at least 8 characters." }, { status: 400 });
  if (b.next === b.current) return NextResponse.json({ error: "Choose a password you have not used just now." }, { status: 400 });

  const row = (await getPool().query("select password_hash from private.credentials where user_id = $1", [session.adminId])).rows[0] as { password_hash: string } | undefined;
  const ok = row ? await verify(row.password_hash, b.current).catch(() => false) : false;
  if (!ok) return NextResponse.json({ error: "Your current password is not correct." }, { status: 400 });
  await getPool().query("update private.credentials set password_hash = $2, updated_at = now() where user_id = $1", [session.adminId, await hash(b.next)]);
  return NextResponse.json({ ok: true });
}
