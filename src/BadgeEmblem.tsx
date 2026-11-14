import type {CSSProperties} from 'react';
import {Activity,Anchor,Atom,Bike,Binoculars,Bird,BookOpen,BowArrow,BrickWall,Bug,Camera,ChessKnight,Church,Clapperboard,CloudSun,Compass,Cross,DraftingCompass,Drama,FileText,Fish,Flame,Footprints,Globe,Hammer,HandHeart,House,Languages,Leaf,Map,Medal,Mic,Monitor,Mountain,Music,NotebookPen,Package,Palette,PawPrint,PencilRuler,Plane,Radio,Route,Ruler,Scissors,Search,Shield,ShieldCheck,Ship,ShipWheel,Smile,Sparkles,Sprout,Star,Sun,Telescope,Tent,TreePine,Users,Utensils,Volleyball,Waves,Wrench,Zap,type LucideIcon} from 'lucide-react';
import type {Badge} from './program';

// Specific subjects come before broad category matches, including custom badges.
const subjects:[RegExp,LucideIcon][]=[
  [/church historian/i,Church],[/gospel|reader|bible/i,BookOpen],[/altar/i,Flame],
  [/plant|botan|garden/i,Sprout],[/animal/i,PawPrint],[/tailor|sew/i,Scissors],
  [/photo/i,Camera],[/paint|decorator/i,Palette],[/aircraft|parachut/i,Plane],
  [/carpent|pioneer/i,Hammer],[/mechan|plumb|repair/i,Wrench],[/builder/i,BrickWall],[/electric/i,Zap],
  [/craft/i,Hammer],[/bird/i,Bird],[/insect/i,Bug],[/geolog/i,Mountain],[/meteor|weather/i,CloudSun],
  [/translat/i,Languages],[/secretary|report|correspond/i,FileText],[/nurs|first aid|health/i,Cross],
  [/guide|explor/i,Route],[/angler|fish/i,Fish],[/monitor/i,Users],[/computer/i,Monitor],
  [/research|science/i,Atom],[/home/i,House],[/collect/i,Package],[/chess/i,ChessKnight],
  [/sail/i,ShipWheel],[/forest|wood|tree/i,TreePine],[/film/i,Clapperboard],
  [/swim|diver/i,Waves],[/archer/i,BowArrow],[/cycl/i,Bike],[/mountain|climb/i,Mountain],
  [/marksman|shoot/i,ShieldCheck],[/boat/i,Ship],[/athlete/i,Activity],[/horse|track/i,Footprints],
  [/martial/i,ShieldCheck],[/sport/i,Volleyball],[/technical|drafter/i,PencilRuler],[/architect/i,DraftingCompass],
  [/music|piano|compos/i,Music],[/comed/i,Smile],[/singer/i,Mic],[/actor|theat/i,Drama],
  [/artist|draw/i,Palette],[/invent/i,Sparkles],[/camper/i,Tent],[/cook/i,Utensils],
  [/signal|morse|radio/i,Radio],[/topograph|map/i,Map],[/writer/i,NotebookPen],
  [/lifeguard|rescue/i,HandHeart],[/observ/i,Binoculars],[/travell/i,Globe],[/cosmo|astro/i,Telescope],
  [/anchor/i,Anchor],[/ruler/i,Ruler],[/leaf|nature/i,Leaf],[/search/i,Search],[/sun/i,Sun],
];
const categories:Record<string,LucideIcon>={rel:Church,skill:Wrench,sport:Medal,art:Star,scout:Compass};

export function BadgeIcon({badge,size=48}:{badge:Badge;size?:number}) {
  const Icon=subjects.find(([pattern])=>pattern.test(badge.en))?.[1]||categories[badge.category]||Shield;
  const level=badge.en.match(/Level\s+(\d+)/i)?.[1];
  return <span className={`badge-emblem badge-emblem-${badge.category}`} style={{'--badge-size':`${size}px`} as CSSProperties} aria-hidden="true">
    <Icon size={Math.round(size*.49)} strokeWidth={1.8}/>
    {level&&<span className="badge-level">{level==='2'?'II':'I'}</span>}
  </span>;
}
