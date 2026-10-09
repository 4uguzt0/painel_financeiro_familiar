import { getSession } from "@/lib/session";
import { BottomNav } from "@/components/bottom-nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await getSession(); // garante login + família antes de qualquer tela interna
  return (
    <div className="mx-auto min-h-dvh max-w-xl">
      <main className="px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-32">{children}</main>
      <BottomNav />
    </div>
  );
}
