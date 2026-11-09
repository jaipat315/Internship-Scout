-- Scout per-student cloud backup. Run in YOUR Supabase project's SQL editor.
-- Authenticated clients can only read/write their own progress.
create table if not exists public.scout_user_progress (
  user_id uuid primary key references auth.users (id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint scout_progress_json_size check (octet_length(payload::text) <= 250000)
);
alter table public.scout_user_progress enable row level security;
revoke all on public.scout_user_progress from anon;
grant select, insert, update, delete on public.scout_user_progress to authenticated;

drop policy if exists "Read own progress" on public.scout_user_progress;
drop policy if exists "Insert own progress" on public.scout_user_progress;
drop policy if exists "Update own progress" on public.scout_user_progress;
drop policy if exists "Delete own progress" on public.scout_user_progress;
create policy "Read own progress" on public.scout_user_progress
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Insert own progress" on public.scout_user_progress
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Update own progress" on public.scout_user_progress
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Delete own progress" on public.scout_user_progress
  for delete to authenticated using ((select auth.uid()) = user_id);
