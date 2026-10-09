"use client";

import { useActionState, useTransition } from "react";
import { saveAccount, setAccountArchived } from "@/actions/catalog";
import { formatAmount } from "@/lib/money";
import { ACCOUNT_KIND_LABEL, type Account, type AccountKind } from "@/types/db";
import { Button, Field, FormError, Input, Select, SubmitButton } from "@/components/ui";

export function AccountForm({ account, defaultDate }: { account?: Account; defaultDate?: string }) {
  const [state, action] = useActionState(saveAccount, undefined);
  const p = account?.id ?? "new";
  return (
    <form action={action} className="flex flex-col gap-3" key={account ? undefined : state?.at}>
      {account && <input type="hidden" name="id" value={account.id} />}
      <Field label="Nome" htmlFor={`n-${p}`}>
        <Input id={`n-${p}`} name="name" defaultValue={account?.name} placeholder="Nubank Augusto" maxLength={60} required />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Tipo" htmlFor={`k-${p}`}>
          <Select id={`k-${p}`} name="kind" defaultValue={account?.kind ?? "checking"}>
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
      <Field label="Saldo inicial (R$)" htmlFor={`i-${p}`} hint="Quanto tinha na conta na data “Desde”. Use − para saldo negativo.">
        <Input
          id={`i-${p}`}
          name="initial"
          inputMode="decimal"
          placeholder="0,00"
          defaultValue={account ? formatAmount(account.initial_balance_cents) : ""}
        />
      </Field>
      <FormError message={state?.error} />
      {state?.message && <p className="text-sm text-pine">{state.message}</p>}
      <SubmitButton variant={account ? "outline" : "primary"}>{account ? "Salvar conta" : "Criar conta"}</SubmitButton>
    </form>
  );
}

export function ArchiveButton({ id, archived }: { id: string; archived: boolean }) {
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      variant={archived ? "ghost" : "danger"}
      className="w-full"
      disabled={pending}
      onClick={() => start(async () => void (await setAccountArchived(id, !archived)))}
    >
      {archived ? "Reativar" : "Arquivar conta"}
    </Button>
  );
}
