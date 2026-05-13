import { useState } from "react";
import { Plus, X } from "lucide-react";

export function ComboInput({
  value,
  onChange,
  options,
  onAddOption,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  onAddOption?: (v: string) => void;
  placeholder?: string;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  return (
    <div className="flex gap-2">
      {adding ? (
        <>
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Nova opção"
            className="flex-1 h-10 px-3 rounded-lg border bg-background text-sm"
          />
          <button
            type="button"
            onClick={() => {
              if (draft.trim()) {
                onAddOption?.(draft.trim());
                onChange(draft.trim());
              }
              setAdding(false);
              setDraft("");
            }}
            className="h-10 px-3 rounded-lg bg-primary text-primary-foreground text-sm"
          >
            Salvar
          </button>
          <button type="button" onClick={() => setAdding(false)} className="h-10 px-2 rounded-lg border">
            <X className="h-4 w-4" />
          </button>
        </>
      ) : (
        <>
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="flex-1 h-10 px-3 rounded-lg border bg-background text-sm"
          >
            <option value="">{placeholder || "Selecione..."}</option>
            {options.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
          {onAddOption && (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="h-10 px-3 rounded-lg border hover:bg-muted text-sm flex items-center gap-1"
              title="Adicionar nova opção"
            >
              <Plus className="h-4 w-4" />
            </button>
          )}
        </>
      )}
    </div>
  );
}

export function Field({ label, children, span = 1 }: { label: string; children: React.ReactNode; span?: 1 | 2 | 3 }) {
  const cls = span === 3 ? "md:col-span-3" : span === 2 ? "md:col-span-2" : "";
  return (
    <div className={cls}>
      <label className="block text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wider">{label}</label>
      {children}
    </div>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`w-full h-10 px-3 rounded-lg border bg-background text-sm ${props.className || ""}`} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`w-full px-3 py-2 rounded-lg border bg-background text-sm ${props.className || ""}`} rows={2} />;
}

export function Select({ children, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...rest} className={`w-full h-10 px-3 rounded-lg border bg-background text-sm ${rest.className || ""}`}>
      {children}
    </select>
  );
}

export function Button({
  variant = "primary",
  className = "",
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger" }) {
  const v =
    variant === "primary"
      ? "bg-primary text-primary-foreground hover:opacity-90"
      : variant === "secondary"
      ? "bg-secondary text-secondary-foreground hover:bg-muted"
      : variant === "danger"
      ? "bg-destructive text-destructive-foreground hover:opacity-90"
      : "hover:bg-muted";
  return <button {...rest} className={`h-10 px-4 rounded-lg text-sm font-medium transition-colors ${v} ${className}`} />;
}
