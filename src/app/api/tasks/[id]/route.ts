import { getTenant } from "@/lib/db/session";
import type { Database } from "@/lib/db/database.types";
import { serializeTask } from "@/lib/db/serializers";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getTenant();
    if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await req.json().catch(()=>null);
    if (!body || typeof body !== "object" || Array.isArray(body)) return Response.json({error:"Invalid request body"},{status:400});
    if (ctx.role === "trainee") return Response.json({error:"Trainees cannot modify tasks"},{status:403});
    if ("title" in body && (typeof body.title !== "string" || !body.title.trim())) return Response.json({error:"Task title is required"},{status:400});
    if ("status" in body && !["To Do","In Progress","Done"].includes(body.status)) return Response.json({error:"Invalid task status"},{status:400});
    if (body.dueDate && !Number.isFinite(new Date(body.dueDate).getTime())) return Response.json({error:"Invalid due date"},{status:400});

    const { data: existing } = await ctx.db
      .from("tasks")
      .select("id, staff_id, staff:profiles!tasks_staff_id_fkey(role, mentor_id)")
      .eq("id", id)
      .eq("shop_id", ctx.shopId)
      .maybeSingle();
    if (!existing) return Response.json({ error: "Task not found" }, { status: 404 });

    // Staff/trainees may only edit tasks assigned to them.
    // Owner may edit any task. A trainer is only privileged over tasks in
    // their own scope: assigned to themselves or to a trainee they mentor.
    const staffRel = Array.isArray(existing.staff) ? existing.staff[0] : existing.staff;
    const inTrainerScope =
      existing.staff_id === ctx.userId ||
      (staffRel?.role === "trainee" && staffRel?.mentor_id === ctx.userId);
    const isPrivileged =
      ctx.role === "madam" || (ctx.role === "trainer" && inTrainerScope);
    if (!isPrivileged && existing.staff_id !== ctx.userId) {
      return Response.json(
        { error: "You can only update tasks assigned to you." },
        { status: 403 }
      );
    }

    if (!isPrivileged && Object.keys(body).some(k=>k!=="status")) return Response.json({error:"Only task status may be changed"},{status:403});
    const data: Database["public"]["Tables"]["tasks"]["Update"] = {};
    if ("title" in body && body.title) data.title = String(body.title);
    if ("status" in body && body.status) data.status = String(body.status);
    if ("priority" in body && body.priority) data.priority = String(body.priority);
    if ("notes" in body) data.notes = body.notes ? String(body.notes) : null;
    if ("orderId" in body) {
      if (body.orderId) {
        const { data: order } = await ctx.db
          .from("orders")
          .select("id")
          .eq("id", String(body.orderId))
          .eq("shop_id", ctx.shopId)
          .maybeSingle();
        if (!order) return Response.json({error:"Order not found"},{status:404});
        data.order_id = String(body.orderId);
      } else {
        data.order_id = null;
      }
    }
    if ("staffId" in body) {
      if (body.staffId) {
        const { data: staff } = await ctx.db
          .from("profiles")
          .select("id, role, mentor_id")
          .eq("id", String(body.staffId))
          .eq("shop_id", ctx.shopId)
          .maybeSingle();
        const allowed =
          !!staff &&
          (ctx.role !== "trainer" ||
            (staff.role === "trainee" && staff.mentor_id === ctx.userId));
        if (!allowed) return Response.json({error:"Assignment not permitted"},{status:403});
        data.staff_id = String(body.staffId);
      } else {
        data.staff_id = null;
      }
    }
    if ("dueDate" in body) {
      data.due_date = body.dueDate ? new Date(body.dueDate).toISOString() : null;
    }

    // Grading (school-portal style) — only trainers/owners may set these,
    // enforced here (not just hidden in the UI), since this is graded work
    // that determines a trainee's record.
    const isGradingAttempt =
      "maxScore" in body ||
      "score" in body ||
      "feedback" in body ||
      "gradedById" in body ||
      "competencyUnitId" in body;
    if (isGradingAttempt && ctx.role !== "trainer" && ctx.role !== "madam") {
      return Response.json(
        { error: "Only trainers or the studio owner can grade assignments." },
        { status: 403 }
      );
    }
    if (isGradingAttempt && ctx.role === "trainer") {
      const staffInfo = Array.isArray(existing.staff) ? existing.staff[0] : existing.staff;
      const isOwnMentee = staffInfo?.role === "trainee" && staffInfo?.mentor_id === ctx.userId;
      if (!isOwnMentee) {
        return Response.json(
          { error: "You can only grade trainees you mentor." },
          { status: 403 }
        );
      }
    }
    if ("maxScore" in body && body.maxScore != null && (!Number.isFinite(Number(body.maxScore)) || Number(body.maxScore)<=0)) return Response.json({error:"Maximum score must be positive"},{status:400});
    if ("score" in body && body.score != null && (!Number.isFinite(Number(body.score)) || Number(body.score)<0 || (body.maxScore != null && Number(body.score)>Number(body.maxScore)))) return Response.json({error:"Invalid score"},{status:400});
    if ("maxScore" in body) data.max_score = body.maxScore != null ? Number(body.maxScore) : null;
    if ("score" in body) data.score = body.score != null ? Number(body.score) : null;
    if ("feedback" in body) data.feedback = body.feedback ? String(body.feedback) : null;
    if ("competencyUnitId" in body) {
      if (body.competencyUnitId) {
        const { data: unit } = await ctx.db
          .from("competency_units")
          .select("id")
          .eq("id", String(body.competencyUnitId))
          .eq("shop_id", ctx.shopId)
          .maybeSingle();
        data.competency_unit_id = unit ? String(body.competencyUnitId) : null;
      } else {
        data.competency_unit_id = null;
      }
    }
    if ("gradedById" in body) {
      // Always grade as the actual caller, never a spoofed id from the client.
      data.graded_by_id = ctx.userId;
      data.graded_at = new Date().toISOString();
    }

    const { data: task, error } = await ctx.db
      .from("tasks")
      .update(data)
      .eq("id", id)
      .eq("shop_id", ctx.shopId)
      .select(
        "*, order:orders(*, customer:customers(*)), staff:profiles!tasks_staff_id_fkey(*), graded_by:profiles!tasks_graded_by_id_fkey(id, full_name), module:competency_units(id, title, program_id)"
      )
      .single();
    if (error) throw error;

    return Response.json(serializeTask(task));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: msg }, { status: 500 });
  }
}

// DELETE /api/tasks/[id] → { ok: true }
// Owner can delete any task in the shop; a trainer only tasks in their own
// scope (assigned to them, or to a trainee they mentor).
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getTenant();
    if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const { data: existingRow } = await ctx.db
      .from("tasks")
      .select("id, staff_id, staff:profiles!tasks_staff_id_fkey(role, mentor_id)")
      .eq("id", id)
      .eq("shop_id", ctx.shopId)
      .maybeSingle();
    const existing = existingRow as any;
    if (!existing) return Response.json({ error: "Task not found" }, { status: 404 });

    const staffRel = Array.isArray(existing.staff) ? existing.staff[0] : existing.staff;
    const inTrainerScope =
      existing.staff_id === ctx.userId ||
      (staffRel?.role === "trainee" && staffRel?.mentor_id === ctx.userId);
    const allowed = ctx.role === "madam" || (ctx.role === "trainer" && inTrainerScope);
    if (!allowed) {
      return Response.json(
        { error: "Only the studio owner can delete this task." },
        { status: 403 }
      );
    }

    const { error } = await ctx.db
      .from("tasks")
      .delete()
      .eq("id", id)
      .eq("shop_id", ctx.shopId);
    if (error) throw error;

    return Response.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
