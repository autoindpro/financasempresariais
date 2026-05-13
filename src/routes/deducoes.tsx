import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { getSupabase } from "@/lib/supabase";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { fmt, currentCompetence } from "@/lib/finance";
import { Plus } from "lucide-react";
import { Button, Field, Input, Textarea, ComboInput, Select } from "@/components/Form";
import { Modal, Th, Td, RowActions } from "./receitas";

export const Route = createFileRoute("/deducoes")({
  component: DeducoesPage,
  head: () => ({ meta: [{ title: "Deduções · Flux Soluções" }] }),
});

function DeducoesPage() {
  const { deductions, addDeduction, updateDeduction, removeDeduction, options, addOption, accounts } = useStore();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [mode, setMode] = useState<"simples" | "avancado">("avancado");
  const thisMonth = currentCompetence();
  const storedFilter = (() => {
    try {
      const companyId = localStorage.getItem("flux_company_id") ?? "default";
      return localStorage.getItem(`flux_filter_deducoes_competence:${companyId}`);
    } catch {
      return null;
    }
  })();
  const [filterCompetence, setFilterCompetence] = useState<string>(storedFilter || thisMonth);
  const blank = {
    competence: thisMonth,
    date: new Date().toISOString().slice(0, 10),
    group: "",
    subgroup: "",
    accountType: "" as "" | "Receita" | "Custo" | "Gasto" | "Financeiro" | "Investimento" | "Deduções",
    account: "",
    amount: 0,
    description: "",
    notes: "",
  };
  const [form, setForm] = useState(blank);

  useEffect(() => {
    try {
      const companyId = localStorage.getItem("flux_company_id") ?? "default";
      localStorage.setItem(`flux_filter_deducoes_competence:${companyId}`, filterCompetence);
    } catch {
      // ignore
    }
  }, [filterCompetence]);

  const filteredDeductions = useMemo(
    () => deductions.filter((d) => d.competence === filterCompetence),
    [deductions, filterCompetence],
  );

  // Fonte de verdade: Plano de Contas (chart_of_accounts)
  // Grupo -> Subgrupo -> Tipo -> Conta (nome)
  const deductionAccounts = useMemo(
    () =>
      accounts.filter((a) => {
        if (!a.active) return false;
        const g = a.group?.trim().toLowerCase();
        if (g === "deduções") return true;
        return a.type === "Deduções";
      }),
    [accounts],
  );

  const deductionGroups = useMemo(() => {
    const set = new Set<string>();
    for (const a of deductionAccounts) if (a.group) set.add(a.group);
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [deductionAccounts]);

  const deductionSubgroups = useMemo(() => {
    if (!form.group) return [];
    const set = new Set<string>();
    for (const a of deductionAccounts) {
      if (a.group === form.group && a.subgroup) set.add(a.subgroup);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [deductionAccounts, form.group]);

  const deductionAccountTypes = useMemo(() => {
    if (!form.group || !form.subgroup) return [];
    const set = new Set<string>();
    for (const a of deductionAccounts) {
      if (a.group === form.group && a.subgroup === form.subgroup) set.add(a.type);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR")) as Array<
      "Receita" | "Custo" | "Gasto" | "Financeiro" | "Investimento" | "Deduções"
    >;
  }, [deductionAccounts, form.group, form.subgroup]);

  const accountsForSelection = useMemo(() => {
    if (!form.group || !form.subgroup || !form.accountType) return [];
    return deductionAccounts
      .filter((a) => a.group === form.group && a.subgroup === form.subgroup && a.type === form.accountType)
      .map((a) => a.name)
      .sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [deductionAccounts, form.accountType, form.group, form.subgroup]);

  const openNew = () => { setEditingId(null); setForm({ ...blank, competence: filterCompetence }); setOpen(true); };
  const openEdit = (d: typeof deductions[number]) => {
    const acc = accounts.find((a) => a.name === d.account);
    setEditingId(d.id);
    setForm({
      competence: d.competence,
      date: d.date ?? new Date().toISOString().slice(0, 10),
      group: acc?.group ?? "",
      subgroup: acc?.subgroup ?? d.type ?? "",
      accountType: (acc?.type ?? "Deduções") as any,
      account: d.account,
      amount: d.amount,
      description: d.description ?? "",
      notes: d.notes || "",
    });
    setMode("avancado");
    setOpen(true);
  };

  const deleteDeduction = async (id: string) => {
    const ok = confirm("Excluir esta dedução?");
    if (!ok) return;

    const supabase = getSupabase();
    const companyId = (() => {
      try {
        return localStorage.getItem("flux_company_id");
      } catch {
        return null;
      }
    })();

    if (supabase && companyId) {
      const { error } = await supabase.from("deductions").delete().eq("company_id", companyId).eq("id", id);
      if (error) {
        console.error("Supabase delete deduction failed:", error);
        alert(`Não foi possível excluir no Supabase: ${error.message}`);
        return;
      }
    }

    removeDeduction(id);
  };

  return (
    <AppLayout>
      <PageHeader
        title="Deduções da Receita Bruta"
        description="Impostos, taxas comerciais e deduções comerciais."
        actions={
          <>
            <input
              type="month"
              value={filterCompetence}
              onChange={(e) => setFilterCompetence(e.target.value)}
              className="h-10 px-3 rounded-lg border bg-card text-sm"
            />
            <div className="flex rounded-lg border overflow-hidden">
              <button onClick={() => setMode("simples")} className={`px-3 h-10 text-sm ${mode === "simples" ? "bg-primary text-primary-foreground" : "bg-card"}`}>Simplificado</button>
              <button onClick={() => setMode("avancado")} className={`px-3 h-10 text-sm ${mode === "avancado" ? "bg-primary text-primary-foreground" : "bg-card"}`}>Avançado</button>
            </div>
            <Button onClick={openNew}>
              <Plus className="h-4 w-4 inline mr-1" /> Nova Dedução
            </Button>
          </>
        }
      />

      <div className="rounded-2xl bg-card border shadow-[var(--shadow-card)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <Th>Competência</Th>
                <Th>Tipo</Th>
                <Th>Conta</Th>
                <Th align="right">Valor</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {filteredDeductions.length === 0 && (
                <tr><td colSpan={5} className="text-center py-12 text-muted-foreground">Nenhum lançamento.</td></tr>
              )}
              {filteredDeductions.map((d) => (
                <tr key={d.id} className="border-b last:border-0 hover:bg-muted/30">
                  <Td>{d.competence}</Td>
                  <Td>{d.type}</Td>
                  <Td>{d.account}</Td>
                  <Td align="right" className="tabular-nums font-medium">{fmt(d.amount)}</Td>
                  <Td align="right">
                    <RowActions onEdit={() => openEdit(d)} onDelete={() => void deleteDeduction(d.id)} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {open && (
        <Modal title={editingId ? "Editar Dedução" : "Nova Dedução"} onClose={() => setOpen(false)}>
          <form
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!form.amount) return;
              const effective =
                mode === "simples" && !editingId
                  ? { ...form, group: "Deduções", subgroup: "Impostos", accountType: "Deduções" as const, account: "Simples Nacional" }
                  : form;

              const payload = {
                competence: effective.competence,
                date: effective.date,
                group: effective.group,
                subgroup: effective.subgroup,
                type: effective.accountType, // Plano de contas: type
                account: effective.account,
                amount: effective.amount,
                description: effective.description,
                notes: effective.notes,
              };

              if (editingId) updateDeduction(editingId, payload);
              else addDeduction(payload);
              setOpen(false);
              setEditingId(null);
              setForm(blank);
            }}
          >
            <Field label="Competência">
              <Input type="month" value={form.competence} onChange={(e) => setForm({ ...form, competence: e.target.value })} />
            </Field>
            <Field label="Data de Lançamento">
              <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </Field>
            {(mode === "avancado" || editingId) && (
              <>
                <Field label="Grupo">
                  <ComboInput
                    value={form.group}
                    onChange={(v) => setForm({ ...form, group: v, subgroup: "", accountType: "", account: "" })}
                    options={deductionGroups.length ? deductionGroups : ["Deduções"]}
                  />
                </Field>
                <Field label="Subgrupo">
                  <ComboInput
                    value={form.subgroup}
                    onChange={(v) => setForm({ ...form, subgroup: v, accountType: "", account: "" })}
                    options={deductionSubgroups.length ? deductionSubgroups : options.deductionTypes}
                    onAddOption={(v) => addOption("deductionTypes", v)}
                    placeholder={form.group ? "Selecione..." : "Selecione o grupo primeiro"}
                  />
                </Field>
                <Field label="Tipo">
                  <Select
                    value={form.accountType}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setForm({ ...form, accountType: e.target.value as any, account: "" })}
                    disabled={!form.group || !form.subgroup}
                  >
                    <option value="">{form.group && form.subgroup ? "Selecione..." : "Selecione acima"}</option>
                    {deductionAccountTypes.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Conta">
                  <ComboInput
                    value={form.account}
                    onChange={(v) => setForm({ ...form, account: v })}
                    options={accountsForSelection.length ? accountsForSelection : options.deductionAccounts}
                    onAddOption={(v) => addOption("deductionAccounts", v)}
                    placeholder={form.accountType ? "Selecione..." : "Selecione o tipo primeiro"}
                  />
                </Field>
              </>
            )}
            <Field label="Valor (R$)">
              <Input type="number" step="0.01" value={form.amount || ""} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} />
            </Field>
            <Field label="Descrição">
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </Field>
            <Field label="Observações" span={2}>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </Field>
            <div className="md:col-span-2 flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit">{editingId ? "Atualizar" : "Salvar"}</Button>
            </div>
          </form>
        </Modal>
      )}
    </AppLayout>
  );
}
