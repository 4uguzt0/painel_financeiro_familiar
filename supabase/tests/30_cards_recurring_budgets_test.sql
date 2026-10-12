-- Testes da migration 20261012000001_cards_recurring_budgets
\set ON_ERROR_STOP on
\set QUIET on
\o /dev/null

create or replace function pg_temp.assert_eq(label text, got anyelement, expected anyelement)
returns void language plpgsql as $$
begin
  if got is distinct from expected then
    raise exception 'FAIL: % (esperado %, obtido %)', label, expected, got;
  end if;
  raise notice 'ok  %', label;
end $$;

create or replace function pg_temp.expect_error(label text, stmt text) returns void
language plpgsql as $$
begin
  execute stmt;
  raise exception 'FAIL: % (deveria ter falhado)', label;
exception when others then
  if sqlerrm like 'FAIL:%' then raise; end if;
  raise notice 'ok  % -> bloqueado', label;
end $$;

create or replace function pg_temp.login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claim.sub', uid::text, false);
$$;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000e1', 'e1@example.com'),
  ('00000000-0000-0000-0000-0000000000e2', 'e2@example.com');

set role authenticated;
select pg_temp.login('00000000-0000-0000-0000-0000000000e1');
select set_config('t.h', create_household('Família E')::text, false);

-- Conta corrente com R$ 5.000 desde o início do mês
update accounts set initial_balance_cents = 500000,
                    opened_on = date_trunc('month', current_date)::date
 where name = 'Conta Corrente';

-- ---------------------------------------------------------------- cartões
-- Cartão já com R$ 300 de fatura em aberto (saldo inicial negativo)
insert into accounts (household_id, name, kind, initial_balance_cents, opened_on)
values (current_setting('t.h')::uuid, 'Cartão Nubank', 'credit_card', -30000, date_trunc('month', current_date)::date);

create temp view ids as select
  (select id from accounts   where name = 'Conta Corrente') as cc,
  (select id from accounts   where name = 'Cartão Nubank')  as card,
  (select id from categories where name = 'Mercado')        as mercado,
  (select id from categories where name = 'Lazer')          as lazer,
  (select id from categories where name = 'Moradia')        as moradia,
  (select id from categories where name = 'Assinaturas')    as assin,
  (select id from categories where name = 'Salário')        as salario;

insert into transactions (household_id, occurred_on, type, amount_cents, category_id, to_account_id)
select current_setting('t.h')::uuid, date_trunc('month', current_date)::date, 'income', 600000, salario, cc from ids;

-- Compras no cartão: mercado R$ 400 + lazer R$ 250
insert into transactions (household_id, occurred_on, type, amount_cents, category_id, from_account_id)
select current_setting('t.h')::uuid, current_date, 'expense'::transaction_type, 40000, mercado, card from ids
union all
select current_setting('t.h')::uuid, current_date, 'expense', 25000, lazer, card from ids;

select pg_temp.assert_eq('cartão deve fatura antiga + compras (300 + 400 + 250)',
  (select owed_cents from v_card_summary where name = 'Cartão Nubank'), 95000::bigint);
select pg_temp.assert_eq('gasto no cartão no mês = R$ 650',
  (select month_spent_cents from v_card_summary where name = 'Cartão Nubank'), 65000::bigint);
select pg_temp.assert_eq('dívida do cartão já desconta do patrimônio',
  (select net_worth_cents from v_dashboard_summary), (500000 + 600000 - 95000)::bigint);

-- Pagar a fatura antiga (R$ 300): transferência conta -> cartão
insert into transactions (household_id, occurred_on, type, amount_cents, from_account_id, to_account_id)
select current_setting('t.h')::uuid, current_date, 'transfer', 30000, cc, card from ids;

select pg_temp.assert_eq('após pagar, cartão deve só as compras do mês',
  (select owed_cents from v_card_summary where name = 'Cartão Nubank'), 65000::bigint);
select pg_temp.assert_eq('pagar fatura não muda o patrimônio',
  (select net_worth_cents from v_dashboard_summary), (500000 + 600000 - 95000)::bigint);
select pg_temp.assert_eq('pagar fatura não conta como gasto',
  (select month_expense_cents from v_dashboard_summary), 65000::bigint);

-- ---------------------------------------------------------------- gastos fixos
insert into recurring_expenses (household_id, name, amount_cents, category_id, account_id, day_of_month)
select current_setting('t.h')::uuid, 'Aluguel', 200000, moradia, cc, 5 from ids
union all
select current_setting('t.h')::uuid, 'Streaming', 4590, assin, card, 31 from ids;

select pg_temp.assert_eq('2 fixos pendentes no mês',
  (select count(*) from v_recurring_month where transaction_id is null)::int, 2);
