begin;
create schema if not exists private;
create table public.service_members (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.companies(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 display_name text not null default '' check(length(display_name)<=100),
 role text not null default 'agent' check(role in ('agent','manager')),
 active boolean not null default true,
 created_at timestamptz not null default now(),
 unique(company_id,user_id)
);
create index service_members_user on public.service_members(user_id,active);
create table private.service_invites (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.companies(id) on delete cascade,
 token_hash text not null unique,
 role text not null check(role in ('agent','manager')),
 expires_at timestamptz not null default now()+interval '24 hours',
 used_at timestamptz,
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now()
);
-- The private schema is not exposed by the Data API. Authorization uses database
-- membership, never user-editable JWT metadata. These helpers avoid policy recursion.
create function private.service_access(target uuid,management boolean default false) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and (exists(select 1 from public.companies c where c.id=target and c.owner_id=auth.uid()) or exists(select 1 from public.service_members m where m.company_id=target and m.user_id=auth.uid() and m.active and (not management or m.role='manager')));
$$;
revoke all on function private.service_access(uuid,boolean) from public,anon;
grant usage on schema private to authenticated,service_role;
grant execute on function private.service_access(uuid,boolean) to authenticated;
alter table public.service_members enable row level security;
alter table private.service_invites enable row level security;
revoke all on public.service_members from anon,authenticated;
grant select,update on public.service_members to authenticated;
grant all on public.service_members to service_role;
grant all on private.service_invites to service_role;
create policy "owners update team access" on public.service_members for update to authenticated using (company_id in (select id from public.companies where owner_id=(select auth.uid()))) with check (company_id in (select id from public.companies where owner_id=(select auth.uid())));
create policy "team can view company memberships" on public.service_members for select to authenticated using (private.service_access(company_id,false));
create policy "members view company" on public.companies for select to authenticated using(private.service_access(id,false));
create policy "members manage service tickets" on public.service_tickets for all to authenticated using(private.service_access(company_id,false)) with check(private.service_access(company_id,false));
create policy "managers manage service settings" on public.service_settings for all to authenticated using(private.service_access(company_id,true)) with check(private.service_access(company_id,true));
create policy "members manage conversations" on public.conversations for all to authenticated using(private.service_access(company_id,false)) with check(private.service_access(company_id,false));
create policy "members read contacts" on public.contacts for select to authenticated using(private.service_access(company_id,false));
create policy "members read ai employees" on public.ai_employees for select to authenticated using(private.service_access(company_id,false));
create policy "members manage messages" on public.messages for all to authenticated using(exists(select 1 from public.conversations c where c.id=conversation_id and private.service_access(c.company_id,false))) with check(exists(select 1 from public.conversations c where c.id=conversation_id and private.service_access(c.company_id,false)));
create function private.redeem_service_invite(hashed_token text,member_name text) returns uuid language plpgsql security definer set search_path='' as $$
declare invite private.service_invites; company uuid;
begin
 if auth.uid() is null then raise exception 'Unauthorized'; end if;
 select * into invite from private.service_invites i where i.token_hash=hashed_token and i.used_at is null and i.expires_at>now() for update;
 if invite.id is null then raise exception 'Invitation invalid or expired'; end if;
 if length(trim(member_name)) not between 1 and 100 then raise exception 'Name required'; end if;
 if exists(select 1 from public.companies where id=invite.company_id and owner_id=auth.uid()) then raise exception 'Already company owner'; end if;
 insert into public.service_members(company_id,user_id,display_name,role,active) values(invite.company_id,auth.uid(),trim(member_name),invite.role,true) on conflict(company_id,user_id) do update set active=true,role=excluded.role,display_name=excluded.display_name;
 update private.service_invites set used_at=now() where id=invite.id;
 return invite.company_id;
end;
$$;
revoke all on function private.redeem_service_invite(text,text) from public,anon;
grant execute on function private.redeem_service_invite(text,text) to authenticated;
create function public.redeem_service_invite(hashed_token text,member_name text) returns uuid language sql security invoker set search_path='' as $$ select private.redeem_service_invite(hashed_token,member_name); $$;
revoke all on function public.redeem_service_invite(text,text) from public,anon;
grant execute on function public.redeem_service_invite(text,text) to authenticated;

create function private.issue_service_invite(target uuid,hashed_token text,invite_role text) returns boolean language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.companies where id=target and owner_id=auth.uid()) then raise exception 'Owner access required'; end if;
 if invite_role not in ('agent','manager') or hashed_token !~ '^[a-f0-9]{64}$' then raise exception 'Invalid invitation'; end if;
 perform pg_advisory_xact_lock(hashtextextended(target::text,2702));
 if (select count(*) from private.service_invites where company_id=target and used_at is null and expires_at>now())>=20 then raise exception 'Too many active invitations'; end if;
 insert into private.service_invites(company_id,token_hash,role,created_by) values(target,hashed_token,invite_role,auth.uid());
 return true;
