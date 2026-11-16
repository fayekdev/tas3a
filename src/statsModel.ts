import type {PatrolSymbol} from './domain';

export type SeasonPatrol={id:string;name:string;symbol:PatrolSymbol;points:number|null;active:boolean};
export type ScoutStats={userId:string;name:string;patrolId:string|null;attended:number|null;missed:number|null;completed:number|null;awarded:number|null;tardy:number|null;extra?:Record<string,number|null>};
export type PatrolSummary={id:string;members:number;attended:number|null;missed:number|null;completed:number|null;awarded:number|null;tardy:number|null};
export type Season={patrolSummaries?:PatrolSummary[];id:string;name:string;start:string;end:string;patrols:SeasonPatrol[];scouts:ScoutStats[];updatedAt?:string;closed?:boolean};
export type StatsSource={scouts:ScoutStats[];patrols:Omit<SeasonPatrol,'points'|'active'>[]};
export function attendanceRate(s:Pick<ScoutStats,'attended'|'missed'>){return s.attended===null||s.missed===null||s.attended+s.missed===0?null:Math.round(s.attended/(s.attended+s.missed)*100);}
export function patrolTotals(season:Season){return scoreboard(season).map(p=>{
  const published=season.patrolSummaries?.find(t=>t.id===p.id);if(published)return {...p,...published};
  const members=season.scouts.filter(s=>s.patrolId===p.id);
  const sum=(key:'attended'|'missed'|'completed'|'awarded'|'tardy')=>members.some(s=>s[key]!==null)?members.reduce((n,s)=>n+(s[key]??0),0):null;
  return {...p,members:members.length,attended:sum('attended'),missed:sum('missed'),completed:sum('completed'),awarded:sum('awarded'),tardy:sum('tardy')};
});}
export function validSeason(name:string,start:string,end:string){return !!name.trim()&&name.trim().length<=80&&[start,end].every(d=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d))&&new Date(d).toISOString().slice(0,10)===d)&&start<=end;}
export function mergeSnapshot(season:Season,source:StatsSource):Season {
  // Keep historical membership and manual tardiness/extra metrics on refresh.
  const scouts:ScoutStats[]=source.scouts.map(s=>{const old=season.scouts.find(x=>x.userId===s.userId);return {...s,patrolId:old?old.patrolId:s.patrolId,tardy:old?.tardy??null,extra:old?.extra};});
  for(const old of season.scouts)if(!scouts.some(s=>s.userId===old.userId))scouts.push(old);
  const patrols=source.patrols.map(p=>{const old=season.patrols.find(x=>x.id===p.id);return {...p,points:old?.points??null,active:old?.active??true};});
  for(const old of season.patrols)if(!patrols.some(p=>p.id===old.id))patrols.push({...old,active:false});
  return {...season,scouts,patrols,updatedAt:new Date().toISOString()};
}
export function scoreboard(season:Season){return season.patrols.filter(p=>p.active).sort((a,b)=>(b.points??-Infinity)-(a.points??-Infinity)||a.name.localeCompare(b.name)).map((p,i,all)=>({...p,rank:p.points===null?null:all.findIndex(x=>x.points===p.points)+1}));}
