"use client";

import { cn } from "@/lib/utils";

/**
 * The AppShell top bar is the single source of page title, studio context,
 * and account identity. Individual views use PageHeader only for actions.
 * Retain the existing props so all views continue to compile unchanged.
 */
export function PageHeader({
  actions,
  className,
}: {
  eyebrow?: string;
  eyebrowIcon?: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  if (!actions) return null;
  return (
    <div className={cn("flex w-full flex-wrap items-center justify-end gap-2 mb-5 md:mb-6 max-sm:[&>button]:flex-1 max-sm:[&>a]:flex-1", className)}>
      {actions}
    </div>
  );
}
