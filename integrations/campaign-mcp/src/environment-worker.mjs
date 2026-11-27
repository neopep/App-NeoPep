import {importJWK} from 'jose';
import {createHandler} from './worker.mjs';
import {createIssuer} from './oauth-issuer.mjs';
import {createConsentHandler} from './consent.mjs';
import {createNeoSession} from './neo-session.mjs';
import {createConnectionAuthorizer} from './authorization.mjs';
import {openSessionBroker} from './session-broker.mjs';
import {createCampaignReader} from './campaign-reader.mjs';
import {createDraftWriter} from './draft-writer.mjs';
import {READ_SCOPE,DRAFT_SCOPE} from './scopes.mjs';

function configuredClients(text){
 const parsed=JSON.parse(text);
 if(!parsed||typeof parsed!=='object'||Array.isArray(parsed)||!Object.keys(parsed).length)throw Error('CLIENT_CONFIG');
 for(const [id,redirects] of Object.entries(parsed)){
  if(!id||id.length>128||!Array.isArray(redirects)||!redirects.length)throw Error('CLIENT_CONFIG');
  for(const redirect of redirects){
   const url=new URL(redirect);
   if(url.protocol!=='https:'||url.hash||url.username||url.password||url.searchParams.has('code')||url.searchParams.has('state'))throw Error('CLIENT_CONFIG');
  }
 }
 return new Map(Object.entries(parsed));
}

export async function environmentHandler(profile,env,request=fetch){
 if(env.NEO_CONNECT_AI_ENABLED!=='1')return createHandler({environment:profile.name});
 const {issuerOrigin,resource,approvalOrigin}=profile;
 const enableDrafts=profile.name==='test'&&env.NEO_CONNECT_AI_DRAFTS==='1';
 const broker=env.NEO_CONNECT_AI_BROKER;
 if(!broker?.fetch||!env.NEO_CONNECT_AI_CSRF_KEY||!env.NEO_CONNECT_AI_SIGNING_JWK||!env.NEO_CONNECT_AI_PUBLIC_JWK||
    !env.NEO_CONNECT_AI_KEY_ID||!env.NEO_CONNECT_AI_CLIENTS||!env.NEO_CONNECT_AI_SUPABASE_PUBLISHABLE_KEY)throw Error('CONNECT_AI_CONFIGURATION');
 const call=async(path,body)=>{
  const response=await broker.fetch(new Request('https://connect-ai-broker.invalid/'+path,{
   method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)
  }));
  if(!response.ok)throw Error('BROKER_UNAVAILABLE');
  return response.json();
 };
 const clients=configuredClients(env.NEO_CONNECT_AI_CLIENTS),privateJwk=JSON.parse(env.NEO_CONNECT_AI_SIGNING_JWK);
 const publicJwk=JSON.parse(env.NEO_CONNECT_AI_PUBLIC_JWK);
 if(!privateJwk.d||publicJwk.d||privateJwk.x!==publicJwk.x||privateJwk.y!==publicJwk.y||
    privateJwk.kty!=='EC'||privateJwk.crv!=='P-256'||publicJwk.kty!=='EC'||publicJwk.crv!=='P-256')
  throw Error('SIGNING_CONFIGURATION');
 const key=await importJWK(privateJwk,'ES256'),verifyKey=await importJWK(publicJwk,'ES256');
 if(!/^[a-fA-F0-9]{64}$/.test(env.NEO_CONNECT_AI_CSRF_KEY))throw Error('CSRF_CONFIGURATION');
 const csrfBytes=Uint8Array.from(env.NEO_CONNECT_AI_CSRF_KEY.match(/../g),byte=>parseInt(byte,16));
 const csrfKey=await crypto.subtle.importKey('raw',csrfBytes,{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
 const verify=createNeoSession({publishableKey:env.NEO_CONNECT_AI_SUPABASE_PUBLISHABLE_KEY,request,profile});
 const sessions=new Map(); // Per-request, never global.
 async function activeSession(id,ownerId){
  if(sessions.has(id))return sessions.get(id);
  const token=await call('session/read',{id,ownerId});
  if(!token)return null;
  const checked=await verify(token,'inspect',{id});
  if(checked.ownerId!==ownerId||!checked.data||checked.data.revoked_at)return null;
  sessions.set(id,token);
  return token;
 }
 const oauth=createIssuer({issuer:issuerOrigin,resource,key,keyId:env.NEO_CONNECT_AI_KEY_ID,publicJwk,clients,
  enableDrafts,confirmNeoPepSession:async session=>session,
  store:{registerCode:data=>call('grant/register',data),rotate:data=>call('grant/rotate',data)}});
 const consent=createConsentHandler({issuer:oauth,clients,approvalOrigin,csrfKey,sessionFor:async(token,{clientId,proof,scope=READ_SCOPE})=>{
  let claim;
  try{claim=await call('consent/claim',{proof});}catch{console.warn('NEO_OAUTH: claim_backend_failed');throw Error('CONSENT_CLAIM_FAILED');}
  if(claim!==true){console.warn('NEO_OAUTH: claim_rejected');return null;}
  console.log('NEO_OAUTH: claim_ok');
  const wantsDrafts=scope===READ_SCOPE+' '+DRAFT_SCOPE;
  if(wantsDrafts&&!enableDrafts)return null;
  const {ownerId,data}=await verify(token,wantsDrafts?'register_drafts':'register',{clientId,label:wantsDrafts?'NeoPep Connect AI – Rascunhos Teste':'NeoPep Connect AI'});
  if(!data?.id){console.warn('NEO_OAUTH: connection_id_missing');return null;}
  if(await call('session/bind',{id:data.id,ownerId,token})!==true){console.warn('NEO_OAUTH: bind_rejected');return null;}
  console.log('NEO_OAUTH: bind_ok');
  return {connectionId:data.id,campaignAdmin:true,scopes:data.scopes??[READ_SCOPE]};
 }});
 const authorize=createConnectionAuthorizer({key:verifyKey,issuer:issuerOrigin,resource,environment:profile.name,
  findConnection:id=>call('connection/read',{id}),
  isCampaignAdmin:async(ownerId,environment,id)=>Boolean(await activeSession(id,ownerId))});
 const readChannels=env.NEO_CONNECT_AI_READ_APP==='1'?['whatsapp','app']:['whatsapp'];
 const writeDraft=enableDrafts?createDraftWriter({publishableKey:env.NEO_CONNECT_AI_SUPABASE_PUBLISHABLE_KEY,sessionFor:activeSession,request,profile,enabled:true}):undefined;
 return createHandler({environment:profile.name,oauth,consent,authorize,readChannels,writeDraft,readCampaign:createCampaignReader({
  publishableKey:env.NEO_CONNECT_AI_SUPABASE_PUBLISHABLE_KEY,sessionFor:activeSession,request,profile,channels:readChannels,appRecurrences:readChannels.includes('app')
 })});
}

export function environmentWorker(profile){return {async fetch(request,env){
 if(new URL(request.url).origin!==profile.issuerOrigin)return new Response(null,{status:404});
 let broker;
 try{
  if(env.NEO_CONNECT_AI_ENABLED==='1'){
   broker=await openSessionBroker(env,fetch,undefined,profile);
   await broker.verifyDatabase();
  }
  return await (await environmentHandler(profile,{...env,NEO_CONNECT_AI_BROKER:broker}))(request);
 }
 catch{return Response.json({error:'CONNECT_AI_CONFIGURATION_UNAVAILABLE'},{status:503,headers:{'Cache-Control':'no-store'}});}
 finally{if(broker)await broker.close().catch(()=>{});}
}};}
