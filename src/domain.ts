export const roles = ['Chief', 'Assistant', 'CP', 'SP', 'TP', 'Patrouillard'] as const;
export type ScoutRole = typeof roles[number];
export const symbols = ['compass', 'mountain', 'tree', 'flame', 'gazelle', 'panthere', 'lion', 'renard', 'loup'] as const;
export type PatrolSymbol = typeof symbols[number];
export type Patrol = { id:string; name:string; motto:string; symbol:PatrolSymbol; created_at:string };
export type Profile = { id:string; display_name:string; username?:string; scout_role:ScoutRole };
export type Membership = { patrouille_id:string; user_id:string; role:'scout'|'leader' };
export function validatePatrol(name:string,motto:string):string|null {
  if(name.trim().length<2||name.trim().length>60)return 'Use a name between 2 and 60 characters.';
  if(motto.trim().length>160)return 'Keep the motto within 160 characters.';
  return null;
}
const codes = ['.-','-...','-.-.','-..','.','..-.','--.','....','..','.---','-.-','.-..','--','-.','---','.--.','--.-','.-.','...','-','..-','...-','.--','-..-','-.--','--..','-----','.----','..---','...--','....-','.....','-....','--...','---..','----.'];
const letters='ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
export const latinMorse:Record<string,string>=Object.fromEntries([...letters].map((letter,i)=>[letter,codes[i]]));
export const arabicMorse:Record<string,string>={...Object.fromEntries([...letters].filter(c=>/[0-9]/.test(c)).map(c=>[c,latinMorse[c]])),...Object.fromEntries('ا .-,ب -...,ت -,ث -.-.,ج .---,ح ....,خ ---,د -..,ذ --..,ر .-.,ز ---.,س ...,ش ----,ص -..-,ض ...-,ط ..-,ظ -.--,ع .-.-,غ --.,ف ..-.,ق --.-,ك -.-,ل .-..,م --,ن -.,ه ..-..,و .--,ي ..'.split(',').map(s=>s.split(' ')))};
export function morse(input:string,decode:boolean,alphabet:'en'|'ar'='en'):string {
  if(!input.trim())return '';
  const table=alphabet==='ar'?arabicMorse:latinMorse;
  const reverse:Record<string,string>=Object.fromEntries(Object.entries(table).map(([k,v])=>[v,k]));
  if(decode)return input.trim().split(/\s*\/\s*/).map(w=>w.split(/\s+/).map(c=>reverse[c]??'�').join('')).join(' ');
  const normalized=alphabet==='ar'?input.replace(/[أإآ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي').replace(/[\u064B-\u065F\u0670\u0640]/g,''):input.toUpperCase();
  return normalized.trim().split(/\s+/).map(w=>[...w].map(c=>table[c]??'�').join(' ')).join(' / ');
}
