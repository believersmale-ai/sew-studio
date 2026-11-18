-- 044: Detailed production stages. An order's coarse `status` stays (it drives
-- notifications, dashboards and the customer portal); `production_stage` records
-- exactly where the garment is in the workshop. Allowed values live in
-- src/lib/production-stages.ts and are validated by the API.
alter table public.orders add column if not exists production_stage text;

-- Orders already in the later statuses get the matching starting stage.
update public.orders set production_stage = case status
    when 'In Production' then 'Pattern Drafting'
    when 'Fitting' then 'Ready for First Fitting'
    when 'Alterations' then 'Alterations Required'
    when 'Ready' then 'Ready for Collection/Delivery'
    when 'Collected/Delivered' then 'Collected/Delivered'
    when 'Completed' then 'Collected/Delivered'
  end
where production_stage is null;
