-- Testes da migration 20261009000001_app_support
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
  ('00000000-0000-0000-0000-0000000000d1', 'd1@example.com'),
  ('00000000-0000-0000-0000-0000000000d2', 'd2@example.com');

set role authenticated;
select pg_temp.login('00000000-0000-0000-0000-0000000000d1');
select set_config('t.h', create_household('Família D')::text, false);

select pg_temp.assert_eq('primeiro mês: variação do patrimônio é nula',
  (select net_worth_change_cents from v_dashboard_summary), null::bigint);

-- create_loan (terceiro): cria empréstimo e lançamento de saída juntos
select set_config('t.loan', create_loan(
  current_setting('t.h')::uuid, 'third_party', 'Maria', 80000, 2, current_date,
  (select id from accounts where name = 'Conta Corrente'))::text, false);

select pg_temp.assert_eq('create_loan gera 1 lançamento loan_out',
  (select count(*) from transactions where loan_id = current_setting('t.loan')::uuid and type = 'loan_out')::int, 1);
select pg_temp.assert_eq('saldo da conta cai R$ 800',
  (select balance_cents from v_account_balances where name = 'Conta Corrente'), -80000::bigint);

-- create_loan (auto): poupança -> conta corrente
select set_config('t.self', create_loan(
  current_setting('t.h')::uuid, 'self', 'Geladeira', 200000, 4, current_date,
  (select id from accounts where name = 'Poupança'),
  (select id from accounts where name = 'Conta Corrente'))::text, false);
select pg_temp.assert_eq('autoempréstimo move poupança -> corrente',
  (select balance_cents from v_account_balances where name = 'Conta Corrente'), 120000::bigint);

-- atomicidade: conta inválida => nem o empréstimo fica gravado
do $$ begin
  perform create_loan(current_setting('t.h')::uuid, 'self', 'Falha', 1000, 1, current_date,
                      (select id from accounts where name = 'Poupança'), null);
  raise exception 'FAIL: deveria falhar';
exception when others then
  if sqlerrm like 'FAIL:%' then raise; end if;
end $$;
select pg_temp.assert_eq('create_loan com erro não deixa empréstimo órfão',
  (select count(*) from loans where counterparty = 'Falha')::int, 0);

-- excluir empréstimo apaga lançamentos
delete from loans where id = current_setting('t.loan')::uuid;
select pg_temp.assert_eq('excluir empréstimo remove seus lançamentos',
  (select count(*) from transactions where type = 'loan_out')::int, 0);

-- membros com e-mail
select pg_temp.assert_eq('lista de membros traz e-mail',
  (select email from household_members_list(current_setting('t.h')::uuid)), 'd1@example.com');

select pg_temp.login('00000000-0000-0000-0000-0000000000d2');
select pg_temp.assert_eq('não-membro não vê membros de outra família',
  (select count(*) from household_members_list(current_setting('t.h')::uuid))::int, 0);
select pg_temp.assert_eq('não-membro não cria empréstimo em outra família',
  (select count(*) from loans)::int, 0);

reset role;
\o
\echo '✔ Testes de app_support passaram'
