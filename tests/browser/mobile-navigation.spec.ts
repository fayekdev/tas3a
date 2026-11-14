import {test,expect} from '@playwright/test';
import {mockMember} from './helpers';

for(const lang of ['en','ar'])test(`bottom navigation works in ${lang} without covering content`,async({page})=>{
  await mockMember(page);
  await page.setViewportSize({width:390,height:844});
  await page.addInitScript(lang=>localStorage.setItem('scout-language',lang),lang);
  await page.goto('/');
  const ar=lang==='ar';
  const bar=page.getByRole('navigation',{name:ar?'التنقل السريع':'Quick navigation'});
  await expect(bar).toBeVisible();
  await expect(bar.getByRole('link',{name:ar?'الرئيسية':'Home',exact:true})).toHaveAttribute('aria-current','page');
  await expect(page.locator('.home-shortcut .shortcut-icon')).toHaveCount(6);
  await page.screenshot({path:`test-results/home-navbar-${lang}.png`,fullPage:true});
  await bar.getByRole('link',{name:ar?'الأدوات':'Tools',exact:true}).click();
  await expect(page).toHaveURL(/#tools$/);
  await expect(bar.getByRole('link',{name:ar?'الأدوات':'Tools',exact:true})).toHaveAttribute('aria-current','page');
  const more=bar.getByRole('button',{name:ar?'المزيد':'More',exact:true});
  await more.click();
  const menu=page.getByRole('navigation',{name:ar?'القائمة الرئيسية':'Main navigation'});
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('link',{name:ar?'الإنجازات':'Achievements',exact:true})).toHaveCount(0);
  await menu.getByRole('link',{name:ar?'الطلائع':'Patrouilles',exact:true}).click();
  await expect(page).toHaveURL(/#patrouilles$/);
  await expect(bar).toBeVisible();
  await expect(more).toHaveClass('is-current');
  await more.click();await page.keyboard.press('Escape');await expect(bar).toBeVisible();
  await page.locator('footer').scrollIntoViewIfNeeded();
  await page.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));
  const footer=await page.locator('footer').boundingBox(),nav=await bar.boundingBox();
  expect(footer!.y+footer!.height).toBeLessThanOrEqual(nav!.y);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('desktop keeps sidebar navigation and sign-out removes mobile navigation',async({page})=>{
  await mockMember(page);await page.goto('/');
  await expect(page.getByRole('navigation',{name:'Main navigation'})).toBeVisible();
  await expect(page.locator('.mobile-bottom-nav')).toBeHidden();
  await page.setViewportSize({width:390,height:844});
  await expect(page.locator('.mobile-bottom-nav')).toBeVisible();
  await page.getByRole('button',{name:'Sign out',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Sign in',exact:true})).toBeVisible();
  await expect(page.locator('.mobile-bottom-nav')).toHaveCount(0);
});
