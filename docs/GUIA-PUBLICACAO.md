# Guia de publicação — do zip ao app no celular

Este guia é para quem **não programa**. Você não vai digitar nenhum comando: tudo é feito
clicando em sites e em um aplicativo. Tempo estimado: **40 a 60 minutos**. Custo: **zero**.

No final você terá:

- o código no **GitHub** (seu portfólio público);
- o banco de dados no **Supabase** (onde ficam os lançamentos);
- o app no ar pela **Vercel**, com um endereço tipo `caderneta-augusto.vercel.app`;
- o app instalado no seu celular e no da sua esposa.

> **Como as três peças conversam:** a Vercel mostra as telas, o Supabase guarda os dados,
> o GitHub guarda o código. Quando o código muda no GitHub, a Vercel atualiza o app sozinha.

Antes de começar, abra um bloco de notas. Em alguns passos você vai **copiar e guardar** valores
(marcados com 📋).

---

## Parte 1 — Preparar a pasta (2 min)

1. Baixe o arquivo `painel-financeiro-familiar.zip`.
2. Clique com o botão direito → **Extrair tudo** (Windows) ou dê dois cliques (Mac).
3. Mova a pasta `painel-financeiro-familiar` para um lugar fácil, como `Documentos`.

---

## Parte 2 — GitHub: publicar o código (10 min)

### 2.1 Criar a conta
1. Acesse **github.com** → **Sign up**. Use seu e-mail e escolha um nome de usuário
   profissional (ex.: `augustosilva-dados`) — ele aparece no link do portfólio.

### 2.2 Instalar o GitHub Desktop
O GitHub Desktop é um aplicativo que envia a pasta para o GitHub sem precisar de comandos.

1. Acesse **desktop.github.com** → baixe e instale.
2. Abra o app → **Sign in to GitHub.com** → autorize no navegador.
3. Se pedir nome e e-mail ("Configure Git"), confirme os dados e clique em **Finish**.

### 2.3 Publicar
1. No GitHub Desktop: menu **File → Add local repository…**
2. Clique em **Choose…** e selecione a pasta `painel-financeiro-familiar` → **Add repository**.
   (A pasta já vem com o primeiro "commit" pronto — é o histórico inicial do projeto.)
3. Clique no botão azul **Publish repository** (no topo).
4. Na janela que abrir:
   - **Name:** `painel-financeiro-familiar`
   - **Description:** `Micro-SaaS de finanças familiares — Next.js + Supabase + Postgres`
   - **Desmarque** "Keep this code private" (para aparecer no portfólio).
     *Não há senhas nem dados no código — pode ser público com segurança.*
5. **Publish repository**. Pronto: abra `github.com/SEU-USUARIO/painel-financeiro-familiar`
   e confira os arquivos lá.

---

## Parte 3 — Supabase: criar o banco de dados (15 min)

### 3.1 Criar o projeto
1. Acesse **supabase.com** → **Start your project** → entre com sua conta do **GitHub**.
2. Crie uma organização se pedir (nome: o seu; plano: **Free**).
3. **New project**:
   - **Name:** `caderneta`
   - **Database Password:** clique em **Generate a password** → 📋 copie e guarde no bloco de notas.
   - **Region:** **South America (São Paulo)** — deixa o app mais rápido no Brasil.
4. **Create new project** e espere 1–2 minutos até o painel carregar.

### 3.2 Instalar as tabelas (o "coração" do app)
1. Na pasta do projeto, abra o arquivo `supabase/setup-completo.sql` com o **Bloco de Notas**
   (Windows: botão direito → Abrir com → Bloco de Notas; Mac: TextEdit).
2. Selecione tudo (**Ctrl+A** / **Cmd+A**) e copie (**Ctrl+C** / **Cmd+C**).
3. No Supabase, menu lateral esquerdo → **SQL Editor** → **New query** (ou o **+**).
4. Cole (**Ctrl+V**) e clique em **Run** (canto inferior direito).
5. Se aparecer um aviso sobre "destructive operations" ou "RLS", clique em **Run this query**
   — é esperado, o script altera uma regra que ele mesmo criou.
