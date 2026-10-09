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
