"use client";

import { useEffect } from "react";

/** Registra o service worker (necessário para instalar como app em alguns navegadores). */
export function RegisterSW() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
