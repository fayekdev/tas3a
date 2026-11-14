import type {Page} from '@playwright/test';
export const uid='00000000-0000-4000-8000-000000000002';
export async function mockMember(page:Page,admin=false,role='Patrouillard'){
 const state={program:{badges:{},custom:[],hidden:[],handbook:{},achievements:[],symbols:[],events:[],attendanceDays:[]},requests:[] as any[],calls:[] as any[],documents:{badges:{b0:{checked:[0,1,2,3,4,5],notes:''}}} as Record<string,any>};
 await page.route('https://jqrougqghcecxhhvywyx.supabase.co/**',async route=>{
  const req=route.request(),url=new URL(req.url()),path=url.pathname;
  if(path.includes('/rpc/is_admin'))return route.fulfill({json:admin});
  if(path.includes('/auth/v1/logout'))return route.fulfill({status:204});
  if(path.endsWith('/accounts')){const account={id:uid,display_name:'Scout test',username:'scout.test',scout_role:role};return route.fulfill({json:req.headers().accept?.includes('vnd.pgrst.object')?account:[account]});}
  if(path.endsWith('/program_content')){if(req.method()==='POST'){state.program=req.postDataJSON().data;return route.fulfill({status:201,body:''});}return route.fulfill({json:[{data:state.program}]});}
  if(path.endsWith('/scout_documents')){const key=url.searchParams.get('key')?.replace('eq.','')||'';if(req.method()==='POST'){state.documents[req.postDataJSON().key]=req.postDataJSON().data;return route.fulfill({status:201,body:''});}return route.fulfill({json:state.documents[key]?[{data:state.documents[key]}]:[]});}
  if(path.endsWith('/badge_requests')){if(req.method()==='POST'){state.requests.push({...req.postDataJSON(),id:'request-1',user_id:uid,display_name:'Scout test',status:'pending',meeting_date:null});}if(req.method()==='PATCH'){Object.assign(state.requests[0],req.postDataJSON());}return route.fulfill({json:req.method()==='GET'?state.requests:[]});}
  if(path.endsWith('/manage-accounts')){const body=req.postDataJSON();state.calls.push(body);return route.fulfill({json:body.action==='create'?{results:[{username:body.username,status:'complete',password:'Generated-Test-123!'}]}:{success:true}});}
  return route.fulfill({json:[]});
 });
 await page.addInitScript(({uid})=>{const now=Math.floor(Date.now()/1000);const token=btoa(JSON.stringify({alg:'HS256',typ:'JWT'}))+'.'+btoa(JSON.stringify({sub:uid,exp:now+3600,iat:now,role:'authenticated'}))+'.test';localStorage.setItem('sb-jqrougqghcecxhhvywyx-auth-token',JSON.stringify({access_token:token,refresh_token:'test-refresh',expires_at:now+3600,expires_in:3600,token_type:'bearer',user:{id:uid,aud:'authenticated',role:'authenticated',email:'scout.test@scout-hub.invalid',app_metadata:{},user_metadata:{},created_at:new Date().toISOString()}}));},{uid});
 return state;
}
