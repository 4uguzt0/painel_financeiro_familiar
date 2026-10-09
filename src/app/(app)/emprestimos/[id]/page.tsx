import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { sortAccounts } from "@/lib/queries";
import type { AccountKind } from "@/types/db";
import { formatBRL } from "@/lib/money";
import { formatDateBR, todayISO } from "@/lib/dates";
import { TYPE_LABEL, type LoanStatus, type Transaction } from "@/types/db";
import { PageHeader, Sheet } from "@/components/ui";
import { cx } from "@/lib/cx";
import { DeleteLoanButton, DeletePaymentButton, PaymentForm } from "./loan-forms";

export const metadata: Metadata = { title: "Empréstimo" };

export default async function LoanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { supabase } = await getSession();

  const [{ data: loanData }, { data: txData }, { data: accData }, { data: notesData }] = await Promise.all([
    supabase.from("v_loan_status").select("*").eq("loan_id", id).maybeSingle(),
    supabase.from("transactions").select("*").eq("loan_id", id).order("occurred_on").order("created_at"),
    supabase.from("accounts").select("id, name, kind, archived"),
    supabase.from("loans").select("notes").eq("id", id).maybeSingle(),
  ]);
  if (!loanData) notFound();
  const loan = loanData as LoanStatus;
  const txs = (txData ?? []) as Transaction[];
  const accounts = sortAccounts((accData ?? []) as { id: string; name: string; kind: AccountKind; archived: boolean }[]);
  const accName = new Map(accounts.map((a) => [a.id, a.name]));
  const isSelf = loan.kind === "self";
  const origin = txs.find((t) => t.type === "loan_out" || t.type === "self_loan_out");
  const pct = Math.round((loan.repaid_cents / loan.principal_cents) * 100);
  const paidCount = txs.filter((t) => t.type === "loan_in" || t.type === "self_loan_return").length;

  return (
    <>
      <PageHeader title={loan.counterparty} back={isSelf ? "/emprestimos?aba=poupanca" : "/emprestimos"} />
      <p className="-mt-3 mb-5 text-sm text-ink-soft">
        {isSelf ? "Autoempréstimo da poupança" : "Empréstimo concedido"} em {formatDateBR(loan.started_on)}
        {notesData?.notes ? ` · ${notesData.notes}` : ""}
      </p>

      <Sheet className="p-5">
        <p className="text-sm text-ink-soft">{isSelf ? "Falta devolver" : "Falta receber"}</p>
        <p className={cx("text-4xl font-bold tracking-tight", loan.status === "paid" ? "text-pine" : "text-ink")} data-testid="loan-outstanding">
          {loan.status === "paid" ? "Quitado" : formatBRL(loan.outstanding_cents)}
        </p>
        <div className="mt-4 h-2 rounded-full bg-rule/60">
          <div className="h-full rounded-full bg-pine" style={{ width: `${pct}%` }} />
        </div>
        <dl className="mt-4 grid grid-cols-3 gap-2 text-sm">
          <div>
            <dt className="text-ink-faint">Valor</dt>
            <dd className="font-semibold">{formatBRL(loan.principal_cents)}</dd>
          </div>
          <div>
            <dt className="text-ink-faint">{isSelf ? "Devolvido" : "Recebido"}</dt>
            <dd className="font-semibold text-pine">{formatBRL(loan.repaid_cents)}</dd>
          </div>
          <div>
            <dt className="text-ink-faint">Parcelas</dt>
            <dd className="font-semibold">
              {paidCount} de {loan.installments}
            </dd>
            <dd className="text-xs text-ink-faint">{formatBRL(loan.installment_cents)} cada</dd>
          </div>
        </dl>
      </Sheet>

      {loan.status !== "paid" && (
        <Sheet className="mt-4 p-5">
          <h2 className="font-semibold">{isSelf ? "Registrar devolução" : "Registrar recebimento"}</h2>
          <PaymentForm
            loanId={loan.loan_id}
            kind={loan.kind}
            suggested={Math.min(loan.installment_cents, loan.outstanding_cents)}
            today={todayISO()}
            accounts={accounts.filter((a) => !a.archived)}
            defaultAccount={isSelf ? origin?.to_account_id ?? undefined : origin?.from_account_id ?? undefined}
            defaultSavings={isSelf ? origin?.from_account_id ?? undefined : undefined}
          />
        </Sheet>
      )}

      <section className="mt-6">
        <h2 className="mb-2 px-1 text-sm font-medium text-ink-soft">Histórico</h2>
        <Sheet className="divide-y divide-rule">
          {txs.map((t) => {
            const isOrigin = t.id === origin?.id;
            const from = t.from_account_id ? accName.get(t.from_account_id) : null;
            const to = t.to_account_id ? accName.get(t.to_account_id) : null;
            return (
              <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{TYPE_LABEL[t.type]}</p>
                  <p className="truncate text-xs text-ink-faint">
                    {formatDateBR(t.occurred_on)} · {from && to ? `${from} → ${to}` : from ?? to}
                  </p>
                </div>
                <span className={cx("font-semibold", isOrigin ? "text-ink" : "text-pine")}>
                  {isOrigin ? "−" : "+"}
                  {formatBRL(t.amount_cents)}
                </span>
                {!isOrigin && <DeletePaymentButton id={t.id} loanId={loan.loan_id} />}
              </div>
            );
          })}
        </Sheet>
      </section>

      <div className="mt-6">
        <DeleteLoanButton id={loan.loan_id} />
      </div>
    </>
  );
}
