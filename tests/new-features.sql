-- Run inside a transaction and always roll back. No fixture is retained.
do $$
declare scout uuid:=gen_random_uuid(); chief uuid:=gen_random_uuid(); outsider uuid:=gen_random_uuid(); job uuid; secret uuid;
begin
 select user_id::text into strict secret from public.admin_users limit 1;
 perform set_config('test.admin',secret::text,true);
 insert into public.account_imports(username,display_name) values('verify.'||replace(scout::text,'-',''),'Verification scout') returning id into job;
 select provisioning_token into secret from public.claim_account_import(job);
 -- Reproduce Auth insertion before app_metadata exists, using the server claim secret.
 insert into auth.users(id,email,raw_user_meta_data) select scout,username||'@scout-hub.invalid',jsonb_build_object('provisioning_token',secret) from public.account_imports where id=job;
 if not exists(select 1 from public.accounts where id=scout) then raise exception 'Provisioned login failed'; end if;
 begin
  insert into auth.users(id,email,raw_user_meta_data) values(gen_random_uuid(),'forbidden@scout-hub.invalid','{}');
  raise exception 'Unprovisioned signup succeeded';
 exception when raise_exception then if sqlerrm='Unprovisioned signup succeeded' then raise; end if; end;
 insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data) values(chief,chief||'@test.invalid','{"scout_provisioned":true}','{"display_name":"Verification chief"}'),(outsider,outsider||'@test.invalid','{"scout_provisioned":true}','{"display_name":"Verification outsider"}');
 update public.accounts set scout_role='Chief' where id=chief;
 perform set_config('test.scout',scout::text,true);perform set_config('test.chief',chief::text,true);perform set_config('test.outsider',outsider::text,true);
end;
$$;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.scout'),true);
do $$
begin
 begin
  insert into public.badge_requests(badge_id,badge_title) values('b0','Historian');
  raise exception 'Incomplete request succeeded';
 exception when raise_exception then if sqlerrm='Incomplete request succeeded' then raise; end if; end;
 insert into public.scout_documents(key,data) values('badges','{"b0":{"checked":[0,1,2,3,4,5],"notes":""}}');
 insert into public.badge_requests(badge_id,badge_title) values('b0','Historian');
 if (select display_name from public.badge_requests) <> 'Verification scout' then raise exception 'Request identity failed'; end if;
 update public.badge_requests set status='awarded';
 if exists(select 1 from public.badge_requests where status<>'pending') then raise exception 'Scout escalated request'; end if;
 insert into public.scout_documents(key,data) values('attendance','{"self":{"2026-11-13":"came"},"team":{}}');
 begin
  update public.scout_documents set data='{"self":{"2026-11-12":"came"},"team":{}}' where key='attendance';
  raise exception 'Thursday attendance succeeded';
 exception when raise_exception then if sqlerrm='Thursday attendance succeeded' then raise; end if; end;
end;
$$;
select set_config('request.jwt.claim.sub',current_setting('test.outsider'),true);
do $$ begin if exists(select 1 from public.badge_requests) then raise exception 'Unrelated scout saw requests'; end if; end; $$;
select set_config('request.jwt.claim.sub',current_setting('test.chief'),true);
do $$ begin
 if (select count(*) from public.badge_requests where user_id=current_setting('test.scout')::uuid)<>1 then raise exception 'Chief cannot see request'; end if;
 update public.badge_requests set status='scheduled',meeting_date='2026-11-20' where user_id=current_setting('test.scout')::uuid;
 update public.badge_requests set status='awarded' where user_id=current_setting('test.scout')::uuid;
 if not exists(select 1 from public.badge_requests where status='awarded') then raise exception 'Chief cannot award'; end if;
end; $$;
select set_config('request.jwt.claim.sub',current_setting('test.admin'),true);
insert into public.program_content(key,data) values('program','{"attendanceDays":["2026-11-12"]}') on conflict(key) do update set data=excluded.data;
select set_config('request.jwt.claim.sub',current_setting('test.scout'),true);
update public.scout_documents set data='{"self":{"2026-11-12":"came"},"team":{"Test":{"2026-11-12":"came"}}}' where key='attendance';
select set_config('request.jwt.claim.sub',current_setting('test.admin'),true);
update public.program_content set data='{}' where key='program';
select set_config('request.jwt.claim.sub',current_setting('test.scout'),true);
-- Upsert must retain old check-ins after an administrator removes an extra date.
insert into public.scout_documents(key,data) values('attendance','{"self":{"2026-11-12":"came","2026-11-13":"came"},"team":{"Test":{"2026-11-12":"came"}}}') on conflict(user_id,key) do update set data=excluded.data;
do $$ begin
 begin
  insert into public.scout_documents(key,data) values('attendance','{"self":{"2026-11-12":"missed"},"team":{}}') on conflict(user_id,key) do update set data=excluded.data;
  raise exception 'Removed attendance date remained editable';
 exception when raise_exception then if sqlerrm='Removed attendance date remained editable' then raise; end if; end;
end; $$;
reset role;
set local role service_role;
select public.edit_scout_account(current_setting('test.scout')::uuid,'Edited verification scout','SP',null);
do $$ begin if not exists(select 1 from public.accounts where id=current_setting('test.scout')::uuid and display_name='Edited verification scout' and scout_role='SP') then raise exception 'Account editing failed'; end if; end; $$;
reset role;
delete from auth.users where id=current_setting('test.scout')::uuid;
do $$ begin if exists(select 1 from public.accounts where id=current_setting('test.scout')::uuid) or exists(select 1 from public.badge_requests where user_id=current_setting('test.scout')::uuid) or exists(select 1 from public.scout_documents where user_id=current_setting('test.scout')::uuid) then raise exception 'Account deletion left personal records'; end if; end; $$;
select 'Provisioning, blocked public signup, request ownership, chief awards and attendance rules passed' as result;
