-- ============================================================================
-- Caderneta — instalação completa do banco (gerado por scripts/build-setup-sql.sh)
-- Cole TUDO no Supabase → SQL Editor → New query → Run. Rode uma única vez.
-- ============================================================================

-- >>> 20261008000001_init.sql
-- =============================================================================
-- Painel Financeiro Familiar — schema inicial (v0.1)
-- Postgres 15+ / Supabase
--
-- Princípios:
--   * Valores sempre em CENTAVOS (bigint). Nunca float.
--   * Saldo de conta NÃO é digitado: saldo = saldo inicial + movimentações.
--   * Tudo pertence a uma "família" (household). RLS isola as famílias.
--   * Indicadores são VIEWS SQL (security_invoker) — a lógica de negócio
--     mora no banco, o frontend só exibe.
-- =============================================================================

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Tipos
-- -----------------------------------------------------------------------------
create type account_kind as enum (
  'checking',    -- conta corrente
  'savings',     -- poupança
  'emergency',   -- reserva de emergência
  'investment',  -- investimentos
  'cash'         -- carteira / dinheiro vivo
);

create type category_kind as enum ('income', 'expense');

create type loan_kind as enum (
  'third_party', -- empréstimo concedido a outra pessoa (vira "a receber")
  'self'         -- autoempréstimo: retirada da poupança que deve ser devolvida
);

create type transaction_type as enum (
  'income',            -- receita: entra em to_account
  'expense',           -- despesa: sai de from_account
  'transfer',          -- entre contas (inclui aplicar/resgatar investimento)
  'loan_out',          -- empréstimo concedido: sai de from_account
  'loan_in',           -- recebimento de empréstimo: entra em to_account
  'self_loan_out',     -- autoempréstimo: poupança -> outra conta
  'self_loan_return'   -- devolução de autoempréstimo: conta -> poupança
);

create type member_role as enum ('owner', 'member');

-- -----------------------------------------------------------------------------
-- Família e membros
-- -----------------------------------------------------------------------------
create table households (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(trim(name)) between 1 and 80),
  currency    char(3) not null default 'BRL',
  created_at  timestamptz not null default now()
);

create table household_members (
  household_id uuid not null references households(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  role         member_role not null default 'member',
  joined_at    timestamptz not null default now(),
  primary key (household_id, user_id)
);
create index on household_members (user_id);

create table household_invites (
  code         text primary key default upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8)),
  household_id uuid not null references households(id) on delete cascade,
  created_by   uuid not null references auth.users(id),
  expires_at   timestamptz not null default now() + interval '7 days',
  used_by      uuid references auth.users(id),
  used_at      timestamptz
);

-- -----------------------------------------------------------------------------
-- Cadastros
-- -----------------------------------------------------------------------------
create table accounts (
  id                    uuid primary key default gen_random_uuid(),
  household_id          uuid not null references households(id) on delete cascade,
  name                  text not null check (length(trim(name)) between 1 and 60),
  kind                  account_kind not null,
  initial_balance_cents bigint not null default 0,
  opened_on             date not null default current_date,
  archived              boolean not null default false,
  created_at            timestamptz not null default now(),
  unique (household_id, name),
  unique (household_id, id)              -- alvo de FKs compostas
);

create table categories (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name         text not null check (length(trim(name)) between 1 and 40),
  kind         category_kind not null,
  archived     boolean not null default false,
  unique (household_id, kind, name),
  unique (household_id, id, kind)
);

create table loans (
  id                 uuid primary key default gen_random_uuid(),
  household_id       uuid not null references households(id) on delete cascade,
  kind               loan_kind not null,
  counterparty       text not null check (length(trim(counterparty)) between 1 and 80),
                     -- third_party: nome da pessoa | self: motivo ("Notebook")
  principal_cents    bigint not null check (principal_cents > 0),
  installments       int not null default 1 check (installments between 1 and 120),
  started_on         date not null default current_date,
  notes              text,
  created_at         timestamptz not null default now(),
  unique (household_id, id, kind)
);

