import type { SupabaseClient } from "@supabase/supabase-js";
import type { Account, Company, CmvEntry, Deduction, Employee, Expense, Revenue } from "./store";

type CompanyRow = {
  id: string;
  name: string;
  cnpj: string | null;
  address: string | null;
  logo_url: string | null;
};

type UserCompanyRow = {
  company_id: string;
  role: "admin" | "manager" | "viewer";
  companies?: CompanyRow | CompanyRow[] | null;
};

type EmployeeRow = {
  id: string;
  company_id: string;
  name: string;
  cpf: string | null;
  role: string | null;
  admission_date: string;
  salary: number;
  inss_rate: number;
  fgts_rate: number;
};

type CoaRow = {
  id: string;
  company_id: string;
  name: string;
  group: string | null;
  subgroup: string | null;
  type: Account["type"];
  active: boolean;
  impacts_dre: boolean;
};

type RevenueRow = {
  id: string;
  company_id: string;
  competence: string;
  amount: number;
  type: string | null;
  revenue_kind: string | null;
  channel: string | null;
  product_or_service: string | null;
  frequency: string | null;
  impacts_dre: boolean | null;
  notes: string | null;
};

type DeductionRow = {
  id: string;
  company_id: string;
  competence: string;
  group: string | null;
  subgroup: string | null;
  type: string | null;
  account: string | null;
  amount: number;
  description: string | null;
  entry_date: string;
  notes: string | null;
};

type CmvRow = {
  id: string;
  company_id: string;
  competence: string;
  type: "CMV" | "CPV" | "CSP";
  amount: number;
  source: string | null;
  responsible: string | null;
  notes: string | null;
};

type ExpenseRow = {
  id: string;
  company_id: string;
  competence: string;
  group: string | null;
  subgroup: string | null;
  account: string | null;
  description: string | null;
  amount: number;
  recurrent: boolean;
  frequency: Expense["frequency"];
  responsible?: string | null;
  entry_date: string;
  notes: string | null;
};

const expenseFrequencies = ["Mensal", "Trimestral", "Anual", "Eventual"] as const;
type ExpenseFrequency = (typeof expenseFrequencies)[number];
function normalizeExpenseFrequency(v: unknown): ExpenseFrequency {
  return (expenseFrequencies as readonly string[]).includes(String(v)) ? (v as ExpenseFrequency) : "Mensal";
}

