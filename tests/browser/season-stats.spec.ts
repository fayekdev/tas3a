import {test,expect} from '@playwright/test';
import {mockMember,uid} from './helpers';
import type {Season,StatsSource} from '../../src/statsModel';

const patrols=['panthere','gazelle','lion','renard','loup'].map((symbol,i)=>({id:`p${i}`,name:['Panthère','Gazelle','Lion','Renard','Loup'][i],symbol,points:50-i*5,active:true}));
const source:StatsSource={patrols:patrols as any,scouts:[{userId:uid,name:'Scout test',patrolId:'p0',attended:8,missed:2,completed:3,awarded:1,tardy:null}]};
const season:Season={id:'s1',name:'Samurai 2026',start:'2026-09-01',end:'2027-08-31',patrols:patrols as any,scouts:[{...source.scouts[0],tardy:1}]};
async function setup(page:any,admin=false){const state=await mockMember(page,admin);Object.assign(state.program,{seasons:[{...season,id:'s0',name:'2025 season',start:'2025-09-01',end:'2026-08-31',closed:true,scouts:[{...source.scouts[0],attended:4,tardy:0}]},season],activeSeasonId:'s1'});return state;}

test('public stats show patrol totals and scores without individual scout records',async({page})=>{
 await setup(page);await page.goto('/#stats');await expect(page.getByRole('heading',{name:'Season stats',exact:true})).toBeVisible();await expect(page.locator('.score-entry')).toHaveCount(5);await expect(page.locator('.podium-contender')).toHaveCount(3);await expect(page.locator('.patrol-stat-card')).toHaveCount(5);await expect(page.locator('.patrol-stat-card').filter({hasText:'Panthère'})).toContainText('80%');
 await expect(page.locator('.scout-stat-card')).toHaveCount(0);await expect(page.getByText('Scout test',{exact:true})).toHaveCount(0);await expect(page.getByLabel('Find a scout')).toHaveCount(0);await expect(page.getByRole('button',{name:'Refresh from records'})).toHaveCount(0);await expect(page.getByRole('button',{name:'Edit stats',exact:true})).toHaveCount(0);
 await expect(page.locator('.season-scoreboard')).not.toContainText('Attendance');await expect(page.locator('.season-scoreboard')).not.toContainText('badges');await page.getByRole('combobox',{name:'Season',exact:true}).selectOption('s0');await expect(page.locator('.patrol-stat-card').filter({hasText:'Panthère'})).toContainText('67%');
});

test('admins retain scout filters and history across seasons',async({page})=>{
 await setup(page,true);await page.goto('/#stats');await page.getByRole('button',{name:'View season history'}).click();await expect(page.getByRole('region',{name:'Scout season history'}).locator('article')).toHaveCount(2);
 await page.getByLabel('Find a scout').fill('missing');await expect(page.getByText('No matching scouts.')).toBeVisible();await page.getByLabel('Find a scout').fill('');await page.getByRole('combobox',{name:'Patrouille',exact:true}).selectOption('p1');await expect(page.locator('.scout-stat-card')).toHaveCount(0);await page.getByRole('combobox',{name:'Season',exact:true}).selectOption('s0');await expect(page.locator('.scout-stat-card')).toHaveCount(1);
});

