-- =============================================================================
-- Testes do schema: regras de negócio, indicadores e isolamento entre famílias.
-- Rodar:  ./scripts/test-db.sh   (Postgres local, sem Supabase)
-- Qualquer falha interrompe com "FAIL: ...".
-- =============================================================================
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

create or replace function pg_temp.login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claim.sub', uid::text, false);
$$;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'augusto@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'esposa@example.com'),
  ('00000000-0000-0000-0000-00000000000c', 'outra.familia@example.com');

set role authenticated;

-- ---------------------------------------------------------------- setup
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select set_config('t.hid', create_household('Família Silva')::text, false);
select set_config('t.code', create_invite(current_setting('t.hid')::uuid), false);

select pg_temp.login('00000000-0000-0000-0000-00000000000b');
select pg_temp.assert_eq('esposa entra com convite',
  join_household(current_setting('t.code'))::text, current_setting('t.hid'));

select pg_temp.login('00000000-0000-0000-0000-00000000000c');
select set_config('t.hid_c', create_household('Outra Família')::text, false);

-- ---------------------------------------------------------------- lançamentos (Augusto)
select pg_temp.login('00000000-0000-0000-0000-00000000000a');

select pg_temp.assert_eq('família nova recebe 5 contas padrão',
  (select count(*) from accounts)::int, 5);
select pg_temp.assert_eq('família nova recebe 13 categorias padrão',
  (select count(*) from categories)::int, 13);

-- Poupança já existia no mês passado com R$ 10.000
update accounts set initial_balance_cents = 1000000,
                    opened_on = (date_trunc('month', current_date) - interval '1 month')::date
 where name = 'Poupança';

create temp view ids as select
  (select id from accounts   where name = 'Conta Corrente') as cc,
  (select id from accounts   where name = 'Poupança')       as poup,
  (select id from categories where name = 'Salário')        as salario,
  (select id from categories where name = 'Mercado')        as mercado;

insert into transactions (household_id, type, amount_cents, description, category_id, to_account_id)
select current_setting('t.hid')::uuid, 'income', 450000, 'Salário', salario, cc from ids;

insert into transactions (household_id, type, amount_cents, description, category_id, from_account_id)
select current_setting('t.hid')::uuid, 'expense', 65000, 'Mercado do mês', mercado, cc from ids;

insert into transactions (household_id, type, amount_cents, from_account_id, to_account_id)
select current_setting('t.hid')::uuid, 'transfer', 100000, cc, poup from ids;

-- Empréstimo ao João: R$ 500, recebeu R$ 200
insert into loans (household_id, kind, counterparty, principal_cents, installments)
values (current_setting('t.hid')::uuid, 'third_party', 'João', 50000, 1);
insert into transactions (household_id, type, amount_cents, loan_id, from_account_id)
select current_setting('t.hid')::uuid, 'loan_out', 50000, (select id from loans where counterparty='João'), cc from ids;
insert into transactions (household_id, type, amount_cents, loan_id, to_account_id)
select current_setting('t.hid')::uuid, 'loan_in', 20000, (select id from loans where counterparty='João'), cc from ids;

-- Autoempréstimo: Notebook R$ 3.000 em 6x, já devolveu 1 parcela
insert into loans (household_id, kind, counterparty, principal_cents, installments)
values (current_setting('t.hid')::uuid, 'self', 'Notebook', 300000, 6);
insert into transactions (household_id, type, amount_cents, loan_id, from_account_id, to_account_id)
select current_setting('t.hid')::uuid, 'self_loan_out', 300000, (select id from loans where counterparty='Notebook'), poup, cc from ids;
insert into transactions (household_id, type, amount_cents, loan_id, from_account_id, to_account_id)
select current_setting('t.hid')::uuid, 'self_loan_return', 50000, (select id from loans where counterparty='Notebook'), cc, poup from ids;

-- ---------------------------------------------------------------- indicadores
select pg_temp.assert_eq('saldo Conta Corrente = 4500-650-1000-500+200+3000-500',
  (select balance_cents from v_account_balances where name='Conta Corrente'), 505000::bigint);
select pg_temp.assert_eq('saldo Poupança = 10000+1000-3000+500',
  (select balance_cents from v_account_balances where name='Poupança'), 850000::bigint);

select pg_temp.assert_eq('empréstimo João: parcial',
  (select status from v_loan_status where counterparty='João'), 'partial');
select pg_temp.assert_eq('empréstimo João: a receber R$ 300',
  (select outstanding_cents from v_loan_status where counterparty='João'), 30000::bigint);
