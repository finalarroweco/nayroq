-- NAYROQ production security hardening
-- Run once in Supabase SQL Editor.

-- Customers may submit and view their own payment proofs, but may not approve,
-- reject, edit, or delete payment submissions. Administrative review uses
-- server-side service-role routes.
drop policy if exists "owners manage own payments" on public.payment_submissions;
drop policy if exists "owners view own payments" on public.payment_submissions;
drop policy if exists "owners submit own payments" on public.payment_submissions;
create policy "owners view own payments" on public.payment_submissions
for select using (
  company_id in (select id from public.companies where owner_id=auth.uid())
);
create policy "owners submit own payments" on public.payment_submissions
for insert with check (
  company_id in (select id from public.companies where owner_id=auth.uid())
  and status='pending'
  and reviewed_at is null
);

-- Restrict receipt objects to the owner's company folder.
drop policy if exists "users upload payment receipts" on storage.objects;
drop policy if exists "users read payment receipts" on storage.objects;
create policy "owners upload own payment receipts" on storage.objects
for insert to authenticated
with check (
  bucket_id='payment-receipts'
  and split_part(name,'/',1) in (
    select id::text from public.companies where owner_id=auth.uid()
  )
);
create policy "owners read own payment receipts" on storage.objects
for select to authenticated
using (
  bucket_id='payment-receipts'
  and split_part(name,'/',1) in (
    select id::text from public.companies where owner_id=auth.uid()
  )
);
update storage.buckets
set file_size_limit=10485760,
    allowed_mime_types=array['image/jpeg','image/png','image/webp','application/pdf']
where id='payment-receipts';

-- Prevent authenticated workspace owners from self-upgrading billing fields.
create or replace function public.protect_company_billing_fields()
returns trigger
language plpgsql
as $$
begin
  if auth.role()='authenticated' then
    new.plan := old.plan;
    new.subscription_status := old.subscription_status;
    new.trial_ends_at := old.trial_ends_at;
    new.billing_cycle := old.billing_cycle;
    new.subscription_ends_at := old.subscription_ends_at;
  end if;
  return new;
end;
$$;
drop trigger if exists protect_company_billing_fields_trigger on public.companies;
create trigger protect_company_billing_fields_trigger
before update on public.companies
for each row execute function public.protect_company_billing_fields();
