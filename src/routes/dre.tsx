import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { buildDre, fmt, currentCompetence } from "@/lib/finance";
import { Download, Minus, Plus } from "lucide-react";
import { Button } from "@/components/Form";

export const Route = createFileRoute("/dre")({
  component: DrePage,
  head: () => ({ meta: [{ title: "DRE Gerencial · Flux Soluções" }] }),
});

function DrePage() {
  const s = useStore();
  const [competence, setCompetence] = useState(currentCompetence());
  const [expanded, setExpanded] = useState({
    receitas: true,
    receitasForaDre: true,
    deducoes: true,
    cmv: true,
    gastos: true,
  });
  const dre = useMemo(() => buildDre({ ...s, competence }), [s, competence]);
  const dreAnterior = useMemo(() => {
    const [y, m] = competence.split("-").map(Number);
    const d = new Date(y, m - 2, 1);
    const prev = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    return buildDre({ ...s, competence: prev });
  }, [s, competence]);

  const receitasDre = useMemo(
    () => s.revenues.filter((r) => r.competence === competence).filter((r) => (r as any).impactsDre !== false),
    [s.revenues, competence],
  );
  const receitasForaDre = useMemo(
    () => s.revenues.filter((r) => r.competence === competence).filter((r) => (r as any).impactsDre === false),
    [s.revenues, competence],
  );
  const deducoes = useMemo(() => s.deductions.filter((d) => d.competence === competence), [s.deductions, competence]);
  const cmv = useMemo(() => s.cmv.filter((c) => c.competence === competence), [s.cmv, competence]);
  const gastos = useMemo(() => s.expenses.filter((e) => e.competence === competence), [s.expenses, competence]);

  const accountsByName = useMemo(() => {
    const map = new Map<string, (typeof s.accounts)[number]>();
    for (const a of s.accounts) map.set(a.name.trim().toLowerCase(), a);
    return map;
  }, [s.accounts]);

  const isEntrada = (e: (typeof gastos)[number]) => {
    // Regra prioritária: Financeiro > Receitas Financeiras é entrada (+)
    if (e.group.trim().toLowerCase() === "financeiro" && e.subgroup.trim().toLowerCase() === "receitas financeiras") {
      return true;
    }
    const acc = accountsByName.get(e.account.trim().toLowerCase());
    // Regra: contas do tipo "Receita" são entradas (+); o resto é saída (-)
    return acc?.type === "Receita";
  };

  return (
    <AppLayout>
      <PageHeader
        title="DRE Gerencial"
        description="Demonstração do Resultado do Exercício com análise vertical e horizontal."
        actions={
          <div className="flex gap-2 flex-wrap print:hidden">
            <input
              type="month"
              value={competence}
              onChange={(e) => setCompetence(e.target.value)}
              className="h-10 px-3 rounded-lg border bg-card text-sm"
            />
            <Button variant="secondary" onClick={() => window.print()}>
              <Download className="h-4 w-4 inline mr-1" /> Exportar
            </Button>
          </div>
        }
      />

      <div className="rounded-2xl bg-card border shadow-[var(--shadow-card)] overflow-hidden print-avoid-break">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-left px-6 py-3 font-medium text-muted-foreground">Conta</th>
                <th className="text-right px-6 py-3 font-medium text-muted-foreground">Atual</th>
                <th className="text-right px-6 py-3 font-medium text-muted-foreground">A.V.</th>
                <th className="text-right px-6 py-3 font-medium text-muted-foreground">Anterior</th>
                <th className="text-right px-6 py-3 font-medium text-muted-foreground">A.H.</th>
              </tr>
            </thead>
            <tbody>
              {dre.lines.map((line, i) => {
                const ant = dreAnterior.lines[i]?.value || 0;
                const ah = ant ? ((line.value - ant) / Math.abs(ant)) * 100 : 0;
                return (
                  <tr
                    key={i}
                    className={`border-b last:border-0 ${
                      line.kind === "subtotal" ? "bg-muted/30" : ""
                    } ${line.bold ? "font-semibold" : ""}`}
                  >
                    <td className="px-6 py-3">{line.label}</td>
                    <td
                      className={`px-6 py-3 text-right tabular-nums ${
                        line.value < 0 ? "text-destructive" : line.kind === "pos" ? "text-success" : ""
                      }`}
                    >
                      {fmt(line.value)}
                    </td>
                    <td className="px-6 py-3 text-right tabular-nums text-muted-foreground">
                      {line.pct !== undefined ? `${(line.pct * 100).toFixed(1).replace(".", ",")}%` : "—"}
                    </td>
                    <td className="px-6 py-3 text-right tabular-nums text-muted-foreground">{fmt(ant)}</td>
                    <td className={`px-6 py-3 text-right tabular-nums ${ah > 0 ? "text-success" : ah < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                      {ant ? `${ah > 0 ? "+" : ""}${ah.toFixed(1).replace(".", ",")}%` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        <DetailSection
          title="Receita Bruta — Lançamentos"
          subtitle={`${receitasDre.length} lançamento(s) · Total ${fmt(receitasDre.reduce((sum, r) => sum + r.amount, 0))}`}
          open={expanded.receitas}
          onToggle={() => setExpanded((x) => ({ ...x, receitas: !x.receitas }))}
        >
          <SimpleTable
            columns={[
              "Competência",
              "Tipo de Receita",
              "Categoria da Receita",
              "Centro de Receita",
              "Produto / Serviço",
              "Frequência",
              "Valor",
              "Observações",
            ]}
            tableClassName="print-receitas-table"
            rows={receitasDre.map((r) => {
              const cls = "text-success";
              return [
                r.competence,
                (r as any).kind ?? "",
                r.type,
                r.channel,
                (r as any).productOrService ?? "",
                (r as any).frequency ?? "Mensal",
                <span className={`tabular-nums font-medium ${cls}`}>{`+ ${fmt(r.amount)}`}</span>,
                r.notes ? (
                  <div
                    className="max-w-[520px] whitespace-pre-line break-words overflow-hidden [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical]"
                    title={r.notes}
                  >
                    {r.notes}
                  </div>
                ) : (
                  ""
                ),
              ];
            })}
            emptyText="Nenhuma receita lançada neste mês."
          />
        </DetailSection>

        <DetailSection
          title="Resultado Financeiro — Receitas (fora da DRE)"
          subtitle={`${receitasForaDre.length} lançamento(s) · Total ${fmt(receitasForaDre.reduce((sum, r) => sum + r.amount, 0))}`}
          open={expanded.receitasForaDre}
          onToggle={() => setExpanded((x) => ({ ...x, receitasForaDre: !x.receitasForaDre }))}
        >
          <SimpleTable
            columns={[
              "Competência",
              "Tipo de Receita",
              "Categoria da Receita",
              "Centro de Receita",
              "Produto / Serviço",
              "Frequência",
              "Valor",
              "Observações",
            ]}
            tableClassName="print-receitas-table"
            rows={receitasForaDre.map((r) => {
              const cls = "text-success";
              return [
                r.competence,
                (r as any).kind ?? "",
                r.type,
                r.channel,
                (r as any).productOrService ?? "",
                (r as any).frequency ?? "Mensal",
                <span className={`tabular-nums font-medium ${cls}`}>{`+ ${fmt(r.amount)}`}</span>,
                r.notes ? (
                  <div
                    className="max-w-[520px] whitespace-pre-line break-words overflow-hidden [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical]"
                    title={r.notes}
                  >
                    {r.notes}
                  </div>
                ) : (
                  ""
                ),
              ];
            })}
            emptyText="Nenhuma receita fora da DRE lançada neste mês."
          />
        </DetailSection>

        <DetailSection
          title="Deduções — Lançamentos"
          subtitle={`${deducoes.length} lançamento(s) · Total ${fmt(deducoes.reduce((sum, d) => sum + d.amount, 0))}`}
          open={expanded.deducoes}
          onToggle={() => setExpanded((x) => ({ ...x, deducoes: !x.deducoes }))}
        >
          <SimpleTable
            columns={["Competência", "Tipo", "Conta/Subgrupo", "Valor", "Observações"]}
            rows={deducoes.map((d) => {
              const cls = "text-destructive";
              return [
                d.competence,
                d.type,
                d.account,
                <span className={`tabular-nums font-medium ${cls}`}>{`- ${fmt(d.amount)}`}</span>,
                d.notes ?? "",
              ];
            })}
            emptyText="Nenhuma dedução lançada neste mês."
          />
        </DetailSection>

        <DetailSection
          title="CMV — Lançamentos"
          subtitle={`${cmv.length} lançamento(s) · Total ${fmt(cmv.reduce((sum, c) => sum + c.amount, 0))}`}
          open={expanded.cmv}
          onToggle={() => setExpanded((x) => ({ ...x, cmv: !x.cmv }))}
        >
          <SimpleTable
            columns={["Competência", "Tipo", "Valor", "Fonte", "Responsável", "Observações"]}
            rows={cmv.map((c) => {
              const cls = "text-destructive";
              return [
                c.competence,
                c.type,
                <span className={`tabular-nums font-medium ${cls}`}>{`- ${fmt(c.amount)}`}</span>,
                c.source ?? "",
                c.responsible ?? "",
                c.notes ?? "",
              ];
            })}
            emptyText="Nenhum CMV lançado neste mês."
          />
        </DetailSection>

        <DetailSection
          title="Gastos Operacionais — Lançamentos"
          subtitle={`${gastos.length} lançamento(s) · Total ${fmt(gastos.reduce((sum, e) => sum + e.amount, 0))}`}
          open={expanded.gastos}
          onToggle={() => setExpanded((x) => ({ ...x, gastos: !x.gastos }))}
        >
          <SimpleTable
            columns={["Competência", "Grupo", "Subgrupo", "Conta", "Tipo", "Data", "Frequência", "Valor"]}
            tableClassName="print-gastos-table"
            rows={gastos.map((e) => {
              const acc = accountsByName.get(e.account.trim().toLowerCase());
              const tipo = acc?.type ?? "—";
              const entrada = isEntrada(e);
              const sign = entrada ? "+" : "-";
              const cls = entrada ? "text-success" : "text-destructive";
              return [
                e.competence,
                e.group,
                e.subgroup,
                e.account,
                tipo,
                e.date,
                `${e.frequency}${e.recurrent ? " · Recorrente" : ""}`,
                <span className={`tabular-nums font-medium ${cls}`}>{`${sign} ${fmt(e.amount)}`}</span>,
              ];
            })}
            emptyText="Nenhum gasto lançado neste mês."
          />
        </DetailSection>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
        <Stat label="Ponto de Equilíbrio (estimado)" value={fmt(dre.gastosTotal + dre.cmvTotal)} hint="Custos + Gastos do período" />
        <Stat label="Margem Bruta" value={`${dre.receitaLiquida ? ((dre.lucroBruto / dre.receitaLiquida) * 100).toFixed(1) : "0"}%`} />
        <Stat label="Margem Líquida" value={`${dre.receitaLiquida ? ((dre.lucroLiquido / dre.receitaLiquida) * 100).toFixed(1) : "0"}%`} />
      </div>
    </AppLayout>
  );
}

function DetailSection({
  title,
  subtitle,
  open,
  onToggle,
  children,
}: {
  title: string;
  subtitle?: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-card border shadow-[var(--shadow-card)] overflow-hidden print-avoid-break">
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b bg-muted/20">
        <div className="min-w-0">
          <div className="font-semibold font-display truncate">{title}</div>
          {subtitle ? <div className="text-xs text-muted-foreground">{subtitle}</div> : null}
        </div>
        <button
          type="button"
          onClick={onToggle}
          className="h-9 w-9 inline-flex items-center justify-center rounded-md border hover:bg-muted print:hidden"
          aria-label={open ? "Recolher" : "Expandir"}
          title={open ? "Recolher" : "Expandir"}
        >
          {open ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
        </button>
      </div>
      {open ? <div className="p-5">{children}</div> : null}
    </div>
  );
}

function SimpleTable({
  columns,
  rows,
  emptyText,
  tableClassName,
}: {
  columns: string[];
  rows: Array<Array<React.ReactNode>>;
  emptyText: string;
  tableClassName?: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className={`w-full text-sm ${tableClassName ?? ""}`}>
        <thead className="text-xs text-muted-foreground">
          <tr className="border-b">
            {columns.map((c) => (
              <th key={c} className="text-left py-2 pr-3 font-medium">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className="py-8 text-muted-foreground" colSpan={columns.length}>
                {emptyText}
              </td>
            </tr>
          ) : (
            rows.map((r, idx) => (
              <tr key={idx} className="border-b last:border-0">
                {r.map((cell, i) => (
                  <td key={i} className="py-2 pr-3 whitespace-nowrap print:whitespace-normal align-top">
                    {cell}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl bg-card border p-5 shadow-[var(--shadow-card)] print-avoid-break">
      <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium">{label}</div>
      <div className="mt-2 text-xl font-semibold font-display tabular-nums">{value}</div>
      {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
    </div>
  );
}
