-- Replace the time-limited free trial with a non-expiring setup mode.
alter table public.companies alter column plan set default 'trial';
alter table public.companies alter column subscription_status set default 'setup';
alter table public.companies alter column trial_ends_at drop default;

update public.companies
set subscription_status='setup',
    trial_ends_at=null,
    currency='USD'
where subscription_status='trialing';

update public.companies
set currency='USD'
where currency is null or currency='OMR';
