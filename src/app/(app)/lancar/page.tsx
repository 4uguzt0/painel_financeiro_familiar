import type { Metadata } from "next";
import { getSession } from "@/lib/session";
import { getFormOptions } from "@/lib/queries";
import { todayISO } from "@/lib/dates";
import { PageHeader } from "@/components/ui";
import { TransactionForm, type TransactionPreset } from "@/components/transaction-form";

export const metadata: Metadata = { title: "Lançar" };

const TYPES = { despesa: "expense", receita: "income", transferencia: "transfer" } as const;

export default async function NewTransactionPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string; para?: string; valor?: string }>;
}) {
  const sp = await searchParams;
  const { supabase } = await getSession();
  const { accounts, categories } = await getFormOptions(supabase);

  // Atalhos via URL, ex.: /lancar?tipo=transferencia&para=<cartão>&valor=95000 (pagar fatura)
  const preset: TransactionPreset = {
    type: TYPES[sp.tipo as keyof typeof TYPES],
    toAccountId: accounts.some((a) => a.id === sp.para) ? sp.para : undefined,
    amountCents: /^\d{1,11}$/.test(sp.valor ?? "") ? Number(sp.valor) : undefined,
  };
  const target = accounts.find((a) => a.id === preset.toAccountId);
  const title = preset.type === "transfer" && target?.kind === "credit_card" ? `Pagar fatura · ${target.name}` : "Lançar";

  return (
    <>
      <PageHeader title={title} />
      <TransactionForm accounts={accounts} categories={categories} today={todayISO()} preset={preset} key={JSON.stringify(sp)} />
    </>
  );
}
