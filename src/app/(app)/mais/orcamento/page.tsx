import type { Metadata } from "next";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { formatBRL } from "@/lib/money";
import { budgetLevel } from "@/lib/budget";
import { currentMonth, monthLabel, monthRange, shiftMonth } from "@/lib/dates";
import { cx } from "@/lib/cx";
import type { BudgetStatus, BudgetSummary, Category } from "@/types/db";
import { PageHeader, Sheet } from "@/components/ui";
import { BudgetBar } from "@/components/budget-bar";
import { BudgetForm } from "./budget-form";

export const metadata: Metadata = { title: "Orçamento" };

export default async function BudgetPage() {
  const { supabase } = await getSession();
  const month = currentMonth();
  const [{ data: statusData }, { data: summaryData }, { data: cats }, { data: thisMonth }, { data: lastMonth }] = await Promise.all([
    supabase.from("v_budget_status").select("*").order("category"),
    supabase.from("v_budget_summary").select("*").maybeSingle(),
    supabase.from("categories").select("id, name, kind, archived").eq("kind", "expense").eq("archived", false).order("name"),
    supabase.from("v_expenses_by_category").select("category_id, total_cents").eq("month", monthRange(month).start),
    supabase.from("v_expenses_by_category").select("category_id, total_cents").eq("month", monthRange(shiftMonth(month, -1)).start),
  ]);
  const status = (statusData ?? []) as BudgetStatus[];
  const summary = summaryData as BudgetSummary | null;
  const categories = (cats ?? []) as Category[];
  const spentNow = new Map((thisMonth ?? []).map((r: { category_id: string; total_cents: number }) => [r.category_id, r.total_cents]));
  const spentLast = new Map((lastMonth ?? []).map((r: { category_id: string; total_cents: number }) => [r.category_id, r.total_cents]));
  const budgeted = new Set(status.map((s) => s.category_id));
  const unbudgeted = categories.filter((c) => !budgeted.has(c.id) && (spentNow.get(c.id) ?? 0) > 0);
  const monthName = monthLabel(month).split(" ")[0];

  return (
    <>
      <PageHeader title="Orçamento" back="/mais" />

      {summary ? (
        <>
          <Sheet className="p-5">
            <p className="text-sm font-medium text-ink-soft">Se cumprirem o orçamento de {monthName}</p>
            {summary.income_ref_cents > 0 ? (
              <>
                <p className={cx("mt-1 text-4xl font-extrabold tracking-tight", summary.planned_savings_cents < 0 && "text-debit")} data-testid="planned-savings">
                  {formatBRL(summary.planned_savings_cents)}
                </p>
                <p className="mt-1 text-ink-soft">
                  {summary.planned_savings_cents >= 0 ? "vão guardar" : "vão gastar mais do que ganham"}
                  {summary.planned_savings_rate !== null && summary.planned_savings_cents >= 0 && (
                    <>
                      {" "}
                      — <strong className="font-semibold text-ink">{Math.round(summary.planned_savings_rate * 100)}% da renda</strong>
                    </>
                  )}
                  .
                </p>
                {summary.income_is_estimate && (
                  <p className="mt-2 text-xs text-ink-faint">Usando a renda do mês passado: as receitas deste mês ainda não foram lançadas.</p>
                )}
              </>
            ) : (
              <p className="mt-2 text-ink-soft">
                Lance as receitas do mês para ver quanto vocês vão guardar se respeitarem o orçamento.
              </p>
            )}

            <div className="mt-5 flex items-baseline justify-between text-sm">
              <span className="text-ink-soft">Usado do orçamento</span>
              <span>
                <strong className="font-semibold">{formatBRL(summary.budgeted_spent_cents)}</strong>
                <span className="text-ink-faint"> de {formatBRL(summary.total_budget_cents)}</span>
              </span>
            </div>
            <BudgetBar className="mt-2" spent={summary.budgeted_spent_cents} budget={summary.total_budget_cents} progress={summary.month_progress} />
            <p className="mt-2 text-xs text-ink-faint">
              A marquinha mostra quanto do mês já passou ({Math.round(summary.month_progress * 100)}%). Barra antes dela = gastando no ritmo
              certo.
            </p>
          </Sheet>

          <section className="mt-5">
            <h2 className="mb-2 px-1 text-sm font-medium text-ink-soft">Por categoria</h2>
            <Sheet className="divide-y divide-rule">
              {status.map((s) => {
                const level = budgetLevel(s.used_ratio);
                return (
                  <div key={s.category_id} className="px-4 py-3">
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="font-medium">{s.category}</span>
                      <span>
                        <strong className="font-semibold">{formatBRL(s.spent_cents)}</strong>
                        <span className="text-ink-faint"> / {formatBRL(s.budget_cents)}</span>
                      </span>
                    </div>
                    <BudgetBar className="mt-2" spent={s.spent_cents} budget={s.budget_cents} progress={summary.month_progress} />
                    <p
                      className={cx(
                        "mt-1.5 text-xs",
                        level === "over" ? "font-medium text-debit" : level === "warning" ? "font-medium text-amber" : "text-ink-faint",
                      )}
                      data-testid={`budget-${s.category}`}
                    >
                      {level === "over"
                        ? s.remaining_cents === 0
                          ? "Limite atingido"
                          : `Passou ${formatBRL(-s.remaining_cents)} do limite`
                        : `${Math.floor(s.used_ratio * 100)}% usado · restam ${formatBRL(s.remaining_cents)}`}
                    </p>
                  </div>
                );
              })}
              {unbudgeted.map((c) => (
                <div key={c.id} className="flex items-baseline justify-between px-4 py-3 text-sm">
                  <span className="text-ink-soft">{c.name}</span>
                  <span className="text-ink-faint">{formatBRL(spentNow.get(c.id))} · sem limite</span>
                </div>
              ))}
            </Sheet>
          </section>
        </>
      ) : (
        <Sheet className="p-5">
          <p className="font-semibold">Quanto vocês querem gastar por mês?</p>
          <p className="mt-1 text-sm text-ink-soft">
            Defina um limite para as categorias que mais pesam. O app mostra quanto vão guardar se cumprirem e avisa quando uma categoria
            chegar a 80% e a 100%.
          </p>
        </Sheet>
      )}

      <section className="mt-6">
        <h2 className="mb-2 px-1 text-sm font-medium text-ink-soft">Limites mensais</h2>
        <Sheet className="p-4">
          <p className="mb-4 text-sm text-ink-soft">
            Deixe em branco as categorias sem limite. Os gastos fixos entram na categoria deles: o limite de Moradia, por exemplo, precisa
            caber o aluguel. Valem para todos os meses até vocês mudarem.
          </p>
          <BudgetForm
            categories={categories.map((c) => ({
              id: c.id,
              name: c.name,
              budget: status.find((s) => s.category_id === c.id)?.budget_cents ?? null,
              lastMonth: spentLast.get(c.id) ?? 0,
            }))}
          />
        </Sheet>
        <p className="mt-3 px-1 text-xs text-ink-faint">
          Faltou uma categoria? Crie em{" "}
          <Link href="/mais/categorias" className="underline underline-offset-2">
            Categorias
          </Link>
          .
        </p>
      </section>
    </>
  );
}
