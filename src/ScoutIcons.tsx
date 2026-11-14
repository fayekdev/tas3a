import {Compass,Mountain,TreePine,Flame} from 'lucide-react';
export {BadgeIcon} from './BadgeEmblem';

function Animal({kind,size=24,strokeWidth=1.5}:{kind:string;size?:number;strokeWidth?:number}) {
  const paths:Record<string,string>={
    gazelle:'M8 9Q3 2 7 1M16 9Q21 2 17 1M7 10 2 7 5 13M17 10 22 7 19 13M7 10Q12 7 17 10L16 18 12 23 8 18ZM9 14h.1M15 14h.1M11 19h2',
    panthere:'M5 10Q1 3 7 5L9 7Q12 6 15 7L17 5Q23 3 19 10L18 18 12 22 6 18ZM8 13l2 1M16 13l-2 1M10 17h4l-2 2ZM3 16l6 1M21 16l-6 1',
    lion:'m12 1 5 3 4 1 2 7-3 7-8 4-8-4-3-7 2-7 4-1ZM7 9l2-2h6l2 2v8l-5 4-5-4ZM9 12h.1M15 12h.1M10 16h4l-2 2Z',
    renard:'M3 2 10 8h4l7-6-2 14-7 7-7-7ZM5 12l5 5M19 12l-5 5M10 20h4M8 12h.1M16 12h.1',
    loup:'M4 2 10 7h4l6-5-1 12 2 3-9 6-9-6 2-3ZM6 11l4 3M18 11l-4 3M10 18h4l-2 3Z'
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[kind]}/></svg>;
}
export const patrolIcons={compass:Compass,mountain:Mountain,tree:TreePine,flame:Flame,gazelle:(p:{size?:number;strokeWidth?:number})=><Animal {...p} kind="gazelle"/>,panthere:(p:{size?:number;strokeWidth?:number})=><Animal {...p} kind="panthere"/>,lion:(p:{size?:number;strokeWidth?:number})=><Animal {...p} kind="lion"/>,renard:(p:{size?:number;strokeWidth?:number})=><Animal {...p} kind="renard"/>,loup:(p:{size?:number;strokeWidth?:number})=><Animal {...p} kind="loup"/>};
