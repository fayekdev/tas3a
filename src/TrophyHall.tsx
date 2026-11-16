import LoadingIX from './LoadingIX';
import {useCallback,useEffect,useRef,useState,type FormEvent} from 'react';
import {CalendarCheck2,Flame,ListChecks,Trophy,X} from 'lucide-react';
import {supabase} from './supabase';
import type {Lang} from './program';
import type {Profile} from './domain';
import './trophy-hall.css';

const medallions={
  attendance:{Icon:CalendarCheck2,en:'Attendance champion',ar:'بطل الحضور',description:'Recognizing the highest attendance totals.',descriptionAr:'تكريم أصحاب أعلى عدد من مرات الحضور.'},
  streak:{Icon:Flame,en:'Attendance streak',ar:'سلسلة الحضور',description:'Celebrating a streak of consistent attendance.',descriptionAr:'الاحتفاء بسلسلة حضور متواصل.'},
  habit:{Icon:ListChecks,en:'Habit completion',ar:'إتمام العادات',description:'Honoring dedication to completing a habit.',descriptionAr:'تكريم الالتزام بإتمام عادة.'},
  season:{Icon:Trophy,en:'Season winner',ar:'بطل الموسم',description:'Celebrating the champions of a season.',descriptionAr:'الاحتفاء بأبطال الموسم.'},
};
type MedalKind=keyof typeof medallions;
type Award={id:string;user_id:string;kind:MedalKind;context:string;citation:string;awarded_at:string};

