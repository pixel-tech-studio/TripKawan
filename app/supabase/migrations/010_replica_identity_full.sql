-- TripKawan: make Realtime events carry the full old row
--
-- 005_enable_realtime added tables to the supabase_realtime publication
-- but didn't set REPLICA IDENTITY FULL. Without it, logical replication
-- only emits the primary key of the OLD row on UPDATE/DELETE events.
-- Supabase Realtime evaluates RLS against BOTH the OLD and NEW row
-- before forwarding an event; when the OLD row payload is missing
-- columns referenced by the SELECT policy (e.g. trip_id on
-- itinerary_items), the RLS check can't be satisfied and the event is
-- silently dropped — other members never receive the change.
--
-- Symptom: adding a new activity propagates (only NEW is evaluated on
-- INSERT) but edits / reorders / deletes do not auto-refresh for other
-- members.
--
-- Fix: turn on REPLICA IDENTITY FULL for every realtime-published table
-- so the full OLD row is available to RLS during replication.

alter table public.trips replica identity full;
alter table public.trip_members replica identity full;
alter table public.itinerary_items replica identity full;
alter table public.expenses replica identity full;
