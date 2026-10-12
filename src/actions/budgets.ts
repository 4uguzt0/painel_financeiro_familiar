"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { friendlyError } from "@/lib/errors";
import { parseBRL } from "@/lib/money";
import type { FormState } from "./auth";

/**
 * Salva os limites mensais. O formulário manda um campo "budget_<categoryId>" por categoria:
 * valor preenchido = cria/atualiza o limite; vazio = remove o limite.
 */
export async function saveBudgets(_: FormState, form: FormData): Promise<FormState> {
  const upserts: { category_id: string; amount_cents: number }[] = [];
  const removals: string[] = [];

  for (const [key, value] of form.entries()) {
    if (!key.startsWith("budget_")) continue;
    const categoryId = key.slice("budget_".length);
    if (!/^[0-9a-f-]{36}$/i.test(categoryId)) continue;
    const text = String(value).trim();
    if (!text) {
      removals.push(categoryId);
      continue;
    }
    const cents = parseBRL(text);
    if (cents === null) return { error: `Valor inválido: “${text}”. Exemplo: 800,00` };
    if (cents === 0) removals.push(categoryId);
    else upserts.push({ category_id: categoryId, amount_cents: cents });
  }

  const { supabase, householdId } = await getSession();
  if (upserts.length) {
    const { error } = await supabase.from("budgets").upsert(
      upserts.map((u) => ({ ...u, household_id: householdId, updated_at: new Date().toISOString() })),
      { onConflict: "household_id,category_id" },
    );
    if (error) return { error: friendlyError(error) };
  }
  if (removals.length) {
    const { error } = await supabase.from("budgets").delete().eq("household_id", householdId).in("category_id", removals);
    if (error) return { error: friendlyError(error) };
  }

  revalidatePath("/", "layout");
  return { ok: true, at: Date.now(), message: "Orçamento salvo." };
}