select pg_temp.assert_eq('dia 31 vira o último dia do mês',
  (select due_on from v_recurring_month where name = 'Streaming'),
  (date_trunc('month', current_date) + interval '1 month - 1 day')::date);

insert into transactions (household_id, occurred_on, type, amount_cents, description, category_id, from_account_id, recurring_id)
select current_setting('t.h')::uuid, (date_trunc('month', current_date)::date + 4), 'expense', 200000, 'Aluguel', moradia, cc,
       (select id from recurring_expenses where name = 'Aluguel') from ids;

select pg_temp.assert_eq('aluguel aparece como lançado',
  (select launched_cents from v_recurring_month where name = 'Aluguel'), 200000::bigint);

select pg_temp.expect_error('mesmo fixo duas vezes no mesmo mês', format(
  'insert into transactions (household_id, occurred_on, type, amount_cents, category_id, from_account_id, recurring_id)
   values (%L, %L, ''expense'', 1000, %L, %L, %L)',
  current_setting('t.h'), current_date, (select moradia from ids), (select cc from ids),
  (select id from recurring_expenses where name = 'Aluguel')));

select pg_temp.expect_error('fixo com categoria de receita', format(
  'insert into recurring_expenses (household_id, name, amount_cents, category_id, account_id, day_of_month)
   values (%L, ''X'', 100, %L, %L, 1)', current_setting('t.h'), (select salario from ids), (select cc from ids)));

select pg_temp.expect_error('dia do mês inválido', format(
  'insert into recurring_expenses (household_id, name, amount_cents, category_id, account_id, day_of_month)
   values (%L, ''X'', 100, %L, %L, 32)', current_setting('t.h'), (select moradia from ids), (select cc from ids)));

-- Excluir o fixo mantém o lançamento já feito (só desliga o vínculo)
delete from recurring_expenses where name = 'Aluguel';
select pg_temp.assert_eq('excluir fixo preserva o lançamento',
  (select count(*) from transactions where description = 'Aluguel' and recurring_id is null)::int, 1);

-- ---------------------------------------------------------------- orçamento
insert into budgets (household_id, category_id, amount_cents)
select current_setting('t.h')::uuid, mercado, 50000 from ids
union all
select current_setting('t.h')::uuid, lazer, 20000 from ids;

select pg_temp.assert_eq('mercado usou 80% do orçamento',
  (select used_ratio from v_budget_status where category = 'Mercado'), 0.8000::numeric);
select pg_temp.assert_eq('lazer estourou em R$ 50',
  (select remaining_cents from v_budget_status where category = 'Lazer'), -5000::bigint);

select pg_temp.assert_eq('orçamento total = R$ 700',
  (select total_budget_cents from v_budget_summary), 70000::bigint);
select pg_temp.assert_eq('1 categoria em alerta (>= 80%) e 1 estourada',
  (select categories_warning || '/' || categories_over from v_budget_summary), '1/1');
select pg_temp.assert_eq('gasto fora do orçamento = aluguel R$ 2.000',
  (select unbudgeted_spent_cents from v_budget_summary), 200000::bigint);
select pg_temp.assert_eq('economia prevista = 6.000 − 700 − 2.000',
  (select planned_savings_cents from v_budget_summary), 330000::bigint);
select pg_temp.assert_eq('taxa de poupança prevista = 55%',
  (select planned_savings_rate from v_budget_summary), 0.5500::numeric);

select pg_temp.expect_error('orçamento em categoria de receita', format(
  'insert into budgets (household_id, category_id, amount_cents) values (%L, %L, 100)',
  current_setting('t.h'), (select salario from ids)));
select pg_temp.expect_error('orçamento zerado', format(
  'update budgets set amount_cents = 0 where category_id = %L', (select mercado from ids)));

-- ---------------------------------------------------------------- isolamento
select set_config('t.card', (select card::text from ids), false);
select set_config('t.mercado', (select mercado::text from ids), false);

select pg_temp.login('00000000-0000-0000-0000-0000000000e2');
select set_config('t.h2', create_household('Família F')::text, false);

select pg_temp.assert_eq('outra família não vê cartões, fixos nem orçamento',
  (select count(*) from v_card_summary)::int + (select count(*) from recurring_expenses)::int
  + (select count(*) from budgets)::int, 0);
select pg_temp.expect_error('criar orçamento na família alheia', format(
  'insert into budgets (household_id, category_id, amount_cents) values (%L, %L, 100)',
  current_setting('t.h'), current_setting('t.mercado')));
select pg_temp.expect_error('fixo apontando para cartão de outra família', format(
  'insert into recurring_expenses (household_id, name, amount_cents, category_id, account_id, day_of_month)
   values (%L, ''X'', 100, (select id from categories where name = ''Moradia''), %L, 1)',
  current_setting('t.h2'), current_setting('t.card')));

reset role;
\o
\echo '✔ Testes de cartões, fixos e orçamento passaram'
