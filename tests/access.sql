-- Integration checks run inside one rolled-back transaction; no fixture survives.
begin;
do $$
declare member_id uuid:=gen_random_uuid(); outsider_id uuid:=gen_random_uuid(); owner_id uuid;
begin
  select user_id into strict owner_id from public.admin_users limit 1;
  perform set_config('test.owner_id',owner_id::text,true);
  perform set_config('test.member_id',member_id::text,true);
  perform set_config('test.outsider_id',outsider_id::text,true);
  insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data)
    values(member_id,member_id||'@test.invalid',now(),'{"scout_provisioned":true}','{"display_name":"Test member"}'),
    (outsider_id,outsider_id||'@test.invalid',now(),'{"scout_provisioned":true}','{"display_name":"Test outsider"}');
end;
$$;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.owner_id'),true);
do $$
declare p uuid;
begin
  if not public.is_admin() then raise exception 'Owner not recognized'; end if;
  p:=public.create_patrouille('Access test '||gen_random_uuid(),'private','tree',current_setting('test.member_id')::uuid);
  perform set_config('test.patrol_id',p::text,true);
  perform public.set_scout_role(current_setting('test.member_id')::uuid,'CP');
  insert into public.program_content(key,data) values('program','{"test":true}')
    on conflict(key) do update set data=excluded.data;
  if (select scout_role from public.accounts where id=current_setting('test.member_id')::uuid)<>'CP' then raise exception 'Admin role assignment failed'; end if;
end;
$$;
select set_config('request.jwt.claim.sub',current_setting('test.member_id'),true);
do $$
begin
  if public.is_admin() then raise exception 'Scout became admin'; end if;
  insert into public.scout_documents(key,data) values('badges','{"b0":{"checked":[0],"notes":"fixture"}}');
  update public.scout_documents set data='{"saved":true}' where key='badges';
  if (select count(*) from public.scout_documents where data='{"saved":true}'::jsonb)<>1 then raise exception 'Personal progress failed to save'; end if;
  if (select count(*) from public.program_content where key='program')<>1 then raise exception 'Member cannot read program content'; end if;
  update public.program_content set data='{"unauthorized":true}' where key='program';
  if (select data from public.program_content where key='program')<>'{"test":true}'::jsonb then raise exception 'Member edited program'; end if;
  begin
    insert into public.scout_documents(user_id,key,data) values(current_setting('test.outsider_id')::uuid,'map','{}');
    raise exception 'Member wrote another account document';
  exception when insufficient_privilege then null; end;
  begin
    update public.scout_documents set user_id=current_setting('test.outsider_id')::uuid;
    raise exception 'Member reassigned document ownership';
  exception when insufficient_privilege then null; end;
  if (select count(*) from public.patrouilles)<>1 then raise exception 'Member cannot read own patrol'; end if;
  if (select count(*) from public.accounts)<>1 then raise exception 'Member can see another account'; end if;
  begin
    perform public.set_scout_role(current_setting('test.member_id')::uuid,'Chief');
    raise exception 'Member assigned a role';
  exception when insufficient_privilege then null; end;
  begin
    update public.accounts set scout_role='Chief' where id=current_setting('test.member_id')::uuid;
    raise exception 'Member changed role directly';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.admin_users(user_id) values(current_setting('test.member_id')::uuid);
    raise exception 'Member granted admin';
  exception when insufficient_privilege then null; end;
  begin
    perform public.create_patrouille('Unauthorized patrol','','tree');
    raise exception 'Member created a patrol';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.account_imports(username,display_name) values('forbidden.test','Forbidden');
    raise exception 'Member queued accounts';
  exception when insufficient_privilege then null; end;
  if (select count(*) from public.audit_events)<>0 then raise exception 'Member read audit trail'; end if;
end;
$$;
select set_config('request.jwt.claim.sub',current_setting('test.outsider_id'),true);
do $$ begin
  if (select count(*) from public.scout_documents)<>0 then raise exception 'Outsider read personal progress'; end if;
  if (select count(*) from public.patrouilles)<>0 then raise exception 'Outsider read patrol'; end if;
  if (select count(*) from public.patrouille_members)<>0 then raise exception 'Outsider read roster'; end if;
end; $$;
set local role anon;
do $$ begin
  begin
    perform * from public.accounts;
    raise exception 'Anonymous read accounts';
  exception when insufficient_privilege then null; end;
  begin
    perform * from public.scout_documents;
    raise exception 'Anonymous read personal progress';
  exception when insufficient_privilege then null; end;
  begin
    perform * from public.program_content;
    raise exception 'Anonymous read troop achievements';
  exception when insufficient_privilege then null; end;
end; $$;
reset role;
select 'PASS: maintainer writes, member isolation, role escalation blocked, anonymous access blocked' as result;
rollback;
