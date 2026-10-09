# Roadmap

## ✅ v0.1 — MVP que a família usa (entregue)

- [x] Login por e-mail e senha, rotas protegidas, layout mobile com navegação inferior
- [x] Família compartilhada: criar, convidar por código, renomear, lista de membros
- [x] Contas (saldo inicial, arquivar) e categorias (criar, renomear, arquivar)
- [x] Lançamento rápido: receita, despesa, transferência; lembra a última conta
- [x] Extrato mensal agrupado por dia, filtros, edição e exclusão
- [x] Painel: taxa de poupança em destaque, patrimônio + gráfico 12 meses, gastos por categoria, saldos
- [x] Empréstimos a terceiros e autoempréstimos (criação atômica, parcelas, recebimentos/devoluções)
- [x] Exportação CSV
- [x] PWA (manifest, ícones, service worker), tema claro/escuro
- [x] Testes: 34 SQL, 18 unitários, 4 ponta a ponta · CI no GitHub Actions
- [x] Guia de publicação (GitHub + Supabase + Vercel)

**Antes de evoluir:** usem por 3–4 semanas. O que vocês sentirem falta no uso real vale mais
que qualquer item abaixo.

---

## v0.2 — Mais visão

Cada item cabe em 1–2 semanas com ~4 h/semana. Cole o prompt no Claude Code, dentro da pasta do projeto.

### Metas
- [ ] Tabela `goals` (nome, valor alvo, conta vinculada opcional, data alvo opcional)
- [ ] Progresso = saldo da conta vinculada (ou soma de contas) ÷ alvo
- [ ] Projeção: no ritmo médio de poupança dos últimos 3 meses, quando a meta é atingida
- [ ] Card de meta no painel (ex.: "Entrada do imóvel: 38% — previsão mar/2028")

> **Prompt:** Leia CLAUDE.md e docs/. Implemente o item "Metas" da v0.2 do ROADMAP: nova migration com a tabela goals (com RLS e testes SQL), uma view com progresso e projeção de data, tela em Mais → Metas e um card no painel. Ao final, rode lint, testes e build, e me diga em linguagem simples o que preciso rodar no Supabase.

### Investimentos com valor de mercado
- [ ] Tabela `account_valuations` (conta, data, valor de mercado) — "fotografia" mensal
- [ ] Patrimônio passa a usar o valor de mercado mais recente quando existir
- [ ] Rentabilidade = valor de mercado − (saldo inicial + aportes − resgates)

> **Prompt:** Implemente o item "Investimentos com valor de mercado" da v0.2 do ROADMAP, seguindo as regras do CLAUDE.md (nova migration + testes SQL; nada de cálculo no frontend).

### Importação de extrato
- [ ] Upload de CSV/OFX do banco, prévia em tabela, escolher categoria por linha, importar em lote
- [ ] Sugestão de categoria pela descrição (regras simples: "IFOOD" → Lazer)

### Projeto de Dados (portfólio)
- [ ] Notebook Python (pandas + matplotlib) sobre o CSV exportado: sazonalidade dos gastos,
      taxa de poupança móvel, projeção de patrimônio e cenários para a entrada do imóvel
- [ ] Publicar o notebook no próprio repositório (`analytics/`) com dados fictícios do `demo-data.sql`

> **Prompt:** Crie a pasta analytics/ com um notebook Jupyter que lê o CSV exportado pelo app (formato em src/app/exportar/route.ts) e faz uma análise exploratória: gastos por categoria ao longo do tempo, taxa de poupança móvel de 3 meses e uma projeção simples de patrimônio. Use dados fictícios gerados a partir de supabase/demo-data.sql e explique cada gráfico em português.

## v0.3 — Conveniência
- [ ] "Esqueci minha senha" (requer SMTP próprio no Supabase, ex.: Resend)
- [ ] Lançamento por Telegram com IA ("mercado 57", "emprestei 500 pro João")
- [ ] Resumo mensal por e-mail
- [ ] Orçamento por categoria com alerta

## Ideias (fora do escopo por enquanto)
-
