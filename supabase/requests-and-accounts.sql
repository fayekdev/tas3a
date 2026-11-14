-- Apply after feature-storage.sql. Existing account/import data is retained.
-- Some projects lost this original relationship during manual account setup.
do $$ begin
 if not exists(select 1 from pg_constraint where conrelid='public.accounts'::regclass and contype='f' and confrelid='auth.users'::regclass) then
  alter table public.accounts add constraint accounts_auth_user_fkey foreign key(id) references auth.users(id) on delete cascade;
 end if;
end; $$;
-- A one-time claim secret also proves provisioning when Auth inserts before app_metadata.
alter table public.account_imports add column provisioning_token uuid;
revoke select on public.account_imports from authenticated;
grant select(id,username,display_name,scout_role,patrouille_name,status,user_id,error,created_at) on public.account_imports to authenticated;
create or replace function public.claim_account_import(p_id uuid) returns setof public.account_imports language sql security invoker set search_path='' as $$
 update public.account_imports set status='processing',error=null,provisioning_token=gen_random_uuid() where id=p_id and status='pending' returning *;
$$;
create or replace function public.on_scout_signup() returns trigger language plpgsql security definer set search_path='' as $$
declare job public.account_imports;
begin
  select * into job from public.account_imports where status='processing' and user_id is null and username||'@scout-hub.invalid'=lower(new.email) and provisioning_token::text=new.raw_user_meta_data->>'provisioning_token';
  if job.id is null then
    if coalesce(new.raw_app_meta_data->>'scout_provisioned','') <> 'true' then raise exception 'Accounts must be created by the maintainer'; end if;
    insert into public.accounts(id,display_name,username) values(new.id,left(coalesce(nullif(btrim(new.raw_user_meta_data->>'display_name'),''),'Scout'),80),new.raw_app_meta_data->>'scout_username');
  else
    insert into public.accounts(id,display_name,username,scout_role) values(new.id,job.display_name,job.username,job.scout_role);
  end if;
  return new;
end;
$$;
alter table public.patrouilles drop constraint patrouilles_symbol_check;
alter table public.patrouilles add constraint patrouilles_symbol_check check(symbol in ('compass','mountain','tree','flame','gazelle','panthere','lion','renard','loup'));

update public.patrouilles set symbol=case lower(translate(btrim(name),'èéê','eee')) when 'gazelle' then 'gazelle' when 'panthere' then 'panthere' when 'lion' then 'lion' when 'renard' then 'renard' when 'loup' then 'loup' end where lower(translate(btrim(name),'èéê','eee')) in ('gazelle','panthere','lion','renard','loup');
drop policy program_read on public.program_content;
create policy program_read on public.program_content for select to authenticated using(exists(select 1 from public.accounts where id=(select auth.uid())));

create function public.edit_scout_account(p_user uuid,p_name text,p_role text,p_patrol uuid) returns void language plpgsql security invoker set search_path='' as $$
begin
  update public.accounts set display_name=btrim(p_name),scout_role=p_role where id=p_user;
  if not found then raise exception 'Account not found'; end if;
  if exists(select 1 from public.patrouille_members where user_id=p_user and patrouille_id=p_patrol) then
    null;
  else
    delete from public.patrouille_members where user_id=p_user;
    if p_patrol is not null then insert into public.patrouille_members(patrouille_id,user_id,role) values(p_patrol,p_user,case when p_role='CP' then 'leader' else 'scout' end); end if;
  end if;
end;
$$;
revoke all on function public.edit_scout_account(uuid,text,text,uuid) from public,anon,authenticated;
grant execute on function public.edit_scout_account(uuid,text,text,uuid) to service_role;

