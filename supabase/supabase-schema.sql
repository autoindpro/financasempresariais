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

-- Role helpers (viewer/manager/admin)
create or replace function public.company_role(_user_id uuid, _company_id uuid)
returns public.app_role
language sql stable security definer set search_path = public as $$
  select uc.role
  from public.user_companies uc
  where uc.user_id = _user_id and uc.company_id = _company_id
  limit 1;
$$;

create or replace function public.has_company_role(_user_id uuid, _company_id uuid, _roles public.app_role[])
returns boolean
language sql stable security definer set search_path = public as $$
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
language sql stable security definer set search_path = public as $$
  select
    public.is_platform_admin(auth.uid())
    or public.has_company_role(auth.uid(), _company_id, array['manager','admin']::public.app_role[]);
$$;

create or replace function public.can_company_admin(_company_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select
    public.is_platform_admin(auth.uid())
    or public.has_company_role(auth.uid(), _company_id, array['admin']::public.app_role[]);
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
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz default now()
);

-- ----------------------- REVENUES -----------------------
create table public.revenues (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  competence char(7) not null, -- 'YYYY-MM'
  amount numeric(14,2) not null,
  type text,
  revenue_kind text,
  channel text,
  product_or_service text,
  frequency expense_frequency not null default 'Mensal',
  impacts_dre boolean not null default true,
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
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz default now(),
  unique (company_id, key, value)
);
create index on public.option_values (company_id, key);
create index on public.option_values (company_id, key, created_by);

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

-- Permite criar empresas apenas para admin da plataforma (gerenciamento é feito no Supabase).
create policy "company insert platform admin" on public.companies
  for insert with check (public.is_platform_admin(auth.uid()));

-- Permite editar/deletar empresas apenas se o usuário tiver vínculo.
create policy "company write manager" on public.companies
  for update using (public.can_company_write(id))
  with check (public.can_company_write(id));

create policy "company delete admin" on public.companies
  for delete using (public.can_company_admin(id));

create policy "user_companies self read" on public.user_companies
  for select using (user_id = auth.uid());

-- Vínculos são gerenciados pelo admin da plataforma
create policy "user_companies insert platform admin" on public.user_companies
  for insert with check (public.is_platform_admin(auth.uid()));

create policy "user_companies update platform admin" on public.user_companies
  for update using (public.is_platform_admin(auth.uid()))
  with check (public.is_platform_admin(auth.uid()));

create policy "user_companies delete platform admin" on public.user_companies
  for delete using (public.is_platform_admin(auth.uid()));

-- Admin global pode gerenciar vínculos (para dar acesso a outras pessoas)
create policy "user_companies platform admin" on public.user_companies
  for all using (public.is_platform_admin(auth.uid()))
  with check (public.is_platform_admin(auth.uid()));

-- app_admins: cada admin pode ver a própria linha; (inserção é feita manualmente no painel/SQL)
create policy "app_admins self read" on public.app_admins
  for select using (user_id = auth.uid());

-- Políticas por papel:
-- viewer: read-only
-- manager/admin: read + write

create policy "rev read" on public.revenues
  for select using (public.is_platform_admin(auth.uid()) or public.has_company_access(auth.uid(), company_id));
create policy "rev write" on public.revenues
  for insert with check (public.can_company_write(company_id));
create policy "rev update" on public.revenues
  for update using (public.can_company_write(company_id)) with check (public.can_company_write(company_id));
create policy "rev delete" on public.revenues
  for delete using (public.can_company_write(company_id));

create policy "ded read" on public.deductions
  for select using (public.is_platform_admin(auth.uid()) or public.has_company_access(auth.uid(), company_id));
create policy "ded write" on public.deductions
  for insert with check (public.can_company_write(company_id));
create policy "ded update" on public.deductions
  for update using (public.can_company_write(company_id)) with check (public.can_company_write(company_id));
create policy "ded delete" on public.deductions
  for delete using (public.can_company_write(company_id));

create policy "cmv read" on public.cmv_cpv_csp
  for select using (public.is_platform_admin(auth.uid()) or public.has_company_access(auth.uid(), company_id));
create policy "cmv write" on public.cmv_cpv_csp
  for insert with check (public.can_company_write(company_id));
create policy "cmv update" on public.cmv_cpv_csp
  for update using (public.can_company_write(company_id)) with check (public.can_company_write(company_id));
create policy "cmv delete" on public.cmv_cpv_csp
  for delete using (public.can_company_write(company_id));

create policy "exp read" on public.operational_expenses
  for select using (public.is_platform_admin(auth.uid()) or public.has_company_access(auth.uid(), company_id));
create policy "exp write" on public.operational_expenses
  for insert with check (public.can_company_write(company_id));
create policy "exp update" on public.operational_expenses
  for update using (public.can_company_write(company_id)) with check (public.can_company_write(company_id));
