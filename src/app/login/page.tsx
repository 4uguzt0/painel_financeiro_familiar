import type { Metadata } from "next";
import { AuthForm } from "./auth-form";

export const metadata: Metadata = { title: "Entrar" };

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10">
      <Brand />
      <h1 className="mt-8 text-[2rem] leading-[1.1] font-bold tracking-tight text-balance">
        O dinheiro da família, num lugar só.
      </h1>
      <p className="mt-3 text-ink-soft">
        Lance gastos em segundos e acompanhe o que importa: quanto vocês guardam por mês e se o patrimônio está crescendo.
      </p>
      <div className="mt-8">
        <AuthForm />
      </div>
    </main>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <svg width="32" height="32" viewBox="0 0 64 64" aria-hidden>
        <rect width="64" height="64" rx="14" fill="var(--pine)" />
        <rect x="16" y="14" width="32" height="36" rx="4" fill="none" stroke="var(--sheet)" strokeWidth="4" />
        <path d="M24 26h16M24 34h16M24 42h9" stroke="var(--sheet)" strokeWidth="4" strokeLinecap="round" />
      </svg>
      <span className="text-lg font-bold tracking-tight">Caderneta</span>
    </div>
  );
}
