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
  kind: string;
  channel: string;
  productOrService: string;
  frequency: "Mensal" | "Trimestral" | "Anual" | "Eventual";
  impactsDre: boolean;
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
  revenueKinds: string[];
  revenueProducts: string[];
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
  { id: uid(), name: "Cashback", group: "Deduções", subgroup: "Deduções Comerciais", type: "Deduções", active: true, impactsDre: true },
  { id: uid(), name: "Comissões", group: "Deduções", subgroup: "Deduções Comerciais", type: "Deduções", active: true, impactsDre: true },
  { id: uid(), name: "Descontos", group: "Deduções", subgroup: "Deduções Comerciais", type: "Deduções", active: true, impactsDre: true },
  { id: uid(), name: "Devoluções", group: "Deduções", subgroup: "Deduções Comerciais", type: "Deduções", active: true, impactsDre: true },
  { id: uid(), name: "Reembolsos", group: "Deduções", subgroup: "Deduções Comerciais", type: "Deduções", active: true, impactsDre: true },
  { id: uid(), name: "COFINS", group: "Deduções", subgroup: "Impostos", type: "Deduções", active: true, impactsDre: true },
  { id: uid(), name: "ICMS", group: "Deduções", subgroup: "Impostos", type: "Deduções", active: true, impactsDre: true },
  { id: uid(), name: "ISS", group: "Deduções", subgroup: "Impostos", type: "Deduções", active: true, impactsDre: true },
  { id: uid(), name: "PIS", group: "Deduções", subgroup: "Impostos", type: "Deduções", active: true, impactsDre: true },
  { id: uid(), name: "Simples Nacional", group: "Deduções", subgroup: "Impostos", type: "Deduções", active: true, impactsDre: true },
  { id: uid(), name: "Apps", group: "Deduções", subgroup: "Taxas Comerciais", type: "Deduções", active: true, impactsDre: true },
  { id: uid(), name: "Gateways", group: "Deduções", subgroup: "Taxas Comerciais", type: "Deduções", active: true, impactsDre: true },
  { id: uid(), name: "Maquininha", group: "Deduções", subgroup: "Taxas Comerciais", type: "Deduções", active: true, impactsDre: true },
  { id: uid(), name: "Marketplace", group: "Deduções", subgroup: "Taxas Comerciais", type: "Deduções", active: true, impactsDre: true },
  { id: uid(), name: "Taxas de Maquininha", group: "Deduções", subgroup: "Taxas Comerciais", type: "Deduções", active: true, impactsDre: true },
  { id: uid(), name: "Juros de Empréstimos", group: "Financeiro", subgroup: "Encargos Financeiros", type: "Financeiro", active: true, impactsDre: true },
  { id: uid(), name: "Juros de Financiamentos", group: "Financeiro", subgroup: "Encargos Financeiros", type: "Financeiro", active: true, impactsDre: true },
  { id: uid(), name: "Juros de Parcelamentos", group: "Financeiro", subgroup: "Encargos Financeiros", type: "Financeiro", active: true, impactsDre: true },
  { id: uid(), name: "Descontos Financeiros Obtidos", group: "Financeiro", subgroup: "Receitas Financeiras", type: "Financeiro", active: true, impactsDre: true },
  { id: uid(), name: "Juros Recebidos", group: "Financeiro", subgroup: "Receitas Financeiras", type: "Financeiro", active: true, impactsDre: true },
  { id: uid(), name: "Rendimentos de Aplicações", group: "Financeiro", subgroup: "Receitas Financeiras", type: "Financeiro", active: true, impactsDre: true },
  { id: uid(), name: "Tarifas Bancárias", group: "Financeiro", subgroup: "Tarifas Bancárias", type: "Financeiro", active: true, impactsDre: true },
  { id: uid(), name: "Marketing Digital", group: "Marketing", subgroup: "Estratégia Digital", type: "Gasto", active: true, impactsDre: true },
  { id: uid(), name: "Social Mídia", group: "Marketing", subgroup: "Gestão de Redes Sociais", type: "Gasto", active: true, impactsDre: true },
  { id: uid(), name: "Tráfego Pago", group: "Marketing", subgroup: "Mídia Paga", type: "Gasto", active: true, impactsDre: true },
  { id: uid(), name: "Material de Escritório", group: "Administrativo", subgroup: "Suprimentos Administrativos", type: "Gasto", active: true, impactsDre: true },
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
  { id: uid(), name: "Bolsa de Estudos", group: "Pessoal", subgroup: "Benefícios", type: "Gasto", active: true, impactsDre: true },
  { id: uid(), name: "Plano de Saúde", group: "Pessoal", subgroup: "Benefícios", type: "Gasto", active: true, impactsDre: true },
  { id: uid(), name: "Treinamentos", group: "Pessoal", subgroup: "Capacitação", type: "Gasto", active: true, impactsDre: true },
  { id: uid(), name: "Aluguel", group: "Ocupação", subgroup: "Imóvel", type: "Gasto", active: true, impactsDre: true },
  { id: uid(), name: "IPTU", group: "Ocupação", subgroup: "Imóvel", type: "Gasto", active: true, impactsDre: true },
  { id: uid(), name: "Bombeiros", group: "Ocupação", subgroup: "Imóvel", type: "Gasto", active: true, impactsDre: true },
  { id: uid(), name: "Segurança Privada", group: "Ocupação", subgroup: "Imóvel", type: "Gasto", active: true, impactsDre: true },
  { id: uid(), name: "Seguros", group: "Ocupação", subgroup: "Imóvel", type: "Gasto", active: true, impactsDre: true },
  { id: uid(), name: "Taxa de Condomínio", group: "Ocupação", subgroup: "Imóvel", type: "Gasto", active: true, impactsDre: true },
  { id: uid(), name: "Cartão de Crédito", group: "Ocupação", subgroup: "Imóvel", type: "Gasto", active: true, impactsDre: true },
  { id: uid(), name: "Financiamento (Imóvel)", group: "Ocupação", subgroup: "Imóvel", type: "Gasto", active: true, impactsDre: true },
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
  { id: uid(), name: "Correios", group: "Serviços de Terceiros", subgroup: "Administrativo", type: "Gasto", active: true, impactsDre: true },
  { id: uid(), name: "Cartório", group: "Serviços de Terceiros", subgroup: "Administrativo", type: "Gasto", active: true, impactsDre: true },
  { id: uid(), name: "Consultoria", group: "Serviços de Terceiros", subgroup: "Consultoria Especializada", type: "Gasto", active: true, impactsDre: true },
  { id: uid(), name: "Contabilidade", group: "Serviços de Terceiros", subgroup: "Serviços Contábeis", type: "Gasto", active: true, impactsDre: true },
  { id: uid(), name: "Manutenção de Equipamentos", group: "Serviços de Terceiros", subgroup: "Manutenção", type: "Gasto", active: true, impactsDre: true },
  { id: uid(), name: "Softwares", group: "Tecnologia", subgroup: "Assinaturas", type: "Gasto", active: true, impactsDre: true },
  { id: uid(), name: "Inteligência Artificial", group: "Tecnologia", subgroup: "Assinaturas", type: "Gasto", active: true, impactsDre: true },
  { id: uid(), name: "Informes Contábeis", group: "Tecnologia", subgroup: "Assinaturas", type: "Gasto", active: true, impactsDre: true },
  { id: uid(), name: "Site (Hospedagem/Domínio)", group: "Tecnologia", subgroup: "Infraestrutura Web", type: "Gasto", active: true, impactsDre: true },
  { id: uid(), name: "IPVA", group: "Ocupação", subgroup: "Impostos e Taxas", type: "Gasto", active: true, impactsDre: true },
  { id: uid(), name: "Seguro de Veículos", group: "Ocupação", subgroup: "Seguros", type: "Gasto", active: true, impactsDre: true },
  { id: uid(), name: "Financiamento (Veículo)", group: "Ocupação", subgroup: "Veículo", type: "Gasto", active: true, impactsDre: true },
  { id: uid(), name: "Multas", group: "Ocupação", subgroup: "Veículo", type: "Gasto", active: true, impactsDre: true },
];

