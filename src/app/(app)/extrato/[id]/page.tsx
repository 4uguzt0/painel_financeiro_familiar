import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getFormOptions } from "@/lib/queries";
import { todayISO } from "@/lib/dates";
import type { Transaction } from "@/types/db";
import { PageHeader } from "@/components/ui";
import { TransactionForm } from "@/components/transaction-form";
import { DeleteTransactionButton } from "@/components/delete-transaction-button";

export const metadata: Metadata = { title: "Editar lançamento" };

export default async function EditTransactionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { supabase } = await getSession();

  const [{ data }, options] = await Promise.all([
    supabase.from("transactions").select("*").eq("id", id).maybeSingle(),
    getFormOptions(supabase),
  ]);
  if (!data) notFound();
  const t = data as Transaction;
  if (t.loan_id) redirect(`/emprestimos/${t.loan_id}`);

  // Inclui conta arquivada se o lançamento usa uma
  const used = new Set([t.from_account_id, t.to_account_id]);
  const accounts = options.allAccounts.filter((a) => !a.archived || used.has(a.id));

  return (
    <>
      <PageHeader title="Editar lançamento" back={`/extrato?mes=${t.occurred_on.slice(0, 7)}`} />
      <TransactionForm accounts={accounts} categories={options.categories} today={todayISO()} initial={t} />
      <div className="mt-4">
        <DeleteTransactionButton id={t.id} backTo={`/extrato?mes=${t.occurred_on.slice(0, 7)}`} />
      </div>
    </>
  );
}