-- -----------------------------------------------------------------------------
-- Movimentações (tabela central)
-- -----------------------------------------------------------------------------
create table transactions (
  id               uuid primary key default gen_random_uuid(),
  household_id     uuid not null references households(id) on delete cascade,
  occurred_on      date not null default current_date,
  type             transaction_type not null,
  amount_cents     bigint not null check (amount_cents > 0),
  description      text check (length(description) <= 140),
  category_id      uuid,
  category_kind    category_kind,      -- desnormalizado p/ validar via FK
  from_account_id  uuid,
  to_account_id    uuid,
  loan_id          uuid,
  loan_kind        loan_kind,          -- desnormalizado p/ validar via FK
  created_by       uuid references auth.users(id) default auth.uid(),
  created_at       timestamptz not null default now(),

  -- Integridade multi-família: tudo referenciado é da MESMA família
  foreign key (household_id, from_account_id) references accounts (household_id, id),
  foreign key (household_id, to_account_id)   references accounts (household_id, id),
  foreign key (household_id, category_id, category_kind) references categories (household_id, id, kind),
  foreign key (household_id, loan_id, loan_kind) references loans (household_id, id, kind),

  constraint from_to_distinct check (from_account_id is distinct from to_account_id),

  -- Regras de formato por tipo de lançamento
  -- coalesce(..., false): em SQL, CHECK com resultado NULL passaria; aqui não.
  constraint shape_by_type check (coalesce(
    case type
      when 'income' then
        to_account_id is not null and from_account_id is null
        and category_kind = 'income' and loan_id is null
      when 'expense' then
        from_account_id is not null and to_account_id is null
        and category_kind = 'expense' and loan_id is null
      when 'transfer' then
        from_account_id is not null and to_account_id is not null
        and category_id is null and loan_id is null
      when 'loan_out' then
        from_account_id is not null and to_account_id is null
        and loan_kind = 'third_party' and category_id is null
      when 'loan_in' then
        to_account_id is not null and from_account_id is null
        and loan_kind = 'third_party' and category_id is null
      when 'self_loan_out' then
        from_account_id is not null and to_account_id is not null
        and loan_kind = 'self' and category_id is null
      when 'self_loan_return' then
        from_account_id is not null and to_account_id is not null
        and loan_kind = 'self' and category_id is null
    end, false)
  )
);

create index on transactions (household_id, occurred_on desc);
create index on transactions (loan_id) where loan_id is not null;
create index on transactions (from_account_id);
create index on transactions (to_account_id);

-- Preenche category_kind / loan_kind automaticamente a partir dos IDs,
-- para o frontend só mandar category_id / loan_id.
create function fill_denormalized_kinds() returns trigger
language plpgsql as $$
begin
  if new.category_id is not null then
    select kind into new.category_kind from categories where id = new.category_id;
  else
    new.category_kind := null;
  end if;
  if new.loan_id is not null then
    select kind into new.loan_kind from loans where id = new.loan_id;
  else
    new.loan_kind := null;
  end if;
  return new;
end $$;

create trigger trg_transactions_fill_kinds
before insert or update on transactions
for each row execute function fill_denormalized_kinds();

-- -----------------------------------------------------------------------------
-- Segurança: Row Level Security
-- -----------------------------------------------------------------------------
create function is_member(hid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from household_members
    where household_id = hid and user_id = auth.uid()
  );
$$;

alter table households        enable row level security;
alter table household_members enable row level security;
alter table household_invites enable row level security;
alter table accounts          enable row level security;
alter table categories        enable row level security;
alter table loans             enable row level security;
alter table transactions      enable row level security;

create policy household_read on households
  for select using (is_member(id));
create policy household_update on households
  for update using (is_member(id)) with check (is_member(id));

create policy members_read on household_members
  for select using (is_member(household_id));

create policy invites_read on household_invites
  for select using (is_member(household_id));

