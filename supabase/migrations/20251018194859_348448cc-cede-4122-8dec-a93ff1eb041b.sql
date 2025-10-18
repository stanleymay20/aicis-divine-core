-- ===== Notifications System =====================================================
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  title text not null,
  message text not null,
  type text not null check (type in ('info','success','warning','error')),
  division text,
  link text,
  read boolean default false,
  created_at timestamptz default now()
);

create index if not exists idx_notifications_user on public.notifications(user_id, created_at desc);
create index if not exists idx_notifications_read on public.notifications(user_id, read);

alter table public.notifications enable row level security;

create policy "users_read_own_notifications" on public.notifications for select
  using (auth.uid() = user_id);

create policy "system_insert_notifications" on public.notifications for insert
  with check (true);

create policy "users_update_own_notifications" on public.notifications for update
  using (auth.uid() = user_id);