create table public.badge_requirements(id text primary key,requirement_count integer not null check(requirement_count>0));
alter table public.badge_requirements enable row level security;
grant select on public.badge_requirements to authenticated;
create policy badge_catalog_read on public.badge_requirements for select to authenticated using(true);
create table public.badge_requests(
 id uuid primary key default gen_random_uuid(),user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 display_name text not null default '',badge_id text not null,badge_title text not null check(length(badge_title) between 1 and 150),
 status text not null default 'pending' check(status in ('pending','scheduled','awarded')),meeting_date date,
 created_at timestamptz not null default now(),unique(user_id,badge_id)
);
alter table public.badge_requests enable row level security;
grant select on public.badge_requests to authenticated;
grant insert(badge_id,badge_title) on public.badge_requests to authenticated;
grant update(status,meeting_date) on public.badge_requests to authenticated;
create policy requests_read on public.badge_requests for select to authenticated using(user_id=(select auth.uid()) or (select public.is_admin()) or exists(select 1 from public.accounts where id=(select auth.uid()) and scout_role in ('Chief','Assistant')));
create policy requests_insert on public.badge_requests for insert to authenticated with check(user_id=(select auth.uid()) and status='pending' and meeting_date is null);
create policy requests_update on public.badge_requests for update to authenticated using((select public.is_admin()) or exists(select 1 from public.accounts where id=(select auth.uid()) and scout_role in ('Chief','Assistant'))) with check((select public.is_admin()) or exists(select 1 from public.accounts where id=(select auth.uid()) and scout_role in ('Chief','Assistant')));
create function public.validate_badge_request() returns trigger language plpgsql security invoker set search_path='' as $$
declare expected integer; checked jsonb; content jsonb; custom jsonb;
begin
 if tg_op='INSERT' then
  if new.user_id<>auth.uid() then raise exception 'Request your own badge'; end if;
  select data into content from public.program_content where key='program';
  if coalesce(content->'hidden','[]'::jsonb) ? new.badge_id then raise exception 'Badge is unavailable'; end if;
  select requirement_count into expected from public.badge_requirements where id=new.badge_id;
  select b into custom from jsonb_array_elements(coalesce(content->'custom','[]'::jsonb)) b where b->>'id'=new.badge_id;
  if custom is not null then expected:=jsonb_array_length(custom->'requirements'); end if;
  if content->'badges'->new.badge_id ? 'requirements' then expected:=jsonb_array_length(content->'badges'->new.badge_id->'requirements'); end if;
  select data->new.badge_id->'checked' into checked from public.scout_documents where user_id=auth.uid() and key='badges';
  if expected is null or expected<1 or checked is null or jsonb_typeof(checked)<>'array' then raise exception 'Save all completed requirements before requesting the badge'; end if;
  if exists(select 1 from generate_series(0,expected-1) i where not checked @> to_jsonb(array[i])) then raise exception 'Complete every requirement before requesting the badge'; end if;
  select display_name into strict new.display_name from public.accounts where id=auth.uid();
 end if;
 if new.status='scheduled' and new.meeting_date is null then raise exception 'Choose a presentation date'; end if;
 return new;
end;
$$;
revoke all on function public.validate_badge_request() from public,anon,authenticated;
create trigger validate_badge_request before insert or update on public.badge_requests for each row execute function public.validate_badge_request();

create or replace function public.validate_attendance_dates() returns trigger language plpgsql security invoker set search_path='' as $$
declare item record; member record; allowed jsonb; previous jsonb;
begin
 if new.key<>'attendance' then return new; end if;
 select coalesce(data->'attendanceDays','[]'::jsonb) into allowed from public.program_content where key='program';
 if tg_op='UPDATE' then previous:=old.data; else select data into previous from public.scout_documents where user_id=new.user_id and key=new.key; end if;
 previous:=coalesce(previous,'{}'::jsonb);
 for item in select key,value from jsonb_each(coalesce(new.data->'self','{}'::jsonb)) loop
  if previous->'self'->item.key is distinct from item.value and (item.key !~ '^\d{4}-\d{2}-\d{2}$' or item.key::date>(now() at time zone 'Africa/Cairo')::date or (extract(isodow from item.key::date)<>5 and not coalesce(allowed ? item.key,false))) then raise exception 'Attendance is allowed only on Fridays or administrator dates'; end if;
 end loop;
 for member in select key,value from jsonb_each(coalesce(new.data->'team','{}'::jsonb)) loop
  for item in select key,value from jsonb_each(member.value) loop
   if previous->'team'->member.key->item.key is distinct from item.value and (item.key !~ '^\d{4}-\d{2}-\d{2}$' or item.key::date>(now() at time zone 'Africa/Cairo')::date or (extract(isodow from item.key::date)<>5 and not coalesce(allowed ? item.key,false))) then raise exception 'Attendance is allowed only on Fridays or administrator dates'; end if;
  end loop;
 end loop;
 return new;
end;
$$;
revoke all on function public.validate_attendance_dates() from public,anon,authenticated;
create trigger attendance_dates before insert or update on public.scout_documents for each row execute function public.validate_attendance_dates();

insert into public.badge_requirements(id,requirement_count) values
('b0',6),
('b1',7),
('b2',6),
('b3',6),
('b4',3),
('b5',6),
('b6',5),
('b7',4),
('b8',4),
('b9',6),
('b10',3),
('b11',5),
('b12',9),
('b13',5),
('b14',4),
('b15',4),
('b16',6),
('b17',3),
('b18',5),
('b19',4),
('b20',6),
('b21',6),
('b22',7),
('b23',5),
('b24',7),
('b25',5),
('b26',9),
('b27',4),
('b28',6),
('b29',5),
('b30',4),
('b31',6),
('b32',7),
('b33',4),
('b34',9),
('b35',4),
('b36',5),
('b37',7),
('b38',5),
('b39',7),
('b40',5),
('b41',7),
('b42',5),
('b43',1),
('b44',5),
('b45',4),
('b46',4),
('b47',4),
('b48',6),
('b49',8),
('b50',2),
('b51',6),
('b52',4),
('b53',6),
('b54',5),
('b55',5),
('b56',4),
('b57',5),
('b58',7),
('b59',5),
('b60',8),
('b61',5),
('b62',7),
('b63',5),
('b64',3),
('s1',4),
('s2',5),
('b67',8),
('b68',5),
('b69',4),
('b70',3),
('b71',3),
('b72',6),
('b73',8),
('b74',3),
('b75',6),
('b76',5),
('b77',7);
