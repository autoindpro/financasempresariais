import { getSupabase, isSupabaseConfigured } from "./supabase";
import { useStore } from "./store";
import { listMyCompanies, pullAllCompanyData, pushAllCompanyData } from "./supabase-sync";

const LS_COMPANY_ID = "flux_company_id";
const LS_LAST_IDS_PREFIX = "flux_supabase_last_ids:";

function getSelectedCompanyId(): string | null {
  try {
    return localStorage.getItem(LS_COMPANY_ID);
  } catch {
    return null;
  }
}

function setSelectedCompanyId(companyId: string) {
  try {
    if (!companyId) localStorage.removeItem(LS_COMPANY_ID);
    else localStorage.setItem(LS_COMPANY_ID, companyId);
  } catch {
    // ignore
  }
}

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function isUuid(id: string | null | undefined): id is string {
  return typeof id === "string" && uuidRe.test(id);
}
function ensureUuid(id: string): string {
  if (uuidRe.test(id)) return id;
  try {
    return globalThis.crypto?.randomUUID?.() ?? id;
  } catch {
    return id;
  }
}

function normalizeIdsInStoreOnce() {
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

function normalizeIdsIfNeeded() {
  const s = useStore.getState();
  const needs =
    s.employees.some((e) => !uuidRe.test(e.id)) ||
    s.accounts.some((a) => !uuidRe.test(a.id)) ||
    s.revenues.some((r) => !uuidRe.test(r.id)) ||
    s.deductions.some((d) => !uuidRe.test(d.id)) ||
    s.cmv.some((c) => !uuidRe.test(c.id)) ||
    s.expenses.some((e) => !uuidRe.test(e.id));
  if (!needs) return;
  normalizeIdsInStoreOnce();
}

let started = false;
let bootstrapping = false;
let pushing = false;
let pendingPush = false;
let pushTimer: number | undefined;
let companyId: string | null = null;
let ignoreNextPush = false;
let hydratedFromSupabase = false;
// Safety: disable mass delete propagation by default to avoid accidental wipes
// when local state is empty/mismatched. Deletions should be handled explicitly
// by calling Supabase delete for the specific row.
const ENABLE_DELETE_PROPAGATION = false;

function formatUnknownError(e: unknown): string {
  try {
    if (e instanceof Error) return `${e.name}: ${e.message}`;
    if (typeof e === "string") return e;
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}

function keyForIds(companyId: string) {
  return `${LS_LAST_IDS_PREFIX}${companyId}`;
}

type LastIds = {
  employees: string[];
  accounts: string[];
  revenues: string[];
  deductions: string[];
  cmv: string[];
  expenses: string[];
};

function loadLastIds(companyId: string): LastIds | null {
  try {
    const raw = localStorage.getItem(keyForIds(companyId));
    if (!raw) return null;
    return JSON.parse(raw) as LastIds;
  } catch {
    return null;
  }
}

function saveLastIds(companyId: string, ids: LastIds) {
  try {
    localStorage.setItem(keyForIds(companyId), JSON.stringify(ids));
  } catch {
    // ignore
  }
}

function diffRemoved(prev: string[] | undefined, next: string[]): string[] {
  if (!prev || prev.length === 0) return [];
  const nextSet = new Set(next);
  return prev.filter((id) => !nextSet.has(id));
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function schedulePush(delayMs = 800) {
  if (!companyId) return;
  if (ignoreNextPush) return;
  if (pushTimer) window.clearTimeout(pushTimer);
  pushTimer = window.setTimeout(async () => {
    if (!companyId) return;
    if (pushing) {
      pendingPush = true;
      return;
    }
    const supabase = getSupabase();
    if (!supabase) return;
    pushing = true;
    try {
      // Ensure all ids are UUIDs before syncing (Supabase expects uuid PKs)
      normalizeIdsIfNeeded();
      const s = useStore.getState();

      const nextIds: LastIds = {
        employees: s.employees.map((x) => x.id),
        accounts: s.accounts.map((x) => x.id),
        revenues: s.revenues.map((x) => x.id),
        deductions: s.deductions.map((x) => x.id),
        cmv: s.cmv.map((x) => x.id),
        expenses: s.expenses.map((x) => x.id),
      };

      const prevIds = loadLastIds(companyId);

      // First, upsert all current rows
      await pushAllCompanyData(supabase, companyId, {
        company: s.company,
        employees: s.employees,
        accounts: s.accounts,
        revenues: s.revenues,
        deductions: s.deductions,
        cmv: s.cmv,
        expenses: s.expenses,
      });

      // Then, propagate deletions (optional, disabled by default for safety)
      if (ENABLE_DELETE_PROPAGATION && hydratedFromSupabase && prevIds) {
        const removedEmployees = diffRemoved(prevIds.employees, nextIds.employees);
        const removedAccounts = diffRemoved(prevIds.accounts, nextIds.accounts);
        const removedRevenues = diffRemoved(prevIds.revenues, nextIds.revenues);
        const removedDeductions = diffRemoved(prevIds.deductions, nextIds.deductions);
        const removedCmv = diffRemoved(prevIds.cmv, nextIds.cmv);
        const removedExpenses = diffRemoved(prevIds.expenses, nextIds.expenses);

        const deleteOps: Array<Promise<void>> = [];
        for (const ids of chunk(removedEmployees, 100)) {
          deleteOps.push((async () => {
            const { error } = await supabase.from("employees").delete().eq("company_id", companyId).in("id", ids);
            if (error) throw error;
          })());
        }
        for (const ids of chunk(removedAccounts, 100)) {
          deleteOps.push((async () => {
            const { error } = await supabase.from("chart_of_accounts").delete().eq("company_id", companyId).in("id", ids);
            if (error) throw error;
          })());
        }
        for (const ids of chunk(removedRevenues, 100)) {
          deleteOps.push((async () => {
            const { error } = await supabase.from("revenues").delete().eq("company_id", companyId).in("id", ids);
            if (error) throw error;
          })());
        }
        for (const ids of chunk(removedDeductions, 100)) {
          deleteOps.push((async () => {
            const { error } = await supabase.from("deductions").delete().eq("company_id", companyId).in("id", ids);
            if (error) throw error;
          })());
        }
        for (const ids of chunk(removedCmv, 100)) {
          deleteOps.push((async () => {
            const { error } = await supabase.from("cmv_cpv_csp").delete().eq("company_id", companyId).in("id", ids);
            if (error) throw error;
          })());
        }
        for (const ids of chunk(removedExpenses, 100)) {
          deleteOps.push((async () => {
            const { error } = await supabase.from("operational_expenses").delete().eq("company_id", companyId).in("id", ids);
            if (error) throw error;
          })());
        }

        try {
          await Promise.all(deleteOps);
        } catch (e) {
          console.error("Supabase auto-sync delete propagation failed:", e);
        }
      }

      saveLastIds(companyId, nextIds);
    } catch (e) {
      console.error("Supabase auto-sync push failed:", formatUnknownError(e), e);
    } finally {
      pushing = false;
      if (pendingPush) {
        pendingPush = false;
        schedulePush(250);
      }
    }
  }, delayMs);
}

export async function initSupabaseAutoSync(): Promise<void> {
  if (started || bootstrapping) return;
  bootstrapping = true;
  let supabase = null as ReturnType<typeof getSupabase>;
  try {
    if (typeof window === "undefined") return;
    if (!isSupabaseConfigured()) return;

    supabase = getSupabase();
    if (!supabase) return;

    // Wait for session to be available (user must be logged in)
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      // try again when auth changes
      supabase.auth.onAuthStateChange((_event, nextSession) => {
        if (nextSession) initSupabaseAutoSync().catch(() => {});
      });
      return;
    }

    started = true;
    bootstrapping = false;
  } finally {
    if (!started) bootstrapping = false;
  }

  normalizeIdsInStoreOnce();

  const selected = getSelectedCompanyId();
  if (isUuid(selected)) {
    companyId = selected;
  } else if (selected) {
    // Old/invalid value (commonly causes PostgREST 400: invalid input syntax for uuid)
    setSelectedCompanyId("");
  } else {
    try {
      const companies = await listMyCompanies(supabase);
      if (companies.length > 0) {
        companyId = companies.find((c) => isUuid(c.companyId))?.companyId ?? null;
        if (companyId) setSelectedCompanyId(companyId);
      }
    } catch (e) {
      console.error("Supabase auto-sync failed to list companies:", e);
    }
  }

  if (!companyId) return;

  // Initial pull
  try {
    const data = await pullAllCompanyData(supabase, companyId);
    ignoreNextPush = true;
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
    hydratedFromSupabase = true;
    saveLastIds(companyId, {
      employees: data.employees.map((x) => x.id),
      accounts: data.accounts.map((x) => x.id),
      revenues: data.revenues.map((x) => x.id),
      deductions: data.deductions.map((x) => x.id),
      cmv: data.cmv.map((x) => x.id),
      expenses: data.expenses.map((x) => x.id),
    });
    // allow pushes after initial hydration
    window.setTimeout(() => {
      ignoreNextPush = false;
    }, 0);
  } catch (e) {
    console.error("Supabase auto-sync initial pull failed:", e);
  }

  // Subscribe to local changes and push
  useStore.subscribe(() => {
    schedulePush().catch(() => {});
  });
}
