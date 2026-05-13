import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { getSupabase } from "@/lib/supabase";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { fmt, employeeCost } from "@/lib/finance";
import { Plus } from "lucide-react";
import { Button, Field, Input, ComboInput } from "@/components/Form";
import { Modal, Th, Td, RowActions } from "./receitas";

export const Route = createFileRoute("/funcionarios")({
  component: FuncPage,
  head: () => ({ meta: [{ title: "Funcionários · Flux Soluções" }] }),
});

function FuncPage() {
  const { employees, addEmployee, updateEmployee, removeEmployee, options, addOption } = useStore();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const blank = { name: "", cpf: "", role: "", admissionDate: new Date().toISOString().slice(0, 10), salary: 0, inssRate: 8, fgtsRate: 8 };
  const [form, setForm] = useState(blank);

  const totals = employees.reduce(
    (acc, e) => {
      const c = employeeCost(e);
      acc.salary += e.salary;
      acc.inss += c.inss;
      acc.fgts += c.fgts;
      acc.decimo += c.decimoMensal;
      acc.ferias += c.feriasMensal;
      acc.total += c.monthlyTotal;
      return acc;
    },
    { salary: 0, inss: 0, fgts: 0, decimo: 0, ferias: 0, total: 0 }
  );

  const openNew = () => { setEditingId(null); setForm(blank); setOpen(true); };
  const openEdit = (e: typeof employees[number]) => {
    setEditingId(e.id);
    setForm({ name: e.name, cpf: e.cpf, role: e.role, admissionDate: e.admissionDate, salary: e.salary, inssRate: e.inssRate, fgtsRate: e.fgtsRate });
    setOpen(true);
  };

  const deleteEmployee = async (id: string) => {
    const ok = confirm("Excluir este funcionário?");
    if (!ok) return;

    const supabase = getSupabase();
    const companyId = (() => {
      try {
        return localStorage.getItem("flux_company_id");
      } catch {
        return null;
      }
    })();

    if (supabase && companyId) {
      const { error } = await supabase.from("employees").delete().eq("company_id", companyId).eq("id", id);
      if (error) {
        console.error("Supabase delete employee failed:", error);
        alert(`Não foi possível excluir no Supabase: ${error.message}`);
        return;
      }
    }

    removeEmployee(id);
  };

  return (
    <AppLayout>
      <PageHeader
        title="Funcionários"
        description="Folha de pagamento CLT com cálculo automático de encargos e provisões."
        actions={
          <Button onClick={openNew}>
            <Plus className="h-4 w-4 inline mr-1" /> Novo Funcionário
          </Button>
        }
      />

      <div className="rounded-2xl bg-card border shadow-[var(--shadow-card)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <Th>Funcionário</Th>
                <Th>Admissão</Th>
                <Th>Cargo</Th>
                <Th align="right">Salário</Th>
                <Th align="right">INSS</Th>
                <Th align="right">FGTS</Th>
                <Th align="right">13º (mês)</Th>
                <Th align="right">Férias (mês)</Th>
                <Th align="right">Custo Mensal</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {employees.length === 0 && (
                <tr><td colSpan={10} className="text-center py-12 text-muted-foreground">Nenhum funcionário cadastrado.</td></tr>
              )}
              {employees.map((e) => {
                const c = employeeCost(e);
                return (
                  <tr key={e.id} className="border-b last:border-0 hover:bg-muted/30">
                    <Td className="font-medium">{e.name}</Td>
                    <Td>{e.admissionDate}</Td>
                    <Td>{e.role}</Td>
                    <Td align="right" className="tabular-nums">{fmt(e.salary)}</Td>
                    <Td align="right" className="tabular-nums">{fmt(c.inss)}</Td>
                    <Td align="right" className="tabular-nums">{fmt(c.fgts)}</Td>
                    <Td align="right" className="tabular-nums">{fmt(c.decimoMensal)}</Td>
                    <Td align="right" className="tabular-nums">{fmt(c.feriasMensal)}</Td>
                    <Td align="right" className="tabular-nums font-semibold">{fmt(c.monthlyTotal)}</Td>
                    <Td align="right">
                      <RowActions onEdit={() => openEdit(e)} onDelete={() => void deleteEmployee(e.id)} />
                    </Td>
                  </tr>
                );
              })}
            </tbody>
            {employees.length > 0 && (
              <tfoot className="bg-muted/30 font-semibold">
                <tr>
                  <td colSpan={3} className="px-4 py-3">Totais</td>
                  <td className="px-4 py-3 text-right tabular-nums">{fmt(totals.salary)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{fmt(totals.inss)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{fmt(totals.fgts)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{fmt(totals.decimo)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{fmt(totals.ferias)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{fmt(totals.total)}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {open && (
        <Modal title={editingId ? "Editar Funcionário" : "Novo Funcionário"} onClose={() => setOpen(false)}>
          <form
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!form.name || !form.salary) return;
              if (editingId) updateEmployee(editingId, form);
              else addEmployee(form);
              setOpen(false);
              setEditingId(null);
              setForm(blank);
            }}
          >
            <Field label="Nome">
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="CPF">
              <Input value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} />
            </Field>
            <Field label="Cargo / Função">
              <ComboInput value={form.role} onChange={(v) => setForm({ ...form, role: v })} options={options.roles} onAddOption={(v) => addOption("roles", v)} />
            </Field>
            <Field label="Data de Admissão">
              <Input type="date" value={form.admissionDate} onChange={(e) => setForm({ ...form, admissionDate: e.target.value })} />
            </Field>
            <Field label="Salário (R$)">
              <Input type="number" step="0.01" value={form.salary || ""} onChange={(e) => setForm({ ...form, salary: Number(e.target.value) })} />
            </Field>
            <Field label="INSS (%)">
              <Input type="number" step="0.01" value={form.inssRate} onChange={(e) => setForm({ ...form, inssRate: Number(e.target.value) })} />
            </Field>
            <Field label="FGTS (%)">
              <Input type="number" step="0.01" value={form.fgtsRate} onChange={(e) => setForm({ ...form, fgtsRate: Number(e.target.value) })} />
            </Field>
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
