-- =============================================================================
-- Dados de demonstração (6 meses) para prints do README e conta demo.
-- Uso: crie uma conta no app, crie a família, troque o e-mail abaixo e rode
-- este arquivo no SQL Editor do Supabase. NÃO rode na conta real da família.
-- =============================================================================
do $$
declare
  v_email text := 'demo@exemplo.com';   -- << troque aqui
  hid uuid; cc uuid; cc2 uuid; poup uuid; inv uuid;
  c_sal uuid; c_extra uuid; c_mora uuid; c_merc uuid; c_transp uuid; c_saude uuid; c_lazer uuid; c_assin uuid; c_edu uuid;
  m date; i int; lid uuid;
begin
  select household_id into hid from household_members hm join auth.users u on u.id = hm.user_id where u.email = v_email limit 1;
  if hid is null then raise exception 'Usuário % sem família. Crie a conta e a família no app primeiro.', v_email; end if;

  update accounts set name = 'Conta Augusto' where household_id = hid and name = 'Conta Corrente';
  insert into accounts (household_id, name, kind) values (hid, 'Conta Esposa', 'checking') on conflict do nothing;
  select id into cc   from accounts where household_id = hid and name = 'Conta Augusto';
  select id into cc2  from accounts where household_id = hid and name = 'Conta Esposa';
  select id into poup from accounts where household_id = hid and name = 'Poupança';
  select id into inv  from accounts where household_id = hid and name = 'Investimentos';

  m := (date_trunc('month', current_date) - interval '5 months')::date;
  update accounts set opened_on = m where household_id = hid;
  update accounts set initial_balance_cents = 1820000 where id = poup;
  update accounts set initial_balance_cents = 950000  where id = inv;
  update accounts set initial_balance_cents = 210000  where id = cc;
  update accounts set initial_balance_cents = 140000  where id = cc2;

  select id into c_sal    from categories where household_id = hid and name = 'Salário';
  select id into c_extra  from categories where household_id = hid and name = 'Extra';
  select id into c_mora   from categories where household_id = hid and name = 'Moradia';
  select id into c_merc   from categories where household_id = hid and name = 'Mercado';
  select id into c_transp from categories where household_id = hid and name = 'Transporte';
  select id into c_saude  from categories where household_id = hid and name = 'Saúde';
  select id into c_lazer  from categories where household_id = hid and name = 'Lazer';
  select id into c_assin  from categories where household_id = hid and name = 'Assinaturas';
  select id into c_edu    from categories where household_id = hid and name = 'Educação';

  for i in 0..5 loop
    m := (date_trunc('month', current_date) - make_interval(months => 5 - i))::date;
    -- mês corrente só até hoje
    continue when m + 4 > current_date;
    insert into transactions (household_id, occurred_on, type, amount_cents, description, category_id, to_account_id) values
      (hid, m + 4, 'income', 480000, 'Salário Augusto', c_sal, cc),
      (hid, m + 4, 'income', 410000, 'Salário Esposa',  c_sal, cc2);
    if i in (1, 4) then
      insert into transactions (household_id, occurred_on, type, amount_cents, description, category_id, to_account_id)
      values (hid, m + 18, 'income', 65000, 'Freela', c_extra, cc);
    end if;
    insert into transactions (household_id, occurred_on, type, amount_cents, description, category_id, from_account_id) values
      (hid, m + 5,  'expense', 240000, 'Aluguel e condomínio',            c_mora,   cc),
      (hid, least(m + 7, current_date),  'expense', 128000 + i * 4500, 'Mercado do mês',     c_merc,   cc2),
      (hid, least(m + 9, current_date),  'expense', 62000 + (i % 3) * 7000, 'Combustível e ônibus', c_transp, cc),
      (hid, least(m + 12, current_date), 'expense', 38000 + (i % 2) * 22000, 'Farmácia e consultas', c_saude, cc2),
      (hid, least(m + 14, current_date), 'expense', 52000 + (i % 3) * 14000, 'Passeios e restaurantes', c_lazer, cc),
      (hid, least(m + 15, current_date), 'expense', 18900, 'Streaming, internet e celular', c_assin, cc),
      (hid, least(m + 16, current_date), 'expense', 65000, 'Faculdade (ADS)', c_edu, cc);
    insert into transactions (household_id, occurred_on, type, amount_cents, description, from_account_id, to_account_id) values
      (hid, least(m + 6, current_date), 'transfer', 120000, 'Guardar no mês', cc2, poup),
      (hid, least(m + 6, current_date), 'transfer', 80000,  'Aporte', cc2, inv);
  end loop;

  -- Empréstimo para o irmão: R$ 1.200 em 4x, 2 parcelas pagas
  lid := create_loan(hid, 'third_party', 'Lucas (irmão)', 120000, 4,
                     (date_trunc('month', current_date) - interval '3 months')::date, cc);
  insert into transactions (household_id, occurred_on, type, amount_cents, loan_id, to_account_id, description) values
    (hid, (date_trunc('month', current_date) - interval '2 months')::date + 10, 'loan_in', 30000, lid, cc, 'Recebido de Lucas (irmão)'),
    (hid, (date_trunc('month', current_date) - interval '1 months')::date + 10, 'loan_in', 30000, lid, cc, 'Recebido de Lucas (irmão)');

  -- Autoempréstimo: notebook R$ 3.600 em 6x, 3 devolvidas
  lid := create_loan(hid, 'self', 'Notebook', 360000, 6,
                     (date_trunc('month', current_date) - interval '3 months')::date + 2, poup, cc);
  for i in 0..2 loop
    insert into transactions (household_id, occurred_on, type, amount_cents, loan_id, from_account_id, to_account_id, description)
    values (hid, (date_trunc('month', current_date) - make_interval(months => 2 - i))::date + 1,
            'self_loan_return', 60000, lid, cc, poup, 'Devolução: Notebook');
  end loop;
