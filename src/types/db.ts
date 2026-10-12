// Tipos das tabelas e views usadas pelo app (espelham supabase/migrations).

export type AccountKind = "checking" | "credit_card" | "savings" | "emergency" | "investment" | "cash";
export type CategoryKind = "income" | "expense";
export type LoanKind = "third_party" | "self";
export type TransactionType =
  | "income"
  | "expense"
  | "transfer"
  | "loan_out"
  | "loan_in"
  | "self_loan_out"
  | "self_loan_return";

export interface Account {
  id: string;
  household_id: string;
  name: string;
  kind: AccountKind;
  initial_balance_cents: number;
  opened_on: string;
  archived: boolean;
}

export interface AccountBalance {
  account_id: string;
  name: string;
  kind: AccountKind;
  archived: boolean;
  balance_cents: number;
}

export interface Category {
  id: string;
  name: string;
  kind: CategoryKind;
  archived: boolean;
}

export interface CardSummary {
  account_id: string;
  name: string;
  archived: boolean;
  balance_cents: number;
  owed_cents: number;
  month_spent_cents: number;
}

export interface RecurringExpense {
  id: string;
  name: string;
  amount_cents: number;
  category_id: string;
  account_id: string;
  day_of_month: number;
  active: boolean;
}

export interface RecurringMonth {
  recurring_id: string;
  name: string;
  amount_cents: number;
  category_id: string;
  category: string;
  account_id: string;
  account: string;
  day_of_month: number;
  due_on: string;
  transaction_id: string | null;
  launched_cents: number | null;
  launched_on: string | null;
}

export interface BudgetStatus {
  category_id: string;
  category: string;
  budget_cents: number;
  spent_cents: number;
  used_ratio: number;
  remaining_cents: number;
}

export interface BudgetSummary {
  total_budget_cents: number;
  budgeted_spent_cents: number;
  over_budget_cents: number;
  categories_warning: number;
  categories_over: number;
  month_spent_cents: number;
  unbudgeted_spent_cents: number;
  income_ref_cents: number;
  income_is_estimate: boolean;
  planned_savings_cents: number;
  planned_savings_rate: number | null;
  month_progress: number;
}

export interface Transaction {
  id: string;
  household_id: string;
  occurred_on: string;
  type: TransactionType;
  amount_cents: number;
  description: string | null;
  category_id: string | null;
  from_account_id: string | null;
  to_account_id: string | null;
  loan_id: string | null;
  recurring_id?: string | null;
}

export interface LoanStatus {
  loan_id: string;
  kind: LoanKind;
  counterparty: string;
  principal_cents: number;
  installments: number;
  started_on: string;
  installment_cents: number;
  repaid_cents: number;
  outstanding_cents: number;
  status: "open" | "partial" | "paid";
}

export interface DashboardSummary {
  month_income_cents: number;
  month_expense_cents: number;
  month_net_cents: number;
  month_savings_rate: number | null;
  net_worth_cents: number;
  receivables_cents: number;
  self_loan_outstanding_cents: number;
  net_worth_change_cents: number | null;
}

export const ACCOUNT_KIND_LABEL: Record<AccountKind, string> = {
  checking: "Conta corrente",
  credit_card: "Cartão de crédito",
  savings: "Poupança",
  emergency: "Reserva de emergência",
  investment: "Investimentos",
  cash: "Carteira",
};

export const TYPE_LABEL: Record<TransactionType, string> = {
  income: "Receita",
  expense: "Despesa",
  transfer: "Transferência",
  loan_out: "Empréstimo concedido",
  loan_in: "Recebimento de empréstimo",
  self_loan_out: "Autoempréstimo",
  self_loan_return: "Devolução à poupança",
};
