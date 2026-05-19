import { createFileRoute } from "@tanstack/react-router";
import { useStore } from "@/lib/store";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { KpiCard } from "@/components/KpiCard";
import { buildDre, fmt, currentCompetence } from "@/lib/finance";
import { TrendingUp, DollarSign, Percent, Activity, AlertCircle, CheckCircle2, Sparkles } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, PieChart, Pie, Cell, Legend } from "recharts";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/")({
  component: Dashboard,
  head: () => ({ meta: [{ title: "Dashboard · Flux Soluções" }] }),
});

function Dashboard() {
  const s = useStore();
  const [competence, setCompetence] = useState<string>(currentCompetence());
  const dre = useMemo(() => buildDre({ ...s, competence }), [s, competence]);
  const year = competence.slice(0, 4);
  const months = useMemo(() => Array.from({ length: 12 }, (_v, i) => `${year}-${String(i + 1).padStart(2, "0")}`), [year]);

  const series = useMemo(
    () =>
      months.map((m) => {
        const d = buildDre({ ...s, competence: m });
        return {
          mes: m.slice(5) + "/" + m.slice(2, 4),
          receita: d.receitaBruta,
          liquida: d.receitaLiquida,
          lucro: d.lucroLiquido,
        };
      }),
    [s, months]
  );

  const compGastos = [
    { name: "CMV", value: dre.cmvTotal },
    { name: "Folha", value: dre.folhaTotal },
    { name: "Gastos Operacionais", value: Math.max(0, dre.gastosTotal - dre.folhaTotal) },
    { name: "Deduções", value: dre.deducoesTotal },
  ].filter((x) => x.value > 0);

  const colors = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

  const margemLiquida = dre.receitaLiquida ? (dre.lucroLiquido / dre.receitaLiquida) * 100 : 0;
  const margemBruta = dre.receitaLiquida ? (dre.lucroBruto / dre.receitaLiquida) * 100 : 0;
  const cmvPct = dre.receitaLiquida ? (dre.cmvTotal / dre.receitaLiquida) * 100 : 0;
  const folhaPct = dre.receitaLiquida ? (dre.folhaTotal / dre.receitaLiquida) * 100 : 0;

  const insights: { type: "ok" | "warn" | "alert"; text: string }[] = [];
  if (cmvPct > 50) insights.push({ type: "alert", text: `CMV em ${cmvPct.toFixed(1)}% — acima da média saudável (35-45%).` });
  if (folhaPct > 30) insights.push({ type: "warn", text: `Folha consumindo ${folhaPct.toFixed(1)}% da receita líquida.` });
  if (margemLiquida >= 15) insights.push({ type: "ok", text: `Margem líquida saudável de ${margemLiquida.toFixed(1)}%.` });
  if (margemLiquida < 0) insights.push({ type: "alert", text: `Empresa operando no prejuízo no período.` });
  if (insights.length === 0) insights.push({ type: "ok", text: "Sem alertas críticos. Continue acompanhando os indicadores." });

  const score =
    margemLiquida >= 15 ? "Excelente" : margemLiquida >= 8 ? "Boa" : margemLiquida >= 0 ? "Atenção" : "Crítica";
  const scoreColor =
    score === "Excelente" ? "text-success" : score === "Boa" ? "text-primary" : score === "Atenção" ? "text-warning" : "text-destructive";

  return (
    <AppLayout>
      <PageHeader
        title="Dashboard Executivo"
        description="Visão consolidada de receitas, custos, gastos e indicadores de desempenho da empresa."
        actions={
          <input
            type="month"
            value={competence}
            onChange={(e) => setCompetence(e.target.value)}
            className="h-10 px-3 rounded-lg border bg-card text-sm"
          />
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KpiCard label="Receita Bruta" value={dre.receitaBruta} icon={DollarSign} />
        <KpiCard label="Receita Líquida" value={dre.receitaLiquida} icon={TrendingUp} />
        <KpiCard label="EBITDA" value={dre.ebitda} icon={Activity} tone={dre.ebitda >= 0 ? "positive" : "negative"} />
        <KpiCard
          label="Lucro Líquido"
          value={dre.lucroLiquido}
          icon={Percent}
          tone={dre.lucroLiquido >= 0 ? "positive" : "negative"}
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KpiCard label="Margem Líquida" value={margemLiquida} format="percent" tone={margemLiquida >= 0 ? "positive" : "negative"} />
        <KpiCard label="Margem Bruta" value={margemBruta} format="percent" />
        <KpiCard label="CMV %" value={cmvPct} format="percent" tone={cmvPct > 50 ? "negative" : "default"} />
        <KpiCard label="Folha %" value={folhaPct} format="percent" tone={folhaPct > 30 ? "warning" : "default"} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="lg:col-span-2 rounded-2xl bg-card border p-5 shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold font-display">Evolução Financeira</h3>
              <p className="text-xs text-muted-foreground">Ano {year}</p>
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer>
              <AreaChart data={series}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="mes" stroke="var(--muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} tickFormatter={(v: any) => `${(Number(v) / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: any) => fmt(Number(v))} contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12 }} />
                <Area type="monotone" dataKey="receita" stroke="var(--chart-1)" fill="url(#g1)" name="Receita Bruta" strokeWidth={2} />
                <Area type="monotone" dataKey="lucro" stroke="var(--chart-2)" fill="url(#g2)" name="Lucro Líquido" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl bg-card border p-5 shadow-[var(--shadow-card)]">
          <h3 className="font-semibold font-display mb-1">Composição de Custos</h3>
          <p className="text-xs text-muted-foreground mb-4">Período atual</p>
          <div className="h-72">
            {compGastos.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Sem dados</div>
            ) : (
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={compGastos} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2}>
                    {compGastos.map((_, i) => (
                      <Cell key={i} fill={colors[i % colors.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: any) => fmt(Number(v))} contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-2xl bg-card border p-5 shadow-[var(--shadow-card)]">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="font-semibold font-display">Insights Inteligentes</h3>
          </div>
          <ul className="space-y-3">
            {insights.map((i, idx) => (
              <li key={idx} className="flex items-start gap-3 text-sm">
                {i.type === "ok" ? (
                  <CheckCircle2 className="h-5 w-5 text-success shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className={`h-5 w-5 shrink-0 mt-0.5 ${i.type === "alert" ? "text-destructive" : "text-warning"}`} />
                )}
                <span>{i.text}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border p-5 shadow-[var(--shadow-card)]" style={{ background: "var(--gradient-primary)" }}>
          <div className="text-primary-foreground/80 text-xs uppercase tracking-wider font-medium">Saúde Financeira</div>
          <div className={`mt-3 text-4xl font-display font-bold text-primary-foreground`}>{score}</div>
          <div className="mt-1 text-sm text-primary-foreground/80">
            Margem líquida: {margemLiquida.toFixed(1).replace(".", ",")}%
          </div>
          <div className="mt-6 space-y-2">
            <Bar2 label="Receita Bruta" value={dre.receitaBruta} max={Math.max(dre.receitaBruta, 1)} />
            <Bar2 label="Lucro Líquido" value={Math.max(0, dre.lucroLiquido)} max={Math.max(dre.receitaBruta, 1)} />
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-card border p-5 shadow-[var(--shadow-card)] mt-6">
        <h3 className="font-semibold font-display mb-4">Waterfall · Receita → Lucro</h3>
        <div className="h-64">
          <ResponsiveContainer>
            <BarChart
              data={[
                { name: "Receita", v: dre.receitaBruta },
                { name: "Deduções", v: -dre.deducoesTotal },
                { name: "CMV", v: -dre.cmvTotal },
                { name: "Gastos", v: -dre.gastosTotal },
                { name: "Lucro", v: dre.lucroLiquido },
              ]}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={12} />
              <YAxis stroke="var(--muted-foreground)" fontSize={12} tickFormatter={(v: any) => `${(Number(v) / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: any) => fmt(Number(v))} contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12 }} />
              <Bar dataKey="v" radius={[8, 8, 0, 0]}>
                {[
                  "var(--chart-1)",
                  "var(--destructive)",
                  "var(--destructive)",
                  "var(--destructive)",
                  "var(--success)",
                ].map((c, i) => (
                  <Cell key={i} fill={c} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </AppLayout>
  );
}

function Bar2({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div>
      <div className="flex justify-between text-xs text-primary-foreground/90 mb-1">
        <span>{label}</span>
        <span className="tabular-nums">{fmt(value)}</span>
      </div>
      <div className="h-2 rounded-full bg-primary-foreground/20 overflow-hidden">
        <div className="h-full bg-primary-foreground rounded-full" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
