/**
 * The detailed production journey. An order's coarse `status` (Enquiry … Completed)
 * is kept for notifications, dashboards and the portal; `productionStage` says
 * exactly where the garment is once work has started.
 */
export const STAGE_GROUPS = [
  {
    key: "garment",
    title: "Garment Production",
    stages: ["Pattern Drafting", "Cutting", "Ironing/Pressing", "Interfacing & Lining", "Stitching/Sewing", "Finishing"],
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

export type StageState = "done" | "current" | "todo";

/** Done / current / outstanding for every stage. Delivered means everything is done. */
export function stageStates(current: string | null): { stage: string; state: StageState }[] {
  const idx = current ? ALL_STAGES.indexOf(current) : -1;
  const delivered = current === "Collected/Delivered";
  return ALL_STAGES.map((stage, i) => ({
    stage,
    state: idx < 0 ? "todo" : delivered || i < idx ? "done" : i === idx ? "current" : "todo",
  }));
}

export const stageProgress = (current: string | null) => {
  const idx = current ? ALL_STAGES.indexOf(current) : -1;
  if (idx < 0) return 0;
  return current === "Collected/Delivered" ? ALL_STAGES.length : idx;
};

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
