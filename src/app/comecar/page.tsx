import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/actions/auth";
import { StartForms } from "./start-forms";

export const metadata: Metadata = { title: "Começar" };

export default async function StartPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { count } = await supabase.from("household_members").select("*", { count: "exact", head: true }).eq("user_id", user.id);
  if (count) redirect("/");

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10">
      <p className="text-sm text-ink-soft">Conectado como {user.email}</p>
      <h1 className="mt-2 text-[2rem] leading-[1.1] font-bold tracking-tight">Falta um passo</h1>
      <p className="mt-3 text-ink-soft">
        A família é o espaço que vocês dois compartilham. Quem chega primeiro cria; o outro entra com o código de convite.
      </p>
      <StartForms />
      <form action={signOut} className="mt-8 text-center">
        <button className="text-sm text-ink-soft underline underline-offset-4">Sair desta conta</button>
      </form>
    </main>
  );
}
