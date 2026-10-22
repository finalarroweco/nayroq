-- Central PayPal configuration created by the NAYROQ admin setup flow
create table if not exists public.paypal_config (
  singleton boolean primary key default true check (singleton = true),
  environment text not null default 'sandbox' check (environment in ('sandbox','live')),
  product_id text,
  starter_plan_id text,
  business_plan_id text,
  growth_plan_id text,
  webhook_id text,
  updated_at timestamptz not null default now()
);

alter table public.paypal_config enable row level security;

-- No browser policies are intentionally added. Server routes access this table
-- only with the Supabase service-role key.
insert into public.paypal_config (singleton, environment)
values (true, 'sandbox')
on conflict (singleton) do nothing;
