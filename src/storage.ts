import {useEffect,useRef,useState} from 'react';
import {supabase} from './supabase';

export function download(name:string,content:BlobPart,type='application/json') {
  const url=URL.createObjectURL(new Blob([content],{type}));
  const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
type Cache<T>={value:T;dirty:boolean};
export function useDocument<T>(key:string,initial:T,userId?:string,shared=false) {
  const cacheKey=`tas3a:${userId||'guest'}:${shared?'program':key}`;
  const read=():Cache<T>=>{try{return JSON.parse(localStorage.getItem(cacheKey)||'null')??{value:initial,dirty:false};}catch{return {value:initial,dirty:false};}};
  const [initialCache]=useState(read);
  const [value,setValue]=useState<T>(initialCache.value);
  const [status,setStatus]=useState(userId?'loading':'local');
  const [error,setError]=useState('');
  const current=useRef(initialCache);const ready=useRef(!userId);const queue=useRef(Promise.resolve());
  const table=shared?'program_content':'scout_documents';
  const readTable=shared?'member_program_content':table;
  function cache(next:Cache<T>){current.current=next;try{localStorage.setItem(cacheKey,JSON.stringify(next));}catch{setError('Device storage is full. Export your work. / مساحة الجهاز ممتلئة. صدّر بياناتك.');}}
  async function save(){
    if(!userId||!supabase||!ready.current)return;
    queue.current=queue.current.then(async()=>{
      if(!current.current.dirty)return;
      const pending=current.current;setStatus('saving');
      const row={key:shared?'program':key,data:pending.value,updated_at:new Date().toISOString(),...(!shared?{user_id:userId}:{})};
      try {
        const {error}=await supabase!.from(table).upsert(row,{onConflict:shared?'key':'user_id,key'});
        if(error)throw error;
        if(current.current===pending)cache({value:pending.value,dirty:false});
        setStatus(current.current.dirty?'saving':'saved');setError('');
      }catch(e){setStatus('offline');setError((e as Error).message);}
    });
    await queue.current;
  }
  useEffect(()=>{
    let active=true;
    async function load(){
      if(!userId||!supabase){ready.current=true;return;}
      try {
        let query=supabase.from(readTable).select('data').eq('key',shared?'program':key);
        if(!shared)query=query.eq('user_id',userId);
        const {data,error}=await query.maybeSingle();if(error)throw error;if(!active)return;
        if(!current.current.dirty&&data){cache({value:data.data as T,dirty:false});setValue(data.data as T);}
        ready.current=true;setStatus('saved');if(current.current.dirty)void save();
      }catch(e){if(active){setStatus('offline');setError((e as Error).message);}}
    }
    void load();const online=()=>void load();window.addEventListener('online',online);
    return()=>{active=false;window.removeEventListener('online',online);};
  },[cacheKey]);
  function update(next:T|((old:T)=>T)) {
    const v=typeof next==='function'?(next as (old:T)=>T)(current.current.value):next;
    cache({value:v,dirty:true});setValue(v);if(ready.current)void save();
  }
  async function retry(){
    // Re-fetch first after an initial load failure, so an unavailable server never gets overwritten with an empty document.
    if(!ready.current&&supabase&&userId){
      let q=supabase.from(readTable).select('data').eq('key',shared?'program':key);if(!shared)q=q.eq('user_id',userId);
      const {data,error}=await q.maybeSingle();if(error){setError(error.message);return;}
      if(!current.current.dirty&&data){cache({value:data.data as T,dirty:false});setValue(data.data as T);}ready.current=true;
    }
    await save();if(!current.current.dirty){setStatus('saved');setError('');}
  }
  return {value,update,status,error,retry};
}
export type DocumentStore<T>=ReturnType<typeof useDocument<T>>;
