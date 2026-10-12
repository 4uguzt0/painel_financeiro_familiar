"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import { deleteRecurring, launchRecurring, saveRecurring, setRecurringActive } from "@/actions/recurring";
import { formatAmount, formatBRL, maskFromDigits } from "@/lib/money";
import { formatDateBR } from "@/lib/dates";
import { cx } from "@/lib/cx";
import type { Category, RecurringExpense, RecurringMonth } from "@/types/db";
import type { FormState } from "@/actions/auth";
import { Button, Field, FormError, Input, Select, Sheet, SubmitButton } from "@/components/ui";

type Acc = { id: string; name: string };

// ------------------------------------------------------------------ lançar o mês

export function LaunchList({ items }: { items: RecurringMonth[] }) {
  const pending = items.filter((i) => !i.transaction_id);
  const done = items.filter((i) => i.transaction_id);

  const [rows, setRows] = useState(() =>
    Object.fromEntries(pending.map((p) => [p.recurring_id, { checked: true, text: formatAmount(p.amount_cents), cents: p.amount_cents }])),
  );
  const [state, setState] = useState<FormState>();
  const [isPending, start] = useTransition();

  const selected = useMemo(() => pending.filter((p) => rows[p.recurring_id]?.checked), [pending, rows]);
  const total = selected.reduce((s, p) => s + (rows[p.recurring_id]?.cents ?? 0), 0);
  const doneTotal = done.reduce((s, d) => s + (d.launched_cents ?? 0), 0);

  return (
    <Sheet>
      <div className="flex items-center justify-between border-b border-rule px-4 py-3 text-sm">
        <span className="text-ink-soft">
          {done.length} de {items.length} lançados
        </span>
        <span className="font-medium">{formatBRL(doneTotal)}</span>
      </div>

      {pending.length > 0 && (
        <ul className="divide-y divide-rule">
          {pending.map((p) => {
            const row = rows[p.recurring_id];
            return (
              <li key={p.recurring_id} className="flex items-center gap-3 px-4 py-3">
                <input
                  type="checkbox"
                  aria-label={`Lançar ${p.name}`}
                  checked={row?.checked ?? false}
                  onChange={(e) => setRows((r) => ({ ...r, [p.recurring_id]: { ...r[p.recurring_id], checked: e.target.checked } }))}
                  className="size-5 shrink-0 accent-[var(--pine)]"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{p.name}</p>
                  <p className="truncate text-xs text-ink-faint">
                    vence {formatDateBR(p.due_on)} · {p.account}
                  </p>
                </div>
                <div className="flex w-28 shrink-0 items-baseline gap-1 rounded-lg border border-rule bg-sheet px-2 py-1.5 focus-within:border-ink">
                  <span className="text-xs text-ink-faint">R$</span>
                  <input
                    inputMode="numeric"
                    aria-label={`Valor de ${p.name}`}
                    value={row?.text ?? ""}
                    onChange={(e) => {
                      const m = maskFromDigits(e.target.value);
                      setRows((r) => ({ ...r, [p.recurring_id]: { ...r[p.recurring_id], ...m } }));
                    }}
                    className="w-full bg-transparent text-right text-sm font-semibold focus:outline-none"
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {done.length > 0 && (
        <ul className="divide-y divide-rule border-t border-rule">
          {done.map((d) => (
            <li key={d.recurring_id} className="flex items-center gap-3 px-4 py-2.5 text-sm text-ink-faint">
              <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden className="shrink-0 text-pine">
                <path d="M4.5 10.5l3.5 3.5 7.5-8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="flex-1 truncate">
                {d.name} · lançado em {formatDateBR(d.launched_on!)}
              </span>
              <span>{formatBRL(d.launched_cents)}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-2 border-t border-rule p-4">
        <FormError message={state?.error} />
        {state?.ok && <p className="rounded-xl bg-pine-soft px-3.5 py-2.5 text-sm font-medium text-pine">{state.message}</p>}
        {pending.length > 0 ? (
          <Button
            type="button"
            variant="pine"
            disabled={isPending || selected.length === 0}
            onClick={() =>
              start(async () => {
                const r = await launchRecurring(selected.map((p) => ({ id: p.recurring_id, amount_cents: rows[p.recurring_id].cents })));
                setState(r);
              })
            }
          >
            {isPending
              ? "Lançando…"
              : selected.length === 0
                ? "Selecione o que já foi pago"
                : `Lançar ${selected.length} ${selected.length === 1 ? "gasto" : "gastos"} · ${formatBRL(total)}`}
          </Button>
        ) : (
          <p className="text-center text-sm text-pine">Tudo lançado neste mês.</p>
        )}
        {pending.length > 0 && (
          <p className="text-center text-xs text-ink-faint">Ajuste os valores que mudaram (luz, água) antes de lançar.</p>
        )}
      </div>
    </Sheet>
  );
}

// ------------------------------------------------------------------ cadastro

export function RecurringForm({
  recurring,
  categories,
  accounts,
}: {
  recurring?: RecurringExpense;
  categories: Category[];
  accounts: Acc[];
}) {
  const [state, action] = useActionState(saveRecurring, undefined);
  const p = recurring?.id ?? "new";
  return (
    <form action={action} className="flex flex-col gap-3" key={recurring ? undefined : state?.at}>
      {recurring && <input type="hidden" name="id" value={recurring.id} />}
      <div className="grid grid-cols-[1fr_8rem] gap-3">
        <Field label="Nome" htmlFor={`rn-${p}`}>
          <Input id={`rn-${p}`} name="name" defaultValue={recurring?.name} placeholder="Aluguel" maxLength={60} required />
        </Field>
        <Field label="Valor (R$)" htmlFor={`ra-${p}`}>
          <Input
            id={`ra-${p}`}
            name="amount"
            inputMode="decimal"
            placeholder="0,00"
            defaultValue={recurring ? formatAmount(recurring.amount_cents) : ""}
            required
          />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Categoria" htmlFor={`rc-${p}`}>
          <Select id={`rc-${p}`} name="category_id" defaultValue={recurring?.category_id ?? ""} required>
            <option value="" disabled>
              Escolha…
            </option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Sai de" htmlFor={`rs-${p}`}>
          <Select id={`rs-${p}`} name="account_id" defaultValue={recurring?.account_id ?? accounts[0]?.id}>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Dia do vencimento" htmlFor={`rd-${p}`} hint="Se o mês não tiver esse dia (ex.: 31), usa o último dia do mês.">
        <Input id={`rd-${p}`} name="day_of_month" type="number" min={1} max={31} defaultValue={recurring?.day_of_month ?? 10} required />
      </Field>
      <FormError message={state?.error} />
      {state?.message && <p className="text-sm text-pine">{state.message}</p>}
      <SubmitButton variant={recurring ? "outline" : "primary"}>{recurring ? "Salvar" : "Cadastrar gasto fixo"}</SubmitButton>
    </form>
  );
}

export function RecurringRowActions({ id, active }: { id: string; active: boolean }) {
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="mt-2 flex gap-2">
      <Button
        type="button"
        variant="ghost"
        className="flex-1"
        disabled={pending}
        onClick={() => start(async () => void (await setRecurringActive(id, !active)))}
      >
        {active ? "Pausar" : "Reativar"}
      </Button>
      <Button
        type="button"
        variant="danger"
        className={cx("flex-1", confirm && "bg-debit text-sheet hover:bg-debit")}
        disabled={pending}
        onClick={() => (confirm ? start(async () => void (await deleteRecurring(id))) : setConfirm(true))}
      >
        {confirm ? "Confirmar exclusão" : "Excluir"}
      </Button>
    </div>
  );
}
