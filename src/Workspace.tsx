import SeasonBanner from './SeasonBanner';
import {navigationIcons} from './NavigationIcons';
import {useState} from 'react';
import {BookOpen,Map,Radio,Trophy,CalendarCheck,Users} from 'lucide-react';
import {useDocument,download} from './storage';
import {catalog,completion,initialProgram,localDate,type BadgeProgress,type Lang,type Program} from './program';
import {Achievements,Attendance,Badges,Handbook,StorageStatus,type AttendanceData} from './Features';
import SketchMap,{initialMap,type MapData} from './SketchMap';
import MorseTool from './MorseTool';
import {BadgeRequestProvider,Events,AttendanceDays} from './Community';
import {attendanceAllowed} from './schedule';
import {BadgeIcon} from './ScoutIcons';

export default function Workspace({page,route,lang,userId,admin}:{page:string;route:string;lang:Lang;userId?:string;admin:boolean}) {
  const program=useDocument<Program>('program',initialProgram,userId,true);
  const progress=useDocument<BadgeProgress>('badges',{},userId);
  const attendance=useDocument<AttendanceData>('attendance',{self:{},team:{}},userId);
  const map=useDocument<MapData>('map',initialMap,userId);
  const handbook=useDocument<string[]>('handbook',[],userId);
  const l=(en:string,ar:string)=>lang==='ar'?ar:en;
  const badges=[...catalog,...program.value.custom].map(b=>({...b,...program.value.badges[b.id]})).filter(b=>!program.value.hidden.includes(b.id));
  const active=badges.filter(b=>completion(b,progress.value)>0&&completion(b,progress.value)<b.requirements.length);
  const earned=badges.filter(b=>b.requirements.length&&completion(b,progress.value)===b.requirements.length);
  const featureProps={lang,admin,program:program.value,setProgram:program.update};
  const [exportMessage,setExportMessage]=useState('');
  if([program,progress,attendance,map,handbook].some(store=>store.status==='loading'))return <p className="muted" role="status">{l('Loading saved work…','جارٍ تحميل البيانات…')}</p>;
  function exportData(){download('tas3a-backup.json',JSON.stringify({version:1,badges:progress.value,attendance:attendance.value,map:map.value,handbook:handbook.value},null,2));}
  async function importData(file:File){try{
    if(file.size>5_000_000)throw new Error(l('File is too large.','الملف كبير جدًا.'));
    const data=JSON.parse(await file.text());
    if(data.version!==1||!data.badges||!data.attendance||!Array.isArray(data.map?.drafts)||!Array.isArray(data.handbook))throw new Error(l('Choose a tas3a backup.','اختر نسخة احتياطية من تاسعة.'));
    // Validate every nested document before replacing any saved work.
    if(Object.values(data.badges).some((p:any)=>!p||!Array.isArray(p.checked)||p.checked.some((n:any)=>!Number.isInteger(n)||n<0)||typeof p.notes!=='string')||!data.attendance.self||!data.attendance.team||Object.values(data.attendance.self).some(s=>!['came','missed'].includes(s as string))||Object.values(data.attendance.team).some((days:any)=>!days||typeof days!=='object'||Array.isArray(days)||Object.values(days).some(s=>!['came','missed'].includes(s as string)))||data.handbook.some((s:any)=>typeof s!=='string')||!data.map.drafts.length||!data.map.drafts.some((d:any)=>d.id===data.map.active)||data.map.drafts.some((d:any)=>typeof d.id!=='string'||typeof d.title!=='string'||!Array.isArray(d.shapes)||d.shapes.length>5000||d.shapes.some((s:any)=>typeof s.id!=='string'||!['symbol','text','arrow','path','step'].includes(s.kind)||typeof s.value!=='string'||![s.x,s.y,s.size,s.rotation,s.minutes].every(Number.isFinite)||!Array.isArray(s.points)||s.points.length<2||s.points.some((p:any)=>!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite)))))throw new Error(l('The backup contains invalid data.','النسخة تحتوي على بيانات غير صالحة.'));
    if([...Object.keys(data.attendance.self),...Object.values(data.attendance.team).flatMap((days:any)=>Object.keys(days))].some(d=>!attendanceAllowed(d,program.value.attendanceDays||[],localDate())))throw new Error(l('Attendance backup contains dates outside Fridays or administrator dates.','تحتوي نسخة الحضور على تواريخ غير الجمعة أو مواعيد المسؤول.'));
    if(!confirm(l('Replace your current badges, attendance, maps and bookmarks with this backup?','استبدال الشارات والحضور والخرائط والمحفوظات بهذه النسخة؟')))return;
    progress.update(data.badges);attendance.update(data.attendance);map.update(data.map);handbook.update(data.handbook);setExportMessage(l('Backup restored.','تمت استعادة النسخة.'));
  }catch(e){setExportMessage((e as Error).message);}}
  const currentStore=page==='badges'?progress:page==='attendance'?attendance:page==='tools'?(route.includes('/map')?map:route.includes('/handbook')?handbook:null):page==='progress'?progress:null;
  return <BadgeRequestProvider userId={userId} lang={lang}>
    {page==='home'&&<><SeasonBanner lang={lang}/><div className="section-title"><div><h1>{l('tas3a','تاسعة')}</h1><p>{l('Badges, tools and troop records.','الشارات والأدوات وسجلات الفريق.')}</p></div></div><Events lang={lang} admin={admin} program={program.value} setProgram={program.update}/><div className="home-shortcuts">{[{href:'badges',title:l('Badges','الشارات'),detail:`${badges.length}`,Icon:navigationIcons.badges},{href:'tools/morse',title:l('Morse code','شفرة مورس'),detail:l('Text and audio','نص وصوت'),Icon:navigationIcons.morse},{href:'tools/map',title:l('Sketch map','الخريطة الكشفية'),detail:l('Draw and export','رسم وتصدير'),Icon:navigationIcons.map},{href:'tools/handbook',title:l('Handbook','الدليل'),detail:l('Promise, law, prayer, signals','الوعد والقانون والصلاة والإشارات'),Icon:navigationIcons.handbook},{href:'attendance',title:l('Attendance','الحضور'),detail:l('Personal and team register','سجل شخصي وللفريق'),Icon:navigationIcons.attendance},{href:'patrouilles',title:l('Patrouilles','الطلائع'),detail:l('Members and leaders','الأعضاء والقادة'),Icon:navigationIcons.patrouilles}].map(({href,title,detail,Icon})=><a className="home-shortcut" href={`#${href}`} key={href}><span className="shortcut-icon" aria-hidden="true"><Icon size={26} strokeWidth={1.7}/></span><h2>{title}</h2><span>{detail}</span></a>)}</div><section className="continue-section"><h2>{l('In progress','قيد التنفيذ')} <span className="muted">{active.length}</span></h2>{active.length?<div className="badge-grid">{active.map(b=><a className="badge-card" href={`#badges/${b.id}`} key={b.id}><BadgeIcon badge={b}/><h3>{b[lang]}</h3><span>{completion(b,progress.value)} / {b.requirements.length}</span><progress max={b.requirements.length} value={completion(b,progress.value)}/></a>)}</div>:<p className="muted">{l('Choose a badge to start tracking its requirements.','اختر شارة لتبدأ تسجيل متطلباتها.')} <a className="back-link" href="#badges">{l('Browse badges','تصفح الشارات')}</a></p>}<a className="back-link" href="#progress">{l('Completed badges','الشارات المكتملة')}: {earned.length}</a></section></>}
    {page==='badges'&&<Badges {...featureProps} badges={badges} progress={progress.value} update={progress.update} selected={route.split('/')[1]||null}/>}
    {page==='tools'&&<><div className="section-title"><h1>{l('Tools','الأدوات')}</h1></div><div className="tool-tabs">{[['morse','Morse','مورس'],['map','Sketch map','الخريطة الكشفية'],['handbook','Handbook','الدليل']].map(([id,en,ar])=><a key={id} href={`#tools/${id}`} aria-current={route.split('/')[1]===id||(!route.includes('/')&&id==='morse')?'page':undefined}>{l(en,ar)}</a>)}</div>{route.includes('/map')?<SketchMap {...featureProps} value={map.value} update={map.update}/>:route.includes('/handbook')?<div lang="ar" dir="rtl"><Handbook {...featureProps} lang="ar" bookmarks={handbook.value} setBookmarks={handbook.update}/></div>:<MorseTool lang={lang}/>}</>}
    {page==='progress'&&<Achievements {...featureProps} badges={badges} progress={progress.value}/>}
    {page==='attendance'&&<><AttendanceDays {...featureProps}/><Attendance lang={lang} value={attendance.value} update={attendance.update} days={program.value.attendanceDays||[]}/></>}
    {currentStore&&<StorageStatus lang={lang} store={currentStore}/>}
    {admin&&['home','attendance','badges','progress','tools'].includes(page)&&<StorageStatus lang={lang} store={program}/>}
    {page==='account'&&<section className="tool-panel"><h2>{l('Your data','بياناتك')}</h2><p className="muted">{userId?l('Progress, maps, bookmarks and attendance sync with your account.','تتم مزامنة التقدم والخرائط والمحفوظات والحضور مع حسابك.'):l('Guest work is saved on this device. Export a backup before clearing browser data.','بيانات الزائر محفوظة على هذا الجهاز. صدّر نسخة قبل مسح بيانات المتصفح.')}</p><div className="button-row"><button className="subtle" onClick={exportData}>{l('Export backup','تصدير نسخة احتياطية')}</button><label>{l('Restore backup','استعادة نسخة احتياطية')}<input type="file" accept="application/json,.json" onChange={e=>{const file=e.target.files?.[0];if(file)void importData(file);e.target.value='';}}/></label></div><p aria-live="polite">{exportMessage}</p>{[progress,attendance,map,handbook].map((store,i)=><StorageStatus key={i} store={store} lang={lang}/>)}</section>}
  </BadgeRequestProvider>;
}
