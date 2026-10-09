/** Junta classes CSS, ignorando valores falsos. Funciona no servidor e no navegador. */
export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}
