// Isolated database verification; no live accounts or awards are created.
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {PGlite} from '../.build-tools/stats-db/node_modules/@electric-sql/pglite/dist/index.js';
const db=new PGlite();
const admin='20000000-0000-4000-8000-000000000001',scout='20000000-0000-4000-8000-000000000002',other='20000000-0000-4000-8000-000000000003';
try{
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_app_meta_data jsonb,raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;
    create function public.rls_auto_enable() returns event_trigger language plpgsql as $$ begin null; end $$;`);
  for(const path of ['supabase/migrations/202611140001_scout_hub.sql','supabase/roles-and-imports.sql','supabase/permission-hardening.sql','supabase/feature-storage.sql','supabase/requests-and-accounts.sql','supabase/medallion-awards.sql'])await db.exec(await readFile(path,'utf8'));
  for(const [id,name] of [[admin,'Admin'],[scout,'Scout'],[other,'Other']])await db.query(`insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data) values($1,$2,'{"scout_provisioned":true}',$3)`,[id,`${name}@test.invalid`,JSON.stringify({display_name:name})]);
  await db.query('insert into public.admin_users(user_id) values($1)',[admin]);
  await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${admin}',false)`);
  const insert=`insert into public.medallion_awards(user_id,kind,context,citation) values($1,$2,$3,$4) returning *`;
  const first=(await db.query(insert,[scout,'attendance','Autumn 2026','Attended every meeting.'])).rows[0];
  assert.equal(first.awarded_by,admin);assert.ok(first.awarded_at);
  await db.query(insert,[other,'season','Autumn 2026','Season champion.']);
  await assert.rejects(db.query(insert,[scout,'attendance','AUTUMN 2026','Duplicate']),/duplicate key/);
  await assert.rejects(db.query(insert,[scout,'fake','Autumn 2026','Invalid']),/check constraint/);
  await assert.rejects(db.query(insert,[scout,'habit','   ','Invalid']),/check constraint/);
  await assert.rejects(db.query(`insert into public.medallion_awards(user_id,kind,context,citation,awarded_by) values($1,'habit','Daily reading','Forged',$1)`,[scout]),/permission denied/);
  assert.equal((await db.query('select * from public.medallion_awards')).rows.length,2);
  await db.exec(`select set_config('request.jwt.claim.sub','${scout}',false)`);
  assert.equal((await db.query('select * from public.medallion_awards')).rows.length,1);
  assert.equal((await db.query('select * from public.medallion_awards where user_id=$1',[other])).rows.length,0);
  await assert.rejects(db.query(insert,[scout,'habit','Daily reading','Self-award']),/row-level security/);
  await assert.rejects(db.query(`update public.medallion_awards set citation='Changed'`),/permission denied/);
  assert.equal((await db.query('delete from public.medallion_awards returning id')).rows.length,0);
  await db.exec(`reset role;set role anon;select set_config('request.jwt.claim.sub','',false)`);
  await assert.rejects(db.query('select * from public.medallion_awards'),/permission denied/);
  await db.exec(`reset role;set role authenticated;select set_config('request.jwt.claim.sub','${admin}',false)`);
  assert.equal((await db.query('delete from public.medallion_awards where id=$1 returning id',[first.id])).rows.length,1);
  await db.exec(`select set_config('request.jwt.claim.sub','${scout}',false)`);
  assert.equal((await db.query('select * from public.medallion_awards')).rows.length,0);
  console.log('PASS: issuing, server attribution, duplicate/invalid award rejection, private galleries, self-award/edit/delete denial, anonymous denial, and admin revocation.');
}catch(e){console.error(e);process.exitCode=1;}finally{await db.close();}
