/**
 * The detailed production journey. An order's coarse `status` (Enquiry … Completed)
 * is kept for notifications, dashboards and the portal; `productionStage` says
 * exactly where the garment is once work has started.
 */
export const STAGE_GROUPS = [
  {
    key: "garment",
    title: "Garment Production",
    stages: ["Pattern Drafting", "Cutting", "Ironing/Pressing", "Interfacing & Lining", "Stitching/Sewing", "Embellishments & Ornamentation", "Finishing"],
  },
  {
    key: "fittings",
    title: "Fittings & Adjustments",
    stages: [
      "Ready for First Fitting",
      "First Fitting Completed",
      "Alterations Required",
      "Alterations in Progress",
      "Ready for Final Fitting",
      "Final Fitting Completed",
    ],
  },
  {
    key: "quality",
    title: "Quality Control & Completion",
    stages: ["Quality Check", "Final Approval", "Ready for Collection/Delivery", "Collected/Delivered"],
  },
] as const;

export type StageGroupKey = (typeof STAGE_GROUPS)[number]["key"];

export const ALL_STAGES: string[] = STAGE_GROUPS.flatMap((g) => [...g.stages]);

export const isProductionStage = (v: unknown): v is string => typeof v === "string" && ALL_STAGES.includes(v);

export function groupOfStage(stage: string | null | undefined) {
  return STAGE_GROUPS.find((g) => (g.stages as readonly string[]).includes(stage ?? ""));
}

/**
 * The order status that goes with a stage. Quality Check and Final Approval return
 * null: they leave the status alone, so moving into them never re-sends an
 * "in production" message to the customer.
 */
export function statusForStage(stage: string): string | null {
  switch (stage) {
    case "Ready for First Fitting":
    case "First Fitting Completed":
    case "Ready for Final Fitting":
    case "Final Fitting Completed":
      return "Fitting";
    case "Alterations Required":
    case "Alterations in Progress":
      return "Alterations";
    case "Quality Check":
    case "Final Approval":
      return null;
    case "Ready for Collection/Delivery":
      return "Ready";
    case "Collected/Delivered":
      return "Collected/Delivered";
    default:
      return stage && ALL_STAGES.includes(stage) ? "In Production" : null;
  }
}

/** Stage an order starts in when it is moved to a plain status (drag, status menu). */
export function defaultStageForStatus(status: string): string | null {
  switch (status) {
    case "In Production": return "Pattern Drafting";
    case "Fitting": return "Ready for First Fitting";
    case "Alterations": return "Alterations Required";
    case "Ready": return "Ready for Collection/Delivery";
    case "Collected/Delivered":
    case "Completed": return "Collected/Delivered";
    default: return null;
  }
}

/** The stage to show for an order: its saved stage, else the default for its status. */
export function effectiveStage(order: { status: string; productionStage?: string | null }): string | null {
  return isProductionStage(order.productionStage) ? order.productionStage : defaultStageForStatus(order.status);
}

export type StageState = "done" | "skipped" | "current" | "todo";
export type LogEntry = { state: "done" | "skipped"; at?: string; by?: string };
export type ProductionLog = Record<string, LogEntry>;

const LAST_STAGE = "Collected/Delivered";

/**
 * The checklist for an order. Orders from before the checklist existed have no
 * log, so one is worked out from their saved stage: everything before it is done.
 */
