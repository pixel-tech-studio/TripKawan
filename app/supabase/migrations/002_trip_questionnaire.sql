-- TripKawan: Trip Questionnaire & AI Itinerary Generation
-- Run this in Supabase SQL Editor after 001_p0_schema.sql

-- ============================================================
-- PART 1: Extend trips table
-- ============================================================

alter table public.trips add column if not exists destination text;
alter table public.trips add column if not exists expected_pax int not null default 1;

-- ============================================================
-- PART 2: Track itinerary item source (manual vs ai-generated)
-- ============================================================

alter table public.itinerary_items add column if not exists source text not null default 'manual';

-- ============================================================
-- PART 3: Trip preferences table (questionnaire answers)
-- ============================================================

create table if not exists public.trip_preferences (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  travel_style text not null,
  accommodation text not null,
  dining text not null,
  activity_interests text[] not null default '{}',
  budget text not null,
  special_notes text,
  created_at timestamptz not null default now(),
  unique(trip_id)
);

alter table public.trip_preferences enable row level security;

create policy "Trip members can view preferences"
  on public.trip_preferences for select
  to authenticated
  using (trip_id in (select public.get_my_trip_ids()));

create policy "Admin can insert preferences"
  on public.trip_preferences for insert
  to authenticated
  with check (trip_id in (select id from public.trips where admin_user_id = auth.uid()));

create policy "Admin can update preferences"
  on public.trip_preferences for update
  to authenticated
  using (trip_id in (select id from public.trips where admin_user_id = auth.uid()));
