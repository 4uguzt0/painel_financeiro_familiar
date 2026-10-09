"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { deleteLoan, registerPayment } from "@/actions/loans";
import { deleteTransaction } from "@/actions/transactions";
import { formatAmount, maskFromDigits } from "@/lib/money";
import { Button, Field, FormError, Input, Select, SubmitButton } from "@/components/ui";

type Acc = { id: string; name: string };

export function PaymentForm({
  loanId,
  kind,
  suggested,
  today,
  accounts,
  defaultAccount,
  defaultSavings,
}: {
  loanId: string;
  kind: "third_party" | "self";
  suggested: number;
  today: string;
  accounts: Acc[];
  defaultAccount?: string;
  defaultSavings?: string;
}) {
  const [state, action] = useActionState(registerPayment, undefined);
  const [amount, setAmount] = useState({ text: formatAmount(suggested), cents: suggested });
  useEffect(() => {
    if (state?.ok) setAmount({ text: formatAmount(suggested), cents: suggested });
  }, [state?.at, state?.ok, suggested]);
  const isSelf = kind === "self";

  return (
    <form action={action} className="mt-4 flex flex-col gap-3">
      <input type="hidden" name="loan_id" value={loanId} />
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="amount_cents" value={amount.cents || ""} />
      <div className="grid grid-cols-[1fr_9.5rem] gap-3">
        <Field label="Valor (R$)" htmlFor="pay-amount">
          <Input id="pay-amount" inputMode="numeric" value={amount.text} onChange={(e) => setAmount(maskFromDigits(e.target.value))} className="font-semibold" />
        </Field>
        <Field label="Data" htmlFor="pay-date">
          <Input id="pay-date" name="occurred_on" type="date" defaultValue={today} required />
        </Field>
      </div>
      {isSelf ? (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Saiu de" htmlFor="pay-from">
            <AccountSelect id="pay-from" name="account_id" accounts={accounts} defaultValue={defaultAccount} />
          </Field>
          <Field label="Volta para" htmlFor="pay-to">
            <AccountSelect id="pay-to" name="savings_account_id" accounts={accounts} defaultValue={defaultSavings} />
          </Field>
        </div>
      ) : (
        <Field label="Entrou em" htmlFor="pay-to">
          <AccountSelect id="pay-to" name="account_id" accounts={accounts} defaultValue={defaultAccount} />
        </Field>
      )}
      <FormError message={state?.error} />
      {state?.message && <p className="text-sm font-medium text-pine">{state.message}</p>}
      <SubmitButton variant="pine">{isSelf ? "Registrar devolução" : "Registrar recebimento"}</SubmitButton>
    </form>
  );
}

function AccountSelect({ accounts, ...props }: { accounts: Acc[]; id: string; name: string; defaultValue?: string }) {
  return (
    <Select {...props}>
      {accounts.map((a) => (
        <option key={a.id} value={a.id}>
          {a.name}
        </option>
      ))}
    </Select>
  );
}

export function DeletePaymentButton({ id, loanId }: { id: string; loanId: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      aria-label="Excluir este registro"
      title="Excluir este registro"
      disabled={pending}
      onClick={() => {
        if (confirm("Excluir este registro?")) start(async () => void (await deleteTransaction(id, `/emprestimos/${loanId}`)));
      }}
      className="grid size-8 place-items-center rounded-full text-ink-faint hover:bg-debit-soft hover:text-debit"
    >
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
        <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    </button>
  );
}

export function DeleteLoanButton({ id }: { id: string }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (!confirming)
    return (
      <Button type="button" variant="danger" className="w-full" onClick={() => setConfirming(true)}>
        Excluir empréstimo
      </Button>
    );
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-debit-soft p-3">
      <p className="text-sm text-debit">Isso apaga o empréstimo e todo o histórico de pagamentos dele. Os saldos voltam ao que eram antes.</p>
      <FormError message={error} />
      <div className="flex gap-2">
        <Button type="button" variant="ghost" className="flex-1" onClick={() => setConfirming(false)}>
          Cancelar
        </Button>
        <Button
          type="button"
          className="flex-1 bg-debit text-sheet"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await deleteLoan(id);
              if (r?.error) setError(r.error);
            })
          }
        >
          {pending ? "Excluindo…" : "Excluir"}
        </Button>
      </div>
    </div>
  );
}
