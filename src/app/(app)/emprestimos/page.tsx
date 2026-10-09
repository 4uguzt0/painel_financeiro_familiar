import type { Metadata } from "next";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { formatBRL } from "@/lib/money";
import { formatDateBR } from "@/lib/dates";
import type { LoanStatus } from "@/types/db";
import { ButtonLink, EmptyState, PageHeader, Sheet } from "@/components/ui";
import { cx } from "@/lib/cx";

export const metadata: Metadata = { title: "Empréstimos" };

const STATUS = {
  open: { label: "Em aberto", cls: "bg-amber-soft text-amber" },
  partial: { label: "Parcial", cls: "bg-amber-soft text-amber" },
  paid: { label: "Quitado", cls: "bg-pine-soft text-pine" },
};

export default async function LoansPage({ searchParams }: { searchParams: Promise<{ aba?: string }> }) {
  const { aba } = await searchParams;
  const tab = aba === "poupanca" ? "self" : "third_party";
  const { supabase } = await getSession();
  const { data } = await supabase.from("v_loan_status").select("*").order("started_on", { ascending: false });
  const all = (data ?? []) as LoanStatus[];
  const list = all.filter((l) => l.kind === tab);
  const open = list.filter((l) => l.status !== "paid");
  const paid = list.filter((l) => l.status === "paid");
  const outstanding = open.reduce((s, l) => s + l.outstanding_cents, 0);

  return (
    <>
      <PageHeader
        title="Empréstimos"
        action={
          <ButtonLink href={`/emprestimos/novo?tipo=${tab === "self" ? "poupanca" : "terceiro"}`} variant="outline" className="h-10">
            Novo
          </ButtonLink>
        }
      />

      <div role="tablist" className="mb-5 flex gap-1 rounded-xl bg-rule/50 p-1">
        {[
          { key: "third_party", href: "/emprestimos", label: "Para outras pessoas" },
          { key: "self", href: "/emprestimos?aba=poupanca", label: "Da nossa poupança" },
        ].map((t) => (
          <Link
            key={t.key}
            href={t.href}
            role="tab"
            aria-selected={tab === t.key}
            className={cx(
              "flex-1 rounded-lg px-2 py-2 text-center text-sm font-medium",
              tab === t.key ? "bg-sheet text-ink shadow-[0_1px_2px_rgba(23,40,58,.12)]" : "text-ink-soft",
            )}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <Sheet className="mb-5 p-4">
        <p className="text-sm text-ink-soft">{tab === "self" ? "Falta devolver à poupança" : "Falta receber"}</p>
        <p className={cx("text-3xl font-bold tracking-tight", tab === "self" && outstanding > 0 && "text-amber")}>{formatBRL(outstanding)}</p>
        <p className="mt-1 text-xs text-ink-faint">
          {tab === "self"
            ? "Quando vocês tiram dinheiro da poupança para uma compra e combinam devolver em parcelas."
            : "Dinheiro emprestado a parentes e amigos. Conta como patrimônio até ser recebido."}
        </p>
      </Sheet>

      {list.length === 0 ? (
        <EmptyState
          title={tab === "self" ? "Nenhum autoempréstimo" : "Nenhum empréstimo"}
          action={
            <ButtonLink href={`/emprestimos/novo?tipo=${tab === "self" ? "poupanca" : "terceiro"}`}>
              {tab === "self" ? "Registrar autoempréstimo" : "Registrar empréstimo"}
            </ButtonLink>
          }
        />
      ) : (
        <div className="flex flex-col gap-5">
          {open.length > 0 && <LoanList loans={open} />}
          {paid.length > 0 && (
            <section>
              <h2 className="mb-2 px-1 text-sm font-medium text-ink-soft">Quitados</h2>
              <LoanList loans={paid} />
            </section>
          )}
        </div>
      )}
    </>
  );
}

function LoanList({ loans }: { loans: LoanStatus[] }) {
  return (
    <Sheet className="divide-y divide-rule">
      {loans.map((l) => {
        const pct = Math.round((l.repaid_cents / l.principal_cents) * 100);
        return (
          <Link key={l.loan_id} href={`/emprestimos/${l.loan_id}`} className="block px-4 py-3.5 first:rounded-t-2xl last:rounded-b-2xl hover:bg-paper">
            <div className="flex items-center justify-between gap-3">
              <p className="truncate font-medium">{l.counterparty}</p>
              <span className={cx("shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold", STATUS[l.status].cls)}>{STATUS[l.status].label}</span>
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-rule/60">
              <div className="h-full rounded-full bg-pine" style={{ width: `${pct}%` }} />
            </div>
            <div className="mt-1.5 flex items-baseline justify-between gap-3 text-xs text-ink-faint">
              <span>
                {formatBRL(l.repaid_cents)} de {formatBRL(l.principal_cents)} · desde {formatDateBR(l.started_on)}
              </span>
              {l.status !== "paid" && (
                <span className="shrink-0 whitespace-nowrap font-medium text-ink-soft">falta {formatBRL(l.outstanding_cents)}</span>
              )}
            </div>
          </Link>
        );
      })}
    </Sheet>
  );
}
