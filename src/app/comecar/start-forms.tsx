"use client";

import { useActionState } from "react";
import { createHousehold, joinHousehold } from "@/actions/household";
import { Field, FormError, Input, Sheet, SubmitButton } from "@/components/ui";

export function StartForms() {
  const [createState, createAction] = useActionState(createHousehold, undefined);
  const [joinState, joinAction] = useActionState(joinHousehold, undefined);

  return (
    <div className="mt-8 flex flex-col gap-4">
      <Sheet className="p-5">
        <h2 className="font-semibold">Criar a família</h2>
        <p className="mt-1 text-sm text-ink-soft">Já vem com contas e categorias prontas. Dá para mudar depois.</p>
        <form action={createAction} className="mt-4 flex flex-col gap-3">
          <Field label="Nome" htmlFor="name">
            <Input id="name" name="name" placeholder="Família Silva" required maxLength={80} />
          </Field>
          <FormError message={createState?.error} />
          <SubmitButton pending="Criando…">Criar família</SubmitButton>
        </form>
      </Sheet>

      <Sheet className="p-5">
        <h2 className="font-semibold">Tenho um código de convite</h2>
        <p className="mt-1 text-sm text-ink-soft">Peça para quem criou a família gerar um em Mais → Família.</p>
        <form action={joinAction} className="mt-4 flex flex-col gap-3">
          <Field label="Código" htmlFor="code">
            <Input id="code" name="code" placeholder="A1B2C3D4" autoCapitalize="characters" autoComplete="off" className="uppercase tracking-[0.15em]" required />
          </Field>
          <FormError message={joinState?.error} />
          <SubmitButton variant="outline" pending="Entrando…">
            Entrar na família
          </SubmitButton>
        </form>
      </Sheet>
    </div>
  );
}
