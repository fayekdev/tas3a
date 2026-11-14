import {test,expect} from '@playwright/test';
import {mockMember} from './helpers';

test('administrator can cancel or confirm clearing all events and the result persists',async({page})=>{
  const state=await mockMember(page,true,'Chief');
  state.program.events=[
    {id:'event-1',title:'Camp',date:'2026-11-13',details:'Bring a tent'},
    {id:'event-2',title:'Meeting',date:'2026-11-06',details:'Troop meeting'},
  ];
  state.program.attendanceDays=['2026-11-12'];
  await page.goto('/');
  const clear=page.getByRole('button',{name:'Clear all events',exact:true});
  await expect(clear).toBeVisible();
  page.once('dialog',dialog=>dialog.dismiss());
  await clear.click();
  await expect(page.locator('.event-item')).toHaveCount(2);
  expect(state.program.events).toHaveLength(2);
  page.once('dialog',dialog=>dialog.accept());
  await clear.click();
  await expect(page.getByText('No events posted yet.',{exact:true})).toBeVisible();
  await expect.poll(()=>state.program.events.length).toBe(0);
  expect(state.program.attendanceDays).toEqual(['2026-11-12']);
  await expect(clear).toBeDisabled();
  await page.reload();
  await expect(page.getByText('No events posted yet.',{exact:true})).toBeVisible();
});

test('members cannot clear posted events',async({page})=>{
  const state=await mockMember(page);
  state.program.events=[{id:'event-1',title:'Camp',date:'2026-11-13',details:''}];
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'Camp',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Clear all events',exact:true})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Edit events',exact:true})).toHaveCount(0);
});

test('clearing events also archives meetings while preserving badge records',async({page})=>{
  const state=await mockMember(page,true,'Chief');
  state.program.events=[{id:'event-1',title:'Camp',date:'2026-11-13',details:''}];
  state.requests.push(
    {id:'meeting-1',display_name:'Scout One',badge_title:'First Aid',status:'scheduled',meeting_date:'2026-11-20'},
    {id:'meeting-2',display_name:'Scout Two',badge_title:'Camping',status:'awarded',meeting_date:'2026-11-13'},
  );
  await page.goto('/');
  await expect(page.getByText('Scout One · First Aid',{exact:true})).toBeVisible();
  page.once('dialog',dialog=>dialog.accept());
  await page.getByRole('button',{name:'Clear all events',exact:true}).click();
  await expect.poll(()=>state.program.events.length).toBe(0);
  await expect(page.getByText('No meetings posted.',{exact:true})).toBeVisible();
  expect(state.requests).toHaveLength(2);
  await page.reload();
  await expect(page.getByText('No meetings posted.',{exact:true})).toBeVisible();
  await expect(page.getByText('Scout One · First Aid',{exact:true})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Clear all events',exact:true})).toBeDisabled();
  // New meetings remain visible, and clearing is available even without posted events.
  state.requests.push({id:'meeting-3',display_name:'Scout Three',badge_title:'Swimming',status:'pending',meeting_date:null});
  await page.reload();
  await expect(page.getByText('Scout Three · Swimming',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Clear all events',exact:true})).toBeEnabled();
  page.once('dialog',dialog=>dialog.accept());
  await page.getByRole('button',{name:'Clear all events',exact:true}).click();
  await expect(page.getByText('No meetings posted.',{exact:true})).toBeVisible();
});
