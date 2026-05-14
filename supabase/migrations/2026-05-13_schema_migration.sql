-- =====================================================================
-- Flux Soluções · DRE Gerencial — Migração de Schema (idempotente)
-- Data: 2026-05-13
--
-- Objetivo:
-- - Atualizar o schema do Supabase para refletir os campos atuais do app
-- - Sem drops destrutivos (apenas CREATE/ALTER/ENABLE RLS/policies)
--
-- Como usar:
-- - Cole e execute no Supabase SQL Editor
-- =====================================================================

-- Extensões
create extension if not exists "pgcrypto";

-- ----------------------- ENUMS (create-if-missing) -----------------------
do $enum$
begin
  if not exists (select 1 from pg_type where typname = 'account_type') then
    execute $sql$create type account_type as enum ('Receita','Custo','Gasto','Financeiro','Investimento','Deduções')$sql$;
  end if;
  if not exists (select 1 from pg_type where typname = 'cmv_type') then
    execute $sql$create type cmv_type as enum ('CMV','CPV','CSP')$sql$;
  end if;
  if not exists (select 1 from pg_type where typname = 'expense_frequency') then
    execute $sql$create type expense_frequency as enum ('Mensal','Trimestral','Anual','Eventual')$sql$;
  end if;
  if not exists (select 1 from pg_type where typname = 'app_role') then
    execute $sql$create type app_role as enum ('admin','manager','viewer')$sql$;
  end if;
end $enum$;

-- ----------------------- TABELAS (create-if-missing) -----------------------

create table if not exists public.app_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  cnpj text,
  address text,
  logo_url text,
  created_at timestamptz default now()
);

create table if not exists public.user_companies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  role app_role not null default 'viewer',
  unique (user_id, company_id)
);

