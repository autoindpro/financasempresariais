import { createFileRoute } from "@tanstack/react-router";
import { useStore } from "@/lib/store";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { Button, Field, Input } from "@/components/Form";
import { Download, Trash2, Database } from "lucide-react";
import { schemaSql } from "@/lib/schema-sql";
import { useEffect, useMemo, useState } from "react";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { createCompanyAndLink, listMyCompanies, pullAllCompanyData, pushAllCompanyData } from "@/lib/supabase-sync";

export const Route = createFileRoute("/configuracoes")({
  component: SettingsPage,
  head: () => ({ meta: [{ title: "Configurações · Flux Soluções" }] }),
});

function SettingsPage() {
  const { reset, company } = useStore();
  const supabase = useMemo(() => getSupabase(), []);
  const supabaseReady = isSupabaseConfigured();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string>("");
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string>("");
  const [companies, setCompanies] = useState<Array<{ companyId: string; role: string; label: string }>>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    let unsubscribe: (() => void) | undefined;

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (error) throw error;
        setUserEmail(data.session?.user?.email ?? null);
      })
      .catch((e) => setStatus(String(e?.message ?? e)));

    const sub = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user?.email ?? null);
    });
    unsubscribe = () => sub.data.subscription.unsubscribe();

    return () => unsubscribe?.();
  }, [supabase]);

  async function refreshCompanies() {
    if (!supabase) return;
    const list = await listMyCompanies(supabase);
    const items = list.map((x) => ({
      companyId: x.companyId,
      role: x.role,
      label: x.company?.name ? `${x.company.name} (${x.role})` : `${x.companyId} (${x.role})`,
    }));
    setCompanies(items);
    if (!companyId && items[0]) setCompanyId(items[0].companyId);
  }

  useEffect(() => {
    if (!supabase) return;
    if (!userEmail) {
      setCompanies([]);
      return;
    }
    refreshCompanies().catch((e) => setStatus(String(e?.message ?? e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, userEmail]);

  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const ensureUuid = (id: string) => (uuidRe.test(id) ? id : globalThis.crypto?.randomUUID?.() ?? id);

  function normalizeIdsForSupabase() {
    const s = useStore.getState();
    useStore.setState({
      employees: s.employees.map((e) => ({ ...e, id: ensureUuid(e.id) })),
      accounts: s.accounts.map((a) => ({ ...a, id: ensureUuid(a.id) })),
      revenues: s.revenues.map((r) => ({ ...r, id: ensureUuid(r.id) })),
      deductions: s.deductions.map((d) => ({ ...d, id: ensureUuid(d.id) })),
      cmv: s.cmv.map((c) => ({ ...c, id: ensureUuid(c.id) })),
      expenses: s.expenses.map((e) => ({ ...e, id: ensureUuid(e.id) })),
    });
  }

  const downloadSql = () => {
    const blob = new Blob([schemaSql], { type: "text/sql" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "supabase-schema.sql";
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportData = () => {
    const data = JSON.stringify(useStore.getState(), null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "finance-os-backup.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppLayout>
      <PageHeader title="Configurações" description="Backup, integrações futuras e gestão dos dados locais." />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl">
        <Card title="Schema SQL para Supabase" description="Baixe o arquivo SQL completo com todas as tabelas necessárias para implantar o backend no Supabase." icon={<Database className="h-5 w-5" />}>
          <Button onClick={downloadSql}>
            <Download className="h-4 w-4 inline mr-1" /> Baixar schema.sql
          </Button>
        </Card>

        <Card
          title="Supabase (Banco de Dados)"
          description="Login, seleção de empresa e sincronização manual (pull/push)."
          icon={<Database className="h-5 w-5" />}
        >
          {!supabaseReady ? (
            <div className="text-sm text-muted-foreground">
              Configure `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` em `.env.local` e reinicie o `npm run dev`.
            </div>
          ) : !supabase ? (
            <div className="text-sm text-muted-foreground">Supabase só é inicializado no browser (não no SSR).</div>
          ) : (
            <div className="space-y-3">
              {status ? <div className="text-xs rounded-md border px-3 py-2 bg-muted/30">{status}</div> : null}

              {!userEmail ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Field label="E-mail">
                      <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@empresa.com" />
                    </Field>
                    <Field label="Senha">
                      <Input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="••••••••" />
                    </Field>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={async () => {
                        setBusy(true);
                        setStatus("");
                        try {
                          const { error } = await supabase.auth.signInWithPassword({ email, password });
                          if (error) throw error;
                          await refreshCompanies();
                        } catch (e: any) {
                          setStatus(String(e?.message ?? e));
                        } finally {
                          setBusy(false);
                        }
                      }}
                      disabled={busy || !email || !password}
                    >
                      Entrar
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={async () => {
                        setBusy(true);
                        setStatus("");
                        try {
                          const { error } = await supabase.auth.signUp({ email, password });
                          if (error) throw error;
                          setStatus("Conta criada. Confirme o e-mail se o projeto exigir confirmação.");
                        } catch (e: any) {
                          setStatus(String(e?.message ?? e));
                        } finally {
                          setBusy(false);
                        }
                      }}
                      disabled={busy || !email || !password}
                    >
                      Criar conta
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="text-sm">
                    Logado como <span className="font-medium">{userEmail}</span>
                  </div>

                  <Field label="Empresa (company_id)">
                    <select
                      value={companyId}
                      onChange={(e) => setCompanyId(e.target.value)}
                      className="w-full h-10 px-3 rounded-lg border bg-background text-sm"
                    >
                      <option value="">Selecione...</option>
                      {companies.map((c) => (
                        <option key={c.companyId} value={c.companyId}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      onClick={async () => {
                        setBusy(true);
                        setStatus("");
                        try {
                          if (!company.name?.trim()) {
                            throw new Error("Preencha o nome da empresa na tela Empresa antes de criar no Supabase.");
                          }
                          const { companyId } = await createCompanyAndLink(supabase, company);
                          setCompanyId(companyId);
                          await refreshCompanies();
                          setStatus("Empresa criada e vinculada.");
                        } catch (e: any) {
                          setStatus(String(e?.message ?? e));
                        } finally {
                          setBusy(false);
                        }
                      }}
                      disabled={busy}
                    >
                      Criar empresa no Supabase
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={async () => {
                        setBusy(true);
                        setStatus("");
                        try {
                          const { error } = await supabase.auth.signOut();
                          if (error) throw error;
                          setCompanyId("");
                          setCompanies([]);
                        } catch (e: any) {
                          setStatus(String(e?.message ?? e));
                        } finally {
                          setBusy(false);
                        }
                      }}
                      disabled={busy}
                    >
                      Sair
                    </Button>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-2 border-t">
                    <Button
                      onClick={async () => {
                        setBusy(true);
                        setStatus("");
                        try {
                          if (!companyId) throw new Error("Selecione uma empresa.");
                          normalizeIdsForSupabase();
                          const s = useStore.getState();
                          await pushAllCompanyData(supabase, companyId, {
                            company: s.company,
                            employees: s.employees,
                            accounts: s.accounts,
                            revenues: s.revenues,
                            deductions: s.deductions,
                            cmv: s.cmv,
                            expenses: s.expenses,
                          });
                          setStatus("Push concluído (dados locais enviados para o Supabase).");
                        } catch (e: any) {
                          setStatus(String(e?.message ?? e));
                        } finally {
                          setBusy(false);
                        }
                      }}
                      disabled={busy || !companyId}
                    >
                      Enviar (push)
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={async () => {
                        setBusy(true);
                        setStatus("");
                        try {
                          if (!companyId) throw new Error("Selecione uma empresa.");
                          const data = await pullAllCompanyData(supabase, companyId);
                          useStore.setState((s) => ({
                            company: data.company ?? s.company,
                            employees: data.employees,
                            accounts: data.accounts.length ? data.accounts : s.accounts,
                            revenues: data.revenues,
                            deductions: data.deductions,
                            cmv: data.cmv,
                            expenses: data.expenses,
                            onboardingCompleted: true,
                          }));
                          setStatus("Pull concluído (dados do Supabase carregados no app).");
                        } catch (e: any) {
                          setStatus(String(e?.message ?? e));
                        } finally {
                          setBusy(false);
                        }
                      }}
                      disabled={busy || !companyId}
                    >
                      Baixar (pull)
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </Card>

        <Card title="Exportar Dados (JSON)" description="Backup completo dos dados em formato JSON.">
          <Button variant="secondary" onClick={exportData}>
            <Download className="h-4 w-4 inline mr-1" /> Exportar JSON
          </Button>
        </Card>

        <Card title="Reset do Sistema" description="Apaga todos os lançamentos, funcionários e empresa. Restaura plano de contas padrão.">
          <Button
            variant="danger"
            onClick={() => {
              if (confirm("Tem certeza? Esta ação apaga todos os dados locais.")) reset();
            }}
          >
            <Trash2 className="h-4 w-4 inline mr-1" /> Resetar tudo
          </Button>
        </Card>
      </div>
    </AppLayout>
  );
}

function Card({ title, description, children, icon }: { title: string; description: string; children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-card border p-5 shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-2 mb-2">
        {icon && <span className="text-primary">{icon}</span>}
        <h3 className="font-semibold font-display">{title}</h3>
      </div>
      <p className="text-sm text-muted-foreground mb-4">{description}</p>
      {children}
    </div>
  );
}
