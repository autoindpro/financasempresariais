-- =====================================================================
-- Finance OS · DRE Gerencial — Schema completo para Supabase
-- =====================================================================
-- Inclui: tabelas multiempresa, RLS preparada, plano de contas,
-- receitas, deduções, CMV/CPV/CSP, gastos, funcionários, snapshots.
-- =====================================================================

-- Extensão para UUID
create extension if not exists "pgcrypto";

-- ----------------------- ENUMS -----------------------
create type account_type as enum ('Receita','Custo','Gasto','Financeiro','Investimento','Deduções');
create type cmv_type as enum ('CMV','CPV','CSP');
create type expense_frequency as enum ('Mensal','Trimestral','Anual','Eventual');
create type app_role as enum ('admin','manager','viewer');

-- Cashflow
create type cashflow_entry_kind as enum ('payable','receivable');
create type cashflow_entry_status as enum ('open','paid','canceled');

-- ----------------------- PLATFORM ADMINS -----------------------
-- Usuários com permissão global para visualizar dados de todas as empresas.
create table public.app_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);

-- ----------------------- USERS / COMPANIES -----------------------
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  cnpj text,
  address text,
  logo_url text,
  created_at timestamptz default now()
);

create table public.user_companies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  role app_role not null default 'viewer',
  unique (user_id, company_id)
);

create or replace function public.has_company_access(_user_id uuid, _company_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_companies
    where user_id = _user_id and company_id = _company_id
  );
$$;

create or replace function public.is_platform_admin(_user_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.app_admins a where a.user_id = _user_id);
$$;

-- ----------------------- EMPLOYEES -----------------------
create table public.employees (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  cpf text,
  role text,
  admission_date date not null,
  salary numeric(14,2) not null default 0,
  inss_rate numeric(5,2) not null default 8,
  fgts_rate numeric(5,2) not null default 8,
  created_at timestamptz default now()
);

-- ----------------------- CHART OF ACCOUNTS -----------------------
create table public.chart_of_accounts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  "group" text,
  subgroup text,
  type account_type not null,
  active boolean not null default true,
  impacts_dre boolean not null default true,
  created_at timestamptz default now()
);

-- ----------------------- REVENUES -----------------------
create table public.revenues (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  competence char(7) not null, -- 'YYYY-MM'
  amount numeric(14,2) not null,
  type text,
  channel text,
  notes text,
  created_at timestamptz default now()
);
create index on public.revenues (company_id, competence);

-- ----------------------- DEDUCTIONS -----------------------
create table public.deductions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  competence char(7) not null,
  "group" text,
  subgroup text,
  type text,
  account text,
  amount numeric(14,2) not null,
  description text,
  entry_date date not null default current_date,
  notes text,
  created_at timestamptz default now()
);
create index on public.deductions (company_id, competence);

-- ----------------------- CMV / CPV / CSP -----------------------
create table public.cmv_cpv_csp (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  competence char(7) not null,
  type cmv_type not null,
  amount numeric(14,2) not null,
  source text,
  responsible text,
  notes text,
  created_at timestamptz default now()
);
create index on public.cmv_cpv_csp (company_id, competence);

-- ----------------------- OPERATIONAL EXPENSES -----------------------
create table public.operational_expenses (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  competence char(7) not null,
  "group" text,
  subgroup text,
  account text,
  description text,
  amount numeric(14,2) not null,
  recurrent boolean not null default false,
  frequency expense_frequency not null default 'Mensal',
  responsible text,
  entry_date date not null default current_date,
  notes text,
  created_at timestamptz default now()
);
create index on public.operational_expenses (company_id, competence);

-- ----------------------- DRE RESULTS / SNAPSHOTS -----------------------
create table public.dre_results (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  competence char(7) not null,
  receita_bruta numeric(14,2) not null default 0,
  deducoes numeric(14,2) not null default 0,
  receita_liquida numeric(14,2) not null default 0,
  cmv_total numeric(14,2) not null default 0,
  lucro_bruto numeric(14,2) not null default 0,
  gastos_operacionais numeric(14,2) not null default 0,
  ebitda numeric(14,2) not null default 0,
  resultado_financeiro numeric(14,2) not null default 0,
  lucro_liquido numeric(14,2) not null default 0,
  generated_at timestamptz default now(),
  unique (company_id, competence)
);

