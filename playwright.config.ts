import { defineConfig, devices } from "@playwright/test";

// Testes de ponta a ponta. Pré-requisito: app rodando com um Supabase de teste.
//   npm run build && npm start      (em outro terminal)
//   npm run test:e2e
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    trace: "retain-on-failure",
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  },
  projects: [{ name: "mobile", use: { ...devices["Pixel 7"] } }],
});
