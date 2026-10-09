"use client";

import { useState, useTransition } from "react";
import { deleteTransaction } from "@/actions/transactions";
import { Button, FormError } from "@/components/ui";

export function DeleteTransactionButton({ id, backTo, label = "Excluir lançamento" }: { id: string; backTo: string; label?: string }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!confirming) {
    return (
      <Button type="button" variant="danger" className="w-full" onClick={() => setConfirming(true)}>
        {label}
      </Button>
    );
  }
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-debit-soft p-3">
      <p className="text-sm text-debit">Excluir de vez? Os saldos são recalculados na hora.</p>
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
              const r = await deleteTransaction(id, backTo);
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
