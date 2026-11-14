import { createClient } from 'npm:@supabase/supabase-js@2.119.0';
const cors = { 'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods':'POST, OPTIONS' };
const roles = ['Chief','Assistant','CP','SP','TP','Patrouillard'];
const url = Deno.env.get('SUPABASE_URL')!;
const service = createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response(null,{headers:cors});
  if(req.method!=='POST')return reply({error:'Method not allowed'},405);
  const token=req.headers.get('Authorization')?.replace(/^Bearer\s+/i,'');
  if(!token)return reply({error:'Sign in required'},401);
  const {data:identity,error:authError}=await service.auth.getUser(token);
  if(authError||!identity.user)return reply({error:'Invalid or expired session'},401);
  const actor=identity.user.id;
  const {data:admin,error:adminError}=await service.from('admin_users').select('user_id').eq('user_id',actor).maybeSingle();
  if(adminError||!admin)return reply({error:'Maintainer access required'},403);
  try {
    const raw=await req.text();if(raw.length>16000)return reply({error:'Request too large'},413);
    const body=JSON.parse(raw);
    if(body.action==='edit'||body.action==='delete'){
      if(typeof body.user_id!=='string')return reply({error:'Choose an account.'},400);
      const {data:target,error:targetError}=await service.from('accounts').select('id,username').eq('id',body.user_id).single();
      if(targetError||!target)return reply({error:'Account not found'},404);
      if(body.action==='delete'){
        const {data:protectedAccount,error:protectError}=await service.from('admin_users').select('user_id').eq('user_id',body.user_id).maybeSingle();
        if(protectError)throw protectError;
        if(protectedAccount||body.user_id===actor)return reply({error:'Administrator accounts cannot be deleted here.'},400);
        const {error}=await service.auth.admin.deleteUser(body.user_id);if(error)throw error;
        if(target.username)await service.from('account_imports').delete().eq('username',target.username);
      }else{
        if(typeof body.display_name!=='string'||!body.display_name.trim()||body.display_name.trim().length>80||!roles.includes(body.scout_role))return reply({error:'Enter a valid name and scout role.'},400);
        const {error}=await service.rpc('edit_scout_account',{p_user:body.user_id,p_name:body.display_name.trim(),p_role:body.scout_role,p_patrol:body.patrouille_id||null});if(error)throw error;
      }
      await service.from('audit_events').insert({actor_id:actor,action:body.action==='delete'?'account.deleted':'account.edited',record_id:body.user_id});
      return reply({success:true});
    }
    if(body.action==='reset'){
      if(typeof body.user_id!=='string'||typeof body.password!=='string'||body.password.length<12||body.password.length>128)return reply({error:'Choose a password between 12 and 128 characters.'},400);
      const {error}=await service.auth.admin.updateUserById(body.user_id,{password:body.password});
      if(error)throw error;
      await service.from('audit_events').insert({actor_id:actor,action:'account.password_reset',record_id:body.user_id});
      return reply({success:true});
    }
    let ids:string[]=[];
    if(body.action==='create'){
      if(typeof body.username!=='string'||!/^[a-z0-9][a-z0-9._-]{2,39}$/.test(body.username)||typeof body.display_name!=='string'||!body.display_name.trim()||body.display_name.trim().length>80||!roles.includes(body.scout_role))return reply({error:'Enter a valid username, display name, and scout role.'},400);
      if(body.password!==undefined&&(typeof body.password!=='string'||body.password.length<12||body.password.length>128))return reply({error:'Choose a password between 12 and 128 characters.'},400);
      const {data:existing,error:lookupError}=await service.from('account_imports').select('id,status,user_id').eq('username',body.username).maybeSingle();
      if(lookupError)throw lookupError;
      const fields={username:body.username,display_name:body.display_name.trim(),scout_role:body.scout_role,patrouille_name:body.patrouille_name||null};
      if(existing){
        if(existing.status!=='failed'||existing.user_id)return reply({error:'This username already exists or is being processed.'},409);
        const {data,error}=await service.from('account_imports').update({...fields,status:'pending',error:null}).eq('id',existing.id).eq('status','failed').is('user_id',null).select('id').single();if(error)throw error;ids=[data.id];
      }else{
        const {data,error}=await service.from('account_imports').insert(fields).select('id').single();if(error)throw error;ids=[data.id];
      }
    } else if(body.action==='process'){
      const {data,error}=await service.from('account_imports').select('id').eq('status','pending').order('created_at').limit(20);
      if(error)throw error;ids=data.map(row=>row.id);
    } else return reply({error:'Unknown action'},400);
    const results:Record<string,unknown>[]=[];
    for(const id of ids){
      const {data:jobs,error:claimError}=await service.rpc('claim_account_import',{p_id:id});
      if(claimError)throw claimError;
      const job=jobs?.[0];if(!job)continue;
      let userId:string|undefined;
      const password=body.action==='create'&&body.password?body.password:`Aa1!${crypto.randomUUID()}${crypto.randomUUID().slice(0,8)}`;
      try{
        const {data,error}=await service.auth.admin.createUser({email:`${job.username}@scout-hub.invalid`,password,email_confirm:true,user_metadata:{display_name:job.display_name,provisioning_token:job.provisioning_token},app_metadata:{scout_provisioned:true,scout_username:job.username}});
        if(error)throw error;userId=data.user.id;
        const {error:finishError}=await service.rpc('finish_account_import',{p_import:id,p_user:userId,p_actor:actor});
        if(finishError)throw finishError;
        results.push({username:job.username,status:'complete',password});
      }catch(e){
        const message=e instanceof Error?e.message:(e as {message?:string})?.message??'Account creation failed';
        if(userId){const {error:cleanupError}=await service.auth.admin.deleteUser(userId);if(cleanupError){await service.from('account_imports').update({status:'failed',user_id:userId,error:'Provisioning incomplete; account retained. Check the account before retrying.'}).eq('id',id);results.push({username:job.username,status:'failed',error:'Provisioning incomplete. Check the account.'});continue;}}
        await service.from('account_imports').update({status:'failed',error:message}).eq('id',id);
        results.push({username:job.username,status:'failed',error:message});
      }
    }
    return reply({results});
  }catch(e){return reply({error:e instanceof Error?e.message:(e as {message?:string})?.message??'Request failed'},400);}
});
