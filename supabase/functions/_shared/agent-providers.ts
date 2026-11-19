import {operationalRules} from './ai-provider.ts';
export type Provider='openai'|'gemini'|'claude';
export type Integration={id:string;provider:Provider;model:string;revision:number;encrypted_key?:{iv:string;data:string};workspace?:string};
const encode=(v:Uint8Array)=>btoa(String.fromCharCode(...v));
const decode=(v:string)=>Uint8Array.from(atob(v),c=>c.charCodeAt(0));
async function master(){const raw=Deno.env.get('NEO_AI_ENCRYPTION_KEY')||'';let bytes:Uint8Array;try{bytes=decode(raw);}catch{throw Error('encryption_configuration_pending');}if(bytes.length!==32)throw Error('encryption_configuration_pending');return crypto.subtle.importKey('raw',bytes,'AES-GCM',false,['encrypt','decrypt']);}
export async function encryptKey(value:string,id:string){const iv=crypto.getRandomValues(new Uint8Array(12));const data=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode(id)},await master(),new TextEncoder().encode(value));return {iv:encode(iv),data:encode(new Uint8Array(data))};}
export async function decryptKey(value:{iv:string;data:string}|undefined,id:string){if(!value?.data)throw Error('key_pending');const bytes=await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(value.iv),additionalData:new TextEncoder().encode(id)},await master(),decode(value.data));return new TextDecoder().decode(bytes);}
export async function integrationKey(i:Integration){return decryptKey(i.encrypted_key,i.id);}
export async function generate(i:Integration,key:string,instructions:string,messages:Array<{role:string;content:string}>){
 if(!['openai','gemini','claude'].includes(i.provider)||!/^[-A-Za-z0-9._:]{1,100}$/.test(i.model))throw Error('invalid_integration');
 const system=operationalRules+'\nConfiguração do atendimento e conhecimento fornecidos pela empresa:\n'+instructions;
 const input=messages.map(m=>({role:m.role==='assistant'?'assistant':'user',content:m.content}));
 let endpoint='',headers:Record<string,string>={'Content-Type':'application/json'},body:object;
 if(i.provider==='openai'){endpoint='https://api.openai.com/v1/responses';headers.Authorization='Bearer '+key;body={model:i.model,instructions:system,input,max_output_tokens:768,store:false};}
 else if(i.provider==='gemini'){endpoint='https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(i.model)+':generateContent';headers['x-goog-api-key']=key;body={systemInstruction:{parts:[{text:system}]},contents:input.map(m=>({role:m.role==='assistant'?'model':'user',parts:[{text:m.content}]})),generationConfig:{maxOutputTokens:768}};}
 else{endpoint='https://api.anthropic.com/v1/messages';headers['x-api-key']=key;headers['anthropic-version']='2023-06-01';if(i.workspace)headers['anthropic-workspace-id']=i.workspace;body={model:i.model,system,messages:input,max_tokens:768};}
 const response=await fetch(endpoint,{method:'POST',headers,body:JSON.stringify(body),signal:AbortSignal.timeout(25000)});
 if(response.status===401||response.status===403)throw Error('provider_key_invalid');
 if(response.status===404)throw Error('provider_model_not_found');
 if(response.status===429)throw Error('provider_quota_exhausted');
 if(!response.ok)throw Error('provider_unavailable');const result=await response.json();
 const text=i.provider==='openai'?(result.output||[]).flatMap((x:any)=>x.content||[]).filter((x:any)=>x.type==='output_text').map((x:any)=>x.text||'').join('\n'):i.provider==='gemini'?(result.candidates?.[0]?.content?.parts||[]).map((x:any)=>x.text||'').join('\n'):(result.content||[]).filter((x:any)=>x.type==='text').map((x:any)=>x.text||'').join('\n');
 if(!text.trim())throw Error('empty_response');return text.trim().slice(0,4000);
}
