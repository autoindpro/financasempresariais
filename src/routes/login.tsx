import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Button, Field, Input } from "@/components/Form";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { useAuthStatus } from "@/lib/auth";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({ meta: [{ title: "Login · Flux Soluções" }] }),
});

function LoginPage() {
  const navigate = useNavigate();
  const supabase = useMemo(() => getSupabase(), []);
  const configured = isSupabaseConfigured();
  const { status, loading } = useAuthStatus();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>("");

  useEffect(() => {
    if (!loading && status.mode === "supabase" && status.state === "logged_in") {
      navigate({ to: "/" });
    }
  }, [loading, navigate, status]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-6">
          <img src="/logo-app.png" alt="Logo" className="h-16 w-auto object-contain" loading="eager" />
        </div>
        <div className="rounded-2xl bg-card border p-6 shadow-[var(--shadow-card)]">
          <div className="mb-5 text-center">
            <h1 className="text-xl font-semibold font-display">Finanças Empresariais</h1>
            <p className="text-sm text-muted-foreground">Acesse sua conta para visualizar a sua DRE</p>
          </div>

        {!configured ? (
          <div className="text-sm text-muted-foreground">
            Supabase não configurado. Defina `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` no
            `.env.local`.
          </div>
        ) : !supabase ? (
          <div className="text-sm text-muted-foreground">
            Supabase só é inicializado no browser (não no SSR).
          </div>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
            }}
          >
            {msg ? (
              <div className="text-xs rounded-md border px-3 py-2 bg-muted/30">{msg}</div>
            ) : null}

            <Field label="E-mail">
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@empresa.com"
              />
            </Field>
            <Field label="Senha">
              <Input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                placeholder="••••••••"
              />
            </Field>

            <div className="flex justify-center">
              <Button
                disabled={busy || !email || !password}
                onClick={async () => {
                  setBusy(true);
                  setMsg("");
                  try {
                    const { error } = await supabase.auth.signInWithPassword({ email, password });
                    if (error) throw error;
                    // Evita loop de redirects enquanto o estado de sessão ainda está sincronizando
                    await supabase.auth.getSession();
                    navigate({ to: "/" });
                  } catch (err: any) {
                    setMsg(String(err?.message ?? err));
                  } finally {
                    setBusy(false);
                  }
                }}
                type="button"
              >
                Entrar
              </Button>
            </div>
          </form>
        )}
        </div>
      </div>
    </div>
  );
}
