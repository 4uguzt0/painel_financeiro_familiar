import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Caderneta — finanças da família",
    short_name: "Caderneta",
    description: "Taxa de poupança, patrimônio e empréstimos da família.",
    start_url: "/",
    display: "standalone",
    background_color: "#f2f5f2",
    theme_color: "#f2f5f2",
    lang: "pt-BR",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
