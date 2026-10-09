"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/session";
import { friendlyError } from "@/lib/errors";
import type { FormState } from "./auth";

export async function createHousehold(_: FormState, form: FormData): Promise<FormState> {
  const name = z.string().trim().min(1, "Dê um nome para a família.").max(80).safeParse(form.get("name"));
  if (!name.success) return { error: name.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_household", { p_name: name.data });
  if (error) return { error: friendlyError(error) };
  redirect("/");
}

export async function joinHousehold(_: FormState, form: FormData): Promise<FormState> {
  const code = z.string().trim().min(4, "Digite o código do convite.").safeParse(form.get("code"));
  if (!code.success) return { error: code.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.rpc("join_household", { p_code: code.data });
  if (error) return { error: friendlyError(error, "Código de convite inválido ou expirado.") };
  redirect("/");
}

export async function createInvite(): Promise<{ code?: string; error?: string }> {
  const { supabase, householdId } = await getSession();
  const { data, error } = await supabase.rpc("create_invite", { p_household: householdId });
  if (error) return { error: friendlyError(error) };
  return { code: data as string };
}

export async function renameHousehold(_: FormState, form: FormData): Promise<FormState> {
  const name = z.string().trim().min(1, "Dê um nome para a família.").max(80).safeParse(form.get("name"));
  if (!name.success) return { error: name.error.issues[0].message };
  const { supabase, householdId } = await getSession();
  const { error } = await supabase.from("households").update({ name: name.data }).eq("id", householdId);
  if (error) return { error: friendlyError(error) };
  revalidatePath("/", "layout");
  return { ok: true, message: "Nome salvo." };
}