function normalizeCompetence(v: unknown): string {
  const s = String(v ?? "");
  // expected 'YYYY-MM' (7 chars); keep best-effort fallback to current year-month if invalid
  if (/^\d{4}-\d{2}$/.test(s)) return s;
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function normalizeDate(v: unknown): string {
  const s = String(v ?? "");
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return new Date().toISOString().slice(0, 10);
}

function toCompany(row: CompanyRow): Company {
  return {
    name: row.name ?? "",
    cnpj: row.cnpj ?? "",
    address: row.address ?? "",
    logo: row.logo_url ?? undefined,
  };
}

function toEmployee(row: EmployeeRow): Employee {
  return {
    id: row.id,
    name: row.name ?? "",
    cpf: row.cpf ?? "",
    role: row.role ?? "",
    admissionDate: row.admission_date,
    salary: Number(row.salary ?? 0),
    inssRate: Number(row.inss_rate ?? 0),
    fgtsRate: Number(row.fgts_rate ?? 0),
  };
}

function toAccount(row: CoaRow): Account {
  return {
    id: row.id,
    name: row.name ?? "",
    group: row.group ?? "",
    subgroup: row.subgroup ?? "",
    type: row.type,
    active: Boolean(row.active),
    impactsDre: Boolean(row.impacts_dre),
  };
}

function toRevenue(row: RevenueRow): Revenue {
  return {
    id: row.id,
    competence: row.competence,
    amount: Number(row.amount ?? 0),
    type: row.type ?? "",
    kind: row.revenue_kind ?? "",
    channel: row.channel ?? "",
    productOrService: row.product_or_service ?? "",
    frequency:
      row.frequency === "Trimestral" || row.frequency === "Anual" || row.frequency === "Eventual"
        ? (row.frequency as any)
        : "Mensal",
    impactsDre: row.impacts_dre ?? true,
    notes: row.notes ?? undefined,
  };
}

function toDeduction(row: DeductionRow): Deduction {
  return {
    id: row.id,
    competence: row.competence,
    group: row.group ?? "Deduções",
    subgroup: row.subgroup ?? "",
    type: row.type ?? "",
    account: row.account ?? "",
    amount: Number(row.amount ?? 0),
    description: row.description ?? "",
    date: row.entry_date,
    notes: row.notes ?? undefined,
  };
}

function toCmv(row: CmvRow): CmvEntry {
  return {
    id: row.id,
    competence: row.competence,
    type: row.type,
    amount: Number(row.amount ?? 0),
    source: row.source ?? undefined,
    responsible: row.responsible ?? undefined,
    notes: row.notes ?? undefined,
  };
}

function toExpense(row: ExpenseRow): Expense {
  return {
    id: row.id,
    competence: row.competence,
    group: row.group ?? "",
    subgroup: row.subgroup ?? "",
    account: row.account ?? "",
    description: row.description ?? "",
    amount: Number(row.amount ?? 0),
    recurrent: Boolean(row.recurrent),
    frequency: row.frequency ?? "Mensal",
    responsible: row.responsible ?? undefined,
    date: row.entry_date,
    notes: row.notes ?? undefined,
  };
}

function fromCompany(company: Company): Pick<CompanyRow, "name" | "cnpj" | "address" | "logo_url"> {
  return {
    name: company.name,
    cnpj: company.cnpj || null,
    address: company.address || null,
    logo_url: company.logo || null,
  };
}

function fromEmployee(companyId: string, e: Employee): EmployeeRow {
  return {
    id: e.id,
    company_id: companyId,
    name: e.name,
    cpf: e.cpf || null,
    role: e.role || null,
    admission_date: e.admissionDate,
    salary: e.salary,
    inss_rate: e.inssRate,
    fgts_rate: e.fgtsRate,
  };
}

function fromAccount(companyId: string, a: Account): CoaRow {
  return {
    id: a.id,
    company_id: companyId,
    name: a.name,
    group: a.group || null,
    subgroup: a.subgroup || null,
    type: a.type,
    active: a.active,
    impacts_dre: a.impactsDre,
  };
}

function fromRevenue(companyId: string, r: Revenue): RevenueRow {
  return {
    id: r.id,
    company_id: companyId,
    competence: r.competence,
    amount: r.amount,
    type: r.type || null,
    revenue_kind: r.kind || null,
    channel: r.channel || null,
    product_or_service: r.productOrService || null,
    frequency: r.frequency || "Mensal",
    impacts_dre: r.impactsDre ?? true,
    notes: r.notes || null,
  };
}

function fromDeduction(companyId: string, d: Deduction): DeductionRow {
  return {
    id: d.id,
    company_id: companyId,
    competence: d.competence,
    group: d.group || null,
    subgroup: d.subgroup || null,
    type: d.type || null,
    account: d.account || null,
    amount: d.amount,
    description: d.description || null,
    entry_date: d.date,
    notes: d.notes || null,
  };
}

function fromCmv(companyId: string, c: CmvEntry): CmvRow {
  return {
    id: c.id,
    company_id: companyId,
    competence: c.competence,
    type: c.type,
    amount: c.amount,
    source: c.source || null,
    responsible: c.responsible || null,
    notes: c.notes || null,
  };
}

function fromExpense(companyId: string, e: Expense): ExpenseRow {
  const base: ExpenseRow = {
    id: e.id,
    company_id: companyId,
    competence: normalizeCompetence(e.competence),
    group: e.group || null,
    subgroup: e.subgroup || null,
    account: e.account || null,
    description: e.description || null,
    amount: Number.isFinite(e.amount) ? e.amount : 0,
    recurrent: e.recurrent,
    frequency: normalizeExpenseFrequency(e.frequency),
    entry_date: normalizeDate(e.date),
    notes: e.notes || null,
  };

  // Some Supabase projects may not have this column (schema mismatch / cache not reloaded).
  // Omitting the key avoids PostgREST PGRST204 errors on upsert/insert.
  if (e.responsible && e.responsible.trim()) {
    base.responsible = e.responsible.trim();
  }

  return base;
}

export async function listMyCompanies(client: SupabaseClient): Promise<Array<{ companyId: string; role: UserCompanyRow["role"]; company: Company | null }>> {
  // Platform admin can access all companies (app_admins table acts as the allowlist)
  try {
    const { data: adminRow, error: adminErr } = await client.from("app_admins").select("user_id").maybeSingle();
    if (!adminErr && adminRow?.user_id) {
      const { data: companies, error: companiesErr } = await client.from("companies").select("id,name,cnpj,address,logo_url");
      if (companiesErr) throw companiesErr;
      return (companies ?? []).map((row: any) => ({
        companyId: String(row.id),
        role: "admin" as UserCompanyRow["role"],
        company: row ? toCompany(row as CompanyRow) : null,
      }));
    }
  } catch {
    // ignore and fallback to linked companies
  }

  const { data, error } = await client
    .from("user_companies")
    .select("company_id,role,companies:company_id(id,name,cnpj,address,logo_url)");
  if (error) throw error;
  return (data ?? []).map((row: any) => {
    const companies = (row as UserCompanyRow).companies;
    const companyRow = Array.isArray(companies) ? companies[0] : companies;
    return {
      companyId: String(row.company_id),
      role: row.role as UserCompanyRow["role"],
      company: companyRow ? toCompany(companyRow as CompanyRow) : null,
    };
  });
}

export async function createCompanyAndLink(client: SupabaseClient, company: Company): Promise<{ companyId: string }> {
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError) throw userError;
  const userId = userData.user?.id;
  if (!userId) throw new Error("Usuário não autenticado.");

  const { data: companyData, error: companyError } = await client
    .from("companies")
    .insert(fromCompany(company))
    .select("id")
    .single();
  if (companyError) throw companyError;
  const companyId = String((companyData as { id: string }).id);

  const { error: linkError } = await client.from("user_companies").insert({ user_id: userId, company_id: companyId, role: "admin" });
  if (linkError) throw linkError;

  return { companyId };
}

