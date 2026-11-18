import type {PatrolSymbol,ScoutRole} from './domain';
export type AttendanceHistory={date:string;status:'present'|'absent';lateMinutes:number|null;source:'leadership'|'legacy';updatedAt:string|null};
export type BadgeHistory={badgeId:string;checked:number[];completedDate:string|null};
export type PresentationHistory={badgeId:string;title:string;status:'pending'|'scheduled'|'awarded';presentationDate:string|null;requestedAt:string};
export type ScoutRecordHistory={userId:string;name:string;scoutRole:ScoutRole;patrolName:string|null;patrolSymbol:PatrolSymbol|null;attendance:AttendanceHistory[];progress:BadgeHistory[];presentations:PresentationHistory[]};
export function recordedTotals(records:ScoutRecordHistory,today:string){
 const days=records.attendance.filter(r=>r.date<=today),attended=days.filter(r=>r.status==='present').length,missed=days.filter(r=>r.status==='absent').length;
 return {attended,missed,tardy:days.filter(r=>r.status==='present'&&(r.lateMinutes??0)>0).length,lateMinutes:days.reduce((n,r)=>n+(r.lateMinutes??0),0),awarded:records.presentations.filter(r=>r.status==='awarded').length,undatedAwards:records.presentations.filter(r=>r.status==='awarded'&&!r.presentationDate).length,rate:days.length?Math.round(attended/days.length*100):null};
}
