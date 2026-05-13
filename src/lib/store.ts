import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ID = string;
export const uid = () => {
  try {
    return globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2, 11);
  } catch {
    return Math.random().toString(36).slice(2, 11);
  }
};

export interface Company {
  name: string;
  cnpj: string;
  address: string;
  logo?: string;
}

export interface Employee {
  id: ID;
  name: string;
  cpf: string;
  role: string;
  admissionDate: string;
  salary: number;
  inssRate: number; // %
  fgtsRate: number; // %
}

export interface Account {
  id: ID;
  name: string;
  group: string;
  subgroup: string;
  type: "Receita" | "Custo" | "Gasto" | "Financeiro" | "Investimento" | "Deduções";
  active: boolean;
  impactsDre: boolean;
}

export interface Revenue {
  id: ID;
  competence: string; // YYYY-MM
  amount: number;
  type: string;
  channel: string;
  notes?: string;
}

export interface Deduction {
  id: ID;
  competence: string;
  group: string;
  subgroup: string;
  type: string;
  account: string;
  amount: number;
  description: string;
  date: string;
  notes?: string;
}

export interface CmvEntry {
  id: ID;
  competence: string;
  type: "CMV" | "CPV" | "CSP";
  amount: number;
  source?: string;
  responsible?: string;
  notes?: string;
}

export interface Expense {
  id: ID;
  competence: string;
  group: string;
  subgroup: string;
  account: string;
  description: string;
  amount: number;
  recurrent: boolean;
  frequency: "Mensal" | "Trimestral" | "Anual" | "Eventual";
  responsible?: string;
  date: string;
  notes?: string;
}

interface OptionLists {
  revenueTypes: string[];
  channels: string[];
  deductionTypes: string[];
  deductionAccounts: string[];
  expenseGroups: string[];
  expenseSubgroups: string[];
  roles: string[];
}

interface State {
  company: Company;
  employees: Employee[];
  accounts: Account[];
  revenues: Revenue[];
  deductions: Deduction[];
  cmv: CmvEntry[];
  expenses: Expense[];
  options: OptionLists;
  onboardingCompleted: boolean;
  setCompany: (c: Partial<Company>) => void;
  addEmployee: (e: Omit<Employee, "id">) => void;
  updateEmployee: (id: ID, e: Partial<Employee>) => void;
  removeEmployee: (id: ID) => void;
  addAccount: (a: Omit<Account, "id">) => void;
  updateAccount: (id: ID, a: Partial<Account>) => void;
  removeAccount: (id: ID) => void;
  addRevenue: (r: Omit<Revenue, "id">) => void;
  updateRevenue: (id: ID, r: Partial<Revenue>) => void;
  removeRevenue: (id: ID) => void;
  addDeduction: (d: Omit<Deduction, "id">) => void;
  updateDeduction: (id: ID, d: Partial<Deduction>) => void;
  removeDeduction: (id: ID) => void;
  addCmv: (c: Omit<CmvEntry, "id">) => void;
  updateCmv: (id: ID, c: Partial<CmvEntry>) => void;
  removeCmv: (id: ID) => void;
  addExpense: (e: Omit<Expense, "id">) => void;
  updateExpense: (id: ID, e: Partial<Expense>) => void;
  removeExpense: (id: ID) => void;
  addOption: (key: keyof OptionLists, value: string) => void;
  setOnboardingCompleted: (v: boolean) => void;
  reset: () => void;
}

