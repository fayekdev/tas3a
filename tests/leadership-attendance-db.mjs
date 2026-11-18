// Full-schema tests in isolated Postgres; no production accounts or records are created.
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {PGlite} from '../.build-tools/stats-db/node_modules/@electric-sql/pglite/dist/index.js';
const db=new PGlite();
const chief='30000000-0000-4000-8000-000000000001',assistant='30000000-0000-4000-8000-000000000002',scout='30000000-0000-4000-8000-000000000003',other='30000000-0000-4000-8000-000000000004',adminOnly='30000000-0000-4000-8000-000000000005',patrol='30000000-0000-4000-8000-000000000010';
async function asUser(id){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role authenticated');}
const save=(date,rows)=>db.query('select public.save_attendance_register($1,$2::jsonb)',[date,JSON.stringify(rows)]);
const stats=async()=> (await db.query("select public.season_stats_records('2026-01-01','2026-12-31') as data")).rows[0].data;
try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_app_meta_data jsonb,raw_user_meta_data jsonb);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;
 create function public.rls_auto_enable() returns event_trigger language plpgsql as $$ begin null; end $$;`);
 for(const file of ['supabase/migrations/202611140001_scout_hub.sql','supabase/roles-and-imports.sql','supabase/permission-hardening.sql','supabase/feature-storage.sql','supabase/requests-and-accounts.sql','supabase/season-stats.sql','supabase/leadership-attendance.sql'])await db.exec(await readFile(file,'utf8'));
 for(const [id,name,role] of [[chief,'Chief','Chief'],[assistant,'Assistant','Assistant'],[scout,'Scout','Patrouillard'],[other,'Other private scout','CP'],[adminOnly,'Admin without leadership','TP']]){
  await db.query(`insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data) values($1,$2,'{"scout_provisioned":true}',$3)`,[id,`${id}@test.invalid`,JSON.stringify({display_name:name})]);await db.query('update public.accounts set scout_role=$2 where id=$1',[id,role]);
 }
 await db.exec(`select set_config('request.jwt.claim.sub','${chief}',false);insert into public.admin_users values('${chief}'),('${adminOnly}');insert into public.patrouilles(id,name,symbol) values('${patrol}','Panthère','panthere');insert into public.patrouille_members(patrouille_id,user_id,role) values('${patrol}','${scout}','scout'),('${patrol}','${other}','leader');
 insert into public.scout_documents(user_id,key,data) values('${scout}','attendance','{"self":{"2026-01-02":"came","2026-01-09":"missed"},"team":{}}'),('${scout}','badges','{"b0":{"checked":[0],"notes":"PRIVATE NOTE","completed":"2026-01-02"}}');
 insert into public.scout_documents(user_id,key,data) values('${other}','badges','[]');
 insert into public.program_content(key,data) values('program','{"attendanceDays":["2026-01-05"],"seasons":[]}');`);
 await asUser(chief);
 let register=(await db.query("select public.attendance_register('2026-01-02') as data")).rows[0].data;assert.equal(register.allowed,true);assert.equal(register.scouts.length,3);
 await save('2026-01-02',[{userId:scout,status:'present',lateMinutes:7},{userId:other,status:'absent',lateMinutes:0}]);
 assert.equal((await db.query('select recorded_by::text from public.attendance_records where user_id=$1',[scout])).rows[0].recorded_by,chief);
 let source=await stats(),row=source.scouts.find(s=>s.userId===scout);assert.equal(row.attended,1);assert.equal(row.missed,1);assert.equal(row.tardy,1);assert.equal(row.lateMinutes,7);assert.equal(row.completed,1);assert.equal(source.scouts.length,3);
 await save('2026-01-02',[{userId:scout,status:'absent',lateMinutes:0}]);row=(await stats()).scouts.find(s=>s.userId===scout);assert.equal(row.attended,0);assert.equal(row.missed,2);assert.equal(row.tardy,0);
 await save('2026-01-02',[{userId:scout,status:'present',lateMinutes:7}]);
 await assert.rejects(save('2099-01-02',[{userId:scout,status:'present',lateMinutes:0}]),/Fridays or administrator dates/);
 await assert.rejects(save('2026-01-12',[{userId:scout,status:'present',lateMinutes:0}]),/Fridays or administrator dates/);
 await assert.rejects(save('2026-01-02',[{userId:scout,status:'absent',lateMinutes:2}]),/Invalid presence/);
 await assert.rejects(save('2026-01-02',[{userId:scout,status:'present',lateMinutes:1.5}]),/Invalid attendance/);
 await assert.rejects(save('2026-01-02',[{userId:scout,status:'present',lateMinutes:1441}]),/Invalid presence/);
 await assert.rejects(save('2026-01-02',[{userId:scout,status:'present',lateMinutes:0},{userId:scout,status:'absent',lateMinutes:0}]),/Duplicate/);
 await assert.rejects(save('2026-01-02',[{userId:scout,status:'present',lateMinutes:3},{userId:chief,status:'present',lateMinutes:0}]),/Scout not found/);
 assert.equal((await db.query('select late_minutes from public.attendance_records where user_id=$1',[scout])).rows[0].late_minutes,7);
 await assert.rejects(db.query(`insert into public.attendance_records(user_id,meeting_date,status) values('${scout}','2026-01-16','present')`),/permission denied/);
 await asUser(assistant);
 await save('2026-01-02',[{userId:scout,status:'present',lateMinutes:9}]);await save('2026-01-05',[{userId:scout,status:'present',lateMinutes:0}]);
 assert.equal((await db.query('select recorded_by::text from public.attendance_records where user_id=$1 and meeting_date=$2',[scout,'2026-01-02'])).rows[0].recorded_by,assistant);
 assert.equal((await db.query("select public.attendance_register('2026-01-05') as data")).rows[0].data.allowed,true);
 for(const id of [scout,other,adminOnly]){
  await asUser(id);await assert.rejects(db.query("select public.attendance_register('2026-01-02')"),/Only Chiefs and Assistants/);await assert.rejects(save('2026-01-02',[{userId:scout,status:'present',lateMinutes:0}]),/Only Chiefs and Assistants/);
 }
 await asUser(scout);
 source=await stats();assert.equal(source.scouts.length,1);assert.equal(source.scouts[0].userId,scout);assert.equal(source.scouts[0].attended,2);assert.equal(source.scouts[0].tardy,1);assert.equal(source.scouts[0].lateMinutes,9);assert.equal(source.patrolSummaries[0].members,2);assert.equal(source.patrolSummaries[0].lateMinutes,9);
 assert.ok(!JSON.stringify(source).includes('Other private scout'));assert.ok(!JSON.stringify(source).includes('PRIVATE NOTE'));assert.ok(!JSON.stringify(source).includes('@test.invalid'));
 assert.equal((await db.query('select count(*)::int as n from public.attendance_records')).rows[0].n,2);
 await assert.rejects(db.query("select private.calculate_season_stats('2026-01-01','2026-12-31')"),/permission denied/);
 await assert.rejects(db.query(`insert into public.scout_documents(key,data) values('attendance','{"self":{},"team":{}}') on conflict(user_id,key) do update set data=excluded.data`),/row-level security/);
 await db.query("delete from public.scout_documents where key='attendance'");assert.equal((await db.query("select count(*)::int as n from public.scout_documents where key='attendance'")).rows[0].n,1);
 await db.query(`update public.scout_documents set data=data||'{"b4":{"checked":[0,1,2],"notes":""}}'::jsonb where key='badges'`);
 await db.query("insert into public.badge_requests(badge_id,badge_title) values('b4','Test badge')");
 await db.exec(`select set_config('request.jwt.claims','{"user_metadata":{"scout_role":"Chief"}}',false)`);assert.equal((await db.query('select private.can_track_attendance() as allowed')).rows[0].allowed,false);
 await db.exec("reset role;set role anon;select set_config('request.jwt.claim.sub','',false)");
 for(const query of ["select public.attendance_register('2026-01-02')","select public.season_stats_records('2026-01-01','2026-12-31')",'select * from public.attendance_records'])await assert.rejects(db.query(query),/permission denied/);
 await asUser(chief);await save('2026-01-02',[{userId:other,status:null,lateMinutes:0}]);assert.equal((await db.query('select count(*)::int as n from public.attendance_records where user_id=$1',[other])).rows[0].n,0);
 console.log('PASS: Chief/Assistant-only atomic register, admin-without-leadership denial, date/minute validation, actor attribution, legacy override without double counting, live personal/aggregate stats, anonymous denial, legacy write lock, and badge compatibility.');
}catch(e){console.error(e.message);process.exitCode=1;}finally{await db.close();}
