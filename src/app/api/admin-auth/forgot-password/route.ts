import { NextResponse } from "next/server";
import { randomBytes, createHash } from "node:crypto";
import { getPool } from "@/lib/db/pool";
import { sendEmail } from "@/lib/mailer";

export const dynamic = "force-dynamic";
const generic = { ok: true, message: "If an administrator account matches this email, a recovery link will be sent." };
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email || email.length > 254) return NextResponse.json(generic);
  try {
    const db = getPool();
    const { rows } = await db.query(
      `select u.id from auth.users u join public.system_admins sa on sa.user_id = u.id where lower(u.email) = $1 and u.is_active = true limit 1`,
      [email],
    );
    if (rows.length) {
      const adminId = rows[0].id;
      // Limit recovery emails to one per account every 5 minutes.
      const recent = await db.query(
        "select 1 from private.admin_password_reset_tokens where admin_id = $1 and created_at > now() - interval '5 minutes' limit 1",
        [adminId],
      );
      if (!recent.rowCount) {
        const token = randomBytes(32).toString("hex");
        const tokenHash = hashToken(token);
        await db.query(
          "insert into private.admin_password_reset_tokens (admin_id, token_hash, expires_at) values ($1, $2, now() + interval '30 minutes')",
          [adminId, tokenHash],
        );
        const origin = new URL(request.url).origin;
        const url = `${origin}/admin/reset-password?token=${encodeURIComponent(token)}`;
        await sendEmail({
          to: email,
          subject: "Reset your Sewsiness administrator password",
          body: `A password reset was requested for your Sewsiness administrator account. This link expires in 30 minutes:\n\n${url}\n\nIf you did not request this, ignore this message.`,
          type: "admin_password_reset",
        });
      }
    }
  } catch (error) {
    console.error("[admin-auth/forgot-password] Recovery request failed", error instanceof Error ? error.message : "unknown error");
  }
  return NextResponse.json(generic);
}