export default function TrophyHall({lang,userId,admin=false,profiles=[]}:{lang:Lang;userId:string;admin?:boolean;profiles?:Profile[]}) {
  const l=(en:string,ar:string)=>lang==='ar'?ar:en;
  const [awards,setAwards]=useState<Award[]>([]),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
  const [error,setError]=useState(''),[message,setMessage]=useState(''),[selected,setSelected]=useState<Award|null>(null);
  const dialog=useRef<HTMLDialogElement>(null),request=useRef(0);
  const load=useCallback(async()=>{
    const version=++request.current;setLoading(true);setError('');
    try {
      if(!supabase)throw new Error(lang==='ar'?'الاتصال غير متاح.':'Connection unavailable.');
      let query=supabase.from('medallion_awards').select('id,user_id,kind,context,citation,awarded_at').order('awarded_at',{ascending:false});
      if(!admin)query=query.eq('user_id',userId);
      const {data,error}=await query;if(error)throw error;
      if(version===request.current)setAwards(data??[]);
    }catch(e){if(version===request.current)setError((e as Error).message);}
    finally{if(version===request.current)setLoading(false);}
  },[userId,admin,lang]);
  useEffect(()=>{void load();return()=>{++request.current;};},[load]);
  useEffect(()=>{if(selected)dialog.current?.showModal();},[selected]);
  function closeDetail(){dialog.current?.close();setSelected(null);}
  async function award(e:FormEvent<HTMLFormElement>){
    e.preventDefault();if(busy||!supabase)return;
    const form=e.currentTarget,f=new FormData(form);
    const entry={user_id:String(f.get('scout')),kind:String(f.get('kind')),context:String(f.get('context')).trim(),citation:String(f.get('citation')).trim()};
    if(!entry.context||!entry.citation){setError(l('Enter a season or habit and a citation.','أدخل الموسم أو العادة وسبب التكريم.'));return;}
    setBusy(true);setError('');setMessage('');
    try{
      const {data,error}=await supabase.from('medallion_awards').insert(entry).select('id,user_id,kind,context,citation,awarded_at').single();
      if(error){if(error.code==='23505')throw new Error(l('This scout already has this medallion for that season or habit.','حصل هذا الكشاف بالفعل على هذا الوسام لهذا الموسم أو العادة.'));throw error;}
      setAwards(old=>[data,...old]);setMessage(l('Medallion awarded.','تم منح الوسام.'));form.reset();
    }catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  async function revoke(award:Award){
    if(busy||!supabase||!confirm(l('Revoke this medallion? It will be removed from the scout’s trophy hall.','سحب هذا الوسام؟ سيُحذف من قاعة أوسمة الكشاف.')))return;
    setBusy(true);setError('');setMessage('');
    try{
      const {error}=await supabase.from('medallion_awards').delete().eq('id',award.id).select('id').single();if(error)throw error;
      setAwards(old=>old.filter(a=>a.id!==award.id));closeDetail();setMessage(l('Medallion revoked.','تم سحب الوسام.'));
    }catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  // Keep personal galleries scoped even if a malformed response contains another scout's award.
  const visible=awards.filter(a=>(admin||a.user_id===userId)&&Object.hasOwn(medallions,a.kind));
  const groups=admin?[...new Set(visible.map(a=>a.user_id))]:[userId];
  const name=(id:string)=>profiles.find(p=>p.id===id)?.display_name??l('Scout','كشاف');
  const selectedMedal=selected?medallions[selected.kind]:null;
  return <section className="trophy-hall" aria-labelledby="trophy-hall-title">
    <div className="section-title"><div>{admin?<h2 id="trophy-hall-title">{l('Award medallions','منح الأوسمة')}</h2>:<h1 id="trophy-hall-title">{l('Trophy hall','قاعة الأوسمة')}</h1>}<p>{admin?l('Recognize a scout’s achievement and add it to their trophy hall.','كرّم إنجاز كشاف وأضفه إلى قاعة أوسمته.'):l('Your earned medallions. Select one to see its story.','أوسمتك المستحقة. اختر وسامًا لعرض تفاصيله.')}</p></div><button className="subtle" disabled={loading||busy} onClick={()=>void load()}>{l('Refresh awards','تحديث الأوسمة')}</button></div>
    {admin&&<form className="tool-panel medal-award-form" aria-label={l('Award a medallion','منح وسام')} onSubmit={e=>void award(e)}>
      <fieldset disabled={busy||loading}><div className="medal-form-grid">
        <label>{l('Scout','الكشاف')}<select aria-label={l('Scout','الكشاف')} name="scout" required defaultValue=""><option value="" disabled>{l('Choose a scout','اختر كشافًا')}</option>{profiles.map(p=><option key={p.id} value={p.id}>{p.display_name}{p.username?` · ${p.username}`:''}</option>)}</select></label>
        <label>{l('Medallion','الوسام')}<select aria-label={l('Medallion','الوسام')} name="kind" defaultValue="attendance">{Object.entries(medallions).map(([id,m])=><option key={id} value={id}>{m[lang]}</option>)}</select></label>
        <label>{l('Season or habit','الموسم أو العادة')}<input name="context" required maxLength={100} placeholder={l('e.g. Autumn 2026','مثال: خريف ٢٠٢٦')}/></label>
        <label>{l('Citation','سبب التكريم')}<textarea name="citation" required maxLength={500} rows={2} placeholder={l('What did this scout achieve?','ما الإنجاز الذي حققه الكشاف؟')}/></label>
      </div><button className="primary" disabled={!profiles.length}>{busy?l('Saving…','جارٍ الحفظ…'):l('Award medallion','منح الوسام')}</button></fieldset>
    </form>}
    {error&&<div className="error-banner" role="alert">{error}<button disabled={loading||busy} onClick={()=>void load()}>{l('Retry','إعادة المحاولة')}</button></div>}
    <p className="medal-feedback" role="status">{message}</p>
    {loading?<LoadingIX label={l('Loading medallions…','جارٍ تحميل الأوسمة…')}/>:!visible.length&&!error?<p className="trophy-hall-notice">{admin?l('No medallions awarded yet. Award the first one above.','لم تُمنح أوسمة بعد. امنح أول وسام من النموذج أعلاه.'):l('No medallions yet. Your achievements will appear here when an administrator awards them.','لا توجد أوسمة بعد. ستظهر إنجازاتك هنا عندما يمنحك المسؤول وسامًا.')}</p>:groups.map(id=><div className="medal-recipient" key={id}>{admin&&<h3>{name(id)}</h3>}<div className="trophy-grid">{visible.filter(a=>a.user_id===id).map(a=>{const m=medallions[a.kind];return <button className="trophy-card" key={a.id} onClick={()=>setSelected(a)} aria-label={`${m[lang]} · ${a.context}`} aria-haspopup="dialog">
      <span className="trophy-medallion" aria-hidden="true"><m.Icon size={26} strokeWidth={1.5}/></span><strong>{m[lang]}</strong><span className="medal-context">{a.context}</span>
    </button>;})}</div></div>)}
    {selected&&selectedMedal&&<dialog className="medal-dialog" ref={dialog} aria-labelledby="medal-detail-title" onCancel={e=>{e.preventDefault();if(!busy)closeDetail();}} onClick={e=>{if(e.target===dialog.current&&!busy)closeDetail();}}><div className="dialog-content">
      <button className="dialog-close icon-button" aria-label={l('Close','إغلاق')} disabled={busy} onClick={closeDetail}><X size={20}/></button>
      <span className="trophy-medallion" aria-hidden="true"><selectedMedal.Icon size={26}/></span><h2 id="medal-detail-title">{selectedMedal[lang]}</h2>
      <p className="muted">{l(selectedMedal.description,selectedMedal.descriptionAr)}</p>
      <dl><dt>{l('Awarded to','مُنح إلى')}</dt><dd>{name(selected.user_id)}</dd><dt>{l('Season or habit','الموسم أو العادة')}</dt><dd>{selected.context}</dd><dt>{l('Citation','سبب التكريم')}</dt><dd>{selected.citation}</dd><dt>{l('Awarded on','تاريخ المنح')}</dt><dd><time dateTime={selected.awarded_at}>{new Date(selected.awarded_at).toLocaleDateString(lang==='ar'?'ar-EG':'en-GB',{timeZone:'Africa/Cairo',year:'numeric',month:'long',day:'numeric'})}</time></dd></dl>
      {admin&&<button className="subtle danger" disabled={busy} onClick={()=>void revoke(selected)}>{l('Revoke medallion','سحب الوسام')}</button>}
    </div></dialog>}
  </section>;
}