const defaultOptions: OptionLists = {
  revenueTypes: [
    "Prestação de Serviços",
    "Venda de Produtos",
    "Venda de Equipamentos",
    "Venda de Máquinas",
    "Venda de Veículos",
    "Aporte de Sócios",
    "Liberação de Empréstimo",
    "Resgate de Aplicações",
    "Entrada por Transferência",
    "Ajuste de Saldo",
    "Nota de Crédito",
  ],
  revenueKinds: [
    "Receita Operacional",
    "Receita Financeira",
    "Receita Não Operacional",
    "Entrada de Financiamento",
    "Ajuste Financeiro",
  ],
  revenueProducts: [],
  channels: [
    "Assessoria",
    "Contabilidade",
    "Consultoria",
    "Delivery",
    "Loja Física",
    "Marketplace",
    "Online",
    "Treinamento",
    "Outros",
  ],
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
          const next = [...s.options[key], value];
          const sortAlpha = (arr: string[]) => arr.sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));
          const sortAlphaWithOutrosLast = (arr: string[]) => {
            const norm = (v: string) => v.trim().toLowerCase();
            const others = arr.filter((x) => norm(x) === "outros");
            const rest = arr.filter((x) => norm(x) !== "outros");
            sortAlpha(rest);
            return [...rest, ...others];
          };

          if (key === "revenueProducts" || key === "revenueTypes") {
            sortAlpha(next);
          } else if (key === "channels") {
            return { options: { ...s.options, [key]: sortAlphaWithOutrosLast(next) } };
          }
          return { options: { ...s.options, [key]: next } };
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
      version: 21,
      migrate: (persisted: any) => {
        if (!persisted) return persisted;
        const norm = (v: unknown) =>
          String(v ?? "")
            .trim()
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");

        const existingAccounts = Array.isArray(persisted.accounts) ? persisted.accounts : [];
        const byName = new Map<string, any>();
        for (const a of existingAccounts) {
          const key = norm(a?.name);
          if (!key) continue;
          if (!byName.has(key)) byName.set(key, a);
        }

        const merged: Account[] = [];
        const allowedTypes: ReadonlyArray<Account["type"]> = [
          "Receita",
          "Custo",
          "Gasto",
          "Financeiro",
          "Investimento",
          "Deduções",
        ];
        const normalizeType = (v: unknown): Account["type"] => {
          const s = String(v ?? "");
          return (allowedTypes as readonly string[]).includes(s) ? (s as Account["type"]) : "Gasto";
        };
        for (const a of existingAccounts) {
          if (!a || typeof a !== "object") continue;
          const name = String((a as any).name ?? "").trim();
          if (!name) continue;
          const key = norm(name);
          if (byName.get(key) !== a) continue; // drop duplicates by name (keep first)

          const next: Account = {
            id: String((a as any).id ?? uid()),
            name,
            group: String((a as any).group ?? ""),
            subgroup: String((a as any).subgroup ?? ""),
            type: normalizeType((a as any).type),
            active: Boolean((a as any).active),
            impactsDre: Boolean((a as any).impactsDre ?? (a as any).impacts_dre ?? true),
          };

          // Fix legacy deduction accounts incorrectly typed as "Gasto"
          if (next.type === "Gasto" && (key === "simples nacional" || key === "icms")) {
            next.type = "Deduções";
          }

          merged.push(next);
        }

        const existingNames = new Set(merged.map((a) => norm(a.name)));
        for (const d of defaultAccounts) {
          const key = norm(d.name);
          if (!key || existingNames.has(key)) continue;
          merged.push(d);
          existingNames.add(key);
        }

        persisted.accounts = merged;

        const sortAlpha = (arr: string[]) => arr.sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));
        const sortAlphaWithOutrosLast = (arr: string[]) => {
          const norm = (v: string) => v.trim().toLowerCase();
          const others = arr.filter((x) => norm(x) === "outros");
          const rest = arr.filter((x) => norm(x) !== "outros");
          sortAlpha(rest);
          return [...rest, ...others];
        };
        const unique = (arr: string[]) => Array.from(new Set(arr.map((v) => v.trim()).filter(Boolean)));

        const existingOptions = persisted.options && typeof persisted.options === "object" ? persisted.options : {};
        const existingRevenueProducts = Array.isArray(existingOptions.revenueProducts)
          ? existingOptions.revenueProducts.map((v: any) => String(v ?? "").trim()).filter(Boolean)
          : [];
        const existingRevenueTypes = Array.isArray(existingOptions.revenueTypes)
          ? existingOptions.revenueTypes.map((v: any) => String(v ?? "").trim()).filter(Boolean)
          : [];
        const existingChannels = Array.isArray(existingOptions.channels)
          ? existingOptions.channels.map((v: any) => String(v ?? "").trim()).filter(Boolean)
          : [];

        const revenueProducts = sortAlpha(unique(existingRevenueProducts));
        const revenueTypes = sortAlpha(unique([...defaultOptions.revenueTypes, ...existingRevenueTypes]));
        const channels = sortAlphaWithOutrosLast(unique([...defaultOptions.channels, ...existingChannels]));

        persisted.options = {
          ...defaultOptions,
          ...existingOptions,
          revenueTypes,
          revenueKinds: [...defaultOptions.revenueKinds],
          channels,
          revenueProducts,
        };

        persisted.revenues = (persisted.revenues ?? []).map((r: any) => ({
          id: r?.id ?? uid(),
          competence: r?.competence ?? "",
          amount: Number(r?.amount ?? 0),
          type: r?.type ?? "",
          kind: r?.kind ?? "",
          channel: r?.channel ?? "",
          productOrService: r?.productOrService ?? r?.product_or_service ?? "",
          frequency: (["Mensal", "Trimestral", "Anual", "Eventual"] as const).includes(r?.frequency)
            ? r.frequency
            : "Mensal",
          impactsDre: typeof r?.impactsDre === "boolean" ? r.impactsDre : typeof r?.impacts_dre === "boolean" ? r.impacts_dre : true,
          notes: r?.notes,
        }));

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