6. Deve aparecer **"Success. No rows returned"**. Esse passo é feito **uma única vez**.

> Para conferir: menu **Table Editor** → devem aparecer as tabelas `accounts`, `categories`,
> `households`, `loans`, `transactions`…

### 3.3 Desligar a confirmação por e-mail
Sem isso, o cadastro fica esperando um e-mail de confirmação (o envio gratuito do Supabase é limitado).

1. Menu **Authentication** → **Sign In / Providers** (em algumas versões: *Providers*).
2. Abra **Email**.
3. **Desligue** a opção **Confirm email** → **Save**.

### 3.4 Copiar os dois "endereços" do banco
1. Clique no botão **Connect** no topo da página **ou** vá em **Project Settings** (engrenagem)
   → **API Keys** / **Data API**.
2. 📋 Copie o **Project URL** — algo como `https://abcdefghijk.supabase.co`.
3. 📋 Copie a chave **anon public** (ou **Publishable key**, que começa com `sb_publishable_`).
   *Qualquer uma das duas funciona. Essa chave é pública por natureza: quem protege os dados
   são as regras de segurança (RLS) instaladas no passo 3.2.*

> ⚠️ **Nunca** copie a chave **service_role** / **secret** para lugar nenhum do app.

---

## Parte 4 — Vercel: colocar o app no ar (10 min)

1. Acesse **vercel.com** → **Sign Up** → plano **Hobby** → **Continue with GitHub**.
2. Na tela inicial: **Add New… → Project**.
3. Na lista do GitHub, ache `painel-financeiro-familiar` → **Import**.
   (Se não aparecer: **Adjust GitHub App Permissions** e libere o repositório.)
4. Em **Configure Project**:
   - **Project Name:** `caderneta-seunome` (vira o endereço do app).
   - **Framework Preset:** deve aparecer **Next.js** sozinho. Não mexa no resto.
   - Abra **Environment Variables** e adicione **duas** variáveis:

     | Key (nome) | Value (valor) |
     |---|---|
     | `NEXT_PUBLIC_SUPABASE_URL` | o 📋 Project URL do passo 3.4 |
     | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | a 📋 chave anon/publishable do passo 3.4 |

     Copie os nomes **exatamente** como estão (letras maiúsculas e sublinhados).
5. **Deploy**. Espere 1–3 minutos. Quando aparecer a tela de parabéns, clique na imagem
   do site ou em **Continue to Dashboard → Visit**.
6. 📋 Guarde o endereço (ex.: `https://caderneta-augusto.vercel.app`).

---

## Parte 5 — Primeiro uso (10 min)

### 5.1 Você
1. Abra o endereço no **celular**.
2. **Criar conta** → e-mail e senha (mínimo 6 caracteres).
3. Na tela **"Falta um passo"** → **Criar a família** (ex.: "Família Silva").
4. Você cai no painel. Siga o quadro verde **"Bem-vindos!"**:
   - **Mais → Contas:** toque em cada conta e preencha o **saldo inicial** = saldo de hoje no banco.
     Renomeie como quiser (ex.: "Conta Augusto", "Nubank Esposa"). Crie e arquive contas à vontade.
   - **Lançar:** registre os salários do mês como **Receita**.

### 5.2 Instalar como app
- **Android (Chrome):** menu **⋮** → **Instalar app** ou **Adicionar à tela inicial**.
- **iPhone (Safari):** botão **Compartilhar** (quadrado com seta) → **Adicionar à Tela de Início**.

O ícone verde da "Caderneta" aparece junto com os outros apps e abre em tela cheia.

### 5.3 Sua esposa
1. No seu celular: **Mais → Família → Gerar código de convite** → envie o código para ela.
2. No celular dela: abrir o endereço → **Criar conta** → na tela **"Falta um passo"**,
   digitar o código → **Entrar na família**.
