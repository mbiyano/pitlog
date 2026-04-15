-- =============================================================================
-- Virtual Mecánico — Initial Schema
-- =============================================================================
-- Designed for single-workshop MVP with multi-tenant hooks for future expansion.
-- All tables include created_at/updated_at. RLS enforced per-table.
-- =============================================================================

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- -----------------------------------------------------------------------------
-- profiles — linked to auth.users
-- -----------------------------------------------------------------------------
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null default '',
  workshop_id uuid,  -- nullable for MVP; future FK to workshops table
  role        text not null default 'mechanic' check (role in ('owner','admin','mechanic')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Auto-update updated_at
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_updated_at
  before update on profiles
  for each row execute function public.update_updated_at();

-- -----------------------------------------------------------------------------
-- customers
-- -----------------------------------------------------------------------------
create table customers (
  id          uuid primary key default uuid_generate_v4(),
  full_name   text not null,
  phone       text,
  email       text,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index idx_customers_full_name on customers using gin (to_tsvector('spanish', full_name));
create index idx_customers_phone on customers (phone);

create trigger customers_updated_at
  before update on customers
  for each row execute function public.update_updated_at();

-- -----------------------------------------------------------------------------
-- vehicles
-- -----------------------------------------------------------------------------
create table vehicles (
  id              uuid primary key default uuid_generate_v4(),
  customer_id     uuid not null references customers(id) on delete cascade,
  plate           text not null,
  vin             text,
  make            text,
  model           text,
  year            int,
  engine          text,
  mileage_current int default 0,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- Unique plate (future: per workshop_id)
  constraint vehicles_plate_unique unique (plate)
);

create index idx_vehicles_plate on vehicles (upper(plate));
create index idx_vehicles_customer_id on vehicles (customer_id);
create index idx_vehicles_make_model on vehicles (make, model);

create trigger vehicles_updated_at
  before update on vehicles
  for each row execute function public.update_updated_at();

-- -----------------------------------------------------------------------------
-- service_visits
-- -----------------------------------------------------------------------------
create table service_visits (
  id            uuid primary key default uuid_generate_v4(),
  vehicle_id    uuid not null references vehicles(id) on delete cascade,
  customer_id   uuid not null references customers(id) on delete cascade,
  visit_date    date not null default current_date,
  mileage       int,
  intake_notes  text,
  summary       text,
  created_by    uuid references profiles(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index idx_service_visits_vehicle_id on service_visits (vehicle_id);
create index idx_service_visits_customer_id on service_visits (customer_id);
create index idx_service_visits_visit_date on service_visits (visit_date desc);

create trigger service_visits_updated_at
  before update on service_visits
  for each row execute function public.update_updated_at();

-- -----------------------------------------------------------------------------
-- service_items
-- -----------------------------------------------------------------------------
create table service_items (
  id                   uuid primary key default uuid_generate_v4(),
  visit_id             uuid not null references service_visits(id) on delete cascade,
  category             text not null default 'general',
  title                text not null,
  description          text,
  parts_used_json      jsonb default '[]'::jsonb,
  next_service_date    date,
  next_service_mileage int,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index idx_service_items_visit_id on service_items (visit_id);
create index idx_service_items_category on service_items (category);

create trigger service_items_updated_at
  before update on service_items
  for each row execute function public.update_updated_at();

-- -----------------------------------------------------------------------------
-- service_reminders
-- -----------------------------------------------------------------------------
create table service_reminders (
  id              uuid primary key default uuid_generate_v4(),
  vehicle_id      uuid not null references vehicles(id) on delete cascade,
  customer_id     uuid not null references customers(id) on delete cascade,
  source_visit_id uuid references service_visits(id) on delete set null,
  due_date        date,
  due_mileage     int,
  reason          text not null,
  status          text not null default 'pending'
                  check (status in ('pending','contacted','done','snoozed')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_service_reminders_vehicle_id on service_reminders (vehicle_id);
create index idx_service_reminders_status on service_reminders (status);
create index idx_service_reminders_due_date on service_reminders (due_date);

create trigger service_reminders_updated_at
  before update on service_reminders
  for each row execute function public.update_updated_at();

-- -----------------------------------------------------------------------------
-- visit_notes
-- -----------------------------------------------------------------------------
create table visit_notes (
  id          uuid primary key default uuid_generate_v4(),
  visit_id    uuid not null references service_visits(id) on delete cascade,
  body        text not null,
  created_by  uuid references profiles(id),
  created_at  timestamptz not null default now()
);

create index idx_visit_notes_visit_id on visit_notes (visit_id);

-- -----------------------------------------------------------------------------
-- attachments
-- -----------------------------------------------------------------------------
create table attachments (
  id          uuid primary key default uuid_generate_v4(),
  visit_id    uuid not null references service_visits(id) on delete cascade,
  file_url    text not null,
  file_type   text,
  created_at  timestamptz not null default now()
);

create index idx_attachments_visit_id on attachments (visit_id);

-- -----------------------------------------------------------------------------
-- audit_log
-- -----------------------------------------------------------------------------
create table audit_log (
  id            uuid primary key default uuid_generate_v4(),
  entity_type   text not null,
  entity_id     uuid not null,
  action        text not null,
  actor_id      uuid references profiles(id),
  payload_json  jsonb default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

create index idx_audit_log_entity on audit_log (entity_type, entity_id);
create index idx_audit_log_created_at on audit_log (created_at desc);
