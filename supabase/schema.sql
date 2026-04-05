-- TradeSafe AI — Supabase Schema
-- Run this in the Supabase SQL Editor to set up all tables.

-- Enable Row Level Security on every table created below.

-- ============================================================
-- 0. Drop existing tables (cascade removes policies, triggers, etc.)
-- ============================================================
drop table if exists reports cascade;
drop table if exists crew_members cascade;
drop table if exists checklist_templates cascade;
drop table if exists contractor_profiles cascade;
drop table if exists profiles cascade;

-- ============================================================
-- 1. profiles
--    Stores basic identity and per-trade license numbers.
--    Referenced by report/[id]/page.jsx and report/new/NewReportClient.jsx.
-- ============================================================
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  business_name text not null default '',
  electrical_license text,
  plumbing_license text,
  roofing_license text,
  cot_cert_number text,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "Users can view own profile"
  on profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on profiles for update
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on profiles for insert
  with check (auth.uid() = id);

-- ============================================================
-- 2. contractor_profiles
--    Extended contractor settings, billing, and credentials.
--    Primary key is user_id (used as upsert conflict key in settings).
-- ============================================================
create table if not exists contractor_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
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

alter table contractor_profiles enable row level security;

create policy "Users can view own contractor profile"
  on contractor_profiles for select
  using (auth.uid() = user_id);

create policy "Users can update own contractor profile"
  on contractor_profiles for update
  using (auth.uid() = user_id);

create policy "Users can insert own contractor profile"
  on contractor_profiles for insert
  with check (auth.uid() = user_id);

-- ============================================================
-- 3. crew_members
-- ============================================================
create table if not exists crew_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  role text not null default 'journeyperson',
  trade text check (trade in ('electrical', 'plumbing', 'roofing')),
  license_number text,
  created_at timestamptz not null default now()
);

alter table crew_members enable row level security;

create policy "Users can manage own crew"
  on crew_members for all
  using (auth.uid() = user_id);

-- ============================================================
-- 4. checklist_templates
-- ============================================================
create table if not exists checklist_templates (
  id uuid primary key default gen_random_uuid(),
  trade text not null check (trade in ('electrical', 'plumbing', 'roofing')),
  category text not null,
  item_label text not null,
  sort_order int not null default 0,
  is_required boolean not null default true,
  regulation_reference text,
  created_at timestamptz not null default now()
);

alter table checklist_templates enable row level security;

create policy "Authenticated users can read templates"
  on checklist_templates for select
  to authenticated
  using (true);

-- ============================================================
-- 5. reports
-- ============================================================
create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
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
  -- Timestamps
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table reports enable row level security;

create policy "Users can manage own reports"
  on reports for all
  using (auth.uid() = user_id);

-- ============================================================
-- 6. Seed checklist templates — ELECTRICAL (2024 OESC / ESA)
-- ============================================================
insert into checklist_templates (trade, category, item_label, sort_order, regulation_reference) values
  ('electrical', 'Permit & Licensing', 'ESA permit number recorded', 1, '2024 OESC — ESA permit requirement'),
  ('electrical', 'Permit & Licensing', 'Licensed Electrical Contractor (LEC) number verified', 2, 'ECRA/ESA registration'),
  ('electrical', 'Permit & Licensing', 'Ontario College of Trades certificate number recorded', 3, 'Ontario College of Trades Act'),
  ('electrical', 'GFCI Protection', 'Kitchen receptacles GFCI-protected', 10, '2024 OESC Section 26'),
  ('electrical', 'GFCI Protection', 'Bathroom receptacles GFCI-protected', 11, '2024 OESC Section 26'),
  ('electrical', 'GFCI Protection', 'Laundry area receptacles GFCI-protected', 12, '2024 OESC Section 26'),
  ('electrical', 'GFCI Protection', 'Exterior receptacles GFCI-protected', 13, '2024 OESC Section 26'),
  ('electrical', 'AFCI Protection', 'AFCI protection installed on required circuits', 20, '2024 OESC AFCI requirements'),
  ('electrical', 'AFCI Protection', 'Bedroom circuits AFCI-protected', 21, '2024 OESC Section 26'),
  ('electrical', 'EV & Energy Storage', 'EV charger readiness confirmed (new builds)', 30, '2024 OESC EV-ready provisions'),
  ('electrical', 'EV & Energy Storage', 'Energy storage system compliance verified (if applicable)', 31, '2024 OESC energy storage provisions'),
  ('electrical', 'Panel & Wiring', 'Panel upgrade documentation complete', 40, '2024 OESC'),
  ('electrical', 'Panel & Wiring', 'Panel labelling accurate and legible', 41, '2024 OESC'),
  ('electrical', 'Panel & Wiring', 'Proper wire gauge for circuit amperage', 42, '2024 OESC'),
  ('electrical', 'Panel & Wiring', 'All junction boxes accessible and covered', 43, '2024 OESC'),
  ('electrical', 'Panel & Wiring', 'Grounding and bonding verified', 44, '2024 OESC'),
  ('electrical', 'Inspection', 'ESA inspection requested', 50, '2024 OESC — mandatory inspection'),
  ('electrical', 'Inspection', 'ESA inspection sign-off received', 51, '2024 OESC — mandatory inspection');

