"use client";

import { Check, CircleDot, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { STAGE_GROUPS, stageRows, type ProductionLog, type StageState } from "@/lib/production-stages";

const STATE_LABEL: Record<StageState, string> = {
  done: "Completed",
  skipped: "Not needed",
  current: "In progress now",
  todo: "Outstanding",
};

const shortDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" }) : "";

/**
 * The production checklist. Each stage is its own tick: complete it, mark it
 * "not needed", or reopen it (for example when alterations send a garment back).
 * The stage being worked on is always the first one still outstanding.
 */
export function ProductionStageTracker({
  log,
  onChange,
  disabled,
}: {
  log: ProductionLog;
  onChange?: (stage: string, state: "done" | "skipped" | "pending") => void;
  disabled?: boolean;
}) {
  const rows = new Map(stageRows(log).map((r) => [r.stage, r]));
  const locked = disabled || !onChange;
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {STAGE_GROUPS.map((group) => {
        const finished = group.stages.filter((s) => rows.get(s)?.entry).length;
        return (
          <section key={group.key} aria-label={group.title} className="rounded-xl border border-[#EEDFE3] bg-[#FCF8F9] p-3.5">
            <div className="mb-2.5 flex items-center justify-between gap-2">
              <h4 className="text-xs font-bold uppercase tracking-[0.14em] text-[#51343C]">{group.title}</h4>
              <span className="text-[11px] font-semibold tabular-nums text-stone-500">{finished}/{group.stages.length}</span>
            </div>
            <ol className="space-y-1.5">
              {group.stages.map((stage) => {
                const row = rows.get(stage)!;
                const { state, entry } = row;
                const detail = entry?.at ? `${shortDate(entry.at)}${entry.by ? ` · ${entry.by}` : ""}` : "";
                return (
                  <li
                    key={stage}
                    aria-current={state === "current" ? "step" : undefined}
                    className={cn(
                      "flex min-h-11 items-center gap-2 rounded-lg border px-2 py-1.5 text-[13px] font-medium",
                      state === "done" && "border-[#D9E6DC] bg-[#F1F7F2] text-[#2F5A3D]",
                      state === "skipped" && "border-stone-200 bg-stone-50 text-stone-400",
                      state === "current" && "border-[#B45309]/50 bg-amber-50 text-[#8A3F06] ring-2 ring-[#B45309]/15",
                      state === "todo" && "border-[#EEDFE3] bg-white text-stone-500"
                    )}
                  >
                    <button
                      type="button"
                      disabled={locked}
                      onClick={() => onChange?.(stage, state === "done" ? "pending" : "done")}
                      aria-label={`${stage}: ${STATE_LABEL[state]}. ${state === "done" ? "Reopen" : "Mark complete"}`}
                      className={cn(
                        "grid size-8 shrink-0 place-items-center rounded-full disabled:cursor-default",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C79A45]"
                      )}
                    >
                      <span
                        className={cn(
                          "grid size-5 place-items-center rounded-full border",
                          state === "done" && "border-[#4A6B53] bg-[#4A6B53] text-white",
                          state === "skipped" && "border-stone-300 bg-white text-stone-400",
                          state === "current" && "border-[#B45309] bg-white text-[#B45309]",
                          state === "todo" && "border-stone-300 bg-white"
                        )}
                        aria-hidden="true"
                      >
                        {state === "done" ? <Check className="size-3" /> : state === "skipped" ? <Minus className="size-3" /> : state === "current" ? <CircleDot className="size-3" /> : null}
                      </span>
                    </button>
                    <span className="min-w-0 flex-1">
                      <span className={cn("block leading-tight", state === "skipped" && "line-through")}>{stage}</span>
                      {(detail || state === "current" || state === "skipped") && (
                        <span className="block text-[11px] font-normal leading-tight opacity-80">
                          {state === "current" ? "Working on now" : state === "skipped" ? `Not needed${detail ? ` · ${detail}` : ""}` : detail}
                        </span>
                      )}
                    </span>
                    {!locked && state !== "done" && (
                      <button
                        type="button"
                        onClick={() => onChange?.(stage, state === "skipped" ? "pending" : "skipped")}
                        className="shrink-0 rounded-md px-2 py-1 text-[11px] font-medium text-stone-500 hover:bg-white hover:text-[#800020] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C79A45]"
                        aria-label={state === "skipped" ? `Bring ${stage} back` : `Mark ${stage} as not needed`}
                      >
                        {state === "skipped" ? "Undo" : "Not needed"}
                      </button>
                    )}
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}
    </div>
  );
}
