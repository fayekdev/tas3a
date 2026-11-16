import {Crown} from 'lucide-react';
import type {Lang} from './program';
import {scoreboard,type Season} from './statsModel';
import {patrolTheme} from './patrolTheme';
import {patrolIcons} from './ScoutIcons';

export function Scoreboard({season,lang,compact=false}:{season:Season;lang:Lang;compact?:boolean}){
  const ar=lang==='ar',rows=scoreboard(season),leaders=rows.filter(p=>p.points!==null).slice(0,3),rest=rows.filter(p=>!leaders.includes(p));
  const order=leaders.length===3?[leaders[1],leaders[0],leaders[2]]:leaders;
  return <div className={`season-scoreboard ${compact?'compact':''}`}>
    {!!leaders.length&&<div className={`podium-stage podium-count-${leaders.length}`} aria-label={ar?'منصة التتويج':'Score podium'}>{order.map(p=>{const place=leaders.indexOf(p)+1,Icon=patrolIcons[p.symbol]??patrolIcons.compass;return <article className={`score-entry podium-contender podium-place-${place} patrol-themed`} style={patrolTheme(p.symbol)} key={p.id}>
      <span className="podium-crown" aria-hidden="true">{p.rank===1&&<Crown size={23}/>}</span><span className="emblem"><Icon size={32}/></span><strong>{p.name}</strong><span className="score-points">{p.points}<small>{ar?'نقطة':'points'}</small></span><div className="podium-step"><span className="score-rank">{p.rank}</span></div>
    </article>;})}</div>}
    {!!rest.length&&<div className="scoreboard-rest">{rest.map(p=>{const Icon=patrolIcons[p.symbol]??patrolIcons.compass;return <article className="score-entry score-list-entry patrol-themed" style={patrolTheme(p.symbol)} key={p.id}><span className="score-rank">{p.rank??'—'}</span><span className="emblem"><Icon size={24}/></span><strong>{p.name}</strong><span className="score-points">{p.points??'—'}<small>{ar?'نقطة':'points'}</small></span></article>;})}</div>}
    {!rows.length&&<p className="muted">{ar?'لم تُضف طلائع نشطة لهذا الموسم.':'No active patrouilles in this season yet.'}</p>}
  </div>;
}
