import type { Metadata, Viewport } from "next";
import "@fontsource-variable/schibsted-grotesk";
import "./globals.css";
import { RegisterSW } from "@/components/register-sw";

export const metadata: Metadata = {
  title: { default: "Caderneta", template: "%s · Caderneta" },
  description: "Painel financeiro da família: taxa de poupança, patrimônio e empréstimos.",
  applicationName: "Caderneta",
  appleWebApp: { capable: true, title: "Caderneta", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f5f2" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1720" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className="min-h-dvh antialiased">
        {children}
        <RegisterSW />
      </body>
    </html>
  );
}
