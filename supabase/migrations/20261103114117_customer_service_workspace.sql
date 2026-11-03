begin;
create table public.service_tickets (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.companies(id) on delete cascade,
 subject text not null check (length(trim(subject)) between 1 and 200),
 customer text not null default '' check (length(customer)<=200),
 description text not null default '' check (length(description)<=12000),
 status text not null default 'open' check (status in ('open','in_progress','waiting','resolved','closed')),
 priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
 assignee text not null default '' check (length(assignee)<=200),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index service_tickets_company_created on public.service_tickets(company_id,created_at desc);
create table public.service_settings (
 company_id uuid primary key references public.companies(id) on delete cascade,
 assistant_name text not null default 'Customer service' check (length(assistant_name) between 1 and 100),
 greeting text not null default 'Hello, I am your AI assistant. How can I help?' check (length(greeting)<=1000),
 language text not null default 'both' check (language in ('ar','en','both')),
 instructions text not null default '' check (length(instructions)<=12000),
 business_hours text not null default '' check (length(business_hours)<=1000),
 transfer_phone text not null default '' check (transfer_phone='' or transfer_phone ~ '^\+[1-9][0-9]{7,14}$'),
 recording_enabled boolean not null default false,
 updated_at timestamptz not null default now()
);
alter table public.service_tickets enable row level security;
alter table public.service_settings enable row level security;
create policy "owners manage service tickets" on public.service_tickets for all to authenticated using (company_id in (select id from public.companies where owner_id=(select auth.uid()))) with check (company_id in (select id from public.companies where owner_id=(select auth.uid())));
create policy "owners manage service settings" on public.service_settings for all to authenticated using (company_id in (select id from public.companies where owner_id=(select auth.uid()))) with check (company_id in (select id from public.companies where owner_id=(select auth.uid())));
revoke all on public.service_tickets,public.service_settings from anon;
grant select,insert,update,delete on public.service_tickets,public.service_settings to authenticated;
grant all on public.service_tickets,public.service_settings to service_role;
create table public.service_test_requests (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.companies(id) on delete cascade,
 requested_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
 created_at timestamptz not null default now()
);
create index service_test_requests_user_created on public.service_test_requests(requested_by,created_at desc);
alter table public.service_test_requests enable row level security;
create policy "owners view own service tests" on public.service_test_requests for select to authenticated using (requested_by=(select auth.uid()) and company_id in (select id from public.companies where owner_id=(select auth.uid())));
create policy "owners request service tests" on public.service_test_requests for insert to authenticated with check (requested_by=(select auth.uid()) and company_id in (select id from public.companies where owner_id=(select auth.uid())));
revoke all on public.service_test_requests from anon,authenticated;
grant select on public.service_test_requests to authenticated;
grant insert(company_id) on public.service_test_requests to authenticated;
grant all on public.service_test_requests to service_role;
create function public.reserve_service_test(target_company uuid) returns boolean language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is null then return false; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,2701));
 if not exists(select 1 from public.companies where id=target_company and owner_id=auth.uid()) then return false; end if;
 if (select count(*) from public.service_test_requests where requested_by=auth.uid() and created_at>now()-interval '1 minute') >= 10 then return false; end if;
 if (select count(*) from public.service_test_requests where requested_by=auth.uid() and created_at>now()-interval '1 day') >= 100 then return false; end if;
 insert into public.service_test_requests(company_id) values (target_company);
 return true;
end;
$$;
revoke all on function public.reserve_service_test(uuid) from public,anon;
grant execute on function public.reserve_service_test(uuid) to authenticated;
commit;
