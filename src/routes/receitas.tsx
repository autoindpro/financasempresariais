import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { getSupabase } from "@/lib/supabase";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { fmt, currentCompetence } from "@/lib/finance";
import { Plus, Trash2, Pencil } from "lucide-react";
import { Button, Field, Input, Select, Textarea, ComboInput } from "@/components/Form";
import { addOptionValue, pullOptionValues } from "@/lib/supabase-options";

export const Route = createFileRoute("/receitas")({
  component: ReceitasPage,
  head: () => ({ meta: [{ title: "Receita Bruta · Flux Soluções" }] }),
});

function ReceitasPage() {
  const { revenues, addRevenue, updateRevenue, removeRevenue, options, addOption } = useStore();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const thisMonth = currentCompetence();
  const supabase = useMemo(() => getSupabase(), []);
  const companyId = useMemo(() => {
    try {
      return localStorage.getItem("flux_company_id");
    } catch {
      return null;
    }
  }, []);
  const storedFilter = (() => {
    try {
      const companyId = localStorage.getItem("flux_company_id") ?? "default";
      return localStorage.getItem(`flux_filter_receitas_competence:${companyId}`);
    } catch {
      return null;
    }
  })();
  const [filterCompetence, setFilterCompetence] = useState<string>(storedFilter || thisMonth);
  const blank = {
    competence: thisMonth,
    amount: 0,
    type: "",
    kind: "",
    channel: "",
    productOrService: "",
    frequency: "Mensal" as "Mensal" | "Trimestral" | "Anual" | "Eventual",
    notes: "",
    recurrentAuto: false,
    impactsDre: true,
  };
  const [form, setForm] = useState(blank);

  useEffect(() => {
    let alive = true;
    async function run() {
      try {
        if (!supabase || !companyId) return;
        const res = await pullOptionValues(supabase, companyId, ["revenueTypes", "channels", "revenueProducts"]);
        if (!alive) return;
        for (const v of res.revenueTypes ?? []) addOption("revenueTypes", v);
        for (const v of res.channels ?? []) addOption("channels", v);
        for (const v of res.revenueProducts ?? []) addOption("revenueProducts", v);
      } catch (e) {
        console.warn("Failed to pull option_values:", e);
      }
    }
    run();
    return () => {
      alive = false;
    };
  }, [addOption, companyId, supabase]);

  useEffect(() => {
    try {
      const companyId = localStorage.getItem("flux_company_id") ?? "default";
      localStorage.setItem(`flux_filter_receitas_competence:${companyId}`, filterCompetence);
    } catch {
      // ignore
    }
  }, [filterCompetence]);

  const filteredRevenues = useMemo(
    () => revenues.filter((r) => r.competence === filterCompetence),
    [revenues, filterCompetence],
  );

  const total = filteredRevenues.reduce((s, r) => s + r.amount, 0);

  function futureCompetencesUntilYearEnd(
    startCompetence: string,
    frequency: "Mensal" | "Trimestral" | "Anual" | "Eventual",
  ): string[] {
    const m = startCompetence.match(/^(\d{4})-(\d{2})$/);
    if (!m) return [];
    const year = Number(m[1]);
    const month = Number(m[2]); // 1..12
    if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return [];
    if (frequency === "Eventual") return [];
    const step = frequency === "Mensal" ? 1 : frequency === "Trimestral" ? 3 : 12;
    const out: string[] = [];
    for (let mo = month + step; mo <= 12; mo += step) out.push(`${year}-${String(mo).padStart(2, "0")}`);
    return out;
  }

  const openNew = () => { setEditingId(null); setForm({ ...blank, competence: filterCompetence }); setOpen(true); };
  const openEdit = (r: typeof revenues[number]) => {
    setEditingId(r.id);
    setForm({
      competence: r.competence,
      amount: r.amount,
      type: r.type,
      kind: (r as any).kind ?? "",
      channel: r.channel,
      productOrService: (r as any).productOrService ?? "",
      frequency: (r as any).frequency ?? "Mensal",
      notes: r.notes || "",
      recurrentAuto: false,
      impactsDre: (r as any).impactsDre ?? true,
    });
    setOpen(true);
  };

  const deleteRevenue = async (id: string) => {
    const ok = confirm("Excluir este lançamento?");
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
      const { error } = await supabase.from("revenues").delete().eq("company_id", companyId).eq("id", id);
      if (error) {
        console.error("Supabase delete revenue failed:", error);
        alert(`Não foi possível excluir no Supabase: ${error.message}`);
        return;
      }
    }

    removeRevenue(id);
  };

  return (
    <AppLayout>
      <PageHeader
        title="Receita Bruta"
        description="Lançamentos manuais de receita por competência, tipo e canal."
        actions={
          <div className="flex items-center gap-2">
            <input
              type="month"
              value={filterCompetence}
              onChange={(e) => setFilterCompetence(e.target.value)}
              className="h-10 px-3 rounded-lg border bg-card text-sm"
            />
            <Button onClick={openNew}>
              <Plus className="h-4 w-4 inline mr-1" /> Novo Lançamento
            </Button>
          </div>
        }
      />

      <div className="rounded-2xl bg-card border shadow-[var(--shadow-card)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <Th>Competência</Th>
                <Th>Categoria da Receita</Th>
                <Th>Tipo de Receita</Th>
                <Th>Centro de Receita</Th>
                <Th>Produto / Serviço</Th>
                <Th>Frequência</Th>
                <Th align="right">Valor</Th>
                <Th>Observações</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {filteredRevenues.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-muted-foreground">
                    Nenhum lançamento. Clique em "Novo Lançamento".
                  </td>
                </tr>
              )}
              {filteredRevenues.map((r) => (
                <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                  <Td>{r.competence}</Td>
                  <Td>{r.type}</Td>
                  <Td>{(r as any).kind ?? ""}</Td>
                  <Td>{r.channel}</Td>
                  <Td>{(r as any).productOrService ?? ""}</Td>
                  <Td>{(r as any).frequency ?? "Mensal"}</Td>
                  <Td align="right" className="tabular-nums font-medium">{fmt(r.amount)}</Td>
                  <Td className="text-muted-foreground">
                    <div
                      className="max-w-[520px] whitespace-pre-line break-words overflow-hidden [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical]"
                      title={r.notes ?? ""}
                    >
                      {r.notes}
                    </div>
                  </Td>
                  <Td align="right">
                    <RowActions onEdit={() => openEdit(r)} onDelete={() => void deleteRevenue(r.id)} />
                  </Td>
                </tr>
              ))}
            </tbody>
            {filteredRevenues.length > 0 && (
              <tfoot className="bg-muted/30 font-semibold">
                <tr>
                  <td colSpan={6} className="px-4 py-3">Total</td>
                  <td className="px-4 py-3 text-right tabular-nums">{fmt(total)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {open && (
        <Modal title={editingId ? "Editar Receita" : "Nova Receita"} onClose={() => setOpen(false)}>
          <form
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!form.amount || !form.type) return;
              const payload = {
                competence: form.competence,
                amount: form.amount,
                type: form.type,
                kind: form.kind,
                channel: form.channel,
                productOrService: form.productOrService,
                frequency: form.frequency,
                impactsDre: form.impactsDre,
                notes: form.notes,
              };
              if (editingId) {
                updateRevenue(editingId, payload as any);
              } else {
                addRevenue(payload as any);
                if (form.recurrentAuto) {
                  for (const nextCompetence of futureCompetencesUntilYearEnd(form.competence, form.frequency)) {
                    addRevenue({ ...payload, competence: nextCompetence } as any);
                  }
                }
              }
              setOpen(false);
              setEditingId(null);
              setForm(blank);
            }}
          >
            <Field label="Competência">
              <Input type="month" value={form.competence} onChange={(e) => setForm({ ...form, competence: e.target.value })} />
            </Field>
            <Field label="Valor (R$)">
              <Input type="number" step="0.01" value={form.amount || ""} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} />
            </Field>
            <Field label="Categoria da Receita">
              <ComboInput
                value={form.type}
                onChange={(v) => setForm({ ...form, type: v })}
                options={options.revenueTypes}
                onAddOption={(v) => {
                  addOption("revenueTypes", v);
                  if (supabase && companyId) {
                    addOptionValue(supabase, companyId, "revenueTypes", v).catch((e) =>
                      console.warn("Failed to persist option value:", e),
                    );
                  }
                }}
              />
            </Field>
            <Field label="Tipo de Receita">
              <ComboInput
                value={form.kind}
                onChange={(v) => setForm({ ...form, kind: v })}
                options={options.revenueKinds}
              />
            </Field>
            <Field label="Centro de Receita">
              <ComboInput
                value={form.channel}
                onChange={(v) => setForm({ ...form, channel: v })}
                options={options.channels}
                onAddOption={(v) => {
                  addOption("channels", v);
                  if (supabase && companyId) {
                    addOptionValue(supabase, companyId, "channels", v).catch((e) =>
                      console.warn("Failed to persist option value:", e),
                    );
                  }
                }}
              />
            </Field>
            <Field label="Produto / Serviço">
              <ComboInput
                value={form.productOrService}
                onChange={(v) => setForm({ ...form, productOrService: v })}
                options={options.revenueProducts}
                onAddOption={(v) => {
                  addOption("revenueProducts", v);
                  if (supabase && companyId) {
                    addOptionValue(supabase, companyId, "revenueProducts", v).catch((e) =>
                      console.warn("Failed to persist option value:", e),
                    );
                  }
                }}
              />
            </Field>
            <div className="flex items-end gap-4">
              <div className="flex-1">
                <Field label="Frequência">
                  <Select
                    value={form.frequency}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        frequency: e.target.value as any,
                      })
                    }
                  >
                    <option value="Mensal">Mensal</option>
                    <option value="Trimestral">Trimestral</option>
                    <option value="Anual">Anual</option>
                    <option value="Eventual">Eventual</option>
                  </Select>
                </Field>
              </div>
              <label className="flex items-center gap-2 text-sm pb-2 select-none">
                <input
                  id="revenue-impacts-dre"
                  type="checkbox"
                  checked={form.impactsDre}
                  onChange={(e) => setForm({ ...form, impactsDre: e.target.checked })}
                />
                Impacta DRE
              </label>
            </div>
            <Field label="Observações" span={2}>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </Field>
            <div className="md:col-span-2 flex items-center gap-2">
              <input
                id="revenue-recurrent-auto"
                type="checkbox"
                checked={form.recurrentAuto}
                onChange={(e) => setForm({ ...form, recurrentAuto: e.target.checked })}
              />
              <label htmlFor="revenue-recurrent-auto" className="text-sm">
                Lançamento recorrente automático
              </label>
            </div>
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

export function Th({ children, align = "left" }: { children?: React.ReactNode; align?: "left" | "right" }) {
  return <th className={`px-4 py-3 font-medium text-muted-foreground text-${align} text-xs uppercase tracking-wider`}>{children}</th>;
}
export function Td({ children, align = "left", className = "" }: { children?: React.ReactNode; align?: "left" | "right"; className?: string }) {
  return <td className={`px-4 py-3 text-${align} ${className}`}>{children}</td>;
}

export function RowActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="inline-flex gap-1">
      <button onClick={onEdit} className="p-1.5 hover:bg-muted rounded" title="Editar">
        <Pencil className="h-4 w-4" />
      </button>
      <button onClick={onDelete} className="p-1.5 hover:bg-destructive/10 hover:text-destructive rounded" title="Excluir">
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

export function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-card rounded-2xl border shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b flex items-center justify-between sticky top-0 bg-card">
          <h2 className="font-semibold font-display">{title}</h2>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded">×</button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