const defaultAccounts: Account[] = [
  { id: uid(), name: "Receita de Vendas", group: "Receita", subgroup: "Operacional", type: "Receita", active: true, impactsDre: true },
  { id: uid(), name: "Simples Nacional", group: "Deduções", subgroup: "Impostos", type: "Gasto", active: true, impactsDre: true },
  { id: uid(), name: "ICMS", group: "Deduções", subgroup: "Impostos", type: "Gasto", active: true, impactsDre: true },
  { id: uid(), name: "Taxas de Maquininha", group: "Deduções", subgroup: "Taxas Comerciais", type: "Deduções", active: true, impactsDre: true },
  { id: uid(), name: "Salários", group: "Pessoal", subgroup: "Folha", type: "Gasto", active: true, impactsDre: true },
  { id: uid(), name: "FGTS", group: "Pessoal", subgroup: "Encargos", type: "Gasto", active: true, impactsDre: true },
  { id: uid(), name: "INSS", group: "Pessoal", subgroup: "Encargos", type: "Gasto", active: true, impactsDre: true },
  { id: uid(), name: "13º Salário", group: "Pessoal", subgroup: "Provisão", type: "Gasto", active: true, impactsDre: true },
  { id: uid(), name: "Férias", group: "Pessoal", subgroup: "Provisão", type: "Gasto", active: true, impactsDre: true },
  { id: uid(), name: "Vale Refeição", group: "Pessoal", subgroup: "Benefícios", type: "Gasto", active: true, impactsDre: true },
  { id: uid(), name: "Vale Alimentação", group: "Pessoal", subgroup: "Benefícios", type: "Gasto", active: true, impactsDre: true },
  { id: uid(), name: "Vale Transporte", group: "Pessoal", subgroup: "Benefícios", type: "Gasto", active: true, impactsDre: true },
  { id: uid(), name: "Vale Gás", group: "Pessoal", subgroup: "Benefícios", type: "Gasto", active: true, impactsDre: true },
  { id: uid(), name: "Bonificação", group: "Pessoal", subgroup: "Benefícios", type: "Gasto", active: true, impactsDre: true },
  { id: uid(), name: "Auxílio Creche", group: "Pessoal", subgroup: "Benefícios", type: "Gasto", active: true, impactsDre: true },
  { id: uid(), name: "Auxílio Material Escolar", group: "Pessoal", subgroup: "Benefícios", type: "Gasto", active: true, impactsDre: true },
  { id: uid(), name: "Treinamentos", group: "Pessoal", subgroup: "Capacitação", type: "Gasto", active: true, impactsDre: true },
  { id: uid(), name: "Aluguel", group: "Ocupação", subgroup: "Imóvel", type: "Gasto", active: true, impactsDre: true },
  { id: uid(), name: "IPTU", group: "Ocupação", subgroup: "Imóvel", type: "Gasto", active: true, impactsDre: true },
  { id: uid(), name: "Bombeiros", group: "Ocupação", subgroup: "Imóvel", type: "Gasto", active: true, impactsDre: true },
  { id: uid(), name: "Segurança Privada", group: "Ocupação", subgroup: "Imóvel", type: "Gasto", active: true, impactsDre: true },
  { id: uid(), name: "Seguros", group: "Ocupação", subgroup: "Imóvel", type: "Gasto", active: true, impactsDre: true },
  { id: uid(), name: "Energia Elétrica", group: "Ocupação", subgroup: "Utilidades", type: "Gasto", active: true, impactsDre: true },
  { id: uid(), name: "Água e Esgoto", group: "Ocupação", subgroup: "Utilidades", type: "Gasto", active: true, impactsDre: true },
  { id: uid(), name: "Gás", group: "Ocupação", subgroup: "Utilidades", type: "Gasto", active: true, impactsDre: true },
  { id: uid(), name: "Internet", group: "Ocupação", subgroup: "Utilidades", type: "Gasto", active: true, impactsDre: true },
  { id: uid(), name: "Telefone", group: "Ocupação", subgroup: "Utilidades", type: "Gasto", active: true, impactsDre: true },
  { id: uid(), name: "Material de Limpeza", group: "Ocupação", subgroup: "Conservação e Limpeza", type: "Gasto", active: true, impactsDre: true },
  { id: uid(), name: "Controle de Pragas", group: "Ocupação", subgroup: "Conservação e Limpeza", type: "Gasto", active: true, impactsDre: true },
  { id: uid(), name: "Manutenção Predial", group: "Ocupação", subgroup: "Conservação e Limpeza", type: "Gasto", active: true, impactsDre: true },
  { id: uid(), name: "Uber", group: "Ocupação", subgroup: "Deslocamento", type: "Gasto", active: true, impactsDre: true },
  { id: uid(), name: "Combustível", group: "Ocupação", subgroup: "Deslocamento", type: "Gasto", active: true, impactsDre: true },
  { id: uid(), name: "Estacionamento", group: "Ocupação", subgroup: "Deslocamento", type: "Gasto", active: true, impactsDre: true },
  { id: uid(), name: "Material de Escritório", group: "Administrativo", subgroup: "Suprimentos Administrativos", type: "Gasto", active: true, impactsDre: true },
  { id: uid(), name: "Correios", group: "Serviços de Terceiros", subgroup: "Administrativo", type: "Gasto", active: true, impactsDre: true },
  { id: uid(), name: "Cartório", group: "Serviços de Terceiros", subgroup: "Administrativo", type: "Gasto", active: true, impactsDre: true },
  { id: uid(), name: "Consultoria", group: "Serviços de Terceiros", subgroup: "Consultoria Especializada", type: "Gasto", active: true, impactsDre: true },
  { id: uid(), name: "Contabilidade", group: "Serviços de Terceiros", subgroup: "Serviços Contábeis", type: "Gasto", active: true, impactsDre: true },
  { id: uid(), name: "Manutenção de Equipamentos", group: "Serviços de Terceiros", subgroup: "Manutenção", type: "Gasto", active: true, impactsDre: true },
  { id: uid(), name: "Marketing Digital", group: "Marketing", subgroup: "Estratégia Digital", type: "Gasto", active: true, impactsDre: true },
  { id: uid(), name: "Tráfego Pago", group: "Marketing", subgroup: "Mídia Paga", type: "Gasto", active: true, impactsDre: true },
  { id: uid(), name: "Social Mídia", group: "Marketing", subgroup: "Gestão de Redes Sociais", type: "Gasto", active: true, impactsDre: true },
  { id: uid(), name: "Softwares", group: "Tecnologia", subgroup: "Assinaturas", type: "Gasto", active: true, impactsDre: true },
  { id: uid(), name: "Inteligência Artificial", group: "Tecnologia", subgroup: "Assinaturas", type: "Gasto", active: true, impactsDre: true },
  { id: uid(), name: "Site (Hospedagem/Domínio)", group: "Tecnologia", subgroup: "Infraestrutura Web", type: "Gasto", active: true, impactsDre: true },
  { id: uid(), name: "Juros de Empréstimos", group: "Financeiro", subgroup: "Encargos Financeiros", type: "Financeiro", active: true, impactsDre: true },
  { id: uid(), name: "Juros de Parcelamentos", group: "Financeiro", subgroup: "Encargos Financeiros", type: "Financeiro", active: true, impactsDre: true },
  { id: uid(), name: "Juros de Financiamentos", group: "Financeiro", subgroup: "Financeiro", type: "Financeiro", active: true, impactsDre: true },
  { id: uid(), name: "Tarifas Bancárias", group: "Financeiro", subgroup: "Tarifas Bancárias", type: "Financeiro", active: true, impactsDre: true },
];

