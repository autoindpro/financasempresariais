import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { Button, Field, Input, Select, Textarea } from "@/components/Form";
import { getSupabase } from "@/lib/supabase";
import { parseOfx } from "@/lib/ofx";
import { KpiCard } from "@/components/KpiCard";
import { currentCompetence, fmt } from "@/lib/finance";
import { ArrowDownLeft, ArrowUpRight, Banknote, CalendarClock, Landmark } from "lucide-react";

export const Route = createFileRoute("/fluxo-caixa")({
  component: FluxoCaixaPage,
  head: () => ({ meta: [{ title: "Fluxo de Caixa · Flux Soluções" }] }),
});

type ImportRow = {
  postedAt: string;
  amount: number;
  name: string;
  memo: string;
  fitId: string;
};

type EntryKind = "payable" | "receivable";
type EntryStatus = "open" | "paid" | "canceled";
type EntryFilterKey = "kind" | "status" | "description" | "counterparty";
type CashflowEntry = {
  id: string;
  kind: EntryKind;
  status: EntryStatus;
  dueDate: string;
  paidAt: string | null;
  competence: string;
  description: string;
  counterparty: string | null;
  amount: number;
  recurrent: boolean;
  frequency: "Mensal" | "Trimestral" | "Anual" | "Eventual";
  notes: string | null;
};

