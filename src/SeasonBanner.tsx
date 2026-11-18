import {useEffect,useRef,useState} from 'react';
import {Scoreboard} from './SeasonScoreboard';
import StatsMetrics from './StatsMetrics';
import {patrolTheme} from './patrolTheme';
import type {Season} from './statsModel';

export const SLIDE_INTERVAL=4000;
export default function SeasonBanner({lang,season:publishedSeason,carousel=false,userId}:{lang:'en'|'ar';season?:Season;carousel?:boolean;userId?:string}) {
  const ar=lang==='ar',season=publishedSeason??(carousel?{id:'unpublished',name:ar?'هذا الموسم':'This season',start:'',end:'',patrols:[],scouts:[]}:undefined);
  const [slide,setSlide]=useState(0),[hovered,setHovered]=useState(false),[focused,setFocused]=useState(false);
  const touch=useRef<{x:number;y:number}|null>(null);
  const personal=season?.scouts.find(s=>s.userId===userId),patrol=season?.patrols.find(p=>p.id===personal?.patrolId);
  useEffect(()=>{
    if(!season||hovered||focused||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    const timer=setInterval(()=>{if(!document.hidden)setSlide(s=>(s+1)%3);},SLIDE_INTERVAL);return()=>clearInterval(timer);
  },[season?.id,hovered,focused]);
  return <section className={`season-banner ${season?'season-carousel':''} ${season&&slide!==0?'scoreboard-slide':''}`} tabIndex={season?0:undefined} aria-label={ar?'موسم الساموراي':'Samurai season'} aria-roledescription={season?(ar?'عرض شرائح':'carousel'):undefined} onMouseEnter={()=>setHovered(true)} onMouseLeave={()=>setHovered(false)} onFocusCapture={()=>setFocused(true)} onBlurCapture={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node))setFocused(false);}}
    onKeyDown={e=>{if(!season||!['ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();setSlide(s=>(s+(e.key==='ArrowRight'?1:2))%3);}}
    onTouchStart={e=>{const t=e.touches[0];touch.current={x:t.clientX,y:t.clientY};}} onTouchEnd={e=>{const from=touch.current,to=e.changedTouches[0];touch.current=null;if(!season||!from||!to)return;const dx=to.clientX-from.x,dy=to.clientY-from.y;if(Math.abs(dx)>48&&Math.abs(dx)>Math.abs(dy))setSlide(s=>(s+((ar?dx>0:dx<0)?1:2))%3);}}>
    <div className={`season-slide season-art-slide ${slide===0?'is-active':''}`} aria-hidden={season&&slide!==0?true:undefined} inert={!!season&&slide!==0} role={season?'group':undefined} aria-label={season?(ar?'١ من ٣':'1 of 3'):undefined}><div className="season-banner-copy">
      <span className="season-kicker">{ar?'تاسعة · هذا الموسم':'TAS3A · THIS SEASON'}</span><h2>{ar?'روح الساموراي':'The samurai spirit'}</h2><p>{ar?'شجاعة. انضباط. معًا.':'Courage. Discipline. Together.'}</p><span className="season-rule" aria-hidden="true"/>
    </div></div>
    {season&&<><div className={`season-slide ${slide===1?'is-active':''}`} aria-hidden={slide!==1} inert={slide!==1} role="group" aria-label={ar?'٢ من ٣':'2 of 3'}><div className="scoreboard-banner-content"><span className="season-kicker">{season.name}</span><h2>{ar?'ترتيب الطلائع':'Patrouille scoreboard'}</h2><Scoreboard season={season} lang={lang} compact/><a href="#stats" className="back-link">{ar?'عرض إحصائيات الموسم':'View season stats'} <span aria-hidden="true">↗</span></a></div></div>
    <div className={`season-slide ${slide===2?'is-active':''}`} aria-hidden={slide!==2} inert={slide!==2} role="group" aria-label={ar?'٣ من ٣':'3 of 3'}><div className="personal-banner-content patrol-themed" style={patrolTheme(patrol?.symbol??'compass')}><span className="season-kicker">{season.name}</span><h2>{ar?'تقدمك هذا الموسم':'Your season progress'}</h2>{personal?<><span className="personal-patrol">{patrol?.name??''}</span><StatsMetrics stats={personal} lang={lang}/></>:<p className="muted">{ar?'ستظهر إحصائياتك الكشفية هنا عند توفر سجلك لهذا الموسم.':'Your personal scout stats will appear here when records are available for this season.'}</p>}</div></div></>}
  </section>;
}