end $$;

-- v0.2: cartão de crédito, gastos fixos e orçamento (rode depois do bloco acima)
do $$
declare
  v_email text := 'demo@exemplo.com';   -- << o mesmo e-mail de cima
  hid uuid; cc uuid; card uuid; m date;
begin
  select household_id into hid from household_members hm join auth.users u on u.id = hm.user_id where u.email = v_email limit 1;
  select id into cc from accounts where household_id = hid and name = 'Conta Augusto';
  m := date_trunc('month', current_date)::date;

  insert into accounts (household_id, name, kind, initial_balance_cents, opened_on)
  values (hid, 'Cartão Nubank', 'credit_card', -84000, m - interval '1 month')
  returning id into card;

  -- Compras do mês no cartão (mercado e lazer passam a sair do cartão)
  update transactions set from_account_id = card
   where household_id = hid and occurred_on >= m
     and description in ('Passeios e restaurantes', 'Streaming, internet e celular');
  insert into transactions (household_id, occurred_on, type, amount_cents, description, category_id, from_account_id)
  values (hid, least(m + 9, current_date), 'expense', 38600, 'Feira e açougue',
          (select id from categories where household_id = hid and name = 'Mercado'), card);

  -- Fatura do mês passado paga
  insert into transactions (household_id, occurred_on, type, amount_cents, description, from_account_id, to_account_id)
  values (hid, least(m + 2, current_date), 'transfer', 84000, null, cc, card);

  -- Gastos fixos (aluguel e faculdade já lançados; internet pendente)
  insert into recurring_expenses (household_id, name, amount_cents, category_id, account_id, day_of_month) values
    (hid, 'Aluguel e condomínio', 240000, (select id from categories where household_id = hid and name = 'Moradia'), cc, 5),
    (hid, 'Faculdade (ADS)',       65000, (select id from categories where household_id = hid and name = 'Educação'), cc, 10),
    (hid, 'Luz',                   18000, (select id from categories where household_id = hid and name = 'Moradia'), cc, 20),
    (hid, 'Internet e celular',    18900, (select id from categories where household_id = hid and name = 'Assinaturas'), card, 25);
  update transactions t set recurring_id = r.id
    from recurring_expenses r
   where r.household_id = hid and t.household_id = hid and t.occurred_on >= m
     and t.description = r.name and t.description in ('Aluguel e condomínio', 'Faculdade (ADS)');

  -- Orçamento mensal
  insert into budgets (household_id, category_id, amount_cents)
  select hid, id, v from (values ('Mercado', 210000), ('Lazer', 120000), ('Transporte', 100000), ('Saúde', 50000), ('Moradia', 310000)) b(n, v)
  join categories c on c.household_id = hid and c.name = b.n;
end $$;