function FluxoCaixaPage() {
  const [tab, setTab] = useState<"import" | "contas" | "pagar-receber">("import");
  const [companyId, setCompanyId] = useState<string>(() => {
    try {
      return localStorage.getItem("flux_company_id") ?? "";
    } catch {
      return "";
    }
  });

  const [accountId, setAccountId] = useState<string>("");
  const [accounts, setAccounts] = useState<Array<{ id: string; name: string; bankName: string | null; accountNumber: string | null; openingBalance: number }>>([]);
  const [status, setStatus] = useState<string>("");
  const [preview, setPreview] = useState<ImportRow[]>([]);
  const [accountsStatus, setAccountsStatus] = useState<string>("");
  const [newAccount, setNewAccount] = useState({ name: "", bankName: "", accountNumber: "", openingBalance: 0 });
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);

  const [dashPeriodMode, setDashPeriodMode] = useState<"month" | "year" | "range">("month");
  const [dashCompetence, setDashCompetence] = useState<string>(() => currentCompetence()); // YYYY-MM
  const [dashYear, setDashYear] = useState<string>(() => String(new Date().getFullYear())); // YYYY
  const [dashRangeFrom, setDashRangeFrom] = useState<string>(() => `${currentCompetence()}-01`); // YYYY-MM-DD
  const [dashRangeTo, setDashRangeTo] = useState<string>(() => new Date().toISOString().slice(0, 10)); // YYYY-MM-DD
  const [dashLoading, setDashLoading] = useState(false);
  const [dashError, setDashError] = useState<string>("");
  const [dash, setDash] = useState<{
    openingBalance: number;
    bankNet: number;
    receivableOpen: number;
    payableOpen: number;
    receivablePaid: number;
    payablePaid: number;
    projectedEnd: number;
  } | null>(null);

  const [entriesStatus, setEntriesStatus] = useState<string>("");
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [entryTypeFilters, setEntryTypeFilters] = useState<EntryKind[]>([]);
  const [entryStatusFilters, setEntryStatusFilters] = useState<Array<"open" | "paid">>([]);
  const [entryDescriptionFilters, setEntryDescriptionFilters] = useState<string[]>([]);
  const [entryCounterpartyFilters, setEntryCounterpartyFilters] = useState<string[]>([]);
  const [entries, setEntries] = useState<CashflowEntry[]>([]);
  const [newEntry, setNewEntry] = useState({
    kind: "payable" as "payable" | "receivable",
    competence: new Date().toISOString().slice(0, 7),
    dueDate: new Date().toISOString().slice(0, 10),
    description: "",
    counterparty: "",
    amount: 0,
    recurrent: false,
    frequency: "Mensal" as "Mensal" | "Trimestral" | "Anual" | "Eventual",
    notes: "",
  });

  const resetEntryForm = () => {
    setEditingEntryId(null);
    setNewEntry({
      kind: "payable",
      competence: new Date().toISOString().slice(0, 7),
      dueDate: new Date().toISOString().slice(0, 10),
      description: "",
      counterparty: "",
      amount: 0,
      recurrent: false,
      frequency: "Mensal",
      notes: "",
    });
  };

  const supabase = useMemo(() => getSupabase(), []);

  const competenceRange = (mode: "month" | "year" | "range", value: string): { from: string; to: string } | null => {
    if (mode === "year") {
      if (!/^\d{4}$/.test(value)) return null;
      return { from: `${value}-01-01`, to: `${value}-12-31` };
    }
    if (mode === "range") {
      const [from, to] = value.split("|");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return null;
      return from <= to ? { from, to } : { from: to, to: from };
    }
    const m = value.match(/^(\d{4})-(\d{2})$/);
    if (!m) return null;
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const from = `${m[1]}-${m[2]}-01`;
    const last = new Date(y, mo, 0).getDate();
    const to = `${m[1]}-${m[2]}-${String(last).padStart(2, "0")}`;
    return { from, to };
  };

  const currentDashRange = useMemo(() => {
    if (dashPeriodMode === "year") return competenceRange("year", dashYear);
    if (dashPeriodMode === "range") return competenceRange("range", `${dashRangeFrom}|${dashRangeTo}`);
    return competenceRange("month", dashCompetence);
  }, [dashCompetence, dashPeriodMode, dashRangeFrom, dashRangeTo, dashYear]);

  const isDateInDashPeriod = (dateIso: string): boolean => {
    if (!currentDashRange) return true;
    return dateIso >= currentDashRange.from && dateIso <= currentDashRange.to;
  };

  const filterEntries = (skip?: EntryFilterKey): CashflowEntry[] => {
    let out = entries.filter((e) => isDateInDashPeriod(e.dueDate));
    if (skip !== "kind" && entryTypeFilters.length) {
      const set = new Set(entryTypeFilters);
      out = out.filter((e) => set.has(e.kind));
    }
    if (skip !== "status" && entryStatusFilters.length) {
      const set = new Set(entryStatusFilters);
      out = out.filter((e) => set.has(e.status as "open" | "paid"));
    }
    if (skip !== "description" && entryDescriptionFilters.length) {
      const set = new Set(entryDescriptionFilters);
      out = out.filter((e) => set.has(e.description));
    }
    if (skip !== "counterparty" && entryCounterpartyFilters.length) {
      const set = new Set(entryCounterpartyFilters);
      out = out.filter((e) => set.has(e.counterparty ?? ""));
    }
    return out;
  };

  const typeOptions = useMemo(() => {
    const set = new Set(filterEntries("kind").map((e) => e.kind));
    return Array.from(set);
  }, [entries, entryCounterpartyFilters, entryDescriptionFilters, entryStatusFilters, currentDashRange]);

  const statusOptions = useMemo(() => {
    const set = new Set(filterEntries("status").map((e) => e.status));
    return Array.from(set).filter((status): status is "open" | "paid" => status === "open" || status === "paid");
  }, [entries, entryCounterpartyFilters, entryDescriptionFilters, entryTypeFilters, currentDashRange]);

  const descriptionOptions = useMemo(() => {
    const set = new Set<string>();
    for (const e of filterEntries("description")) {
      const d = (e.description ?? "").trim();
      if (d) set.add(d);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [entries, entryCounterpartyFilters, entryStatusFilters, entryTypeFilters, currentDashRange]);

  const counterpartyOptions = useMemo(() => {
    const set = new Set<string>();
    for (const e of filterEntries("counterparty")) {
      const c = (e.counterparty ?? "").trim();
      if (c) set.add(c);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [entries, entryDescriptionFilters, entryStatusFilters, entryTypeFilters, currentDashRange]);

  const filteredEntries = useMemo(() => {
    return filterEntries();
  }, [entries, entryCounterpartyFilters, entryDescriptionFilters, entryStatusFilters, entryTypeFilters, currentDashRange]);

  const keepAvailableFilters = <T,>(prev: T[], available: Set<T>): T[] => {
    const next = prev.filter((value) => available.has(value));
    return next.length === prev.length ? prev : next;
  };

  useEffect(() => {
    const nextOptions = new Set(typeOptions);
    setEntryTypeFilters((prev) => keepAvailableFilters(prev, nextOptions));
  }, [typeOptions]);

  useEffect(() => {
    const nextOptions = new Set(statusOptions);
    setEntryStatusFilters((prev) => keepAvailableFilters(prev, nextOptions));
  }, [statusOptions]);

  useEffect(() => {
    const nextOptions = new Set(descriptionOptions);
    setEntryDescriptionFilters((prev) => keepAvailableFilters(prev, nextOptions));
  }, [descriptionOptions]);

  useEffect(() => {
    const nextOptions = new Set(counterpartyOptions);
    setEntryCounterpartyFilters((prev) => keepAvailableFilters(prev, nextOptions));
  }, [counterpartyOptions]);

  const dashFiltered = useMemo(() => {
    if (!dash) return null;
    let receivableOpen = 0;
    let payableOpen = 0;
    let receivablePaid = 0;
    let payablePaid = 0;

    for (const e of filteredEntries) {
      if (e.status === "canceled") continue;
      if (e.kind === "receivable") {
        if (e.status === "open") receivableOpen += e.amount;
        else if (e.status === "paid") receivablePaid += e.amount;
      } else {
        if (e.status === "open") payableOpen += e.amount;
        else if (e.status === "paid") payablePaid += e.amount;
      }
    }

    const projectedEnd = dash.openingBalance + dash.bankNet + receivableOpen - payableOpen;
    return {
      ...dash,
      receivableOpen,
      payableOpen,
      receivablePaid,
      payablePaid,
      projectedEnd,
    };
  }, [dash, filteredEntries]);

  const addMonths = (dateIso: string, months: number): string => {
    const m = dateIso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return dateIso;
    const y = Number(m[1]);
    const mo = Number(m[2]) - 1;
    const d = Number(m[3]);
    const dt = new Date(y, mo + months, 1);
    const last = new Date(dt.getFullYear(), dt.getMonth() + 1, 0).getDate();
    const day = Math.min(d, last);
    const out = new Date(dt.getFullYear(), dt.getMonth(), day);
    return out.toISOString().slice(0, 10);
  };

  const competenceFromDate = (dateIso: string): string => dateIso.slice(0, 7);

  const futureOffsetsUntilYearEnd = (
    startDateIso: string,
    frequency: "Mensal" | "Trimestral" | "Anual" | "Eventual",
  ): number[] => {
    // Replicate only within the same calendar year as the starting due date.
    if (frequency === "Eventual") return [];

    const m = startDateIso.match(/^(\d{4})-(\d{2})-\d{2}$/);
    if (!m) return [];
    const startMonth = Number(m[2]); // 1..12
    if (!Number.isFinite(startMonth) || startMonth < 1 || startMonth > 12) return [];

    const step = frequency === "Mensal" ? 1 : frequency === "Trimestral" ? 3 : 12;
    const max = 12 - startMonth; // months until December (same year)

    const out: number[] = [];
    for (let off = step; off <= max; off += step) out.push(off);
    return out;
  };

  const loadDashboard = async () => {
    setDashError("");
    setDash(null);
    if (!supabase || !companyId) return;
    const range = currentDashRange;
    if (!range) return;
    setDashLoading(true);
    try {
      const [accountsRes, txRes, entriesRes] = await Promise.all([
        supabase.from("bank_accounts").select("opening_balance").eq("company_id", companyId),
        supabase
          .from("bank_transactions")
          .select("amount")
          .eq("company_id", companyId)
          .gte("posted_at", range.from)
          .lte("posted_at", range.to),
        supabase
          .from("cashflow_entries")
          .select("kind,status,amount,due_date")
          .eq("company_id", companyId)
          .gte("due_date", range.from)
          .lte("due_date", range.to),
      ]);

      for (const r of [accountsRes, txRes, entriesRes]) {
        if ((r as any).error) throw (r as any).error;
      }

      const openingBalance = (accountsRes.data ?? []).reduce((s: number, r: any) => s + Number(r.opening_balance ?? 0), 0);
      const bankNet = (txRes.data ?? []).reduce((s: number, r: any) => s + Number(r.amount ?? 0), 0);

      let receivableOpen = 0;
      let payableOpen = 0;
      let receivablePaid = 0;
      let payablePaid = 0;
      for (const r of entriesRes.data ?? []) {
        const amount = Number((r as any).amount ?? 0);
        const kind = (r as any).kind as "payable" | "receivable";
        const status = (r as any).status as "open" | "paid" | "canceled";
        if (status === "canceled") continue;
        if (kind === "receivable") {
          if (status === "open") receivableOpen += amount;
          else if (status === "paid") receivablePaid += amount;
        } else {
          if (status === "open") payableOpen += amount;
          else if (status === "paid") payablePaid += amount;
        }
      }

      // "Mini dashboard" uses:
      // - Saldo inicial: opening balances across bank accounts
      // - Realizado no mês: net bank transactions imported (extrato)
      // - Previsto em aberto: open receivables - open payables
      const projectedEnd = openingBalance + bankNet + receivableOpen - payableOpen;

      setDash({
        openingBalance,
        bankNet,
        receivableOpen,
        payableOpen,
        receivablePaid,
        payablePaid,
        projectedEnd,
      });
    } catch (e: any) {
      setDashError(String(e?.message ?? e));
    } finally {
      setDashLoading(false);
    }
  };

  const loadAccounts = async () => {
    setAccountsStatus("");
    if (!supabase || !companyId) return;
    const { data, error } = await supabase
      .from("bank_accounts")
      .select("id,name,bank_name,account_number,opening_balance")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });
    if (error) {
      setAccountsStatus(`Erro ao listar contas bancárias: ${error.message}`);
      return;
    }
    const list = (data ?? []).map((r: any) => ({
      id: String(r.id),
      name: String(r.name),
      bankName: r.bank_name ? String(r.bank_name) : null,
      accountNumber: r.account_number ? String(r.account_number) : null,
      openingBalance: Number(r.opening_balance ?? 0),
    }));
    setAccounts(list);
    if (!accountId && list[0]?.id) setAccountId(list[0].id);
    if (accountId && !list.some((a) => a.id === accountId)) {
      setAccountId(list[0]?.id ?? "");
    }
  };

  const createAccount = async () => {
    setAccountsStatus("");
    if (!supabase) return;
    if (!companyId) {
      setAccountsStatus("Selecione uma empresa (company_id).");
      return;
    }
    if (!newAccount.name.trim()) {
      setAccountsStatus("Informe o nome da conta bancária.");
      return;
    }
    const { error } = await supabase.from("bank_accounts").insert({
      company_id: companyId,
      name: newAccount.name.trim(),
      bank_name: newAccount.bankName.trim() || null,
      account_number: newAccount.accountNumber.trim() || null,
      opening_balance: Number.isFinite(newAccount.openingBalance) ? newAccount.openingBalance : 0,
      active: true,
    });
    if (error) {
      setAccountsStatus(`Erro ao criar conta: ${error.message}`);
      return;
    }
    setNewAccount({ name: "", bankName: "", accountNumber: "", openingBalance: 0 });
    setEditingAccountId(null);
    setAccountsStatus("Conta criada.");
    await loadAccounts();
  };

  const updateAccount = async () => {
    setAccountsStatus("");
    if (!supabase) return;
    if (!companyId) {
      setAccountsStatus("Selecione uma empresa (company_id).");
      return;
    }
    if (!editingAccountId) return;
    if (!newAccount.name.trim()) {
      setAccountsStatus("Informe o nome da conta bancária.");
      return;
    }
    const { error } = await supabase
      .from("bank_accounts")
      .update({
        name: newAccount.name.trim(),
        bank_name: newAccount.bankName.trim() || null,
        account_number: newAccount.accountNumber.trim() || null,
        opening_balance: Number.isFinite(newAccount.openingBalance) ? newAccount.openingBalance : 0,
      })
      .eq("company_id", companyId)
      .eq("id", editingAccountId);
    if (error) {
      setAccountsStatus(`Erro ao editar conta: ${error.message}`);
      return;
    }
    setAccountsStatus("Conta atualizada.");
    setNewAccount({ name: "", bankName: "", accountNumber: "", openingBalance: 0 });
    setEditingAccountId(null);
    await loadAccounts();
  };

  const startEditAccount = (a: (typeof accounts)[number]) => {
    setAccountsStatus("");
    setEditingAccountId(a.id);
    setNewAccount({
      name: a.name,
      bankName: a.bankName ?? "",
      accountNumber: a.accountNumber ?? "",
      openingBalance: a.openingBalance,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelEditAccount = () => {
    setEditingAccountId(null);
    setNewAccount({ name: "", bankName: "", accountNumber: "", openingBalance: 0 });
  };

  const deleteAccount = async (id: string) => {
    const ok = confirm("Excluir esta conta bancária? Isso pode remover também transações importadas vinculadas a ela.");
    if (!ok) return;
    setAccountsStatus("");
    if (!supabase || !companyId) return;
    const { error } = await supabase.from("bank_accounts").delete().eq("company_id", companyId).eq("id", id);
    if (error) {
      setAccountsStatus(`Erro ao excluir conta: ${error.message}`);
      return;
    }
    if (editingAccountId === id) cancelEditAccount();
    setAccountsStatus("Conta excluída.");
    await loadAccounts();
  };

  const loadEntries = async () => {
    setEntriesStatus("");
    if (!supabase || !companyId) return;
    const range = currentDashRange;
    const maxRows = dashPeriodMode === "month" ? 500 : 5000;
    const { data, error } = await supabase
      .from("cashflow_entries")
      .select("id,kind,status,due_date,paid_at,competence,description,counterparty,amount,recurrent,frequency,notes")
      .eq("company_id", companyId)
      .gte("due_date", range?.from ?? "1900-01-01")
      .lte("due_date", range?.to ?? "2999-12-31")
      .order("due_date", { ascending: false })
      .limit(maxRows);
    if (error) {
      setEntriesStatus(`Erro ao listar lançamentos: ${error.message}`);
      return;
    }
    setEntries(
      (data ?? []).map((r: any) => ({
        id: String(r.id),
        kind: r.kind,
        status: r.status,
        dueDate: String(r.due_date),
        paidAt: r.paid_at ? String(r.paid_at) : null,
        competence: String(r.competence),
        description: String(r.description),
        counterparty: r.counterparty ? String(r.counterparty) : null,
        amount: Number(r.amount ?? 0),
        recurrent: Boolean(r.recurrent),
        frequency: (r.frequency ?? "Mensal") as any,
        notes: r.notes ? String(r.notes) : null,
      })),
    );
    if ((data?.length ?? 0) >= maxRows) {
      setEntriesStatus(`Mostrando os ${maxRows} lançamentos mais recentes do período. Refine o filtro se necessário.`);
    }
    // Reset multi-filters if they no longer exist for the selected period
    if (entryDescriptionFilters.length) {
      const nextOptions = new Set<string>();
      for (const r of data ?? []) {
        const d = String((r as any).description ?? "").trim();
        if (d) nextOptions.add(d);
      }
      setEntryDescriptionFilters((prev) => prev.filter((x) => nextOptions.has(x)));
    }
    if (entryCounterpartyFilters.length) {
      const nextOptions = new Set<string>();
      for (const r of data ?? []) {
        const c = String((r as any).counterparty ?? "").trim();
        if (c) nextOptions.add(c);
      }
      setEntryCounterpartyFilters((prev) => prev.filter((x) => nextOptions.has(x)));
    }
  };

  const toggleInList = <T,>(arr: T[], value: T): T[] => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (arr as any).includes(value) ? (arr as any).filter((x: any) => x !== value) : [...arr, value];
  };

  const createEntry = async () => {
    setEntriesStatus("");
    if (!supabase) return;
    if (!companyId) {
      setEntriesStatus("Selecione uma empresa (company_id).");
      return;
    }
    if (!newEntry.description.trim()) {
      setEntriesStatus("Informe a descrição.");
      return;
    }
    if (!newEntry.amount || !Number.isFinite(newEntry.amount)) {
      setEntriesStatus("Informe um valor válido.");
      return;
    }
    const baseRow = {
      company_id: companyId,
      kind: newEntry.kind,
      status: "open" as const,
      competence: newEntry.competence,
      due_date: newEntry.dueDate,
      description: newEntry.description.trim(),
      counterparty: newEntry.counterparty.trim() || null,
      amount: newEntry.amount,
      recurrent: newEntry.recurrent,
      frequency: newEntry.frequency,
      notes: newEntry.notes.trim() || null,
    };

    const rows = [baseRow];
    if (newEntry.recurrent && newEntry.frequency !== "Eventual") {
      for (const off of futureOffsetsUntilYearEnd(newEntry.dueDate, newEntry.frequency)) {
        const due = addMonths(newEntry.dueDate, off);
        rows.push({
          ...baseRow,
          competence: competenceFromDate(due),
          due_date: due,
        });
      }
    }

    const { error } = await supabase.from("cashflow_entries").insert(rows);
    if (error) {
      setEntriesStatus(`Erro ao criar lançamento: ${error.message}`);
      return;
    }
    resetEntryForm();
    await loadEntries();
  };

  const updateEntry = async () => {
    setEntriesStatus("");
    if (!supabase) return;
    if (!companyId) {
      setEntriesStatus("Selecione uma empresa (company_id).");
      return;
    }
    if (!editingEntryId) return;
    if (!newEntry.description.trim()) {
      setEntriesStatus("Informe a descrição.");
      return;
    }
    if (!newEntry.amount || !Number.isFinite(newEntry.amount)) {
      setEntriesStatus("Informe um valor válido.");
      return;
    }

    const { error } = await supabase
      .from("cashflow_entries")
      .update({
        kind: newEntry.kind,
        competence: newEntry.competence,
        due_date: newEntry.dueDate,
        description: newEntry.description.trim(),
        counterparty: newEntry.counterparty.trim() || null,
        amount: newEntry.amount,
        recurrent: newEntry.recurrent,
        frequency: newEntry.frequency,
        notes: newEntry.notes.trim() || null,
      })
      .eq("company_id", companyId)
      .eq("id", editingEntryId);
    if (error) {
      setEntriesStatus(`Erro ao editar lançamento: ${error.message}`);
      return;
    }
    resetEntryForm();
    await loadEntries();
  };

  const startEditEntry = (e: (typeof entries)[number]) => {
    setEntriesStatus("");
    setEditingEntryId(e.id);
    setNewEntry({
      kind: e.kind,
      competence: e.competence,
      dueDate: e.dueDate,
      description: e.description,
      counterparty: e.counterparty ?? "",
      amount: e.amount,
      recurrent: e.recurrent,
      frequency: e.frequency,
      notes: e.notes ?? "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const markEntry = async (id: string, nextStatus: "open" | "paid" | "canceled") => {
    setEntriesStatus("");
    if (!supabase || !companyId) return;
    const patch: any = { status: nextStatus };
    patch.paid_at = nextStatus === "paid" ? new Date().toISOString().slice(0, 10) : null;
    const { error } = await supabase.from("cashflow_entries").update(patch).eq("company_id", companyId).eq("id", id);
    if (error) {
      setEntriesStatus(`Erro ao atualizar: ${error.message}`);
      return;
    }
    await loadEntries();
  };

  const deleteEntry = async (id: string) => {
    const ok = confirm("Excluir este lançamento?");
    if (!ok) return;
    setEntriesStatus("");
    if (!supabase || !companyId) return;
    const { error } = await supabase.from("cashflow_entries").delete().eq("company_id", companyId).eq("id", id);
    if (error) {
      setEntriesStatus(`Erro ao excluir: ${error.message}`);
      return;
    }
    await loadEntries();
  };

  useEffect(() => {
    if (!companyId) return;
    void loadAccounts();
    void loadEntries();
    void loadDashboard();
    try {
      localStorage.setItem("flux_company_id", companyId);
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  useEffect(() => {
    if (!companyId) return;
    void loadDashboard();
    void loadEntries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dashCompetence, dashPeriodMode, dashRangeFrom, dashRangeTo, dashYear]);

  const onFile = async (file: File | null) => {
    setStatus("");
    setPreview([]);
    if (!file) return;
    const text = await file.text();
    const { transactions } = parseOfx(text);
    if (transactions.length === 0) {
      setStatus("Nenhuma transação encontrada no OFX.");
      return;
    }
    setPreview(
      transactions.slice(0, 50).map((t) => ({
        postedAt: t.postedAt,
        amount: t.amount,
        name: t.name ?? "",
        memo: t.memo ?? "",
        fitId: t.fitId ?? "",
      })),
    );
    setStatus(`Arquivo lido: ${transactions.length} transações encontradas (mostrando até 50).`);
  };

  const importToSupabase = async () => {
    setStatus("");
    if (!supabase) {
      setStatus("Supabase não configurado.");
      return;
    }
    if (!companyId) {
      setStatus("Selecione uma empresa (company_id).");
      return;
    }
    if (!accountId) {
      setStatus("Selecione uma conta bancária.");
      return;
    }
    if (preview.length === 0) {
      setStatus("Carregue um arquivo OFX antes de importar.");
      return;
    }

    const rows = preview.map((t) => ({
      company_id: companyId,
      bank_account_id: accountId,
      fit_id: t.fitId,
      posted_at: t.postedAt,
      amount: t.amount,
      name: t.name || null,
      memo: t.memo || null,
      check_num: null,
      raw: { fitId: t.fitId },
    }));

    const { error } = await supabase.from("bank_transactions").upsert(rows, { onConflict: "bank_account_id,fit_id" });
    if (error) {
      setStatus(`Erro ao importar: ${error.message}`);
      return;
    }
    setStatus(`Importação concluída: ${rows.length} transações inseridas/atualizadas.`);
  };

  return (
    <AppLayout>
      <PageHeader
        title="Fluxo de Caixa"
        description="Contas bancárias, contas a pagar/receber e importação de extratos (OFX)."
        actions={
          <div className="flex items-center gap-2">
            <Button variant={tab === "import" ? "primary" : "secondary"} onClick={() => setTab("import")}>
              Importação OFX
            </Button>
            <Button variant={tab === "contas" ? "primary" : "secondary"} onClick={() => setTab("contas")}>
              Contas Bancárias
            </Button>
            <Button variant={tab === "pagar-receber" ? "primary" : "secondary"} onClick={() => setTab("pagar-receber")}>
              A Pagar / Receber
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 mb-4">
        <KpiCard
          label="Saldo Inicial"
          value={dashFiltered?.openingBalance ?? 0}
          hint="Soma dos saldos iniciais das contas"
          icon={Landmark}
        />
        <KpiCard
          label="Extrato (Líquido)"
          value={dashFiltered?.bankNet ?? 0}
          hint="Importado do OFX no período"
          icon={Banknote}
          tone={(dashFiltered?.bankNet ?? 0) >= 0 ? "positive" : "negative"}
        />
        <KpiCard
          label="A Receber (Aberto)"
          value={dashFiltered?.receivableOpen ?? 0}
          hint="Títulos com vencimento no período"
          icon={ArrowUpRight}
          tone="positive"
        />
        <KpiCard
          label="A Pagar (Aberto)"
          value={dashFiltered?.payableOpen ?? 0}
          hint="Títulos com vencimento no período"
          icon={ArrowDownLeft}
          tone="negative"
        />
      </div>

      <div className="rounded-2xl bg-card border shadow-[var(--shadow-card)] p-6 space-y-4">
        <Field label="Empresa (company_id)">
          <Input value={companyId} onChange={(e) => setCompanyId(e.target.value)} placeholder="UUID da empresa" />
        </Field>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Competência (dashboard)">
            <div className="flex gap-2">
              <Select value={dashPeriodMode} onChange={(e) => setDashPeriodMode(e.target.value as any)} className="max-w-[140px]">
                <option value="month">Mês</option>
                <option value="year">Ano</option>
                <option value="range">Período</option>
              </Select>
              {dashPeriodMode === "month" ? (
                <Input type="month" value={dashCompetence} onChange={(e) => setDashCompetence(e.target.value)} />
              ) : dashPeriodMode === "year" ? (
                <Input
                  type="number"
                  min={2000}
                  max={2100}
                  value={dashYear}
                  onChange={(e) => setDashYear(e.target.value)}
                  placeholder="2026"
                />
              ) : (
                <div className="flex gap-2 w-full">
                  <Input type="date" value={dashRangeFrom} onChange={(e) => setDashRangeFrom(e.target.value)} />
                  <Input type="date" value={dashRangeTo} onChange={(e) => setDashRangeTo(e.target.value)} />
                </div>
              )}
            </div>
          </Field>
          <div className="flex items-end gap-2">
            <Button variant="secondary" onClick={() => void loadDashboard()} disabled={!companyId || dashLoading}>
              Atualizar dashboard
            </Button>
            {dashLoading ? <div className="text-sm text-muted-foreground">Atualizando…</div> : null}
          </div>
        </div>
        {dashFiltered && (
          <div className="rounded-xl border p-4 bg-muted/20 text-sm">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
              <div className="text-muted-foreground">
                Previsto fim do mês: <span className="font-semibold text-foreground tabular-nums">{fmt(dashFiltered.projectedEnd)}</span>
              </div>
              <div className="text-muted-foreground">
                Recebido no mês: <span className="font-medium tabular-nums">{fmt(dashFiltered.receivablePaid)}</span>
              </div>
              <div className="text-muted-foreground">
                Pago no mês: <span className="font-medium tabular-nums">{fmt(dashFiltered.payablePaid)}</span>
              </div>
            </div>
          </div>
        )}
        {dashError ? <div className="text-sm text-destructive">Dashboard: {dashError}</div> : null}

        {tab === "import" && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Conta bancária">
                <Select value={accountId} onChange={(e) => setAccountId(e.target.value)} onFocus={() => void loadAccounts()}>
                  <option value="">Selecione...</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <div className="flex items-end gap-2">
                <Button type="button" variant="secondary" onClick={() => void loadAccounts()}>
                  Atualizar contas
                </Button>
              </div>
            </div>

            <Field label="Arquivo OFX">
              <Input type="file" accept=".ofx,.qfx,text/*" onChange={(e) => void onFile(e.target.files?.[0] ?? null)} />
            </Field>

            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={() => void importToSupabase()} disabled={preview.length === 0 || !accountId || !companyId}>
                Importar para o Supabase
              </Button>
              {status ? <div className="text-sm text-muted-foreground">{status}</div> : null}
            </div>

            {preview.length > 0 && (
              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left">Data</th>
                      <th className="px-4 py-3 text-left">Descrição</th>
                      <th className="px-4 py-3 text-left">Memo</th>
                      <th className="px-4 py-3 text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((t) => (
                      <tr key={t.fitId} className="border-b last:border-0">
                        <td className="px-4 py-3">{t.postedAt}</td>
                        <td className="px-4 py-3">{t.name}</td>
                        <td className="px-4 py-3 text-muted-foreground">{t.memo}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{t.amount.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {tab === "contas" && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Nome da conta">
                <Input value={newAccount.name} onChange={(e) => setNewAccount({ ...newAccount, name: e.target.value })} />
              </Field>
              <Field label="Banco">
                <Input value={newAccount.bankName} onChange={(e) => setNewAccount({ ...newAccount, bankName: e.target.value })} />
              </Field>
              <Field label="Número da conta">
                <Input value={newAccount.accountNumber} onChange={(e) => setNewAccount({ ...newAccount, accountNumber: e.target.value })} />
              </Field>
              <Field label="Saldo inicial">
                <Input type="number" step="0.01" value={newAccount.openingBalance || ""} onChange={(e) => setNewAccount({ ...newAccount, openingBalance: Number(e.target.value) })} />
              </Field>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={() => void (editingAccountId ? updateAccount() : createAccount())}>
                {editingAccountId ? "Salvar alterações" : "Criar conta bancária"}
              </Button>
              {editingAccountId ? (
                <Button variant="ghost" onClick={() => cancelEditAccount()}>
                  Cancelar edição
                </Button>
              ) : null}
              <Button variant="secondary" onClick={() => void loadAccounts()}>Atualizar lista</Button>
              {accountsStatus ? <div className="text-sm text-muted-foreground">{accountsStatus}</div> : null}
            </div>
            {accounts.length > 0 && (
              <div className="rounded-xl border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left">Conta</th>
                      <th className="px-4 py-3 text-left">Banco</th>
                      <th className="px-4 py-3 text-left">ID</th>
                      <th className="px-4 py-3 text-right" />
                    </tr>
                  </thead>
                  <tbody>
                    {accounts.map((a) => (
                      <tr key={a.id} className="border-b last:border-0">
                        <td className="px-4 py-3">{a.name}</td>
                        <td className="px-4 py-3 text-muted-foreground">{a.bankName ?? ""}</td>
                        <td className="px-4 py-3 text-muted-foreground">{a.id}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex gap-1">
                            <button className="h-8 px-2 rounded-md border text-xs hover:bg-muted" onClick={() => startEditAccount(a)}>
                              Editar
                            </button>
                            <button className="h-8 px-2 rounded-md border text-xs hover:bg-destructive/10 hover:text-destructive" onClick={() => void deleteAccount(a.id)}>
                              Excluir
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {tab === "pagar-receber" && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Tipo">
                <Select value={newEntry.kind} onChange={(e) => setNewEntry({ ...newEntry, kind: e.target.value as any })}>
                  <option value="payable">A pagar</option>
                  <option value="receivable">A receber</option>
                </Select>
              </Field>
              <Field label="Competência">
                <Input type="month" value={newEntry.competence} onChange={(e) => setNewEntry({ ...newEntry, competence: e.target.value })} />
              </Field>
              <Field label="Vencimento">
                <Input type="date" value={newEntry.dueDate} onChange={(e) => setNewEntry({ ...newEntry, dueDate: e.target.value })} />
              </Field>
              <Field label="Valor (R$)">
                <Input type="number" step="0.01" value={newEntry.amount || ""} onChange={(e) => setNewEntry({ ...newEntry, amount: Number(e.target.value) })} />
              </Field>
              <Field label="Frequência">
                <Select value={newEntry.frequency} onChange={(e) => setNewEntry({ ...newEntry, frequency: e.target.value as any })}>
                  <option>Mensal</option>
                  <option>Trimestral</option>
                  <option>Anual</option>
                  <option>Eventual</option>
                </Select>
              </Field>
              <Field label="Descrição" span={2}>
                <Input value={newEntry.description} onChange={(e) => setNewEntry({ ...newEntry, description: e.target.value })} />
              </Field>
              <Field label="Cliente/Fornecedor" span={2}>
                <Input value={newEntry.counterparty} onChange={(e) => setNewEntry({ ...newEntry, counterparty: e.target.value })} />
              </Field>
              <Field label="Observações" span={2}>
                <Textarea value={newEntry.notes} onChange={(e) => setNewEntry({ ...newEntry, notes: e.target.value })} />
              </Field>
              <label className="md:col-span-2 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={newEntry.recurrent}
                  onChange={(e) => setNewEntry({ ...newEntry, recurrent: e.target.checked })}
                />
                Lançamento recorrente automático
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={() => void (editingEntryId ? updateEntry() : createEntry())}>
                {editingEntryId ? "Salvar alterações" : "Adicionar"}
              </Button>
              {editingEntryId ? (
                <Button variant="ghost" onClick={() => resetEntryForm()}>
                  Cancelar edição
                </Button>
              ) : null}
              <Button variant="secondary" onClick={() => void loadEntries()}>Atualizar lista</Button>
              {entriesStatus ? <div className="text-sm text-muted-foreground">{entriesStatus}</div> : null}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <details className="rounded-xl border bg-background p-3">
                <summary className="cursor-pointer text-sm font-medium select-none">
                  Tipo {entryTypeFilters.length ? `(${entryTypeFilters.length})` : ""}
                </summary>
                <div className="mt-3 space-y-2 max-h-64 overflow-auto pr-1">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={entryTypeFilters.length === 0} onChange={() => setEntryTypeFilters([])} />
                    Todos
                  </label>
                  {typeOptions.includes("payable") ? (
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={entryTypeFilters.includes("payable")}
                        onChange={() => setEntryTypeFilters((s) => toggleInList(s, "payable"))}
                      />
                      A pagar
                    </label>
                  ) : null}
                  {typeOptions.includes("receivable") ? (
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={entryTypeFilters.includes("receivable")}
                        onChange={() => setEntryTypeFilters((s) => toggleInList(s, "receivable"))}
                      />
                      A receber
                    </label>
                  ) : null}
                </div>
              </details>

              <details className="rounded-xl border bg-background p-3">
                <summary className="cursor-pointer text-sm font-medium select-none">
                  Status {entryStatusFilters.length ? `(${entryStatusFilters.length})` : ""}
                </summary>
                <div className="mt-3 space-y-2 max-h-64 overflow-auto pr-1">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={entryStatusFilters.length === 0} onChange={() => setEntryStatusFilters([])} />
                    Todos
                  </label>
                  {statusOptions.includes("open") ? (
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={entryStatusFilters.includes("open")}
                        onChange={() => setEntryStatusFilters((s) => toggleInList(s, "open"))}
                      />
                      Aberto
                    </label>
                  ) : null}
                  {statusOptions.includes("paid") ? (
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={entryStatusFilters.includes("paid")}
                        onChange={() => setEntryStatusFilters((s) => toggleInList(s, "paid"))}
                      />
                      Pago
                    </label>
                  ) : null}
                </div>
              </details>

              <details className="rounded-xl border bg-background p-3">
                <summary className="cursor-pointer text-sm font-medium select-none">
                  Descrição {entryDescriptionFilters.length ? `(${entryDescriptionFilters.length})` : ""}
                </summary>
                <div className="mt-3 space-y-2 max-h-64 overflow-auto pr-1">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={entryDescriptionFilters.length === 0} onChange={() => setEntryDescriptionFilters([])} />
                    Todos
                  </label>
                  {descriptionOptions.map((d) => (
                    <label key={d} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={entryDescriptionFilters.includes(d)}
                        onChange={() => setEntryDescriptionFilters((s) => toggleInList(s, d))}
                      />
                      <span className="truncate">{d}</span>
                    </label>
                  ))}
                </div>
              </details>

              <details className="rounded-xl border bg-background p-3">
                <summary className="cursor-pointer text-sm font-medium select-none">
                  Cliente/Fornecedor {entryCounterpartyFilters.length ? `(${entryCounterpartyFilters.length})` : ""}
                </summary>
                <div className="mt-3 space-y-2 max-h-64 overflow-auto pr-1">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={entryCounterpartyFilters.length === 0}
                      onChange={() => setEntryCounterpartyFilters([])}
                    />
                    Todos
                  </label>
                  {counterpartyOptions.map((c) => (
                    <label key={c} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={entryCounterpartyFilters.includes(c)}
                        onChange={() => setEntryCounterpartyFilters((s) => toggleInList(s, c))}
                      />
                      <span className="truncate">{c}</span>
                    </label>
                  ))}
                </div>
              </details>
            </div>
            {filteredEntries.length > 0 && (
              <div className="rounded-xl border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left">Tipo</th>
                      <th className="px-4 py-3 text-left">Venc.</th>
                      <th className="px-4 py-3 text-left">Descrição</th>
                      <th className="px-4 py-3 text-left">Frequência</th>
                      <th className="px-4 py-3 text-left">Status</th>
                      <th className="px-4 py-3 text-right">Valor</th>
                      <th className="px-4 py-3 text-right" />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEntries.map((e) => (
                      <tr key={e.id} className="border-b last:border-0">
                        <td className="px-4 py-3">{e.kind === "payable" ? "Pagar" : "Receber"}</td>
                        <td className="px-4 py-3">{e.dueDate}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium">{e.description}</div>
                          {e.counterparty ? <div className="text-xs text-muted-foreground">{e.counterparty}</div> : null}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {e.frequency}
                          {e.recurrent ? " · Recorrente" : ""}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {e.status === "open" ? "Aberto" : e.status === "paid" ? `Pago (${e.paidAt})` : "Cancelado"}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">{e.amount.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex gap-1">
                            <button
                              className="h-8 px-2 rounded-md border text-xs hover:bg-muted"
                              onClick={() => startEditEntry(e)}
                              title="Editar"
                            >
                              Editar
                            </button>
                            {e.status !== "paid" ? (
                              <button className="h-8 px-2 rounded-md border text-xs hover:bg-muted" onClick={() => void markEntry(e.id, "paid")}>
                                Baixar
                              </button>
                            ) : (
                              <button className="h-8 px-2 rounded-md border text-xs hover:bg-muted" onClick={() => void markEntry(e.id, "open")}>
                                Reabrir
                              </button>
                            )}
                            {e.status !== "canceled" ? (
                              <button className="h-8 px-2 rounded-md border text-xs hover:bg-muted" onClick={() => void markEntry(e.id, "canceled")}>
                                Cancelar
                              </button>
                            ) : null}
                            <button className="h-8 px-2 rounded-md border text-xs hover:bg-destructive/10 hover:text-destructive" onClick={() => void deleteEntry(e.id)}>
                              Excluir
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
