// Library-only TUS transport. No URL, file or credential is persisted outside the open draft.
export const LIBRARY_CHUNK=6*1024*1024;
const MAX=200*1024*1024;
const encode=value=>btoa(String.fromCharCode(...new TextEncoder().encode(value)));
const aborted=()=>new Error('Envio interrompido. Tente novamente com o mesmo arquivo.');
const wait=(ms,signal)=>new Promise((resolve,reject)=>{
 if(signal?.aborted)return reject(aborted());
 const cancel=()=>{clearTimeout(timer);reject(aborted());};
 const timer=setTimeout(()=>{signal?.removeEventListener('abort',cancel);resolve();},ms);
 signal?.addEventListener('abort',cancel,{once:true});
});
export async function uploadLibraryTus({file,ticket,endpoint,credentials,valid,onProgress,signal,request=fetch,sleep=wait}){
 const base=new URL(endpoint);
 if(base.protocol!=='https:'||!/^\/storage\/v1\/upload\/resumable\/?$/.test(base.pathname)||!file.size||file.size>MAX)throw Error('Envio inválido.');
 const active=()=>{if(signal?.aborted||!valid())throw aborted();};
 const secureURL=value=>{
  const u=new URL(value,base);
  if(u.origin!==base.origin||!u.pathname.startsWith(base.pathname.replace(/\/$/,'')+'/')||u.username||u.password||u.hash||u.search)throw Error('Endereço de upload inválido.');
  return u.href;
 };
 const send=async(method,url,headers={},body)=>{
  active();const auth=await credentials();active();
  const c=new AbortController(),cancel=()=>c.abort(),timer=setTimeout(cancel,120000);
  signal?.addEventListener('abort',cancel,{once:true});if(signal?.aborted)c.abort();
  try{
   const response=await request(url,{method,headers:{...auth,'Tus-Resumable':'1.0.0',...headers},body,signal:c.signal,credentials:'omit',redirect:'error',cache:'no-store',referrerPolicy:'no-referrer'});
   active();return response;
  }finally{clearTimeout(timer);signal?.removeEventListener('abort',cancel);}
 };
 const readOffset=r=>{
  const s=r.headers.get('Upload-Offset');
  const n=typeof s==='string'&&/^\d+$/.test(s)?Number(s):NaN;
  if(!Number.isSafeInteger(n)||n<0||n>file.size)throw Error('Posição de envio inválida.');
  return n;
 };
 const retryable=status=>[408,409,423,429,500,502,503,504].includes(status);
 const report=n=>{ticket.offset=n;try{onProgress?.(n,file.size);}catch{}};
 const fatal=message=>Object.assign(new Error(message),{fatal:true});
 const retry=async operation=>{
  const delays=[0,1000,3000,5000,10000];let last;
  for(const delay of delays){
   active();if(delay)await sleep(delay,signal);active();
   try{return await operation();}catch(e){active();if(e.fatal)throw e;last=e;}
  }
  throw last||aborted();
 };
 const check=async r=>{
  if(!r.ok){if(retryable(r.status))throw Error('Conexão instável durante o envio.');throw fatal(r.status===404||r.status===410?'Envio expirado. Remova o anexo e selecione novamente.':'O servidor recusou o envio ('+r.status+').');}
  return r;
 };
 if(!ticket.url){
  const metadata={bucketName:'neo-library',objectName:ticket.path,contentType:file.type,cacheControl:'3600'};
  // Do not automatically repeat POST after an uncertain response. It may have created an upload.
  const r=await check(await send('POST',base.href,{'Upload-Length':String(file.size),'Upload-Metadata':Object.entries(metadata).map(([k,v])=>k+' '+encode(v)).join(','),'x-upsert':'false'}));
  if(r.status!==201||!r.headers.get('Location'))throw fatal('O servidor não confirmou a criação do envio.');
  ticket.url=secureURL(r.headers.get('Location'));
 }
 const url=secureURL(ticket.url);
 const head=async()=>readOffset(await check(await send('HEAD',url)));
 let offset=await retry(head);report(offset);
 while(offset<file.size){
  const before=offset;
  offset=await retry(async()=>{
   // Always reconcile with server before retrying a PATCH; never resend an accepted block.
   const actual=await head();
   if(actual<before)throw fatal('O servidor retornou uma posição anterior ao envio confirmado.');
   if(actual>before)return actual;
   const end=Math.min(actual+LIBRARY_CHUNK,file.size);
   const r=await check(await send('PATCH',url,{'Content-Type':'application/offset+octet-stream','Upload-Offset':String(actual)},file.slice(actual,end)));
   const next=readOffset(r);if(next!==end)throw Error('Bloco não confirmado.');
   return next;
  });
  if(offset<=before)throw Error('O envio não avançou.');
  report(offset);
 }
 return ticket.path;
}
