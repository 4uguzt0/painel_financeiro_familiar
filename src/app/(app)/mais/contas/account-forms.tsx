"use client";

import { useActionState, useState, useTransition } from "react";
import { saveAccount, setAccountArchived } from "@/actions/catalog";
import { formatAmount } from "@/lib/money";
import { ACCOUNT_KIND_LABEL, type Account, type AccountKind } from "@/types/db";
import { Button, Field, FormError, Input, Select, SubmitButton } from "@/components/ui";

export function AccountForm({
  account,
  defaultDate,
  defaultKind = "checking",
}: {
  account?: Account;
  defaultDate?: string;
  defaultKind?: AccountKind;
}) {
  const [state, action] = useActionState(saveAccount, undefined);
  const [kind, setKind] = useState<AccountKind>(account?.kind ?? defaultKind);
  const p = account?.id ?? `new-${defaultKind}`;
  const isCard = kind === "credit_card";

  // Cartão: mostramos o valor devido como positivo (no banco fica negativo)
  const initialText = account
    ? formatAmount(account.kind === "credit_card" ? -account.initial_balance_cents : account.initial_balance_cents)
    : "";

  return (
    <form action={action} className="flex flex-col gap-3" key={account ? undefined : state?.at}>
      {account && <input type="hidden" name="id" value={account.id} />}
      <Field label="Nome" htmlFor={`n-${p}`}>
        <Input
          id={`n-${p}`}
          name="name"
          defaultValue={account?.name}
          placeholder={isCard ? "Cartão Nubank" : "Conta Augusto"}
          maxLength={60}
          required
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Tipo" htmlFor={`k-${p}`}>
          <Select id={`k-${p}`} name="kind" value={kind} onChange={(e) => setKind(e.target.value as AccountKind)}>
            {(Object.keys(ACCOUNT_KIND_LABEL) as AccountKind[]).map((k) => (
              <option key={k} value={k}>
                {ACCOUNT_KIND_LABEL[k]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Desde" htmlFor={`d-${p}`}>
          <Input id={`d-${p}`} name="opened_on" type="date" defaultValue={account?.opened_on ?? defaultDate} required />
        </Field>
      </div>
      {isCard ? (
        <Field
          label="Quanto deve no cartão (R$)"
          htmlFor={`i-${p}`}
          hint="O “limite usado” no app do banco na data “Desde”: fatura atual + parcelas futuras. Use 0 se não deve nada."
        >
          <Input id={`i-${p}`} name="initial" inputMode="decimal" placeholder="0,00" defaultValue={initialText} />
        </Field>
      ) : (
        <Field label="Saldo inicial (R$)" htmlFor={`i-${p}`} hint="Quanto tinha na conta na data “Desde”. Use − para saldo negativo.">
          <Input id={`i-${p}`} name="initial" inputMode="decimal" placeholder="0,00" defaultValue={initialText} />
        </Field>
      )}
      <FormError message={state?.error} />
      {state?.message && <p className="text-sm text-pine">{state.message}</p>}
      <SubmitButton variant={account ? "outline" : "primary"}>
        {account ? "Salvar" : isCard ? "Adicionar cartão" : "Criar conta"}
      </SubmitButton>
    </form>
  );
}

export function ArchiveButton({ id, archived, label = "Arquivar" }: { id: string; archived: boolean; label?: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      variant={archived ? "ghost" : "danger"}
      className="w-full"
      disabled={pending}
      onClick={() => start(async () => void (await setAccountArchived(id, !archived)))}
    >
      {archived ? "Reativar" : label}
    </Button>
  );
}
