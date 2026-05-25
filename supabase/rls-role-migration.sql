-- Role-based access control for Flux Soluções (viewer/manager/admin)
-- Apply this in Supabase SQL Editor AFTER running supabase-schema.sql (or on an existing project).

-- Helper: return the role of a user in a company (or null if no link)
create or replace function public.company_role(_user_id uuid, _company_id uuid)
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select uc.role
  from public.user_companies uc
  where uc.user_id = _user_id
    and uc.company_id = _company_id
  limit 1;
$$;

create or replace function public.has_company_role(_user_id uuid, _company_id uuid, _roles public.app_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_companies uc
    where uc.user_id = _user_id
      and uc.company_id = _company_id
      and uc.role = any (_roles)
  );
$$;

create or replace function public.can_company_write(_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_platform_admin(auth.uid())
    or public.has_company_role(auth.uid(), _company_id, array['manager','admin']::public.app_role[]);
$$;

create or replace function public.can_company_admin(_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_platform_admin(auth.uid())
    or public.has_company_role(auth.uid(), _company_id, array['admin']::public.app_role[]);
$$;

-- Companies
drop policy if exists "company insert" on public.companies;
drop policy if exists "company write" on public.companies;
drop policy if exists "company delete" on public.companies;

-- Only platform admin creates/deletes companies (you manage links manually)
create policy "company insert platform admin" on public.companies
  for insert
  with check (public.is_platform_admin(auth.uid()));

create policy "company delete admin" on public.companies
  for delete
  using (public.can_company_admin(id));

-- Managers/admins can update their own company's profile (Perfil da Empresa)
create policy "company write manager" on public.companies
  for update
  using (public.can_company_write(id))
  with check (public.can_company_write(id));

-- user_companies: lock down inserts/updates/deletes to platform admin (managed in Supabase)
drop policy if exists "user_companies self insert" on public.user_companies;
create policy "user_companies insert platform admin" on public.user_companies
  for insert
  with check (public.is_platform_admin(auth.uid()));

create policy "user_companies update platform admin" on public.user_companies
  for update
  using (public.is_platform_admin(auth.uid()))
  with check (public.is_platform_admin(auth.uid()));

create policy "user_companies delete platform admin" on public.user_companies
  for delete
  using (public.is_platform_admin(auth.uid()));

-- Replace generic "for all" policies with read vs write
-- Revenues
drop policy if exists "rev access" on public.revenues;
drop policy if exists "rev platform admin" on public.revenues;
create policy "rev read" on public.revenues
  for select using (public.is_platform_admin(auth.uid()) or public.has_company_access(auth.uid(), company_id));
create policy "rev write" on public.revenues
  for insert with check (public.can_company_write(company_id));
create policy "rev update" on public.revenues
  for update using (public.can_company_write(company_id)) with check (public.can_company_write(company_id));
create policy "rev delete" on public.revenues
  for delete using (public.can_company_write(company_id));

-- Deductions
drop policy if exists "ded access" on public.deductions;
drop policy if exists "ded platform admin" on public.deductions;
create policy "ded read" on public.deductions
  for select using (public.is_platform_admin(auth.uid()) or public.has_company_access(auth.uid(), company_id));
create policy "ded write" on public.deductions
  for insert with check (public.can_company_write(company_id));
create policy "ded update" on public.deductions
  for update using (public.can_company_write(company_id)) with check (public.can_company_write(company_id));
create policy "ded delete" on public.deductions
  for delete using (public.can_company_write(company_id));

-- CMV / CPV / CSP
drop policy if exists "cmv access" on public.cmv_cpv_csp;
drop policy if exists "cmv platform admin" on public.cmv_cpv_csp;
create policy "cmv read" on public.cmv_cpv_csp
  for select using (public.is_platform_admin(auth.uid()) or public.has_company_access(auth.uid(), company_id));
create policy "cmv write" on public.cmv_cpv_csp
  for insert with check (public.can_company_write(company_id));
create policy "cmv update" on public.cmv_cpv_csp
  for update using (public.can_company_write(company_id)) with check (public.can_company_write(company_id));
create policy "cmv delete" on public.cmv_cpv_csp
  for delete using (public.can_company_write(company_id));

-- Operational expenses
drop policy if exists "exp access" on public.operational_expenses;
drop policy if exists "exp platform admin" on public.operational_expenses;
create policy "exp read" on public.operational_expenses
  for select using (public.is_platform_admin(auth.uid()) or public.has_company_access(auth.uid(), company_id));
create policy "exp write" on public.operational_expenses
  for insert with check (public.can_company_write(company_id));
create policy "exp update" on public.operational_expenses
  for update using (public.can_company_write(company_id)) with check (public.can_company_write(company_id));
create policy "exp delete" on public.operational_expenses
  for delete using (public.can_company_write(company_id));

-- Employees
drop policy if exists "emp access" on public.employees;
drop policy if exists "emp platform admin" on public.employees;
create policy "emp read" on public.employees
  for select using (public.is_platform_admin(auth.uid()) or public.has_company_access(auth.uid(), company_id));
create policy "emp write" on public.employees
  for insert with check (public.can_company_write(company_id));
create policy "emp update" on public.employees
  for update using (public.can_company_write(company_id)) with check (public.can_company_write(company_id));
create policy "emp delete" on public.employees
  for delete using (public.can_company_write(company_id));

-- Chart of accounts
drop policy if exists "coa access" on public.chart_of_accounts;
drop policy if exists "coa platform admin" on public.chart_of_accounts;
create policy "coa read" on public.chart_of_accounts
  for select using (public.is_platform_admin(auth.uid()) or public.has_company_access(auth.uid(), company_id));
create policy "coa write" on public.chart_of_accounts
  for insert with check (public.can_company_write(company_id));
create policy "coa update" on public.chart_of_accounts
  for update using (public.can_company_write(company_id)) with check (public.can_company_write(company_id));
create policy "coa delete" on public.chart_of_accounts
  for delete using (public.can_company_write(company_id));

-- DRE results
drop policy if exists "dre access" on public.dre_results;
drop policy if exists "dre platform admin" on public.dre_results;
create policy "dre read" on public.dre_results
  for select using (public.is_platform_admin(auth.uid()) or public.has_company_access(auth.uid(), company_id));
create policy "dre write" on public.dre_results
  for insert with check (public.can_company_write(company_id));
create policy "dre update" on public.dre_results
  for update using (public.can_company_write(company_id)) with check (public.can_company_write(company_id));
create policy "dre delete" on public.dre_results
  for delete using (public.can_company_write(company_id));

-- Dashboard snapshots
drop policy if exists "snap access" on public.dashboard_snapshots;
drop policy if exists "snap platform admin" on public.dashboard_snapshots;
create policy "snap read" on public.dashboard_snapshots
  for select using (public.is_platform_admin(auth.uid()) or public.has_company_access(auth.uid(), company_id));
create policy "snap write" on public.dashboard_snapshots
  for insert with check (public.can_company_write(company_id));
create policy "snap update" on public.dashboard_snapshots
  for update using (public.can_company_write(company_id)) with check (public.can_company_write(company_id));
create policy "snap delete" on public.dashboard_snapshots
  for delete using (public.can_company_write(company_id));

-- Bank accounts
drop policy if exists "bank_accounts access" on public.bank_accounts;
drop policy if exists "bank_accounts platform admin" on public.bank_accounts;
create policy "bank_accounts read" on public.bank_accounts
  for select using (public.is_platform_admin(auth.uid()) or public.has_company_access(auth.uid(), company_id));
create policy "bank_accounts write" on public.bank_accounts
  for insert with check (public.can_company_write(company_id));
create policy "bank_accounts update" on public.bank_accounts
  for update using (public.can_company_write(company_id)) with check (public.can_company_write(company_id));
create policy "bank_accounts delete" on public.bank_accounts
  for delete using (public.can_company_write(company_id));

-- Bank transactions
drop policy if exists "bank_tx access" on public.bank_transactions;
drop policy if exists "bank_tx platform admin" on public.bank_transactions;
create policy "bank_tx read" on public.bank_transactions
  for select using (public.is_platform_admin(auth.uid()) or public.has_company_access(auth.uid(), company_id));
create policy "bank_tx write" on public.bank_transactions
  for insert with check (public.can_company_write(company_id));
create policy "bank_tx update" on public.bank_transactions
  for update using (public.can_company_write(company_id)) with check (public.can_company_write(company_id));
create policy "bank_tx delete" on public.bank_transactions
  for delete using (public.can_company_write(company_id));

-- Cashflow entries
drop policy if exists "cashflow access" on public.cashflow_entries;
drop policy if exists "cashflow platform admin" on public.cashflow_entries;
create policy "cashflow read" on public.cashflow_entries
  for select using (public.is_platform_admin(auth.uid()) or public.has_company_access(auth.uid(), company_id));
create policy "cashflow write" on public.cashflow_entries
  for insert with check (public.can_company_write(company_id));
create policy "cashflow update" on public.cashflow_entries
  for update using (public.can_company_write(company_id)) with check (public.can_company_write(company_id));
create policy "cashflow delete" on public.cashflow_entries
  for delete using (public.can_company_write(company_id));

-- Option values
drop policy if exists "options access" on public.option_values;
drop policy if exists "options platform admin" on public.option_values;
create policy "options read" on public.option_values
  for select using (public.is_platform_admin(auth.uid()) or public.has_company_access(auth.uid(), company_id));
create policy "options write" on public.option_values
  for insert with check (public.can_company_write(company_id));
create policy "options update" on public.option_values
  for update using (public.can_company_write(company_id)) with check (public.can_company_write(company_id));
create policy "options delete" on public.option_values
  for delete using (public.can_company_write(company_id));

