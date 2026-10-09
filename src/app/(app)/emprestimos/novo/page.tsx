import type { Metadata } from "next";
import { getSession } from "@/lib/session";
import { sortAccounts } from "@/lib/queries";
import type { AccountKind } from "@/types/db";
import { todayISO } from "@/lib/dates";
import { PageHeader } from "@/components/ui";
import { NewLoanForm } from "./new-loan-form";

export const metadata: Metadata = { title: "Novo empréstimo" };

export default async function NewLoanPage({ searchParams }: { searchParams: Promise<{ tipo?: string }> }) {
  const { tipo } = await searchParams;
  const { supabase } = await getSession();
  const { data } = await supabase.from("accounts").select("id, name, kind").eq("archived", false);
  const accounts = sortAccounts((data ?? []) as { id: string; name: string; kind: AccountKind }[]);

  return (
    <>
      <PageHeader title="Novo empréstimo" back={tipo === "poupanca" ? "/emprestimos?aba=poupanca" : "/emprestimos"} />
      <NewLoanForm accounts={accounts} today={todayISO()} initialKind={tipo === "poupanca" ? "self" : "third_party"} />
    </>
  );
}
