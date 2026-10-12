import { expect, test, type Page } from "@playwright/test";

// Fluxo completo de um casal usando o app, do cadastro ao convite.
const run = Date.now();
const A = { email: `augusto.${run}@example.com`, password: "senha-teste-123" };
const B = { email: `esposa.${run}@example.com`, password: "senha-teste-456" };

async function signUp(page: Page, user: typeof A) {
  await page.goto("/login");
  await page.getByRole("radio", { name: "Criar conta" }).check({ force: true });
  await page.getByLabel("E-mail").fill(user.email);
  await page.getByLabel("Senha").fill(user.password);
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page).toHaveURL(/\/comecar/);
}

async function pickChip(page: Page, name: string) {
  await page.locator("label", { hasText: new RegExp(`^${name}$`) }).click();
}

async function launch(page: Page, opts: { kind: "Despesa" | "Receita"; digits: string; category: string; account: string; description?: string }) {
  await page.goto("/lancar");
  await page.locator("#amount").fill(opts.digits);
  await page.locator("label", { hasText: new RegExp(`^${opts.kind}$`) }).click();
  await pickChip(page, opts.category);
  await pickChip(page, opts.account);
  if (opts.description) await page.getByLabel(/Descrição/).fill(opts.description);
  await page.getByRole("button", { name: /^Salvar (despesa|receita)$/ }).click();
  await expect(page.getByRole("status")).toContainText("salva");
}

test("casal: cadastro, lançamentos, empréstimos, convite e edição", async ({ browser }) => {
  // ------------------------------------------------------------ Pessoa A
  const ctxA = await browser.newContext();
  const page = await ctxA.newPage();

  await signUp(page, A);
  await page.getByLabel("Nome").fill("Família Teste");
  await page.getByRole("button", { name: "Criar família" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText("Bem-vindos!")).toBeVisible();

  // Saldo inicial da poupança
  await page.goto("/mais/contas");
  await page.locator("summary", { hasText: "Poupança" }).click();
  const poupForm = page.locator("details[open] form");
  await poupForm.getByLabel("Saldo inicial (R$)").fill("10.000,00");
  await poupForm.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText("Conta atualizada.")).toBeVisible();

  // Receita e despesa
  await launch(page, { kind: "Receita", digits: "450000", category: "Salário", account: "Conta Corrente" });
  await launch(page, { kind: "Despesa", digits: "65000", category: "Mercado", account: "Conta Corrente", description: "Mercado do mês" });

  // Transferência para a poupança
  await page.goto("/lancar");
  await page.locator("#amount").fill("100000");
  await page.locator("label", { hasText: /^Transferência$/ }).click();
  await page.getByLabel("De", { exact: true }).selectOption({ label: "Conta Corrente" });
  await page.getByLabel("Para", { exact: true }).selectOption({ label: "Poupança" });
  await page.getByRole("button", { name: "Salvar transferência" }).click();
  await expect(page.getByRole("status")).toContainText("Transferência de R$ 1.000,00 salva");

  // Painel: taxa de poupança = (4500 − 650) / 4500 = 86%
  await page.goto("/");
  await expect(page.getByTestId("savings-rate")).toHaveText("86%");
  await expect(page.getByText("vocês guardaram R$ 86")).toBeVisible();

  // Empréstimo ao João: R$ 500, recebe R$ 200
  await page.goto("/emprestimos/novo");
  await page.getByLabel("Para quem?").fill("João");
  await page.locator("#principal").fill("50000");
  await page.getByRole("button", { name: "Registrar empréstimo" }).click();
  await expect(page).toHaveURL(/\/emprestimos\/[0-9a-f-]{36}$/);
  await page.locator("#pay-amount").fill("20000");
  await page.getByRole("button", { name: "Registrar recebimento" }).click();
  await expect(page.getByTestId("loan-outstanding")).toHaveText("R$ 300,00");

  // Autoempréstimo: Notebook R$ 3.000 em 6x, devolve 1 parcela (sugerida = R$ 500)
  await page.goto("/emprestimos/novo?tipo=poupanca");
  await page.getByLabel("Para quê?").fill("Notebook");
  await page.locator("#principal").fill("300000");
  await page.getByLabel("Parcelas").fill("6");
  await expect(page.getByText("6× de R$ 500,00")).toBeVisible();
  await page.getByRole("button", { name: "Registrar autoempréstimo" }).click();
  await expect(page.locator("#pay-amount")).toHaveValue("500,00");
  await page.getByRole("button", { name: "Registrar devolução" }).click();
  await expect(page.getByTestId("loan-outstanding")).toHaveText("R$ 2.500,00");

  // Painel: patrimônio = contas (5.050 + 8.500) + a receber 300
  await page.goto("/");
  await expect(page.getByTestId("net-worth")).toHaveText("R$ 13.850,00");
  await expect(page.getByText("R$ 2.500,00")).toBeVisible();

  // Convite
  await page.goto("/mais/familia");
  await page.getByRole("button", { name: "Gerar código de convite" }).click();
  const code = (await page.getByTestId("invite-code").textContent())!.trim();
  expect(code).toMatch(/^[0-9A-F]{8}$/);

  // Sair
  await page.goto("/mais");
  await page.getByRole("button", { name: "Sair" }).click();
  await expect(page).toHaveURL(/\/login/);
  await ctxA.close();

  // ------------------------------------------------------------ Pessoa B
  const ctxB = await browser.newContext();
  const pb = await ctxB.newPage();
  await signUp(pb, B);
  await pb.getByLabel("Código").fill(code.toLowerCase());
  await pb.getByRole("button", { name: "Entrar na família" }).click();
  await expect(pb).toHaveURL(/\/$/);
  await expect(pb.getByTestId("net-worth")).toHaveText("R$ 13.850,00");

  // Editar o mercado para R$ 700 → taxa (4500 − 700) / 4500 = 84%
  await pb.goto("/extrato");
  await pb.getByRole("link", { name: /Mercado do mês/ }).click();
  await pb.locator("#amount").fill("70000");
  await pb.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(pb).toHaveURL(/\/extrato\?mes=/);
  await pb.goto("/");
  await expect(pb.getByTestId("savings-rate")).toHaveText("84%");

  // Excluir o mercado → 100%
  await pb.goto("/extrato");
  await pb.getByRole("link", { name: /Mercado do mês/ }).click();
  await pb.getByRole("button", { name: "Excluir lançamento" }).click();
  await pb.getByRole("button", { name: "Excluir", exact: true }).click();
  await expect(pb).toHaveURL(/\/extrato/);
  await expect(pb.getByText("Mercado do mês")).toHaveCount(0);
  await pb.goto("/");
  await expect(pb.getByTestId("savings-rate")).toHaveText("100%");
  await ctxB.close();
});

test("sem login, qualquer tela leva para o login", async ({ page }) => {
  await page.goto("/extrato");
  await expect(page).toHaveURL(/\/login$/);
});

test("senha errada mostra mensagem clara", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(`ninguem.${run}@example.com`);
  await page.getByLabel("Senha").fill("errada123");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByText("E-mail ou senha incorretos.")).toBeVisible();
});

test("exportar CSV exige login", async ({ request }) => {
  const r = await request.get("/exportar", { maxRedirects: 0 });
  expect([307, 401]).toContain(r.status());
});
