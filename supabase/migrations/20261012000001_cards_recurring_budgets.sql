-- =============================================================================
-- v0.2 — Cartões de crédito, gastos fixos e orçamento mensal
--
-- Migration ADITIVA: não altera dados nem quebra a versão anterior do app.
--
--   1. account_kind ganha 'credit_card'. Cartão é uma conta que fica negativa:
--      compra = despesa saindo do cartão; pagar fatura = transferência p/ o cartão.
--   2. recurring_expenses: gastos fixos cadastrados uma vez e lançados todo mês.
--      transactions.recurring_id liga o lançamento ao fixo (1 por mês, no máximo).
--   3. budgets: limite mensal por categoria de despesa + views de acompanhamento.
--
-- Obs.: o novo valor do enum é comparado como texto (kind::text = 'credit_card')
-- para que este arquivo rode inteiro numa única transação (SQL Editor do Supabase).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Cartão de crédito
-- -----------------------------------------------------------------------------
alter type account_kind add value if not exists 'credit_card' after 'checking';

-- Resumo por cartão: quanto deve hoje e quanto gastou no mês corrente
create view v_card_summary with (security_invoker = true) as
  select a.household_id,
         a.id   as account_id,
         a.name,
         a.archived,
         b.balance_cents,
         greatest(-b.balance_cents, 0)::bigint as owed_cents,
         coalesce(sum(t.amount_cents) filter (
           where t.type = 'expense'
             and date_trunc('month', t.occurred_on) = date_trunc('month', current_date)
         ), 0)::bigint as month_spent_cents
    from accounts a
    join v_account_balances b on b.account_id = a.id
    left join transactions t on t.from_account_id = a.id
   where a.kind::text = 'credit_card'
   group by a.id, b.balance_cents;

-- -----------------------------------------------------------------------------
-- 2. Gastos fixos
-- -----------------------------------------------------------------------------
create table recurring_expenses (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references households(id) on delete cascade,
  name          text not null check (length(trim(name)) between 1 and 60),
  amount_cents  bigint not null check (amount_cents > 0),
  category_id   uuid not null,
  category_kind category_kind not null default 'expense' check (category_kind = 'expense'),
  account_id    uuid not null,
  day_of_month  int not null check (day_of_month between 1 and 31),
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  unique (household_id, id),
  foreign key (household_id, category_id, category_kind) references categories (household_id, id, kind),
  foreign key (household_id, account_id) references accounts (household_id, id)
);
create index on recurring_expenses (household_id) where active;

alter table transactions add column recurring_id uuid;
alter table transactions
  add constraint transactions_recurring_fkey
    foreign key (household_id, recurring_id)
    references recurring_expenses (household_id, id)
    on delete set null (recurring_id),
  add constraint recurring_only_expense
    check (recurring_id is null or type = 'expense');

-- Um mesmo fixo só pode ser lançado uma vez por mês
create unique index transactions_recurring_month_uq
  on transactions (recurring_id, (date_trunc('month', occurred_on::timestamp)))
  where recurring_id is not null;

-- Situação de cada fixo ativo no mês corrente
create view v_recurring_month with (security_invoker = true) as
  with m as (
    select date_trunc('month', current_date)::date as first_day,
           extract(day from date_trunc('month', current_date) + interval '1 month - 1 day')::int as last_day
  )
  select r.household_id,
         r.id            as recurring_id,
         r.name,
         r.amount_cents,
         r.category_id,
         c.name          as category,
         r.account_id,
         a.name          as account,
         r.day_of_month,
         (m.first_day + (least(r.day_of_month, m.last_day) - 1))::date as due_on,
         t.id            as transaction_id,
         t.amount_cents  as launched_cents,
         t.occurred_on   as launched_on
    from recurring_expenses r
    cross join m
    join categories c on c.id = r.category_id
    join accounts   a on a.id = r.account_id
    left join transactions t
      on t.recurring_id = r.id
     and date_trunc('month', t.occurred_on) = date_trunc('month', current_date)
   where r.active;

