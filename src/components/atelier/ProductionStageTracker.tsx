"use client";

import { Check, CircleDot } from "lucide-react";
import { cn } from "@/lib/utils";
import { STAGE_GROUPS, stageStates, type StageState } from "@/lib/production-stages";

const STATE_LABEL: Record<StageState, string> = { done: "Completed", current: "In progress now", todo: "Outstanding" };

/**
 * The full production journey, grouped. Every stage shows whether it is
 * completed, being worked on now, or still outstanding; each one can be picked.
 */
export function ProductionStageTracker({
  current,
  onSelect,
  disabled,
}: {
  current: string | null;
  onSelect?: (stage: string) => void;
  disabled?: boolean;
}) {
  const states = new Map(stageStates(current).map((s) => [s.stage, s.state]));
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {STAGE_GROUPS.map((group) => {
        const done = group.stages.filter((s) => states.get(s) === "done").length;
        return (
          <section key={group.key} aria-label={group.title} className="rounded-xl border border-[#EEDFE3] bg-[#FCF8F9] p-3.5">
            <div className="mb-2.5 flex items-center justify-between gap-2">
              <h4 className="text-xs font-bold uppercase tracking-[0.14em] text-[#51343C]">{group.title}</h4>
              <span className="text-[11px] font-semibold tabular-nums text-stone-500">{done}/{group.stages.length}</span>
            </div>
            <ol className="space-y-1.5">
              {group.stages.map((stage) => {
                const state = states.get(stage) ?? "todo";
                return (
                  <li key={stage}>
                    <button
                      type="button"
                      disabled={disabled || !onSelect}
                      onClick={() => onSelect?.(stage)}
                      aria-current={state === "current" ? "step" : undefined}
                      aria-label={`${stage}: ${STATE_LABEL[state]}`}
                      className={cn(
                        "flex min-h-10 w-full items-center gap-2.5 rounded-lg border px-3 text-left text-[13px] font-medium transition-colors disabled:cursor-default",
                        state === "done" && "border-[#D9E6DC] bg-[#F1F7F2] text-[#2F5A3D]",
                        state === "current" && "border-[#B45309]/50 bg-amber-50 text-[#8A3F06] ring-2 ring-[#B45309]/15",
                        state === "todo" && "border-[#EEDFE3] bg-white text-stone-500 hover:border-[#D8B8C0]"
                      )}
                    >
                      <span
                        className={cn(
                          "grid size-5 shrink-0 place-items-center rounded-full border",
                          state === "done" && "border-[#4A6B53] bg-[#4A6B53] text-white",
                          state === "current" && "border-[#B45309] bg-[#B45309] text-white",
                          state === "todo" && "border-stone-300 bg-white"
                        )}
                        aria-hidden="true"
                      >
                        {state === "done" ? <Check className="size-3" /> : state === "current" ? <CircleDot className="size-3" /> : null}
                      </span>
                      <span className="min-w-0 flex-1">{stage}</span>
                      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide opacity-80">
                        {state === "current" ? "Now" : state === "done" ? "Done" : ""}
                      </span>
                    </button>
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