-- Mesma política (CRUD completo para membros) nas tabelas de dados
do $$
declare t text;
begin
  foreach t in array array['accounts','categories','loans','transactions'] loop
    execute format(
      'create policy %1$s_member_all on %1$s for all
         using (is_member(household_id)) with check (is_member(household_id))', t);
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- RPCs (criação de família e convite) — security definer controlado
-- -----------------------------------------------------------------------------
create function create_household(p_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare hid uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  insert into households (name) values (p_name) returning id into hid;
  insert into household_members (household_id, user_id, role)
    values (hid, auth.uid(), 'owner');
  perform seed_household_defaults(hid);
  return hid;
end $$;

create function create_invite(p_household uuid) returns text
language plpgsql security definer set search_path = public as $$
declare c text;
begin
  if not is_member(p_household) then raise exception 'not a member'; end if;
  insert into household_invites (household_id, created_by)
    values (p_household, auth.uid()) returning code into c;
  return c;
end $$;

create function join_household(p_code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare inv household_invites;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select * into inv from household_invites
   where code = upper(trim(p_code)) and used_at is null and expires_at > now()
   for update;
  if not found then raise exception 'invalid or expired invite'; end if;
  insert into household_members (household_id, user_id)
    values (inv.household_id, auth.uid()) on conflict do nothing;
  update household_invites set used_by = auth.uid(), used_at = now()
   where code = inv.code;
  return inv.household_id;
end $$;

-- Contas e categorias padrão para uma família nova
create function seed_household_defaults(hid uuid) returns void
language sql security definer set search_path = public as $$
  insert into categories (household_id, name, kind)
  select hid, n, 'income'::category_kind
  from unnest(array['Salário','Extra','Rendimentos']) n
  union all
  select hid, n, 'expense'::category_kind
  from unnest(array['Moradia','Mercado','Transporte','Saúde','Lazer',
                    'Assinaturas','Educação','Vestuário','Imprevistos','Outros']) n;

  insert into accounts (household_id, name, kind) values
    (hid, 'Conta Corrente',      'checking'),
    (hid, 'Poupança',            'savings'),
    (hid, 'Reserva Emergência',  'emergency'),
    (hid, 'Investimentos',       'investment'),
    (hid, 'Carteira',            'cash');
$$;

revoke execute on function seed_household_defaults(uuid) from public;
do $$ begin
  -- No Supabase, anon/authenticated recebem EXECUTE por default privileges
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke execute on function seed_household_defaults(uuid) from anon, authenticated;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- VIEWS de indicadores (security_invoker => respeitam o RLS do usuário)
-- -----------------------------------------------------------------------------

-- Fluxo assinado por conta: +entrada / -saída
create view v_account_flows with (security_invoker = true) as
  select household_id, to_account_id as account_id, occurred_on, amount_cents as delta_cents
    from transactions where to_account_id is not null
  union all
  select household_id, from_account_id, occurred_on, -amount_cents
    from transactions where from_account_id is not null;

-- Saldo atual de cada conta
create view v_account_balances with (security_invoker = true) as
  select a.household_id, a.id as account_id, a.name, a.kind, a.archived,
         (a.initial_balance_cents + coalesce(sum(f.delta_cents), 0))::bigint as balance_cents
    from accounts a
    left join v_account_flows f on f.account_id = a.id
   group by a.id;

-- Situação de cada empréstimo / autoempréstimo
create view v_loan_status with (security_invoker = true) as
  select l.household_id, l.id as loan_id, l.kind, l.counterparty,
         l.principal_cents, l.installments, l.started_on,
         (l.principal_cents / l.installments) as installment_cents,
         coalesce(sum(t.amount_cents) filter
           (where t.type in ('loan_in','self_loan_return')), 0)::bigint as repaid_cents,
         greatest(l.principal_cents - coalesce(sum(t.amount_cents) filter
           (where t.type in ('loan_in','self_loan_return')), 0), 0)::bigint as outstanding_cents,
         case
           when coalesce(sum(t.amount_cents) filter
                  (where t.type in ('loan_in','self_loan_return')), 0) = 0 then 'open'
           when coalesce(sum(t.amount_cents) filter
                  (where t.type in ('loan_in','self_loan_return')), 0) >= l.principal_cents then 'paid'
           else 'partial'
         end as status
    from loans l
    left join transactions t on t.loan_id = l.id
   group by l.id;

-- Fluxo de caixa mensal + TAXA DE POUPANÇA
-- Só receitas e despesas reais entram aqui. Transferências, empréstimos
-- e autoempréstimos movem dinheiro mas não são ganho nem gasto.
create view v_monthly_cashflow with (security_invoker = true) as
  select household_id,
         date_trunc('month', occurred_on)::date as month,
         coalesce(sum(amount_cents) filter (where type = 'income'), 0)::bigint  as income_cents,
         coalesce(sum(amount_cents) filter (where type = 'expense'), 0)::bigint as expense_cents,
         (coalesce(sum(amount_cents) filter (where type = 'income'), 0)
           - coalesce(sum(amount_cents) filter (where type = 'expense'), 0))::bigint as net_cents,
         round(
           (coalesce(sum(amount_cents) filter (where type = 'income'), 0)
            - coalesce(sum(amount_cents) filter (where type = 'expense'), 0))::numeric
           / nullif(sum(amount_cents) filter (where type = 'income'), 0), 4
         ) as savings_rate
    from transactions
   where type in ('income', 'expense')
   group by household_id, date_trunc('month', occurred_on);

-- Despesas por categoria por mês
create view v_expenses_by_category with (security_invoker = true) as
  select t.household_id,
         date_trunc('month', t.occurred_on)::date as month,
         c.id as category_id, c.name as category,
         sum(t.amount_cents)::bigint as total_cents
    from transactions t
    join categories c on c.id = t.category_id
   where t.type = 'expense'
   group by t.household_id, date_trunc('month', t.occurred_on), c.id;

-- Patrimônio líquido ao FIM de cada mês
-- = saldo de todas as contas + valores a receber de terceiros.
-- Autoempréstimo não altera o patrimônio (o dinheiro só trocou de conta);
-- o que ele mostra é disciplina: quanto a poupança está "devendo".
create view v_net_worth_monthly with (security_invoker = true) as
  with bounds as (
    select h.id as household_id,
           date_trunc('month', least(
             coalesce((select min(occurred_on) from transactions t where t.household_id = h.id), current_date),
             coalesce((select min(opened_on)  from accounts a     where a.household_id = h.id), current_date)
           ))::date as first_month
      from households h
  ),
  months as (
    select b.household_id, gs::date as month,
           (gs + interval '1 month - 1 day')::date as month_end
      from bounds b,
           generate_series(b.first_month, date_trunc('month', current_date), interval '1 month') gs
  )
  select m.household_id, m.month,
         ((select coalesce(sum(initial_balance_cents), 0) from accounts a
           where a.household_id = m.household_id and a.opened_on <= m.month_end)
         + (select coalesce(sum(delta_cents), 0) from v_account_flows f
             where f.household_id = m.household_id and f.occurred_on <= m.month_end)
         )::bigint as accounts_cents,
         (select coalesce(sum(case type when 'loan_out' then amount_cents
                                        when 'loan_in'  then -amount_cents end), 0)
            from transactions t
           where t.household_id = m.household_id and t.occurred_on <= m.month_end
             and t.type in ('loan_out','loan_in'))::bigint
           as receivables_cents
    from months m;

-- Resumo para o topo do dashboard (mês corrente)
create view v_dashboard_summary with (security_invoker = true) as
  select h.id as household_id,
         coalesce(cf.income_cents, 0)  as month_income_cents,
         coalesce(cf.expense_cents, 0) as month_expense_cents,
         coalesce(cf.net_cents, 0)     as month_net_cents,
         cf.savings_rate               as month_savings_rate,
         nw.accounts_cents + nw.receivables_cents as net_worth_cents,
         nw.receivables_cents          as receivables_cents,
         (select coalesce(sum(outstanding_cents), 0) from v_loan_status s
           where s.household_id = h.id and s.kind = 'self')::bigint as self_loan_outstanding_cents,
         (nw.accounts_cents + nw.receivables_cents)
           - coalesce((nwp.accounts_cents + nwp.receivables_cents), 0) as net_worth_change_cents
    from households h
    left join v_monthly_cashflow cf
      on cf.household_id = h.id and cf.month = date_trunc('month', current_date)::date
    left join v_net_worth_monthly nw
      on nw.household_id = h.id and nw.month = date_trunc('month', current_date)::date
    left join v_net_worth_monthly nwp
      on nwp.household_id = h.id and nwp.month = (date_trunc('month', current_date) - interval '1 month')::date;

-- Permissões (o Supabase já concede por padrão; explícito para portabilidade)
grant select, insert, update, delete
  on accounts, categories, loans, transactions to authenticated;
grant select, update on households to authenticated;
grant select on household_members, household_invites to authenticated;

-- Permissões das views para usuários logados (o RLS das tabelas filtra)
grant select on v_account_flows, v_account_balances, v_loan_status,
               v_monthly_cashflow, v_expenses_by_category,
               v_net_worth_monthly, v_dashboard_summary to authenticated;

-- >>> 20261009000001_app_support.sql
-- =============================================================================
-- v0.1 — funções de apoio às telas
--   * create_loan: cria empréstimo + lançamento de saída em uma única transação
--   * excluir um empréstimo apaga seus lançamentos (cascade)
--   * household_members_list: membros com e-mail (auth.users não é legível)
--   * variação do patrimônio = null no primeiro mês (não há mês anterior)
--   * fuso horário do banco = America/Sao_Paulo (quando permitido)
-- =============================================================================

-- Fuso: current_date nas views passa a seguir o horário de Brasília.
-- Em ambientes sem permissão para ALTER DATABASE, segue sem alterar.
do $$
begin
  execute format('alter database %I set timezone to %L', current_database(), 'America/Sao_Paulo');
exception when insufficient_privilege then
  raise notice 'sem permissão para alterar timezone do banco; mantendo o padrão';
end $$;
set timezone to 'America/Sao_Paulo';

-- -----------------------------------------------------------------------------
-- Excluir empréstimo => exclui concessão e parcelas
-- -----------------------------------------------------------------------------
alter table transactions
  drop constraint transactions_household_id_loan_id_loan_kind_fkey,
  add constraint transactions_household_id_loan_id_loan_kind_fkey
    foreign key (household_id, loan_id, loan_kind)
    references loans (household_id, id, kind) on delete cascade;

-- -----------------------------------------------------------------------------
-- create_loan — SECURITY INVOKER: o RLS do usuário continua valendo
-- -----------------------------------------------------------------------------
create function create_loan(
  p_household        uuid,
  p_kind             loan_kind,
  p_counterparty     text,
  p_principal_cents  bigint,
  p_installments     int,
  p_started_on       date,
  p_from_account     uuid,
  p_to_account       uuid default null,
  p_notes            text default null
) returns uuid
language plpgsql as $$
declare lid uuid;
begin
  insert into loans (household_id, kind, counterparty, principal_cents, installments, started_on, notes)
  values (p_household, p_kind, p_counterparty, p_principal_cents, p_installments, p_started_on, p_notes)
  returning id into lid;

  insert into transactions (household_id, occurred_on, type, amount_cents, description,
                            loan_id, from_account_id, to_account_id)
  values (p_household, p_started_on,
          case p_kind when 'third_party' then 'loan_out'::transaction_type
                      else 'self_loan_out'::transaction_type end,
          p_principal_cents,
          case p_kind when 'third_party' then 'Empréstimo para ' || p_counterparty
                      else 'Autoempréstimo: ' || p_counterparty end,
          lid, p_from_account,
          case p_kind when 'third_party' then null else p_to_account end);
  return lid;
end $$;

grant execute on function create_loan(uuid, loan_kind, text, bigint, int, date, uuid, uuid, text)
  to authenticated;

-- -----------------------------------------------------------------------------
-- Membros da família com e-mail
-- -----------------------------------------------------------------------------
create function household_members_list(p_household uuid)
returns table (user_id uuid, email text, role member_role, joined_at timestamptz)
language sql stable security definer set search_path = public as $$
  select m.user_id, u.email::text, m.role, m.joined_at
    from household_members m
    join auth.users u on u.id = m.user_id
   where m.household_id = p_household
     and is_member(p_household)
   order by m.joined_at;
$$;

revoke execute on function household_members_list(uuid) from public;
grant execute on function household_members_list(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Resumo do dashboard: variação nula quando não existe mês anterior
-- -----------------------------------------------------------------------------
create or replace view v_dashboard_summary with (security_invoker = true) as
  select h.id as household_id,
         coalesce(cf.income_cents, 0)  as month_income_cents,
         coalesce(cf.expense_cents, 0) as month_expense_cents,
         coalesce(cf.net_cents, 0)     as month_net_cents,
         cf.savings_rate               as month_savings_rate,
         nw.accounts_cents + nw.receivables_cents as net_worth_cents,
         nw.receivables_cents          as receivables_cents,
         (select coalesce(sum(outstanding_cents), 0) from v_loan_status s
           where s.household_id = h.id and s.kind = 'self')::bigint as self_loan_outstanding_cents,
         case when nwp.month is null then null
              else (nw.accounts_cents + nw.receivables_cents)
                   - (nwp.accounts_cents + nwp.receivables_cents)
         end as net_worth_change_cents
    from households h
    left join v_monthly_cashflow cf
      on cf.household_id = h.id and cf.month = date_trunc('month', current_date)::date
    left join v_net_worth_monthly nw
      on nw.household_id = h.id and nw.month = date_trunc('month', current_date)::date
    left join v_net_worth_monthly nwp
      on nwp.household_id = h.id and nwp.month = (date_trunc('month', current_date) - interval '1 month')::date;

-- >>> 20261012000001_cards_recurring_budgets.sql
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