-- -----------------------------------------------------------------------------
-- 3. Orçamento mensal por categoria
-- -----------------------------------------------------------------------------
create table budgets (
  household_id  uuid not null references households(id) on delete cascade,
  category_id   uuid not null,
  category_kind category_kind not null default 'expense' check (category_kind = 'expense'),
  amount_cents  bigint not null check (amount_cents > 0),
  updated_at    timestamptz not null default now(),
  primary key (household_id, category_id),
  foreign key (household_id, category_id, category_kind)
    references categories (household_id, id, kind) on delete cascade
);

-- Uso do orçamento no mês corrente, por categoria
create view v_budget_status with (security_invoker = true) as
  select b.household_id,
         b.category_id,
         c.name                                   as category,
         b.amount_cents                           as budget_cents,
         coalesce(e.total_cents, 0)::bigint       as spent_cents,
         round(coalesce(e.total_cents, 0)::numeric / b.amount_cents, 4) as used_ratio,
         (b.amount_cents - coalesce(e.total_cents, 0))::bigint          as remaining_cents
    from budgets b
    join categories c on c.id = b.category_id
    left join v_expenses_by_category e
      on e.category_id = b.category_id
     and e.month = date_trunc('month', current_date)::date
   where not c.archived;

-- Resumo do orçamento + ECONOMIA PREVISTA se o orçamento for cumprido
--   renda de referência = receitas do mês (ou do mês anterior, se ainda não houver)
--   economia prevista   = renda − orçamento total − gastos em categorias sem orçamento
create view v_budget_summary with (security_invoker = true) as
  with bs as (
    select household_id,
           sum(budget_cents)::bigint                         as total_budget_cents,
           sum(spent_cents)::bigint                          as budgeted_spent_cents,
           sum(greatest(spent_cents - budget_cents, 0))::bigint as over_budget_cents,
           count(*) filter (where used_ratio >= 0.8 and used_ratio < 1)::int as categories_warning,
           count(*) filter (where used_ratio >= 1)::int      as categories_over
      from v_budget_status
     group by household_id
  ),
  cur as (
    select household_id, income_cents, expense_cents
      from v_monthly_cashflow where month = date_trunc('month', current_date)::date
  ),
  prev as (
    select household_id, income_cents
      from v_monthly_cashflow where month = (date_trunc('month', current_date) - interval '1 month')::date
  ),
  calc as (
    select bs.*,
           coalesce(cur.expense_cents, 0)::bigint                               as month_spent_cents,
           (coalesce(cur.expense_cents, 0) - bs.budgeted_spent_cents)::bigint   as unbudgeted_spent_cents,
           coalesce(nullif(cur.income_cents, 0), prev.income_cents, 0)::bigint  as income_ref_cents,
           (coalesce(cur.income_cents, 0) = 0 and coalesce(prev.income_cents, 0) > 0) as income_is_estimate
      from bs
      left join cur  on cur.household_id  = bs.household_id
      left join prev on prev.household_id = bs.household_id
  )
  select calc.*,
         (income_ref_cents - total_budget_cents - unbudgeted_spent_cents)::bigint as planned_savings_cents,
         round((income_ref_cents - total_budget_cents - unbudgeted_spent_cents)::numeric
               / nullif(income_ref_cents, 0), 4)                                  as planned_savings_rate,
         round(extract(day from current_date)::numeric
               / extract(day from date_trunc('month', current_date) + interval '1 month - 1 day'), 4) as month_progress
    from calc;

-- -----------------------------------------------------------------------------
-- Segurança
-- -----------------------------------------------------------------------------
alter table recurring_expenses enable row level security;
alter table budgets            enable row level security;

create policy recurring_expenses_member_all on recurring_expenses for all
  using (is_member(household_id)) with check (is_member(household_id));
create policy budgets_member_all on budgets for all
  using (is_member(household_id)) with check (is_member(household_id));

grant select, insert, update, delete on recurring_expenses, budgets to authenticated;
grant select on v_card_summary, v_recurring_month, v_budget_status, v_budget_summary to authenticated;
