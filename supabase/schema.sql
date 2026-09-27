create table public.money_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  customer text not null,
  job_name text not null,
  amount numeric(12, 2) not null check (amount > 0),
  direction text not null check (direction in ('in', 'out')),
  created_at timestamptz not null default now()
);

alter table public.money_entries enable row level security;

create policy "Users manage their own money"
on public.money_entries for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create index money_entries_user_date_idx
on public.money_entries (user_id, created_at desc);
