-- TripKawan: let trip members edit and reorder their own itinerary items
--
-- 001 restricted itinerary_items UPDATE to admins only. Two features the UI
-- offers to members actually need UPDATE permission:
--   1. Swipe-edit of own item (title / url / image_url)
--   2. Drag-reorder of own item within a day (option 2 — reorder but not
--      cross-day / cross-KIV)
--
-- Both were failing silently at the RLS layer; swipe-edit writes were
-- rejected, and drag-reorder writes were rejected AND rolled back
-- optimistic state (the 'snap back' behaviour).
--
-- Fix:
--   (a) Add an UPDATE policy so suggesters can modify rows they created.
--       This covers the swipe-edit path directly.
--   (b) Add an RPC that bulk-updates sort_order for all items in a day,
--       since a within-day reorder cascades through siblings the caller
--       may not own. The RPC runs SECURITY DEFINER and checks trip
--       membership first; it refuses to change an item's day_date so it
--       can't be used as a back door for cross-day moves.
-- ============================================================
-- (a) Suggester can update own item
-- ============================================================

create policy "Suggester can update own itinerary item"
  on public.itinerary_items for update
  to authenticated
  using (suggested_by = auth.uid())
  with check (suggested_by = auth.uid());

-- ============================================================
-- (b) RPC for within-day reordering
-- ============================================================

create or replace function public.reorder_itinerary_items(
  p_trip_id uuid,
  p_day_date date,
  p_item_ids uuid[]
) returns void as $$
begin
  if not exists (
    select 1 from public.trip_members
    where trip_id = p_trip_id
      and user_id = auth.uid()
      and status = 'approved'
  ) then
    raise exception 'Not a trip member';
  end if;

  -- Restrict updates to items that are already in the specified day,
  -- so this RPC can't be abused to move items across days.
  update public.itinerary_items
  set sort_order = idx.ordinality::int - 1
  from unnest(p_item_ids) with ordinality as idx(id)
  where itinerary_items.id = idx.id
    and itinerary_items.trip_id = p_trip_id
    and itinerary_items.day_date is not distinct from p_day_date;
end;
$$ language plpgsql security definer;

grant execute on function public.reorder_itinerary_items(uuid, date, uuid[]) to authenticated;
