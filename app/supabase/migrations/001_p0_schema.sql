-- TripKawan P0 Schema
-- Run this in Supabase SQL Editor (https://supabase.com/dashboard → SQL Editor)

-- ============================================================
-- PART 1: Create all tables first
-- ============================================================

-- 1. Profiles (extends Supabase Auth users)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  email text,
  avatar_url text,
  duitnow_qr_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 2. Trips
create table public.trips (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  start_date date,
  end_date date,
  admin_user_id uuid not null references public.profiles(id),
  photo_album_url text,
  created_at timestamptz not null default now()
);

-- 3. Trip Members (junction table with invite status)
create table public.trip_members (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  status text not null default 'approved',
  joined_at timestamptz not null default now(),
  unique(trip_id, user_id)
);

-- 4. Itinerary Items
create type public.itinerary_status as enum ('suggested', 'confirmed');

create table public.itinerary_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  day_date date,
  title text not null,
  url text,
  image_url text,
  suggested_by uuid not null references public.profiles(id),
  status public.itinerary_status not null default 'suggested',
  created_at timestamptz not null default now()
);

-- 5. Expenses
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  paid_by uuid not null references public.profiles(id),
  item_name text not null,
  amount decimal(12,2) not null check (amount > 0),
  receipt_url text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- PART 2: Enable RLS on all tables
-- ============================================================

alter table public.profiles enable row level security;
alter table public.trips enable row level security;
alter table public.trip_members enable row level security;
alter table public.itinerary_items enable row level security;
alter table public.expenses enable row level security;

-- ============================================================
-- PART 3: Helper function to avoid infinite recursion
-- ============================================================

-- Security definer function bypasses RLS, so policies that need
-- to look up trip_members won't trigger the trip_members SELECT policy.
create or replace function public.get_my_trip_ids()
returns setof uuid as $$
  select trip_id from public.trip_members
  where user_id = auth.uid() and status = 'approved'
$$ language sql security definer stable;

-- ============================================================
-- PART 4: All RLS policies
-- ============================================================

-- Profiles policies
create policy "Profiles are viewable by authenticated users"
  on public.profiles for select
  to authenticated
  using (true);

create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using (id = auth.uid());

-- Trips policies
create policy "Trip members can view trip"
  on public.trips for select
  to authenticated
  using (true);

create policy "Authenticated users can create trips"
  on public.trips for insert
  to authenticated
  with check (admin_user_id = auth.uid());

create policy "Admin can update trip"
  on public.trips for update
  to authenticated
  using (admin_user_id = auth.uid());

-- Trip Members policies
create policy "Trip members can view members"
  on public.trip_members for select
  to authenticated
  using (trip_id in (select public.get_my_trip_ids()));

create policy "Admin or self can insert members"
  on public.trip_members for insert
  to authenticated
  with check (
    user_id = auth.uid()
    or trip_id in (select id from public.trips where admin_user_id = auth.uid())
  );

create policy "Admin can update members"
  on public.trip_members for update
  to authenticated
  using (
    trip_id in (select id from public.trips where admin_user_id = auth.uid())
  );

create policy "Admin can delete members"
  on public.trip_members for delete
  to authenticated
  using (
    trip_id in (select id from public.trips where admin_user_id = auth.uid())
  );

-- Itinerary Items policies
create policy "Trip members can view itinerary"
  on public.itinerary_items for select
  to authenticated
  using (trip_id in (select public.get_my_trip_ids()));

create policy "Trip members can add itinerary items"
  on public.itinerary_items for insert
  to authenticated
  with check (
    suggested_by = auth.uid()
    and trip_id in (select public.get_my_trip_ids())
  );

create policy "Admin can update itinerary items"
  on public.itinerary_items for update
  to authenticated
  using (
    trip_id in (select id from public.trips where admin_user_id = auth.uid())
  );

create policy "Suggester or admin can delete itinerary items"
  on public.itinerary_items for delete
  to authenticated
  using (
    suggested_by = auth.uid()
    or trip_id in (select id from public.trips where admin_user_id = auth.uid())
  );

-- Expenses policies
create policy "Trip members can view expenses"
  on public.expenses for select
  to authenticated
  using (trip_id in (select public.get_my_trip_ids()));

create policy "Trip members can add expenses"
  on public.expenses for insert
  to authenticated
  with check (
    paid_by = auth.uid()
    and trip_id in (select public.get_my_trip_ids())
  );

create policy "Payer can update own expense"
  on public.expenses for update
  to authenticated
  using (paid_by = auth.uid());

create policy "Payer or admin can delete expense"
  on public.expenses for delete
  to authenticated
  using (
    paid_by = auth.uid()
    or trip_id in (select id from public.trips where admin_user_id = auth.uid())
  );

-- ============================================================
-- PART 5: Auto-create profile on signup trigger
-- ============================================================

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name, email, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', 'Traveler'),
    new.email,
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- PART 6: Storage buckets
-- ============================================================

insert into storage.buckets (id, name, public)
  values ('receipts', 'receipts', true)
  on conflict (id) do update set public = true;

insert into storage.buckets (id, name, public)
  values ('activities', 'activities', true)
  on conflict (id) do update set public = true;

create policy "Authenticated users can upload receipts"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'receipts');

create policy "Anyone can view receipts"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'receipts');

create policy "Authenticated users can upload activity images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'activities');

create policy "Anyone can view activity images"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'activities');