create table public.dashboard_snapshots (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  competence char(7) not null,
  payload jsonb not null,
  created_at timestamptz default now()
);

-- ----------------------- APP OPTIONS (PER COMPANY) -----------------------
-- Stores user-defined dropdown values (e.g., "Tipo de Receita", "Canal") per company.
create table public.option_values (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  key text not null,
  value text not null,
  created_at timestamptz default now(),
  unique (company_id, key, value)
);
create index on public.option_values (company_id, key);

-- ----------------------- CASHFLOW / BANKING -----------------------
create table public.bank_accounts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  bank_name text,
  account_number text,
  currency char(3) not null default 'BRL',
  opening_balance numeric(14,2) not null default 0,
  active boolean not null default true,
  created_at timestamptz default now()
);
create index on public.bank_accounts (company_id);

create table public.bank_transactions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  bank_account_id uuid not null references public.bank_accounts(id) on delete cascade,
  fit_id text, -- OFX FITID (not always present)
  posted_at date not null,
  amount numeric(14,2) not null,
  name text,
  memo text,
  check_num text,
  raw jsonb, -- original OFX chunk (best-effort)
  created_at timestamptz default now(),
  unique (bank_account_id, fit_id)
);
create index on public.bank_transactions (company_id, posted_at);

create table public.cashflow_entries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  kind cashflow_entry_kind not null,
  status cashflow_entry_status not null default 'open',
  competence char(7) not null,
  due_date date not null,
  paid_at date,
  description text not null,
  counterparty text,
  account text, -- optional link to chart_of_accounts.name
  amount numeric(14,2) not null,
  recurrent boolean not null default false,
  frequency expense_frequency not null default 'Mensal',
  notes text,
  created_at timestamptz default now()
);
create index on public.cashflow_entries (company_id, due_date);

-- ----------------------- RLS POLICIES -----------------------
alter table public.companies enable row level security;
alter table public.user_companies enable row level security;
alter table public.app_admins enable row level security;
alter table public.employees enable row level security;
alter table public.chart_of_accounts enable row level security;
alter table public.revenues enable row level security;
alter table public.deductions enable row level security;
alter table public.cmv_cpv_csp enable row level security;
alter table public.operational_expenses enable row level security;
alter table public.dre_results enable row level security;
alter table public.dashboard_snapshots enable row level security;
alter table public.option_values enable row level security;
alter table public.bank_accounts enable row level security;
alter table public.bank_transactions enable row level security;
alter table public.cashflow_entries enable row level security;

-- Acesso por vínculo na tabela user_companies
create policy "company access read" on public.companies
  for select using (public.has_company_access(auth.uid(), id));

-- Admin global pode ver todas as empresas
create policy "company read platform admin" on public.companies
  for select using (exists (select 1 from public.app_admins a where a.user_id = auth.uid()));

-- Admin global pode editar/deletar qualquer empresa
create policy "company write platform admin" on public.companies
  for update using (public.is_platform_admin(auth.uid()))
  with check (public.is_platform_admin(auth.uid()));

create policy "company delete platform admin" on public.companies
  for delete using (public.is_platform_admin(auth.uid()));

-- Permite criar empresas (o vínculo em user_companies garante o acesso depois).
create policy "company insert" on public.companies
  for insert with check (auth.uid() is not null);

-- Permite editar/deletar empresas apenas se o usuário tiver vínculo.
create policy "company write" on public.companies
  for update using (public.has_company_access(auth.uid(), id))
  with check (public.has_company_access(auth.uid(), id));

create policy "company delete" on public.companies
  for delete using (public.has_company_access(auth.uid(), id));

create policy "user_companies self read" on public.user_companies
  for select using (user_id = auth.uid());

-- Permite o próprio usuário criar o vínculo (ex.: ao criar uma empresa)
create policy "user_companies self insert" on public.user_companies
  for insert with check (user_id = auth.uid());

-- Admin global pode gerenciar vínculos (para dar acesso a outras pessoas)
create policy "user_companies platform admin" on public.user_companies
  for all using (public.is_platform_admin(auth.uid()))
  with check (public.is_platform_admin(auth.uid()));