3. Pronto: os dois veem e lançam no mesmo painel.

### 5.4 (Recomendado) Fechar o cadastro
Depois que vocês dois tiverem conta, impeça desconhecidos de criar contas no seu app:
Supabase → **Authentication → Sign In / Providers** → desligue **Allow new users to sign up** → **Save**.
*(Mesmo aberto, ninguém veria seus dados — cada família é isolada — mas fechado é mais limpo.)*

---

## Parte 6 — Manutenção (2 min por mês)

| O quê | Por quê | Como |
|---|---|---|
| **Usar ao menos 1× por semana** | O Supabase gratuito **pausa** projetos sem uso por 7 dias (avisa por e-mail antes). | Lançando normalmente, nunca pausa. Se pausar: supabase.com → projeto → **Resume project**. Nada é perdido. |
| **Backup mensal** | O plano gratuito não guarda cópias que você possa baixar. | No app: **Mais → Baixar lançamentos (CSV)**. Guarde no Google Drive. |
| **Esqueceu a senha** | O app ainda não tem "esqueci minha senha". | A outra pessoa gera um convite; crie uma conta nova com outro e-mail e entre na família. Os dados continuam todos lá. |

---

## Parte 7 — Como evoluir o app depois

1. Abra a pasta no **Claude Code** e peça a mudança (o arquivo `CLAUDE.md` já explica as regras do projeto para ele).
2. Teste no computador, se quiser (`README.md` → "Rodando localmente").
3. No **GitHub Desktop**: escreva um resumo da mudança em **Summary** → **Commit to main** → **Push origin**.
4. A **Vercel atualiza o app sozinha** em 1–2 minutos.
5. **Se a mudança criou um arquivo novo em `supabase/migrations/`**, rode só esse arquivo novo
   no **SQL Editor** do Supabase (igual ao passo 3.2). Nunca rode o `setup-completo.sql` de novo.

---

## Problemas comuns

| Sintoma | Causa provável | Solução |
|---|---|---|
| Tela "Application error" ou erro falando em `NEXT_PUBLIC_SUPABASE_URL` | Variáveis da Vercel faltando ou com nome errado | Vercel → projeto → **Settings → Environment Variables**: confira os nomes. Depois **Deployments → ⋯ → Redeploy**. |
| "Confirme o e-mail antes de entrar" | Confirmação de e-mail ligada | Passo 3.3. Para a conta já criada: Supabase → **Authentication → Users** → ⋯ → **Confirm email** (ou apague e crie de novo). |
| "Não foi possível salvar" em qualquer tela | Tabelas não instaladas ou instaladas pela metade | Supabase → **Table Editor**: se faltar tabela, rode o passo 3.2 num projeto novo. Detalhes do erro: Vercel → **Logs**. |
| Código de convite "inválido ou expirado" | Código já usado ou com mais de 7 dias | Gere outro em **Mais → Família**. |
| Saldo do app não bate com o banco | Faltou lançar algo, ou saldo inicial errado | Confira o extrato da semana; ajuste o saldo inicial em **Mais → Contas**. |
| App não carrega / muito lento depois de dias parado | Projeto Supabase pausado | supabase.com → **Resume project**. |

---

## Glossário rápido

- **GitHub:** "Google Drive" do código, com histórico de todas as mudanças. É onde recrutadores veem seu projeto.
- **Commit:** um "salvar versão" do código, com uma descrição do que mudou.
- **Supabase:** serviço que hospeda o banco de dados (Postgres) e o login dos usuários.
- **Vercel:** serviço que hospeda as telas do app e as publica num endereço na internet.
- **Variável de ambiente:** configuração secreta/externa que o app lê ao rodar (aqui: o endereço e a chave do banco).
- **RLS (Row Level Security):** regras dentro do banco que garantem que cada família só enxerga os próprios dados.
- **Migration:** arquivo SQL que cria ou altera as tabelas, numerado por data.