create table if not exists public.employees (
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

create table if not exists public.chart_of_accounts (
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

create table if not exists public.revenues (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  competence char(7) not null,
  amount numeric(14,2) not null,
  type text,
  channel text,
  notes text,
  created_at timestamptz default now()
);

create table if not exists public.deductions (
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

create table if not exists public.cmv_cpv_csp (
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

create table if not exists public.operational_expenses (
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

create table if not exists public.dre_results (
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

create table if not exists public.dashboard_snapshots (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  competence char(7) not null,
  payload jsonb not null,
  created_at timestamptz default now()
);

-- ----------------------- FUNÇÕES -----------------------
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

-- ----------------------- ALTERs (adicionar colunas faltantes) -----------------------
-- Companies
alter table public.companies add column if not exists cnpj text;
alter table public.companies add column if not exists address text;
alter table public.companies add column if not exists logo_url text;
alter table public.companies add column if not exists created_at timestamptz default now();

-- user_companies
alter table public.user_companies add column if not exists role app_role not null default 'viewer';

-- chart_of_accounts
alter table public.chart_of_accounts add column if not exists "group" text;
alter table public.chart_of_accounts add column if not exists subgroup text;
alter table public.chart_of_accounts add column if not exists type account_type;
alter table public.chart_of_accounts add column if not exists active boolean not null default true;
alter table public.chart_of_accounts add column if not exists impacts_dre boolean not null default true;
alter table public.chart_of_accounts add column if not exists created_at timestamptz default now();

-- employees
alter table public.employees add column if not exists cpf text;
alter table public.employees add column if not exists role text;
alter table public.employees add column if not exists inss_rate numeric(5,2) not null default 8;
alter table public.employees add column if not exists fgts_rate numeric(5,2) not null default 8;
alter table public.employees add column if not exists created_at timestamptz default now();

-- revenues
alter table public.revenues add column if not exists type text;
alter table public.revenues add column if not exists channel text;
alter table public.revenues add column if not exists notes text;
alter table public.revenues add column if not exists created_at timestamptz default now();

-- deductions (principal fonte de quebra quando app muda campos)
alter table public.deductions add column if not exists "group" text;
alter table public.deductions add column if not exists subgroup text;
alter table public.deductions add column if not exists type text;
alter table public.deductions add column if not exists account text;
alter table public.deductions add column if not exists description text;
alter table public.deductions add column if not exists entry_date date not null default current_date;
alter table public.deductions add column if not exists notes text;
alter table public.deductions add column if not exists created_at timestamptz default now();

-- cmv_cpv_csp
alter table public.cmv_cpv_csp add column if not exists source text;
alter table public.cmv_cpv_csp add column if not exists responsible text;
alter table public.cmv_cpv_csp add column if not exists notes text;
alter table public.cmv_cpv_csp add column if not exists created_at timestamptz default now();

-- operational_expenses
alter table public.operational_expenses add column if not exists "group" text;
alter table public.operational_expenses add column if not exists subgroup text;
alter table public.operational_expenses add column if not exists account text;
alter table public.operational_expenses add column if not exists description text;
alter table public.operational_expenses add column if not exists recurrent boolean not null default false;
alter table public.operational_expenses add column if not exists frequency expense_frequency not null default 'Mensal';
alter table public.operational_expenses add column if not exists responsible text;
alter table public.operational_expenses add column if not exists entry_date date not null default current_date;
alter table public.operational_expenses add column if not exists notes text;
alter table public.operational_expenses add column if not exists created_at timestamptz default now();

-- dre_results
alter table public.dre_results add column if not exists generated_at timestamptz default now();

-- dashboard_snapshots
alter table public.dashboard_snapshots add column if not exists created_at timestamptz default now();

-- ----------------------- INDEXES -----------------------
create index if not exists revenues_company_competence_idx on public.revenues (company_id, competence);
create index if not exists deductions_company_competence_idx on public.deductions (company_id, competence);
create index if not exists cmv_company_competence_idx on public.cmv_cpv_csp (company_id, competence);
create index if not exists operational_expenses_company_competence_idx on public.operational_expenses (company_id, competence);

-- ----------------------- ALTER TYPEs (tentar alinhar tipos, sem quebrar execução) -----------------------
-- Algumas instâncias antigas podem ter colunas como TEXT. Tentamos converter para os ENUM/DATE atuais.
do $types$
declare
  col_udt text;
begin
  -- user_companies.role -> app_role
  select c.udt_name into col_udt
  from information_schema.columns c
  where c.table_schema='public' and c.table_name='user_companies' and c.column_name='role';
  if col_udt is not null and col_udt <> 'app_role' then
    begin
      execute $sql$alter table public.user_companies alter column role type app_role using role::app_role$sql$;
    exception when others then
      -- mantém como está se houver valores inválidos
    end;
  end if;

  -- chart_of_accounts.type -> account_type
  select c.udt_name into col_udt
  from information_schema.columns c
  where c.table_schema='public' and c.table_name='chart_of_accounts' and c.column_name='type';
  if col_udt is not null and col_udt <> 'account_type' then
    begin
      execute $sql$alter table public.chart_of_accounts alter column type type account_type using type::account_type$sql$;
    exception when others then
    end;
  end if;

  -- cmv_cpv_csp.type -> cmv_type
  select c.udt_name into col_udt
  from information_schema.columns c
  where c.table_schema='public' and c.table_name='cmv_cpv_csp' and c.column_name='type';
  if col_udt is not null and col_udt <> 'cmv_type' then
    begin
      execute $sql$alter table public.cmv_cpv_csp alter column type type cmv_type using type::cmv_type$sql$;
    exception when others then
    end;
  end if;

  -- operational_expenses.frequency -> expense_frequency
  select c.udt_name into col_udt
  from information_schema.columns c
  where c.table_schema='public' and c.table_name='operational_expenses' and c.column_name='frequency';
  if col_udt is not null and col_udt <> 'expense_frequency' then
    begin
      execute $sql$alter table public.operational_expenses alter column frequency type expense_frequency using frequency::expense_frequency$sql$;
    exception when others then
    end;
  end if;

  -- deductions.entry_date -> date
  select c.data_type into col_udt
  from information_schema.columns c
  where c.table_schema='public' and c.table_name='deductions' and c.column_name='entry_date';
  if col_udt is not null and col_udt <> 'date' then
    begin
      execute $sql$alter table public.deductions alter column entry_date type date using entry_date::date$sql$;
    exception when others then
    end;
  end if;

  -- operational_expenses.entry_date -> date
  select c.data_type into col_udt
  from information_schema.columns c
  where c.table_schema='public' and c.table_name='operational_expenses' and c.column_name='entry_date';
  if col_udt is not null and col_udt <> 'date' then
    begin
      execute $sql$alter table public.operational_expenses alter column entry_date type date using entry_date::date$sql$;
    exception when others then
    end;
  end if;
end $types$;

-- ----------------------- RLS: habilitar -----------------------
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

-- ----------------------- POLICIES (create-if-missing) -----------------------
do $policies$
begin
  -- companies
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='companies' and policyname='company access read') then
    execute $sql$create policy "company access read" on public.companies for select using (public.has_company_access(auth.uid(), id))$sql$;
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='companies' and policyname='company read platform admin') then
    execute $sql$create policy "company read platform admin" on public.companies for select using (exists (select 1 from public.app_admins a where a.user_id = auth.uid()))$sql$;
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='companies' and policyname='company write platform admin') then
    execute $sql$create policy "company write platform admin" on public.companies for update using (public.is_platform_admin(auth.uid())) with check (public.is_platform_admin(auth.uid()))$sql$;
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='companies' and policyname='company delete platform admin') then
    execute $sql$create policy "company delete platform admin" on public.companies for delete using (public.is_platform_admin(auth.uid()))$sql$;
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='companies' and policyname='company insert') then
    execute $sql$create policy "company insert" on public.companies for insert with check (auth.uid() is not null)$sql$;
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='companies' and policyname='company write') then
    execute $sql$create policy "company write" on public.companies for update using (public.has_company_access(auth.uid(), id)) with check (public.has_company_access(auth.uid(), id))$sql$;
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='companies' and policyname='company delete') then
    execute $sql$create policy "company delete" on public.companies for delete using (public.has_company_access(auth.uid(), id))$sql$;
  end if;

  -- user_companies
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='user_companies' and policyname='user_companies self read') then
    execute $sql$create policy "user_companies self read" on public.user_companies for select using (user_id = auth.uid())$sql$;
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='user_companies' and policyname='user_companies self insert') then
    execute $sql$create policy "user_companies self insert" on public.user_companies for insert with check (user_id = auth.uid())$sql$;
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='user_companies' and policyname='user_companies platform admin') then
    execute $sql$create policy "user_companies platform admin" on public.user_companies for all using (public.is_platform_admin(auth.uid())) with check (public.is_platform_admin(auth.uid()))$sql$;
  end if;

  -- app_admins
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='app_admins' and policyname='app_admins self read') then
    execute $sql$create policy "app_admins self read" on public.app_admins for select using (user_id = auth.uid())$sql$;
  end if;

  -- generic per-company tables
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='revenues' and policyname='rev access') then
    execute $sql$create policy "rev access" on public.revenues for all using (public.has_company_access(auth.uid(), company_id)) with check (public.has_company_access(auth.uid(), company_id))$sql$;
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='revenues' and policyname='rev platform admin') then
    execute $sql$create policy "rev platform admin" on public.revenues for all using (public.is_platform_admin(auth.uid())) with check (public.is_platform_admin(auth.uid()))$sql$;
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='deductions' and policyname='ded access') then
    execute $sql$create policy "ded access" on public.deductions for all using (public.has_company_access(auth.uid(), company_id)) with check (public.has_company_access(auth.uid(), company_id))$sql$;
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='deductions' and policyname='ded platform admin') then
    execute $sql$create policy "ded platform admin" on public.deductions for all using (public.is_platform_admin(auth.uid())) with check (public.is_platform_admin(auth.uid()))$sql$;
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='cmv_cpv_csp' and policyname='cmv access') then
    execute $sql$create policy "cmv access" on public.cmv_cpv_csp for all using (public.has_company_access(auth.uid(), company_id)) with check (public.has_company_access(auth.uid(), company_id))$sql$;
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='cmv_cpv_csp' and policyname='cmv platform admin') then
    execute $sql$create policy "cmv platform admin" on public.cmv_cpv_csp for all using (public.is_platform_admin(auth.uid())) with check (public.is_platform_admin(auth.uid()))$sql$;
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='operational_expenses' and policyname='exp access') then
    execute $sql$create policy "exp access" on public.operational_expenses for all using (public.has_company_access(auth.uid(), company_id)) with check (public.has_company_access(auth.uid(), company_id))$sql$;
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='operational_expenses' and policyname='exp platform admin') then
    execute $sql$create policy "exp platform admin" on public.operational_expenses for all using (public.is_platform_admin(auth.uid())) with check (public.is_platform_admin(auth.uid()))$sql$;
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='employees' and policyname='emp access') then
    execute $sql$create policy "emp access" on public.employees for all using (public.has_company_access(auth.uid(), company_id)) with check (public.has_company_access(auth.uid(), company_id))$sql$;
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='employees' and policyname='emp platform admin') then
    execute $sql$create policy "emp platform admin" on public.employees for all using (public.is_platform_admin(auth.uid())) with check (public.is_platform_admin(auth.uid()))$sql$;
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='chart_of_accounts' and policyname='coa access') then
    execute $sql$create policy "coa access" on public.chart_of_accounts for all using (public.has_company_access(auth.uid(), company_id)) with check (public.has_company_access(auth.uid(), company_id))$sql$;
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='chart_of_accounts' and policyname='coa platform admin') then
    execute $sql$create policy "coa platform admin" on public.chart_of_accounts for all using (public.is_platform_admin(auth.uid())) with check (public.is_platform_admin(auth.uid()))$sql$;
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='dre_results' and policyname='dre access') then
    execute $sql$create policy "dre access" on public.dre_results for all using (public.has_company_access(auth.uid(), company_id)) with check (public.has_company_access(auth.uid(), company_id))$sql$;
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='dre_results' and policyname='dre platform admin') then
    execute $sql$create policy "dre platform admin" on public.dre_results for all using (public.is_platform_admin(auth.uid())) with check (public.is_platform_admin(auth.uid()))$sql$;
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='dashboard_snapshots' and policyname='snap access') then
    execute $sql$create policy "snap access" on public.dashboard_snapshots for all using (public.has_company_access(auth.uid(), company_id)) with check (public.has_company_access(auth.uid(), company_id))$sql$;
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='dashboard_snapshots' and policyname='snap platform admin') then
    execute $sql$create policy "snap platform admin" on public.dashboard_snapshots for all using (public.is_platform_admin(auth.uid())) with check (public.is_platform_admin(auth.uid()))$sql$;
  end if;
end $policies$;
