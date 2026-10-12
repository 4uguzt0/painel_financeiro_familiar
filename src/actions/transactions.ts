"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { friendlyError } from "@/lib/errors";
import { formatBRL } from "@/lib/money";
import { budgetMessage } from "@/lib/budget";
import { currentMonth } from "@/lib/dates";
import type { FormState } from "./auth";

const uuid = z.string().uuid();

// Espelha o CHECK shape_by_type do banco para dar mensagens claras antes de gravar.
const schema = z
  .object({
    id: uuid.optional(),
    type: z.enum(["income", "expense", "transfer"]),
    amount_cents: z.coerce.number().int().positive("Digite um valor maior que zero.").max(99_999_999_999),
    occurred_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Escolha a data."),
    description: z.string().trim().max(140).optional(),
    category_id: uuid.optional(),
    account_id: uuid.optional(),
    to_account_id: uuid.optional(),
  })
  .superRefine((v, ctx) => {
    if (v.type !== "transfer" && !v.category_id) ctx.addIssue({ code: "custom", message: "Escolha uma categoria." });
    if (!v.account_id) ctx.addIssue({ code: "custom", message: v.type === "income" ? "Escolha onde o dinheiro entrou." : "Escolha de qual conta saiu." });
    if (v.type === "transfer") {
      if (!v.to_account_id) ctx.addIssue({ code: "custom", message: "Escolha a conta de destino." });
      else if (v.to_account_id === v.account_id) ctx.addIssue({ code: "custom", message: "Origem e destino precisam ser contas diferentes." });
    }
  });

const verb = { income: "Receita", expense: "Despesa", transfer: "Transferência" } as const;

export async function saveTransaction(_: FormState, form: FormData): Promise<FormState> {
  const get = (k: string) => {
    const v = form.get(k);
    return v === null || v === "" ? undefined : String(v);
  };
  const parsed = schema.safeParse({
    id: get("id"),
    type: get("type"),
    amount_cents: get("amount_cents"),
    occurred_on: get("occurred_on"),
    description: get("description"),
    category_id: get("category_id"),
    account_id: get("account_id"),
    to_account_id: get("to_account_id"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const v = parsed.data;

  const { supabase, householdId } = await getSession();
  const row = {
    household_id: householdId,
    type: v.type,
    amount_cents: v.amount_cents,
    occurred_on: v.occurred_on,
    description: v.description ?? null,
    category_id: v.type === "transfer" ? null : v.category_id,
    from_account_id: v.type === "income" ? null : v.account_id,
    to_account_id: v.type === "income" ? v.account_id : v.type === "transfer" ? v.to_account_id : null,
    // Só despesa pode estar ligada a um gasto fixo
    ...(v.type !== "expense" ? { recurring_id: null } : {}),
  };

  const { error } = v.id
    ? await supabase.from("transactions").update(row).eq("id", v.id)
    : await supabase.from("transactions").insert(row);
  if (error) return { error: friendlyError(error) };

  revalidatePath("/", "layout");
  if (v.id) redirect(`/extrato?mes=${v.occurred_on.slice(0, 7)}`);

  // Aviso de orçamento: depois de uma despesa, confere como ficou a categoria no mês
  let warning: string | undefined;
  if (v.type === "expense" && v.category_id && v.occurred_on.slice(0, 7) === currentMonth()) {
    const { data: b } = await supabase
      .from("v_budget_status")
      .select("category, budget_cents, spent_cents")
      .eq("category_id", v.category_id)
      .maybeSingle();
    if (b) warning = budgetMessage(b.category, b.budget_cents, b.spent_cents) ?? undefined;
  }
  return { ok: true, at: Date.now(), message: `${verb[v.type]} de ${formatBRL(v.amount_cents)} salva.`, warning };
}

export async function deleteTransaction(id: string, backTo = "/extrato") {
  const { supabase } = await getSession();
  const { error } = await supabase.from("transactions").delete().eq("id", id);
  if (error) return { error: friendlyError(error, "Não foi possível excluir.") };
  revalidatePath("/", "layout");
  redirect(backTo);
}
