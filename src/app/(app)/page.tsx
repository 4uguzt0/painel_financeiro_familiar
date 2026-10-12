import Link from "next/link";
import { getSession } from "@/lib/session";
import { currentMonth, monthLabel, monthRange, shiftMonth } from "@/lib/dates";
import { formatBRL } from "@/lib/money";
import type { AccountBalance, BudgetStatus, BudgetSummary, CardSummary, DashboardSummary, RecurringMonth } from "@/types/db";
import { budgetLevel, budgetMessage } from "@/lib/budget";
import { BudgetBar } from "@/components/budget-bar";
import { ButtonLink, Sheet } from "@/components/ui";
import { cx } from "@/lib/cx";
import { NetWorthChart } from "@/components/net-worth-chart";

export default async function DashboardPage() {
  const { supabase, householdName } = await getSession();
  const month = currentMonth();
  const firstChartMonth = monthRange(shiftMonth(month, -11)).start;

  const [summaryRes, netWorthRes, byCatRes, balancesRes, countRes, cardsRes, fixedRes, budgetRes, budgetSumRes] = await Promise.all([
    supabase.from("v_dashboard_summary").select("*").maybeSingle(),
    supabase.from("v_net_worth_monthly").select("month, accounts_cents, receivables_cents").gte("month", firstChartMonth).order("month"),
    supabase.from("v_expenses_by_category").select("category, total_cents").eq("month", monthRange(month).start).order("total_cents", { ascending: false }),
    supabase.from("v_account_balances").select("account_id, name, kind, balance_cents").eq("archived", false),
    supabase.from("transactions").select("id", { count: "exact", head: true }),
    supabase.from("v_card_summary").select("*").eq("archived", false),
    supabase.from("v_recurring_month").select("recurring_id, amount_cents, transaction_id"),
    supabase.from("v_budget_status").select("*"),
    supabase.from("v_budget_summary").select("*").maybeSingle(),
  ]);

  const s = (summaryRes.data ?? {}) as Partial<DashboardSummary>;
  const netWorth = (netWorthRes.data ?? []).map((r: { month: string; accounts_cents: number; receivables_cents: number }) => ({
    month: r.month,
    value: Number(r.accounts_cents) + Number(r.receivables_cents),
  }));
  const byCat = (byCatRes.data ?? []) as { category: string; total_cents: number }[];
  const balances = ((balancesRes.data ?? []) as AccountBalance[])
    .filter((b) => b.kind !== "credit_card")
    .sort((a, b) => b.balance_cents - a.balance_cents);
  const isEmpty = (countRes.count ?? 0) === 0;
  const cards = (cardsRes.data ?? []) as CardSummary[];
  const fixed = (fixedRes.data ?? []) as Pick<RecurringMonth, "recurring_id" | "amount_cents" | "transaction_id">[];
  const budgets = (budgetRes.data ?? []) as BudgetStatus[];
  const budgetSummary = budgetSumRes.data as BudgetSummary | null;
  const alerts = budgets
    .filter((b) => budgetLevel(b.used_ratio) !== "ok")
    .sort((a, b) => b.used_ratio - a.used_ratio)
    .map((b) => ({ level: budgetLevel(b.used_ratio), text: budgetMessage(b.category, b.budget_cents, b.spent_cents)! }));

  return (
    <>
      <header className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-sm text-ink-soft">{householdName}</p>
          <h1 className="text-2xl font-bold tracking-tight first-letter:uppercase">{monthLabel(month)}</h1>
        </div>
        <Link href="/mais/como-usar" className="text-sm text-ink-soft underline-offset-4 hover:underline">
          Como usar
        </Link>
      </header>

      {isEmpty && <Welcome />}

      <SavingsHero rate={s.month_savings_rate ?? null} income={s.month_income_cents ?? 0} expense={s.month_expense_cents ?? 0} month={month} />

      {alerts.length > 0 && <BudgetAlerts alerts={alerts} />}

      {budgetSummary ? <BudgetCard summary={budgetSummary} /> : !isEmpty && <BudgetInvite />}

      {(fixed.length > 0 || cards.length > 0) && (
        <div className="mt-4 grid grid-cols-2 gap-3">
          {fixed.length > 0 && <FixedTile items={fixed} />}
          {cards.length > 0 && <CardsTile cards={cards} />}
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Sheet className="col-span-2 p-4">
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <p className="text-sm text-ink-soft">Patrimônio líquido</p>
              <p className="text-2xl font-bold tracking-tight" data-testid="net-worth">
                {formatBRL(s.net_worth_cents)}
              </p>
            </div>
            <Change cents={s.net_worth_change_cents ?? null} />
          </div>
          <NetWorthChart data={netWorth} />
          <p className="mt-1 text-xs text-ink-faint">Saldo de todas as contas + o que outras pessoas devem a vocês, no fim de cada mês.</p>
        </Sheet>

        <Link href="/emprestimos" className="block">
          <Sheet className="h-full p-4 hover:border-ink-faint">
            <p className="text-sm text-ink-soft">A receber</p>
            <p className="mt-1 text-lg font-bold">{formatBRL(s.receivables_cents)}</p>
            <p className="mt-1 text-xs text-ink-faint">Empréstimos a terceiros</p>
          </Sheet>
        </Link>
        <Link href="/emprestimos?aba=poupanca" className="block">
          <Sheet className="h-full p-4 hover:border-ink-faint">
            <p className="text-sm text-ink-soft">A devolver</p>
            <p className={cx("mt-1 text-lg font-bold", (s.self_loan_outstanding_cents ?? 0) > 0 && "text-amber")}>
              {formatBRL(s.self_loan_outstanding_cents)}
            </p>
            <p className="mt-1 text-xs text-ink-faint">Para a poupança</p>
          </Sheet>
        </Link>
      </div>

      <Sheet className="mt-4 p-4">
        <div className="flex items-baseline justify-between">
          <h2 className="font-semibold">Para onde foi o dinheiro</h2>
          <Link href="/extrato?filtro=despesas" className="text-sm text-ink-soft hover:underline">
            Ver extrato
          </Link>
        </div>
        <CategoryBars rows={byCat} total={s.month_expense_cents ?? 0} />
      </Sheet>

      <Sheet className="mt-4 p-4">
        <div className="flex items-baseline justify-between">
          <h2 className="font-semibold">Saldos</h2>
          <Link href="/mais/contas" className="text-sm text-ink-soft hover:underline">
            Ajustar contas
          </Link>
        </div>
        <ul className="mt-2 divide-y divide-rule">
          {balances.map((b) => (
            <li key={b.account_id} className="flex justify-between py-2.5 text-sm">
              <span>{b.name}</span>
              <span className={cx("font-semibold", b.balance_cents < 0 && "text-debit")}>{formatBRL(b.balance_cents)}</span>
            </li>
          ))}
        </ul>
      </Sheet>
    </>
  );
}

// ---------------------------------------------------------------------------

function band(rate: number) {
  if (rate >= 0.2) return { label: "Ótimo", cls: "bg-pine-soft text-pine", bar: "bg-pine" };
  if (rate >= 0.1) return { label: "Bom", cls: "bg-amber-soft text-amber", bar: "bg-amber" };
  return { label: "Atenção", cls: "bg-debit-soft text-debit", bar: "bg-debit" };
}

function SavingsHero({ rate, income, expense, month }: { rate: number | null; income: number; expense: number; month: string }) {
  const monthName = monthLabel(month).split(" ")[0];

  if (rate === null) {
    return (
      <Sheet className="p-5">
        <p className="text-sm font-medium text-ink-soft">Taxa de poupança</p>
        <p className="mt-2 text-[3.5rem] leading-none font-bold tracking-tight text-rule">—%</p>
        <p className="mt-3 text-ink-soft">
          Lance as receitas de {monthName} (salários, extras) para ver quanto da renda vocês estão guardando.
        </p>
        <ButtonLink href="/lancar" variant="outline" className="mt-4 w-full">
          Lançar receita
        </ButtonLink>
      </Sheet>
    );
  }

  const pct = Math.round(rate * 100);
  const b = band(rate);
  const per100 = Math.abs(pct);
  const fill = Math.max(0, Math.min(rate / 0.4, 1)) * 100; // trilha vai de 0% a 40%

  return (
    <Sheet className="p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-ink-soft">Taxa de poupança</p>
        <span className={cx("rounded-full px-2.5 py-0.5 text-xs font-semibold", b.cls)}>{b.label}</span>
      </div>
      <p className={cx("mt-1 text-[5.5rem] leading-[0.95] font-extrabold tracking-[-0.04em]", rate < 0 ? "text-debit" : "text-ink")} data-testid="savings-rate">
        {pct}
        <span className="text-[0.5em] font-bold tracking-normal">%</span>
      </p>
      <p className="mt-3 text-lg leading-snug text-balance">
        {rate >= 0 ? (
          <>
            De cada R$ 100 que entraram em {monthName}, vocês guardaram <strong className="font-bold">R$ {per100}</strong>.
          </>
        ) : (
          <>
            Em {monthName}, vocês gastaram <strong className="font-bold">R$ {per100} a mais</strong> a cada R$ 100 que entraram.
          </>
        )}
      </p>

      {/* trilha com as faixas de referência 10% e 20% */}
      <div className="mt-5" aria-hidden>
        <div className="relative h-2 rounded-full bg-rule/70">
          <div className={cx("absolute inset-y-0 left-0 rounded-full", b.bar)} style={{ width: `${fill}%` }} />
          <span className="absolute -top-1 h-4 w-px bg-ink-faint" style={{ left: "25%" }} />
          <span className="absolute -top-1 h-4 w-px bg-ink-faint" style={{ left: "50%" }} />
        </div>
        <div className="relative mt-1.5 h-4 text-[11px] text-ink-faint">
          <span className="absolute left-0">0%</span>
          <span className="absolute -translate-x-1/2" style={{ left: "25%" }}>10%</span>
          <span className="absolute -translate-x-1/2" style={{ left: "50%" }}>20%</span>
          <span className="absolute right-0">40%+</span>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-rule pt-4 text-sm">
        <div>
          <dt className="text-ink-faint">Entrou</dt>
          <dd className="font-semibold">{formatBRL(income)}</dd>
        </div>
        <div>
          <dt className="text-ink-faint">Gastou</dt>
          <dd className="font-semibold">{formatBRL(expense)}</dd>
        </div>
        <div>
          <dt className="text-ink-faint">Sobrou</dt>
          <dd className={cx("font-semibold", income - expense < 0 ? "text-debit" : "text-pine")}>{formatBRL(income - expense)}</dd>
        </div>
      </dl>
    </Sheet>
  );
}

function Change({ cents }: { cents: number | null }) {
  if (cents === null) return <span className="text-xs text-ink-faint">primeiro mês</span>;
  const up = cents >= 0;
  return (
    <span className={cx("shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold", up ? "bg-pine-soft text-pine" : "bg-debit-soft text-debit")}>
      {up ? "▲" : "▼"} {formatBRL(Math.abs(cents))} no mês
    </span>
  );
}

function CategoryBars({ rows, total }: { rows: { category: string; total_cents: number }[]; total: number }) {
  if (rows.length === 0) return <p className="mt-3 text-sm text-ink-soft">Nenhuma despesa lançada neste mês.</p>;
  const max = rows[0].total_cents;
  return (
    <ul className="mt-3 flex flex-col gap-3">
      {rows.map((r) => (
        <li key={r.category}>
          <div className="flex justify-between text-sm">
            <span>{r.category}</span>
            <span>
              <span className="font-semibold">{formatBRL(r.total_cents)}</span>
              <span className="ml-2 inline-block w-9 text-right text-ink-faint">{total ? Math.round((r.total_cents / total) * 100) : 0}%</span>
            </span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-rule/50">
            <div className="h-full rounded-full bg-ink-soft" style={{ width: `${Math.max(2, (r.total_cents / max) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function BudgetAlerts({ alerts }: { alerts: { level: string; text: string }[] }) {
  return (
    <Link href="/mais/orcamento" className="mt-4 block" data-testid="budget-alerts">
      <ul className="flex flex-col gap-2">
        {alerts.slice(0, 3).map((a) => (
          <li
            key={a.text}
            className={cx(
              "flex items-start gap-2 rounded-xl px-3.5 py-2.5 text-sm font-medium",
              a.level === "over" ? "bg-debit-soft text-debit" : "bg-amber-soft text-amber",
            )}
          >
            <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden className="mt-px shrink-0">
              <path d="M10 3.5l7 12.5H3L10 3.5z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
              <path d="M10 8.5v3.2M10 14h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            {a.text}
          </li>
        ))}
      </ul>
    </Link>
  );
}

function BudgetCard({ summary }: { summary: BudgetSummary }) {
  return (
    <Link href="/mais/orcamento" className="mt-4 block">
      <Sheet className="p-4 hover:border-ink-faint">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-sm text-ink-soft">Orçamento do mês</p>
          <p className="text-sm">
            <strong className="font-semibold">{formatBRL(summary.budgeted_spent_cents)}</strong>
            <span className="text-ink-faint"> de {formatBRL(summary.total_budget_cents)}</span>
          </p>
        </div>
        <BudgetBar className="mt-2.5" spent={summary.budgeted_spent_cents} budget={summary.total_budget_cents} progress={summary.month_progress} />
        {summary.income_ref_cents > 0 && (
          <p className="mt-3 text-sm">
            Cumprindo o orçamento, vocês guardam{" "}
            <strong className={cx("font-bold", summary.planned_savings_cents < 0 ? "text-debit" : "text-pine")}>
              {formatBRL(summary.planned_savings_cents)}
            </strong>
            {summary.planned_savings_rate !== null && summary.planned_savings_cents > 0 && (
              <span className="text-ink-soft"> ({Math.round(summary.planned_savings_rate * 100)}%)</span>
            )}
            .
          </p>
        )}
      </Sheet>
    </Link>
  );
}

function BudgetInvite() {
  return (
    <Link
      href="/mais/orcamento"
      className="mt-4 flex items-center justify-between rounded-2xl border border-dashed border-rule px-4 py-3 text-sm hover:border-ink-faint"
    >
      <span>
        <strong className="font-semibold">Defina um orçamento</strong>
        <span className="text-ink-soft"> e veja quanto vão guardar no mês.</span>
      </span>
      <span aria-hidden className="text-ink-faint">›</span>
    </Link>
  );
}

function FixedTile({ items }: { items: Pick<RecurringMonth, "recurring_id" | "amount_cents" | "transaction_id">[] }) {
  const pending = items.filter((i) => !i.transaction_id);
  const pendingTotal = pending.reduce((s, i) => s + i.amount_cents, 0);
  return (
    <Link href="/mais/fixos" className="block" data-testid="fixed-tile">
      <Sheet className="h-full p-4 hover:border-ink-faint">
        <p className="text-sm text-ink-soft">Gastos fixos</p>
        <p className="mt-1 text-lg font-bold">
          {items.length - pending.length}/{items.length}
          <span className="text-sm font-medium text-ink-soft"> lançados</span>
        </p>
        <p className={cx("mt-1 text-xs", pending.length ? "font-medium text-amber" : "text-pine")}>
          {pending.length ? `Faltam ${formatBRL(pendingTotal)}` : "Tudo lançado"}
        </p>
      </Sheet>
    </Link>
  );
}

function CardsTile({ cards }: { cards: CardSummary[] }) {
  const owed = cards.reduce((s, c) => s + c.owed_cents, 0);
  const month = cards.reduce((s, c) => s + c.month_spent_cents, 0);
  return (
    <Link href="/mais/cartoes" className="block" data-testid="cards-tile">
      <Sheet className="h-full p-4 hover:border-ink-faint">
        <p className="text-sm text-ink-soft">{cards.length === 1 ? cards[0].name : "Cartões"}</p>
        <p className="mt-1 text-lg font-bold">{formatBRL(month)}</p>
        <p className="mt-1 text-xs text-ink-faint">
          no mês · <span className="font-medium text-debit">{formatBRL(owed)} a pagar</span>
        </p>
      </Sheet>
    </Link>
  );
}

function Welcome() {
  return (
    <Sheet className="mb-4 border-pine/40 bg-pine-soft p-5">
      <h2 className="font-semibold text-pine">Bem-vindos! Quatro passos para começar</h2>
      <ol className="mt-3 flex list-decimal flex-col gap-1.5 pl-5 text-sm">
        <li>
          Em <Link href="/mais/contas" className="font-medium underline underline-offset-2">Contas</Link>, informe o saldo de hoje de cada conta.
        </li>
        <li>
          <Link href="/lancar" className="font-medium underline underline-offset-2">Lance</Link> os salários do mês como Receita.
        </li>
        <li>
          Cadastre os <Link href="/mais/cartoes" className="font-medium underline underline-offset-2">cartões</Link> e os{" "}
          <Link href="/mais/fixos" className="font-medium underline underline-offset-2">gastos fixos</Link>.
        </li>
        <li>
          Convide quem divide as finanças com você em <Link href="/mais/familia" className="font-medium underline underline-offset-2">Família</Link>.
        </li>
      </ol>
    </Sheet>
  );
}
