import type {Lang} from './program';
import {patrolTotals,type Season} from './statsModel';
import {patrolTheme} from './patrolTheme';
import StatsMetrics from './StatsMetrics';
export default function PatrolSeasonStats({season,lang}:{season:Season;lang:Lang}){
 const ar=lang==='ar';return <section aria-label={ar?'إحصائيات الطلائع':'Patrouille statistics'} className="patrol-stats-section"><h2>{ar?'تقدم الطلائع':'Patrouille progress'}</h2><div className="scout-stats-grid">{patrolTotals(season).map(p=><article className="tool-panel patrol-stat-card patrol-themed" style={patrolTheme(p.symbol)} key={p.id}><span className="card-kicker">{p.members} {ar?'كشافة':'scouts'}</span><h3>{p.name}</h3><StatsMetrics stats={p} lang={lang}/></article>)}</div></section>;
}
