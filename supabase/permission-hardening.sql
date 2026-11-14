alter function public.is_admin() security invoker;
revoke all on function public.rls_auto_enable() from public,anon,authenticated;
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;
create function private.assign_scout_role(p_user uuid,p_role text) returns void
language plpgsql security definer set search_path='' as $$
begin
  if not public.is_admin() then raise exception 'Maintainer access required' using errcode='42501'; end if;
  update public.accounts set scout_role=p_role where id=p_user;
  if not found then raise exception 'Account not found'; end if;
  insert into public.audit_events(actor_id,action,record_id) values(auth.uid(),'account.role_changed',p_user);
end;
$$;
revoke all on function private.assign_scout_role(uuid,text) from public,anon;
grant execute on function private.assign_scout_role(uuid,text) to authenticated;
create or replace function public.set_scout_role(p_user uuid,p_role text) returns void
language sql security invoker set search_path='' as $$ select private.assign_scout_role(p_user,p_role); $$;
