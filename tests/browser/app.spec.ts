import { test, expect } from '@playwright/test';
import {mockMember} from './helpers';
test('mobile Arabic layout stays inside the viewport and navigation works',async({page})=>{
  await mockMember(page);
  await page.setViewportSize({width:390,height:844});
  await page.goto('/');
  await page.getByRole('button',{name:'العربية',exact:true}).click();
  await expect(page.locator('html')).toHaveAttribute('dir','rtl');
  await expect(page.getByRole('heading',{name:'تاسعة',exact:true})).toBeVisible();
  const cards=await page.locator('.home-shortcut').evaluateAll(cards=>cards.map(c=>{const r=c.getBoundingClientRect();return {x:r.x,right:r.right,width:r.width};}));
  for(const card of cards){expect(card.x).toBeGreaterThanOrEqual(0);expect(card.right).toBeLessThanOrEqual(390);}
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.screenshot({path:'test-results/home-mobile-arabic.png',fullPage:true});
  await page.getByRole('button',{name:'Menu',exact:true}).click();
  await page.getByRole('link',{name:'قاعة الأوسمة',exact:true}).click();
  await expect(page.getByRole('heading',{name:'قاعة الأوسمة',exact:true})).toBeVisible();
});

test('maintainer can edit program content and publish achievement galleries',async({page})=>{
  const writes:any[]=[];const documents:Record<string,unknown>={};
  const uid='00000000-0000-4000-8000-000000000001';
  await page.route('https://jqrougqghcecxhhvywyx.supabase.co/**',async route=>{
    const req=route.request(),url=new URL(req.url());
    if(url.pathname.includes('/rpc/is_admin'))return route.fulfill({json:true});
    if(url.pathname.includes('/auth/v1/logout'))return route.fulfill({status:204});
    if((url.pathname.endsWith('/program_content')||url.pathname.endsWith('/member_program_content'))||url.pathname.endsWith('/scout_documents')){
      if(req.method()==='POST'){const row=req.postDataJSON();writes.push(row);documents[row.key]=row.data;return route.fulfill({status:201,body:''});}
      const key=url.searchParams.get('key')?.replace('eq.','')||'';
      return route.fulfill({json:documents[key]?[{data:documents[key]}]:[]});
    }
    if(url.pathname.endsWith('/accounts'))return route.fulfill({json:[{id:uid,display_name:'Test maintainer',username:'test.maintainer',scout_role:'Chief'}]});
    return route.fulfill({json:[]});
  });
  await page.addInitScript(({uid})=>{
    const now=Math.floor(Date.now()/1000);const token=btoa(JSON.stringify({alg:'HS256',typ:'JWT'}))+'.'+btoa(JSON.stringify({sub:uid,exp:now+3600,iat:now,role:'authenticated'}))+'.test-signature';
    localStorage.setItem('sb-jqrougqghcecxhhvywyx-auth-token',JSON.stringify({access_token:token,refresh_token:'test-refresh',expires_at:now+3600,expires_in:3600,token_type:'bearer',user:{id:uid,aud:'authenticated',role:'authenticated',email:'test@example.invalid',app_metadata:{},user_metadata:{},created_at:new Date().toISOString()}}));
  },{uid});
  await page.goto('/#badges');
  await page.getByRole('button',{name:'Add badge',exact:true}).click();
  await page.getByLabel('English name',{exact:true}).fill('Test badge');
  await page.getByLabel('الاسم العربي',{exact:true}).fill('شارة اختبار');
  await page.getByLabel('English requirements',{exact:true}).fill('Complete the exercise');
  await page.getByLabel('المتطلبات بالعربية',{exact:true}).fill('أكمل التدريب');
  await page.getByRole('button',{name:'Save badge',exact:true}).click();
  await expect(page.locator('.badge-card')).toHaveCount(79);
  await expect.poll(()=>writes.some(w=>w.key==='program'&&w.data.custom.length===1)).toBe(true);
  await page.goto('/#badges/b0');
  await page.getByRole('checkbox').first().check();
  await expect.poll(()=>writes.some(w=>w.key==='badges'&&w.user_id===uid&&w.data.b0.checked.length===1)).toBe(true);
  await page.goto('/#progress');
  await page.getByRole('button',{name:'Add achievement',exact:true}).click();
  await page.getByLabel('English title',{exact:true}).fill('Camp completed');
  await page.getByLabel('العنوان العربي',{exact:true}).fill('اكتمل المعسكر');
  const photo={name:'camp.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aL1sAAAAASUVORK5CYII=','base64')};
  await page.getByLabel('Main image',{exact:true}).setInputFiles(photo);
  await page.getByLabel('Gallery (up to 10 images)',{exact:true}).setInputFiles(photo);
  await page.getByRole('button',{name:'Save achievement',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Camp completed',exact:true})).toBeVisible();
  await expect(page.locator('.photo-gallery img')).toHaveCount(1);
  await expect.poll(()=>writes.some(w=>w.key==='program'&&w.data.achievements.length===1)).toBe(true);
  await page.getByRole('button',{name:'Sign out',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Camp completed',exact:true})).toHaveCount(0);
});

test('original catalog checklists, source scans, filters and achievements persist',async({page})=>{
  const state=await mockMember(page);state.documents={};
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/#badges');
  await expect(page.locator('.badge-card')).toHaveCount(78);
  await page.getByLabel('Search badges').fill('Church Historian');
  await page.getByRole('link',{name:/Church Historian/}).click();
  await expect(page.getByRole('checkbox')).toHaveCount(6);
  await page.getByRole('checkbox').first().check();
  await page.getByLabel('Notes',{exact:true}).fill('Read chapter one');
  await page.reload();
  await expect(page.getByRole('checkbox').first()).toBeChecked();
  await expect(page.getByLabel('Notes',{exact:true})).toHaveValue('Read chapter one');
  await page.getByRole('button',{name:'Original page',exact:true}).click();
  await expect(page.getByRole('dialog').locator('img')).toBeVisible();
  expect(await page.getByRole('dialog').locator('img').evaluate((img:HTMLImageElement)=>img.naturalWidth)).toBeGreaterThan(0);
  await page.keyboard.press('Escape');
  for(const checkbox of await page.getByRole('checkbox').all())await checkbox.check();
  await page.goto('/#progress');
  await expect(page.getByRole('link',{name:/Church Historian/})).toBeVisible();
  await page.goto('/#badges');
  await page.getByLabel('Search badges').fill('no-badge-matches-this');
  await expect(page.getByRole('heading',{name:'No matching badges'})).toBeVisible();
  await page.getByRole('button',{name:'Clear filters'}).click();
  await expect(page.locator('.badge-card')).toHaveCount(78);
  expect(errors).toEqual([]);
});

test('map symbols, undo, redo, named drafts and PNG export work',async({page})=>{
  const state=await mockMember(page);state.documents={};
  await page.goto('/#tools/map');
  await page.getByLabel('Map title',{exact:true}).fill('Camp route');
  await page.getByRole('button',{name:'Symbol',exact:true}).click();
  await page.getByRole('button',{name:/Camp site/}).click();
  const canvas=page.locator('.sketch-surface');
  await canvas.click({position:{x:150,y:130}});
  await expect(page.locator('[data-shape]')).toHaveCount(1);
  await page.getByRole('button',{name:'Undo',exact:true}).click();
  await expect(page.locator('[data-shape]')).toHaveCount(0);
  await page.getByRole('button',{name:'Redo',exact:true}).click();
  await expect(page.locator('[data-shape]')).toHaveCount(1);
  await page.reload();
  await expect(page.locator('[data-shape]')).toHaveCount(1);
  await expect(page.getByLabel('Map title',{exact:true})).toHaveValue('Camp route');
  const download=page.waitForEvent('download');
  await page.getByRole('button',{name:'Export PNG',exact:true}).click();
  expect((await download).suggestedFilename()).toBe('Camp route.png');
  await page.getByRole('button',{name:'New map',exact:true}).click();
  await expect(page.locator('[data-shape]')).toHaveCount(0);
  await page.getByLabel('Saved maps',{exact:true}).selectOption({label:'Camp route'});
  await expect(page.locator('[data-shape]')).toHaveCount(1);
});

test('attendance and handbook bookmarks persist; Arabic Morse decodes separately',async({page})=>{
  const state=await mockMember(page);state.documents={};
  await page.goto('/#attendance');
  await page.getByRole('button',{name:'I came',exact:true}).click();
  await expect(page.getByRole('heading',{name:'My team',exact:true})).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('button',{name:'I came',exact:true})).toHaveAttribute('aria-pressed','true');
  await page.goto('/#tools/handbook');
  await page.getByRole('button',{name:'حفظ وعد الكشافة',exact:true}).click();
  await page.reload();
  await expect(page.getByRole('button',{name:'حفظ وعد الكشافة',exact:true})).toHaveAttribute('aria-pressed','true');
  await page.getByLabel('بحث في الدليل').fill('صلاة');
  await expect(page.locator('.handbook-section')).toHaveCount(1);
  await page.goto('/#tools/morse');
  await page.getByLabel('Alphabet',{exact:true}).selectOption('ar');
  await page.getByLabel('Your message').fill('سلام');
  await expect(page.getByRole('status')).toHaveText('... .-.. .- --');
  await page.getByRole('button',{name:'Decode',exact:true}).click();
  await page.getByLabel('Your message').fill('... .-.. .- --');
  await expect(page.getByRole('status')).toHaveText('سلام');
});

test('all restored pages fit a narrow Arabic viewport',async({page})=>{
  const state=await mockMember(page);state.documents={};
  await page.setViewportSize({width:390,height:844});await page.goto('/');
  await page.getByRole('button',{name:'العربية',exact:true}).click();
  for(const route of ['badges','badges/b0','tools/morse','tools/map','tools/handbook','progress','attendance','account']){
    await page.goto('/#'+route);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),route).toBe(true);
  }
});
