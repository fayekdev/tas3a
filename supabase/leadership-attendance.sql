-- Apply after season-stats.sql. Leadership-verified records preserve legacy documents.
begin;
create or replace function private.can_track_attendance() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.accounts a where a.id=auth.uid() and a.scout_role in ('Chief','Assistant'));
$$;
revoke all on function private.can_track_attendance() from public,anon,authenticated;
grant execute on function private.can_track_attendance() to authenticated;
create table public.attendance_records(
 user_id uuid not null references public.accounts(id) on delete cascade,
 meeting_date date not null,
 status text not null check(status in ('present','absent')),
 late_minutes integer not null default 0 check(late_minutes between 0 and 1440 and (status='present' or late_minutes=0)),
 recorded_by uuid references public.accounts(id) on delete set null,
 updated_at timestamptz not null default now(),
 primary key(user_id,meeting_date)
);
create index attendance_records_date_idx on public.attendance_records(meeting_date);
create index attendance_records_recorder_idx on public.attendance_records(recorded_by);
alter table public.attendance_records enable row level security;
revoke all on public.attendance_records from public,anon,authenticated;
grant select on public.attendance_records to authenticated;
create policy attendance_records_read on public.attendance_records for select to authenticated using(user_id=(select auth.uid()) or (select private.can_track_attendance()));
-- The register RPC is the only write path. Personal legacy documents are now read-only.
drop policy documents_insert on public.scout_documents;
drop policy documents_update on public.scout_documents;
drop policy documents_delete on public.scout_documents;
create policy documents_insert on public.scout_documents for insert to authenticated with check(user_id=(select auth.uid()) and key<>'attendance');
create policy documents_update on public.scout_documents for update to authenticated using(user_id=(select auth.uid()) and key<>'attendance') with check(user_id=(select auth.uid()) and key<>'attendance');
create policy documents_delete on public.scout_documents for delete to authenticated using(user_id=(select auth.uid()) and key<>'attendance');

create or replace function private.attendance_date_allowed(p_date date) returns boolean language sql stable security definer set search_path='' as $$
 select p_date is not null and p_date<=(now() at time zone 'Africa/Cairo')::date and (extract(isodow from p_date)=5 or exists(select 1 from public.program_content p where p.key='program' and coalesce(p.data->'attendanceDays','[]'::jsonb) ? p_date::text));
$$;
revoke all on function private.attendance_date_allowed(date) from public,anon,authenticated;

create or replace function private.attendance_register(p_date date) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not private.can_track_attendance() then raise exception 'Only Chiefs and Assistants can track attendance' using errcode='42501'; end if;
 if p_date is null then raise exception 'Choose an attendance date' using errcode='22023'; end if;
 return jsonb_build_object('allowed',private.attendance_date_allowed(p_date),
 'scouts',coalesce((select jsonb_agg(jsonb_build_object('userId',a.id,'name',a.display_name,'patrolId',m.patrouille_id,'patrolName',p.name,'patrolSymbol',p.symbol) order by a.display_name) from public.accounts a left join public.patrouille_members m on m.user_id=a.id left join public.patrouilles p on p.id=m.patrouille_id where a.scout_role in ('CP','SP','TP','Patrouillard')),'[]'::jsonb),
 'records',coalesce((select jsonb_agg(jsonb_build_object('userId',r.user_id,'status',r.status,'lateMinutes',r.late_minutes)) from public.attendance_records r where r.meeting_date=p_date),'[]'::jsonb));
end;
$$;
revoke all on function private.attendance_register(date) from public,anon,authenticated;
grant execute on function private.attendance_register(date) to authenticated;
create or replace function public.attendance_register(p_date date) returns jsonb language sql stable security invoker set search_path='' as $$ select private.attendance_register(p_date); $$;
revoke all on function public.attendance_register(date) from public,anon,authenticated;
grant execute on function public.attendance_register(date) to authenticated;

