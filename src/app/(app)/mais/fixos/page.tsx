import type { Metadata } from "next";
import { getSession } from "@/lib/session";
import { getFormOptions } from "@/lib/queries";
import { formatBRL } from "@/lib/money";
import { currentMonth, monthLabel } from "@/lib/dates";
import type { RecurringExpense, RecurringMonth } from "@/types/db";
import { EmptyState, PageHeader, Sheet } from "@/components/ui";
import { LaunchList, RecurringForm, RecurringRowActions } from "./recurring-forms";

export const metadata: Metadata = { title: "Gastos fixos" };

export default async function RecurringPage() {
  const { supabase } = await getSession();
  const [{ data: all }, { data: month }, options] = await Promise.all([
    supabase.from("recurring_expenses").select("*").order("day_of_month").order("name"),
    supabase.from("v_recurring_month").select("*").order("due_on").order("name"),
    getFormOptions(supabase),
  ]);
  const list = (all ?? []) as RecurringExpense[];
  const thisMonth = (month ?? []) as RecurringMonth[];
  const catName = new Map(options.categories.map((c) => [c.id, c.name]));
  const accName = new Map(options.allAccounts.map((a) => [a.id, a.name]));
  const expenseCats = options.categories.filter((c) => c.kind === "expense" && !c.archived);
  const monthName = monthLabel(currentMonth()).split(" ")[0];
  const monthlyTotal = list.filter((r) => r.active).reduce((s, r) => s + r.amount_cents, 0);

  return (
    <>
      <PageHeader title="Gastos fixos" back="/mais" />
      <p className="-mt-2 mb-5 text-sm text-ink-soft">
        Cadastre uma vez o que se repete todo mês. Depois é só conferir os valores e lançar o mês inteiro de uma vez.
      </p>

      <section className="mb-6">
        <h2 className="mb-2 px-1 text-sm font-medium text-ink-soft first-letter:uppercase">{monthName}</h2>
        {thisMonth.length === 0 ? (
          <EmptyState title="Nenhum gasto fixo cadastrado">
            Comece pelo aluguel, condomínio, luz, internet e assinaturas no formulário abaixo.
          </EmptyState>
        ) : (
          <LaunchList
            // Remonta a lista quando um fixo é criado ou editado (mantém a mensagem após lançar)
            key={thisMonth.map((i) => `${i.recurring_id}:${i.amount_cents}`).join("|")}
            items={thisMonth}
          />
        )}
      </section>

      <section>
        <div className="mb-2 flex items-baseline justify-between px-1">
          <h2 className="text-sm font-medium text-ink-soft">Cadastrados</h2>
          {monthlyTotal > 0 && <span className="text-sm text-ink-soft">{formatBRL(monthlyTotal)} por mês</span>}
        </div>
        {list.length > 0 && (
          <Sheet className="mb-4 divide-y divide-rule">
            {list.map((r) => (
              <details key={r.id}>
                <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
                  <div className="min-w-0 flex-1">
                    <p className={r.active ? "font-medium" : "font-medium text-ink-faint line-through"}>{r.name}</p>
                    <p className="truncate text-xs text-ink-faint">
                      dia {r.day_of_month} · {catName.get(r.category_id)} · {accName.get(r.account_id)}
                    </p>
                  </div>
                  <span className="shrink-0 font-semibold">{formatBRL(r.amount_cents)}</span>
                </summary>
                <div className="border-t border-rule bg-paper/60 px-4 py-4">
                  <RecurringForm recurring={r} categories={expenseCats} accounts={options.accounts} />
                  <RecurringRowActions id={r.id} active={r.active} />
                </div>
              </details>
            ))}
          </Sheet>
        )}
        <Sheet className="p-4">
          <h3 className="mb-3 font-semibold">Novo gasto fixo</h3>
          <RecurringForm categories={expenseCats} accounts={options.accounts} />
        </Sheet>
      </section>
    </>
  );
}
