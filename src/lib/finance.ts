import type { Employee, Revenue, Deduction, CmvEntry, Expense, Account } from "./store";

export const fmt = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);

export const fmtPct = (n: number) =>
  `${(n * 100).toFixed(1).replace(".", ",")}%`;

export function monthsBetween(from: string, to: Date) {
  const a = new Date(from);
  return Math.max(0, (to.getFullYear() - a.getFullYear()) * 12 + (to.getMonth() - a.getMonth()));
}

export function employeeCost(e: Employee) {
  const inss = e.salary * (e.inssRate / 100);
  const fgts = e.salary * (e.fgtsRate / 100);
  const months = Math.min(12, monthsBetween(e.admissionDate, new Date()) + 1);
  const decimo = (e.salary / 12) * Math.min(12, months);
  const ferias = (e.salary / 12) * Math.min(12, months) * (1 + 1 / 3);
  // Provisões mensais (montante anual / 12) — exibimos provisão mensal
  const decimoMensal = e.salary / 12;
  const feriasMensal = (e.salary / 12) * (1 + 1 / 3);
  return {
    inss,
    fgts,
    decimo,
    ferias,
    decimoMensal,
    feriasMensal,
    monthlyTotal: e.salary + inss + fgts + decimoMensal + feriasMensal,
  };
}

export function sumByMonth<T extends { competence: string; amount: number }>(items: T[]) {
  const map = new Map<string, number>();
  for (const i of items) map.set(i.competence, (map.get(i.competence) || 0) + i.amount);
  return map;
}

function norm(s: string): string {
  return (s || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

const payrollCombos: Array<{ group: string; subgroup: string; account: string }> = [
  { group: "Pessoal", subgroup: "Folha", account: "Salários" },
  { group: "Pessoal", subgroup: "Encargos", account: "FGTS" },
  { group: "Pessoal", subgroup: "Encargos", account: "INSS" },
  { group: "Pessoal", subgroup: "Provisão", account: "13º Salário" },
  { group: "Pessoal", subgroup: "Provisão", account: "Férias" },
];

const payrollKeySet = new Set(payrollCombos.map((c) => `${norm(c.group)}|${norm(c.subgroup)}|${norm(c.account)}`));

function isPayrollExpense(e: Expense): boolean {
  const key = `${norm(e.group)}|${norm(e.subgroup)}|${norm(e.account)}`;
  return payrollKeySet.has(key);
}

export interface DreLine {
  label: string;
  value: number;
  bold?: boolean;
  pct?: number;
  kind?: "subtotal" | "neg" | "pos";
}

export function buildDre(opts: {
  revenues: Revenue[];
  deductions: Deduction[];
  cmv: CmvEntry[];
  expenses: Expense[];
  employees: Employee[];
  accounts?: Account[];
  competence?: string; // YYYY-MM, optional filter
}): { lines: DreLine[]; receitaBruta: number; receitaLiquida: number; lucroBruto: number; ebitda: number; lucroLiquido: number; cmvTotal: number; gastosTotal: number; deducoesTotal: number; folhaTotal: number } {
  const f = (c: string) => !opts.competence || c === opts.competence;
  const receitaBruta = opts.revenues.filter((r) => f(r.competence)).reduce((s, r) => s + r.amount, 0);
  const deducoesTotal = opts.deductions.filter((d) => f(d.competence)).reduce((s, d) => s + d.amount, 0);
  const cmvTotal = opts.cmv.filter((c) => f(c.competence)).reduce((s, c) => s + c.amount, 0);
  const expensesTotal = opts.expenses.filter((e) => f(e.competence)).reduce((s, e) => s + e.amount, 0);
  // Funcionários não impactam a DRE automaticamente.
  // A "Folha" aqui é calculada a partir dos lançamentos manuais em Gastos Operacionais
  // usando combinações específicas (Grupo/Subgrupo/Conta).
  const folhaTotal = opts.expenses
    .filter((e) => f(e.competence) && isPayrollExpense(e))
    .reduce((s, e) => s + e.amount, 0);
  const gastosTotal = expensesTotal;
  const receitaLiquida = receitaBruta - deducoesTotal;
  const lucroBruto = receitaLiquida - cmvTotal;
  const ebitda = lucroBruto - gastosTotal;
  const accountsByName = new Map<string, Account>();
  for (const a of opts.accounts ?? []) {
    if (a?.name) accountsByName.set(norm(a.name), a);
  }
  const financeiroReceitas = opts.expenses
    .filter((e) => f(e.competence))
    .filter((e) => norm(e.group) === "financeiro" && norm(e.subgroup) === "receitas financeiras")
    .reduce((s, e) => s + e.amount, 0);

  const financeiroDespesas = opts.expenses
    .filter((e) => f(e.competence))
    .filter((e) => {
      const isFinancialGroup = norm(e.group) === "financeiro";
      const acc = accountsByName.get(norm(e.account));
      const isFinancialType = acc?.type === "Financeiro";
      if (!(isFinancialGroup || isFinancialType)) return false;
      // remove receitas financeiras (tratadas acima)
      return !(norm(e.group) === "financeiro" && norm(e.subgroup) === "receitas financeiras");
    })
    .reduce((s, e) => s + e.amount, 0);

  // Resultado Financeiro = Receitas Financeiras - Despesas Financeiras
  const resultadoFinanceiro = financeiroReceitas - financeiroDespesas;
  const lucroLiquido = ebitda + resultadoFinanceiro;

  const pct = (v: number) => (receitaLiquida ? v / receitaLiquida : 0);
  const lines: DreLine[] = [
    { label: "Receita Bruta", value: receitaBruta, bold: true },
    { label: "(-) Deduções", value: -deducoesTotal, kind: "neg", pct: pct(deducoesTotal) },
    { label: "= Receita Líquida", value: receitaLiquida, bold: true, kind: "subtotal" },
    { label: "(-) CMV", value: -cmvTotal, kind: "neg", pct: pct(cmvTotal) },
    { label: "= Lucro Bruto", value: lucroBruto, bold: true, kind: "subtotal", pct: pct(lucroBruto) },
    { label: "(-) Gastos Operacionais", value: -gastosTotal, kind: "neg", pct: pct(gastosTotal) },
    { label: "= EBITDA", value: ebitda, bold: true, kind: "subtotal", pct: pct(ebitda) },
    { label: "(+/-) Resultado Financeiro", value: resultadoFinanceiro },
    { label: "= Lucro Líquido", value: lucroLiquido, bold: true, kind: lucroLiquido >= 0 ? "pos" : "neg", pct: pct(lucroLiquido) },
  ];
  return { lines, receitaBruta, receitaLiquida, lucroBruto, ebitda, lucroLiquido, cmvTotal, gastosTotal, deducoesTotal, folhaTotal };
}

export function currentCompetence() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function lastNMonths(n: number) {
  const arr: string[] = [];
  const d = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const x = new Date(d.getFullYear(), d.getMonth() - i, 1);
    arr.push(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`);
  }
  return arr;
}
