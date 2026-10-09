"use client";

import { useActionState, useState, useTransition } from "react";
import { saveCategory, setCategoryArchived } from "@/actions/catalog";
import type { Category, CategoryKind } from "@/types/db";
import { Button, FormError, Input, SubmitButton } from "@/components/ui";

export function CategoryRow({ category, compact }: { category: Category; compact?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [state, action] = useActionState(saveCategory, undefined);
  const [pending, start] = useTransition();

  if (compact) {
    return (
      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => void (await setCategoryArchived(category.id, false)))}
        className="rounded-full border border-dashed border-rule px-3 py-1.5 text-sm text-ink-faint hover:text-ink"
        title="Reativar"
      >
        {category.name} · reativar
      </button>
    );
  }

  if (editing && !state?.ok) {
    return (
      <form action={action} className="flex flex-col gap-2 px-4 py-3">
        <input type="hidden" name="id" value={category.id} />
        <input type="hidden" name="kind" value={category.kind} />
        <div className="flex gap-2">
          <Input name="name" defaultValue={category.name} maxLength={40} required autoFocus className="h-10" />
          <SubmitButton variant="outline" className="h-10 shrink-0">
            Salvar
          </SubmitButton>
        </div>
        <FormError message={state?.error} />
        <div className="flex justify-between">
          <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant="danger"
            disabled={pending}
            onClick={() => start(async () => void (await setCategoryArchived(category.id, true)))}
          >
            Arquivar
          </Button>
        </div>
      </form>
    );
  }

  return (
    <button type="button" onClick={() => setEditing(true)} className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-paper">
      <span>{category.name}</span>
      <span className="text-xs text-ink-faint">editar</span>
    </button>
  );
}

export function NewCategoryForm({ kind }: { kind: CategoryKind }) {
  const [state, action] = useActionState(saveCategory, undefined);
  return (
    <form action={action} className="flex flex-col gap-2" key={state?.at}>
      <input type="hidden" name="kind" value={kind} />
      <div className="flex gap-2">
        <Input name="name" placeholder={kind === "expense" ? "Nova categoria de despesa" : "Nova categoria de receita"} maxLength={40} required className="h-10" />
        <SubmitButton variant="outline" className="h-10 shrink-0" pending="…">
          Adicionar
        </SubmitButton>
      </div>
      <FormError message={state?.error} />
    </form>
  );
}
