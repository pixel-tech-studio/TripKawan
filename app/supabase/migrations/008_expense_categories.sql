-- Add category to expenses: 'personal' or 'shared'
alter table public.expenses
  add column category text not null default 'shared'
    check (category in ('personal', 'shared'));

-- Update RLS: personal expenses only visible to owner, shared visible to all trip members
drop policy if exists "Trip members can view expenses" on public.expenses;

create policy "Trip members can view expenses"
  on public.expenses for select
  to authenticated
  using (
    trip_id in (select public.get_my_trip_ids())
    and (category = 'shared' or paid_by = auth.uid())
  );
