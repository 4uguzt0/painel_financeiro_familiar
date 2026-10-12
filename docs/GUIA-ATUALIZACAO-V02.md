# Atualização v0.2: testar no computador e publicar

Novidades desta versão: **cartões de crédito**, **gastos fixos** e **orçamento com avisos**.

O caminho seguro tem 3 etapas. Faça na ordem, porque cada uma protege a seguinte:

1. **Testar no computador** com um banco de testes (os dados reais não são tocados).
2. **Atualizar o banco de produção** (um arquivo SQL, rodado uma vez).
3. **Publicar o código** pelo GitHub Desktop (a Vercel atualiza o app sozinha).

> Por que o banco vem antes do código? A atualização do banco só **acrescenta** coisas, então o
> app antigo continua funcionando com o banco novo. O contrário não: o app novo procura tabelas
> que só existem depois da atualização. Banco primeiro = nenhum minuto fora do ar.

Pasta do projeto usada neste guia: `C:\Projetos\painel-financeiro-familiar`

---

## Etapa 0 — Copiar os arquivos da atualização (2 min)

1. Baixe `atualizacao-v02.zip`.
2. Extraia o conteúdo **dentro** de `C:\Projetos\painel-financeiro-familiar`.
   Quando o Windows perguntar, escolha **Substituir os arquivos no destino**.
3. Abra o **GitHub Desktop**. Na aba **Changes** aparecem os arquivos novos e alterados.
   Clique em alguns para ver o que mudou: verde é linha nova, vermelho é linha removida.
   (Ainda **não** faça commit. Isso é na Etapa 3.)

---

## Etapa 1 — Testar no computador (20 min na primeira vez)

### 1.1 Instalar o Node.js (só na primeira vez)
O Node.js é o programa que roda o app no seu computador.
1. Acesse **nodejs.org** e baixe a versão **LTS**. Instale com as opções padrão.
2. Abra o **PowerShell** (tecla Windows → digite "PowerShell" → Enter) e confira:
   ```powershell
   node -v
   ```
   Deve aparecer algo como `v22.x.x`.

### 1.2 Criar um banco de testes no Supabase (só na primeira vez)
O plano gratuito permite 2 projetos. Use o segundo como "banco de testes": assim você pode
lançar qualquer coisa sem bagunçar os dados reais da família.
1. supabase.com → **New project** → nome `caderneta-dev`, região São Paulo, gere a senha.
2. **SQL Editor → New query** → cole **todo** o arquivo `supabase/setup-completo.sql` → **Run**.
   (Esse arquivo já inclui a v0.2.)
3. **Authentication → Sign In / Providers → Email** → desligue **Confirm email** → Save.
4. Clique em **Connect** (ou **Project Settings → API Keys**) e copie o **Project URL** e a
   chave **anon / publishable** do projeto **caderneta-dev**.

