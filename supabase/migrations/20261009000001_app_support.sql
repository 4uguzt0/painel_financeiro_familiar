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
