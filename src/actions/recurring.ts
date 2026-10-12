"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { friendlyError } from "@/lib/errors";
import { formatBRL, parseBRL } from "@/lib/money";
import type { RecurringMonth } from "@/types/db";
import type { FormState } from "./auth";

const uuid = z.string().uuid();

const recurringSchema = z.object({
  id: uuid.optional(),
  name: z.string().trim().min(1, "Dê um nome ao gasto fixo.").max(60),
  amount: z.string().min(1, "Informe o valor."),
  category_id: uuid.optional(),
  account_id: uuid.optional(),
  day_of_month: z.coerce.number().int().min(1, "Dia entre 1 e 31.").max(31, "Dia entre 1 e 31."),
});

export async function saveRecurring(_: FormState, form: FormData): Promise<FormState> {
  const get = (k: string) => (form.get(k) ? String(form.get(k)) : undefined);
  const parsed = recurringSchema.safeParse({
    id: get("id"),
    name: get("name"),
    amount: get("amount") ?? "",
    category_id: get("category_id"),
    account_id: get("account_id"),
    day_of_month: get("day_of_month"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const v = parsed.data;
  if (!v.category_id) return { error: "Escolha a categoria." };
  if (!v.account_id) return { error: "Escolha de onde sai o pagamento." };
  const cents = parseBRL(v.amount);
  if (!cents) return { error: "Valor inválido. Exemplo: 189,90" };

  const { supabase, householdId } = await getSession();
  const row = {
    household_id: householdId,
    name: v.name,
    amount_cents: cents,
    category_id: v.category_id,
    account_id: v.account_id,
    day_of_month: v.day_of_month,
  };
  const { error } = v.id
    ? await supabase.from("recurring_expenses").update(row).eq("id", v.id)
    : await supabase.from("recurring_expenses").insert(row);
  if (error) return { error: friendlyError(error) };

  revalidatePath("/", "layout");
  return { ok: true, at: Date.now(), message: v.id ? "Gasto fixo atualizado." : "Gasto fixo cadastrado." };
}

export async function setRecurringActive(id: string, active: boolean) {
  const { supabase } = await getSession();
  const { error } = await supabase.from("recurring_expenses").update({ active }).eq("id", id);
  revalidatePath("/", "layout");
  return { error: error ? friendlyError(error) : undefined };
}

export async function deleteRecurring(id: string) {
  const { supabase } = await getSession();
  // Lançamentos já feitos continuam no extrato (o vínculo é desfeito no banco)
  const { error } = await supabase.from("recurring_expenses").delete().eq("id", id);
  revalidatePath("/", "layout");
  return { error: error ? friendlyError(error, "Não foi possível excluir.") : undefined };
}

const launchSchema = z
  .array(z.object({ id: uuid, amount_cents: z.number().int().positive("Valor precisa ser maior que zero.") }))
  .min(1, "Selecione pelo menos um gasto fixo.");

/** Lança os fixos selecionados no mês corrente, na data de vencimento de cada um. */
export async function launchRecurring(items: { id: string; amount_cents: number }[]): Promise<FormState> {
  const parsed = launchSchema.safeParse(items);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { supabase, householdId } = await getSession();
  const { data, error: readError } = await supabase
    .from("v_recurring_month")
    .select("*")
    .in(
      "recurring_id",
      parsed.data.map((i) => i.id),
    )
    .is("transaction_id", null);
  if (readError) return { error: friendlyError(readError) };

  const pending = new Map(((data ?? []) as RecurringMonth[]).map((r) => [r.recurring_id, r]));
  const rows = parsed.data
    .filter((i) => pending.has(i.id))
    .map((i) => {
      const r = pending.get(i.id)!;
      return {
        household_id: householdId,
        type: "expense",
        amount_cents: i.amount_cents,
        occurred_on: r.due_on,
        description: r.name,
        category_id: r.category_id,
        from_account_id: r.account_id,
        recurring_id: r.recurring_id,
      };
    });
  if (rows.length === 0) return { error: "Esses gastos fixos já foram lançados neste mês." };

  // Um único insert = tudo ou nada
  const { error } = await supabase.from("transactions").insert(rows);
  if (error) {
    if (error.code === "23505") return { error: "Algum desses gastos já foi lançado neste mês. Recarregue a página." };
    return { error: friendlyError(error) };
  }

  revalidatePath("/", "layout");
  const total = rows.reduce((s, r) => s + r.amount_cents, 0);
  return {
    ok: true,
    at: Date.now(),
    message: `${rows.length} ${rows.length === 1 ? "gasto fixo lançado" : "gastos fixos lançados"} (${formatBRL(total)}).`,
  };
}
