import type { SupabaseClient } from "@supabase/supabase-js";

export async function pullOptionValues(
  client: SupabaseClient,
  companyId: string,
  keys: string[],
): Promise<Record<string, string[]>> {
  const out: Record<string, string[]> = {};
  for (const k of keys) out[k] = [];

  const { data, error } = await client
    .from("option_values")
    .select("key,value")
    .eq("company_id", companyId)
    .in("key", keys)
    .order("created_at", { ascending: true });
  if (error) throw error;

  for (const row of data ?? []) {
    const k = String((row as any).key ?? "");
    const v = String((row as any).value ?? "").trim();
    if (!k || !v) continue;
    (out[k] ??= []).push(v);
  }

  // unique
  for (const k of Object.keys(out)) {
    out[k] = Array.from(new Set(out[k]));
  }
  return out;
}

export async function addOptionValue(client: SupabaseClient, companyId: string, key: string, value: string): Promise<void> {
  const v = value.trim();
  if (!v) return;
  const { error } = await client.from("option_values").insert({ company_id: companyId, key, value: v });
  // unique constraint may reject duplicates; treat as ok
  if (error && error.code !== "23505") throw error;
}

