// Adapter to an explicitly configured private, trusted validator. No public fetch/URL fallback.
const policy='neopep-media-validation-v1';
const allowed=new Set(['image/jpeg','application/pdf','video/mp4']);
const hash=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
export function createMediaValidator(binding){
 if(!binding||typeof binding.fetch!=='function')return undefined;
 return async(mime,bytes)=>{
  if(!allowed.has(mime)||!(bytes instanceof Uint8Array)||!bytes.length||bytes.length>(mime==='image/jpeg'?1048576:5242880))return false;
  const copy=Uint8Array.from(bytes),sha256=await hash(copy);
  try{
   const response=await binding.fetch(new Request('https://media-validator.internal/validate',{method:'POST',headers:{'content-type':mime,'x-neo-validation-policy':policy},body:copy,redirect:'error',signal:AbortSignal.timeout(15000)}));
   if(!response.ok||!response.body||response.headers.get('content-type')?.split(';')[0].trim()!=='application/json')return false;
   const reader=response.body.getReader(),chunks=[];let total=0;
   try{while(true){const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>2048){await reader.cancel();return false;}chunks.push(value);}}finally{reader.releaseLock();}
   const buf=new Uint8Array(total);let off=0;for(const chunk of chunks){buf.set(chunk,off);off+=chunk.length;}
   const v=JSON.parse(new TextDecoder().decode(buf));
   return v?.policy===policy&&v.valid===true&&v.mime===mime&&v.size===copy.length&&v.sha256===sha256&&v.fullParse===true&&v.contentSafety===true;
  }catch{return false;}
 };
}
