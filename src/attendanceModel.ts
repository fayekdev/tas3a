import type {PatrolSymbol,ScoutRole} from './domain';
export type RegisterScout={userId:string;name:string;patrolId:string|null;patrolName:string|null;patrolSymbol:PatrolSymbol|null};
export type AttendanceMark={userId:string;status:'present'|'absent'|null;lateMinutes:number};
export type RegisterData={scouts:RegisterScout[];records:AttendanceMark[];allowed:boolean};
export function canTrackAttendance(role?:ScoutRole){return role==='Chief'||role==='Assistant';}
export function validMark(mark:AttendanceMark){return !!mark.userId&&[null,'present','absent'].includes(mark.status)&&Number.isInteger(mark.lateMinutes)&&mark.lateMinutes>=0&&mark.lateMinutes<=1440&&(mark.status==='present'||mark.lateMinutes===0);}
export function recentFriday(today:string){const d=new Date(today+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+2)%7);return d.toISOString().slice(0,10);}
