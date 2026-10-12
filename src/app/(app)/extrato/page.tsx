import type { Metadata } from "next";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { getFormOptions } from "@/lib/queries";
import { currentMonth, dayHeading, isValidMonth, monthLabel, monthRange, shiftMonth, todayISO } from "@/lib/dates";
import { formatBRL } from "@/lib/money";
import { TYPE_LABEL, type Transaction, type TransactionType } from "@/types/db";
import { ButtonLink, EmptyState, PageHeader, Sheet } from "@/components/ui";
import { cx } from "@/lib/cx";

export const metadata: Metadata = { title: "Extrato" };

const FILTERS = [
  { value: "todos", label: "Tudo" },
  { value: "despesas", label: "Despesas" },
  { value: "receitas", label: "Receitas" },
  { value: "movimentos", label: "Entre contas e empréstimos" },
] as const;
type Filter = (typeof FILTERS)[number]["value"];

const FILTER_TYPES: Record<Filter, TransactionType[] | null> = {
  todos: null,
  despesas: ["expense"],
  receitas: ["income"],
  movimentos: ["transfer", "loan_out", "loan_in", "self_loan_out", "self_loan_return"],
};

export default async function StatementPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; filtro?: string; conta?: string }>;
}) {
  const sp = await searchParams;
  const month = isValidMonth(sp.mes) ? sp.mes : currentMonth();
  const filter: Filter = (FILTERS.find((f) => f.value === sp.filtro)?.value ?? "todos") as Filter;
  const { start, end } = monthRange(month);

  const { supabase } = await getSession();
  let q = supabase
    .from("transactions")
    .select("id, occurred_on, type, amount_cents, description, category_id, from_account_id, to_account_id, loan_id")
    .gte("occurred_on", start)
    .lt("occurred_on", end)
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false });
  const types = FILTER_TYPES[filter];
  if (types) q = q.in("type", types);
  const accountFilter = sp.conta && /^[0-9a-f-]{36}$/i.test(sp.conta) ? sp.conta : null;
  if (accountFilter) q = q.or(`from_account_id.eq.${accountFilter},to_account_id.eq.${accountFilter}`);

  const [{ data }, { allAccounts, categories }] = await Promise.all([q, getFormOptions(supabase)]);
  const filteredAccount = accountFilter ? allAccounts.find((a) => a.id === accountFilter) : null;
  const cardIds = new Set(allAccounts.filter((a) => a.kind === "credit_card").map((a) => a.id));
  const rows = (data ?? []) as Transaction[];
  const accName = new Map(allAccounts.map((a) => [a.id, a.name]));
  const catName = new Map(categories.map((c) => [c.id, c.name]));

  const income = rows.filter((r) => r.type === "income").reduce((s, r) => s + r.amount_cents, 0);
  const expense = rows.filter((r) => r.type === "expense").reduce((s, r) => s + r.amount_cents, 0);

  const days = new Map<string, Transaction[]>();
  for (const r of rows) days.set(r.occurred_on, [...(days.get(r.occurred_on) ?? []), r]);
  const today = todayISO();
  const href = (m: string, f: Filter = filter) =>
    `/extrato?mes=${m}${f !== "todos" ? `&filtro=${f}` : ""}${accountFilter ? `&conta=${accountFilter}` : ""}`;

  return (
    <>
      <PageHeader title="Extrato" />
      {filteredAccount && (
        <div className="-mt-2 mb-4 flex items-center justify-between rounded-xl bg-rule/50 px-3.5 py-2 text-sm">
          <span>
            Só <strong className="font-semibold">{filteredAccount.name}</strong>
          </span>
          <Link href={`/extrato?mes=${month}`} className="font-medium text-ink-soft underline underline-offset-2">
            Ver tudo
          </Link>
        </div>
      )}

      <div className="mb-4 flex items-center justify-between">
        <Link href={href(shiftMonth(month, -1))} className="grid size-10 place-items-center rounded-full hover:bg-rule/50" aria-label="Mês anterior">
          <Chevron dir="left" />
        </Link>
        <p className="font-semibold first-letter:uppercase">{monthLabel(month)}</p>
        <Link
          href={href(shiftMonth(month, 1))}
          aria-label="Próximo mês"
          className={cx("grid size-10 place-items-center rounded-full hover:bg-rule/50", month >= currentMonth() && "pointer-events-none opacity-30")}
        >
          <Chevron dir="right" />
        </Link>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3">
        <Sheet className="px-4 py-3">
          <p className="text-xs text-ink-soft">Entrou</p>
          <p className="text-lg font-bold text-pine">{formatBRL(income)}</p>
        </Sheet>
        <Sheet className="px-4 py-3">
          <p className="text-xs text-ink-soft">Gastou</p>
          <p className="text-lg font-bold">{formatBRL(expense)}</p>
        </Sheet>
      </div>

      <nav aria-label="Filtrar" className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={href(month, f.value)}
            aria-current={filter === f.value ? "true" : undefined}
            className={cx(
              "shrink-0 rounded-full border px-3.5 py-1.5 text-sm",
              filter === f.value ? "border-ink bg-ink text-paper" : "border-rule bg-sheet text-ink-soft",
            )}
          >
            {f.label}
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <EmptyState title="Nada lançado neste mês" action={<ButtonLink href="/lancar">Lançar movimentação</ButtonLink>}>
          Lance o total de cada ida ao mercado, as contas fixas e a fatura do cartão por categoria.
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-5">
          {[...days.entries()].map(([day, items]) => (
            <section key={day}>
              <h2 className="mb-2 px-1 text-sm font-medium text-ink-soft first-letter:uppercase">{dayHeading(day, today)}</h2>
              <Sheet className="divide-y divide-rule">
                {items.map((t) => (
                  <Row key={t.id} t={t} accName={accName} catName={catName} cardIds={cardIds} />
                ))}
              </Sheet>
            </section>
          ))}
        </div>
      )}
    </>
  );
}

