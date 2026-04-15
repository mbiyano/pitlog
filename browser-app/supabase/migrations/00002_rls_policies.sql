-- =============================================================================
-- RLS Policies — MVP single-workshop
-- =============================================================================
-- For MVP: any authenticated user can CRUD all workshop data.
-- Future: scope by workshop_id via profiles.workshop_id.
-- =============================================================================

-- Enable RLS on all tables
alter table profiles enable row level security;
alter table customers enable row level security;
alter table vehicles enable row level security;
alter table service_visits enable row level security;
alter table service_items enable row level security;
alter table service_reminders enable row level security;
alter table visit_notes enable row level security;
alter table attachments enable row level security;
alter table audit_log enable row level security;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create policy "Users can view all profiles"
  on profiles for select
  to authenticated
  using (true);

create policy "Users can update own profile"
  on profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- customers — full access for authenticated users
-- ---------------------------------------------------------------------------
create policy "Authenticated users can view customers"
  on customers for select to authenticated using (true);

create policy "Authenticated users can insert customers"
  on customers for insert to authenticated with check (true);

create policy "Authenticated users can update customers"
  on customers for update to authenticated using (true) with check (true);

create policy "Authenticated users can delete customers"
  on customers for delete to authenticated using (true);

-- ---------------------------------------------------------------------------
-- vehicles — full access for authenticated users
-- ---------------------------------------------------------------------------
create policy "Authenticated users can view vehicles"
  on vehicles for select to authenticated using (true);

create policy "Authenticated users can insert vehicles"
  on vehicles for insert to authenticated with check (true);

create policy "Authenticated users can update vehicles"
  on vehicles for update to authenticated using (true) with check (true);

create policy "Authenticated users can delete vehicles"
  on vehicles for delete to authenticated using (true);

-- ---------------------------------------------------------------------------
-- service_visits — full access for authenticated users
-- ---------------------------------------------------------------------------
create policy "Authenticated users can view service_visits"
  on service_visits for select to authenticated using (true);

create policy "Authenticated users can insert service_visits"
  on service_visits for insert to authenticated with check (true);

create policy "Authenticated users can update service_visits"
  on service_visits for update to authenticated using (true) with check (true);

create policy "Authenticated users can delete service_visits"
  on service_visits for delete to authenticated using (true);

-- ---------------------------------------------------------------------------
-- service_items — full access for authenticated users
-- ---------------------------------------------------------------------------
create policy "Authenticated users can view service_items"
  on service_items for select to authenticated using (true);

create policy "Authenticated users can insert service_items"
  on service_items for insert to authenticated with check (true);

create policy "Authenticated users can update service_items"
  on service_items for update to authenticated using (true) with check (true);

create policy "Authenticated users can delete service_items"
  on service_items for delete to authenticated using (true);

-- ---------------------------------------------------------------------------
-- service_reminders — full access for authenticated users
-- ---------------------------------------------------------------------------
create policy "Authenticated users can view service_reminders"
  on service_reminders for select to authenticated using (true);

create policy "Authenticated users can insert service_reminders"
  on service_reminders for insert to authenticated with check (true);

create policy "Authenticated users can update service_reminders"
  on service_reminders for update to authenticated using (true) with check (true);

create policy "Authenticated users can delete service_reminders"
  on service_reminders for delete to authenticated using (true);

-- ---------------------------------------------------------------------------
-- visit_notes — full access for authenticated users
-- ---------------------------------------------------------------------------
create policy "Authenticated users can view visit_notes"
  on visit_notes for select to authenticated using (true);

create policy "Authenticated users can insert visit_notes"
  on visit_notes for insert to authenticated with check (true);

-- ---------------------------------------------------------------------------
-- attachments — full access for authenticated users
-- ---------------------------------------------------------------------------
create policy "Authenticated users can view attachments"
  on attachments for select to authenticated using (true);

create policy "Authenticated users can insert attachments"
  on attachments for insert to authenticated with check (true);

-- ---------------------------------------------------------------------------
-- audit_log — read-only for authenticated, insert via service role or trigger
-- ---------------------------------------------------------------------------
create policy "Authenticated users can view audit_log"
  on audit_log for select to authenticated using (true);

create policy "Authenticated users can insert audit_log"
  on audit_log for insert to authenticated with check (true);
