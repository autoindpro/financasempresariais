import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { getSupabase } from "@/lib/supabase";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { fmt, currentCompetence } from "@/lib/finance";
import { Plus } from "lucide-react";
import { Button, Field, Input, Select, Textarea } from "@/components/Form";
import { Modal, Th, Td, RowActions } from "./receitas";

export const Route = createFileRoute("/gastos")({
  component: GastosPage,
  head: () => ({ meta: [{ title: "Gastos Operacionais · Flux Soluções" }] }),
});

function addMonths(dateIso: string, months: number): string {
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
}

function futureOffsetsUntilYearEnd(
  startDateIso: string,
  frequency: "Mensal" | "Trimestral" | "Anual" | "Eventual",
): number[] {
  // Replicate only within the same calendar year as the starting date.
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
}

function GastosPage() {
  const { expenses, addExpense, updateExpense, removeExpense, accounts } = useStore();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [groupFilters, setGroupFilters] = useState<string[]>([]);
  const [accountFilters, setAccountFilters] = useState<string[]>([]);
  const [descriptionFilters, setDescriptionFilters] = useState<string[]>([]);
  const today = new Date().toISOString().slice(0, 10);
  const thisMonth = currentCompetence();
  const storedFilter = (() => {
    try {
      const companyId = localStorage.getItem("flux_company_id") ?? "default";
      return localStorage.getItem(`flux_filter_gastos_competence:${companyId}`);
    } catch {
      return null;
    }
  })();
  const [filterCompetence, setFilterCompetence] = useState<string>(storedFilter || thisMonth);
  const blank = {
    competence: thisMonth,
    group: "",
    subgroup: "",
    accountType: "" as
      | ""
      | "Receita"
      | "Custo"
      | "Gasto"
      | "Financeiro"
      | "Investimento"
      | "Deduções",
    account: "",
    description: "",
    amount: 0,
    recurrent: false,
    frequency: "Mensal" as "Mensal" | "Trimestral" | "Anual" | "Eventual",
    date: today,
    notes: "",
  };
  const [form, setForm] = useState(blank);

  useEffect(() => {
    try {
      const companyId = localStorage.getItem("flux_company_id") ?? "default";
      localStorage.setItem(`flux_filter_gastos_competence:${companyId}`, filterCompetence);
    } catch {
      // ignore
    }
  }, [filterCompetence]);

  const competenceExpenses = useMemo(
    () => expenses.filter((e) => e.competence === filterCompetence),
    [expenses, filterCompetence],
  );

  const groupOptionsForFilter = useMemo(() => {
    const set = new Set<string>();
    for (const e of competenceExpenses) if (e.group) set.add(e.group);
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [competenceExpenses]);

  const accountOptionsForFilter = useMemo(() => {
    const set = new Set<string>();
    for (const e of competenceExpenses) if (e.account) set.add(e.account);
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [competenceExpenses]);

  const descriptionOptionsForFilter = useMemo(() => {
    const set = new Set<string>();
    for (const e of competenceExpenses) if (e.description?.trim()) set.add(e.description.trim());
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [competenceExpenses]);

  const filteredExpenses = useMemo(() => {
    let out = competenceExpenses;
    if (groupFilters.length) {
      const set = new Set(groupFilters);
      out = out.filter((e) => set.has(e.group));
    }
    if (accountFilters.length) {
      const set = new Set(accountFilters);
      out = out.filter((e) => set.has(e.account));
    }
    if (descriptionFilters.length) {
      const set = new Set(descriptionFilters);
      out = out.filter((e) => set.has((e.description ?? "").trim()));
    }
    return out;
  }, [accountFilters, competenceExpenses, descriptionFilters, groupFilters]);

  const total = filteredExpenses.reduce((s, e) => s + e.amount, 0);

  const activeAccounts = useMemo(() => accounts.filter((a) => a.active), [accounts]);

  const groups = useMemo(() => {
    const set = new Set<string>();
    for (const a of activeAccounts) if (a.group) set.add(a.group);
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [activeAccounts]);

  const subgroups = useMemo(() => {
    const set = new Set<string>();
    for (const a of activeAccounts) {
      if (a.group === form.group && a.subgroup) set.add(a.subgroup);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [activeAccounts, form.group]);

  const types = useMemo(() => {
    const set = new Set<string>();
    for (const a of activeAccounts) {
      if (a.group === form.group && a.subgroup === form.subgroup) set.add(a.type);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR")) as Array<
      "Receita" | "Custo" | "Gasto" | "Financeiro" | "Investimento" | "Deduções"
    >;
  }, [activeAccounts, form.group, form.subgroup]);

  const accountOptions = useMemo(() => {
    return activeAccounts
      .filter(
        (a) =>
          (!form.group || a.group === form.group) &&
          (!form.subgroup || a.subgroup === form.subgroup) &&
          (!form.accountType || a.type === form.accountType),
      )
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [activeAccounts, form.accountType, form.group, form.subgroup]);

  const openNew = () => {
    setEditingId(null);
    // Keep competence and date consistent; default to the first day of the selected month.
    setForm({ ...blank, competence: filterCompetence, date: `${filterCompetence}-01` });
    setOpen(true);
  };
  const openEdit = (e: (typeof expenses)[number]) => {
    setEditingId(e.id);
    const acc = accounts.find((a) => a.name === e.account);
    setForm({
      competence: e.competence,
      group: e.group,
      subgroup: e.subgroup,
      account: e.account,
      description: e.description,
      amount: e.amount,
      recurrent: e.recurrent,
      frequency: e.frequency,
      accountType: (acc?.type ?? "") as any,
      date: e.date,
      notes: e.notes || "",
    });
    setOpen(true);
  };

  // Keep form.competence and form.date in sync (prevents month totals inconsistencies).
  useEffect(() => {
    if (!open) return;
    const dateMonth = form.date?.slice(0, 7);
    if (dateMonth && dateMonth !== form.competence) {
      setForm((s) => ({ ...s, competence: dateMonth }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.date, open]);

  const deleteExpense = async (id: string) => {
    const ok = confirm("Excluir este gasto?");
    if (!ok) return;

    const supabase = getSupabase();
    const companyId = (() => {
      try {
        return localStorage.getItem("flux_company_id");
      } catch {
        return null;
      }
    })();

    if (supabase) {
      // Delete by primary key. RLS already enforces company access, and adding a company_id filter
      // can cause "no-op" deletes if localStorage company_id is stale or the user is platform admin.
      const { error } = await supabase.from("operational_expenses").delete().eq("id", id);
      if (error) {
        console.error("Supabase delete expense failed:", error);
        alert(`Não foi possível excluir no Supabase: ${error.message}`);
        return;
      }
    }

    removeExpense(id);
  };

  // Reset filters when competence changes (avoids hiding everything due to stale selections)
  useEffect(() => {
    setGroupFilters([]);
    setAccountFilters([]);
    setDescriptionFilters([]);
  }, [filterCompetence]);

  const toggleInList = (arr: string[], value: string): string[] => {
    if (arr.includes(value)) return arr.filter((x) => x !== value);
    return [...arr, value];
  };

  return (
    <AppLayout>
      <PageHeader
        title="Gastos Operacionais"
        description="Gastos recorrentes e eventuais classificados por grupo, subgrupo e conta."
        actions={
          <div className="flex items-center gap-2">
            <input
              type="month"
              value={filterCompetence}
              onChange={(e) => setFilterCompetence(e.target.value)}
              className="h-10 px-3 rounded-lg border bg-card text-sm"
            />
            <Button onClick={openNew}>
              <Plus className="h-4 w-4 inline mr-1" /> Novo Gasto
            </Button>
          </div>
        }
      />

      <div className="rounded-2xl bg-card border shadow-[var(--shadow-card)] p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <details className="rounded-xl border bg-background p-3">
            <summary className="cursor-pointer text-sm font-medium select-none">
              Grupo {groupFilters.length ? `(${groupFilters.length})` : ""}
            </summary>
            <div className="mt-3 space-y-2 max-h-64 overflow-auto pr-1">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={groupFilters.length === 0}
                  onChange={() => setGroupFilters([])}
                />
                Todos
              </label>
              {groupOptionsForFilter.map((g) => (
                <label key={g} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={groupFilters.includes(g)}
                    onChange={() => setGroupFilters((s) => toggleInList(s, g))}
                  />
                  {g}
                </label>
              ))}
            </div>
          </details>

          <details className="rounded-xl border bg-background p-3">
            <summary className="cursor-pointer text-sm font-medium select-none">
              Conta {accountFilters.length ? `(${accountFilters.length})` : ""}
            </summary>
            <div className="mt-3 space-y-2 max-h-64 overflow-auto pr-1">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={accountFilters.length === 0}
                  onChange={() => setAccountFilters([])}
                />
                Todos
              </label>
              {accountOptionsForFilter.map((a) => (
                <label key={a} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={accountFilters.includes(a)}
                    onChange={() => setAccountFilters((s) => toggleInList(s, a))}
                  />
                  {a}
                </label>
              ))}
            </div>
          </details>

          <details className="rounded-xl border bg-background p-3">
            <summary className="cursor-pointer text-sm font-medium select-none">
              Descrição {descriptionFilters.length ? `(${descriptionFilters.length})` : ""}
            </summary>
            <div className="mt-3 space-y-2 max-h-64 overflow-auto pr-1">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={descriptionFilters.length === 0}
                  onChange={() => setDescriptionFilters([])}
                />
                Todos
              </label>
              {descriptionOptionsForFilter.map((d) => (
                <label key={d} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={descriptionFilters.includes(d)}
                    onChange={() => setDescriptionFilters((s) => toggleInList(s, d))}
                  />
                  <span className="truncate">{d}</span>
                </label>
              ))}
            </div>
          </details>
        </div>
      </div>

      <div className="rounded-2xl bg-card border shadow-[var(--shadow-card)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <Th>Competência</Th>
                <Th>Grupo</Th>
                <Th>Conta</Th>
                <Th>Descrição</Th>
                <Th>Frequência</Th>
                <Th align="right">Valor</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {filteredExpenses.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-muted-foreground">
                    Nenhum lançamento.
                  </td>
                </tr>
              )}
              {filteredExpenses.map((e) => (
                <tr key={e.id} className="border-b last:border-0 hover:bg-muted/30">
                  <Td>{e.competence}</Td>
                  <Td>{e.group}</Td>
                  <Td>{e.account}</Td>
                  <Td className="text-muted-foreground">{e.description}</Td>
                  <Td>
                    <span className="text-xs px-2 py-0.5 rounded-md bg-secondary">
                      {e.frequency}
                      {e.recurrent ? " · Recorrente" : ""}
                    </span>
                  </Td>
                  <Td align="right" className="tabular-nums font-medium">
                    {fmt(e.amount)}
                  </Td>
                  <Td align="right">
                    <RowActions
                      onEdit={() => openEdit(e)}
                      onDelete={() => void deleteExpense(e.id)}
                    />
                  </Td>
                </tr>
              ))}
            </tbody>
            {filteredExpenses.length > 0 && (
              <tfoot className="bg-muted/30 font-semibold">
                <tr>
                  <td colSpan={5} className="px-4 py-3">
                    Total
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{fmt(total)}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {open && (
        <Modal title={editingId ? "Editar Gasto" : "Novo Gasto"} onClose={() => setOpen(false)}>
          <form
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
            onSubmit={(ev) => {
              ev.preventDefault();
              if (!form.amount || !form.account) return;
              const fixedCompetence = form.date.slice(0, 7);
              const payload = {
                competence: fixedCompetence,
                group: form.group,
                subgroup: form.subgroup,
                account: form.account,
                description: form.description,
                amount: form.amount,
                recurrent: form.recurrent,
                frequency: form.frequency,
                date: form.date,
                notes: form.notes,
              };
              if (editingId) {
                updateExpense(editingId, payload);
              } else {
                addExpense(payload);

                if (form.recurrent && form.frequency !== "Eventual") {
                  for (const off of futureOffsetsUntilYearEnd(form.date, form.frequency)) {
                    const nextDate = addMonths(form.date, off);
                    addExpense({
                      ...payload,
                      competence: nextDate.slice(0, 7),
                      date: nextDate,
                    });
                  }
                }
              }
              setOpen(false);
              setEditingId(null);
              setForm(blank);
            }}
          >
            <Field label="Competência">
              <Input
                type="month"
                value={form.competence}
                onChange={(e) => {
                  const next = e.target.value;
                  setForm((s) => {
                    const day = (s.date?.slice(8, 10) || "01").padStart(2, "0");
                    return { ...s, competence: next, date: `${next}-${day}` };
                  });
                }}
              />
            </Field>
            <Field label="Data Lançamento">
              <Input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </Field>
            <Field label="Grupo">
              <Select
                value={form.group}
                onChange={(e) => {
                  const nextGroup = e.target.value;
                  setForm((s) => ({
                    ...s,
                    group: nextGroup,
                    subgroup: "",
                    accountType: "",
                    account: "",
                  }));
                }}
              >
                <option value="">Selecione...</option>
                {groups.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Subgrupo">
              <Select
                value={form.subgroup}
                onChange={(e) => {
                  const nextSub = e.target.value;
                  setForm((s) => ({
                    ...s,
                    subgroup: nextSub,
                    accountType: "",
                    account: "",
                  }));
                }}
                disabled={!form.group}
              >
                <option value="">Selecione...</option>
                {subgroups.map((sg) => (
                  <option key={sg} value={sg}>
                    {sg}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Tipo">
              <Select
                value={form.accountType}
                onChange={(e) =>
                  setForm({ ...form, accountType: e.target.value as any, account: "" })
                }
                disabled={!form.group || !form.subgroup}
              >
                <option value="">
                  {form.group && form.subgroup ? "Selecione..." : "Selecione acima"}
                </option>
                {types.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Conta">
              <Select
                value={form.account}
                onChange={(e) => setForm({ ...form, account: e.target.value })}
                disabled={!form.group || !form.subgroup || !form.accountType}
              >
                <option value="">Selecione...</option>
                {accountOptions.map((a) => (
                  <option key={a.id} value={a.name}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Valor (R$)">
              <Input
                type="number"
                step="0.01"
                value={form.amount || ""}
                onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
              />
            </Field>
            <Field label="Frequência">
              <Select
                value={form.frequency}
                onChange={(e) => setForm({ ...form, frequency: e.target.value as any })}
              >
                <option>Mensal</option>
                <option>Trimestral</option>
                <option>Anual</option>
                <option>Eventual</option>
              </Select>
            </Field>
            <Field label="Descrição" span={2}>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </Field>
            <Field label="Observações" span={2}>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </Field>
            <label className="md:col-span-2 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.recurrent}
                onChange={(e) => setForm({ ...form, recurrent: e.target.checked })}
              />
              Lançamento recorrente automático
            </label>
            <div className="md:col-span-2 flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">{editingId ? "Atualizar" : "Salvar"}</Button>
            </div>
          </form>
        </Modal>
      )}
    </AppLayout>
  );
}