### 1.3 Ligar o app ao banco de testes (só na primeira vez)
No PowerShell, entre na pasta do projeto e crie o arquivo de configuração:
```powershell
cd C:\Projetos\painel-financeiro-familiar
copy .env.example .env.local
notepad .env.local
```
No Bloco de Notas, troque os dois valores pelos do **caderneta-dev** e salve:
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
```
> O `.env.local` fica só no seu computador: ele está no `.gitignore` e **nunca** vai para o GitHub.

### 1.4 Rodar o app
```powershell
npm install      # baixa as bibliotecas (só na primeira vez ou quando o package.json mudar)
npm run dev      # liga o app
```
Quando aparecer `Ready`, abra **http://localhost:3000** no navegador. Para desligar: **Ctrl + C** no PowerShell.

> Para ver no celular como ficaria: no Chrome do computador aperte **F12** e clique no ícone
> de celular (Toggle device toolbar).

### 1.5 Roteiro de teste (15 min)
Crie uma conta qualquer (é o banco de testes) e confira:

**Cartões**
- [ ] Mais → **Cartões** → adicione um cartão com R$ 300 em "Quanto deve no cartão".
- [ ] Lance duas despesas escolhendo o cartão em "Saiu de". O "Gasto no mês" e o "A pagar" sobem.
- [ ] Toque em **Pagar fatura**: valor e contas já vêm preenchidos. Salve. O "A pagar" volta a zero.
- [ ] No painel, a taxa de poupança **não** muda com o pagamento da fatura.

**Gastos fixos**
- [ ] Mais → **Gastos fixos** → cadastre aluguel (dia 5) e uma assinatura no cartão (dia 31).
- [ ] Mude o valor de um deles na lista do mês e toque em **Lançar**.
- [ ] Os dois aparecem no Extrato, e o card "Gastos fixos" do painel mostra 2/2.

**Orçamento**
- [ ] Mais → **Orçamento** → defina limites para Mercado e Lazer → **Salvar orçamento**.
- [ ] Aparece "Se cumprirem o orçamento… vão guardar R$ X".
- [ ] Lance despesas até passar de 80% de uma categoria: aparece um aviso amarelo logo depois de salvar.
- [ ] Passe de 100%: o painel mostra o aviso vermelho no topo.

Achou algo estranho? Anote o passo e o que apareceu (um print ajuda) e me mande.

---

## Etapa 2 — Atualizar o banco de PRODUÇÃO (3 min)

> Atenção: agora é o projeto **real** do Supabase (o que o app da família usa), não o caderneta-dev.

1. supabase.com → abra o projeto de produção.
2. **SQL Editor → New query**.
3. Abra no Bloco de Notas **apenas** o arquivo
   `supabase/migrations/20261012000001_cards_recurring_budgets.sql`, copie tudo e cole.
4. **Run**. Deve aparecer **Success**.
5. Confira em **Table Editor**: existem as tabelas novas `budgets` e `recurring_expenses`.

> **Não** rode o `setup-completo.sql` em produção: ele é só para bancos novos e daria erro
> (as tabelas já existem). Em produção, rode sempre **só a migration nova**.

O app no ar continua funcionando normalmente depois deste passo, só que sem as telas novas.

---

## Etapa 3 — Publicar o código (3 min)

1. No **GitHub Desktop**, aba **Changes**, confira que o `.env.local` **não** aparece na lista.
   (Se aparecer, pare e me avise.)
2. Em **Summary**, escreva: `feat: cartões, gastos fixos e orçamento (v0.2)`
3. **Commit to main** → **Push origin**.
4. Na Vercel, aba **Deployments**: em 1–2 minutos o deploy novo fica **Ready**.
5. Abra o app no celular. Se ainda aparecer a versão antiga, feche o app e abra de novo.

### Primeiros passos com as novidades (no app real)
1. **Cartões:** cadastre cada cartão. Em "Quanto deve no cartão", use o **limite usado** que
   aparece no app do banco (fatura atual + parcelas futuras).
2. **Gastos fixos:** cadastre aluguel, condomínio, luz, internet, assinaturas e faculdade.
3. **Orçamento:** comece pelas categorias que mais pesam. A dica "mês passado: R$ X" ao lado
   de cada campo ajuda a definir um valor realista.

---

## Se algo der errado

| Sintoma | O que fazer |
|---|---|
| `npm` ou `node` "não é reconhecido" | Feche e abra o PowerShell depois de instalar o Node.js. Se continuar, reinicie o computador. |
| `npm run dev` fala em `NEXT_PUBLIC_SUPABASE_URL` | O `.env.local` está faltando ou com nome errado. No Bloco de Notas, salve como **Todos os arquivos** e nome `.env.local` (sem `.txt` no final). |
| Porta 3000 em uso | Outro `npm run dev` está aberto. Feche aquele PowerShell ou use o endereço que o terminal mostrar (ex.: 3001). |
| App em produção com "Application error" depois do deploy | A Etapa 2 provavelmente não foi feita. Rode a migration no Supabase de produção e recarregue o app. |
| Erro no SQL "already exists" na Etapa 2 | A migration já tinha sido rodada. Está tudo certo, pode seguir. |
