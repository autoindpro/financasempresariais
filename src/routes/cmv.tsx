import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { getSupabase } from "@/lib/supabase";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { fmt, currentCompetence, buildDre } from "@/lib/finance";
import { Plus } from "lucide-react";
import { Button, Field, Input, Select, Textarea } from "@/components/Form";
import { Modal, Th, Td, RowActions } from "./receitas";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export const Route = createFileRoute("/cmv")({
  component: CmvPage,
  head: () => ({ meta: [{ title: "CMV · Flux Soluções" }] }),
});

function CmvPage() {
  const s = useStore();
  const { cmv, revenues, addCmv, updateCmv, removeCmv } = s;
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const thisMonth = currentCompetence();
  const thisYear = Number(thisMonth.slice(0, 4));
  const storedFilter = (() => {
    try {
      const companyId = localStorage.getItem("flux_company_id") ?? "default";
      return localStorage.getItem(`flux_filter_cmv_competence:${companyId}`);
    } catch {
      return null;
    }
  })();
  const [filterCompetence, setFilterCompetence] = useState<string>(storedFilter || thisMonth);

  const storedYear = (() => {
    try {
      const companyId = localStorage.getItem("flux_company_id") ?? "default";
      const raw = localStorage.getItem(`flux_filter_cmv_year:${companyId}`);
      return raw ? Number(raw) : null;
    } catch {
      return null;
    }
  })();
  const [filterYear, setFilterYear] = useState<number>(Number.isFinite(storedYear) && storedYear ? storedYear : thisYear);
  const blank = {
    competence: thisMonth,
    type: "CMV" as "CMV" | "CPV" | "CSP",
    amount: 0,
    source: "",
    responsible: "",
    notes: "",
  };
  const [form, setForm] = useState(blank);

  useEffect(() => {
    try {
      const companyId = localStorage.getItem("flux_company_id") ?? "default";
      localStorage.setItem(`flux_filter_cmv_competence:${companyId}`, filterCompetence);
    } catch {
      // ignore
    }
  }, [filterCompetence]);

  useEffect(() => {
    try {
      const companyId = localStorage.getItem("flux_company_id") ?? "default";
      localStorage.setItem(`flux_filter_cmv_year:${companyId}`, String(filterYear));
    } catch {
      // ignore
    }
  }, [filterYear]);

  const filteredCmv = useMemo(
    () => cmv.filter((c) => c.competence === filterCompetence),
    [cmv, filterCompetence],
  );

  const dre = useMemo(() => buildDre({ ...s, competence: filterCompetence }), [s, filterCompetence]);
  const pct = dre.receitaLiquida ? (dre.cmvTotal / dre.receitaLiquida) * 100 : 0;

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    years.add(thisYear);
    for (const c of cmv) years.add(Number(c.competence.slice(0, 4)));
    for (const r of revenues) years.add(Number(r.competence.slice(0, 4)));
    return Array.from(years).filter((y) => Number.isFinite(y)).sort((a, b) => b - a);
  }, [cmv, revenues, thisYear]);

  const yearSeries = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => i + 1);
    const pad2 = (n: number) => String(n).padStart(2, "0");
    const label = (m: number) => `${pad2(m)}/${String(filterYear).slice(2, 4)}`;

    const cmvByMonth = new Map<string, number>();
    for (const c of cmv) {
      if (!c.competence.startsWith(`${filterYear}-`)) continue;
      cmvByMonth.set(c.competence, (cmvByMonth.get(c.competence) || 0) + c.amount);
    }

    const revByMonth = new Map<string, number>();
    for (const r of revenues) {
      if (!r.competence.startsWith(`${filterYear}-`)) continue;
      revByMonth.set(r.competence, (revByMonth.get(r.competence) || 0) + r.amount);
    }

    return months.map((m) => {
      const competence = `${filterYear}-${pad2(m)}`;
      return {
        competencia: label(m),
        receita: revByMonth.get(competence) || 0,
        cmv: cmvByMonth.get(competence) || 0,
      };
    });
  }, [cmv, revenues, filterYear]);

  const openNew = () => { setEditingId(null); setForm({ ...blank, competence: filterCompetence }); setOpen(true); };
  const openEdit = (c: typeof cmv[number]) => {
    setEditingId(c.id);
    setForm({ competence: c.competence, type: c.type, amount: c.amount, source: c.source || "", responsible: c.responsible || "", notes: c.notes || "" });
    setOpen(true);
  };

  const deleteCmv = async (id: string) => {
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
      const { error } = await supabase.from("cmv_cpv_csp").delete().eq("company_id", companyId).eq("id", id);
      if (error) {
        console.error("Supabase delete CMV failed:", error);
        alert(`Não foi possível excluir no Supabase: ${error.message}`);
        return;
      }
    }

    removeCmv(id);
  };

  return (
    <AppLayout>
      <PageHeader
        title="CMV"
        description="Custos das mercadorias, produtos ou serviços vendidos no período."
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Stat label="Total CMV" value={fmt(dre.cmvTotal)} />
        <Stat label="% sobre Receita Líquida" value={`${pct.toFixed(1).replace(".", ",")}%`} />
        <Stat label="Lucro Bruto" value={fmt(dre.lucroBruto)} />
      </div>

      <div className="rounded-2xl bg-card border p-5 shadow-[var(--shadow-card)] mb-6">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <div>
          <h3 className="font-semibold font-display">CMV x Receita Bruta</h3>
          <p className="text-xs text-muted-foreground">Comparativo mensal do ano selecionado.</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Ano</span>
            <Select value={String(filterYear)} onChange={(e) => setFilterYear(Number(e.target.value))} className="w-28">
              {availableYears.map((y) => (
                <option key={y} value={String(y)}>
                  {y}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="h-72">
          <ResponsiveContainer>
            <LineChart data={yearSeries}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="competencia" stroke="var(--muted-foreground)" fontSize={12} />
              <YAxis stroke="var(--muted-foreground)" fontSize={12} tickFormatter={(v: any) => `${(Number(v) / 1000).toFixed(0)}k`} />
              <Tooltip
                formatter={(v: any, name: any) => [fmt(Number(v)), name === "receita" ? "Receita Bruta" : "CMV"]}
                contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12 }}
              />
              <Legend />
              <Line type="monotone" dataKey="receita" name="Receita Bruta" stroke="var(--chart-1)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="cmv" name="CMV" stroke="var(--chart-2)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-2xl bg-card border shadow-[var(--shadow-card)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <Th>Competência</Th>
                <Th>Tipo</Th>
                <Th align="right">Valor</Th>
                <Th>Fonte</Th>
                <Th>Responsável</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {filteredCmv.length === 0 && (
                <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">Nenhum lançamento.</td></tr>
              )}
              {filteredCmv.map((c) => (
                <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30">
                  <Td>{c.competence}</Td>
                  <Td><span className="px-2 py-0.5 rounded-md bg-accent text-accent-foreground text-xs font-medium">{c.type}</span></Td>
                  <Td align="right" className="tabular-nums font-medium">{fmt(c.amount)}</Td>
                  <Td className="text-muted-foreground">{c.source}</Td>
                  <Td className="text-muted-foreground">{c.responsible}</Td>
                  <Td align="right">
                    <RowActions
                      onEdit={() => openEdit(c)}
                      onDelete={() => void deleteCmv(c.id)}
                    />
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {open && (
        <Modal title={editingId ? "Editar CMV" : "Novo CMV"} onClose={() => setOpen(false)}>
          <form
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!form.amount) return;
              if (editingId) updateCmv(editingId, form);
              else addCmv(form);
              setOpen(false);
              setEditingId(null);
              setForm(blank);
            }}
          >
            <Field label="Competência">
              <Input type="month" value={form.competence} onChange={(e) => setForm({ ...form, competence: e.target.value })} />
            </Field>
            <Field label="Tipo">
              <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as any })}>
                <option value="CMV">CMV — Mercadorias</option>
                <option value="CPV">CPV — Produtos</option>
                <option value="CSP">CSP — Serviços</option>
              </Select>
            </Field>
            <Field label="Valor (R$)">
              <Input type="number" step="0.01" value={form.amount || ""} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} />
            </Field>
            <Field label="Fonte do cálculo">
              <Input value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} placeholder="Ex.: ERP, Planilha..." />
            </Field>
            <Field label="Responsável" span={2}>
              <Input value={form.responsible} onChange={(e) => setForm({ ...form, responsible: e.target.value })} />
            </Field>
            <Field label="Observações" span={2}>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </Field>
            <div className="md:col-span-2 flex justify-between gap-2">
              {editingId ? (
                <Button
                  type="button"
                  variant="danger"
                  onClick={() => {
                    void deleteCmv(editingId);
                    setOpen(false);
                    setEditingId(null);
                    setForm(blank);
                  }}
                >
                  Excluir
                </Button>
              ) : (
                <span />
              )}
              <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit">{editingId ? "Atualizar" : "Salvar"}</Button>
              </div>
            </div>
          </form>
        </Modal>
      )}
    </AppLayout>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-card border p-5 shadow-[var(--shadow-card)]">
      <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium">{label}</div>
      <div className="mt-2 text-xl font-semibold font-display tabular-nums">{value}</div>
    </div>
  );
}
