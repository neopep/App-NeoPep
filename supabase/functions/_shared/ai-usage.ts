type Provider = 'openai' | 'gemini' | 'claude';
export type AIObservation = {
 id:string; job_id?:string; provider:Provider; model:string; status:'ok'|'error'|'timeout'|'cancelled'; duration_ms:number;
 input_tokens:number|null; output_tokens:number|null; cached_tokens:number|null; reasoning_tokens:number|null; total_tokens:number|null;
};
export type AIObserver = (value:AIObservation)=>Promise<void>;

function tokens(value:unknown):number|null{
 return typeof value==='number'&&Number.isSafeInteger(value)&&value>=0?value:null;
}

export function normalizeUsage(provider:Provider,response:any){
 const data=provider==='gemini'?response?.usageMetadata:response?.usage;
 if(provider==='openai'){
  return {input_tokens:tokens(data?.input_tokens),output_tokens:tokens(data?.output_tokens),
   cached_tokens:tokens(data?.input_tokens_details?.cached_tokens),reasoning_tokens:tokens(data?.output_tokens_details?.reasoning_tokens),
   total_tokens:tokens(data?.total_tokens)};
 }
 if(provider==='gemini'){
  return {input_tokens:tokens(data?.promptTokenCount),output_tokens:tokens(data?.candidatesTokenCount),
   cached_tokens:tokens(data?.cachedContentTokenCount),reasoning_tokens:tokens(data?.thoughtsTokenCount),total_tokens:tokens(data?.totalTokenCount)};
 }
 // Anthropic reports uncached input, cache creation and cache reads separately.
 const base=tokens(data?.input_tokens),creation=tokens(data?.cache_creation_input_tokens),cached=tokens(data?.cache_read_input_tokens);
 const input=base===null?null:base+(creation??0)+(cached??0),output=tokens(data?.output_tokens);
 return {input_tokens:input,output_tokens:output,cached_tokens:cached,reasoning_tokens:null,
  total_tokens:input===null||output===null?null:input+output};
}

export async function withAIUsage<T>(provider:Provider,model:string,observer:AIObserver|undefined,
 task:(capture:(data:unknown)=>void)=>Promise<T>):Promise<T>{
 if(!observer)return task(()=>{});
 const id=crypto.randomUUID(),start=performance.now();
 let usage=normalizeUsage(provider,null),status:AIObservation['status']='error';
 try{
  const result=await task(data=>{usage=normalizeUsage(provider,data)});
  status='ok';
  return result;
 }catch(error){
  if(error instanceof Error&&error.name==='TimeoutError')status='timeout';
  if(error instanceof Error&&error.name==='AbortError')status='cancelled';
  throw error;
 }finally{
  try{await observer({id,provider,model,status,duration_ms:Math.round(performance.now()-start),...usage})}catch{/* Observability must not alter the result. */}
 }
}
