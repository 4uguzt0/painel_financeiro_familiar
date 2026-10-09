import type { Metadata } from "next";
import { getSession } from "@/lib/session";
import type { Category, CategoryKind } from "@/types/db";
import { PageHeader, Sheet } from "@/components/ui";
import { CategoryRow, NewCategoryForm } from "./category-forms";

export const metadata: Metadata = { title: "Categorias" };

export default async function CategoriesPage() {
  const { supabase } = await getSession();
  const { data } = await supabase.from("categories").select("id, name, kind, archived").order("name");
  const cats = (data ?? []) as Category[];

  const section = (kind: CategoryKind, title: string) => {
    const list = cats.filter((c) => c.kind === kind);
    return (
      <section className="mb-6">
        <h2 className="mb-2 text-sm font-medium text-ink-soft">{title}</h2>
        <Sheet className="divide-y divide-rule">
          {list.filter((c) => !c.archived).map((c) => (
            <CategoryRow key={c.id} category={c} />
          ))}
          <div className="p-4">
            <NewCategoryForm kind={kind} />
          </div>
        </Sheet>
        {list.some((c) => c.archived) && (
          <div className="mt-2 flex flex-wrap gap-2">
            {list.filter((c) => c.archived).map((c) => (
              <CategoryRow key={c.id} category={c} compact />
            ))}
          </div>
        )}
      </section>
    );
  };

  return (
    <>
      <PageHeader title="Categorias" back="/mais" />
      <p className="-mt-2 mb-5 text-sm text-ink-soft">
        Poucas categorias = lançamento mais rápido. Arquivar esconde a categoria dos formulários sem apagar o histórico.
      </p>
      {section("expense", "Despesas")}
      {section("income", "Receitas")}
    </>
  );
}
