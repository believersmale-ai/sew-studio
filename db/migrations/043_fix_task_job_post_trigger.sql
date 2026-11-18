-- Fix: creating (or editing) a task failed with a 500 when the task was
-- unassigned. The trigger from 028 writes to freelance_job_posts, but that
-- table has all privileges revoked from the app's roles (023), so the insert
-- inside the trigger was denied. Run the trigger function with its owner's
-- rights so it can maintain the job post regardless of who saves the task.
create or replace function public.sync_task_job_post() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  eligible boolean;
begin
  eligible := new.staff_id is null
          and new.status <> 'Done'
          and new.competency_unit_id is null
          and new.max_score is null;
  if eligible then
    insert into public.freelance_job_posts (shop_id, task_id, task_description, due_date, status)
    values (new.shop_id, new.id, new.title, new.due_date, 'Open')
    on conflict (task_id) do update
      set task_description = excluded.task_description,
          due_date = excluded.due_date,
          status = case when public.freelance_job_posts.status = 'Paused' then 'Open'
                        else public.freelance_job_posts.status end,
          updated_at = now();
  else
    update public.freelance_job_posts
       set status = 'Paused', updated_at = now()
     where task_id = new.id and status = 'Open';
  end if;
  return null;
end;
$$;