create or replace function private.save_attendance_register(p_date date,p_records jsonb) returns void language plpgsql security definer set search_path='' as $$
declare item jsonb; target uuid; presence text; minutes integer;
begin
 if auth.uid() is null or not private.can_track_attendance() then raise exception 'Only Chiefs and Assistants can track attendance' using errcode='42501'; end if;
 if not private.attendance_date_allowed(p_date) then raise exception 'Attendance is allowed only on past/current Fridays or administrator dates' using errcode='22023'; end if;
 if p_records is null or jsonb_typeof(p_records)<>'array' then raise exception 'Choose attendance records' using errcode='22023'; end if;
 if jsonb_array_length(p_records)>5000 then raise exception 'Too many attendance records' using errcode='22023'; end if;
 if (select count(*)<>count(distinct r->>'userId') from jsonb_array_elements(p_records) r) then raise exception 'Duplicate or missing scout IDs' using errcode='22023'; end if;
 for item in select value from jsonb_array_elements(p_records) loop
  if jsonb_typeof(item)<>'object' or not(item ? 'status') or coalesce(item->>'lateMinutes','') !~ '^[0-9]{1,4}$' then raise exception 'Invalid attendance record' using errcode='22023'; end if;
  target:=(item->>'userId')::uuid;presence:=item->>'status';minutes:=(item->>'lateMinutes')::integer;
  if not exists(select 1 from public.accounts a where a.id=target and a.scout_role in ('CP','SP','TP','Patrouillard')) then raise exception 'Scout not found' using errcode='22023'; end if;
  if (presence is not null and presence not in ('present','absent')) or minutes>1440 or (presence is distinct from 'present' and minutes<>0) then raise exception 'Invalid presence or late minutes' using errcode='22023'; end if;
  if presence is null then
   delete from public.attendance_records where user_id=target and meeting_date=p_date;
  else
   insert into public.attendance_records(user_id,meeting_date,status,late_minutes,recorded_by,updated_at) values(target,p_date,presence,minutes,auth.uid(),now()) on conflict(user_id,meeting_date) do update set status=excluded.status,late_minutes=excluded.late_minutes,recorded_by=excluded.recorded_by,updated_at=excluded.updated_at;
  end if;
 end loop;
end;
$$;
revoke all on function private.save_attendance_register(date,jsonb) from public,anon,authenticated;
grant execute on function private.save_attendance_register(date,jsonb) to authenticated;
create or replace function public.save_attendance_register(p_date date,p_records jsonb) returns void language sql security invoker set search_path='' as $$ select private.save_attendance_register(p_date,p_records); $$;
revoke all on function public.save_attendance_register(date,jsonb) from public,anon,authenticated;
grant execute on function public.save_attendance_register(date,jsonb) to authenticated;

-- Internal calculation is never callable by authenticated clients directly.
create or replace function private.calculate_season_stats(p_start date,p_end date) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare cutoff text; snapshot jsonb;
begin
 if p_start is null or p_end is null or p_start>p_end then raise exception 'Invalid season dates' using errcode='22023'; end if;
 cutoff:=least(p_end,(now() at time zone 'Africa/Cairo')::date)::text;
 select s into snapshot from public.program_content p cross join lateral jsonb_array_elements(coalesce(p.data->'seasons','[]'::jsonb)) s where p.key='program' and s->>'start'=p_start::text and s->>'end'=p_end::text limit 1;
 return (
 with attendance as (
  select r.user_id,r.meeting_date::text as day,case when r.status='present' then 'came' else 'missed' end as status from public.attendance_records r where r.meeting_date>=p_start and r.meeting_date::text<=cutoff
  union all
  select d.user_id,e.key,e.value from public.scout_documents d cross join lateral jsonb_each_text(case when jsonb_typeof(d.data->'self')='object' then d.data->'self' else '{}'::jsonb end) e where d.key='attendance' and e.key ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' and e.key>=p_start::text and e.key<=cutoff and e.value in ('came','missed') and not exists(select 1 from public.attendance_records r where r.user_id=d.user_id and r.meeting_date::text=e.key)
 )
 select jsonb_build_object('attendanceManaged',true,'patrols',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'symbol',p.symbol) order by p.name) from public.patrouilles p),'[]'::jsonb),
 'scouts',coalesce((select jsonb_agg(jsonb_build_object('userId',a.id,'name',a.display_name,'patrolId',coalesce((select old->'patrolId' from jsonb_array_elements(coalesce(snapshot->'scouts','[]'::jsonb)) old where old->>'userId'=a.id::text),to_jsonb(m.patrouille_id)),
 'attended',case when (d.user_id is not null and jsonb_typeof(d.data->'self')='object') or official.n>0 then (select count(*) from attendance x where x.user_id=a.id and x.status='came') else null end,
 'missed',case when (d.user_id is not null and jsonb_typeof(d.data->'self')='object') or official.n>0 then (select count(*) from attendance x where x.user_id=a.id and x.status='missed') else null end,
 'tardy',case when official.n>0 then official.late else null end,'lateMinutes',case when official.n>0 then official.minutes else null end,
 'completed',case when b.user_id is not null and jsonb_typeof(b.data)='object' then (select count(*) from jsonb_each(case when jsonb_typeof(b.data)='object' then b.data else '{}'::jsonb end) e where left(e.value->>'completed',10)>=p_start::text and left(e.value->>'completed',10)<=cutoff) else null end,
 'awarded',(select count(*) from public.badge_requests r where r.user_id=a.id and r.status='awarded' and r.meeting_date>=p_start and r.meeting_date::text<=cutoff)
 ) order by a.display_name) from public.accounts a left join public.patrouille_members m on m.user_id=a.id left join public.scout_documents d on d.user_id=a.id and d.key='attendance' left join public.scout_documents b on b.user_id=a.id and b.key='badges'
 cross join lateral(select count(*) as n,count(*) filter(where r.status='present' and r.late_minutes>0) as late,coalesce(sum(r.late_minutes),0) as minutes from public.attendance_records r where r.user_id=a.id and r.meeting_date>=p_start and r.meeting_date::text<=cutoff) official
 where a.scout_role in ('CP','SP','TP','Patrouillard')),'[]'::jsonb)));
