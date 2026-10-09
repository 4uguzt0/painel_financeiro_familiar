"use client";

import { useActionState, useState } from "react";
import { signIn, signUp } from "@/actions/auth";
import { Field, FormError, Input, Segmented, SubmitButton } from "@/components/ui";

type Mode = "entrar" | "criar";

export function AuthForm() {
  const [mode, setMode] = useState<Mode>("entrar");
  const [signInState, signInAction] = useActionState(signIn, undefined);
  const [signUpState, signUpAction] = useActionState(signUp, undefined);
  const state = mode === "entrar" ? signInState : signUpState;

  return (
    <div className="flex flex-col gap-5">
      <Segmented<Mode>
        name="mode"
        value={mode}
        onChange={setMode}
        options={[
          { value: "entrar", label: "Entrar" },
          { value: "criar", label: "Criar conta" },
        ]}
      />
      <form action={mode === "entrar" ? signInAction : signUpAction} className="flex flex-col gap-4" key={mode}>
        <Field label="E-mail" htmlFor="email">
          <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" required />
        </Field>
        <Field label="Senha" htmlFor="password" hint={mode === "criar" ? "Mínimo de 6 caracteres." : undefined}>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete={mode === "entrar" ? "current-password" : "new-password"}
            minLength={6}
            required
          />
        </Field>
        <FormError message={state?.error} />
        {state?.message && <p className="rounded-xl bg-pine-soft px-3.5 py-2.5 text-sm text-pine">{state.message}</p>}
        <SubmitButton pending={mode === "entrar" ? "Entrando…" : "Criando…"}>
          {mode === "entrar" ? "Entrar" : "Criar conta"}
        </SubmitButton>
      </form>
    </div>
  );
}
