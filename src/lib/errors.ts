// Traduz erros do Supabase/Postgres para mensagens em português que dizem o que fazer.

type PgError = { code?: string; message?: string; details?: string } | null | undefined;

export function friendlyError(error: PgError, fallback = "Não foi possível salvar. Tente de novo."): string {
  if (!error) return fallback;
  // Aparece nos logs do servidor (Vercel → Logs) para diagnosticar erros inesperados
  if (!["23505", "23503", "23514", "P0001"].includes(error.code ?? "")) console.error("[supabase]", error);
  const msg = error.message ?? "";
  switch (error.code) {
    case "23505":
      return "Já existe um item com esse nome.";
    case "23503":
      if (msg.includes("delete") || msg.includes("update or delete"))
        return "Esse item tem lançamentos ligados a ele. Arquive em vez de excluir.";
      return "Um dos itens escolhidos não existe mais. Recarregue a página.";
    case "23514":
      if (msg.includes("from_to_distinct")) return "Escolha contas de origem e destino diferentes.";
      if (msg.includes("amount_cents")) return "Informe um valor maior que zero.";
      return "Os campos não combinam com o tipo de lançamento. Confira categoria e contas.";
    case "42501":
      return "Você não tem acesso a esses dados.";
    case "P0001":
      if (msg.includes("invalid or expired invite")) return "Código de convite inválido ou expirado.";
      return msg;
  }
  return fallback;
}

export function friendlyAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login")) return "E-mail ou senha incorretos.";
  if (m.includes("already registered") || m.includes("already exists")) return "Esse e-mail já tem conta. Use Entrar.";
  if (m.includes("password") && (m.includes("6") || m.includes("short") || m.includes("weak")))
    return "A senha precisa ter pelo menos 6 caracteres.";
  if (m.includes("email not confirmed"))
    return "Confirme o e-mail antes de entrar (ou desative a confirmação no Supabase — veja o guia).";
  if (m.includes("rate limit")) return "Muitas tentativas. Aguarde alguns minutos.";
  if (m.includes("invalid") && m.includes("email")) return "Digite um e-mail válido.";
  return "Não foi possível entrar. Confira os dados e tente de novo.";
}