export async function pullAllCompanyData(client: SupabaseClient, companyId: string): Promise<{
  company: Company | null;
  employees: Employee[];
  accounts: Account[];
  revenues: Revenue[];
  deductions: Deduction[];
  cmv: CmvEntry[];
  expenses: Expense[];
}> {
  const companyRes = await client.from("companies").select("id,name,cnpj,address,logo_url").eq("id", companyId).maybeSingle();

  // Be generous: paginate tables to avoid truncation when the dataset grows.
  // Supabase/PostgREST commonly caps responses (e.g. 1000 rows) unless you page with range().
  async function pullAllRows(table: string, orderColumn: string = "id"): Promise<any[]> {
    const out: any[] = [];
    const pageSize = 1000;
    for (let offset = 0; offset < 200000; offset += pageSize) {
      const res = await client
        .from(table)
        .select("*")
        .eq("company_id", companyId)
        .order(orderColumn as any, { ascending: true })
        .range(offset, offset + pageSize - 1);
      if (res.error) throw res.error;
      const rows = res.data ?? [];
      out.push(...rows);
      if (rows.length < pageSize) break;
    }
    return out;
  }

  const [employeesRows, accountsRows, revenuesRows, deductionsRows, cmvRows, expensesRows] = await Promise.all([
    pullAllRows("employees"),
    pullAllRows("chart_of_accounts"),
    pullAllRows("revenues"),
    pullAllRows("deductions"),
    pullAllRows("cmv_cpv_csp"),
    pullAllRows("operational_expenses", "created_at"),
  ]);

  if (companyRes.error) throw companyRes.error;

  return {
    company: companyRes.data ? toCompany(companyRes.data as CompanyRow) : null,
    employees: (employeesRows ?? []).map((r) => toEmployee(r as EmployeeRow)),
    accounts: (accountsRows ?? []).map((r) => toAccount(r as CoaRow)),
    revenues: (revenuesRows ?? []).map((r) => toRevenue(r as RevenueRow)),
    deductions: (deductionsRows ?? []).map((r) => toDeduction(r as DeductionRow)),
    cmv: (cmvRows ?? []).map((r) => toCmv(r as CmvRow)),
    expenses: (expensesRows ?? []).map((r) => toExpense(r as ExpenseRow)),
  };
}

export async function pushAllCompanyData(
  client: SupabaseClient,
  companyId: string,
  payload: {
    company?: Company;
    employees?: Employee[];
    accounts?: Account[];
    revenues?: Revenue[];
    deductions?: Deduction[];
    cmv?: CmvEntry[];
    expenses?: Expense[];
  },
): Promise<void> {
  if (payload.company) {
    const { error } = await client.from("companies").update(fromCompany(payload.company)).eq("id", companyId);
    if (error) throw error;
  }

  if (payload.employees) {
    const { error } = await client.from("employees").upsert(payload.employees.map((e) => fromEmployee(companyId, e)), { onConflict: "id" });
    if (error) throw error;
  }
  if (payload.accounts) {
    const { error } = await client.from("chart_of_accounts").upsert(payload.accounts.map((a) => fromAccount(companyId, a)), { onConflict: "id" });
    if (error) throw error;
  }
  if (payload.revenues) {
    const { error } = await client.from("revenues").upsert(payload.revenues.map((r) => fromRevenue(companyId, r)), { onConflict: "id" });
    if (error) throw error;
  }
  if (payload.deductions) {
    const { error } = await client.from("deductions").upsert(payload.deductions.map((d) => fromDeduction(companyId, d)), { onConflict: "id" });
    if (error) throw error;
  }
  if (payload.cmv) {
    const { error } = await client.from("cmv_cpv_csp").upsert(payload.cmv.map((c) => fromCmv(companyId, c)), { onConflict: "id" });
    if (error) throw error;
  }
  if (payload.expenses) {
    const { error } = await client.from("operational_expenses").upsert(payload.expenses.map((e) => fromExpense(companyId, e)), { onConflict: "id" });
    if (error) throw error;
  }
}