select pg_temp.assert_eq('autoempréstimo: parcela de R$ 500',
  (select installment_cents from v_loan_status where counterparty='Notebook'), 50000::bigint);

select pg_temp.assert_eq('taxa de poupança = (4500-650)/4500',
  (select month_savings_rate from v_dashboard_summary), 0.8556::numeric);
select pg_temp.assert_eq('patrimônio líquido = contas 13.550 + a receber 300',
  (select net_worth_cents from v_dashboard_summary), 1385000::bigint);
select pg_temp.assert_eq('autoempréstimo pendente R$ 2.500',
  (select self_loan_outstanding_cents from v_dashboard_summary), 250000::bigint);
select pg_temp.assert_eq('variação do patrimônio = receitas - despesas do mês',
  (select net_worth_change_cents from v_dashboard_summary), 385000::bigint);
select pg_temp.assert_eq('despesas por categoria: Mercado R$ 650',
  (select total_cents from v_expenses_by_category where category='Mercado'), 65000::bigint);

-- ---------------------------------------------------------------- regras inválidas
create or replace function pg_temp.expect_error(label text, stmt text) returns void
language plpgsql as $$
begin
  execute stmt;
  raise exception 'FAIL: % (deveria ter falhado)', label;
exception when others then
  if sqlerrm like 'FAIL:%' then raise; end if;
  raise notice 'ok  % -> bloqueado', label;
end $$;

select pg_temp.expect_error('receita com categoria de despesa', format(
  'insert into transactions (household_id,type,amount_cents,category_id,to_account_id) values (%L,''income'',100,%L,%L)',
  current_setting('t.hid'), (select mercado from ids), (select cc from ids)));
select pg_temp.expect_error('despesa sem categoria', format(
  'insert into transactions (household_id,type,amount_cents,from_account_id) values (%L,''expense'',100,%L)',
  current_setting('t.hid'), (select cc from ids)));
select pg_temp.expect_error('valor negativo', format(
  'insert into transactions (household_id,type,amount_cents,from_account_id,to_account_id) values (%L,''transfer'',-1,%L,%L)',
  current_setting('t.hid'), (select cc from ids), (select poup from ids)));
select pg_temp.expect_error('transferência para a mesma conta', format(
  'insert into transactions (household_id,type,amount_cents,from_account_id,to_account_id) values (%L,''transfer'',100,%L,%L)',
  current_setting('t.hid'), (select cc from ids), (select cc from ids)));
select pg_temp.expect_error('autoempréstimo ligado a empréstimo de terceiro', format(
  'insert into transactions (household_id,type,amount_cents,loan_id,from_account_id,to_account_id) values (%L,''self_loan_out'',100,%L,%L,%L)',
  current_setting('t.hid'), (select id from loans where counterparty='João'), (select poup from ids), (select cc from ids)));
select pg_temp.expect_error('convite reutilizado',
  format('select join_household(%L)', current_setting('t.code')));

-- Guarda IDs da família A para tentar acessar como outro usuário
select set_config('t.cc_a', (select cc::text from ids), false);
select set_config('t.mercado_a', (select mercado::text from ids), false);

-- ---------------------------------------------------------------- esposa vê o mesmo painel
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
select pg_temp.assert_eq('esposa vê o mesmo patrimônio',
  (select net_worth_cents from v_dashboard_summary), 1385000::bigint);

-- ---------------------------------------------------------------- isolamento (RLS)
select pg_temp.login('00000000-0000-0000-0000-00000000000c');
select pg_temp.assert_eq('outra família não vê movimentações alheias',
  (select count(*) from transactions)::int, 0);
select pg_temp.assert_eq('outra família só vê o próprio painel',
  (select count(*) from v_dashboard_summary)::int, 1);
select pg_temp.expect_error('inserir na família de outra pessoa', format(
  'insert into transactions (household_id,type,amount_cents,from_account_id) values (%L,''transfer'',1,%L)',
  current_setting('t.hid'), current_setting('t.cc_a')));
select pg_temp.expect_error('usar categoria de outra família', format(
  'insert into transactions (household_id,type,amount_cents,category_id,from_account_id) values (%L,''expense'',100,%L,%L)',
  current_setting('t.hid_c'), current_setting('t.mercado_a'),
  (select id from accounts where name = 'Conta Corrente')));
select pg_temp.expect_error('chamar seed direto', format(
  'select seed_household_defaults(%L)', current_setting('t.hid_c')));

reset role;
\o
\echo
\echo '✔ Todos os testes passaram'
