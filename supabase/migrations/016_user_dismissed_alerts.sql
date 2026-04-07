-- Per-user dismissed alerts
-- Each row = one alert dismissed by one user
-- Admin override = delete rows for a specific user or all users

create table if not exists user_dismissed_alerts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references profiles(id) on delete cascade,
  alert_id      text not null,
  dismissed_at  timestamptz not null default now(),
  unique (user_id, alert_id)
);

-- Index for fast lookup per user
create index if not exists idx_user_dismissed_alerts_user_id on user_dismissed_alerts(user_id);

-- RLS
alter table user_dismissed_alerts enable row level security;

-- Users can read/write their own dismissed alerts
create policy "Users manage own dismissed alerts"
  on user_dismissed_alerts
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Admins can read and delete any user's dismissed alerts
create policy "Admins can manage all dismissed alerts"
  on user_dismissed_alerts
  for all
  using (
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'admin'
    )
  );
