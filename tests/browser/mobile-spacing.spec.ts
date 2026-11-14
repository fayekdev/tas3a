import {test,expect} from '@playwright/test';
import {mockMember} from './helpers';

for(const lang of ['en','ar'])for(const width of [320,390,430])test(`${lang} at ${width}px keeps mobile content within the viewport`,async({page})=>{
  await mockMember(page);
  await page.setViewportSize({width,height:844});
  await page.addInitScript(lang=>localStorage.setItem('scout-language',lang),lang);
  await page.goto('/');
  await expect(page.locator('.home-shortcut')).toHaveCount(6);
  await expect(page.locator('a[href="#progress"]')).toHaveCount(0);
  for(const route of ['home','badges','badges/b9']){
    await page.goto('/#'+route);
    if(route==='badges')await expect(page.locator('.badge-card')).toHaveCount(78);
    if(route==='badges/b9')await expect(page.locator('.requirements')).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    const main=await page.locator('#main-content').boundingBox();
    expect(main!.x).toBeGreaterThanOrEqual(0);
    expect(main!.x+main!.width).toBeLessThanOrEqual(width);
    if(width===390)await page.screenshot({path:`test-results/review-${lang}-${route.replace('/','-')}.png`,fullPage:true});
  }
});
