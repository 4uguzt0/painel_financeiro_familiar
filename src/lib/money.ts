// Dinheiro é sempre inteiro em centavos. Converter só na borda (formulário e exibição).

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** 123456 -> "R$ 1.234,56" */
export function formatBRL(cents: number | null | undefined): string {
  return brl.format((cents ?? 0) / 100).replace(/ /g, " ");
}

/** 123456 -> "1.234,56" (sem símbolo, para campos de formulário) */
export function formatAmount(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Converte texto digitado em centavos. Aceita "1.234,56", "1234,5", "57", "R$ 57,00", "57.90".
 * Retorna null se não for um valor válido.
 */
export function parseBRL(input: string): number | null {
  let s = input.replace(/R\$|\s/g, "").trim();
  if (!s) return null;
  if (s.includes(",")) {
    // padrão brasileiro: ponto = milhar, vírgula = decimal
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    // "1.234" ou "1.234.567" sem vírgula = milhar
    s = s.replace(/\./g, "");
  }
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const [int, dec = ""] = s.split(".");
  return Number(int) * 100 + Number(dec.padEnd(2, "0"));
}

/** Máscara para digitação estilo app de banco: só dígitos, preenchendo da direita. */
export function maskFromDigits(raw: string): { text: string; cents: number } {
  const digits = raw.replace(/\D/g, "").replace(/^0+/, "").slice(0, 11);
  const cents = digits ? Number(digits) : 0;
  return { text: cents ? formatAmount(cents) : "", cents };
}