end;
$$;
revoke all on function private.calculate_season_stats(date,date) from public,anon,authenticated;
create or replace function private.season_stats_source(p_start date,p_end date) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.is_admin() then raise exception 'Administrator access required' using errcode='42501'; end if;
 return private.calculate_season_stats(p_start,p_end);
end;
$$;

create or replace function private.season_stats_records(p_start date,p_end date) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare source jsonb; summaries jsonb; viewer uuid:=auth.uid();
begin
 if viewer is null or not exists(select 1 from public.accounts a where a.id=viewer) then raise exception 'Sign in required' using errcode='42501'; end if;
 source:=private.calculate_season_stats(p_start,p_end);
 if public.is_admin() then return source; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',p->>'id','members',t.members,'attended',t.attended,'missed',t.missed,'completed',t.completed,'awarded',t.awarded,'tardy',t.tardy,'lateMinutes',t.minutes)),'[]'::jsonb) into summaries
 from jsonb_array_elements(source->'patrols') p cross join lateral(select count(*) as members,sum((s->>'attended')::bigint) as attended,sum((s->>'missed')::bigint) as missed,sum((s->>'completed')::bigint) as completed,sum((s->>'awarded')::bigint) as awarded,sum((s->>'tardy')::bigint) as tardy,sum((s->>'lateMinutes')::bigint) as minutes from jsonb_array_elements(source->'scouts') s where s->>'patrolId'=p->>'id') t;
 return (source-'scouts')||jsonb_build_object('patrolSummaries',summaries,'scouts',coalesce((select jsonb_agg(s) from jsonb_array_elements(source->'scouts') s where s->>'userId'=viewer::text),'[]'::jsonb));
end;
$$;
revoke all on function private.season_stats_records(date,date) from public,anon,authenticated;
grant execute on function private.season_stats_records(date,date) to authenticated;
create or replace function public.season_stats_records(p_start date,p_end date) returns jsonb language sql stable security invoker set search_path='' as $$ select private.season_stats_records(p_start,p_end); $$;
revoke all on function public.season_stats_records(date,date) from public,anon,authenticated;
grant execute on function public.season_stats_records(date,date) to authenticated;
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
    select coalesce(jsonb_agg(jsonb_build_object('id',p->>'id','members',t.members,'attended',t.attended,'missed',t.missed,'completed',t.completed,'awarded',t.awarded,'tardy',t.tardy,'lateMinutes',t.minutes)),'[]'::jsonb) into summaries
    from jsonb_array_elements(coalesce(season->'patrols','[]'::jsonb)) p cross join lateral (
     select count(*) as members,
      sum(case when s->>'attended' ~ '^[0-9]{1,9}$' then (s->>'attended')::bigint end) as attended,
      sum(case when s->>'missed' ~ '^[0-9]{1,9}$' then (s->>'missed')::bigint end) as missed,
      sum(case when s->>'completed' ~ '^[0-9]{1,9}$' then (s->>'completed')::bigint end) as completed,
      sum(case when s->>'awarded' ~ '^[0-9]{1,9}$' then (s->>'awarded')::bigint end) as awarded,
      sum(case when s->>'tardy' ~ '^[0-9]{1,9}$' then (s->>'tardy')::bigint end) as tardy,
      sum(case when s->>'lateMinutes' ~ '^[0-9]{1,9}$' then (s->>'lateMinutes')::bigint end) as minutes
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

commit;
