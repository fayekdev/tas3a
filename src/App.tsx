import { lazy, Suspense, useEffect, useRef, useState, type FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import { ArrowRight, Check, ChevronRight, Flame, Home, Languages, LogOut, Menu, Mountain, Plus, Search, ShieldCheck, Tent, TreePine, Trophy, Users, Wrench, X, BookOpen, LoaderCircle } from 'lucide-react';
import { supabase } from './supabase';
import AdminAccounts from './AdminAccounts';
import SeasonBanner from './SeasonBanner';
import AppIcon from './AppIcon';
const Workspace=lazy(()=>import('./Workspace'));
import { symbols, validatePatrol, type Membership, type Patrol, type Profile, type PatrolSymbol } from './domain';

type Page = 'home' | 'badges' | 'patrouilles' | 'tools' | 'progress' | 'attendance' | 'account' | 'admin';
type AuthMode = 'login' | 'password';
import {patrolIcons as iconMap} from './ScoutIcons';
const text = {
  "en": {
    "home": "Home",
    "badges": "Badges",
    "patrouilles": "Patrouilles",
    "tools": "Tools",
    "progress": "Achievements",
    "attendance": "Attendance",
    "account": "My account",
    "admin": "Administration",
    "login": "Sign in",
    "logout": "Sign out",
    "create": "Create Patrouille",
    "language": "العربية",
    "workspace": "tas3a",
    "team": "Patrouille",
    "teamdesc": "Members and leaders.",
    "empty": "Sign in to view your Patrouille",
    "emptydesc": "Your administrator can assign you to a Patrouille.",
    "noPatrol": "No Patrouille assigned",
    "noPatrolDesc": "Ask your administrator to add you to a Patrouille.",
    "newPatrol": "",
    "name": "Patrouille name",
    "motto": "Motto",
    "leader": "Patrouille leader",
    "optional": "Assign later",
    "symbol": "Emblem",
    "cancel": "Cancel",
    "save": "Create Patrouille",
    "members": "Members",
    "leaderRole": "Leader",
    "scoutRole": "Scout",
    "password": "Password",
    "newPassword": "New password",
    "updatePassword": "Change password",
    "authTitle": "Sign in",
    "authIntro": "",
    "adminTitle": "Administration",
    "adminDesc": "Manage Patrouilles and accounts.",
    "restricted": "Administrator access required",
    "restrictedDesc": "Sign in with an administrator account.",
    "refresh": "Refresh",
    "loading": "Loading…",
    "search": "Find a Patrouille",
    "noResults": "No matching Patrouilles",
    "clear": "Clear search",
    "browse": "Open tools",
    "security": "",
    "guest": "Guest",
    "remove": "Remove",
    "add": "Add member",
    "choose": "Choose a registered scout",
    "rosterEmpty": "No members assigned.",
    "retry": "Try again",
    "id": "Account ID",
    "profileName": "Display name",
    "saveProfile": "Save name",
    "saved": "Saved",
    "help": "Ask the troop owner for administrator access.",
    "signInAdmin": "Admin sign in"
  },
  "ar": {
    "home": "الرئيسية",
    "badges": "الشارات",
    "patrouilles": "الطلائع",
    "tools": "الأدوات",
    "progress": "الإنجازات",
    "attendance": "الحضور",
    "account": "حسابي",
    "admin": "الإدارة",
    "login": "تسجيل الدخول",
    "logout": "تسجيل الخروج",
    "create": "إنشاء طليعة",
    "language": "English",
    "workspace": "تاسعة",
    "team": "الطليعة",
    "teamdesc": "الأعضاء والقادة.",
    "empty": "سجّل الدخول لرؤية طليعتك",
    "emptydesc": "يمكن للمسؤول إضافتك إلى طليعة.",
    "noPatrol": "لم تُعيَّن طليعة",
    "noPatrolDesc": "اطلب من المسؤول إضافتك إلى طليعة.",
    "newPatrol": "",
    "name": "اسم الطليعة",
    "motto": "الشعار",
    "leader": "قائد الطليعة",
    "optional": "التعيين لاحقًا",
    "symbol": "الرمز",
    "cancel": "إلغاء",
    "save": "إنشاء الطليعة",
    "members": "الأعضاء",
    "leaderRole": "قائد",
    "scoutRole": "كشاف",
    "password": "كلمة المرور",
    "newPassword": "كلمة المرور الجديدة",
    "updatePassword": "تغيير كلمة المرور",
    "authTitle": "تسجيل الدخول",
    "authIntro": "",
    "adminTitle": "الإدارة",
    "adminDesc": "إدارة الطلائع والحسابات.",
    "restricted": "يلزم حساب مسؤول",
    "restrictedDesc": "سجّل الدخول بحساب مسؤول.",
    "refresh": "تحديث",
    "loading": "جارٍ التحميل…",
    "search": "ابحث عن طليعة",
    "noResults": "لا توجد طلائع مطابقة",
    "clear": "مسح البحث",
    "browse": "فتح الأدوات",
    "security": "",
    "guest": "زائر",
    "remove": "إزالة",
    "add": "إضافة عضو",
    "choose": "اختر كشافًا مسجلًا",
    "rosterEmpty": "لا يوجد أعضاء.",
    "retry": "حاول مجددًا",
    "id": "معرّف الحساب",
    "profileName": "الاسم المعروض",
    "saveProfile": "حفظ الاسم",
    "saved": "تم الحفظ",
    "help": "اطلب صلاحية الإدارة من مالك الفريق.",
    "signInAdmin": "دخول المسؤول"
  }
};

function TrailArt() { return <svg viewBox="0 0 580 400" className="trail-art" role="img" aria-label="An illustrated campsite in the mountains"><defs><linearGradient id="sky" x2="0" y2="1"><stop stopColor="#244f43"/><stop offset="1" stopColor="#527561"/></linearGradient></defs><rect width="580" height="400" fill="url(#sky)"/><circle cx="427" cy="96" r="39" fill="#e9cf8e"/><path d="M0 300 146 104 253 231 327 135 514 322Z" fill="#6f8b72"/><path d="m96 170 50-66 56 67-51-25Z" fill="#e4e4ce"/><path d="m291 181 36-46 48 64-43-24Z" fill="#d4d9bc"/><path d="M0 305Q160 220 308 290T580 275V400H0Z" fill="#244c3d"/><path d="M0 355Q180 268 367 326T580 315V400H0Z" fill="#153c32"/><path d="M260 400Q390 357 326 319" stroke="#c6ae79" strokeWidth="21" fill="none"/><path d="m280 329 62-88 67 88Z" fill="#dbad60"/><path d="m342 241 10 88h57Z" fill="#b58443"/><path d="m323 329 20-54 20 54Z" fill="#274939"/>{[[80,262,1.1],[483,236,1.4],[523,287,.9],[127,296,.65]].map(([x,y,s],i)=><g key={i} transform={`translate(${x} ${y}) scale(${s})`}><path d="M0-92-28-38h15L-40 0H40L13-38h15Z" fill="#102f29"/><path d="M0-15V24" stroke="#102f29" strokeWidth="8"/></g>)}<path d="m412 347 14-23 14 23" fill="#dda761"/><path d="m413 351 25 7m-25 0 25-7" stroke="#9b7951" strokeWidth="4"/><g fill="#d2d5b5"><circle cx="65" cy="59" r="1.6"/><circle cx="211" cy="67" r="1.6"/><circle cx="351" cy="44" r="1.6"/><circle cx="492" cy="53" r="1.6"/></g><path d="m53 109 5-8 5 8m121-62 4-7 4 7" fill="none" stroke="#bac7a6" strokeWidth="2"/></svg> }

export default function App() {
  const [lang,setLang] = useState<'en'|'ar'>(()=>localStorage.getItem('scout-language')==='ar'?'ar':'en');
  const t = text[lang];
  const readPage = ():Page => { const h=location.hash.slice(1).split('/')[0];return ['home','badges','patrouilles','tools','progress','attendance','account','admin'].includes(h)?h as Page:'home'; };
  const [page,setPage]=useState<Page>(readPage);
  const [route,setRoute]=useState(location.hash.slice(1));
  const [session,setSession]=useState<Session|null>(null);
  const [authReady,setAuthReady]=useState(!supabase);
  const [admin,setAdmin]=useState(false);
  const [patrols,setPatrols]=useState<Patrol[]>([]);
  const [profiles,setProfiles]=useState<Profile[]>([]);
  const [members,setMembers]=useState<Membership[]>([]);
  const [loading,setLoading]=useState(!!supabase);
  const [error,setError]=useState('');
  const [auth,setAuth]=useState<AuthMode|null>(null);
  const [creating,setCreating]=useState(false);
  const [selected,setSelected]=useState<Patrol|null>(null);
  const [query,setQuery]=useState('');
  const [mobile,setMobile]=useState(false);
  const loadVersion=useRef(0);
  const sessionRef=useRef<Session|null>(null);
  useEffect(()=>{document.documentElement.lang=lang;document.documentElement.dir=lang==='ar'?'rtl':'ltr';localStorage.setItem('scout-language',lang);document.title=lang==='ar'?'تاسعة':'tas3a';},[lang]);
  useEffect(()=>{const handler=()=>{setPage(readPage());setRoute(location.hash.slice(1));setMobile(false);};window.addEventListener('hashchange',handler);return()=>window.removeEventListener('hashchange',handler);},[]);
  async function load(s:Session|null) {
    const version=++loadVersion.current;
    setError('');
    if(!s||!supabase){setAdmin(false);setPatrols([]);setProfiles([]);setMembers([]);setSelected(null);setCreating(false);setLoading(false);return;}
    setLoading(true);
    try {
      const [role,pats,people,roster]=await Promise.all([
        supabase.rpc('is_admin'),supabase.from('patrouilles').select('*').order('created_at',{ascending:false}),supabase.from('accounts').select('id,display_name,username,scout_role').order('display_name'),supabase.from('patrouille_members').select('patrouille_id,user_id,role')
      ]);
      for(const result of [role,pats,people,roster]) if(result.error) throw result.error;
      if(version!==loadVersion.current)return;
      setAdmin(role.data===true);setPatrols(pats.data??[]);setProfiles(people.data??[]);setMembers(roster.data??[]);
    } catch(e) {if(version===loadVersion.current)setError(e instanceof Error?e.message:(e as {message?:string}).message??'Could not load your workspace.');}
    finally {if(version===loadVersion.current)setLoading(false);}
  }
  useEffect(()=>{
    if(!supabase)return;
    const {data}=supabase.auth.onAuthStateChange((event,s)=>{
      if(sessionRef.current?.user.id!==s?.user.id){setAdmin(false);setProfiles([]);setPatrols([]);setMembers([]);setSelected(null);setCreating(false);}
      sessionRef.current=s;setSession(s);setAuthReady(true);
      if(event==='PASSWORD_RECOVERY')setAuth('password');
      if(event==='SIGNED_OUT'){setAuth(null);setCreating(false);setSelected(null);}
      if(event!=='TOKEN_REFRESHED')setTimeout(()=>{if(sessionRef.current===s)void load(s);},0);
    });
    return()=>{data.subscription.unsubscribe();++loadVersion.current;};
  },[]);
  function go(p:Page){location.hash=p;setMobile(false);}
  const myProfile=profiles.find(p=>p.id===session?.user.id);
  const displayName=myProfile?.display_name||session?.user.user_metadata?.display_name||t.account;
  const nav = [{id:'home',icon:Home},{id:'badges',icon:Trophy},{id:'tools',icon:Wrench},{id:'progress',icon:Check},{id:'attendance',icon:BookOpen},{id:'patrouilles',icon:Users},{id:'account',icon:ShieldCheck}] as const;
  const filtered=patrols.filter(p=>(p.name+' '+p.motto).toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  async function signOut(){if(!supabase)return;const {error}=await supabase.auth.signOut();if(error)setError(error.message);}
  const list = <>
    <div className="section-title"><div><span className="eyebrow">{t.workspace}</span><h1>{page==='admin'?t.adminTitle:t.patrouilles}</h1><p>{page==='admin'?t.adminDesc:t.teamdesc}</p></div>{admin&&<button className="primary" onClick={()=>setCreating(true)}><Plus size={18}/>{t.create}</button>}</div>
    {!session?<Empty icon={Users} title={t.empty} description={t.emptydesc}><button className="primary" onClick={()=>setAuth('login')}>{t.login}<ArrowRight size={17}/></button></Empty>:loading?<div className="empty"><LoaderCircle className="spin"/>{t.loading}</div>:<>
      <div className="list-toolbar"><label className="search"><Search size={18}/><input aria-label={t.search} placeholder={t.search} value={query} onChange={e=>setQuery(e.target.value)}/></label><span>{filtered.length} {t.patrouilles}</span><button className="subtle" onClick={()=>void load(session)}>{t.refresh}</button></div>
      {filtered.length?<div className="patrol-grid">{filtered.map((p,i)=>{const Icon=iconMap[p.symbol];return <button key={p.id} className="patrol-card" onClick={()=>setSelected(p)}><div className={`emblem emblem-${i%3}`}><Icon size={34} strokeWidth={1.5}/></div><span className="card-kicker">{t.patrouilles}</span><h2>{p.name}</h2><p>{p.motto||t.team}</p><div className="card-bottom"><span><Users size={15}/>{members.filter(m=>m.patrouille_id===p.id).length} {t.members}</span><ArrowRight size={19}/></div></button>;})}</div>:<Empty icon={Tent} title={query?t.noResults:t.noPatrol} description={query?'':t.noPatrolDesc}>{query?<button className="subtle" onClick={()=>setQuery('')}>{t.clear}</button>:admin?<button className="primary" onClick={()=>setCreating(true)}><Plus size={16}/>{t.create}</button>:<button className="subtle" onClick={()=>go('tools')}>{t.browse}<ArrowRight size={17}/></button>}</Empty>}
    </>}
  </>;
  if(!authReady)return <main className="sign-in-page" aria-busy="true"><div className="sign-in-loading" role="status"><LoaderCircle className="spin" size={26}/>{t.loading}</div></main>;
  if(!session)return <div className="sign-in-screen"><header className="sign-in-header"><span className="brand"><span className="brand-icon"><AppIcon size={34}/></span>{t.workspace}</span><button className="language" onClick={()=>setLang(lang==='en'?'ar':'en')}><Languages size={17}/>{t.language}</button></header><main className="sign-in-page"><SeasonBanner lang={lang}/><section className="sign-in-card" aria-labelledby="sign-in-title"><AuthDialog mode="login" setMode={()=>{}} t={t} standalone/>{!supabase&&<p className="form-error" role="alert">{lang==='ar'?'تسجيل الدخول غير متاح حاليًا.':'Sign-in is currently unavailable.'}</p>}</section></main></div>;
  return <div className="app-shell">
    <aside className={`sidebar ${mobile?'open':''}`}><a className="brand" href="#home"><span className="brand-icon"><AppIcon size={34}/></span><span>{t.workspace}</span></a><div className="nav-caption">{t.workspace}</div><nav>{nav.map(({id,icon:Icon})=><a key={id} onClick={()=>setMobile(false)} href={`#${id}`} className={page===id?'active':''} aria-current={page===id?'page':undefined}><Icon size={19}/>{t[id]}{page===id&&<span className="active-dot"/>}</a>)}</nav><div className="sidebar-bottom">{admin&&<a className={`admin-nav ${page==='admin'?'active':''}`} href="#admin"><ShieldCheck size={19}/>{t.admin}</a>}<button className="account-button" onClick={()=>session?go('account'):setAuth('login')}><span className="avatar">{session?String(displayName).slice(0,1).toUpperCase():<AppIcon size={25}/>}</span><span>{session?displayName:t.guest}<small>{session?(admin?t.admin:myProfile?.scout_role??t.scoutRole):t.login}</small></span><ChevronRight size={16}/></button></div></aside>
    {mobile&&<button className="mobile-shade" aria-label={t.cancel} onClick={()=>setMobile(false)}/>}
    <div className="main-shell"><header className="topbar"><button className="icon-button menu-toggle" aria-label="Menu" onClick={()=>setMobile(!mobile)}><Menu size={22}/></button><span className="breadcrumb">{t.workspace} <ChevronRight size={13}/> <strong>{t[page]}</strong></span><div className="top-actions"><button className="language" onClick={()=>setLang(lang==='en'?'ar':'en')}><Languages size={17}/>{t.language}</button>{session?<button className="subtle" onClick={()=>void signOut()}><LogOut size={16}/><span>{t.logout}</span></button>:<button className="small-primary" onClick={()=>setAuth('login')}>{t.login}<ArrowRight size={15}/></button>}</div></header>
    <main id="main-content">
      {!supabase&&<div className="notice">{lang==='ar'?'تسجيل الدخول غير متاح حاليًا.':'Sign-in is currently unavailable.'}</div>}
      {error&&<div className="error-banner" role="alert">{error}<button onClick={()=>void load(session)}>{t.retry}</button></div>}
      <Suspense fallback={<p className="muted">{t.loading}</p>}><Workspace key={session?.user.id||'guest'} userId={session?.user.id} admin={admin} lang={lang} page={page} route={route}/></Suspense>
      {page==='patrouilles'&&list}
      {page==='admin'&&((loading&&!admin)?<div className="empty"><LoaderCircle className="spin"/>{t.loading}</div>:admin?<>{list}<AdminAccounts profiles={profiles} patrols={patrols} members={members} onUpdate={()=>void load(session)} arabic={lang==='ar'}/></>:<Empty icon={ShieldCheck} title={t.restricted} description={t.restrictedDesc}>{!session?<button className="primary" onClick={()=>setAuth('login')}>{t.signInAdmin}<ArrowRight size={17}/></button>:<p className="muted">{t.help}</p>}</Empty>)}
      {page==='account'&&(!session?<Empty icon={Trophy} title={t.account} description={t.emptydesc}><button className="primary" onClick={()=>setAuth('login')}>{t.login}</button></Empty>:<Account t={t} session={session} name={myProfile?.display_name??''} role={myProfile?.scout_role??'Patrouillard'} admin={admin} onPassword={()=>setAuth('password')} onUpdate={()=>void load(session)}/>)}
    </main><footer><span>{t.workspace}</span></footer></div>
    {auth&&<AuthDialog mode={auth} setMode={setAuth} t={t}/>}
    {creating&&admin&&<CreateDialog t={t} profiles={profiles.filter(p=>!members.some(m=>m.user_id===p.id))} close={()=>setCreating(false)} onCreated={()=>{setCreating(false);void load(session);}}/>}
    {selected&&<RosterDialog t={t} patrol={selected} profiles={profiles} members={members} admin={admin} close={()=>setSelected(null)} reload={async()=>{const p=selected;await load(session);setSelected(p);}}/>}
  </div>;
}

type Copy = typeof text.en;
function Empty({icon:Icon,title,description,children}:{icon:typeof Users;title:string;description:string;children?:React.ReactNode}) {return <div className="empty"><span className="empty-icon"><Icon size={35} strokeWidth={1.5}/></span><h2>{title}</h2><p>{description}</p>{children}</div>;}
function Dialog({title,close,children}:{title:string;close:()=>void;children:React.ReactNode}) {
  const ref=useRef<HTMLDialogElement>(null);
  useEffect(()=>{const d=ref.current;d?.showModal();return()=>d?.close();},[]);
  return <dialog ref={ref} aria-label={title} onCancel={e=>{e.preventDefault();close();}} onClick={e=>{if(e.target===ref.current)close();}}><div className="dialog-content"><button className="dialog-close icon-button" aria-label="Close" onClick={close}><X size={20}/></button>{children}</div></dialog>;
}
function AuthDialog({mode,setMode,t,standalone=false}:{mode:AuthMode;setMode:(mode:AuthMode|null)=>void;t:Copy;standalone?:boolean}) {
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
  async function submit(e:FormEvent<HTMLFormElement>) {
    e.preventDefault();if(!supabase)return;
    const f=new FormData(e.currentTarget),login=String(f.get('login')??'').trim().toLowerCase(),password=String(f.get('password')??'');
    setBusy(true);setError('');
    try {
      if(mode==='login') {
        const email=login.includes('@')?login:`${login}@scout-hub.invalid`;
        const {error}=await supabase.auth.signInWithPassword({email,password});if(error)throw error;setMode(null);
      } else {
        const {error}=await supabase.auth.updateUser({password});if(error)throw error;setMessage(t.language==='English'?'تم تحديث كلمة المرور':'Password updated');
      }
    }catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  const Heading=standalone?'h1':'h2';
  const content=<><span className="dialog-mark"><AppIcon size={42}/></span><span className="eyebrow">{t.workspace}</span><Heading id={standalone?'sign-in-title':undefined}>{mode==='password'?t.newPassword:t.authTitle}</Heading><p className="muted">{standalone?(t.language==='English'?'سجّل الدخول إلى حسابك الكشفي.':'Sign in to your troop account.'):t.authIntro}</p><form onSubmit={submit}>{mode==='login'&&<label>{t.language==='English'?'اسم المستخدم أو البريد':'Username or email'}<input name="login" dir="ltr" autoFocus={standalone} autoComplete="username" required maxLength={254}/></label>}<label>{mode==='password'?t.newPassword:t.password}<input name="password" type="password" dir="ltr" autoComplete={mode==='login'?'current-password':'new-password'} minLength={mode==='login'?1:12} maxLength={128} required/></label>{error&&<p className="form-error" role="alert">{error}</p>}{message&&<p className="success" role="status">{message}</p>}<button className="primary full" disabled={busy||!supabase}>{busy?<LoaderCircle className="spin" size={18}/>:mode==='login'?t.login:t.updatePassword}</button></form><p className="muted" style={{marginTop:20}}>{t.language==='English'?'اطلب من المسؤول بيانات الدخول أو إعادة تعيين كلمة المرور.':'Ask your administrator for a login or password reset.'}</p></>;
  return standalone?content:<Dialog title={t.login} close={()=>setMode(null)}>{content}</Dialog>;
}
function CreateDialog({t,profiles,close,onCreated}:{t:Copy;profiles:Profile[];close:()=>void;onCreated:()=>void}) {
  const [symbol,setSymbol]=useState<PatrolSymbol>('compass'),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();if(!supabase)return;const f=new FormData(e.currentTarget),name=String(f.get('name')),motto=String(f.get('motto'));const invalid=validatePatrol(name,motto);if(invalid){setError(invalid);return;}setBusy(true);setError('');try{const {error}=await supabase.rpc('create_patrouille',{p_name:name.trim(),p_motto:motto.trim(),p_symbol:symbol,p_leader:f.get('leader')||null});if(error)throw error;onCreated();}catch(e){setError((e as {code?:string}).code==='23505'?'That Patrouille name or leader is already in use.':(e as Error).message);}finally{setBusy(false);}}
  return <Dialog title={t.create} close={()=>{if(!busy)close();}}><span className="eyebrow">{t.admin}</span><h2>{t.create}</h2><p className="muted">{t.newPatrol}</p><form onSubmit={submit}><label>{t.name}<input name="name" required minLength={2} maxLength={60} autoFocus/></label><label>{t.motto}<textarea name="motto" maxLength={160} rows={2}/></label><fieldset><legend>{t.symbol}</legend><div className="symbol-options">{symbols.map(s=>{const Icon=iconMap[s];return <button type="button" key={s} aria-label={s} aria-pressed={symbol===s} className={symbol===s?'chosen':''} onClick={()=>setSymbol(s)}><Icon size={26}/>{symbol===s&&<Check size={12}/>}</button>;})}</div></fieldset><label>{t.leader}<select name="leader"><option value="">{t.optional}</option>{profiles.map(p=><option key={p.id} value={p.id}>{p.display_name} · {p.id.slice(0,8)}</option>)}</select></label>{error&&<p className="form-error" role="alert">{error}</p>}<div className="form-actions"><button className="subtle" type="button" disabled={busy} onClick={close}>{t.cancel}</button><button className="primary" disabled={busy}>{busy?<LoaderCircle size={18} className="spin"/>:<Plus size={18}/>} {t.save}</button></div></form></Dialog>;
}
function RosterDialog({t,patrol,profiles,members,admin,close,reload}:{t:Copy;patrol:Patrol;profiles:Profile[];members:Membership[];admin:boolean;close:()=>void;reload:()=>Promise<void>}) {
  const [error,setError]=useState(''),[busy,setBusy]=useState(false);const assigned=members.filter(m=>m.patrouille_id===patrol.id);const available=profiles.filter(p=>!members.some(m=>m.user_id===p.id));const Icon=iconMap[patrol.symbol];
  async function mutate(action:()=>PromiseLike<{error:{message:string}|null}>){setBusy(true);setError('');try{const {error}=await action();if(error)throw error;await reload();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  return <Dialog title={patrol.name} close={()=>{if(!busy)close();}}><div className="emblem"><Icon size={30}/></div><h2>{patrol.name}</h2><p className="muted">{patrol.motto}</p>{admin&&<label>{t.symbol}<select aria-label={t.symbol} value={patrol.symbol} disabled={busy} onChange={e=>{const symbol=e.target.value;void mutate(async()=>{const result=await supabase!.from('patrouilles').update({symbol}).eq('id',patrol.id);if(!result.error)patrol.symbol=symbol as PatrolSymbol;return result;});}}>{symbols.map(s=><option key={s} value={s}>{s}</option>)}</select></label>}<h3>{t.members}</h3>{!assigned.length&&<p className="muted">{t.rosterEmpty}</p>}<ul className="roster">{assigned.map(m=><li key={m.user_id}><span><strong>{profiles.find(p=>p.id===m.user_id)?.display_name??t.scoutRole}</strong><small>{m.role==='leader'?t.leaderRole:t.scoutRole}</small></span>{admin&&<button className="text-button danger" disabled={busy} onClick={()=>void mutate(()=>supabase!.from('patrouille_members').delete().eq('patrouille_id',patrol.id).eq('user_id',m.user_id))}>{t.remove}</button>}</li>)}</ul>{admin&&<form onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);void mutate(()=>supabase!.from('patrouille_members').insert({patrouille_id:patrol.id,user_id:String(f.get('member')),role:String(f.get('role'))}));}}><label>{t.choose}<select name="member" required defaultValue=""><option value="" disabled>{t.choose}</option>{available.map(p=><option value={p.id} key={p.id}>{p.display_name} · {p.id.slice(0,8)}</option>)}</select></label><label>{t.members}<select name="role"><option value="scout">{t.scoutRole}</option><option value="leader">{t.leaderRole}</option></select></label><button className="primary full" disabled={busy||!available.length}><Plus size={18}/>{t.add}</button></form>}{error&&<p className="form-error" role="alert">{error}</p>}</Dialog>;
}
function Account({t,session,name,role,admin,onPassword,onUpdate}:{t:Copy;session:Session;name:string;role:string;admin:boolean;onPassword:()=>void;onUpdate:()=>void}){const [busy,setBusy]=useState(false),[message,setMessage]=useState('');return <><div className="section-title"><div><h1>{t.account}</h1><p>{t.security}</p></div><ShieldCheck size={36}/></div><section className="tool-panel account-panel"><span className="role-tag">{admin?t.admin:role}</span><h2>{session.user.email?.endsWith('@scout-hub.invalid')?session.user.email.split('@')[0]:session.user.email}</h2><label>{t.id}<code dir="ltr">{session.user.id}</code></label><form onSubmit={async e=>{e.preventDefault();setBusy(true);setMessage('');try{const value=String(new FormData(e.currentTarget).get('name')).trim();if(!value)throw new Error('Enter a name.');const {error}=await supabase!.from('accounts').update({display_name:value}).eq('id',session.user.id);if(error)throw error;setMessage(t.saved);onUpdate();}catch(e){setMessage((e as Error).message);}finally{setBusy(false);}}}><label>{t.profileName}<input key={name} name="name" defaultValue={name} required maxLength={80}/></label><button className="primary" disabled={busy}>{t.saveProfile}</button><p role="status">{message}</p></form><button className="subtle" onClick={onPassword}>{t.updatePassword}</button></section></>;}
