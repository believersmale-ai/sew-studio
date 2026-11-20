import { NextResponse } from "next/server";
import { getFreelancerSession } from "@/lib/db/session";
import { identityErrorMessage, isPlausiblePhone, MESSAGES } from "@/lib/identity";

export async function GET() {
  const ctx = await getFreelancerSession();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: freelancer } = await ctx.db
    .from("freelancer_profiles")
    .select("id, email, full_name, phone, specialty, skills, certification, years_experience, country, verified_at")
    .eq("id", ctx.freelancerId)
    .maybeSingle();
  if (!freelancer) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({
    id: freelancer.id,
    email: freelancer.email,
    fullName: freelancer.full_name,
    phone: freelancer.phone,
    specialty: freelancer.specialty,
    skills: freelancer.skills,
    verified: true,
    certification: freelancer.certification,
    yearsExperience: freelancer.years_experience,
    country: freelancer.country,
  });
}

// PATCH /api/freelancer-auth/me — a freelancer edits their own public profile.
export async function PATCH(req: Request) {
  const ctx = await getFreelancerSession();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "A valid profile is required." }, { status: 400 });
  }
  const fullName = String(body.fullName ?? "").trim();
  if (!fullName) return NextResponse.json({ error: "Please enter your name." }, { status: 400 });
  if (fullName.length > 120) return NextResponse.json({ error: "Name must be 120 characters or fewer." }, { status: 400 });
  const phone = String(body.phone ?? "").trim();
  if (phone && !isPlausiblePhone(phone)) return NextResponse.json({ error: MESSAGES.badPhone }, { status: 400 });
  const specialty = String(body.specialty ?? "").trim().slice(0, 60);
  const skills = String(body.skills ?? "").trim().slice(0, 300);
  const certification = String(body.certification ?? "").trim().slice(0, 500);
  const country = String(body.country ?? "").trim().slice(0, 100);
  const yearsExperience = body.yearsExperience === "" || body.yearsExperience == null ? null : Number(body.yearsExperience);
  if (yearsExperience !== null && (!Number.isInteger(yearsExperience) || yearsExperience < 0 || yearsExperience > 80)) return NextResponse.json({ error: "Years of experience must be between 0 and 80." }, { status: 400 });

  const { data, error } = await ctx.db
    .from("freelancer_profiles")
    .update({
      full_name: fullName,
      phone: phone ? phone.slice(0, 40) : null,
      specialty: specialty || null,
      skills: skills || null,
      certification: certification || null,
      country: country || null,
      years_experience: yearsExperience,
    })
    .eq("id", ctx.freelancerId)
    .select("id, email, full_name, phone, specialty, skills, certification, years_experience, country, verified_at")
    .single();
  if (error || !data) {
    const friendly = identityErrorMessage(error);
    if (friendly) return NextResponse.json({ error: friendly }, { status: 409 });
    return NextResponse.json({ error: "Could not save your profile." }, { status: 500 });
  }
  return NextResponse.json({
    id: data.id,
    email: data.email,
    fullName: data.full_name,
    phone: data.phone,
    specialty: data.specialty,
    skills: data.skills,
    verified: true,
    certification: data.certification,
    yearsExperience: data.years_experience,
    country: data.country,
  });
}
