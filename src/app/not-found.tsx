import { ButtonLink } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-start justify-center px-5">
      <h1 className="text-2xl font-bold">Página não encontrada</h1>
      <p className="mt-2 text-ink-soft">O endereço pode estar errado ou o item foi excluído.</p>
      <ButtonLink href="/" className="mt-6">Voltar ao início</ButtonLink>
    </main>
  );
}
