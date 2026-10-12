"use client";

import { useActionState } from "react";
import { saveBudgets } from "@/actions/budgets";
import { formatAmount, formatBRL } from "@/lib/money";
import { FormError, SubmitButton } from "@/components/ui";

type Row = { id: string; name: string; budget: number | null; lastMonth: number };

export function BudgetForm({ categories }: { categories: Row[] }) {
  const [state, action] = useActionState(saveBudgets, undefined);
  return (
    <form action={action} className="flex flex-col gap-3">
      <ul className="flex flex-col divide-y divide-rule">
        {categories.map((c) => (
          <li key={c.id} className="flex items-center gap-3 py-2.5">
            <label htmlFor={`b-${c.id}`} className="min-w-0 flex-1">
              <span className="block truncate font-medium">{c.name}</span>
              <span className="block text-xs text-ink-faint">
                {c.lastMonth > 0 ? `mês passado: ${formatBRL(c.lastMonth)}` : "sem gasto no mês passado"}
              </span>
            </label>
            <div className="flex w-32 shrink-0 items-baseline gap-1 rounded-xl border border-rule bg-sheet px-3 py-2 focus-within:border-ink">
              <span className="text-xs text-ink-faint">R$</span>
              <input
                id={`b-${c.id}`}
                name={`budget_${c.id}`}
                inputMode="decimal"
                placeholder="sem limite"
                defaultValue={c.budget ? formatAmount(c.budget) : ""}
                className="w-full bg-transparent text-right font-semibold placeholder:text-xs placeholder:font-normal placeholder:text-ink-faint focus:outline-none"
              />
            </div>
          </li>
        ))}
      </ul>
      <FormError message={state?.error} />
      {state?.message && <p className="text-sm font-medium text-pine">{state.message}</p>}
      <SubmitButton>Salvar orçamento</SubmitButton>
    </form>
  );
}
