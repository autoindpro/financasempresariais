import { createFileRoute } from "@tanstack/react-router";
import { useStore } from "@/lib/store";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { Button, Field, Input } from "@/components/Form";
import { Building2, Upload, Trash2 } from "lucide-react";
import { useRef } from "react";

export const Route = createFileRoute("/empresa")({
  component: EmpresaPage,
  head: () => ({ meta: [{ title: "Perfil da Empresa · Flux Soluções" }] }),
});

function EmpresaPage() {
  const { company, setCompany } = useStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Por favor selecione um arquivo de imagem.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      alert("A imagem deve ter no máximo 2MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setCompany({ logo: ev.target?.result as string });
    };
    reader.readAsDataURL(file);
  };

  return (
    <AppLayout>
      <PageHeader title="Perfil da Empresa" description="Identificação e branding da empresa." />

      <div className="rounded-2xl bg-card border shadow-[var(--shadow-card)] p-6 max-w-3xl">
        <div className="flex items-center gap-4 mb-6">
          <div className="h-20 w-20 rounded-2xl bg-accent flex items-center justify-center overflow-hidden">
            {company.logo ? (
              <img src={company.logo} alt="Logo" className="h-full w-full object-cover" />
            ) : (
              <Building2 className="h-8 w-8 text-accent-foreground" />
            )}
          </div>
          <div className="flex-1">
            <h2 className="font-semibold font-display text-lg">{company.name || "Sua Empresa"}</h2>
            <p className="text-sm text-muted-foreground">{company.cnpj || "CNPJ não informado"}</p>
            <div className="flex gap-2 mt-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleLogoUpload}
              />
              <Button type="button" variant="secondary" onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-4 w-4 mr-1.5" />
                {company.logo ? "Trocar logo" : "Enviar logo"}
              </Button>
              {company.logo && (
                <Button type="button" variant="ghost" onClick={() => setCompany({ logo: "" })}>
                  <Trash2 className="h-4 w-4 mr-1.5" />
                  Remover
                </Button>
              )}
            </div>
          </div>
        </div>

        <form
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
          onSubmit={(e) => {
            e.preventDefault();
          }}
        >
          <Field label="Nome da Empresa" span={2}>
            <Input value={company.name} onChange={(e) => setCompany({ name: e.target.value })} />
          </Field>
          <Field label="CNPJ">
            <Input value={company.cnpj} onChange={(e) => setCompany({ cnpj: e.target.value })} placeholder="00.000.000/0000-00" />
          </Field>
          <Field label="Endereço" span={2}>
            <Input value={company.address} onChange={(e) => setCompany({ address: e.target.value })} />
          </Field>
          <div className="md:col-span-2 text-xs text-muted-foreground">
            A logo enviada substitui automaticamente o ícone do menu lateral, deixando a aplicação white label.
          </div>
        </form>
      </div>
    </AppLayout>
  );
}
