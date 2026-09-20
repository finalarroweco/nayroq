create extension if not exists "uuid-ossp";

create table if not exists public.companies (
 id uuid primary key default uuid_generate_v4(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 name text not null,
 industry text,
 country text,
 currency text default 'OMR',
 created_at timestamptz default now()
);
create table if not exists public.ai_employees (
 id uuid primary key default uuid_generate_v4(),
 company_id uuid not null references public.companies(id) on delete cascade,
 name text not null,
 role text not null check (role in ('sales','receptionist','support','booking','follow_up','collections')),
 language text default 'both',
 tone text default 'professional',
 goal text,
 status text default 'draft' check (status in ('draft','active','paused')),
 instructions text,
 created_at timestamptz default now()
);
create table if not exists public.contacts (
 id uuid primary key default uuid_generate_v4(), company_id uuid not null references public.companies(id) on delete cascade,
 name text, phone text, email text, source text, created_at timestamptz default now()
);
create table if not exists public.leads (
 id uuid primary key default uuid_generate_v4(), company_id uuid not null references public.companies(id) on delete cascade,
 contact_id uuid references public.contacts(id) on delete set null, ai_employee_id uuid references public.ai_employees(id) on delete set null,
 stage text default 'new', value numeric default 0, currency text default 'OMR', notes text, created_at timestamptz default now()
);
create table if not exists public.knowledge_items (
 id uuid primary key default uuid_generate_v4(), company_id uuid not null references public.companies(id) on delete cascade,
 title text not null, content text, source_type text default 'manual', source_url text, created_at timestamptz default now()
);
create table if not exists public.bookings (
 id uuid primary key default uuid_generate_v4(), company_id uuid not null references public.companies(id) on delete cascade,
 contact_id uuid references public.contacts(id) on delete set null, starts_at timestamptz not null, status text default 'confirmed', notes text, created_at timestamptz default now()
);
create table if not exists public.quotations (
 id uuid primary key default uuid_generate_v4(), company_id uuid not null references public.companies(id) on delete cascade,
 contact_id uuid references public.contacts(id) on delete set null, amount numeric default 0, currency text default 'OMR', status text default 'draft', created_at timestamptz default now()
);

alter table public.companies enable row level security; alter table public.ai_employees enable row level security; alter table public.contacts enable row level security; alter table public.leads enable row level security; alter table public.knowledge_items enable row level security; alter table public.bookings enable row level security; alter table public.quotations enable row level security;

drop policy if exists "owners manage companies" on public.companies;
create policy "owners manage companies" on public.companies for all using (owner_id=auth.uid()) with check (owner_id=auth.uid());
drop policy if exists "owners manage employees" on public.ai_employees;
create policy "owners manage employees" on public.ai_employees for all using (company_id in (select id from public.companies where owner_id=auth.uid())) with check (company_id in (select id from public.companies where owner_id=auth.uid()));
drop policy if exists "owners manage contacts" on public.contacts;
create policy "owners manage contacts" on public.contacts for all using (company_id in (select id from public.companies where owner_id=auth.uid())) with check (company_id in (select id from public.companies where owner_id=auth.uid()));
drop policy if exists "owners manage leads" on public.leads;
create policy "owners manage leads" on public.leads for all using (company_id in (select id from public.companies where owner_id=auth.uid())) with check (company_id in (select id from public.companies where owner_id=auth.uid()));
drop policy if exists "owners manage knowledge" on public.knowledge_items;
create policy "owners manage knowledge" on public.knowledge_items for all using (company_id in (select id from public.companies where owner_id=auth.uid())) with check (company_id in (select id from public.companies where owner_id=auth.uid()));
drop policy if exists "owners manage bookings" on public.bookings;
create policy "owners manage bookings" on public.bookings for all using (company_id in (select id from public.companies where owner_id=auth.uid())) with check (company_id in (select id from public.companies where owner_id=auth.uid()));
drop policy if exists "owners manage quotations" on public.quotations;
create policy "owners manage quotations" on public.quotations for all using (company_id in (select id from public.companies where owner_id=auth.uid())) with check (company_id in (select id from public.companies where owner_id=auth.uid()));

create table if not exists public.conversations (
 id uuid primary key default uuid_generate_v4(),
 company_id uuid not null references public.companies(id) on delete cascade,
 ai_employee_id uuid references public.ai_employees(id) on delete set null,
 contact_id uuid references public.contacts(id) on delete set null,
 channel text default 'test',
 status text default 'open',
 human_takeover boolean default false,
 created_at timestamptz default now()
);
create table if not exists public.messages (
 id uuid primary key default uuid_generate_v4(),
 conversation_id uuid not null references public.conversations(id) on delete cascade,
 sender text not null check (sender in ('customer','ai','human','system')),
 content text not null,
 created_at timestamptz default now()
);
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
drop policy if exists "owners manage conversations" on public.conversations;
create policy "owners manage conversations" on public.conversations for all using (company_id in (select id from public.companies where owner_id=auth.uid())) with check (company_id in (select id from public.companies where owner_id=auth.uid()));
drop policy if exists "owners manage messages" on public.messages;
create policy "owners manage messages" on public.messages for all using (conversation_id in (select c.id from public.conversations c join public.companies co on co.id=c.company_id where co.owner_id=auth.uid())) with check (conversation_id in (select c.id from public.conversations c join public.companies co on co.id=c.company_id where co.owner_id=auth.uid()));


create table if not exists public.channel_connections (
 id uuid primary key default uuid_generate_v4(),
 company_id uuid not null references public.companies(id) on delete cascade,
 channel text not null,
 external_account_id text,
 phone_number_id text,
 display_name text,
 status text default 'disconnected',
 created_at timestamptz default now()
);
alter table public.channel_connections enable row level security;
drop policy if exists "owners manage channels" on public.channel_connections;
create policy "owners manage channels" on public.channel_connections for all
using (company_id in (select id from public.companies where owner_id=auth.uid()))
with check (company_id in (select id from public.companies where owner_id=auth.uid()));


alter table public.leads add column if not exists conversation_id uuid references public.conversations(id) on delete set null;
alter table public.leads add column if not exists qualification jsonb default '{}'::jsonb;
alter table public.leads add column if not exists updated_at timestamptz default now();
