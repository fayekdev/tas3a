import type {Lang} from './program';
import {attendanceRate,type ScoutStats} from './statsModel';
export type MetricTotals=Pick<ScoutStats,'attended'|'missed'|'completed'|'awarded'|'tardy'|'lateMinutes'>;
export default function StatsMetrics({stats,lang}:{stats:MetricTotals;lang:Lang}){
  const l=(en:string,ar:string)=>lang==='ar'?ar:en;
  const labels={attended:l('Attended','حضر'),missed:l('Missed','غاب'),completed:l('Completed badges','الشارات المكتملة'),awarded:l('Awarded badges','الشارات المسلمة'),tardy:l('Late arrivals','مرات التأخير'),lateMinutes:l('Minutes late','دقائق التأخير')};
  const rate=attendanceRate(stats);
  return <dl className="scout-metrics">{(Object.keys(labels) as (keyof typeof labels)[]).map(key=><div key={key}><dt>{labels[key]}</dt><dd>{stats[key]??'—'}</dd></div>)}<div><dt>{l('Attendance rate','نسبة الحضور')}</dt><dd>{rate===null?'—':`${rate}%`}</dd></div></dl>;
}