end;
$$;
revoke all on function private.issue_service_invite(uuid,text,text) from public,anon;
grant execute on function private.issue_service_invite(uuid,text,text) to authenticated;
create function public.issue_service_invite(target uuid,hashed_token text,invite_role text) returns boolean language sql security invoker set search_path='' as $$ select private.issue_service_invite(target,hashed_token,invite_role); $$;
revoke all on function public.issue_service_invite(uuid,text,text) from public,anon;
grant execute on function public.issue_service_invite(uuid,text,text) to authenticated;
alter policy "members manage messages" on public.messages using(exists(select 1 from public.conversations c join public.companies co on co.id=c.company_id where c.id=conversation_id and co.owner_id=(select auth.uid()))) with check(exists(select 1 from public.conversations c join public.companies co on co.id=c.company_id where c.id=conversation_id and co.owner_id=(select auth.uid())));
create policy "members read messages" on public.messages for select to authenticated using(exists(select 1 from public.conversations c where c.id=conversation_id and private.service_access(c.company_id,false)));
create policy "members send human replies" on public.messages for insert to authenticated with check(sender='human' and exists(select 1 from public.conversations c where c.id=conversation_id and c.human_takeover and c.status<>'closed' and private.service_access(c.company_id,false)));
alter policy "members manage conversations" on public.conversations using(company_id in (select id from public.companies where owner_id=(select auth.uid()))) with check(company_id in (select id from public.companies where owner_id=(select auth.uid())));
create policy "members read conversations" on public.conversations for select to authenticated using(private.service_access(company_id,false));
create policy "members update conversations" on public.conversations for update to authenticated using(private.service_access(company_id,false)) with check(private.service_access(company_id,false));
alter policy "members manage service tickets" on public.service_tickets using(company_id in (select id from public.companies where owner_id=(select auth.uid()))) with check(company_id in (select id from public.companies where owner_id=(select auth.uid())));
create policy "members read service tickets" on public.service_tickets for select to authenticated using(private.service_access(company_id,false));
create policy "members create service tickets" on public.service_tickets for insert to authenticated with check(private.service_access(company_id,false));
create policy "members update service tickets" on public.service_tickets for update to authenticated using(private.service_access(company_id,false)) with check(private.service_access(company_id,false));
create function private.protect_service_conversation() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if current_user='authenticated' and not exists(select 1 from public.companies where id=old.company_id and owner_id=auth.uid()) then
  if (to_jsonb(new)-array['status','human_takeover']) is distinct from (to_jsonb(old)-array['status','human_takeover']) then raise exception 'Staff can only change service status and human handoff'; end if;
 end if;
 return new;
end;
$$;
revoke all on function private.protect_service_conversation() from public,anon;
create trigger protect_service_conversation before update on public.conversations for each row execute function private.protect_service_conversation();
commit;
