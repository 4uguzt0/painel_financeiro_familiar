// Datas sempre no fuso de Brasília, mesmo quando o servidor (Vercel) roda em UTC.
export const TZ = "America/Sao_Paulo";

/** "2026-10-09" no fuso de Brasília */
export function todayISO(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** "2026-10" */
export function currentMonth(now: Date = new Date()): string {
  return todayISO(now).slice(0, 7);
}

export function isValidMonth(m: string | undefined | null): m is string {
  return !!m && /^\d{4}-(0[1-9]|1[0-2])$/.test(m);
}

/** "2026-10" -> { start: "2026-10-01", end: "2026-11-01" } (end exclusivo) */
export function monthRange(month: string): { start: string; end: string } {
  return { start: `${month}-01`, end: `${shiftMonth(month, 1)}-01` };
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const MONTHS_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "2026-10" -> "outubro de 2026" */
export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${MONTHS[m - 1]} de ${y}`;
}

/** "2026-10" ou "2026-10-01" -> "out" / "out 26" */
export function monthShort(isoMonthOrDate: string, withYear = false): string {
  const [y, m] = isoMonthOrDate.split("-").map(Number);
  return withYear ? `${MONTHS_SHORT[m - 1]} ${String(y).slice(2)}` : MONTHS_SHORT[m - 1];
}

/** "2026-10-09" -> "09/10/2026" */
export function formatDateBR(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

const WEEKDAYS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

/** Cabeçalho de dia no extrato: "Hoje", "Ontem" ou "quinta, 08/10" */
export function dayHeading(iso: string, today: string = todayISO()): string {
  if (iso === today) return "Hoje";
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const [ty, tm, td] = today.split("-").map(Number);
  const diff = Math.round((Date.UTC(ty, tm - 1, td) - date.getTime()) / 86400000);
  if (diff === 1) return "Ontem";
  return `${WEEKDAYS[date.getUTCDay()]}, ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
}
