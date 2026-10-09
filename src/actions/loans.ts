"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { friendlyError } from "@/lib/errors";
import { formatBRL } from "@/lib/money";
import type { FormState } from "./auth";

const uuid = z.string().uuid();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Escolha a data.");
const cents = z.coerce.number().int().positive("Digite um valor maior que zero.").max(99_999_999_999);

function pick(form: FormData, k: string) {
  const v = form.get(k);
  return v === null || v === "" ? undefined : String(v);
}

const createSchema = z
  .object({
    kind: z.enum(["third_party", "self"]),
    counterparty: z.string().trim().min(1, "Preencha o campo de nome/motivo.").max(80),
    principal_cents: cents,
    installments: z.coerce.number().int().min(1, "Mínimo de 1 parcela.").max(120, "Máximo de 120 parcelas."),
    started_on: date,
    from_account: uuid.optional(),
    to_account: uuid.optional(),
    notes: z.string().trim().max(500).optional(),
  })
  .superRefine((v, ctx) => {
    if (!v.from_account) ctx.addIssue({ code: "custom", message: "Escolha de qual conta saiu o dinheiro." });
    if (v.kind === "self") {
      if (!v.to_account) ctx.addIssue({ code: "custom", message: "Escolha para qual conta o dinheiro foi." });
      else if (v.to_account === v.from_account) ctx.addIssue({ code: "custom", message: "Origem e destino precisam ser contas diferentes." });
    }
  });

export async function createLoan(_: FormState, form: FormData): Promise<FormState> {
  const parsed = createSchema.safeParse({
    kind: pick(form, "kind"),
    counterparty: pick(form, "counterparty"),
    principal_cents: pick(form, "principal_cents"),
    installments: pick(form, "installments") ?? 1,
    started_on: pick(form, "started_on"),
    from_account: pick(form, "from_account"),
    to_account: pick(form, "to_account"),
    notes: pick(form, "notes"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const v = parsed.data;

  const { supabase, householdId } = await getSession();
  const { data, error } = await supabase.rpc("create_loan", {
    p_household: householdId,
    p_kind: v.kind,
    p_counterparty: v.counterparty,
    p_principal_cents: v.principal_cents,
    p_installments: v.installments,
    p_started_on: v.started_on,
    p_from_account: v.from_account,
    p_to_account: v.kind === "self" ? v.to_account : null,
    p_notes: v.notes ?? null,
  });
  if (error) return { error: friendlyError(error) };

  revalidatePath("/", "layout");
  redirect(`/emprestimos/${data}`);
}

const paymentSchema = z.object({
  loan_id: uuid,
  kind: z.enum(["third_party", "self"]),
  amount_cents: cents,
  occurred_on: date,
  account_id: uuid,
  savings_account_id: uuid.optional(),
});

/** Recebimento (terceiro) ou devolução à poupança (autoempréstimo). */
export async function registerPayment(_: FormState, form: FormData): Promise<FormState> {
  const parsed = paymentSchema.safeParse({
    loan_id: pick(form, "loan_id"),
    kind: pick(form, "kind"),
    amount_cents: pick(form, "amount_cents"),
    occurred_on: pick(form, "occurred_on"),
    account_id: pick(form, "account_id"),
    savings_account_id: pick(form, "savings_account_id"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const v = parsed.data;
  if (v.kind === "self" && !v.savings_account_id) return { error: "Escolha para qual conta o dinheiro volta." };
  if (v.kind === "self" && v.savings_account_id === v.account_id) return { error: "Origem e destino precisam ser contas diferentes." };

  const { supabase, householdId } = await getSession();
  const { data: loan } = await supabase.from("v_loan_status").select("outstanding_cents, counterparty").eq("loan_id", v.loan_id).maybeSingle();
  if (!loan) return { error: "Empréstimo não encontrado." };
  if (v.amount_cents > loan.outstanding_cents)
    return { error: `O valor passa do que falta (${formatBRL(loan.outstanding_cents)}).` };

  const row =
    v.kind === "third_party"
      ? { type: "loan_in", to_account_id: v.account_id, from_account_id: null, description: `Recebido de ${loan.counterparty}` }
      : { type: "self_loan_return", from_account_id: v.account_id, to_account_id: v.savings_account_id, description: `Devolução: ${loan.counterparty}` };

  const { error } = await supabase.from("transactions").insert({
    household_id: householdId,
    loan_id: v.loan_id,
    amount_cents: v.amount_cents,
    occurred_on: v.occurred_on,
    ...row,
  });
  if (error) return { error: friendlyError(error) };

  revalidatePath("/", "layout");
  return { ok: true, at: Date.now(), message: `${formatBRL(v.amount_cents)} registrado.` };
}

export async function deleteLoan(id: string) {
  const { supabase } = await getSession();
  const { error } = await supabase.from("loans").delete().eq("id", id);
  if (error) return { error: friendlyError(error, "Não foi possível excluir.") };
  revalidatePath("/", "layout");
  redirect("/emprestimos");
}
