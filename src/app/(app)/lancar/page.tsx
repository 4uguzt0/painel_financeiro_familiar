import type { Metadata } from "next";
import { getSession } from "@/lib/session";
import { getFormOptions } from "@/lib/queries";
import { todayISO } from "@/lib/dates";
import { PageHeader } from "@/components/ui";
import { TransactionForm } from "@/components/transaction-form";

export const metadata: Metadata = { title: "Lançar" };

export default async function NewTransactionPage() {
  const { supabase } = await getSession();
  const { accounts, categories } = await getFormOptions(supabase);
  return (
    <>
      <PageHeader title="Lançar" />
      <TransactionForm accounts={accounts} categories={categories} today={todayISO()} />
    </>
  );
}
