import type { Metadata } from "next";
import { PageHeader, Sheet } from "@/components/ui";

export const metadata: Metadata = { title: "Como usar" };

const rules = [
  {
    title: "Lance o total, não o item",
    text: "Foi ao mercado? Um lançamento: “Mercado R$ 650”. Pão, leite e refrigerante não precisam de linha própria.",
  },
  {
    title: "Cartão de crédito é uma conta",
    text: "Cadastre cada cartão em Mais → Cartões. Compra no cartão = despesa saindo do cartão. Pagar a fatura = botão “Pagar fatura” (uma transferência da conta para o cartão, que não conta como gasto de novo).",
  },
  {
    title: "Gastos fixos: cadastre uma vez, lance o mês num toque",
    text: "Aluguel, contas e assinaturas ficam em Mais → Gastos fixos. Quando pagar, confira os valores e toque em “Lançar”.",
  },
  {
    title: "Orçamento: um limite por categoria",
    text: "Em Mais → Orçamento, defina quanto querem gastar por mês. O app mostra quanto vão guardar se cumprirem e avisa ao chegar em 80% e 100%.",
  },
  {
    title: "Guardar dinheiro é transferência",
    text: "Mandou para a poupança ou aplicou em investimentos? Use Transferência. Não é gasto: o patrimônio continua o mesmo.",
  },
  {
    title: "Pegou da poupança? Registre como autoempréstimo",
    text: "Em Empréstimos → Novo, escolha “Da nossa poupança”. O app calcula a parcela e mostra quanto falta devolver.",
  },
  {
    title: "Domingo, 15 minutos",
    text: "Confira se o saldo de cada conta no app bate com o banco. Se não bater, faltou algum lançamento da semana.",
  },
];

export default function HowToPage() {
  return (
    <>
      <PageHeader title="Como usar" back="/mais" />
      <p className="mb-5 text-ink-soft">
        O app foi feito para pedir pouco. Estes combinados mantêm os números certos sem virar trabalho.
      </p>
      <ol className="flex flex-col gap-3">
        {rules.map((r, i) => (
          <li key={r.title}>
            <Sheet className="flex gap-4 p-4">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-pine-soft font-bold text-pine">{i + 1}</span>
              <div>
                <p className="font-semibold">{r.title}</p>
                <p className="mt-1 text-sm text-ink-soft">{r.text}</p>
              </div>
            </Sheet>
          </li>
        ))}
      </ol>
      <Sheet className="mt-6 p-4">
        <p className="font-semibold">Taxa de poupança</p>
        <p className="mt-1 text-sm text-ink-soft">
          (receitas − despesas) ÷ receitas. Acima de 20% é ótimo, entre 10% e 20% é bom, abaixo de 10% pede atenção.
          Transferências e empréstimos não entram na conta.
        </p>
      </Sheet>
    </>
  );
}
