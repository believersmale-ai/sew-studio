import { randomBytes } from "node:crypto";
import { hash } from "@node-rs/argon2";
import { getPool } from "@/lib/db/pool";
import { ADMIN_AREA_KEYS } from "@/lib/admin-access";

/** A readable one-time password for a new or reset admin (shown once to the main admin). */
export const generateTempPassword = () => randomBytes(9).toString("base64url");

export const cleanAreas = (v: unknown): string[] =>
  Array.isArray(v) ? [...new Set(v.filter((a): a is string => typeof a === "string" && ADMIN_AREA_KEYS.includes(a)))] : [];

export async function audit(adminId: string, action: string, details: Record<string, unknown>) {
  await getPool()
    .query(`insert into public.system_platform_audit_log (admin_id, action, entity, details) values ($1, $2, 'admin_team', $3::jsonb)`, [adminId, action, JSON.stringify(details)])
    .catch(() => undefined);
}

export type CreateResult = { ok: true; id: string } | { ok: false; status: number; error: string };

/** Creates a delegated (non-super) admin. Never turns a studio member or freelancer into an admin. */
export async function createDelegatedAdmin(by: string, input: { email: string; fullName: string; password: string; areas: string[] }): Promise<CreateResult> {
  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) return { ok: false, status: 400, error: "Enter a valid email address." };
  const name = input.fullName.trim().slice(0, 120);
  if (!name) return { ok: false, status: 400, error: "Enter the person's name." };
  const passwordHash = await hash(input.password);

  const client = await getPool().connect();
  try {
    await client.query("begin");
    const existing = (await client.query("select id from auth.users where lower(email) = $1", [email])).rows[0] as { id: string } | undefined;
    let id = existing?.id;
    if (id) {
      for (const table of ["profiles", "freelancer_profiles", "system_admins"]) {
        if ((await client.query(`select 1 from public.${table} where id = $1`, [id])).rowCount) {
          await client.query("rollback");
          return { ok: false, status: 409, error: table === "system_admins" ? "That person is already an admin." : "That email already belongs to a studio member or freelancer. Use a different email." };
        }
      }
      await client.query(
        `insert into private.credentials (user_id, password_hash) values ($1, $2)
           on conflict (user_id) do update set password_hash = excluded.password_hash, updated_at = now()`, [id, passwordHash]);
      await client.query("update auth.users set banned_until = null where id = $1", [id]);
    } else {
      id = (await client.query("insert into auth.users (email) values ($1) returning id", [email])).rows[0].id as string;
      await client.query("insert into private.credentials (user_id, password_hash) values ($1, $2)", [id, passwordHash]);
    }
    await client.query(
      `insert into public.system_admins (id, email, full_name, is_super, areas, created_by) values ($1, $2, $3, false, $4, $5)`,
      [id, email, name, input.areas, by]);
    await client.query("commit");
    await audit(by, "admin.created", { email, areas: input.areas });
    return { ok: true, id: id! };
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
