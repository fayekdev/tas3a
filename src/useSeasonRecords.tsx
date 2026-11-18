import {useCallback,useEffect,useRef,useState} from 'react';
import {supabase} from './supabase';
import LoadingIX from './LoadingIX';
import type {Lang} from './program';
import type {Season,StatsSource} from './statsModel';

export function useSeasonRecords(season?:Season,userId?:string){
  const key=userId&&season&&!season.closed?`${userId}:${season.id}:${season.start}:${season.end}`:'';
  const start=season?.start,end=season?.end,version=useRef(0);
  const [state,setState]=useState<{key:string;source:StatsSource|null;loading:boolean;error:string}>({key:'',source:null,loading:false,error:''});
  const refresh=useCallback(async()=>{
    if(!key||!supabase)return;const current=++version.current;
    setState(old=>({key,source:old.key===key?old.source:null,loading:true,error:''}));
    try{const {data,error}=await supabase.rpc('season_stats_records',{p_start:start,p_end:end});if(current!==version.current)return;if(error)throw error;if(!data||!Array.isArray(data.scouts)||!Array.isArray(data.patrols))throw new Error('Invalid scout records response');setState({key,source:data,loading:false,error:''});}
    catch(e){if(current===version.current)setState(old=>({...old,key,loading:false,error:(e as {message:string}).message}));}
  },[key,start,end]);
  useEffect(()=>{void refresh();const reload=()=>void refresh();window.addEventListener('focus',reload);window.addEventListener('online',reload);window.addEventListener('attendance-records-updated',reload);return()=>{++version.current;window.removeEventListener('focus',reload);window.removeEventListener('online',reload);window.removeEventListener('attendance-records-updated',reload);};},[refresh]);
  return {source:state.key===key?state.source:null,loading:!!key&&(state.key!==key||state.loading),error:state.key===key?state.error:'',refresh};
}
export function SeasonRecordsStatus({store,lang}:{store:ReturnType<typeof useSeasonRecords>;lang:Lang}){
  const ar=lang==='ar';return store.loading?<div className="stats-record-status"><LoadingIX inline label={ar?'جارٍ تحميل الإحصائيات…':'Loading scout records…'}/><span>{ar?'جارٍ تحميل الإحصائيات…':'Loading scout records…'}</span></div>:store.error?<div className="form-error" role="alert">{ar?'تعذر تحميل أحدث الإحصائيات.':'Could not fetch the latest scout records.'}<button className="subtle" onClick={()=>void store.refresh()}>{ar?'إعادة المحاولة':'Retry records'}</button><details><summary>{ar?'التفاصيل':'Details'}</summary>{store.error}</details></div>:null;
}
