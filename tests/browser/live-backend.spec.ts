import {test,expect} from '@playwright/test';
import {createClient} from '@supabase/supabase-js';
import {existsSync,readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';

const fixturePath='.build-tools/live-qa-fixture.json';
test('live account lifecycle, every scout role, badge presentation and access controls',async({page})=>{
 test.skip(!existsSync(fixturePath),'Needs an explicitly approved temporary live administrator fixture.');
 test.setTimeout(180000);page.setDefaultTimeout(15000);
 const fixture=JSON.parse(readFileSync(fixturePath,'utf8'));
 const env=Object.fromEntries(readFileSync('.env.local','utf8').split(/\r?\n/).filter(l=>l.includes('=')).map(l=>{const at=l.indexOf('=');return [l.slice(0,at),l.slice(at+1).trim()];}));
 const client=()=>createClient(env.VITE_SUPABASE_URL,env.VITE_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(20000)})}});
 const admin=client();const auth=await admin.auth.signInWithPassword({email:fixture.username+'@scout-hub.invalid',password:fixture.password});expect(auth.error?.message).toBeUndefined();expect((await admin.rpc('is_admin')).data).toBe(true);console.info('Live QA: administrator authenticated');
 const patrolName='QA '+fixture.username;let patrolId:string|undefined;
 const created:{username:string;id:string;password:string;role:string;client:ReturnType<typeof client>}[]=[];
 const intendedNames=['patrouillard','chief','assistant','cp','sp','tp'].map(role=>fixture.username+'.'+role);
 const invoke=async(body:Record<string,unknown>)=>{const result=await admin.functions.invoke('manage-accounts',{body});if(result.error){let detail=result.error.message;try{detail=(await result.error.context.json()).error||detail;}catch{}throw new Error(detail);}return result.data;};
 try{
  const unauthorized=await page.request.post(env.VITE_SUPABASE_URL+'/functions/v1/manage-accounts',{headers:{apikey:env.VITE_SUPABASE_PUBLISHABLE_KEY},data:{action:'create',username:fixture.username+'.blocked',display_name:'Blocked',scout_role:'Patrouillard'}});expect(unauthorized.status()).toBe(401);
  const existingPatrol=await admin.from('patrouilles').select('id').eq('name',patrolName).eq('created_by',fixture.id).maybeSingle();if(existingPatrol.data)patrolId=existingPatrol.data.id;else{const patrol=await admin.rpc('create_patrouille',{p_name:patrolName,p_motto:'Temporary verification',p_symbol:'gazelle',p_leader:null});expect(patrol.error?.message).toBeUndefined();patrolId=patrol.data;}console.info('Live QA: temporary patrol created');
  console.info('Live QA: opening browser login');await page.goto('/');await page.getByLabel('Username or email').fill(fixture.username);await page.getByLabel('Password',{exact:true}).fill(fixture.password);await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page.getByRole('link',{name:'Administration',exact:true})).toBeVisible();console.info('Live QA: browser administrator signed in');
  await page.getByRole('link',{name:'Administration',exact:true}).click();await page.getByRole('button',{name:'Create account',exact:true}).click();await page.locator('input[name=username]').fill(intendedNames[0]);await page.getByLabel('Display name',{exact:true}).fill('Temporary QA scout');await page.locator('select[name=patrol]').selectOption({label:patrolName});await expect(page.locator('input[type=email]')).toHaveCount(0);await page.getByRole('button',{name:'Create account',exact:true}).last().click();
  await expect(page.locator('.credential code')).toBeVisible({timeout:20000});const scoutPassword=await page.locator('.credential code').innerText();console.info('Live QA: username-only account created in browser');
  for(const [index,role] of ['Patrouillard','Chief','Assistant','CP','SP','TP'].entries()){
   const username=intendedNames[index];let password=scoutPassword;
   if(index){const result=await invoke({action:'create',username,display_name:'Temporary QA '+role,scout_role:role,patrouille_name:patrolName});expect(result.results[0].status,result.results[0].error).toBe('complete');password=result.results[0].password;}
   const member=client();const login=await member.auth.signInWithPassword({email:username+'@scout-hub.invalid',password});expect(login.error?.message).toBeUndefined();const id=login.data.user!.id;created.push({username,id,password,role,client:member});expect(login.data.user!.email_confirmed_at).toBeTruthy();expect((await member.rpc('is_admin')).data).toBe(false);const account=await member.from('accounts').select('*');expect(account.error?.message).toBeUndefined();expect(account.data).toHaveLength(1);expect(account.data![0].scout_role).toBe(role);
  }
  console.info('Live QA: all six scout roles logged in successfully');const scout=created[0],chief=created[1],assistant=created[2];
  const denied=await scout.client.functions.invoke('manage-accounts',{body:{action:'delete',user_id:chief.id}});expect(denied.error?.context?.status).toBe(403);
  const escalation=await scout.client.from('accounts').update({scout_role:'Chief'}).eq('id',scout.id);expect(escalation.error?.code).toBe('42501');
  const early=await scout.client.from('badge_requests').insert({badge_id:'b0',badge_title:'Church Historian'});expect(early.error?.message).toContain('Save all completed');
  const program=await scout.client.from('member_program_content').select('data').eq('key','program').maybeSingle();expect(program.error?.message).toBeUndefined();const original=JSON.parse(readFileSync('src/catalog.json','utf8')).find((b:any)=>b.id==='b0');const count=(program.data?.data?.badges?.b0?.requirements||original.requirements).length;
  const save=await scout.client.from('scout_documents').upsert({key:'badges',user_id:scout.id,data:{b0:{checked:Array.from({length:count},(_,i)=>i),notes:'Temporary live QA'}}},{onConflict:'user_id,key'});expect(save.error?.message).toBeUndefined();
  const request=await scout.client.from('badge_requests').insert({badge_id:'b0',badge_title:'Church Historian'}).select().single();expect(request.error?.message).toBeUndefined();const requestId=request.data!.id;
  expect((await scout.client.from('badge_requests').insert({badge_id:'b0',badge_title:'Church Historian'})).error?.code).toBe('23505');
  expect((await created[3].client.from('badge_requests').select().eq('id',requestId)).data).toHaveLength(0);
  const scheduled=await chief.client.from('badge_requests').update({status:'scheduled',meeting_date:'2026-12-04'}).eq('id',requestId).select();expect(scheduled.error?.message).toBeUndefined();expect(scheduled.data).toHaveLength(1);
  const awarded=await assistant.client.from('badge_requests').update({status:'awarded'}).eq('id',requestId).select();expect(awarded.error?.message).toBeUndefined();expect(awarded.data![0].status).toBe('awarded');
  await page.getByRole('button',{name:'Sign out',exact:true}).click();await page.getByLabel('Username or email').fill(scout.username);await page.getByLabel('Password',{exact:true}).fill(scout.password);await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page.getByRole('button',{name:'Sign out',exact:true})).toBeVisible();await expect(page.getByRole('link',{name:'Administration',exact:true})).toHaveCount(0);await page.goto('/#badges/b0');await expect(page.getByText('Badge awarded',{exact:false})).toBeVisible();expect((await admin.auth.signInWithPassword({email:fixture.username+'@scout-hub.invalid',password:fixture.password})).error?.message).toBeUndefined();console.info('Live QA: request, Chief scheduling and Assistant award verified');
  const attendance=await scout.client.from('scout_documents').upsert({key:'attendance',user_id:scout.id,data:{self:{'2026-11-13':'came'},team:{}}},{onConflict:'user_id,key'});expect(attendance.error?.code).toBe('42501');
  const registered=await chief.client.rpc('save_attendance_register',{p_date:'2026-11-13',p_records:[{userId:scout.id,status:'present',lateMinutes:7}]});expect(registered.error?.message).toBeUndefined();
  const register=await assistant.client.rpc('attendance_register',{p_date:'2026-11-13'});expect(register.error?.message).toBeUndefined();expect(register.data.records.find((r:any)=>r.userId===scout.id).lateMinutes).toBe(7);
  const forbiddenDay=await chief.client.rpc('save_attendance_register',{p_date:'2026-11-14',p_records:[{userId:scout.id,status:'present',lateMinutes:0}]});if(!(program.data?.data?.attendanceDays||[]).includes('2026-11-14'))expect(forbiddenDay.error?.message).toContain('Fridays');
  await invoke({action:'edit',user_id:scout.id,display_name:'Edited QA scout',scout_role:'SP',patrouille_id:patrolId});expect((await scout.client.from('accounts').select('display_name,scout_role').single()).data).toEqual({display_name:'Edited QA scout',scout_role:'SP'});
  const newPassword='Qa!'+randomUUID();await invoke({action:'reset',user_id:scout.id,password:newPassword});const oldLogin=await client().auth.signInWithPassword({email:scout.username+'@scout-hub.invalid',password:scout.password});expect(oldLogin.error).not.toBeNull();const newLogin=await client().auth.signInWithPassword({email:scout.username+'@scout-hub.invalid',password:newPassword});expect(newLogin.error?.message).toBeUndefined();
  await invoke({action:'delete',user_id:scout.id});expect((await scout.client.auth.getUser()).error).not.toBeNull();expect((await admin.from('accounts').select('id').eq('id',scout.id)).data).toHaveLength(0);expect((await chief.client.from('badge_requests').select('id').eq('id',requestId)).data).toHaveLength(0);expect((await scout.client.from('program_content').select('key')).data).toHaveLength(0);
 }finally{
  await admin.auth.signInWithPassword({email:fixture.username+'@scout-hub.invalid',password:fixture.password});
  for(const username of intendedNames){const result=await admin.from('accounts').select('id').eq('username',username).maybeSingle();if(result.data)await invoke({action:'delete',user_id:result.data.id});}
  if(patrolId){const result=await admin.from('patrouilles').delete().eq('id',patrolId);expect(result.error?.message).toBeUndefined();}
  for(const account of created)await account.client.auth.signOut();await admin.auth.signOut();
 }
});
