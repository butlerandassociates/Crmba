-- ============================================================
-- Butler & Associates Construction CRM
-- Migration: 001 - Initial Schema
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- PROFILES (extends Supabase auth.users)
-- ============================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  role text not null default 'team_member' check (role in ('admin', 'team_member')),
  permissions jsonb not null default '{
    "can_create_proposals": true,
    "can_edit_sold_contracts": false,
    "can_view_financials": false,
    "can_manage_products": false,
    "can_manage_users": false
  }',
  commission_rate decimal(5,2) default 0,
  avatar_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- COMPANY SETTINGS (single row)
-- ============================================================
create table public.company_settings (
  id uuid primary key default uuid_generate_v4(),
  company_name text not null default 'Butler & Associates Construction, Inc',
  address text default '6275 University Drive Northwest, Suite 37-314',
  city text default 'Huntsville',
  state text default 'Alabama',
  zip text default '35806',
  phone text default '(256) 617-4691',
  email text default 'jonathan@butlerconstruction.co',
  website text default 'www.butlerconstruction.co',
  logo_url text,
  default_tax_rate decimal(5,2) default 9.00,
  default_tax_label text default 'Sales Tax',
  monthly_revenue_goal decimal(12,2) default 300000,
  warranty_text text default 'All work is performed in accordance with industry structural standards and is backed by our 24-Month Craftsmanship Warranty. Manufacturer warranties remain active for applicable materials.',
  estimate_footer_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Insert default company settings row
insert into public.company_settings (id) values (uuid_generate_v4());

-- ============================================================
-- PIPELINE STAGES (admin configurable)
-- ============================================================
create table public.pipeline_stages (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  order_index integer not null,
  color text default '#6B7280',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Default pipeline stages
insert into public.pipeline_stages (name, order_index, color) values
  ('New',       1, '#3B82F6'),
  ('Pursuing',  2, '#F59E0B'),
  ('Closing',   3, '#8B5CF6'),
  ('Active',    4, '#10B981'),
  ('Completed', 5, '#6B7280');

-- ============================================================
-- LEAD SOURCES (admin configurable)
-- ============================================================
create table public.lead_sources (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Default lead sources
insert into public.lead_sources (name) values
  ('Google'),
  ('Referral'),
  ('Facebook'),
  ('Instagram'),
  ('Nextdoor'),
  ('Yard Sign'),
  ('Repeat Customer'),
  ('Other');

-- ============================================================
-- CLIENTS / LEADS
-- ============================================================
create table public.clients (
  id uuid primary key default uuid_generate_v4(),
  first_name text not null,
  last_name text not null,
  address text,
  city text,
  state text,
  zip text,
  phone text,
  email text,
  lead_source_id uuid references public.lead_sources(id) on delete set null,
  pipeline_stage_id uuid references public.pipeline_stages(id) on delete set null,
  requested_services text,
  location_lat decimal(10,7),
  location_lng decimal(10,7),
  is_discarded boolean not null default false,
  discarded_at timestamptz,
  discarded_reason text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- CLIENT NOTES (time-stamped, auto-logged)
-- ============================================================
create table public.client_notes (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references public.clients(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  content text not null,
  is_system_generated boolean not null default false,
  action_type text, -- 'email_sent','appointment_scheduled','stage_changed','file_uploaded','estimate_created','contract_sent','contract_signed','note_added'
  created_at timestamptz not null default now()
);

-- ============================================================
-- CLIENT FILES (drag-and-drop uploads)
-- ============================================================
create table public.client_files (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references public.clients(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  file_name text not null,
  file_url text not null,
  file_type text, -- 'photo','document','site_plan','permit','other'
  mime_type text,
  file_size_bytes bigint,
  created_at timestamptz not null default now()
);

-- ============================================================
-- APPOINTMENTS
-- ============================================================
create table public.appointments (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references public.clients(id) on delete cascade,
  assigned_to uuid references public.profiles(id) on delete set null,
  title text default 'Consultation',
  appointment_date date not null,
  appointment_time time not null,
  notes text,
  google_calendar_event_id text,
  email_notification_sent boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- SERVICE CATEGORIES
-- ============================================================
create table public.service_categories (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Default categories
insert into public.service_categories (name) values
  ('Concrete'),
  ('Retaining Walls'),
  ('Drainage'),
  ('Pavers'),
  ('Grading & Excavation'),
  ('Landscaping'),
  ('Other');

-- ============================================================
-- PRODUCTS & SERVICES (admin managed, used in estimates)
-- ============================================================
create table public.products_services (
  id uuid primary key default uuid_generate_v4(),
  category_id uuid references public.service_categories(id) on delete set null,
  name text not null,
  description text,
  unit text not null default 'each', -- 'sq ft','cubic yard','linear ft','each','lot'
  material_cost decimal(10,2) not null default 0,
  labor_cost decimal(10,2) not null default 0,
  markup_percentage decimal(5,2) not null default 0,
  sales_tax_rate decimal(5,2) default null, -- null = use company default
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- EMAIL TEMPLATES (admin managed)
-- ============================================================
create table public.email_templates (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  subject text not null,
  body_html text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Default email templates
insert into public.email_templates (name, subject, body_html) values
  ('Initial Follow-Up',
   'Thank you for reaching out to Butler & Associates Construction',
   '<p>Hi {{first_name}},</p><p>Thank you for reaching out to Butler & Associates Construction. We appreciate your interest and would love the opportunity to work with you.</p><p>We will be in touch shortly to schedule a consultation.</p><p>Best regards,<br>Butler & Associates Construction Team</p>'),
  ('Estimate Sent',
   'Your Estimate from Butler & Associates Construction - #{{estimate_number}}',
   '<p>Hi {{first_name}},</p><p>Please find your estimate #{{estimate_number}} attached. We are excited about the opportunity to work on your project.</p><p>Please review the estimate and let us know if you have any questions. We are happy to discuss any adjustments.</p><p>Best regards,<br>Butler & Associates Construction Team</p>'),
  ('Appointment Confirmation',
   'Consultation Appointment Confirmed - Butler & Associates Construction',
   '<p>Hi {{first_name}},</p><p>This is a confirmation of your consultation appointment scheduled for {{appointment_date}} at {{appointment_time}}.</p><p>Our team member {{assigned_to}} will be meeting with you. If you need to reschedule, please reply to this email.</p><p>Best regards,<br>Butler & Associates Construction Team</p>'),
  ('Follow-Up After Estimate',
   'Following Up on Your Estimate - Butler & Associates Construction',
   '<p>Hi {{first_name}},</p><p>We wanted to follow up on the estimate we sent over. We would love to answer any questions you may have and move forward with your project.</p><p>Please feel free to reply to this email or give us a call at (256) 617-4691.</p><p>Best regards,<br>Butler & Associates Construction Team</p>');

-- ============================================================
-- ESTIMATES / PROPOSALS
-- ============================================================
create table public.estimates (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references public.clients(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  estimate_number integer not null,
  title text not null default 'Site Improvement Plan, Investment Breakdown',
  description text, -- intro paragraph shown on PDF
  status text not null default 'draft' check (status in ('draft','saved','sent','accepted','declined')),
  subtotal decimal(12,2) not null default 0,
  discount_percentage decimal(5,2) default 0,
  discount_amount decimal(12,2) default 0,
  tax_label text default 'Sales Tax',
  tax_rate decimal(5,2) default 9.00,
  tax_amount decimal(12,2) default 0,
  total decimal(12,2) not null default 0,
  sent_at timestamptz,
  accepted_at timestamptz,
  declined_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto-increment estimate number
create sequence public.estimate_number_seq start 1000;

-- ============================================================
-- ESTIMATE LINE ITEMS
-- ============================================================
create table public.estimate_line_items (
  id uuid primary key default uuid_generate_v4(),
  estimate_id uuid not null references public.estimates(id) on delete cascade,
  product_service_id uuid references public.products_services(id) on delete set null,
  name text not null,
  description text,
  unit text default 'each',
  quantity decimal(10,2) not null default 1,
  material_cost decimal(10,2) not null default 0,  -- internal only, never shown on PDF
  labor_cost decimal(10,2) not null default 0,      -- internal only, never shown on PDF
  markup_percentage decimal(5,2) not null default 0, -- internal only, never shown on PDF
  client_price decimal(12,2) not null default 0,     -- what client sees on PDF
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- ============================================================
-- PAYMENT SCHEDULES (per estimate)
-- ============================================================
create table public.payment_schedules (
  id uuid primary key default uuid_generate_v4(),
  estimate_id uuid not null references public.estimates(id) on delete cascade,
  label text not null, -- "Due upon signing of contract"
  percentage decimal(5,2) not null,
  amount decimal(12,2) not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- ============================================================
-- CONTRACTS (DocuSign)
-- ============================================================
create table public.contracts (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references public.clients(id) on delete cascade,
  estimate_id uuid references public.estimates(id) on delete set null,
  docusign_envelope_id text,
  docusign_template_id text,
  status text not null default 'pending' check (status in ('pending','sent','signed','declined','voided')),
  signed_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- PROGRESS PAYMENTS (AR - tied to contracts)
-- ============================================================
create table public.progress_payments (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references public.clients(id) on delete cascade,
  contract_id uuid not null references public.contracts(id) on delete cascade,
  payment_schedule_id uuid references public.payment_schedules(id) on delete set null,
  label text,
  amount decimal(12,2) not null,
  due_date date,
  paid_date date,
  status text not null default 'pending' check (status in ('pending','paid','overdue')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- DEPOSITS (AR)
-- ============================================================
create table public.deposits (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references public.clients(id) on delete cascade,
  contract_id uuid references public.contracts(id) on delete set null,
  amount decimal(12,2) not null,
  received_date date not null default current_date,
  notes text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- VENDORS (AP)
-- ============================================================
create table public.vendors (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  contact_name text,
  email text,
  phone text,
  address text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ============================================================
-- VENDOR BILLS (AP)
-- ============================================================
create table public.vendor_bills (
  id uuid primary key default uuid_generate_v4(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  amount decimal(12,2) not null,
  due_date date,
  paid_date date,
  status text not null default 'unpaid' check (status in ('unpaid','paid','overdue')),
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- CREW PROFILES
-- ============================================================
create table public.crew_profiles (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  email text,
  phone text,
  specialty text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ============================================================
-- PROJECT ASSIGNMENTS (when job moves to Active)
-- ============================================================
create table public.project_assignments (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references public.clients(id) on delete cascade,
  contract_id uuid references public.contracts(id) on delete set null,
  project_manager_id uuid references public.profiles(id) on delete set null,
  commission_rate decimal(5,2) not null default 0,
  gross_profit_at_assignment decimal(12,2) default 0,
  commission_amount decimal(12,2) default 0,
  assigned_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- ============================================================
-- PROJECT CREW (junction: assignment <-> crew)
-- ============================================================
create table public.project_crew (
  id uuid primary key default uuid_generate_v4(),
  project_assignment_id uuid not null references public.project_assignments(id) on delete cascade,
  crew_profile_id uuid not null references public.crew_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(project_assignment_id, crew_profile_id)
);

-- ============================================================
-- CREW LABOR ASSIGNMENTS (exportable as crew payment PDF)
-- ============================================================
create table public.crew_labor_assignments (
  id uuid primary key default uuid_generate_v4(),
  project_assignment_id uuid not null references public.project_assignments(id) on delete cascade,
  estimate_line_item_id uuid references public.estimate_line_items(id) on delete set null,
  name text not null,
  unit text,
  quantity decimal(10,2) not null default 1,
  labor_cost_per_unit decimal(10,2) not null default 0,
  total_labor_cost decimal(12,2) not null default 0,
  created_at timestamptz not null default now()
);

-- ============================================================
-- CHANGE ORDERS
-- ============================================================
create table public.change_orders (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references public.clients(id) on delete cascade,
  contract_id uuid not null references public.contracts(id) on delete cascade,
  description text not null,
  amount_change decimal(12,2) not null default 0,
  status text not null default 'pending' check (status in ('pending','approved','declined')),
  client_approval_token text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  approved_at timestamptz
);

-- ============================================================
-- EMAIL LOGS
-- ============================================================
create table public.email_logs (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references public.clients(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  template_id uuid references public.email_templates(id) on delete set null,
  to_email text not null,
  subject text not null,
  status text not null default 'sent' check (status in ('sent','delivered','opened','failed')),
  sent_at timestamptz not null default now(),
  opened_at timestamptz
);

-- ============================================================
-- ACTION LOGS (full audit trail - all actions auto-logged)
-- ============================================================
create table public.action_logs (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid references public.clients(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  action_type text not null, -- 'email_sent','appointment_scheduled','stage_changed','file_uploaded','estimate_created','estimate_sent','contract_sent','contract_signed','note_added','change_order_created'
  description text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

-- ============================================================
-- REVENUE GOALS
-- ============================================================
create table public.revenue_goals (
  id uuid primary key default uuid_generate_v4(),
  month integer not null check (month between 1 and 12),
  year integer not null,
  goal_amount decimal(12,2) not null,
  created_at timestamptz not null default now(),
  unique(month, year)
);

-- ============================================================
-- QUICKBOOKS SYNC LOG (for future QuickBooks integration)
-- ============================================================
create table public.quickbooks_sync_log (
  id uuid primary key default uuid_generate_v4(),
  entity_type text not null, -- 'estimate','invoice','payment','vendor_bill'
  entity_id uuid not null,
  qb_entity_id text,
  qb_entity_type text,
  status text not null default 'pending' check (status in ('pending','synced','failed')),
  error_message text,
  synced_at timestamptz,
  created_at timestamptz not null default now()
);

-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.handle_updated_at();

create trigger trg_company_settings_updated_at
  before update on public.company_settings
  for each row execute function public.handle_updated_at();

create trigger trg_clients_updated_at
  before update on public.clients
  for each row execute function public.handle_updated_at();

create trigger trg_appointments_updated_at
  before update on public.appointments
  for each row execute function public.handle_updated_at();

create trigger trg_products_services_updated_at
  before update on public.products_services
  for each row execute function public.handle_updated_at();

create trigger trg_email_templates_updated_at
  before update on public.email_templates
  for each row execute function public.handle_updated_at();

create trigger trg_estimates_updated_at
  before update on public.estimates
  for each row execute function public.handle_updated_at();

create trigger trg_contracts_updated_at
  before update on public.contracts
  for each row execute function public.handle_updated_at();

create trigger trg_progress_payments_updated_at
  before update on public.progress_payments
  for each row execute function public.handle_updated_at();

create trigger trg_vendor_bills_updated_at
  before update on public.vendor_bills
  for each row execute function public.handle_updated_at();

-- ============================================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- ============================================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, first_name, last_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'first_name', split_part(new.raw_user_meta_data->>'name', ' ', 1), 'User'),
    coalesce(new.raw_user_meta_data->>'last_name', split_part(new.raw_user_meta_data->>'name', ' ', 2), ''),
    coalesce(new.raw_user_meta_data->>'role', 'team_member')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

alter table public.profiles enable row level security;
alter table public.company_settings enable row level security;
alter table public.pipeline_stages enable row level security;
alter table public.lead_sources enable row level security;
alter table public.clients enable row level security;
alter table public.client_notes enable row level security;
alter table public.client_files enable row level security;
alter table public.appointments enable row level security;
alter table public.service_categories enable row level security;
alter table public.products_services enable row level security;
alter table public.email_templates enable row level security;
alter table public.estimates enable row level security;
alter table public.estimate_line_items enable row level security;
alter table public.payment_schedules enable row level security;
alter table public.contracts enable row level security;
alter table public.progress_payments enable row level security;
alter table public.deposits enable row level security;
alter table public.vendors enable row level security;
alter table public.vendor_bills enable row level security;
alter table public.crew_profiles enable row level security;
alter table public.project_assignments enable row level security;
alter table public.project_crew enable row level security;
alter table public.crew_labor_assignments enable row level security;
alter table public.change_orders enable row level security;
alter table public.email_logs enable row level security;
alter table public.action_logs enable row level security;
alter table public.revenue_goals enable row level security;
alter table public.quickbooks_sync_log enable row level security;

-- Helper: check if current user is admin
create or replace function public.is_admin()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$ language sql security definer;

-- Helper: check if user is authenticated
create or replace function public.is_authenticated()
returns boolean as $$
  select auth.uid() is not null;
$$ language sql security definer;

-- PROFILES: users see their own, admins see all
create policy "profiles_select" on public.profiles for select
  using (id = auth.uid() or public.is_admin());

create policy "profiles_update_own" on public.profiles for update
  using (id = auth.uid());

create policy "profiles_admin_all" on public.profiles for all
  using (public.is_admin());

-- COMPANY SETTINGS: all authenticated can read, only admin can write
create policy "company_settings_read" on public.company_settings for select
  using (public.is_authenticated());

create policy "company_settings_admin_write" on public.company_settings for all
  using (public.is_admin());

-- PIPELINE STAGES: all authenticated can read, admin can write
create policy "pipeline_stages_read" on public.pipeline_stages for select
  using (public.is_authenticated());

create policy "pipeline_stages_admin_write" on public.pipeline_stages for all
  using (public.is_admin());

-- LEAD SOURCES: all authenticated can read, admin can write
create policy "lead_sources_read" on public.lead_sources for select
  using (public.is_authenticated());

create policy "lead_sources_admin_write" on public.lead_sources for all
  using (public.is_admin());

-- CLIENTS: all authenticated team members can read/write
create policy "clients_all_authenticated" on public.clients for all
  using (public.is_authenticated());

-- CLIENT NOTES: all authenticated
create policy "client_notes_all_authenticated" on public.client_notes for all
  using (public.is_authenticated());

-- CLIENT FILES: all authenticated
create policy "client_files_all_authenticated" on public.client_files for all
  using (public.is_authenticated());

-- APPOINTMENTS: all authenticated
create policy "appointments_all_authenticated" on public.appointments for all
  using (public.is_authenticated());

-- SERVICE CATEGORIES: read all, admin write
create policy "service_categories_read" on public.service_categories for select
  using (public.is_authenticated());

create policy "service_categories_admin_write" on public.service_categories for all
  using (public.is_admin());

-- PRODUCTS & SERVICES: read all, admin write
create policy "products_services_read" on public.products_services for select
  using (public.is_authenticated());

create policy "products_services_admin_write" on public.products_services for all
  using (public.is_admin());

-- EMAIL TEMPLATES: read all, admin write
create policy "email_templates_read" on public.email_templates for select
  using (public.is_authenticated());

create policy "email_templates_admin_write" on public.email_templates for all
  using (public.is_admin());

-- ESTIMATES: all authenticated
create policy "estimates_all_authenticated" on public.estimates for all
  using (public.is_authenticated());

-- ESTIMATE LINE ITEMS: all authenticated
create policy "estimate_line_items_all_authenticated" on public.estimate_line_items for all
  using (public.is_authenticated());

-- PAYMENT SCHEDULES: all authenticated
create policy "payment_schedules_all_authenticated" on public.payment_schedules for all
  using (public.is_authenticated());

-- CONTRACTS: all authenticated
create policy "contracts_all_authenticated" on public.contracts for all
  using (public.is_authenticated());

-- PROGRESS PAYMENTS: all authenticated
create policy "progress_payments_all_authenticated" on public.progress_payments for all
  using (public.is_authenticated());

-- DEPOSITS: admin only (financial data)
create policy "deposits_admin_only" on public.deposits for all
  using (public.is_admin());

-- VENDORS: admin only
create policy "vendors_admin_only" on public.vendors for all
  using (public.is_admin());

-- VENDOR BILLS: admin only
create policy "vendor_bills_admin_only" on public.vendor_bills for all
  using (public.is_admin());

-- CREW PROFILES: all authenticated
create policy "crew_profiles_all_authenticated" on public.crew_profiles for all
  using (public.is_authenticated());

-- PROJECT ASSIGNMENTS: all authenticated
create policy "project_assignments_all_authenticated" on public.project_assignments for all
  using (public.is_authenticated());

-- PROJECT CREW: all authenticated
create policy "project_crew_all_authenticated" on public.project_crew for all
  using (public.is_authenticated());

-- CREW LABOR ASSIGNMENTS: all authenticated
create policy "crew_labor_all_authenticated" on public.crew_labor_assignments for all
  using (public.is_authenticated());

-- CHANGE ORDERS: all authenticated
create policy "change_orders_all_authenticated" on public.change_orders for all
  using (public.is_authenticated());

-- EMAIL LOGS: all authenticated
create policy "email_logs_all_authenticated" on public.email_logs for all
  using (public.is_authenticated());

-- ACTION LOGS: all authenticated read, system insert
create policy "action_logs_all_authenticated" on public.action_logs for all
  using (public.is_authenticated());

-- REVENUE GOALS: admin only
create policy "revenue_goals_admin_only" on public.revenue_goals for all
  using (public.is_admin());

-- QB SYNC LOG: admin only
create policy "quickbooks_sync_log_admin_only" on public.quickbooks_sync_log for all
  using (public.is_admin());

-- ============================================================
-- INDEXES for performance
-- ============================================================
create index idx_clients_pipeline_stage on public.clients(pipeline_stage_id);
create index idx_clients_lead_source on public.clients(lead_source_id);
create index idx_clients_is_discarded on public.clients(is_discarded);
create index idx_client_notes_client_id on public.client_notes(client_id);
create index idx_client_files_client_id on public.client_files(client_id);
create index idx_appointments_client_id on public.appointments(client_id);
create index idx_appointments_date on public.appointments(appointment_date);
create index idx_estimates_client_id on public.estimates(client_id);
create index idx_estimates_status on public.estimates(status);
create index idx_estimate_line_items_estimate_id on public.estimate_line_items(estimate_id);
create index idx_contracts_client_id on public.contracts(client_id);
create index idx_contracts_status on public.contracts(status);
create index idx_progress_payments_contract_id on public.progress_payments(contract_id);
create index idx_progress_payments_status on public.progress_payments(status);
create index idx_action_logs_client_id on public.action_logs(client_id);
create index idx_action_logs_created_at on public.action_logs(created_at desc);
create index idx_email_logs_client_id on public.email_logs(client_id);
