"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { friendlyError } from "@/lib/errors";
import { parseBRL } from "@/lib/money";
import type { FormState } from "./auth";

// ------------------------------------------------------------------ contas

const accountSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, "Dê um nome para a conta.").max(60),
  kind: z.enum(["checking", "credit_card", "savings", "emergency", "investment", "cash"]),
  initial: z.string(),
  opened_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida."),
});

export async function saveAccount(_: FormState, form: FormData): Promise<FormState> {
  const parsed = accountSchema.safeParse({
    id: form.get("id") || undefined,
    name: form.get("name"),
    kind: form.get("kind"),
    initial: form.get("initial") ?? "",
    opened_on: form.get("opened_on"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const isCard = parsed.data.kind === "credit_card";
  const negative = String(parsed.data.initial).trim().startsWith("-");
  const raw = String(parsed.data.initial).replace(/[−-]/, "");
  const cents = raw.trim() === "" ? 0 : parseBRL(raw);
  if (cents === null)
    return { error: isCard ? "Valor da fatura inválido. Exemplo: 1.250,00" : "Saldo inicial inválido. Exemplo: 1.250,00" };
  // Cartão: o usuário informa quanto DEVE (positivo); guardamos como saldo negativo.
  const initial = isCard ? -cents : negative ? -cents : cents;

  const { supabase, householdId } = await getSession();
  const row = {
    household_id: householdId,
    name: parsed.data.name,
    kind: parsed.data.kind,
    initial_balance_cents: initial,
    opened_on: parsed.data.opened_on,
  };
  const { error } = parsed.data.id
    ? await supabase.from("accounts").update(row).eq("id", parsed.data.id)
    : await supabase.from("accounts").insert(row);
  if (error) return { error: friendlyError(error) };

  revalidatePath("/", "layout");
  return { ok: true, at: Date.now(), message: parsed.data.id ? "Conta atualizada." : "Conta criada." };
}

export async function setAccountArchived(id: string, archived: boolean) {
  const { supabase } = await getSession();
  const { error } = await supabase.from("accounts").update({ archived }).eq("id", id);
  revalidatePath("/", "layout");
  return { error: error ? friendlyError(error) : undefined };
}

// ------------------------------------------------------------------ categorias

const categorySchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, "Dê um nome para a categoria.").max(40),
  kind: z.enum(["income", "expense"]),
});

export async function saveCategory(_: FormState, form: FormData): Promise<FormState> {
  const parsed = categorySchema.safeParse({
    id: form.get("id") || undefined,
    name: form.get("name"),
    kind: form.get("kind"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { supabase, householdId } = await getSession();
  const { error } = parsed.data.id
    ? await supabase.from("categories").update({ name: parsed.data.name }).eq("id", parsed.data.id)
    : await supabase.from("categories").insert({ household_id: householdId, name: parsed.data.name, kind: parsed.data.kind });
  if (error) return { error: friendlyError(error) };

  revalidatePath("/", "layout");
  return { ok: true, at: Date.now(), message: parsed.data.id ? "Categoria renomeada." : "Categoria criada." };
}

export async function setCategoryArchived(id: string, archived: boolean) {
  const { supabase } = await getSession();
  const { error } = await supabase.from("categories").update({ archived }).eq("id", id);
  revalidatePath("/", "layout");
  return { error: error ? friendlyError(error) : undefined };
}
