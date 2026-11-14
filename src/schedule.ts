export function attendanceAllowed(date:string,days:string[],today:string):boolean {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||date>today)return false;
  const parsed=new Date(date+'T12:00:00Z');
  return Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===date&&(parsed.getUTCDay()===5||days.includes(date));
}
