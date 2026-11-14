import {test,expect} from '@playwright/test';
import {mockMember,uid} from './helpers';

test('signed-out users see only sign-in on every route, including after Escape',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 for(const route of ['','home','badges/b0','tools/map','tools/morse','tools/handbook','progress','attendance','patrouilles','account','admin']){
  await page.goto('/#'+route);await expect(page.getByRole('heading',{name:'Sign in',exact:true})).toBeVisible();await expect(page.getByLabel('Username or email')).toBeVisible();await expect(page.locator('.app-shell')).toHaveCount(0);await expect(page.locator('nav')).toHaveCount(0);await expect(page.locator('.home-shortcut')).toHaveCount(0);
 }
 await page.keyboard.press('Escape');await expect(page.getByRole('heading',{name:'Sign in',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Close',exact:true})).toHaveCount(0);expect(errors).toEqual([]);
 await page.screenshot({path:'test-results/sign-in-desktop.png',fullPage:true});
});
test('sign-in supports Arabic on mobile without overflow',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');await page.getByRole('button',{name:'العربية',exact:true}).click();await expect(page.locator('html')).toHaveAttribute('dir','rtl');await expect(page.getByRole('heading',{name:'تسجيل الدخول',exact:true})).toBeVisible();await expect(page.getByLabel('اسم المستخدم أو البريد')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.reload();await expect(page.getByRole('heading',{name:'تسجيل الدخول',exact:true})).toBeVisible();await page.screenshot({path:'test-results/sign-in-mobile-arabic.png',fullPage:true});
});
test('invalid credentials keep sign-in visible; successful login opens requested page and signout locks it',async({page})=>{
 await mockMember(page);await page.addInitScript(()=>localStorage.removeItem('sb-jqrougqghcecxhhvywyx-auth-token'));
 let allow=false;let email='';
 await page.route('**/auth/v1/token*',async route=>{email=route.request().postDataJSON().email;if(!allow)return route.fulfill({status:400,json:{error:'invalid_grant',error_description:'Invalid login credentials'}});const now=Math.floor(Date.now()/1000),token=btoa(JSON.stringify({alg:'HS256',typ:'JWT'}))+'.'+btoa(JSON.stringify({sub:uid,exp:now+3600,iat:now,role:'authenticated'}))+'.test';return route.fulfill({json:{access_token:token,refresh_token:'test-refresh',expires_in:3600,expires_at:now+3600,token_type:'bearer',user:{id:uid,aud:'authenticated',role:'authenticated',email:'scout.test@scout-hub.invalid',app_metadata:{},user_metadata:{},created_at:new Date().toISOString()}}});});
 await page.goto('/#tools/morse');await page.getByLabel('Username or email').fill('scout.test');await page.getByLabel('Password',{exact:true}).fill('Test-password-123!');await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Invalid login credentials');await expect(page.locator('.app-shell')).toHaveCount(0);
 allow=true;await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page.getByLabel('Your message')).toBeVisible();expect(email).toBe('scout.test@scout-hub.invalid');await expect(page.locator('.sign-in-screen')).toHaveCount(0);await page.getByRole('button',{name:'Sign out',exact:true}).click();await expect(page.getByRole('heading',{name:'Sign in',exact:true})).toBeVisible();await expect(page.getByLabel('Your message')).toHaveCount(0);
});
test('restoring a saved session opens the app without a sign-in screen',async({page})=>{
 await mockMember(page);await page.goto('/#badges');await expect(page.locator('.badge-card')).toHaveCount(78);await expect(page.locator('.sign-in-screen')).toHaveCount(0);
});
