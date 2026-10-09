// Service worker mínimo: permite instalar o app. Não guarda dados offline
// (os números precisam vir sempre atualizados do banco).
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
