import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {chromium} from '@playwright/test';

// Rasterize the existing vector identity; iOS requires an opaque PNG touch icon.
const svg=await readFile(new URL('../public/icon-ix.svg',import.meta.url),'utf8');
const browser=await chromium.launch(process.platform==='win32'?{channel:'msedge'}:{});
try {
  for(const [size,name] of [[180,'apple-touch-icon'],[192,'icon-192'],[512,'icon-512']]) {
    const page=await browser.newPage({viewport:{width:size,height:size},deviceScaleFactor:1});
    await page.setContent(`<style>html,body{margin:0;width:100%;height:100%;background:#172438}body{display:grid;place-items:center}svg{width:80%;height:80%;display:block}</style>${svg}`);
    await page.screenshot({path:fileURLToPath(new URL(`../public/${name}.png`,import.meta.url))});
    await page.close();
  }
} finally {
  await browser.close();
}
