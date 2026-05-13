import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { Plus, Trash2, Eye, EyeOff, Pencil, Search, X } from "lucide-react";
import { useMemo } from "react";
import { Button, Field, Input, Select } from "@/components/Form";
import { Modal, Th, Td } from "./receitas";

export const Route = createFileRoute("/plano-contas")({
  component: PlanoPage,
  head: () => ({ meta: [{ title: "Plano de Contas · Flux Soluções" }] }),
});

function PlanoPage() {
  const { accounts, addAccount, updateAccount, removeAccount } = useStore();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const blank = { name: "", group: "", subgroup: "", type: "Gasto" as "Receita" | "Custo" | "Gasto" | "Financeiro" | "Investimento" | "Deduções", active: true, impactsDre: true };
  const [form, setForm] = useState(blank);

  const [filterName, setFilterName] = useState("");
  const [filterGroup, setFilterGroup] = useState("");
  const [filterSubgroup, setFilterSubgroup] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterDre, setFilterDre] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const groupOptions = useMemo(() => Array.from(new Set(accounts.map((a) => a.group).filter(Boolean))).sort(), [accounts]);
  const subgroupOptions = useMemo(() => Array.from(new Set(accounts.map((a) => a.subgroup).filter(Boolean))).sort(), [accounts]);

  const filteredAccounts = useMemo(() => {
    return accounts.filter((a) => {
      if (filterName && !a.name.toLowerCase().includes(filterName.toLowerCase())) return false;
      if (filterGroup && a.group !== filterGroup) return false;
      if (filterSubgroup && a.subgroup !== filterSubgroup) return false;
      if (filterType && a.type !== filterType) return false;
      if (filterDre === "sim" && !a.impactsDre) return false;
      if (filterDre === "nao" && a.impactsDre) return false;
      if (filterStatus === "ativa" && !a.active) return false;
      if (filterStatus === "inativa" && a.active) return false;
      return true;
    });
  }, [accounts, filterName, filterGroup, filterSubgroup, filterType, filterDre, filterStatus]);

  const hasFilters = filterName || filterGroup || filterSubgroup || filterType || filterDre || filterStatus;
  const clearFilters = () => {
    setFilterName(""); setFilterGroup(""); setFilterSubgroup(""); setFilterType(""); setFilterDre(""); setFilterStatus("");
  };

  const openNew = () => { setEditingId(null); setForm(blank); setOpen(true); };
  const openEdit = (a: typeof accounts[number]) => {
    setEditingId(a.id);
    setForm({ name: a.name, group: a.group, subgroup: a.subgroup, type: a.type, active: a.active, impactsDre: a.impactsDre });
    setOpen(true);
  };

  return (
    <AppLayout>
      <PageHeader
        title="Plano de Contas"
        description="Estrutura contábil em grupo, subgrupo e conta. Edite, oculte ou crie novas contas."
        actions={
          <Button onClick={openNew}>
            <Plus className="h-4 w-4 inline mr-1" /> Nova Conta
          </Button>
        }
      />

      <div className="rounded-2xl bg-card border shadow-[var(--shadow-card)] p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <div className="md:col-span-2 relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome..."
              value={filterName}
              onChange={(e) => setFilterName(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterGroup} onChange={(e) => setFilterGroup(e.target.value)}>
            <option value="">Todos os grupos</option>
            {groupOptions.map((g) => <option key={g} value={g}>{g}</option>)}
          </Select>
          <Select value={filterSubgroup} onChange={(e) => setFilterSubgroup(e.target.value)}>
            <option value="">Todos os subgrupos</option>
            {subgroupOptions.map((g) => <option key={g} value={g}>{g}</option>)}
          </Select>
          <Select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
            <option value="">Todos os tipos</option>
            <option>Receita</option>
            <option>Custo</option>
            <option>Gasto</option>
            <option>Financeiro</option>
            <option>Investimento</option>
            <option>Deduções</option>
          </Select>
          <div className="flex gap-2">
            <Select value={filterDre} onChange={(e) => setFilterDre(e.target.value)}>
              <option value="">DRE: todos</option>
              <option value="sim">Impacta DRE</option>
              <option value="nao">Não impacta</option>
            </Select>
          </div>
          <Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="">Todos os status</option>
            <option value="ativa">Ativa</option>
            <option value="inativa">Inativa</option>
          </Select>
        </div>
        <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
          <span>{filteredAccounts.length} de {accounts.length} contas</span>
          {hasFilters && (
            <button onClick={clearFilters} className="inline-flex items-center gap-1 hover:text-foreground">
              <X className="h-3 w-3" /> Limpar filtros
            </button>
          )}
        </div>
      </div>

      <div className="rounded-2xl bg-card border shadow-[var(--shadow-card)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <Th>Conta</Th>
                <Th>Grupo</Th>
                <Th>Subgrupo</Th>
                <Th>Tipo</Th>
                <Th>DRE</Th>
                <Th>Status</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {filteredAccounts.length === 0 && (
                <tr><td colSpan={7} className="p-8 text-center text-sm text-muted-foreground">Nenhuma conta encontrada com os filtros aplicados.</td></tr>
              )}
              {filteredAccounts.map((a) => (
                <tr key={a.id} className={`border-b last:border-0 hover:bg-muted/30 ${!a.active ? "opacity-50" : ""}`}>
                  <Td className="font-medium">{a.name}</Td>
                  <Td>{a.group}</Td>
                  <Td>{a.subgroup}</Td>
                  <Td>
                    <span className="text-xs px-2 py-0.5 rounded-md bg-secondary">{a.type}</span>
                  </Td>
                  <Td>{a.impactsDre ? "Sim" : "Não"}</Td>
                  <Td>{a.active ? "Ativa" : "Inativa"}</Td>
                  <Td align="right">
                    <div className="inline-flex gap-1">
                      <button onClick={() => openEdit(a)} className="p-1.5 hover:bg-muted rounded" title="Editar">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => updateAccount(a.id, { active: !a.active })}
                        className="p-1.5 hover:bg-muted rounded"
                        title={a.active ? "Ocultar" : "Ativar"}
                      >
                        {a.active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                      <button onClick={() => removeAccount(a.id)} className="p-1.5 hover:bg-destructive/10 hover:text-destructive rounded" title="Excluir">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {open && (
        <Modal title={editingId ? "Editar Conta" : "Nova Conta"} onClose={() => setOpen(false)}>
          <form
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!form.name) return;
              if (editingId) updateAccount(editingId, form);
              else addAccount(form);
              setOpen(false);
              setEditingId(null);
              setForm(blank);
            }}
          >
            <Field label="Nome da Conta" span={2}>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Grupo">
              <Input value={form.group} onChange={(e) => setForm({ ...form, group: e.target.value })} />
            </Field>
            <Field label="Subgrupo">
              <Input value={form.subgroup} onChange={(e) => setForm({ ...form, subgroup: e.target.value })} />
            </Field>
            <Field label="Tipo">
              <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as any })}>
                <option>Receita</option>
                <option>Custo</option>
                <option>Gasto</option>
                <option>Financeiro</option>
                <option>Investimento</option>
                <option>Deduções</option>
              </Select>
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.impactsDre} onChange={(e) => setForm({ ...form, impactsDre: e.target.checked })} />
              Impacta DRE
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
              Conta ativa
            </label>
            <div className="md:col-span-2 flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit">{editingId ? "Atualizar" : "Salvar"}</Button>
            </div>
          </form>
        </Modal>
      )}
    </AppLayout>
  );
}
