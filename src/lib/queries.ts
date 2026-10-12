import type { SupabaseClient } from "@supabase/supabase-js";
import type { AccountKind, Category } from "@/types/db";

// Contas do dia a dia primeiro: são as mais usadas nos lançamentos.
const KIND_ORDER: Record<AccountKind, number> = { checking: 0, credit_card: 1, cash: 2, savings: 3, emergency: 4, investment: 5 };

export const isCard = (a: { kind: AccountKind }) => a.kind === "credit_card";

export function sortAccounts<T extends { kind: AccountKind; name: string }>(list: T[]): T[] {
  return [...list].sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.name.localeCompare(b.name, "pt-BR"));
}

type AccountRow = { id: string; name: string; kind: AccountKind; archived: boolean };

/** Contas ativas e categorias — o necessário para os formulários de lançamento. */
export async function getFormOptions(supabase: SupabaseClient) {
  const [{ data: accounts }, { data: categories }] = await Promise.all([
    supabase.from("accounts").select("id, name, kind, archived"),
    supabase.from("categories").select("id, name, kind, archived").order("name"),
  ]);
  const all = sortAccounts((accounts ?? []) as AccountRow[]);
  return {
    allAccounts: all,
    accounts: all.filter((a) => !a.archived),
    categories: (categories ?? []) as Category[],
  };
}
