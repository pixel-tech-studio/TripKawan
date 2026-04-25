-- Web Push subscriptions, one row per device that opted in to notifications.
--
-- A user can have many subscriptions (one per browser/device). The endpoint
-- string is globally unique by construction (it embeds an FCM/APNs token),
-- so we key uniqueness on it. If a device re-subscribes after revoking
-- permission the client should upsert by endpoint.

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create index push_subscriptions_user_id_idx on public.push_subscriptions(user_id);

alter table public.push_subscriptions enable row level security;

-- Users manage only their own subscriptions. The server-side notify path
-- uses the service role key and bypasses RLS, so it can read every
-- recipient's subscriptions when it needs to fan out a push.

create policy "User can read own subscriptions"
  on public.push_subscriptions for select
  to authenticated
  using (user_id = auth.uid());

create policy "User can insert own subscriptions"
  on public.push_subscriptions for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "User can delete own subscriptions"
  on public.push_subscriptions for delete
  to authenticated
  using (user_id = auth.uid());
