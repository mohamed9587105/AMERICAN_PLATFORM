-- V69 — Automatic session finance ledger
-- Run once in Supabase SQL Editor before using V69.

create table if not exists public.student_billing_profiles (
  student_id uuid primary key references public.students(id) on delete cascade,
  currency text not null default 'EGP' check (currency in ('EGP','USD')),
  session_price numeric not null default 0 check (session_price >= 0),
  auto_charge boolean not null default true,
  charge_absent boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.financial_transactions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  report_id uuid references public.weekly_reports(id) on delete set null,
  transaction_type text not null
    check (transaction_type in ('payment','session_charge','adjustment','refund')),
  amount numeric not null,
  currency text not null check (currency in ('EGP','USD')),
  title text not null,
  transaction_date date not null default current_date,
  external_key text unique,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_financial_transactions_student_date
  on public.financial_transactions(student_id, transaction_date desc, created_at desc);

create index if not exists idx_financial_transactions_report
  on public.financial_transactions(report_id);

alter table public.student_billing_profiles enable row level security;
alter table public.financial_transactions enable row level security;

-- This project reads/writes these tables only from server routes using the service-role key.
