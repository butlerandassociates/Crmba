-- Allow all authenticated users to read any profile row.
-- Required for activity log: non-admin users (PM, Sales Rep, Foreman) must
-- be able to see who performed each action in the audit trail.
-- The existing policy only allows self-read or admin-read; this broadens SELECT
-- to all authenticated users so attachPerformers() can resolve performer names.
-- Multiple SELECT policies are OR'd by Postgres RLS, so this is purely additive.

create policy "profiles_read_authenticated"
  on public.profiles
  for select
  using (auth.uid() is not null);
