export function morsePulses(code:string,wpm:number):{on:boolean;ms:number}[]{
 const unit=1200/wpm,result:{on:boolean;ms:number}[]=[];
 const words=code.trim().split(/\s*\/\s*/);
 words.forEach((word,wi)=>{const letters=word.trim().split(/\s+/);letters.forEach((letter,li)=>{[...letter].forEach((ch,ci)=>{if(!'.-'.includes(ch))return;result.push({on:true,ms:(ch==='.'?1:3)*unit});if(ci<letter.length-1)result.push({on:false,ms:unit});});if(li<letters.length-1)result.push({on:false,ms:3*unit});});if(wi<words.length-1)result.push({on:false,ms:7*unit});});
 return result;
}
