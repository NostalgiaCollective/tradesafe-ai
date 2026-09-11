-- Phase 1: additive staging baseline. Historical schema.sql is never executed here.
-- Fresh install: creates missing application tables only. Existing tables/policies/data are untouched.
-- Production upgrades are a SEPARATE reviewed workflow: inventory, backup, diff, then a new migration.
-- This file does not reconcile a drifted existing schema. See README.md and ../preflight.sql.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
DO $function$
BEGIN
  IF to_regprocedure('public.tradesafe_baseline_updated_at()') IS NULL THEN
    CREATE FUNCTION public.tradesafe_baseline_updated_at() RETURNS trigger
    LANGUAGE plpgsql SET search_path = public AS $body$
    BEGIN NEW.updated_at = now(); RETURN NEW; END;
    $body$;
  END IF;
END
$function$;

DO $baseline$
BEGIN
  IF to_regclass('public.profiles') IS NULL THEN
create table public.profiles (
  id uuid primary key references auth.users(id) on delete restrict,
  email text,
  full_name text,
  business_name text not null default '',
  electrical_license text,
  plumbing_license text,
  roofing_license text,
  cot_cert_number text,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
  END IF;
END
$baseline$;

DO $baseline$
BEGIN
  IF to_regclass('public.contractor_profiles') IS NULL THEN
create table public.contractor_profiles (
  user_id uuid primary key references auth.users(id) on delete restrict,
  business_name text not null default '',
  contact_email text,
  contact_phone text,
  address text,
  cot_cert_number text,
  ecra_number text,
  coq_number text,
  wah_cert_number text,
  wah_expiry date,
  wsib_number text,
  liability_policy_number text,
  plan text check (plan in ('per_report', 'monthly')) default 'per_report',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.contractor_profiles enable row level security;

create policy "Users can view own contractor profile"
  on public.contractor_profiles for select
  using (auth.uid() = user_id);

create policy "Users can update own contractor profile"
  on public.contractor_profiles for update
  using (auth.uid() = user_id);

create policy "Users can insert own contractor profile"
  on public.contractor_profiles for insert
  with check (auth.uid() = user_id);
GRANT SELECT, INSERT, UPDATE ON public.contractor_profiles TO authenticated;
CREATE TRIGGER tradesafe_baseline_updated_at BEFORE UPDATE ON public.contractor_profiles
FOR EACH ROW EXECUTE FUNCTION public.tradesafe_baseline_updated_at();
  END IF;
END
$baseline$;

DO $baseline$
BEGIN
  IF to_regclass('public.crew_members') IS NULL THEN
create table public.crew_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  name text not null,
  role text not null default 'journeyperson',
  trade text check (trade in ('electrical', 'plumbing', 'roofing')),
  license_number text,
  created_at timestamptz not null default now()
);
alter table public.crew_members enable row level security;

create policy "Users can manage own crew"
  on public.crew_members for all
  using (auth.uid() = user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crew_members TO authenticated;
  END IF;
END
$baseline$;

DO $baseline$
BEGIN
  IF to_regclass('public.checklist_templates') IS NULL THEN
create table public.checklist_templates (
  id uuid primary key default gen_random_uuid(),
  trade text not null check (trade in ('electrical', 'plumbing', 'roofing')),
  category text not null,
  item_label text not null,
  sort_order int not null default 0,
  is_required boolean not null default true,
  regulation_reference text,
  created_at timestamptz not null default now()
);
alter table public.checklist_templates enable row level security;

create policy "Authenticated users can read templates"
  on public.checklist_templates for select
  to authenticated
  using (true);
GRANT SELECT ON public.checklist_templates TO authenticated;
  END IF;
END
$baseline$;

DO $baseline$
BEGIN
  IF to_regclass('public.reports') IS NULL THEN
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  trade text not null check (trade in ('electrical', 'plumbing', 'roofing')),
  status text not null check (status in ('draft', 'completed')) default 'draft',
  -- Contractor snapshot
  business_name text not null default '',
  license_number text,
  cot_cert_number text,
  -- Job site info
  job_address text not null,
  homeowner_name text not null,
  date_of_work date not null default current_date,
  supervising_journeyperson text not null default '',
  -- Permit info
  permit_number text,
  -- Trade-specific certification fields
  wah_cert_number text,
  wah_cert_expiry date,
  wsib_clearance_number text,
  -- Checklist results stored as JSONB
  checklist jsonb not null default '[]',
  -- Declaration
  declared boolean not null default false,
  -- Stripe payment
  stripe_session_id text,
  -- Timestamps
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);
alter table public.reports enable row level security;

create policy "Users can manage own reports"
  on public.reports for all
  using (auth.uid() = user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reports TO authenticated;
CREATE TRIGGER tradesafe_baseline_updated_at BEFORE UPDATE ON public.reports
FOR EACH ROW EXECUTE FUNCTION public.tradesafe_baseline_updated_at();
  END IF;
END
$baseline$;

-- No seed duplicates: runtime checklist definitions are centralized in lib/domain/templates.ts.
-- No indexes/constraints are applied to existing rows in this initial baseline.
COMMIT;
