import { cn } from "@/lib/utils";
import { fmt } from "@/lib/finance";
import type { LucideIcon } from "lucide-react";

export function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
  format = "currency",
}: {
  label: string;
  value: number;
  hint?: string;
  icon?: LucideIcon;
  tone?: "default" | "positive" | "negative" | "warning";
  format?: "currency" | "percent" | "number";
}) {
  const display =
    format === "currency" ? fmt(value) : format === "percent" ? `${value.toFixed(1).replace(".", ",")}%` : value.toLocaleString("pt-BR");
  const toneClass =
    tone === "positive"
      ? "text-success"
      : tone === "negative"
      ? "text-destructive"
      : tone === "warning"
      ? "text-warning"
      : "text-foreground";
  return (
    <div className="rounded-2xl bg-card border px-3 py-4 sm:p-5 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elegant)] transition-shadow min-w-0 overflow-hidden">
      <div className="flex items-start justify-between gap-2">
        <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium">{label}</div>
        {Icon && (
          <div className="h-8 w-8 rounded-lg bg-accent flex items-center justify-center">
            <Icon className="h-4 w-4 text-accent-foreground" />
          </div>
        )}
      </div>
      <div className={cn("mt-3 text-[15px] min-[380px]:text-base sm:text-2xl font-semibold font-display tabular-nums whitespace-nowrap leading-tight", toneClass)}>{display}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}
