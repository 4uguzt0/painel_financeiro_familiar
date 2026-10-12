import { formatBRL } from "./money";

export type BudgetLevel = "ok" | "warning" | "over";

/** Faixa de alerta do orçamento: 80% avisa, 100% estourou. */
export function budgetLevel(usedRatio: number): BudgetLevel {
  if (usedRatio >= 1) return "over";
  if (usedRatio >= 0.8) return "warning";
  return "ok";
}

/** Frase curta do aviso, usada no painel e depois de lançar uma despesa. */
export function budgetMessage(category: string, budgetCents: number, spentCents: number): string | null {
  const ratio = budgetCents > 0 ? spentCents / budgetCents : 0;
  const level = budgetLevel(ratio);
  if (level === "over") {
    const over = spentCents - budgetCents;
    return over === 0
      ? `${category}: orçamento do mês usado por completo.`
      : `${category} passou do orçamento em ${formatBRL(over)}.`;
  }
  if (level === "warning") {
    return `${category} já usou ${Math.floor(ratio * 100)}% do orçamento. Restam ${formatBRL(budgetCents - spentCents)}.`;
  }
  return null;
}
