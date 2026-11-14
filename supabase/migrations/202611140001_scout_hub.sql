-- Passwords and emails are managed exclusively by Supabase Auth.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 80),
  created_at timestamptz not null default now()
);
create table public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade
);
create table public.patrouilles (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 60),
  motto text not null default '' check (char_length(motto) <= 160),
  symbol text not null default 'compass' check (symbol in ('compass','mountain','tree','flame')),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create unique index patrouilles_name_unique on public.patrouilles (lower(btrim(name)));
create table public.patrouille_members (
  patrouille_id uuid not null references public.patrouilles(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'scout' check (role in ('scout','leader')),
  joined_at timestamptz not null default now(),
  primary key (patrouille_id, user_id),
  unique(user_id)
);
create table public.audit_events (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  record_id uuid not null,
  created_at timestamptz not null default now()
);
create index patrouilles_created_by_idx on public.patrouilles(created_by);
create index audit_events_actor_idx on public.audit_events(actor_id);

create function public.is_admin() returns boolean language sql stable security definer
set search_path = '' as $$
  select exists(select 1 from public.admin_users where user_id = (select auth.uid()));
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- An admin role is never taken from user-editable signup metadata.
create function public.on_scout_signup() returns trigger language plpgsql security definer
set search_path = '' as $$
begin
  insert into public.profiles(id, display_name) values
    (new.id, left(coalesce(nullif(btrim(new.raw_user_meta_data->>'display_name'), ''), 'Scout'),80));
  return new;
end;
$$;
revoke all on function public.on_scout_signup() from public, anon, authenticated;
create trigger scout_signup after insert on auth.users for each row execute function public.on_scout_signup();

alter table public.profiles enable row level security;
alter table public.admin_users enable row level security;
alter table public.patrouilles enable row level security;
alter table public.patrouille_members enable row level security;
alter table public.audit_events enable row level security;
revoke all on public.profiles, public.admin_users, public.patrouilles, public.patrouille_members, public.audit_events from anon, authenticated;
grant select on public.profiles, public.admin_users, public.patrouilles, public.patrouille_members, public.audit_events to authenticated;
grant update(display_name) on public.profiles to authenticated;
grant insert, update, delete on public.patrouilles, public.patrouille_members to authenticated;

create policy profiles_read on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy admin_read_self on public.admin_users for select to authenticated using (user_id = (select auth.uid()));
create policy patrouilles_read on public.patrouilles for select to authenticated using (
  (select public.is_admin()) or id in (select patrouille_id from public.patrouille_members where user_id = (select auth.uid()))
);
create policy patrouilles_insert on public.patrouilles for insert to authenticated
  with check ((select public.is_admin()) and created_by = (select auth.uid()));
create policy patrouilles_update on public.patrouilles for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy patrouilles_delete on public.patrouilles for delete to authenticated using ((select public.is_admin()));
create policy members_read on public.patrouille_members for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy members_insert on public.patrouille_members for insert to authenticated with check ((select public.is_admin()));
create policy members_update on public.patrouille_members for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy members_delete on public.patrouille_members for delete to authenticated using ((select public.is_admin()));
create policy audit_read on public.audit_events for select to authenticated using ((select public.is_admin()));

create function public.create_patrouille(p_name text, p_motto text, p_symbol text, p_leader uuid default null)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare patrol_id uuid;
begin
  if not public.is_admin() then raise exception 'Administrator access required' using errcode = '42501'; end if;
  insert into public.patrouilles(name,motto,symbol) values (btrim(p_name),btrim(p_motto),p_symbol) returning id into patrol_id;
  if p_leader is not null then
    insert into public.patrouille_members(patrouille_id,user_id,role) values (patrol_id,p_leader,'leader');
  end if;
  return patrol_id;
end;
$$;
revoke all on function public.create_patrouille(text,text,text,uuid) from public, anon;
grant execute on function public.create_patrouille(text,text,text,uuid) to authenticated;

create function public.log_patrouille_change() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.audit_events(actor_id,action,record_id)
    values (auth.uid(), lower(tg_table_name || '.' || tg_op), case when tg_op = 'DELETE' then old.patrouille_id else new.patrouille_id end);
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function public.log_patrouille_change() from public, anon, authenticated;
create trigger log_membership after insert or update or delete on public.patrouille_members for each row execute function public.log_patrouille_change();
create function public.log_patrouille_record() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.audit_events(actor_id,action,record_id)
    values (auth.uid(), lower(tg_table_name || '.' || tg_op), case when tg_op = 'DELETE' then old.id else new.id end);
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function public.log_patrouille_record() from public, anon, authenticated;
create trigger log_patrouille after insert or update or delete on public.patrouilles for each row execute function public.log_patrouille_record();
