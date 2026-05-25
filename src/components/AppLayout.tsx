import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  FileBarChart,
  TrendingUp,
  Receipt,
  Package,
  Wallet,
  Landmark,
  Users,
  BookOpen,
  Building2,
  Shield,
  Menu,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store";
import { useAuthStatus } from "@/lib/auth";
import { useNavigate } from "@tanstack/react-router";
import { useIsPlatformAdmin } from "@/lib/admin";

const baseNav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/dre", label: "DRE", icon: FileBarChart },
  { to: "/receitas", label: "Receita Bruta", icon: TrendingUp },
  { to: "/deducoes", label: "Deduções", icon: Receipt },
  { to: "/cmv", label: "CMV", icon: Package },
  { to: "/gastos", label: "Gastos Operacionais", icon: Wallet },
  { to: "/fluxo-caixa", label: "Fluxo de Caixa", icon: Landmark },
  { to: "/funcionarios", label: "Funcionários", icon: Users },
  { to: "/plano-contas", label: "Plano de Contas", icon: BookOpen },
  { to: "/empresa", label: "Perfil da Empresa", icon: Building2 },
] as const;

export function AppLayout({ children }: { children: React.ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { status, loading, signOut } = useAuthStatus();
  const { isAdmin } = useIsPlatformAdmin();
  const nav = isAdmin
    ? [...baseNav, { to: "/admin", label: "Administrador", icon: Shield }]
    : [...baseNav];

  useEffect(() => {
    if (path === "/login") return;
    if (!loading && status.mode === "supabase" && status.state === "logged_out") {
      navigate({ to: "/login" });
    }
  }, [loading, navigate, path, status]);

  const blockProtectedContent =
    path !== "/login" &&
    status.mode === "supabase" &&
    (status.state === "loading" || loading || status.state === "logged_out");

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar desktop */}
      <aside className="hidden lg:flex flex-col w-64 bg-sidebar text-sidebar-foreground border-r border-sidebar-border print:hidden">
        <SidebarContent path={path} isAdmin={isAdmin} />
      </aside>

      {/* Sidebar mobile drawer */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-50 flex print:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="relative w-64 bg-sidebar text-sidebar-foreground flex flex-col">
            <SidebarContent path={path} isAdmin={isAdmin} onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b bg-card/80 backdrop-blur-md sticky top-0 z-30 flex items-center px-4 lg:px-8 gap-4 print:hidden">
          <button
            className="lg:hidden p-2 -ml-2 rounded-md hover:bg-muted"
            onClick={() => setOpen(true)}
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-sm font-medium text-muted-foreground">
              {nav.find((n) => n.to === path)?.label ?? "Finanças Empresariais"}
            </h1>
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            {loading && status.mode === "supabase" ? (
              <>
                <span className="hidden sm:inline">Conectando…</span>
                <span className="h-2 w-2 rounded-full bg-muted-foreground/50" />
              </>
            ) : null}
            {status.mode === "local" ? (
              <>
                <span className="hidden sm:inline">Local</span>
                <span className="h-2 w-2 rounded-full bg-muted-foreground/50" />
              </>
            ) : status.state === "loading" ? (
              <>
                <span className="hidden sm:inline">Conectando…</span>
                <span className="h-2 w-2 rounded-full bg-muted-foreground/50" />
              </>
            ) : status.state === "logged_in" ? (
              <>
                <span className="hidden sm:inline">Online</span>
                <span className="h-2 w-2 rounded-full bg-success" />
                <button
                  className="h-9 px-3 rounded-md border hover:bg-muted text-xs"
                  onClick={async () => {
                    await signOut();
                    navigate({ to: "/login" });
                  }}
                  type="button"
                >
                  Sair
                </button>
              </>
            ) : (
              <>
                <span className="hidden sm:inline">Offline</span>
                <span className="h-2 w-2 rounded-full bg-warning" />
                <button
                  className="h-9 px-3 rounded-md border hover:bg-muted text-xs"
                  onClick={() => navigate({ to: "/login" })}
                  type="button"
                >
                  Entrar
                </button>
              </>
            )}
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-8 overflow-x-hidden">
          {blockProtectedContent ? (
            <div className="min-h-[60vh] flex items-center justify-center text-sm text-muted-foreground">
              Carregando…
            </div>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}

function SidebarContent({
  path,
  isAdmin,
  onNavigate,
}: {
  path: string;
  isAdmin: boolean;
  onNavigate?: () => void;
}) {
  const company = useStore((s) => s.company);
  const nav = isAdmin
    ? [...baseNav, { to: "/admin", label: "Administrador", icon: Shield }]
    : [...baseNav];
  return (
    <>
      <div className="h-16 px-6 flex items-center justify-between border-b border-sidebar-border">
        <div className="flex items-center gap-2 min-w-0">
          {company.logo ? (
            <div className="h-10 w-10 bg-white flex items-center justify-center overflow-hidden shrink-0">
              <img
                src={company.logo}
                alt={company.name || "Logo"}
                className="h-full w-full object-contain p-1"
              />
            </div>
          ) : (
            <div className="h-8 w-8 rounded-lg bg-sidebar-primary flex items-center justify-center overflow-hidden shrink-0">
              <FileBarChart className="h-4 w-4 text-sidebar-primary-foreground" />
            </div>
          )}
          <div className="min-w-0">
            <div className="text-sm font-bold leading-tight font-display truncate text-white">
              {company.name || "Finanças Empresariais"}
            </div>
            <div className="text-[10px] text-white font-medium uppercase tracking-wider">
              Finanças Empresariais
            </div>
          </div>
        </div>
        {onNavigate && (
          <button onClick={onNavigate} className="lg:hidden p-1 hover:bg-sidebar-accent rounded">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {nav.map((item) => {
          const Icon = item.icon;
          const active = path === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-bold transition-colors text-white",
                active
                  ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium shadow-sm"
                  : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-sidebar-border text-xs text-sidebar-foreground/60 text-center">
        <div className="font-bold text-white">Flux Soluções</div>
      </div>
    </>
  );
}
