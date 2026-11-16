// Isolated Postgres verification. Install @electric-sql/pglite@0.3.14 under
// .build-tools/stats-db, then run node tests/season-stats-db.mjs.
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {PGlite} from '../.build-tools/stats-db/node_modules/@electric-sql/pglite/dist/index.js';
const db=new PGlite();
try {
 await db.exec(`
 create role anon; create role authenticated; create role service_role bypassrls;
 create schema auth;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_app_meta_data jsonb,raw_user_meta_data jsonb);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema auth to anon,authenticated;
 grant execute on function auth.uid() to anon,authenticated;
 create function public.rls_auto_enable() returns event_trigger language plpgsql as $$ begin null; end $$;
 `);
 for(const path of ['supabase/migrations/202611140001_scout_hub.sql','supabase/roles-and-imports.sql','supabase/permission-hardening.sql','supabase/feature-storage.sql','supabase/requests-and-accounts.sql','supabase/season-stats.sql'])await db.exec(await readFile(path,'utf8'));
 const admin='10000000-0000-4000-8000-000000000001',scout='10000000-0000-4000-8000-000000000002',other='10000000-0000-4000-8000-000000000003',patrol='10000000-0000-4000-8000-000000000004';
 await db.exec(`insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data) values
 ('${admin}','admin@test.invalid','{"scout_provisioned":true}','{"display_name":"Admin"}'),
 ('${scout}','scout@test.invalid','{"scout_provisioned":true}','{"display_name":"Scout"}'),
 ('${other}','other@test.invalid','{"scout_provisioned":true}','{"display_name":"Other"}');
 insert into public.admin_users values('${admin}');update public.accounts set scout_role='Chief' where id='${admin}';
 insert into public.patrouilles(id,name,symbol) values('${patrol}','Panthère','panthere');
 insert into public.patrouille_members(patrouille_id,user_id,role) values('${patrol}','${scout}','scout');
 -- Seed a legacy future entry to verify the stats cutoff independently of the write trigger.
 alter table public.scout_documents disable trigger attendance_dates;
 insert into public.scout_documents(user_id,key,data) values
 ('${scout}','attendance','{"self":{"2025-01-03":"came","2026-01-02":"came","2026-01-09":"missed","2099-01-02":"came"},"team":{"Legacy":{"2026-01-02":"came"}}}'),
 ('${scout}','badges','{"b0":{"checked":[0],"notes":"PRIVATE NOTE","completed":"2026-01-02"},"b1":{"checked":[],"completed":"2025-01-01"},"b2":{"checked":[]}}');
 alter table public.scout_documents enable trigger attendance_dates;
 alter table public.badge_requests disable trigger validate_badge_request;
 insert into public.badge_requests(user_id,badge_id,badge_title,status,meeting_date) values('${scout}','b0','Current award','awarded','2026-01-09'),('${scout}','b1','Old award','awarded','2025-01-03'),('${scout}','b2','Unscheduled award','awarded',null),('${scout}','b3','Pending badge','pending','2026-01-09');
 alter table public.badge_requests enable trigger validate_badge_request;
 set role authenticated;select set_config('request.jwt.claim.sub','${admin}',false);`);
 const result=await db.query(`select public.season_stats_source('2026-01-01','2099-12-31') as stats`),stats=result.rows[0].stats;
 assert.equal(stats.scouts.length,2);assert.equal(stats.patrols[0].name,'Panthère');
 const row=stats.scouts.find(x=>x.userId===scout);assert.equal(row.attended,1);assert.equal(row.missed,1);assert.equal(row.completed,1);assert.equal(row.awarded,1);assert.equal(row.tardy,null);assert.equal(row.patrolId,patrol);
 assert.equal(stats.scouts.find(x=>x.userId===other).attended,null);assert.ok(!JSON.stringify(stats).includes('PRIVATE NOTE'));assert.ok(!JSON.stringify(stats).includes('@test.invalid'));
 await assert.rejects(db.query(`select public.season_stats_source('2027-01-01','2026-01-01')`),/Invalid season dates/);
 await db.exec(`select set_config('request.jwt.claim.sub','${scout}',false)`);
 await assert.rejects(db.query(`select public.season_stats_source('2026-01-01','2026-12-31')`),/Administrator access required/);
 await assert.rejects(db.query(`select private.season_stats_source('2026-01-01','2026-12-31')`),/Administrator access required/);
 assert.equal((await db.query('select count(*)::int as n from public.scout_documents')).rows[0].n,2);
 await db.exec(`select set_config('request.jwt.claim.sub','${other}',false)`);
 assert.equal((await db.query('select count(*)::int as n from public.scout_documents')).rows[0].n,0);
 await db.exec(`reset role;set role anon;select set_config('request.jwt.claim.sub','',false)`);
 await assert.rejects(db.query(`select public.season_stats_source('2026-01-01','2026-12-31')`),/permission denied/);
 await db.exec(`reset role;set role authenticated;select set_config('request.jwt.claim.sub','${admin}',false)`);
 const published={seasons:[{name:'Published',patrols:[{id:patrol}],scouts:[{userId:scout,name:'Scout',patrolId:patrol,attended:3,missed:1,completed:2,awarded:1,tardy:0},{userId:other,name:'Private other scout',patrolId:patrol,attended:5,missed:1,completed:1,awarded:0,tardy:1}]}],attendanceDays:['2026-01-05']};
 await db.query(`insert into public.program_content(key,data) values('program',$1)`,[JSON.stringify(published)]);
 assert.equal((await db.query('select data from public.member_program_content')).rows[0].data.seasons[0].scouts.length,2);
 await db.exec(`select set_config('request.jwt.claim.sub','${scout}',false)`);
 assert.equal((await db.query('select data from public.program_content')).rows.length,0);
 const projected=(await db.query('select data from public.member_program_content')).rows[0].data;
 assert.equal(projected.seasons[0].scouts.length,1);assert.equal(projected.seasons[0].scouts[0].userId,scout);
 assert.equal(projected.seasons[0].patrolSummaries[0].members,2);assert.equal(projected.seasons[0].patrolSummaries[0].attended,8);
 assert.ok(!JSON.stringify(projected).includes('Private other scout'));assert.ok(!JSON.stringify(projected).includes(other));
 await db.query(`update public.program_content set data='{}'`);
 assert.equal((await db.query('select data from public.member_program_content')).rows[0].data.seasons[0].name,'Published');
 await db.query(`update public.scout_documents set data=jsonb_set(data,'{self,2026-01-05}','"came"') where key='attendance'`);
 await db.query(`update public.scout_documents set data=data||'{"b4":{"checked":[0,1,2],"notes":""}}'::jsonb where key='badges'`);
 await db.query(`insert into public.badge_requests(badge_id,badge_title) values('b4','Test badge')`);
 await db.exec(`reset role;set role anon;select set_config('request.jwt.claim.sub','',false)`);
 await assert.rejects(db.query('select * from public.member_program_content'),/permission denied/);
 console.log('PASS: full schema, date bounds, missing data, private projection, scout/anonymous RPC denial, document isolation, protected snapshot publication, personal record projection, and badge/attendance writes through the protected program view.');
}catch(e){console.error(e.message);process.exitCode=1;}finally{await db.close();}
