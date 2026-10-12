"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { saveTransaction } from "@/actions/transactions";
import { maskFromDigits, formatAmount } from "@/lib/money";
import type { Category, Transaction } from "@/types/db";
import { ChipGroup, FormError, Input, Segmented, Select, SubmitButton } from "@/components/ui";
import { cx } from "@/lib/cx";

type Kind = "expense" | "income" | "transfer";
type AccountOpt = { id: string; name: string; kind?: string };
export type TransactionPreset = { type?: Kind; toAccountId?: string; amountCents?: number };

const LAST_ACCOUNT_KEY = "caderneta:last-account";

function readLast(): string | null {
  try {
    return localStorage.getItem(LAST_ACCOUNT_KEY);
  } catch {
    return null;
  }
}
function writeLast(id: string) {
  try {
    localStorage.setItem(LAST_ACCOUNT_KEY, id);
  } catch {
    /* navegação privada: tudo bem */
  }
}

export function TransactionForm({
  categories,
  accounts,
  today,
  initial,
  preset,
}: {
  categories: Category[];
  accounts: AccountOpt[];
  today: string;
  initial?: Transaction;
  preset?: TransactionPreset;
}) {
  const [state, action] = useActionState(saveTransaction, undefined);
  const isEdit = !!initial;

  const [kind, setKind] = useState<Kind>((initial?.type as Kind) ?? preset?.type ?? "expense");
  const [amount, setAmount] = useState(() => {
    const cents = initial?.amount_cents ?? preset?.amountCents;
    return cents ? { text: formatAmount(cents), cents } : { text: "", cents: 0 };
  });
  const [categoryId, setCategoryId] = useState(initial?.category_id ?? "");
  const [accountId, setAccountId] = useState(
    (initial?.type === "income" ? initial.to_account_id : initial?.from_account_id) ?? accounts[0]?.id ?? "",
  );
  const [toAccountId, setToAccountId] = useState(initial?.to_account_id ?? preset?.toAccountId ?? "");
  const [date, setDate] = useState(initial?.occurred_on ?? today);
  const [description, setDescription] = useState(initial?.description ?? "");
  const amountRef = useRef<HTMLInputElement>(null);

  // Lembra a última conta usada (só em lançamentos novos)
  useEffect(() => {
    if (isEdit) return;
    const last = readLast();
    const target = preset?.toAccountId;
    if (last && last !== target && accounts.some((a) => a.id === last)) setAccountId(last);
    else if (target) {
      // Pagamento de fatura: origem padrão = primeira conta que não é cartão
      const from = accounts.find((a) => a.id !== target && a.kind !== "credit_card");
      if (from) setAccountId(from.id);
    }
  }, [isEdit, accounts, preset?.toAccountId]);

  // Depois de salvar: limpa valor/categoria/descrição e volta o foco ao valor
  useEffect(() => {
    if (!state?.ok || isEdit) return;
    setAmount({ text: "", cents: 0 });
    setCategoryId("");
    setDescription("");
    amountRef.current?.focus();
  }, [state?.at, state?.ok, isEdit]);

  const catOptions = useMemo(
    () =>
      categories
        .filter((c) => c.kind === (kind === "income" ? "income" : "expense") && (!c.archived || c.id === categoryId))
        .map((c) => ({ value: c.id, label: c.name })),
    [categories, kind, categoryId],
  );
  const accOptions = accounts.map((a) => ({ value: a.id, label: a.name }));

  const saveLabel = { expense: "Salvar despesa", income: "Salvar receita", transfer: "Salvar transferência" }[kind];

  return (
    <form
      action={(fd) => {
        writeLast(accountId);
        return action(fd);
      }}
      className="flex flex-col gap-6"
    >
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <input type="hidden" name="amount_cents" value={amount.cents || ""} />

      <div>
        <label htmlFor="amount" className="text-sm font-medium text-ink-soft">
          Valor
        </label>
        <div className="mt-1 flex items-baseline gap-2 border-b-2 border-rule pb-2 transition-colors focus-within:border-ink">
          <span className="text-2xl font-semibold text-ink-soft">R$</span>
          <input
            ref={amountRef}
            id="amount"
            inputMode="numeric"
            autoComplete="off"
            autoFocus={!isEdit}
            placeholder="0,00"
            value={amount.text}
            onChange={(e) => setAmount(maskFromDigits(e.target.value))}
            className={cx(
              "w-full bg-transparent text-[2.75rem] leading-none font-bold tracking-tight placeholder:text-rule focus:outline-none focus-visible:outline-none",
              kind === "income" && "text-pine",
            )}
          />
        </div>
      </div>

      <Segmented<Kind>
        name="type"
        value={kind}
        onChange={(k) => {
          setKind(k);
          setCategoryId("");
        }}
        options={[
          { value: "expense", label: "Despesa" },
          { value: "income", label: "Receita" },
          { value: "transfer", label: "Transferência" },
        ]}
      />

      {kind !== "transfer" && (
        <ChipGroup name="category_id" label="Categoria" value={categoryId} onChange={setCategoryId} options={catOptions} />
      )}

      {kind === "transfer" ? (
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="from" className="text-sm font-medium text-ink-soft">
              De
            </label>
            <Select id="from" name="account_id" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="to" className="text-sm font-medium text-ink-soft">
              Para
            </label>
            <Select id="to" name="to_account_id" value={toAccountId} onChange={(e) => setToAccountId(e.target.value)}>
              <option value="">Escolha…</option>
              {accounts
                .filter((a) => a.id !== accountId)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
            </Select>
          </div>
          <p className="col-span-2 text-xs text-ink-faint">
            {accounts.find((a) => a.id === toAccountId)?.kind === "credit_card"
              ? "Pagamento de fatura: as compras já entraram como gasto, então isso não conta de novo."
              : "Use para guardar na poupança, aplicar ou resgatar investimentos. Não conta como gasto."}
          </p>
        </div>
      ) : (
        <ChipGroup
          name="account_id"
          label={kind === "income" ? "Entrou em" : "Saiu de"}
          value={accountId}
          onChange={setAccountId}
          options={accOptions}
        />
      )}

      <div className="grid grid-cols-[1fr_auto] gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="description" className="text-sm font-medium text-ink-soft">
            Descrição <span className="font-normal text-ink-faint">(opcional)</span>
          </label>
          <Input id="description" name="description" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={140} placeholder={kind === "expense" ? "Mercado do mês" : ""} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="date" className="text-sm font-medium text-ink-soft">
            Data
          </label>
          <Input id="date" name="occurred_on" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-[9.5rem]" required />
        </div>
      </div>

      <FormError message={state?.error} />
      {state?.ok && state.message && (
        <p role="status" className="rounded-xl bg-pine-soft px-3.5 py-2.5 text-sm font-medium text-pine">
          {state.message} Pode lançar a próxima.
        </p>
      )}
      {state?.ok && state.warning && (
        <p role="alert" data-testid="budget-warning" className="flex gap-2 rounded-xl bg-amber-soft px-3.5 py-2.5 text-sm font-medium text-amber">
          <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden className="mt-px shrink-0">
            <path d="M10 3.5l7 12.5H3L10 3.5z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
            <path d="M10 8.5v3.2M10 14h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          <span>{state.warning}</span>
        </p>
      )}

      <SubmitButton variant={kind === "income" ? "pine" : "primary"}>{isEdit ? "Salvar alterações" : saveLabel}</SubmitButton>
    </form>
  );
}
