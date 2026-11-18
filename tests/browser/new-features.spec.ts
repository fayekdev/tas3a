import {test,expect} from '@playwright/test';
import {mockMember} from './helpers';
test('non-admin has no admin tab and requests a completed badge as a meeting event',async({page})=>{
 await mockMember(page);await page.goto('/#badges/b0');
 await expect(page.getByRole('link',{name:'Administration',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Request badge presentation',exact:true}).click();
 await expect(page.getByText('Requested · awaiting Chief or Assistant')).toBeVisible();
 await page.goto('/#home');await expect(page.getByText('Scout test · Church Historian')).toBeVisible();
 await expect(page.getByRole('button',{name:'Schedule',exact:true})).toHaveCount(0);
});
test('chief can schedule then award a requested badge without administration',async({page})=>{
 const state=await mockMember(page,false,'Chief');state.requests.push({id:'request-1',user_id:'other-scout',display_name:'Other Scout',badge_id:'b0',badge_title:'Church Historian',status:'pending',meeting_date:null});
 await page.goto('/#home');await expect(page.getByRole('link',{name:'Administration',exact:true})).toHaveCount(0);
 await page.getByLabel('Presentation date').fill('2026-12-04');await page.getByRole('button',{name:'Schedule',exact:true}).click();
 await expect(page.getByText('Scheduled 2026-12-04')).toBeVisible();
 await page.getByRole('button',{name:'Mark awarded',exact:true}).click();await expect(page.getByText('Awarded 2026-12-04')).toBeVisible();
});
test('admin manages banner, attendance dates and username accounts without email',async({page})=>{
 const state=await mockMember(page,true,'Chief');await page.goto('/');
 await page.getByRole('button',{name:'Edit events',exact:true}).click();await page.getByLabel('Event title',{exact:true}).fill('Friday camp');await page.getByLabel('Event details',{exact:true}).fill('Bring your badges');await page.getByRole('button',{name:'Add event',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Friday camp',exact:true})).toBeVisible();
 await page.goto('/#admin');await page.getByText('Manage additional attendance dates',{exact:true}).click();await page.getByLabel('Additional attendance date').fill('2026-11-12');await page.getByRole('button',{name:'Allow date',exact:true}).click();expect(state.program.attendanceDays).toContain('2026-11-12');
 await page.goto('/#admin');await page.getByRole('button',{name:'Create account',exact:true}).click();await page.locator('input[name=username]').fill('new.scout');await page.getByLabel('Display name',{exact:true}).fill('New Scout');await expect(page.locator('input[type=email]')).toHaveCount(0);await page.getByRole('button',{name:'Create account',exact:true}).last().click();await expect(page.getByText('Generated-Test-123!',{exact:true})).toBeVisible();expect(state.calls[0]).toMatchObject({action:'create',username:'new.scout',scout_role:'Patrouillard'});
 await page.getByRole('button',{name:'Edit account Scout test',exact:true}).click();await page.getByLabel('Display name',{exact:true}).last().fill('Edited Scout');await page.getByRole('button',{name:'Save account',exact:true}).click();await expect.poll(()=>state.calls.some(c=>c.action==='edit'&&c.display_name==='Edited Scout')).toBe(true);
 page.on('dialog',d=>d.accept());await page.getByRole('button',{name:'Delete account Scout test',exact:true}).click();await expect.poll(()=>state.calls.some(c=>c.action==='delete')).toBe(true);
});
test('screen Morse flashes and stops; unsupported torch explains fallback',async({page})=>{
 await mockMember(page);
 await page.goto('/#tools/morse');await page.getByLabel('Your message').fill('TTTTTTTTTT');await page.getByLabel('Playback mode').selectOption('screen');await page.getByRole('button',{name:'Play',exact:true}).click();await expect(page.locator('.morse-flash')).toBeVisible();await expect(page.locator('.morse-flash')).toHaveClass(/lit/);await page.keyboard.press('Escape');await expect(page.locator('.morse-flash')).toHaveCount(0);await expect(page.getByRole('button',{name:'Stop',exact:true})).toBeDisabled();
 await page.evaluate(()=>Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:async()=>({getTracks:()=>[{stop(){}}],getVideoTracks:()=>[{getCapabilities:()=>({}),stop(){}}]})}}));await page.getByLabel('Playback mode').selectOption('torch');await page.getByRole('button',{name:'Play',exact:true}).click();await expect(page.getByText('This camera has no supported flashlight. Choose screen flash.')).toBeVisible();
});
test('handbook remains Arabic in English app, attendance is locked, and map grid follows pan',async({page})=>{
 await mockMember(page);
 await page.goto('/#tools/handbook');await expect(page.locator('[lang=ar][dir=rtl]')).toContainText('وعد الكشافة');await expect(page.getByText('On my honour',{exact:false})).toHaveCount(0);
 await page.goto('/#attendance');await expect(page.getByRole('heading',{name:'Attendance access restricted',exact:true})).toBeVisible();
 await page.goto('/#tools/map');await page.getByRole('button',{name:'Pan',exact:true}).click();const surface=page.locator('.sketch-surface'),box=(await surface.boundingBox())!;await page.mouse.move(box.x+100,box.y+100);await page.mouse.down();await page.mouse.move(box.x+350,box.y+200);await page.mouse.up();
 const view=(await surface.getAttribute('viewBox'))!.split(' ').map(Number);await expect(surface.locator('rect[fill="url(#map-grid)"]')).toHaveAttribute('x',String(view[0]));await expect(surface.locator('.north-overlay')).toHaveAttribute('pointer-events','none');
 await page.screenshot({path:'test-results/map-expanded-grid.png',fullPage:true});
});
