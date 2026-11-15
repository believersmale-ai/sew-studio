import { NextResponse } from "next/server";
import { getSystemAdminSession } from "@/lib/db/session";
import { getPool } from "@/lib/db/pool";
import { cleanAreas, createDelegatedAdmin, generateTempPassword } from "@/lib/admin-team";

export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "no-store" };

async function superOnly() {
  const session = await getSystemAdminSession();
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) } as const;
  if (!session.isSuper) return { error: NextResponse.json({ error: "Only the main administrator can manage admins." }, { status: 403 }) } as const;
  return { session } as const;
}

export async function GET() {
  const auth = await superOnly();
  if ("error" in auth) return auth.error;
  const { rows } = await getPool().query(
    `select id, email, full_name as "fullName", is_super as "isSuper", areas, disabled_at as "disabledAt", created_at as "createdAt"
       from public.system_admins order by is_super desc, created_at`
  );
  return NextResponse.json({ admins: rows, me: auth.session.adminId }, { headers: noStore });
}

/** Creates a delegated admin and returns a one-time password for the main admin to hand over. */
export async function POST(request: Request) {
  const auth = await superOnly();
  if ("error" in auth) return auth.error;
  const b = (await request.json().catch(() => null)) as { email?: unknown; fullName?: unknown; areas?: unknown } | null;
  if (!b || typeof b.email !== "string" || typeof b.fullName !== "string") return NextResponse.json({ error: "Enter a name and an email address." }, { status: 400 });
  const password = generateTempPassword();
  try {
    const r = await createDelegatedAdmin(auth.session.adminId, { email: b.email, fullName: b.fullName, password, areas: cleanAreas(b.areas) });
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    return NextResponse.json({ id: r.id, email: b.email.trim().toLowerCase(), temporaryPassword: password }, { status: 201, headers: noStore });
  } catch (error) {
    console.error("[admin/admins] create failed", error);
    return NextResponse.json({ error: "Could not create the admin." }, { status: 500 });
  }
}
