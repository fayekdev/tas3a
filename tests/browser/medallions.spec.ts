import {test,expect,type Page} from '@playwright/test';
import {mockMember,uid} from './helpers';

const earned={id:'medal-1',user_id:uid,kind:'attendance',context:'Autumn 2026',citation:'Attended all 12 meetings.',awarded_at:'2026-11-16T12:00:00Z'};
async function setup(page:Page,admin=false,initial:object[]=[]){
  await mockMember(page,admin);
  const state={awards:[...initial] as any[],fail:false};
  await page.route('**/rest/v1/medallion_awards**',async route=>{
    const req=route.request(),url=new URL(req.url());
    if(state.fail)return route.fulfill({status:503,json:{message:'Awards temporarily unavailable'}});
    if(req.method()==='POST'){
      const body=req.postDataJSON();
      if(state.awards.some(a=>a.user_id===body.user_id&&a.kind===body.kind&&a.context.toLowerCase()===body.context.toLowerCase()))return route.fulfill({status:409,json:{code:'23505',message:'Duplicate award'}});
      const a={...earned,...body,id:`medal-${state.awards.length+1}`};state.awards.push(a);return route.fulfill({status:201,json:a});
    }
    if(req.method()==='DELETE'){
      const id=url.searchParams.get('id')?.replace('eq.','');state.awards=state.awards.filter(a=>a.id!==id);return route.fulfill({json:{id}});
    }
    return route.fulfill({json:state.awards});
  });return state;
}

test('unawarded scouts see no placeholder medallions or awarding controls',async({page})=>{
  await setup(page);await page.goto('/#patrouilles');
  await expect(page.locator('.trophy-hall-notice')).toContainText('No medallions yet.');
  await expect(page.locator('.trophy-card')).toHaveCount(0);
  await expect(page.getByRole('form',{name:'Award a medallion'})).toHaveCount(0);
});

for(const lang of ['en','ar'])test(`earned medallions form a compact grid and open details in ${lang}`,async({page})=>{
  await setup(page,false,[earned,{...earned,id:'medal-2',kind:'streak'}, {...earned,id:'medal-3',kind:'habit'}, {...earned,id:'medal-4',user_id:'someone-else',context:'Hidden season'}]);
  await page.setViewportSize({width:320,height:844});await page.addInitScript(lang=>localStorage.setItem('scout-language',lang),lang);
  await page.goto('/#patrouilles');const cards=page.locator('.trophy-card');await expect(cards).toHaveCount(3);
  const boxes=await cards.evaluateAll(nodes=>nodes.map(n=>({y:n.getBoundingClientRect().y,width:n.getBoundingClientRect().width})));
  expect(boxes.every(b=>b.y===boxes[0].y&&b.width<120)).toBe(true);
  expect(await page.locator('.trophy-medallion').first().evaluate(e=>e.getBoundingClientRect().width)).toBe(60);
  await cards.first().focus();await page.keyboard.press('Enter');
  const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();await expect(dialog).toContainText(earned.citation);await expect(dialog).toContainText('Scout test');await expect(dialog.locator('time')).toHaveAttribute('datetime',earned.awarded_at);
  await expect(dialog.getByRole('button',{name:'Revoke medallion'})).toHaveCount(0);
  await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);await expect(cards.first()).toBeFocused();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:`test-results/medallions-${lang}.png`,fullPage:true});
});

test('administrator awards, inspects, rejects duplicates and revokes with persistence',async({page})=>{
  const state=await setup(page,true);await page.goto('/#admin');
  const form=page.getByRole('form',{name:'Award a medallion'});
  async function fill(){await form.getByLabel('Scout',{exact:true}).selectOption(uid);await form.getByLabel('Medallion',{exact:true}).selectOption('attendance');await form.getByLabel('Season or habit').fill('Autumn 2026');await form.getByLabel('Citation').fill(earned.citation);}
  await fill();state.fail=true;await form.getByRole('button',{name:'Award medallion',exact:true}).click();
  await expect(page.locator('.trophy-hall').getByRole('alert')).toContainText('Awards temporarily unavailable');await expect(page.locator('.trophy-card')).toHaveCount(0);await expect(form.getByLabel('Citation')).toHaveValue(earned.citation);
  state.fail=false;await form.getByRole('button',{name:'Award medallion',exact:true}).click();await expect(page.locator('.trophy-card')).toHaveCount(1);expect(state.awards).toHaveLength(1);
  await page.reload();await expect(page.locator('.trophy-card')).toHaveCount(1);
  await fill();await form.getByRole('button',{name:'Award medallion',exact:true}).click();await expect(page.locator('.trophy-hall').getByRole('alert')).toContainText('already has this medallion');await expect(page.locator('.trophy-card')).toHaveCount(1);
  await page.locator('.trophy-card').click();await expect(page.getByRole('dialog')).toContainText(earned.citation);
  page.once('dialog',d=>d.dismiss());await page.getByRole('button',{name:'Revoke medallion'}).click();await expect(page.locator('.trophy-card')).toHaveCount(1);
  page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Revoke medallion'}).click();await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.locator('.trophy-card')).toHaveCount(0);
  await page.reload();await expect(page.locator('.trophy-hall-notice')).toContainText('No medallions awarded yet.');
});
