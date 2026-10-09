"use client";

import Link from "next/link";
import { useFormStatus } from "react-dom";
import type { ComponentProps, ReactNode } from "react";
import { cx } from "@/lib/cx";


const btnBase =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 font-semibold transition-colors disabled:opacity-50 disabled:pointer-events-none";
const btnVariants = {
  primary: "bg-ink text-paper hover:opacity-90 h-12",
  pine: "bg-pine text-sheet hover:opacity-90 h-12",
  ghost: "text-ink hover:bg-rule/50 h-10",
  outline: "border border-rule bg-sheet text-ink hover:bg-paper h-11",
  danger: "text-debit hover:bg-debit-soft h-10",
};

type Variant = keyof typeof btnVariants;

export function Button({ variant = "primary", className, ...props }: ComponentProps<"button"> & { variant?: Variant }) {
  return <button className={cx(btnBase, btnVariants[variant], className)} {...props} />;
}

export function ButtonLink({
  variant = "primary",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={cx(btnBase, btnVariants[variant], className)} {...props} />;
}

/** Botão de envio que mostra "Salvando…" enquanto a Server Action roda. */
export function SubmitButton({
  children,
  pending: pendingLabel = "Salvando…",
  variant = "primary",
  className,
  ...props
}: ComponentProps<"button"> & { pending?: string; variant?: Variant }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} disabled={pending} className={className} {...props}>
      {pending ? pendingLabel : children}
    </Button>
  );
}

export function Field({ label, hint, children, htmlFor }: { label: string; hint?: string; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-ink-soft">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-ink-faint">{hint}</p>}
    </div>
  );
}

const inputCls =
  "h-12 w-full rounded-xl border border-rule bg-sheet px-3.5 text-base text-ink placeholder:text-ink-faint focus:border-ink focus:outline-none";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cx(inputCls, className)} {...props} />;
}

export function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <select className={cx(inputCls, "appearance-none bg-[length:12px] pr-9", className)} style={{ backgroundImage: CHEVRON, backgroundRepeat: "no-repeat", backgroundPosition: "right 14px center" }} {...props}>
      {children}
    </select>
  );
}

const CHEVRON =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 8'%3E%3Cpath d='M1 1.5l5 5 5-5' fill='none' stroke='%237d8a94' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")";

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-xl bg-debit-soft px-3.5 py-2.5 text-sm text-debit">
      {message}
    </p>
  );
}

export function Sheet({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cx("rounded-2xl border border-rule bg-sheet", className)}>{children}</section>;
}

export function PageHeader({ title, back, action }: { title: string; back?: string; action?: ReactNode }) {
  return (
    <header className="mb-5 flex items-center gap-2">
      {back && (
        <Link href={back} aria-label="Voltar" className="-ml-2 grid size-10 place-items-center rounded-full text-ink-soft hover:bg-rule/50">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
            <path d="M12.5 4.5L7 10l5.5 5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      )}
      <h1 className="flex-1 text-2xl font-bold tracking-tight">{title}</h1>
      {action}
    </header>
  );
}

/** Segmentos (rádio estilizado) — usado para tipo de lançamento, etc. */
export function Segmented<T extends string>({
  name,
  value,
  onChange,
  options,
  className,
}: {
  name: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  className?: string;
}) {
  return (
    <div role="radiogroup" className={cx("flex gap-1 rounded-xl bg-rule/50 p-1", className)}>
      {options.map((o) => (
        <label
          key={o.value}
          className={cx(
            "flex-1 cursor-pointer rounded-lg px-2 py-2 text-center text-sm font-medium transition-colors",
            value === o.value ? "bg-sheet text-ink shadow-[0_1px_2px_rgba(23,40,58,.12)]" : "text-ink-soft",
          )}
        >
          <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} className="sr-only" />
          {o.label}
        </label>
      ))}
    </div>
  );
}

/** Chips de escolha única (categorias, contas). */
export function ChipGroup({
  name,
  value,
  onChange,
  options,
  label,
}: {
  name: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  label: string;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-ink-soft">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <label
            key={o.value}
            className={cx(
              "cursor-pointer rounded-full border px-3.5 py-2 text-sm transition-colors",
              value === o.value ? "border-ink bg-ink text-paper" : "border-rule bg-sheet text-ink hover:border-ink-faint",
            )}
          >
            <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} className="sr-only" />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-rule px-5 py-8 text-center">
      <p className="font-semibold">{title}</p>
      {children && <div className="mx-auto mt-1 max-w-xs text-sm text-ink-soft">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
