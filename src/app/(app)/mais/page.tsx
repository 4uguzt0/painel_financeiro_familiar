import type { Metadata } from "next";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { signOut } from "@/actions/auth";
import { PageHeader, Sheet } from "@/components/ui";

export const metadata: Metadata = { title: "Mais" };

const links = [
  { href: "/mais/orcamento", title: "Orçamento", text: "Limite de gastos por categoria e economia prevista" },
  { href: "/mais/fixos", title: "Gastos fixos", text: "Aluguel, contas e assinaturas: lance o mês em um toque" },
  { href: "/mais/cartoes", title: "Cartões", text: "Gasto do mês, fatura a pagar, pagar fatura" },
  { href: "/mais/contas", title: "Contas", text: "Saldos, saldo inicial, arquivar contas" },
  { href: "/mais/categorias", title: "Categorias", text: "Receitas e despesas" },
  { href: "/mais/familia", title: "Família", text: "Membros e código de convite" },
  { href: "/mais/como-usar", title: "Como usar", text: "O combinado para lançar pouco e ver muito" },
];

export default async function MorePage() {
  const { user, householdName } = await getSession();
  return (
    <>
      <PageHeader title="Mais" />
      <p className="-mt-3 mb-5 text-sm text-ink-soft">
        {householdName} · {user.email}
      </p>
      <Sheet className="divide-y divide-rule">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="flex items-center gap-3 px-4 py-4 first:rounded-t-2xl last:rounded-b-2xl hover:bg-paper">
            <div className="flex-1">
              <p className="font-medium">{l.title}</p>
              <p className="text-sm text-ink-soft">{l.text}</p>
            </div>
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden className="text-ink-faint">
              <path d="M7.5 4.5L13 10l-5.5 5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        ))}
      </Sheet>
      <Sheet className="mt-4">
        <a href="/exportar" download className="flex items-center gap-3 rounded-2xl px-4 py-4 hover:bg-paper">
          <div className="flex-1">
            <p className="font-medium">Baixar lançamentos (CSV)</p>
            <p className="text-sm text-ink-soft">Backup que abre no Excel ou Google Sheets. Faça uma vez por mês.</p>
          </div>
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden className="text-ink-faint">
            <path d="M10 3.5v9m0 0l-3.5-3.5M10 12.5l3.5-3.5M4 16h12" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </a>
      </Sheet>
      <form action={signOut} className="mt-6">
        <button className="w-full rounded-xl py-3 text-sm font-medium text-debit hover:bg-debit-soft">Sair</button>
      </form>
    </>
  );
}
