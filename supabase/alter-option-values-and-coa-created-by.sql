-- Add per-user visibility for option_values and chart_of_accounts.
-- Rows with created_by IS NULL are "global" (visible to all company members).
-- Rows with created_by set are visible only to the creator and company/platform admins.

alter table public.option_values
  add column if not exists created_by uuid references auth.users(id) default auth.uid();

create index if not exists option_values_company_key_created_by_idx
  on public.option_values (company_id, key, created_by);

alter table public.chart_of_accounts
  add column if not exists created_by uuid references auth.users(id) default auth.uid();

create index if not exists chart_of_accounts_company_created_by_idx
  on public.chart_of_accounts (company_id, created_by);

-- Recreate RLS policies with creator-scoped reads.

drop policy if exists "options read" on public.option_values;
create policy "options read" on public.option_values
  for select using (
    public.is_platform_admin(auth.uid())
    or public.can_company_admin(company_id)
    or (
      public.has_company_access(auth.uid(), company_id)
      and (created_by is null or created_by = auth.uid())
    )
  );

drop policy if exists "options write" on public.option_values;
create policy "options write" on public.option_values
  for insert with check (
    public.can_company_write(company_id)
    and created_by = auth.uid()
  );

drop policy if exists "options update" on public.option_values;
create policy "options update" on public.option_values
  for update using (
    public.can_company_write(company_id)
    and (public.can_company_admin(company_id) or created_by = auth.uid())
  )
  with check (
    public.can_company_write(company_id)
    and (public.can_company_admin(company_id) or created_by = auth.uid())
  );

drop policy if exists "options delete" on public.option_values;
create policy "options delete" on public.option_values
  for delete using (
    public.can_company_write(company_id)
    and (public.can_company_admin(company_id) or created_by = auth.uid())
  );

drop policy if exists "coa read" on public.chart_of_accounts;
create policy "coa read" on public.chart_of_accounts
  for select using (
    public.is_platform_admin(auth.uid())
    or public.can_company_admin(company_id)
    or (
      public.has_company_access(auth.uid(), company_id)
      and (created_by is null or created_by = auth.uid())
    )
  );

drop policy if exists "coa write" on public.chart_of_accounts;
create policy "coa write" on public.chart_of_accounts
  for insert with check (
    public.can_company_write(company_id)
    and created_by = auth.uid()
  );

drop policy if exists "coa update" on public.chart_of_accounts;
create policy "coa update" on public.chart_of_accounts
  for update using (
    public.can_company_write(company_id)
    and (public.can_company_admin(company_id) or created_by = auth.uid())
  )
  with check (
    public.can_company_write(company_id)
    and (public.can_company_admin(company_id) or created_by = auth.uid())
  );

drop policy if exists "coa delete" on public.chart_of_accounts;
create policy "coa delete" on public.chart_of_accounts
  for delete using (
    public.can_company_write(company_id)
    and (public.can_company_admin(company_id) or created_by = auth.uid())
  );

