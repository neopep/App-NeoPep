import {createHash,timingSafeEqual} from 'node:crypto';
import {createClient} from 'npm:@supabase/supabase-js@2.80.0';
import {bucket,fileName,parseManifest,precedes,production,sameRelease,staging,verifyManifest,verifyObject} from './manifest.mjs';

// A chave PUBLICA abaixo e derivada do artifact privado de build validado em 22/11/2026 (SHA-256 do XML: b854219e828499ecd832e258860095fd56220dca47f0da577e13ac5f8d039fca). Nao contem material privado de assinatura.
const pinnedReleasePublicJwk={"kty":"RSA","n":"5YcUyNxdDzKRNB6vK7PqXfeu3mc7MhM_IueOV7PNsNvxG_tYQzbCNxfrckvBBLx4Y8Q7suF6FupL4FlU_SZ1tV_W8PfcOkCJY9uKrmSE7mJNh4hYf2lWHrdBs0onebyldXyjXJnZ2WiprjzgNpY05sPmzcYwPr2ynOWjvh0fG8rR9ayO3DDNRx_VRauuFN6VauUB7JTGzPsFs6-21wigXuQiZhwwipp1p9s43mH6cmVuq6sTPXIdeuW3MYKB4CkLD3oTqK1LULYXJr5JbHB83SSzQuVSCDlmyZD63hwZaaFb39PsT0eRuNZ3EIBie3OKzJMACuILr8t0g9WokGAgqsRxsZK5Uh9tB0p4ibrfDIpFOZFt4rW8J99sTiT-bTEGJu2oZ0viUMUgUWSJA02rvvKtApgQSutKypyZScQl13vAlorJGTnRvXPkoE0rUpZntMf3rmTC2k-3KPyoU5ZPQ3YmQNp70DhlAiI99QUnh8K0zk3BfzHZqOGLRLbwHOt1","e":"AQAB"};
Deno.serve(async request=>{
 const project=Deno.env.get('SUPABASE_URL');
 const isProduction=project===production;
 const profile=isProduction?'production':'staging';
 const origin=isProduction?'https://app.neopep.com.br':'https://teste.app.neopep.com.br';
 const artifactPrefix=isProduction?'connect-producao':'connect-teste';
 const headers={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin',
  'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info',
  'Access-Control-Allow-Methods':'POST,OPTIONS'};
 const reply=(status:number,data:unknown)=>new Response(JSON.stringify(data),{status,headers});
 if(project!==staging&&project!==production)return reply(404,null);
 if(request.headers.has('Origin')&&request.headers.get('Origin')!==origin)return reply(403,null);
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(request.method!=='POST')return reply(405,null);
 const machineToken=request.headers.get('X-Neo-Release-Agent');
 const machine=machineToken!==null;
 if(machine){
  const expected=Deno.env.get(isProduction?'NEO_CONNECT_PRODUCTION_AGENT_TOKEN_SHA256':'NEO_CONNECT_AGENT_TOKEN_SHA256')??'';
  if(request.headers.has('Origin')||!/^[a-f0-9]{64}$/.test(machineToken)||!/^[a-f0-9]{64}$/.test(expected)||
     !timingSafeEqual(createHash('sha256').update(machineToken).digest(),Uint8Array.from(expected.match(/../g)!,x=>parseInt(x,16))))
   return reply(401,{error:'Assinador não autorizado.'});
 }
 if(isProduction&&!machine)return reply(403,{error:'Somente o assinador de Produção registra rascunhos.'});
 const auth=request.headers.get('Authorization')??'';
 if(!machine&&!/^Bearer [A-Za-z0-9_.-]{20,4096}$/.test(auth))return reply(401,{error:'Entre com uma conta administrativa.'});
 const anon=Deno.env.get('SUPABASE_ANON_KEY'),service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 const publicKey=Deno.env.get('NEO_CONNECT_RELEASE_PUBLIC_JWK');
 if(!anon||!service)return reply(503,{error:'Verificação de releases ainda não configurada.'});
 const backend=()=>createClient(project,service,{auth:{persistSession:false,autoRefreshToken:false}});
 try{
  let actor=null,listing;
  if(machine){
   listing=await backend().rpc('neo_connect_release_stage',{p_action:'list',p_data:{}});
  }else{
   const admin=createClient(project,anon,{global:{headers:{Authorization:auth}},auth:{persistSession:false,autoRefreshToken:false}});
   const identity=await admin.auth.getUser(auth.slice(7));
   if(identity.error||!identity.data.user)return reply(401,{error:'Sessão inválida.'});
   actor=identity.data.user.id;
   listing=await admin.rpc('neo_connect_update_admin',{p_action:'list',p_data:{}});
  }
  if(listing.error)return reply(listing.error.code==='42501'?403:502,{error:'Não foi possível confirmar a autorização.'});
  let evidence;
  let manifest;
  try{
   const reader=request.body?.getReader();
   if(!reader)return reply(400,{error:'Manifesto ausente.'});
   let total=0,raw='';
   const decoder=new TextDecoder();
   while(true){
    const {value,done}=await reader.read();
    if(done)break;
    total+=value.byteLength;
    if(total>16384){await reader.cancel();return reply(413,{error:'Manifesto excede 16 KiB.'});}
    raw+=decoder.decode(value,{stream:true});
   }
   const input=JSON.parse(raw+decoder.decode());
   manifest=parseManifest(machine?input.manifest:input,profile);
   if(machine){
    const {commit,runId,attempt}=input;
    if(typeof commit!=='string'||!/^[a-f0-9]{40}$/.test(commit)||
      typeof runId!=='string'||!/^[1-9][0-9]{0,19}$/.test(runId)||typeof attempt!=='string'||!/^[1-9][0-9]{0,8}$/.test(attempt)||
      manifest.artifact!==`${artifactPrefix}-${manifest.version}-${runId}-${attempt}`)
     throw Error('Evidências de origem do build inválidas.');
    evidence={commit,run_id:runId,attempt};
   }else{
    if(manifest.version!=='0.2.5')throw Error('A importação local é reservada à versão 0.2.5.');
    evidence={commit:'75f5b441beb2d0a6472d5544e639f53f9184c069',run_id:'45032627045',attempt:null};
   }
  }catch(error){return reply(400,{error:error instanceof SyntaxError?'JSON inválido.':String((error as Error).message)});}
  // A chave opcional de ambiente pode ser usada apenas se coincidir exatamente com a chave publica fixada no cliente 0.2.4. Impede aceitar outra chave por erro de configuracao.
  if(publicKey){
   const candidate=JSON.parse(publicKey);
   if(candidate.kty!==pinnedReleasePublicJwk.kty||candidate.n!==pinnedReleasePublicJwk.n||candidate.e!==pinnedReleasePublicJwk.e)
    return reply(503,{error:'Chave publica de release diferente da chave incorporada no cliente.'});
  }
  if(!await verifyManifest(manifest,pinnedReleasePublicJwk))return reply(422,{error:'A assinatura não corresponde à chave pública do cliente.'});
  const releases=listing.data?.releases??[];
  const existing=releases.find((r:{version:string})=>r.version===manifest.version);
  if(existing&&(!sameRelease(existing,manifest)||existing.distribution_state!=='draft'))
   return reply(409,{error:'Já existe um registro incompatível ou fora do estado rascunho.'});
  if(!existing&&releases.some((r:{version:string})=>precedes(manifest.version,r.version)))
   return reply(409,{error:'A versão é inferior a uma já cadastrada.'});
  const path=manifest.version+'/'+fileName;
  const operation=new URL(request.url).searchParams.get('action');
  if(operation!==null&&operation!=='upload')return reply(400,{error:'Operação inválida.'});
  if(operation==='upload'){
   if(!machine)return reply(403,{error:'Somente o assinador pode solicitar upload.'});
   const storage=createClient(project,service,{auth:{persistSession:false,autoRefreshToken:false}}).storage.from(bucket);
   const object=await storage.exists(path);
   if(object.data===true)return reply(200,{exists:true});
   if(object.data!==false)return reply(503,{error:'Não foi possível confirmar se o objeto já existe.'});
   if(existing)return reply(409,{error:'O rascunho existe e seu objeto requer revisão administrativa.'});
   const signed=await storage.createSignedUploadUrl(path,{upsert:false});
   if(signed.error)return reply(503,{error:'Não foi possível autorizar o upload privado.'});
   const url=new URL(signed.data.signedUrl);
   if(url.origin!==project||url.username||url.password||url.hash||
      url.pathname!=='/storage/v1/object/upload/sign/'+bucket+'/'+path||
      !/^\?token=[A-Za-z0-9_.-]+$/.test(url.search))return reply(503,{error:'Autorização de upload inválida.'});
   return reply(200,{exists:false,url:url.href});
  }
  const object=await fetch(project+'/storage/v1/object/authenticated/'+bucket+'/'+path,{
   headers:{Authorization:'Bearer '+service,apikey:service},redirect:'error',signal:AbortSignal.timeout(90000)
  });
  if(!object.ok||!await verifyObject(object.body,manifest,createHash('sha256')))
   return reply(422,{error:'O objeto privado está ausente ou seu tamanho ou SHA-256 diverge do manifesto.'});
  const saved=await backend().rpc('neo_connect_release_stage',{p_action:'register',p_data:{...manifest,...evidence,actor}});
  if(saved.error){
   if(saved.error.code==='23505')return reply(409,{error:'A versão foi cadastrada em paralelo. Confira a lista antes de tentar novamente.'});
   return reply(502,{error:'Não foi possível cadastrar o rascunho.'});
  }
  if(saved.data?.code==='release_version')return reply(409,{error:'A versão é inferior a uma já cadastrada.'});
  if(saved.data?.ok!==true)return reply(502,{error:'O servidor não confirmou o cadastro.'});
  return reply(saved.data.reused?200:201,{version:manifest.version,path,sha256:manifest.sha256,state:'draft'});
 }catch{return reply(503,{error:'Não foi possível verificar o arquivo privado agora. Tente novamente.'});}
});
