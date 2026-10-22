-- NAYROQ PayPal subscription support
alter table public.companies add column if not exists payment_provider text;
alter table public.companies add column if not exists paypal_subscription_id text;
alter table public.companies add column if not exists paypal_plan_id text;
alter table public.companies add column if not exists paypal_payer_id text;
alter table public.companies add column if not exists subscription_started_at timestamptz;

create unique index if not exists companies_paypal_subscription_id_unique
on public.companies(paypal_subscription_id)
where paypal_subscription_id is not null;

update public.companies
set currency='USD'
where currency is null or currency='OMR';