-- app_admins: cada admin pode ver a própria linha; (inserção é feita manualmente no painel/SQL)
create policy "app_admins self read" on public.app_admins
  for select using (user_id = auth.uid());

-- Política genérica reutilizada nas demais tabelas
create policy "rev access" on public.revenues for all
  using (public.has_company_access(auth.uid(), company_id))
  with check (public.has_company_access(auth.uid(), company_id));

create policy "rev platform admin" on public.revenues for all
  using (public.is_platform_admin(auth.uid()))
  with check (public.is_platform_admin(auth.uid()));

create policy "ded access" on public.deductions for all
  using (public.has_company_access(auth.uid(), company_id))
  with check (public.has_company_access(auth.uid(), company_id));

create policy "ded platform admin" on public.deductions for all
  using (public.is_platform_admin(auth.uid()))
  with check (public.is_platform_admin(auth.uid()));

create policy "cmv access" on public.cmv_cpv_csp for all
  using (public.has_company_access(auth.uid(), company_id))
  with check (public.has_company_access(auth.uid(), company_id));

create policy "cmv platform admin" on public.cmv_cpv_csp for all
  using (public.is_platform_admin(auth.uid()))
  with check (public.is_platform_admin(auth.uid()));

create policy "exp access" on public.operational_expenses for all
  using (public.has_company_access(auth.uid(), company_id))
  with check (public.has_company_access(auth.uid(), company_id));

create policy "exp platform admin" on public.operational_expenses for all
  using (public.is_platform_admin(auth.uid()))
  with check (public.is_platform_admin(auth.uid()));

create policy "emp access" on public.employees for all
  using (public.has_company_access(auth.uid(), company_id))
  with check (public.has_company_access(auth.uid(), company_id));

create policy "emp platform admin" on public.employees for all
  using (public.is_platform_admin(auth.uid()))
  with check (public.is_platform_admin(auth.uid()));

create policy "coa access" on public.chart_of_accounts for all
  using (public.has_company_access(auth.uid(), company_id))
  with check (public.has_company_access(auth.uid(), company_id));

create policy "coa platform admin" on public.chart_of_accounts for all
  using (public.is_platform_admin(auth.uid()))
  with check (public.is_platform_admin(auth.uid()));

create policy "dre access" on public.dre_results for all
  using (public.has_company_access(auth.uid(), company_id))
  with check (public.has_company_access(auth.uid(), company_id));

create policy "dre platform admin" on public.dre_results for all
  using (public.is_platform_admin(auth.uid()))
  with check (public.is_platform_admin(auth.uid()));

create policy "snap access" on public.dashboard_snapshots for all
  using (public.has_company_access(auth.uid(), company_id))
  with check (public.has_company_access(auth.uid(), company_id));

create policy "bank_accounts access" on public.bank_accounts for all
  using (public.has_company_access(auth.uid(), company_id))
  with check (public.has_company_access(auth.uid(), company_id));

create policy "bank_tx access" on public.bank_transactions for all
  using (public.has_company_access(auth.uid(), company_id))
  with check (public.has_company_access(auth.uid(), company_id));

create policy "cashflow access" on public.cashflow_entries for all
  using (public.has_company_access(auth.uid(), company_id))
  with check (public.has_company_access(auth.uid(), company_id));

-- Platform admin full access
create policy "bank_accounts platform admin" on public.bank_accounts for all
  using (public.is_platform_admin(auth.uid()))
  with check (public.is_platform_admin(auth.uid()));

create policy "bank_tx platform admin" on public.bank_transactions for all
  using (public.is_platform_admin(auth.uid()))
  with check (public.is_platform_admin(auth.uid()));

create policy "cashflow platform admin" on public.cashflow_entries for all
  using (public.is_platform_admin(auth.uid()))
  with check (public.is_platform_admin(auth.uid()));

create policy "snap platform admin" on public.dashboard_snapshots for all
  using (public.is_platform_admin(auth.uid()))
  with check (public.is_platform_admin(auth.uid()));

create policy "options access" on public.option_values for all
  using (public.has_company_access(auth.uid(), company_id))
  with check (public.has_company_access(auth.uid(), company_id));

create policy "options platform admin" on public.option_values for all
  using (public.is_platform_admin(auth.uid()))
  with check (public.is_platform_admin(auth.uid()));
