-- TripKawan: Multi-admin support
-- Run this in Supabase SQL Editor after 002_trip_questionnaire.sql
--
-- This migration replaces the single-admin model (`trips.admin_user_id`) with
-- a multi-admin model (`trip_members.role`). Multiple members per trip can
-- now be admins; promoting one member does not demote another.

-- ============================================================
-- PART 1: Add role column to trip_members
-- ============================================================

alter table public.trip_members
  add column if not exists role text not null default 'member'
    check (role in ('admin', 'member'));

-- ============================================================
-- PART 2: Backfill — promote existing admin_user_id holders
-- ============================================================

update public.trip_members tm
set role = 'admin'
from public.trips t
where t.id = tm.trip_id
  and t.admin_user_id = tm.user_id;

-- ============================================================
-- PART 3: Helper function (security definer to avoid RLS recursion)
-- ============================================================

create or replace function public.is_trip_admin(p_trip_id uuid, p_user_id uuid)
returns boolean as $$
  select exists (
    select 1 from public.trip_members
    where trip_id = p_trip_id
      and user_id = p_user_id
      and role = 'admin'
      and status = 'approved'
  );
$$ language sql security definer stable;

-- ============================================================
-- PART 4: Drop old policies that reference admin_user_id
-- ============================================================

drop policy if exists "Authenticated users can create trips" on public.trips;
drop policy if exists "Admin can update trip" on public.trips;
drop policy if exists "Admin or self can insert members" on public.trip_members;
drop policy if exists "Admin can update members" on public.trip_members;
drop policy if exists "Admin can delete members" on public.trip_members;
drop policy if exists "Admin can update itinerary items" on public.itinerary_items;
drop policy if exists "Suggester or admin can delete itinerary items" on public.itinerary_items;
drop policy if exists "Payer or admin can delete expense" on public.expenses;
drop policy if exists "Admin can insert preferences" on public.trip_preferences;
drop policy if exists "Admin can update preferences" on public.trip_preferences;

-- ============================================================
-- PART 5: Recreate policies using is_trip_admin()
-- ============================================================

-- Trips: anyone authenticated can create (creator inserts themselves into
-- trip_members with role='admin' afterward, see app code).
create policy "Authenticated users can create trips"
  on public.trips for insert
  to authenticated
  with check (true);

create policy "Admin can update trip"
  on public.trips for update
  to authenticated
  using (public.is_trip_admin(id, auth.uid()));

-- Trip members: self-join still allowed; admins can also add others.
create policy "Admin or self can insert members"
  on public.trip_members for insert
  to authenticated
  with check (
    user_id = auth.uid()
    or public.is_trip_admin(trip_id, auth.uid())
  );

create policy "Admin can update members"
  on public.trip_members for update
  to authenticated
  using (public.is_trip_admin(trip_id, auth.uid()));

create policy "Admin can delete members"
  on public.trip_members for delete
  to authenticated
  using (public.is_trip_admin(trip_id, auth.uid()));

-- Itinerary items
create policy "Admin can update itinerary items"
  on public.itinerary_items for update
  to authenticated
  using (public.is_trip_admin(trip_id, auth.uid()));

create policy "Suggester or admin can delete itinerary items"
  on public.itinerary_items for delete
  to authenticated
  using (
    suggested_by = auth.uid()
    or public.is_trip_admin(trip_id, auth.uid())
  );

-- Expenses
create policy "Payer or admin can delete expense"
  on public.expenses for delete
  to authenticated
  using (
    paid_by = auth.uid()
    or public.is_trip_admin(trip_id, auth.uid())
  );

-- Trip preferences
create policy "Admin can insert preferences"
  on public.trip_preferences for insert
  to authenticated
  with check (public.is_trip_admin(trip_id, auth.uid()));

create policy "Admin can update preferences"
  on public.trip_preferences for update
  to authenticated
  using (public.is_trip_admin(trip_id, auth.uid()));

-- ============================================================
-- PART 6: Drop the now-redundant admin_user_id column
-- ============================================================

-- CASCADE drops any stray policies that still reference admin_user_id
-- (e.g. policies added via the Supabase dashboard outside these migrations).
alter table public.trips drop column admin_user_id cascade;
