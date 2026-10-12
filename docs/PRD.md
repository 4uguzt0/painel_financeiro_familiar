# PRD — Caderneta / Painel Financeiro Familiar (v0.1 — entregue)

## 1. Contexto
O casal já tentou planilha simples (pouca visão) e SaaS financeiro (exige cadastro demais e
acaba abandonado). O problema é de processo: o sistema pede mais disciplina do que a família
quer dedicar. Este produto inverte isso: **poucos lançamentos, indicadores automáticos**.

**Objetivo do produto:** administrar o patrimônio familiar rumo a metas de longo prazo
(ex.: entrada de um imóvel), não fazer microcontrole de gastos.

**Objetivo de portfólio:** demonstrar modelagem de dados, SQL analítico, segurança no banco
(RLS), testes e um produto completo em produção.

## 2. Usuários
- **Augusto** — cria a família, configura contas, faz o fechamento semanal.
- **Esposa** — lança gastos pelo celular, consulta o painel.

## 3. Regras de uso (o "processo")
- Lançar **valores consolidados**: "Mercado R$ 650", não cada item.
- Cartão de crédito é uma conta (v0.2): compra = despesa saindo do cartão; pagar fatura = transferência.
- Fechamento semanal de ~15 minutos (domingo): conferir saldos das contas com o banco.

## 4. Requisitos funcionais (v0.1)

### RF1 — Conta e família
- Login por e-mail e senha (confirmação de e-mail desligada no Supabase para simplificar).
- Primeiro acesso: criar família **ou** entrar com código de convite.
- Família nova já vem com contas e categorias padrão (editáveis).

### RF2 — Contas
- Tipos: corrente, poupança, reserva de emergência, investimentos, carteira.
- Cadastro com saldo inicial e data de abertura. Saldo atual sempre calculado.
- Arquivar (não excluir) contas com histórico.

### RF3 — Categorias
- Receita ou despesa. Criar, renomear, arquivar.

### RF4 — Lançamentos
- Tipos: receita, despesa, transferência, empréstimo concedido, recebimento de empréstimo,
  autoempréstimo, devolução de autoempréstimo.
- **Lançamento rápido**: valor → tipo (padrão despesa) → categoria → conta → salvar.
  Data padrão hoje. Meta: < 10 s no celular.
- Lista do mês com filtro por tipo/categoria/conta; editar e excluir.
- Investimento/resgate = transferência de/para uma conta do tipo investimentos.

### RF5 — Empréstimos a terceiros
- Cadastro: pessoa, valor, parcelas, data. Gera o lançamento de saída.
- Registrar recebimentos (parciais). Status automático: aberto / parcial / quitado.

### RF6 — Autoempréstimos
- Cadastro: motivo, valor, parcelas, conta de origem (poupança) e destino.
- Registrar devoluções. Mostra valor da parcela e saldo a devolver.

### RF7 — Dashboard (página inicial)
1. **Taxa de poupança do mês** (destaque, com cor: < 10% vermelho, 10–20% amarelo, > 20% verde)
2. Receitas, despesas e saldo do mês
3. Patrimônio líquido atual e variação vs. mês anterior
4. Gráfico de linha: patrimônio líquido dos últimos 12 meses
5. Gráfico de barras: despesas por categoria no mês
6. Cartões: total a receber de terceiros · saldo a devolver à poupança
7. Saldos por conta

### RF8 — Cartões, gastos fixos e orçamento (v0.2 — entregue)
- Tipo de conta "Cartão de crédito", tela de cartões, "Pagar fatura" com valor e contas preenchidos.
- Gastos fixos: cadastro único, lista do mês com valores ajustáveis, "Lançar" em lote (1 por mês).
- Orçamento mensal por categoria, economia prevista se cumprido, avisos no app em 80% e 100%
  (no painel e logo após lançar uma despesa).

## 5. Requisitos não funcionais
- Mobile-first e instalável (PWA). Bom em 380 px.
- Isolamento total entre famílias (RLS) — testado.
- Custo zero de infraestrutura (planos gratuitos).
- Interface em pt-BR; valores em R$.

## 6. Fora do escopo da v0.1
Metas, valor de mercado de investimentos, importação de extrato, avisos por e-mail,
notificações, lançamento por WhatsApp/Telegram, IA, recuperação de senha. Ver `ROADMAP.md`.
(Exportação CSV entrou na v0.1 como backup.)

## 7. Métricas de sucesso
- A família lança dados por **8 semanas seguidas** sem abandonar.
- Fechamento semanal em ≤ 15 min.
- Saldos do app batem com o banco no fechamento (diferença zero).
