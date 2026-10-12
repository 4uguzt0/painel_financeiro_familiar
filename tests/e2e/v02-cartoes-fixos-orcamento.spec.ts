import { expect, test, type Page } from "@playwright/test";

// v0.2: cartão de crédito, gastos fixos e orçamento com avisos.
const run = Date.now();
const user = { email: `v02.${run}@example.com`, password: "senha-teste-789" };

async function pickChip(page: Page, name: string) {
  await page.locator("label", { hasText: new RegExp(`^${name}$`) }).click();
}

async function expense(page: Page, digits: string, category: string, from: string) {
  await page.goto("/lancar");
  await page.locator("#amount").fill(digits);
  await pickChip(page, category);
  await pickChip(page, from);
  await page.getByRole("button", { name: "Salvar despesa" }).click();
  await expect(page.getByRole("status")).toContainText("salva");
}

test("cartão, gastos fixos e orçamento", async ({ page }) => {
  // ------------------------------------------------------------ setup
  await page.goto("/login");
  await page.getByRole("radio", { name: "Criar conta" }).check({ force: true });
  await page.getByLabel("E-mail").fill(user.email);
  await page.getByLabel("Senha").fill(user.password);
  await page.getByRole("button", { name: "Criar conta" }).click();
  await page.getByLabel("Nome").fill("Família v0.2");
  await page.getByRole("button", { name: "Criar família" }).click();
  await expect(page).toHaveURL(/\/$/);

  await page.goto("/mais/contas");
  await page.locator("summary", { hasText: "Conta Corrente" }).click();
  const cc = page.locator("details[open] form");
  await cc.getByLabel("Saldo inicial (R$)").fill("5.000,00");
  await cc.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText("Conta atualizada.")).toBeVisible();

  await page.goto("/lancar");
  await page.locator("#amount").fill("600000");
  await page.locator("label", { hasText: /^Receita$/ }).click();
  await pickChip(page, "Salário");
  await pickChip(page, "Conta Corrente");
  await page.getByRole("button", { name: "Salvar receita" }).click();
  await expect(page.getByRole("status")).toContainText("salva");

  // ------------------------------------------------------------ cartão
  await page.goto("/mais/cartoes");
  const newCard = page.locator("section", { hasText: "Novo cartão" });
  await newCard.getByLabel("Nome").fill("Cartão Nubank");
  await newCard.getByLabel("Quanto deve no cartão (R$)").fill("300,00");
  await newCard.getByRole("button", { name: "Adicionar cartão" }).click();
  await expect(page.getByTestId("card-owed-Cartão Nubank")).toHaveText("R$ 300,00");

  await expense(page, "40000", "Mercado", "Cartão Nubank");
  await expense(page, "25000", "Lazer", "Cartão Nubank");

  await page.goto("/mais/cartoes");
  await expect(page.getByTestId("cards-month-spent")).toHaveText("R$ 650,00");
  await expect(page.getByTestId("card-owed-Cartão Nubank")).toHaveText("R$ 950,00");

  // Pagar fatura: valor e contas já vêm preenchidos
  await page.getByRole("link", { name: "Pagar fatura" }).click();
  await expect(page.getByRole("heading", { name: "Pagar fatura · Cartão Nubank" })).toBeVisible();
  await expect(page.locator("#amount")).toHaveValue("950,00");
  await expect(page.getByLabel("De", { exact: true })).toHaveValue(/.+/);
  await expect(page.locator("#from option:checked")).toHaveText("Conta Corrente");
  await page.getByRole("button", { name: "Salvar transferência" }).click();
  await expect(page.getByRole("status")).toContainText("Transferência de R$ 950,00 salva");

  await page.goto("/mais/cartoes");
  await expect(page.getByTestId("card-owed-Cartão Nubank")).toHaveText("R$ 0,00");
  await page.goto("/extrato");
  await expect(page.getByText("Pagamento de fatura")).toBeVisible();

  // Pagar a fatura não é gasto: taxa = (6000 − 650) / 6000 = 89%
  await page.goto("/");
  await expect(page.getByTestId("savings-rate")).toHaveText("89%");

  // ------------------------------------------------------------ gastos fixos
  await page.goto("/mais/fixos");
  const newFixed = page.locator("section", { hasText: "Novo gasto fixo" }).last();
  await newFixed.getByLabel("Nome").fill("Aluguel");
  await newFixed.getByLabel("Valor (R$)").fill("2.000,00");
  await newFixed.getByLabel("Categoria").selectOption({ label: "Moradia" });
  await newFixed.getByLabel("Sai de").selectOption({ label: "Conta Corrente" });
  await newFixed.getByLabel("Dia do vencimento").fill("5");
  await newFixed.getByRole("button", { name: "Cadastrar gasto fixo" }).click();
  await expect(page.getByText("Gasto fixo cadastrado.")).toBeVisible();

  await newFixed.getByLabel("Nome").fill("Streaming");
  await newFixed.getByLabel("Valor (R$)").fill("45,90");
  await newFixed.getByLabel("Categoria").selectOption({ label: "Assinaturas" });
  await newFixed.getByLabel("Sai de").selectOption({ label: "Cartão Nubank" });
  await newFixed.getByLabel("Dia do vencimento").fill("31");
  await newFixed.getByRole("button", { name: "Cadastrar gasto fixo" }).click();
  await expect(page.getByText("0 de 2 lançados")).toBeVisible();

  // Ajusta o valor do streaming e lança os dois de uma vez
  await page.getByLabel("Valor de Streaming").fill("4990");
  await page.getByRole("button", { name: /Lançar 2 gastos · R\$ 2\.049,90/ }).click();
  await expect(page.getByText("2 gastos fixos lançados (R$ 2.049,90).")).toBeVisible();
  await expect(page.getByText("Tudo lançado neste mês.")).toBeVisible();

  // ------------------------------------------------------------ orçamento
  await page.goto("/mais/orcamento");
  await page.getByLabel(/^Mercado/).fill("500,00");
  await page.getByLabel(/^Lazer/).fill("200,00");
  await page.getByRole("button", { name: "Salvar orçamento" }).click();
  await expect(page.getByText("Orçamento salvo.")).toBeVisible();

  // Economia prevista = 6.000 − 700 (orçamento) − 2.049,90 (fixos, sem limite)
  await expect(page.getByTestId("planned-savings")).toHaveText("R$ 3.250,10");
  await expect(page.getByTestId("budget-Mercado")).toContainText("80% usado");
  await expect(page.getByTestId("budget-Lazer")).toHaveText("Passou R$ 50,00 do limite");

  // Aviso logo depois de lançar
  await expense(page, "5000", "Mercado", "Cartão Nubank");
  await expect(page.getByTestId("budget-warning")).toHaveText("Mercado já usou 90% do orçamento. Restam R$ 50,00.");

  // Painel: avisos, fixos e cartão
  await page.goto("/");
  await expect(page.getByTestId("budget-alerts")).toContainText("Lazer passou do orçamento em R$ 50,00.");
  await expect(page.getByTestId("budget-alerts")).toContainText("Mercado já usou 90%");
  await expect(page.getByTestId("fixed-tile")).toContainText("2/2");
  await expect(page.getByTestId("cards-tile")).toContainText("R$ 749,90");
});