export function logOf(order: { status: string; productionStage?: string | null; productionLog?: unknown }): ProductionLog {
  const raw = order.productionLog;
  if (raw && typeof raw === "object" && Object.keys(raw as object).length > 0) {
    const out: ProductionLog = {};
    for (const [stage, e] of Object.entries(raw as Record<string, LogEntry>)) {
      if (isProductionStage(stage) && e && (e.state === "done" || e.state === "skipped")) out[stage] = e;
    }
    // Older orders may have finished before embellishments was introduced.
    const embellishments = "Embellishments & Ornamentation";
    if (!out[embellishments] && ALL_STAGES.slice(ALL_STAGES.indexOf(embellishments) + 1).some((stage) => out[stage])) {
      out[embellishments] = { state: "skipped" };
    }
    return out;
  }
  const current = effectiveStage(order);
  const idx = current ? ALL_STAGES.indexOf(current) : -1;
  const out: ProductionLog = {};
  ALL_STAGES.forEach((stage, i) => {
    if (idx >= 0 && (i < idx || (current === LAST_STAGE && i === idx))) out[stage] = { state: "done" };
  });
  return out;
}

/** The stage being worked on: the first outstanding one. Delivered is final. */
export function currentStageOf(log: ProductionLog): string {
  if (log[LAST_STAGE]?.state === "done") return LAST_STAGE;
  return ALL_STAGES.find((s) => !log[s]) ?? LAST_STAGE;
}

/** Tick, skip ("not needed") or reopen one stage. Reopening clears its entry. */
export function applyStageState(
  log: ProductionLog,
  stage: string,
  state: "done" | "skipped" | "pending",
  by: string | undefined,
  now = new Date()
): ProductionLog {
  const next = { ...log };
  if (state === "pending") delete next[stage];
  else next[stage] = { state, at: now.toISOString(), ...(by ? { by } : {}) };
  return next;
}

/** Moving a garment to a stage: earlier stages count as done, that stage and later ones are outstanding. */
export function logForStageMove(log: ProductionLog, stage: string, by: string | undefined, now = new Date()): ProductionLog {
  const idx = ALL_STAGES.indexOf(stage);
  const next: ProductionLog = {};
  ALL_STAGES.forEach((s, i) => {
    if (i < idx) next[s] = log[s] ?? { state: "done", at: now.toISOString(), ...(by ? { by } : {}) };
  });
  if (stage === LAST_STAGE) next[LAST_STAGE] = { state: "done", at: now.toISOString(), ...(by ? { by } : {}) };
  return next;
}

/** Every stage as done / skipped / current / outstanding, with who and when. */
export function stageRows(log: ProductionLog): { stage: string; state: StageState; entry?: LogEntry }[] {
  const current = currentStageOf(log);
  return ALL_STAGES.map((stage) => {
    const entry = log[stage];
    return { stage, entry, state: entry ? entry.state : stage === current ? "current" : "todo" };
  });
}

/** How many stages are finished (done or not needed). */
export const completedCount = (log: ProductionLog) => ALL_STAGES.filter((s) => log[s]).length;

/** When the garment reached its current stage: the latest tick, or null if unknown. */
export function enteredCurrentStageAt(log: ProductionLog): string | null {
  const times = Object.values(log).map((e) => e.at).filter((t): t is string => !!t).sort();
  return times.length ? times[times.length - 1] : null;
}

/** Statuses during which Quality Check / Final Approval leave the status as it is. */
const WORKSHOP_STATUSES = ["In Production", "Fitting", "Alterations", "Ready"];

export type OrderMove = { status?: string; productionStage?: string | null };

/**
 * Single source of truth (server and board) for what a move does to an order.
 * Picking a stage sets the matching status; picking a plain status starts the
 * order at that status's first stage (or clears the stage before production).
 */
export function resolveMove(
  existing: { status: string; productionStage?: string | null },
  move: OrderMove
): { status: string; productionStage: string | null } {
  if (isProductionStage(move.productionStage)) {
    const implied = statusForStage(move.productionStage);
    const status = implied ?? (WORKSHOP_STATUSES.includes(existing.status) ? existing.status : "In Production");
    return { status, productionStage: move.productionStage };
  }
  const status = move.status ?? existing.status;
  if (move.productionStage === null) return { status, productionStage: null };
  if (status === existing.status) return { status, productionStage: existing.productionStage ?? null };
  return { status, productionStage: defaultStageForStatus(status) };
}
