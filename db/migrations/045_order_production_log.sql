-- 045: Per-stage production checklist. One entry per stage the workshop has
-- ticked off or marked "not needed", e.g.
--   {"Cutting": {"state": "done", "at": "2026-11-18T09:30:00Z", "by": "Ama"}}
-- Stages with no entry are outstanding. `production_stage` (044) is kept as the
-- current stage (first outstanding one) so the board and statuses stay simple.
alter table public.orders add column if not exists production_log jsonb not null default '{}'::jsonb;