-- ============================================================
-- 7. Seed checklist templates — PLUMBING (OBC Part 7)
-- ============================================================
insert into checklist_templates (trade, category, item_label, sort_order, regulation_reference) values
  ('plumbing', 'Permit & Licensing', 'OBC permit number recorded', 1, 'Ontario Building Code Part 7'),
  ('plumbing', 'Permit & Licensing', 'Certificate of Qualification (C of Q) number recorded', 2, 'Ontario College of Trades'),
  ('plumbing', 'Permit & Licensing', 'Ontario College of Trades certificate number recorded', 3, 'Ontario College of Trades Act'),
  ('plumbing', 'Drainage', 'Drainage slope verified — minimum 1 in 50 for pipes 3 inches or less', 10, 'OBC Part 7 drainage requirements'),
  ('plumbing', 'Drainage', 'Drainage slope verified for pipes over 3 inches', 11, 'OBC Part 7 drainage requirements'),
  ('plumbing', 'Drainage', 'Cleanout access points installed and accessible', 12, 'OBC Part 7'),
  ('plumbing', 'Backflow & Fixtures', 'Backflow prevention device installed and confirmed', 20, 'OBC Part 7 backflow prevention'),
  ('plumbing', 'Backflow & Fixtures', 'Low-flow toilet compliance — 4.8L per flush or less', 21, 'OBC Part 7 water efficiency'),
  ('plumbing', 'Backflow & Fixtures', 'Low-flow faucets and showerheads verified', 22, 'OBC Part 7 water efficiency'),
  ('plumbing', 'Materials', 'PE-RT or PEX material certification verified (where used)', 30, 'OBC Part 7 approved materials'),
  ('plumbing', 'Materials', 'Pipe support and hanging compliant', 31, 'OBC Part 7'),
  ('plumbing', 'Venting', 'Air admittance valve locations documented', 40, 'OBC Part 7 venting'),
  ('plumbing', 'Venting', 'Vent stack sizing and routing verified', 41, 'OBC Part 7 venting'),
  ('plumbing', 'Inspection', 'Municipal inspection requested', 50, 'OBC Part 7 — mandatory inspection'),
  ('plumbing', 'Inspection', 'Inspection sign-off received', 51, 'OBC Part 7 — mandatory inspection');

-- ============================================================
-- 8. Seed checklist templates — ROOFING (OBC / MOL)
-- ============================================================
insert into checklist_templates (trade, category, item_label, sort_order, regulation_reference) values
  ('roofing', 'Permit & Certification', 'OBC building permit number recorded', 1, 'Ontario Building Code'),
  ('roofing', 'Permit & Certification', 'Working at Heights certification number and expiry recorded', 2, 'Ontario MOL — Working at Heights'),
  ('roofing', 'Permit & Certification', 'WSIB clearance certificate number recorded', 3, 'WSIB requirements'),
  ('roofing', 'Permit & Certification', 'Liability insurance policy confirmed', 4, 'Ontario contractor insurance requirements'),
  ('roofing', 'Permit & Certification', 'Ontario College of Trades certificate number recorded', 5, 'Ontario College of Trades Act'),
  ('roofing', 'Structural Compliance', 'Snow and ice load compliance confirmed', 10, 'OBC structural load requirements'),
  ('roofing', 'Structural Compliance', 'Eave protection installation confirmed', 11, 'OBC eave protection'),
  ('roofing', 'Structural Compliance', 'Roof drainage system confirmed', 12, 'OBC drainage requirements'),
  ('roofing', 'Materials', 'Underlayment material meets water resistance standard', 20, 'OBC material standards'),
  ('roofing', 'Materials', 'Underlayment material meets tear strength standard', 21, 'OBC material standards'),
  ('roofing', 'Materials', 'Underlayment material meets UV resistance standard', 22, 'OBC material standards'),
  ('roofing', 'Safety', 'Fall protection system in place', 30, 'Ontario MOL — Working at Heights'),
  ('roofing', 'Safety', 'Ladder safety requirements met', 31, 'Ontario MOL regulations'),
  ('roofing', 'Safety', 'Scaffolding requirements met (if applicable)', 32, 'Ontario MOL regulations'),
  ('roofing', 'Waste & Environment', 'Waste disposal compliant with Ontario environmental guidelines', 40, 'Ontario Environmental Protection Act'),
  ('roofing', 'Waste & Environment', 'Debris containment measures in place', 41, 'Ontario environmental guidelines'),
  ('roofing', 'Inspection', 'Municipal inspection requested', 50, 'OBC — mandatory inspection'),
  ('roofing', 'Inspection', 'Inspection sign-off received', 51, 'OBC — mandatory inspection');

-- ============================================================
-- 9. Helper function: update updated_at on row change
-- ============================================================
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger contractor_profiles_updated_at
  before update on contractor_profiles
  for each row execute function update_updated_at();

create trigger reports_updated_at
  before update on reports
  for each row execute function update_updated_at();
