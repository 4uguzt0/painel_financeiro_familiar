import type { Metadata } from "next";
import { getSession } from "@/lib/session";
import { sortAccounts } from "@/lib/queries";
import { formatBRL } from "@/lib/money";
import { todayISO } from "@/lib/dates";
import { ACCOUNT_KIND_LABEL, type Account, type AccountBalance } from "@/types/db";
import Link from "next/link";
import { PageHeader, Sheet } from "@/components/ui";
import { AccountForm, ArchiveButton } from "./account-forms";

export const metadata: Metadata = { title: "Contas" };

export default async function AccountsPage() {
  const { supabase } = await getSession();
  const [{ data: accounts }, { data: balances }] = await Promise.all([
    supabase.from("accounts").select("*").neq("kind", "credit_card"),
    supabase.from("v_account_balances").select("account_id, balance_cents"),
  ]);
  const balanceOf = new Map((balances as Pick<AccountBalance, "account_id" | "balance_cents">[] | null)?.map((b) => [b.account_id, b.balance_cents]));
  const list = sortAccounts((accounts ?? []) as Account[]);
  const active = list.filter((a) => !a.archived);
  const archived = list.filter((a) => a.archived);
  const total = active.reduce((s, a) => s + (balanceOf.get(a.id) ?? 0), 0);

  return (
    <>
      <PageHeader title="Contas" back="/mais" />
      <p className="-mt-2 mb-5 text-sm text-ink-soft">
        O saldo é calculado: saldo inicial + tudo que entrou − tudo que saiu. Para começar, informe em cada conta o saldo de hoje no banco.
        Cartões de crédito ficam em{" "}
        <Link href="/mais/cartoes" className="font-medium text-ink underline underline-offset-2">
          Cartões
        </Link>
        .
      </p>

      <Sheet className="divide-y divide-rule">
        {active.map((a) => (
          <details key={a.id} className="group">
            <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3.5 [&::-webkit-details-marker]:hidden">
              <div className="flex-1">
                <p className="font-medium">{a.name}</p>
                <p className="text-xs text-ink-faint">{ACCOUNT_KIND_LABEL[a.kind]}</p>
              </div>
              <span className="font-semibold">{formatBRL(balanceOf.get(a.id))}</span>
            </summary>
            <div className="border-t border-rule bg-paper/60 px-4 py-4">
              <AccountForm account={a} />
              <div className="mt-2">
                <ArchiveButton id={a.id} archived={false} label="Arquivar conta" />
              </div>
            </div>
          </details>
        ))}
        <div className="flex items-center justify-between px-4 py-3.5 text-sm">
          <span className="text-ink-soft">Total nas contas</span>
          <span className="font-bold">{formatBRL(total)}</span>
        </div>
      </Sheet>

      <Sheet className="mt-6 p-4">
        <h2 className="mb-3 font-semibold">Nova conta</h2>
        <AccountForm defaultDate={todayISO()} />
      </Sheet>

      {archived.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-sm font-medium text-ink-soft">Arquivadas</h2>
          <Sheet className="divide-y divide-rule">
            {archived.map((a) => (
              <div key={a.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1">
                  <p className="text-ink-soft">{a.name}</p>
                  <p className="text-xs text-ink-faint">{formatBRL(balanceOf.get(a.id))}</p>
                </div>
                <ArchiveButton id={a.id} archived />
              </div>
            ))}
          </Sheet>
        </section>
      )}
    </>
  );
}