create policy "exp delete" on public.operational_expenses
  for delete using (public.can_company_write(company_id));

create policy "emp read" on public.employees
  for select using (public.is_platform_admin(auth.uid()) or public.has_company_access(auth.uid(), company_id));
create policy "emp write" on public.employees
  for insert with check (public.can_company_write(company_id));
create policy "emp update" on public.employees
  for update using (public.can_company_write(company_id)) with check (public.can_company_write(company_id));
create policy "emp delete" on public.employees
  for delete using (public.can_company_write(company_id));

create policy "coa read" on public.chart_of_accounts
  for select using (
    public.is_platform_admin(auth.uid())
    or public.can_company_admin(company_id)
    or (
      public.has_company_access(auth.uid(), company_id)
      and (created_by is null or created_by = auth.uid())
    )
  );
create policy "coa write" on public.chart_of_accounts
  for insert with check (public.can_company_write(company_id) and created_by = auth.uid());
create policy "coa update" on public.chart_of_accounts
  for update using (
    public.can_company_write(company_id)
    and (public.can_company_admin(company_id) or created_by = auth.uid())
  )
  with check (
    public.can_company_write(company_id)
    and (public.can_company_admin(company_id) or created_by = auth.uid())
  );
create policy "coa delete" on public.chart_of_accounts
  for delete using (
    public.can_company_write(company_id)
    and (public.can_company_admin(company_id) or created_by = auth.uid())
  );

create policy "dre read" on public.dre_results
  for select using (public.is_platform_admin(auth.uid()) or public.has_company_access(auth.uid(), company_id));
create policy "dre write" on public.dre_results
  for insert with check (public.can_company_write(company_id));
create policy "dre update" on public.dre_results
  for update using (public.can_company_write(company_id)) with check (public.can_company_write(company_id));
create policy "dre delete" on public.dre_results
  for delete using (public.can_company_write(company_id));

create policy "snap read" on public.dashboard_snapshots
  for select using (public.is_platform_admin(auth.uid()) or public.has_company_access(auth.uid(), company_id));
create policy "snap write" on public.dashboard_snapshots
  for insert with check (public.can_company_write(company_id));
create policy "snap update" on public.dashboard_snapshots
  for update using (public.can_company_write(company_id)) with check (public.can_company_write(company_id));
create policy "snap delete" on public.dashboard_snapshots
  for delete using (public.can_company_write(company_id));

create policy "bank_accounts read" on public.bank_accounts
  for select using (public.is_platform_admin(auth.uid()) or public.has_company_access(auth.uid(), company_id));
create policy "bank_accounts write" on public.bank_accounts
  for insert with check (public.can_company_write(company_id));
create policy "bank_accounts update" on public.bank_accounts
  for update using (public.can_company_write(company_id)) with check (public.can_company_write(company_id));
create policy "bank_accounts delete" on public.bank_accounts
  for delete using (public.can_company_write(company_id));

create policy "bank_tx read" on public.bank_transactions
  for select using (public.is_platform_admin(auth.uid()) or public.has_company_access(auth.uid(), company_id));
create policy "bank_tx write" on public.bank_transactions
  for insert with check (public.can_company_write(company_id));
create policy "bank_tx update" on public.bank_transactions
  for update using (public.can_company_write(company_id)) with check (public.can_company_write(company_id));
create policy "bank_tx delete" on public.bank_transactions
  for delete using (public.can_company_write(company_id));

create policy "cashflow read" on public.cashflow_entries
  for select using (public.is_platform_admin(auth.uid()) or public.has_company_access(auth.uid(), company_id));
create policy "cashflow write" on public.cashflow_entries
  for insert with check (public.can_company_write(company_id));
create policy "cashflow update" on public.cashflow_entries
  for update using (public.can_company_write(company_id)) with check (public.can_company_write(company_id));
create policy "cashflow delete" on public.cashflow_entries
  for delete using (public.can_company_write(company_id));

create policy "options read" on public.option_values
  for select using (
    public.is_platform_admin(auth.uid())
    or public.can_company_admin(company_id)
    or (
      public.has_company_access(auth.uid(), company_id)
      and (created_by is null or created_by = auth.uid())
    )
  );
create policy "options write" on public.option_values
  for insert with check (public.can_company_write(company_id) and created_by = auth.uid());
create policy "options update" on public.option_values
  for update using (
    public.can_company_write(company_id)
    and (public.can_company_admin(company_id) or created_by = auth.uid())
  )
  with check (
    public.can_company_write(company_id)
    and (public.can_company_admin(company_id) or created_by = auth.uid())
  );
create policy "options delete" on public.option_values
  for delete using (
    public.can_company_write(company_id)
    and (public.can_company_admin(company_id) or created_by = auth.uid())
  );
