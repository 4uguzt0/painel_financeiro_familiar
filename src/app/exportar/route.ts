import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/dates";
import { TYPE_LABEL, type Transaction } from "@/types/db";

// GET /exportar — baixa todos os lançamentos da família em CSV (abre no Excel/Sheets).
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Faça login para exportar.", { status: 401 });

  const [{ data: txs, error }, { data: accounts }, { data: categories }, { data: loans }] = await Promise.all([
    supabase.from("transactions").select("*").order("occurred_on").order("created_at"),
    supabase.from("accounts").select("id, name"),
    supabase.from("categories").select("id, name"),
    supabase.from("loans").select("id, counterparty"),
  ]);
  if (error) return new Response("Não foi possível exportar.", { status: 500 });

  const acc = new Map((accounts ?? []).map((a) => [a.id, a.name]));
  const cat = new Map((categories ?? []).map((c) => [c.id, c.name]));
  const loan = new Map((loans ?? []).map((l) => [l.id, l.counterparty]));

  const esc = (v: string | null | undefined) => {
    const s = v ?? "";
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  // Ponto e vírgula + vírgula decimal: abre direto no Excel em português
  const header = ["data", "tipo", "valor", "categoria", "conta_origem", "conta_destino", "descricao", "emprestimo"];
  const lines = ((txs ?? []) as Transaction[]).map((t) =>
    [
      t.occurred_on,
      TYPE_LABEL[t.type],
      (t.amount_cents / 100).toFixed(2).replace(".", ","),
      t.category_id ? cat.get(t.category_id) : "",
      t.from_account_id ? acc.get(t.from_account_id) : "",
      t.to_account_id ? acc.get(t.to_account_id) : "",
      t.description,
      t.loan_id ? loan.get(t.loan_id) : "",
    ]
      .map((v) => esc(v as string))
      .join(";"),
  );

  const csv = "﻿" + [header.join(";"), ...lines].join("\r\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="caderneta-${todayISO()}.csv"`,
    },
  });
}
