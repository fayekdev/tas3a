import fs from 'node:fs';
import vm from 'node:vm';
const html = fs.readFileSync(new URL('../../original-app.html', import.meta.url), 'utf8');
function json(name) {
  const start=html.indexOf(`const ${name}=`)+`const ${name}=`.length;
  let end=start,depth=0,quoted=false,escaped=false;
  for(;end<html.length;end++) {
    const ch=html[end];
    if(quoted) { if(escaped) escaped=false; else if(ch==='\\') escaped=true; else if(ch==='"') quoted=false; }
    else if(ch==='"') quoted=true;
    else if(ch==='{'||ch==='[') depth++;
    else if(ch==='}'||ch===']') { if(--depth===0) {end++;break;} }
  }
  const value=JSON.parse(html.slice(start,end));
  for(const match of html.matchAll(new RegExp(`Object.assign\\(${name},(.*?)\\);`,'gs'))) Object.assign(value,JSON.parse(match[1]));
  return value;
}
const catalog = html.match(/const D=`([^`]+)`/)[1].split('\n').map((line, i) => {
  const [category, ar, en, key] = line.split('|');
  return {id: key || `b${i}`, category, ar, en};
});
const context = vm.createContext(Object.create(null), {codeGeneration:{strings:false,wasm:false}});
const pairs = vm.runInContext('(' + html.match(/const I=(\{.*?\});\s*const M=/s)[1] + ')', context, {timeout:1000});
const english=json('E'), arabic=json('AR'), counts=json('NI'), images=json('IMG');
fs.mkdirSync(new URL('../public/badges/',import.meta.url), {recursive:true});
for (const badge of catalog) {
  badge.requirements=Array.from({length:Math.max(counts[badge.id]||0, pairs[badge.id]?.length||0, english[badge.id]?.length||0)},(_,i)=>({
    ar: pairs[badge.id]?.[i]?.[0] || arabic[badge.id]?.[i] || '',
    en: english[badge.id]?.[i] || pairs[badge.id]?.[i]?.[1] || ''
  }));
  if(images[badge.id]) {
    fs.writeFileSync(new URL(`../public/badges/${badge.id}.jpg`, import.meta.url), Buffer.from(images[badge.id].split(',')[1],'base64'));
    badge.source=`/badges/${badge.id}.jpg`;
  }
}
const symbols=html.match(/const SY=`([^`]+)`/)[1].split(';').map(line=>{const [icon,en,ar]=line.split('|');return {icon,en,ar};});
fs.writeFileSync(new URL('../src/catalog.json',import.meta.url),JSON.stringify(catalog,null,2)+'\n');
fs.writeFileSync(new URL('../src/map-symbols.json',import.meta.url),JSON.stringify(symbols,null,2)+'\n');
console.log(`Recovered ${catalog.length} badges, ${Object.keys(images).length} scans and ${symbols.length} symbols.`);