function Row({
  t,
  accName,
  catName,
  cardIds,
}: {
  t: Transaction;
  accName: Map<string, string>;
  catName: Map<string, string>;
  cardIds: Set<string>;
}) {
  const from = t.from_account_id ? accName.get(t.from_account_id) : null;
  const to = t.to_account_id ? accName.get(t.to_account_id) : null;
  const isBillPayment = t.type === "transfer" && !!t.to_account_id && cardIds.has(t.to_account_id);
  const title =
    t.description ||
    (t.category_id ? catName.get(t.category_id) : null) ||
    (isBillPayment ? "Pagamento de fatura" : TYPE_LABEL[t.type]);

  let sub: string;
  if (t.type === "income") sub = `${catName.get(t.category_id!) ?? "Receita"} · ${to}`;
  else if (t.type === "expense") sub = `${catName.get(t.category_id!) ?? "Despesa"} · ${from}`;
  else if (from && to) sub = `${from} → ${to}`;
  else sub = `${TYPE_LABEL[t.type]} · ${from ?? to}`;

  const sign = t.type === "income" ? "+" : t.type === "expense" ? "−" : "";
  const href = t.loan_id ? `/emprestimos/${t.loan_id}` : `/extrato/${t.id}`;

  return (
    <Link href={href} className="flex items-center gap-3 px-4 py-3 first:rounded-t-2xl last:rounded-b-2xl hover:bg-paper">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{title}</p>
        <p className="truncate text-xs text-ink-faint">{sub}</p>
      </div>
      <span className={cx("shrink-0 font-semibold", t.type === "income" ? "text-pine" : t.type === "expense" ? "text-ink" : "text-ink-soft")}>
        {sign}
        {formatBRL(t.amount_cents)}
      </span>
    </Link>
  );
}

function Chevron({ dir }: { dir: "left" | "right" }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d={dir === "left" ? "M12.5 4.5L7 10l5.5 5.5" : "M7.5 4.5L13 10l-5.5 5.5"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
