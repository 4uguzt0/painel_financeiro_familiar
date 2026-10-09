"use client";

import { useActionState, useState, useTransition } from "react";
import { createInvite, renameHousehold } from "@/actions/household";
import { Button, Field, FormError, Input, SubmitButton } from "@/components/ui";

export function RenameForm({ name }: { name: string }) {
  const [state, action] = useActionState(renameHousehold, undefined);
  return (
    <form action={action} className="flex flex-col gap-3">
      <Field label="Nome da família" htmlFor="hname">
        <Input id="hname" name="name" defaultValue={name} maxLength={80} required />
      </Field>
      <FormError message={state?.error} />
      {state?.message && <p className="text-sm text-pine">{state.message}</p>}
      <SubmitButton variant="outline">Salvar nome</SubmitButton>
    </form>
  );
}

export function InviteBox() {
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  return (
    <div className="mt-4 flex flex-col gap-3">
      {code && (
        <div className="flex items-center justify-between rounded-xl border border-dashed border-ink-faint px-4 py-3">
          <span className="text-2xl font-bold tracking-[0.2em]" data-testid="invite-code">
            {code}
          </span>
          <Button
            variant="ghost"
            type="button"
            onClick={async () => {
              await navigator.clipboard?.writeText(code).catch(() => {});
              setCopied(true);
            }}
          >
            {copied ? "Copiado" : "Copiar"}
          </Button>
        </div>
      )}
      <FormError message={error} />
      <Button
        variant="outline"
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await createInvite();
            setError(r.error ?? null);
            setCode(r.code ?? null);
            setCopied(false);
          })
        }
      >
        {pending ? "Gerando…" : code ? "Gerar outro código" : "Gerar código de convite"}
      </Button>
    </div>
  );
}