test('admin creates, refreshes, edits and archives a season; saves survive reload',async({page})=>{
 const state=await setup(page,true);state.statsSource=source;let fail=false;
 await page.route('**/rest/v1/rpc/season_stats_source',r=>r.fulfill(fail?{status:503,json:{message:'Stats temporarily unavailable'}}:{json:source}));
 await page.goto('/#stats');await page.getByRole('button',{name:'Refresh from records',exact:true}).click();await expect.poll(()=>(state.program as any).seasons[1].scouts[0].attended).toBe(8);
 await page.getByRole('button',{name:'Edit stats',exact:true}).click();const editor=page.getByRole('form',{name:'Edit scout stats'});await editor.getByLabel('Late arrivals',{exact:true}).fill('2');await editor.getByRole('button',{name:'Save stats',exact:true}).click();await expect.poll(()=>(state.program as any).seasons[1].scouts[0].tardy).toBe(2);
 await page.getByText('Manage scoreboard',{exact:true}).click();const score=page.locator('.score-edit-row').filter({hasText:'Gazelle'});await score.getByLabel('Points',{exact:true}).fill('75');await score.getByRole('button',{name:'Save score'}).click();await expect(page.locator('.podium-place-1')).toContainText('Gazelle');
 fail=true;await page.getByRole('button',{name:'Refresh from records',exact:true}).click();await expect(page.getByRole('alert')).toContainText('published snapshot is unchanged');await expect(page.locator('.podium-place-1')).toContainText('75');
 await page.reload();await expect(page.locator('.scout-stat-card')).toContainText('2');await page.getByRole('button',{name:'Archive season',exact:true}).click();await expect(page.getByRole('button',{name:'Refresh from records'})).toBeDisabled();await expect(page.getByRole('button',{name:'Edit stats',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Add season',exact:true}).click();await page.getByLabel('Season name',{exact:true}).fill('Next season');await page.getByLabel('Season starts',{exact:true}).fill('2027-09-01');await page.getByLabel('Season ends',{exact:true}).fill('2028-08-31');await page.getByRole('button',{name:'Create season',exact:true}).click();await expect(page.locator('.scout-stat-card')).toHaveCount(1);await expect.poll(()=>(state.program as any).seasons.length).toBe(3);
});

test('slideshow advances automatically, pauses on hover and respects reduced motion',async({page})=>{
 await setup(page);await page.emulateMedia({reducedMotion:'no-preference'});await page.clock.install();await page.goto('/#home');await expect(page.locator('.season-banner-copy')).toBeVisible();await expect(page.locator('.season-carousel-controls')).toHaveCount(0);await page.waitForTimeout(200);await page.clock.runFor(4100);await expect(page.locator('.season-slide.is-active .score-entry')).toHaveCount(5);
 await page.locator('.season-banner').hover();await page.waitForTimeout(200);await page.clock.fastForward(16000);await expect(page.locator('.score-entry')).toHaveCount(5);
 await page.emulateMedia({reducedMotion:'reduce'});await page.reload();await expect(page.locator('.season-banner-copy')).toBeVisible();await page.clock.fastForward(16000);await expect(page.locator('.season-banner-copy')).toBeVisible();await page.locator('.season-banner').focus();await page.keyboard.press('ArrowRight');await expect(page.locator('.season-slide.is-active .score-entry')).toHaveCount(5);await page.keyboard.press('ArrowRight');await expect(page.locator('.personal-banner-content')).toBeVisible();await expect(page.locator('.personal-banner-content')).toContainText('80%');
});

for(const lang of ['en','ar'])for(const width of [320,390,598])test(`scoreboard, stats and date layout ${lang} at ${width}px`,async({page})=>{
 await setup(page);await page.setViewportSize({width,height:844});await page.addInitScript(lang=>localStorage.setItem('scout-language',lang),lang);await page.emulateMedia({reducedMotion:'no-preference'});await page.clock.install();
 await page.goto('/#home');await expect(page.locator('.season-banner-copy')).toBeVisible();await page.waitForTimeout(200);await page.clock.runFor(4100);await expect(page.locator('.score-entry')).toHaveCount(5);await expect(page.locator('.score-entry').last()).toContainText('Loup');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.goto('/#stats');await expect(page.locator('.patrol-stat-card').first()).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);if(width===390)await page.screenshot({path:`test-results/stats-${lang}.png`,fullPage:true});
 await page.goto('/#attendance');await expect(page.getByRole('heading',{name:lang==='ar'?'الحضور متاح للقيادة فقط':'Attendance access restricted',exact:true})).toBeVisible();
});

test('third slide shows only the signed-in scout and the cycle returns to artwork',async({page})=>{
 const state=await setup(page);(state.program as any).seasons[1].scouts.push({...source.scouts[0],userId:'someone-else',name:'Another scout',attended:999});
 await page.emulateMedia({reducedMotion:'no-preference'});await page.clock.install();await page.goto('/#home');await expect(page.locator('.season-banner-copy')).toBeVisible();await page.waitForTimeout(200);await page.clock.runFor(4100);await expect(page.locator('.season-slide.is-active .podium-stage')).toBeVisible();await page.clock.runFor(4000);await expect(page.locator('.personal-banner-content')).toBeVisible();await expect(page.locator('.personal-banner-content')).toContainText('80%');await expect(page.locator('.personal-banner-content')).not.toContainText('999');await expect(page.locator('.personal-banner-content')).not.toContainText('Another scout');await page.clock.runFor(4000);await expect(page.locator('.season-banner-copy')).toBeVisible();
});

test('IX drawing appears during loading and stays still for reduced motion',async({page})=>{
 await setup(page);let release!:()=>void;const gate=new Promise<void>(resolve=>release=resolve);await page.route('**/rest/v1/member_program_content*',async route=>{await gate;await route.fallback();});
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/#home');const loader=page.getByRole('status',{name:'Loading saved work…',exact:true});await expect(loader).toBeVisible();await expect(loader.locator('.ix-loader-strokes path')).toHaveCount(5);expect(await loader.locator('.ix-loader-strokes path').first().evaluate(e=>getComputedStyle(e).animationName)).toBe('none');release();await expect(loader).toHaveCount(0);await expect(page.locator('.season-banner')).toBeVisible();
});