const defaultOptions: OptionLists = {
  revenueTypes: ["Venda de Mercadorias", "Venda de Produtos", "Prestação de Serviços", "Receita Mista"],
  channels: ["Loja Física", "Delivery", "Marketplace", "Online", "Outros"],
  deductionTypes: ["Impostos", "Taxas Comerciais", "Deduções Comerciais"],
  deductionAccounts: ["Simples Nacional", "ICMS", "ISS", "PIS", "COFINS", "Maquininha", "Apps", "Gateways", "Marketplace", "Devoluções", "Reembolsos", "Cashback", "Descontos", "Comissões"],
  expenseGroups: ["Pessoal", "Ocupação", "Serviços Terceiros", "Marketing", "Financeiros", "Administrativos", "Tecnologia", "Outros"],
  expenseSubgroups: ["Folha", "Encargos", "Imóvel", "Utilidades", "Mídia", "Consultoria", "Bancário", "Assinaturas", "Geral"],
  roles: ["Sócio", "Gerente", "Analista", "Operacional", "Vendedor", "Administrativo"],
};

export const useStore = create<State>()(
  persist(
    (set) => ({
      company: { name: "", cnpj: "", address: "" },
      employees: [],
      accounts: defaultAccounts,
      revenues: [],
      deductions: [],
      cmv: [],
      expenses: [],
      options: defaultOptions,
      onboardingCompleted: false,
      setCompany: (c) => set((s) => ({ company: { ...s.company, ...c } })),
      addEmployee: (e) => set((s) => ({ employees: [...s.employees, { ...e, id: uid() }] })),
      updateEmployee: (id, e) => set((s) => ({ employees: s.employees.map((x) => (x.id === id ? { ...x, ...e } : x)) })),
      removeEmployee: (id) => set((s) => ({ employees: s.employees.filter((x) => x.id !== id) })),
      addAccount: (a) => set((s) => ({ accounts: [...s.accounts, { ...a, id: uid() }] })),
      updateAccount: (id, a) => set((s) => ({ accounts: s.accounts.map((x) => (x.id === id ? { ...x, ...a } : x)) })),
      removeAccount: (id) => set((s) => ({ accounts: s.accounts.filter((x) => x.id !== id) })),
      addRevenue: (r) => set((s) => ({ revenues: [...s.revenues, { ...r, id: uid() }] })),
      updateRevenue: (id, r) => set((s) => ({ revenues: s.revenues.map((x) => (x.id === id ? { ...x, ...r } : x)) })),
      removeRevenue: (id) => set((s) => ({ revenues: s.revenues.filter((x) => x.id !== id) })),
      addDeduction: (d) => set((s) => ({ deductions: [...s.deductions, { ...d, id: uid() }] })),
      updateDeduction: (id, d) => set((s) => ({ deductions: s.deductions.map((x) => (x.id === id ? { ...x, ...d } : x)) })),
      removeDeduction: (id) => set((s) => ({ deductions: s.deductions.filter((x) => x.id !== id) })),
      addCmv: (c) => set((s) => ({ cmv: [...s.cmv, { ...c, id: uid() }] })),
      updateCmv: (id, c) => set((s) => ({ cmv: s.cmv.map((x) => (x.id === id ? { ...x, ...c } : x)) })),
      removeCmv: (id) => set((s) => ({ cmv: s.cmv.filter((x) => x.id !== id) })),
      addExpense: (e) => set((s) => ({ expenses: [...s.expenses, { ...e, id: uid() }] })),
      updateExpense: (id, e) => set((s) => ({ expenses: s.expenses.map((x) => (x.id === id ? { ...x, ...e } : x)) })),
      removeExpense: (id) => set((s) => ({ expenses: s.expenses.filter((x) => x.id !== id) })),
      addOption: (key, value) =>
        set((s) => {
          if (s.options[key].includes(value)) return s;
          return { options: { ...s.options, [key]: [...s.options[key], value] } };
        }),
      setOnboardingCompleted: (v) => set({ onboardingCompleted: v }),
      reset: () =>
        set({
          company: { name: "", cnpj: "", address: "" },
          employees: [],
          accounts: defaultAccounts,
          revenues: [],
          deductions: [],
          cmv: [],
          expenses: [],
          options: defaultOptions,
          onboardingCompleted: false,
        }),
    }),
    {
      name: "dre-app-store",
      version: 4,
      migrate: (persisted: any) => {
        if (!persisted) return persisted;
        persisted.accounts = defaultAccounts;
        persisted.deductions = (persisted.deductions ?? []).map((d: any) => ({
          group: d.group ?? "Deduções",
          subgroup: d.subgroup ?? d.type ?? "",
          type: d.type ?? "",
          account: d.account ?? "",
          amount: Number(d.amount ?? 0),
          competence: d.competence ?? "",
          id: d.id ?? uid(),
          description: d.description ?? "",
          date: d.date ?? new Date().toISOString().slice(0, 10),
          notes: d.notes,
        }));
        return persisted;
      },
    }
  )
);
