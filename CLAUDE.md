# CLAUDE.md — Caderneta (Painel Financeiro Familiar)

Instruções para o Claude Code trabalhar neste repositório. Leia também
`docs/PRD.md`, `docs/DATA_MODEL.md` e `docs/ROADMAP.md` antes de começar um marco.

## O produto em uma frase
App web (PWA, mobile-first) para um casal administrar o patrimônio da família com
o mínimo de lançamentos. O indicador principal é a **taxa de poupança mensal**.

## Stack
- Next.js (App Router, TypeScript strict, Server Components + Server Actions)
- Supabase: Postgres, Auth (e-mail + senha, confirmação de e-mail desligada), RLS — cliente via `@supabase/ssr`,
  sempre no servidor (`src/lib/supabase/server.ts`); não há cliente Supabase no navegador
- Tailwind CSS 4 com componentes próprios em `src/components/ui.tsx` (sem shadcn) · Recharts · Zod
- Testes: SQL (`npm run test:db`) · Vitest (`npm test`) · Playwright (`npm run test:e2e`)
- Deploy: Vercel + Supabase Cloud (plano gratuito)

## Regras inegociáveis
1. **Dinheiro é sempre inteiro em centavos** (`amount_cents`, `bigint`). Nunca `float`.
   Converter só na borda com `src/lib/money.ts` (`parseBRL`, `formatBRL`, `maskFromDigits`).
2. **Não recalcular indicadores no frontend.** Saldo, patrimônio, taxa de poupança,
   status de empréstimo vêm das views `v_*`. Se faltar um indicador, crie/alterar uma view
   em uma **nova migration** + teste em `supabase/tests/`.
3. **Nunca editar uma migration já commitada.** Sempre criar uma nova
   (`supabase/migrations/AAAAMMDDHHMMSS_nome.sql`) e depois rodar `npm run setup-sql`
   para atualizar `supabase/setup-completo.sql`. Avise o usuário que a migration nova
   precisa ser executada no SQL Editor do Supabase de produção.
4. **Segurança é do banco.** Toda tabela nova tem `household_id`, RLS habilitado e
   policy `is_member(household_id)`. Views novas usam `with (security_invoker = true)`.
   A chave `service_role` nunca vai para o cliente nem para Server Actions comuns.
5. **Formato de lançamento por tipo** está no `CHECK shape_by_type`. O formulário deve
   mostrar só os campos que o tipo exige (ver tabela em `docs/DATA_MODEL.md`).
6. Interface em **português do Brasil**, datas `dd/mm/aaaa`, moeda `R$`.
   Código, nomes de tabelas, variáveis e commits em **inglês**.
7. Mobile-first: tudo precisa funcionar bem em 380 px de largura.

## Convenções
- Tipos do banco escritos à mão em `src/types/db.ts` — atualize junto com cada migration.
- Estrutura: `src/app/(app)/<rota>` (telas logadas), `src/actions/*.ts` (Server Actions),
  `src/components/`, `src/lib/` (money, dates, session, errors, queries).
- `getSession()` (src/lib/session.ts) devolve supabase + usuário + família; use em toda tela/ação logada.
- Mutations via Server Actions com validação Zod; retornam `FormState`; `revalidatePath("/", "layout")` após gravar.
- Erros do Postgres passam por `friendlyError()` (mensagem em pt-BR que diz o que fazer).
- Datas: sempre `todayISO()`/`currentMonth()` (fuso America/Sao_Paulo), nunca `new Date()` cru.
- `cx()` fica em `src/lib/cx.ts` (não importe utilitários de arquivos "use client" em Server Components).
- Commits: Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`, `chore:`), pequenos e frequentes.

## Comandos
```bash
supabase start            # stack local (Postgres, Auth, Studio)
supabase db reset         # reaplica migrations do zero
npm run test:db           # testes SQL (precisa PGHOST/PGUSER apontando para um Postgres)
npm run setup-sql         # regenera supabase/setup-completo.sql
npm run dev | build | lint | test | test:e2e
```

## Como trabalhar
- Um item do `docs/ROADMAP.md` por vez. Ao terminar: `npm run lint`, `npm test`, `npm run build`
  passando (e `npm run test:db` se mexeu no banco), README atualizado se algo mudou para quem
  for rodar o projeto, e checklist marcado.
- O usuário não é programador: ao final, explique em linguagem simples o que mudou e se é
  preciso rodar algo no Supabase.
- Escopo enxuto: se uma ideia não está no marco atual, anote em "Ideias" no ROADMAP em vez de implementar.
- Em dúvida de regra de negócio, pergunte antes de inventar.
