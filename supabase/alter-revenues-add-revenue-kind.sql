-- Adds "Tipo de Receita" support to revenues.
-- Run this once in Supabase SQL Editor on existing databases.

alter table public.revenues
  add column if not exists revenue_kind text;

alter table public.revenues
  add column if not exists product_or_service text;

alter table public.revenues
  add column if not exists frequency expense_frequency not null default 'Mensal';

alter table public.revenues
  add column if not exists impacts_dre boolean not null default true;
