import type { Metadata } from "next";
import { getSession } from "@/lib/session";
import { formatBRL } from "@/lib/money";
import { todayISO, monthLabel, currentMonth } from "@/lib/dates";
import type { Account, CardSummary } from "@/types/db";
import { ButtonLink, EmptyState, PageHeader, Sheet } from "@/components/ui";
import { AccountForm, ArchiveButton } from "../contas/account-forms";

export const metadata: Metadata = { title: "Cartões" };

export default async function CardsPage() {
  const { supabase } = await getSession();
  const [{ data: accounts }, { data: summary }] = await Promise.all([
    supabase.from("accounts").select("*").eq("kind", "credit_card").order("name"),
    supabase.from("v_card_summary").select("*"),
  ]);
  const cards = (accounts ?? []) as Account[];
  const byId = new Map(((summary ?? []) as CardSummary[]).map((s) => [s.account_id, s]));
  const active = cards.filter((c) => !c.archived);
  const archived = cards.filter((c) => c.archived);
  const totalOwed = active.reduce((s, c) => s + (byId.get(c.id)?.owed_cents ?? 0), 0);
  const totalMonth = active.reduce((s, c) => s + (byId.get(c.id)?.month_spent_cents ?? 0), 0);
  const month = monthLabel(currentMonth()).split(" ")[0];

  return (
    <>
      <PageHeader title="Cartões" back="/mais" />
      <p className="-mt-2 mb-5 text-sm text-ink-soft">
        Compra no cartão é uma despesa que <strong className="font-semibold text-ink">sai do cartão</strong>. Pagar a fatura é uma
        transferência da conta para o cartão: não conta como gasto de novo.
      </p>

      {active.length > 0 && (
        <div className="mb-5 grid grid-cols-2 gap-3">
          <Sheet className="px-4 py-3">
            <p className="text-xs text-ink-soft">Gasto em {month}</p>
            <p className="text-lg font-bold" data-testid="cards-month-spent">
              {formatBRL(totalMonth)}
            </p>
          </Sheet>
          <Sheet className="px-4 py-3">
            <p className="text-xs text-ink-soft">Total a pagar</p>
            <p className="text-lg font-bold text-debit">{formatBRL(totalOwed)}</p>
          </Sheet>
        </div>
      )}

      {active.length === 0 ? (
        <EmptyState title="Nenhum cartão cadastrado">Adicione cada cartão de crédito da família no formulário abaixo.</EmptyState>
      ) : (
        <div className="flex flex-col gap-3">
          {active.map((c) => {
            const s = byId.get(c.id);
            const owed = s?.owed_cents ?? 0;
            return (
              <Sheet key={c.id}>
                <div className="flex items-start justify-between gap-3 p-4">
                  <div>
                    <p className="font-semibold">{c.name}</p>
                    <p className="mt-0.5 text-sm text-ink-soft">
                      {formatBRL(s?.month_spent_cents)} em compras em {month}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs text-ink-faint">A pagar</p>
                    <p className="whitespace-nowrap font-bold text-debit" data-testid={`card-owed-${c.name}`}>
                      {formatBRL(owed)}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 border-t border-rule px-4 py-3">
                  <ButtonLink
                    href={`/lancar?tipo=transferencia&para=${c.id}${owed > 0 ? `&valor=${owed}` : ""}`}
                    variant="pine"
                    className="h-10 flex-1"
                  >
                    Pagar fatura
                  </ButtonLink>
                  <ButtonLink href={`/extrato?conta=${c.id}`} variant="outline" className="h-10 flex-1">
                    Ver compras
                  </ButtonLink>
                </div>
                <details className="border-t border-rule">
                  <summary className="cursor-pointer list-none px-4 py-3 text-sm text-ink-soft [&::-webkit-details-marker]:hidden">
                    Editar cartão
                  </summary>
                  <div className="bg-paper/60 px-4 pb-4">
                    <AccountForm account={c} />
                    <div className="mt-2">
                      <ArchiveButton id={c.id} archived={false} label="Arquivar cartão" />
                    </div>
                  </div>
                </details>
              </Sheet>
            );
          })}
        </div>
      )}

      <Sheet className="mt-6 p-4">
        <h2 className="mb-3 font-semibold">Novo cartão</h2>
        <AccountForm defaultDate={todayISO()} defaultKind="credit_card" />
      </Sheet>

      {archived.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-sm font-medium text-ink-soft">Arquivados</h2>
          <Sheet className="divide-y divide-rule">
            {archived.map((c) => (
              <div key={c.id} className="flex items-center gap-3 px-4 py-3">
                <p className="flex-1 text-ink-soft">{c.name}</p>
                <div className="w-32">
                  <ArchiveButton id={c.id} archived />
                </div>
              </div>
            ))}
          </Sheet>
        </section>
      )}
    </>
  );
}
