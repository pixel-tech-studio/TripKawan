-- Enable Supabase Realtime on key tables
alter publication supabase_realtime add table trips;
alter publication supabase_realtime add table trip_members;
alter publication supabase_realtime add table itinerary_items;
alter publication supabase_realtime add table expenses;
