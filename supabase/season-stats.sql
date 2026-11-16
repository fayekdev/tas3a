-- Apply after requests-and-accounts.sql. Review locally before applying to production.
-- Read-only projection for admins; public snapshots use the existing protected program document.
begin;
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.season_stats_source(p_start date,p_end date)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; cutoff text;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Administrator access required' using errcode='42501';
  end if;
  if p_start is null or p_end is null or p_start>p_end then
    raise exception 'Invalid season dates' using errcode='22023';
  end if;
  cutoff := least(p_end,(now() at time zone 'Africa/Cairo')::date)::text;
  select jsonb_build_object(
    'patrols',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'symbol',p.symbol) order by p.name) from public.patrouilles p),'[]'::jsonb),
    'scouts',coalesce((select jsonb_agg(jsonb_build_object(
      'userId',a.id,'name',a.display_name,'patrolId',m.patrouille_id,
      'attended',case when d.data is null then null else (select count(*) from jsonb_each_text(coalesce(d.data->'self','{}'::jsonb)) e where e.key>=p_start::text and e.key<=cutoff and e.value='came') end,
      'missed',case when d.data is null then null else (select count(*) from jsonb_each_text(coalesce(d.data->'self','{}'::jsonb)) e where e.key>=p_start::text and e.key<=cutoff and e.value='missed') end,
      'completed',case when b.data is null then null else (select count(*) from jsonb_each(b.data) e where left(e.value->>'completed',10)>=p_start::text and left(e.value->>'completed',10)<=cutoff) end,
      'awarded',(select count(*) from public.badge_requests r where r.user_id=a.id and r.status='awarded' and r.meeting_date>=p_start and r.meeting_date::text<=cutoff),
      'tardy',null
    ) order by a.display_name) from public.accounts a
    left join public.patrouille_members m on m.user_id=a.id
    left join public.scout_documents d on d.user_id=a.id and d.key='attendance'
    left join public.scout_documents b on b.user_id=a.id and b.key='badges'
    where a.scout_role in ('CP','SP','TP','Patrouillard')),'[]'::jsonb)
  ) into result;
  return result;
end;
$$;
revoke all on function private.season_stats_source(date,date) from public,anon,authenticated;
grant execute on function private.season_stats_source(date,date) to authenticated;

create or replace function public.season_stats_source(p_start date,p_end date)
returns jsonb language sql stable security invoker set search_path='' as $$
  select private.season_stats_source(p_start,p_end);
$$;
revoke all on function public.season_stats_source(date,date) from public,anon,authenticated;
grant execute on function public.season_stats_source(date,date) to authenticated;
comment on function public.season_stats_source(date,date) is 'Admin-only seasonal totals. Does not expose badge notes, emails, usernames, maps or handbook data.';
-- Public reads expose aggregate patrol totals and only the caller's own scout record.
create or replace function private.member_program_content()
returns table(key text,data jsonb,updated_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
declare viewer uuid:=auth.uid(); content record; projected jsonb; season jsonb; summaries jsonb; projected_seasons jsonb:='[]'::jsonb;
begin
 if viewer is null or not exists(select 1 from public.accounts a where a.id=viewer) then raise exception 'Sign in required' using errcode='42501'; end if;
 for content in select p.key,p.data,p.updated_at from public.program_content p loop
  projected:=content.data;
  if not public.is_admin() then
   for season in select value from jsonb_array_elements(coalesce(content.data->'seasons','[]'::jsonb)) loop
    select coalesce(jsonb_agg(jsonb_build_object('id',p->>'id','members',t.members,'attended',t.attended,'missed',t.missed,'completed',t.completed,'awarded',t.awarded,'tardy',t.tardy)),'[]'::jsonb) into summaries
    from jsonb_array_elements(coalesce(season->'patrols','[]'::jsonb)) p cross join lateral (
     select count(*) as members,
      sum(case when s->>'attended' ~ '^[0-9]{1,9}$' then (s->>'attended')::bigint end) as attended,
      sum(case when s->>'missed' ~ '^[0-9]{1,9}$' then (s->>'missed')::bigint end) as missed,
      sum(case when s->>'completed' ~ '^[0-9]{1,9}$' then (s->>'completed')::bigint end) as completed,
      sum(case when s->>'awarded' ~ '^[0-9]{1,9}$' then (s->>'awarded')::bigint end) as awarded,
      sum(case when s->>'tardy' ~ '^[0-9]{1,9}$' then (s->>'tardy')::bigint end) as tardy
     from jsonb_array_elements(coalesce(season->'scouts','[]'::jsonb)) s where s->>'patrolId'=p->>'id'
    ) t;
    projected_seasons:=projected_seasons||jsonb_build_array((season-'scouts'-'patrolSummaries')||jsonb_build_object('patrolSummaries',summaries,'scouts',coalesce((select jsonb_agg(s) from jsonb_array_elements(coalesce(season->'scouts','[]'::jsonb)) s where s->>'userId'=viewer::text),'[]'::jsonb)));
   end loop;
   projected:=projected||jsonb_build_object('seasons',projected_seasons);
  end if;
  key:=content.key;data:=projected;updated_at:=content.updated_at;return next;
 end loop;
end;
$$;
revoke all on function private.member_program_content() from public,anon,authenticated;
grant execute on function private.member_program_content() to authenticated;
create or replace view public.member_program_content with (security_invoker=true,security_barrier=true) as select * from private.member_program_content();
revoke all on public.member_program_content from public,anon,authenticated;
grant select on public.member_program_content to authenticated;
drop policy if exists program_read on public.program_content;
create policy program_read on public.program_content for select to authenticated using((select public.is_admin()));

create or replace function public.validate_badge_request() returns trigger language plpgsql security invoker set search_path='' as $$
declare expected integer; checked jsonb; content jsonb; custom jsonb;
begin
 if tg_op='INSERT' then
  if new.user_id<>auth.uid() then raise exception 'Request your own badge'; end if;
  select data into content from public.member_program_content where key='program';
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

create or replace function public.validate_attendance_dates() returns trigger language plpgsql security invoker set search_path='' as $$
declare item record; member record; allowed jsonb; previous jsonb;
begin
 if new.key<>'attendance' then return new; end if;
 select coalesce(data->'attendanceDays','[]'::jsonb) into allowed from public.member_program_content where key='program';
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

commit;
