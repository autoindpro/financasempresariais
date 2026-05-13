import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { useIsPlatformAdmin } from "@/lib/admin";
import { Button } from "@/components/Form";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
  head: () => ({ meta: [{ title: "Administrador · Flux Soluções" }] }),
});

type CompanyRow = { id: string; name: string; cnpj: string | null; created_at: string | null };

function AdminPage() {
  const navigate = useNavigate();
  const supabase = useMemo(() => getSupabase(), []);
  const configured = isSupabaseConfigured();
  const { isAdmin, loading } = useIsPlatformAdmin();
  const [rows, setRows] = useState<CompanyRow[]>([]);
  const [error, setError] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(() => {
    try {
      return localStorage.getItem("flux_company_id") ?? "";
    } catch {
      return "";
    }
  });

  useEffect(() => {
    if (!loading && !isAdmin) {
      navigate({ to: "/" });
    }
  }, [isAdmin, loading, navigate]);

  async function load() {
    if (!configured || !supabase) return;
    setBusy(true);
    setError("");
    try {
      const { data, error } = await supabase
        .from("companies")
        .select("id,name,cnpj,created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      setRows((data ?? []) as CompanyRow[]);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (configured && supabase && isAdmin) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configured, supabase, isAdmin]);

  return (
    <AppLayout>
      <PageHeader
        title="Administrador"
        description="Visão global do ambiente (disponível apenas para administradores da plataforma)."
        actions={
          <Button variant="secondary" onClick={load} disabled={busy || !isAdmin}>
            Atualizar
          </Button>
        }
      />

      {!configured ? (
        <div className="text-sm text-muted-foreground">
          Supabase não configurado (`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`).
        </div>
      ) : !isAdmin ? (
        <div className="text-sm text-muted-foreground">Verificando permissões…</div>
      ) : (
        <div className="rounded-2xl bg-card border shadow-[var(--shadow-card)] p-5">
          {error ? <div className="text-xs rounded-md border px-3 py-2 bg-muted/30 mb-4">{error}</div> : null}

          <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
            <div className="text-sm">
              Empresa selecionada:{" "}
              <span className="font-mono text-xs text-muted-foreground">
                {selectedCompanyId || "(nenhuma)"}
              </span>
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                disabled={!selectedCompanyId}
                onClick={() => {
                  try {
                    localStorage.removeItem("flux_company_id");
                  } catch {
                    // ignore
                  }
                  setSelectedCompanyId("");
                  location.reload();
                }}
              >
                Limpar seleção
              </Button>
            </div>
          </div>

          <div className="text-sm font-medium mb-3">
            Empresas cadastradas <span className="text-muted-foreground">({rows.length})</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b">
                  <th className="text-left py-2 pr-3">Nome</th>
                  <th className="text-left py-2 pr-3">CNPJ</th>
                  <th className="text-left py-2 pr-3">ID</th>
                  <th className="text-right py-2 pl-3">Ação</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id} className="border-b last:border-0">
                    <td className="py-2 pr-3 font-medium">{c.name}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{c.cnpj ?? "-"}</td>
                    <td className="py-2 pr-3 font-mono text-xs text-muted-foreground">{c.id}</td>
                    <td className="py-2 pl-3 text-right">
                      <Button
                        variant={selectedCompanyId === c.id ? "secondary" : "primary"}
                        onClick={() => {
                          try {
                            localStorage.setItem("flux_company_id", c.id);
                          } catch {
                            // ignore
                          }
                          setSelectedCompanyId(c.id);
                          location.assign("/");
                        }}
                      >
                        {selectedCompanyId === c.id ? "Selecionada" : "Selecionar"}
                      </Button>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 ? (
                  <tr>
                    <td className="py-6 text-muted-foreground" colSpan={4}>
                      Nenhuma empresa encontrada.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
