-- Applied after the foundation migration. Account credentials remain in Auth.
alter table public.profiles rename to accounts;
alter table public.accounts add column username text unique check (username ~ '^[a-z0-9][a-z0-9._-]{2,39}$');
alter table public.accounts add column scout_role text not null default 'Patrouillard'
  check (scout_role in ('Chief','Assistant','CP','SP','TP','Patrouillard'));
-- Existing display_name-only grants survive the rename. No role column grant.
create or replace function public.on_scout_signup() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(new.raw_app_meta_data->>'scout_provisioned','') <> 'true' then
    raise exception 'Accounts must be created by the maintainer';
  end if;
  insert into public.accounts(id, display_name, username) values (
    new.id, left(coalesce(nullif(btrim(new.raw_user_meta_data->>'display_name'), ''), 'Scout'),80),
    new.raw_app_meta_data->>'scout_username');
  return new;
end;
$$;
create function public.set_scout_role(p_user uuid, p_role text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Maintainer access required' using errcode='42501'; end if;
  update public.accounts set scout_role=p_role where id=p_user;
  if not found then raise exception 'Account not found'; end if;
  insert into public.audit_events(actor_id,action,record_id) values(auth.uid(),'account.role_changed',p_user);
end;
$$;
revoke all on function public.set_scout_role(uuid,text) from public,anon;
grant execute on function public.set_scout_role(uuid,text) to authenticated;

create table public.account_imports (
  id uuid primary key default gen_random_uuid(),
  username text not null unique check(username ~ '^[a-z0-9][a-z0-9._-]{2,39}$'),
  display_name text not null check(char_length(btrim(display_name)) between 1 and 80),
  scout_role text not null default 'Patrouillard' check(scout_role in ('Chief','Assistant','CP','SP','TP','Patrouillard')),
  patrouille_name text check(char_length(patrouille_name) <= 60),
  status text not null default 'pending' check(status in ('pending','processing','complete','failed')),
  user_id uuid references auth.users(id) on delete set null,
  error text,
  created_at timestamptz not null default now()
);
create index account_imports_pending_idx on public.account_imports(created_at) where status='pending';
create index account_imports_user_idx on public.account_imports(user_id);
alter table public.account_imports enable row level security;
revoke all on public.account_imports from anon,authenticated;
grant select on public.account_imports to authenticated;
grant insert(username,display_name,scout_role,patrouille_name) on public.account_imports to authenticated;
create policy imports_read on public.account_imports for select to authenticated using ((select public.is_admin()));
create policy imports_insert on public.account_imports for insert to authenticated with check ((select public.is_admin()));

-- Server-side processing claims one row at a time. Not exposed to browser roles.
create function public.claim_account_import(p_id uuid) returns setof public.account_imports
language sql security invoker set search_path='' as $$
  update public.account_imports set status='processing',error=null where id=p_id and status='pending' returning *;
$$;
revoke all on function public.claim_account_import(uuid) from public,anon,authenticated;
grant execute on function public.claim_account_import(uuid) to service_role;

create function public.finish_account_import(p_import uuid,p_user uuid,p_actor uuid) returns void
language plpgsql security invoker set search_path='' as $$
declare job public.account_imports; patrol uuid;
begin
  select * into strict job from public.account_imports where id=p_import and status='processing' for update;
  update public.accounts set scout_role=job.scout_role where id=p_user;
  if job.patrouille_name is not null and btrim(job.patrouille_name) <> '' then
    select id into patrol from public.patrouilles where lower(btrim(name))=lower(btrim(job.patrouille_name));
    if patrol is null then raise exception 'Patrouille not found: %',job.patrouille_name; end if;
    insert into public.patrouille_members(patrouille_id,user_id,role)
      values(patrol,p_user,case when job.scout_role='CP' then 'leader' else 'scout' end);
  end if;
  update public.account_imports set status='complete',user_id=p_user where id=p_import;
  insert into public.audit_events(actor_id,action,record_id) values(p_actor,'account.created',p_user);
end;
$$;
revoke all on function public.finish_account_import(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.finish_account_import(uuid,uuid,uuid) to service_role;
