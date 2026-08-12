-- DSA Quest cloud saves: run this once in the Supabase SQL Editor
-- (Dashboard -> SQL Editor -> New query -> paste -> Run).

create table if not exists public.saves (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.saves enable row level security;

-- Each player can only read and write their own save row.
create policy "read own save" on public.saves
  for select using (auth.uid() = user_id);

create policy "insert own save" on public.saves
  for insert with check (auth.uid() = user_id);

create policy "update own save" on public.saves
  for update using (auth.uid() = user_id);
