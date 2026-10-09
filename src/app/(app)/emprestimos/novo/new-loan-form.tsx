"use client";

import { useActionState, useState } from "react";
import { createLoan } from "@/actions/loans";
import { formatBRL, maskFromDigits } from "@/lib/money";
import { Field, FormError, Input, Segmented, Select, SubmitButton } from "@/components/ui";

type Kind = "third_party" | "self";
type Acc = { id: string; name: string; kind: string };

export function NewLoanForm({ accounts, today, initialKind }: { accounts: Acc[]; today: string; initialKind: Kind }) {
  const [state, action] = useActionState(createLoan, undefined);
  const [kind, setKind] = useState<Kind>(initialKind);
  const [amount, setAmount] = useState({ text: "", cents: 0 });
  const [installments, setInstallments] = useState("1");

  const savings = accounts.find((a) => a.kind === "savings") ?? accounts[0];
  const checking = accounts.find((a) => a.kind === "checking") ?? accounts[0];
  const n = Math.max(1, Number(installments) || 1);

  return (
    <form action={action} className="flex flex-col gap-5">
      <Segmented<Kind>
        name="kind"
        value={kind}
        onChange={setKind}
        options={[
          { value: "third_party", label: "Para outra pessoa" },
          { value: "self", label: "Da nossa poupança" },
        ]}
      />
      <input type="hidden" name="principal_cents" value={amount.cents || ""} />

      <Field label={kind === "self" ? "Para quê?" : "Para quem?"} htmlFor="counterparty">
        <Input id="counterparty" name="counterparty" placeholder={kind === "self" ? "Notebook" : "João"} maxLength={80} required />
      </Field>

      <div className="grid grid-cols-[1fr_7rem] gap-3">
        <Field label="Valor (R$)" htmlFor="principal">
          <Input
            id="principal"
            inputMode="numeric"
            placeholder="0,00"
            value={amount.text}
            onChange={(e) => setAmount(maskFromDigits(e.target.value))}
            className="text-lg font-semibold"
          />
        </Field>
        <Field label="Parcelas" htmlFor="installments">
          <Input id="installments" name="installments" type="number" min={1} max={120} value={installments} onChange={(e) => setInstallments(e.target.value)} />
        </Field>
      </div>
      {amount.cents > 0 && n > 1 && (
        <p className="-mt-2 text-sm text-ink-soft">
          {n}× de {formatBRL(Math.floor(amount.cents / n))}
        </p>
      )}

      {kind === "third_party" ? (
        <Field label="Saiu de" htmlFor="from">
          <Select id="from" name="from_account" defaultValue={checking?.id}>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </Field>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tirou de" htmlFor="from">
            <Select id="from" name="from_account" defaultValue={savings?.id}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Foi para" htmlFor="to">
            <Select id="to" name="to_account" defaultValue={checking?.id === savings?.id ? "" : checking?.id}>
              <option value="">Escolha…</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      )}

      <Field label="Data" htmlFor="started_on">
        <Input id="started_on" name="started_on" type="date" defaultValue={today} required />
      </Field>

      <Field label="Observação (opcional)" htmlFor="notes">
        <Input id="notes" name="notes" maxLength={500} placeholder={kind === "self" ? "Devolver todo dia 10" : "Combinado pagar em 2 meses"} />
      </Field>

      <FormError message={state?.error} />
      <SubmitButton>{kind === "self" ? "Registrar autoempréstimo" : "Registrar empréstimo"}</SubmitButton>
    </form>
  );
}
