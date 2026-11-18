-- Read-only history projection. No attendance, badge or account records are created or changed.
begin;
create or replace function private.scout_record_history(p_user uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare viewer uuid:=auth.uid(); target uuid; profile public.accounts;
begin
 if viewer is null or not exists(select 1 from public.accounts a where a.id=viewer) then raise exception 'Sign in required' using errcode='42501'; end if;
 target:=coalesce(p_user,viewer);
 if target<>viewer and not public.is_admin() then raise exception 'You can only read your own scout records' using errcode='42501'; end if;
 select * into profile from public.accounts a where a.id=target;
 if not found then raise exception 'Scout account not found' using errcode='22023'; end if;
 return (
 with days as (
  select r.meeting_date::text as day,r.status,r.late_minutes as minutes,'leadership'::text as source,r.updated_at from public.attendance_records r where r.user_id=target
  union all
  select e.key,case when e.value='came' then 'present' else 'absent' end,null::integer,'legacy'::text,null::timestamptz from public.scout_documents d cross join lateral jsonb_each_text(case when jsonb_typeof(d.data->'self')='object' then d.data->'self' else '{}'::jsonb end) e where d.user_id=target and d.key='attendance' and e.key ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' and e.value in ('came','missed') and not exists(select 1 from public.attendance_records r where r.user_id=target and r.meeting_date::text=e.key)
 )
 select jsonb_build_object('userId',target,'name',profile.display_name,'scoutRole',profile.scout_role,
 'patrolName',(select p.name from public.patrouille_members m join public.patrouilles p on p.id=m.patrouille_id where m.user_id=target),
 'patrolSymbol',(select p.symbol from public.patrouille_members m join public.patrouilles p on p.id=m.patrouille_id where m.user_id=target),
 'attendance',coalesce((select jsonb_agg(jsonb_build_object('date',day,'status',status,'lateMinutes',minutes,'source',source,'updatedAt',updated_at) order by day desc) from days),'[]'::jsonb),
 'progress',coalesce((select jsonb_agg(jsonb_build_object('badgeId',b.key,
 'checked',(select coalesce(jsonb_agg(distinct j.value),'[]'::jsonb) from jsonb_array_elements(case when jsonb_typeof(b.value->'checked')='array' then b.value->'checked' else '[]'::jsonb end) j where jsonb_typeof(j.value)='number' and j.value::text ~ '^[0-9]+$'),
 'completedDate',case when left(b.value->>'completed',10) ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then left(b.value->>'completed',10) else null end) order by b.key) from public.scout_documents d cross join lateral jsonb_each(case when jsonb_typeof(d.data)='object' then d.data else '{}'::jsonb end) b where d.user_id=target and d.key='badges' and jsonb_typeof(b.value)='object'),'[]'::jsonb),
 'presentations',coalesce((select jsonb_agg(jsonb_build_object('badgeId',r.badge_id,'title',r.badge_title,'status',r.status,'presentationDate',r.meeting_date,'requestedAt',r.created_at) order by r.created_at desc) from public.badge_requests r where r.user_id=target),'[]'::jsonb))
 );
end;
$$;
revoke all on function private.scout_record_history(uuid) from public,anon,authenticated;
grant execute on function private.scout_record_history(uuid) to authenticated;
create or replace function public.scout_record_history(p_user uuid default null) returns jsonb language sql stable security invoker set search_path='' as $$ select private.scout_record_history(p_user); $$;
revoke all on function public.scout_record_history(uuid) from public,anon,authenticated;
grant execute on function public.scout_record_history(uuid) to authenticated;
commit;
