-- Allow trip admins to delete trips
create policy "Admin can delete trip"
  on public.trips for delete
  to authenticated
  using (public.is_trip_admin(id, auth.uid()));
