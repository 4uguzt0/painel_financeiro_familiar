"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/lib/cx";

const items = [
  { href: "/", label: "Início", icon: "M3.5 9.5L10 4l6.5 5.5V16a1 1 0 01-1 1h-3.5v-4.5h-4V17H4.5a1 1 0 01-1-1V9.5z" },
  { href: "/extrato", label: "Extrato", icon: "M5 3.5h10v13l-2-1.3-1.5 1.3L10 15.2l-1.5 1.3L7 15.2l-2 1.3v-13zM7.5 7.5h5M7.5 10.5h5" },
  { href: "/lancar", label: "Lançar", icon: "" },
  { href: "/emprestimos", label: "Empréstimos", icon: "M3 7.5h11.5L11.5 4.5M17 12.5H5.5l3 3" },
  { href: "/mais", label: "Mais", icon: "M5 10h.01M10 10h.01M15 10h.01" },
];

export function BottomNav() {
  const path = usePathname();
  const isActive = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-rule bg-sheet/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <ul className="mx-auto flex max-w-xl items-end justify-around px-2">
        {items.map((it) =>
          it.href === "/lancar" ? (
            <li key={it.href} className="-mt-5">
              <Link
                href="/lancar"
                aria-label="Lançar movimentação"
                aria-current={isActive(it.href) ? "page" : undefined}
                className="grid size-14 place-items-center rounded-2xl bg-pine text-sheet shadow-[0_6px_16px_-6px_rgba(29,106,80,.7)]"
              >
                <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden>
                  <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
                </svg>
              </Link>
            </li>
          ) : (
            <li key={it.href}>
              <Link
                href={it.href}
                aria-current={isActive(it.href) ? "page" : undefined}
                className={cx(
                  "flex w-16 flex-col items-center gap-1 py-2.5 text-[11px] font-medium",
                  isActive(it.href) ? "text-ink" : "text-ink-faint",
                )}
              >
                <svg width="22" height="22" viewBox="0 0 20 20" fill="none" aria-hidden>
                  <path
                    d={it.icon}
                    stroke="currentColor"
                    strokeWidth={it.label === "Mais" ? 3 : 1.6}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                {it.label}
              </Link>
            </li>
          ),
        )}
      </ul>
    </nav>
  );
}
