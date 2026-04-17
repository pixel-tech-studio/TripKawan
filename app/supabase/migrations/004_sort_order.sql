-- TripKawan: Add sort_order to itinerary_items for within-day reordering
-- Run this in Supabase SQL Editor after 003_multi_admin.sql

alter table public.itinerary_items
  add column if not exists sort_order integer not null default 0;

-- Backfill: assign sequential sort_order per (trip_id, day_date) group,
-- ordered by the existing created_at timestamp.
with numbered as (
  select id,
         row_number() over (
           partition by trip_id, day_date
           order by created_at
         ) - 1 as rn
  from public.itinerary_items
)
update public.itinerary_items i
set sort_order = n.rn
from numbered n
where i.id = n.id;
