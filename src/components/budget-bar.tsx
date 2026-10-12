import { budgetLevel } from "@/lib/budget";
import { cx } from "@/lib/cx";

const FILL = { ok: "bg-pine", warning: "bg-amber", over: "bg-debit" } as const;

/**
 * Barra de uso do orçamento. A marca vertical mostra o "ritmo do mês":
 * se a barra passou da marca, o gasto está adiantado em relação aos dias que já passaram.
 */
export function BudgetBar({
  spent,
  budget,
  progress,
  className,
}: {
  spent: number;
  budget: number;
  progress?: number;
  className?: string;
}) {
  const ratio = budget > 0 ? spent / budget : 0;
  const level = budgetLevel(ratio);
  return (
    <div className={cx("relative h-2 rounded-full bg-rule/60", className)} aria-hidden>
      <div className={cx("absolute inset-y-0 left-0 rounded-full", FILL[level])} style={{ width: `${Math.min(ratio, 1) * 100}%` }} />
      {progress !== undefined && progress > 0 && progress < 1 && (
        <span className="absolute -top-1 h-4 w-0.5 rounded bg-ink/60" style={{ left: `${progress * 100}%` }} />
      )}
    </div>
  );
}
