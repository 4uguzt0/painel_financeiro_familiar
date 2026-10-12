"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { friendlyAuthError } from "@/lib/errors";

/** Retorno padrão das Server Actions de formulário. `at` muda a cada sucesso (útil para limpar o form). */
export type FormState = { error?: string; ok?: boolean; message?: string; warning?: string; at?: number } | undefined;

const credentials = z.object({
  email: z.string().trim().toLowerCase().email("Digite um e-mail válido."),
  password: z.string().min(6, "A senha precisa ter pelo menos 6 caracteres."),
});

export async function signIn(_: FormState, form: FormData): Promise<FormState> {
  const parsed = credentials.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: friendlyAuthError(error.message) };
  redirect("/");
}

export async function signUp(_: FormState, form: FormData): Promise<FormState> {
  const parsed = credentials.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp(parsed.data);
  if (error) return { error: friendlyAuthError(error.message) };
  if (!data.session) {
    // Projeto com "Confirm email" ligado: precisa clicar no link do e-mail primeiro
    return { ok: true, message: "Conta criada. Abra o e-mail de confirmação e depois volte para entrar." };
  }
  redirect("/comecar");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
