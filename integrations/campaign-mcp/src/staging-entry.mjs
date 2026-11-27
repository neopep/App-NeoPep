import {importJWK} from 'jose';
import {createHandler} from './worker.mjs';
import {createIssuer} from './oauth-issuer.mjs';
import {createConsentHandler} from './consent.mjs';
import {createNeoSession} from './neo-session.mjs';
import {createConnectionAuthorizer} from './authorization.mjs';
import {createCampaignReader} from './campaign-reader.mjs';

const issuerOrigin='https://connect-teste.neopep.com.br';
const resource=issuerOrigin+'/mcp';
const approvalOrigin='https://teste.app.neopep.com.br';
const disabled=createHandler();

function configuredClients(text){
 const parsed=JSON.parse(text);
 if(!parsed||typeof parsed!=='object'||Array.isArray(parsed)||!Object.keys(parsed).length)throw Error('CLIENT_CONFIG');
 for(const [id,redirects] of Object.entries(parsed)){
  if(!id||id.length>128||!Array.isArray(redirects)||!redirects.length)throw Error('CLIENT_CONFIG');
  for(const redirect of redirects){
   const url=new URL(redirect);
   if(url.protocol!=='https:'||url.hash||url.username||url.password)throw Error('CLIENT_CONFIG');
  }
 }
 return new Map(Object.entries(parsed));
}

export async function stagingHandler(env,request=fetch){
 if(env.NEO_CONNECT_AI_ENABLED!=='1')return disabled;
 const broker=env.NEO_CONNECT_AI_BROKER;
 if(!broker?.fetch||!env.NEO_CONNECT_AI_CSRF_KEY||!env.NEO_CONNECT_AI_SIGNING_JWK||!env.NEO_CONNECT_AI_PUBLIC_JWK||
    !env.NEO_CONNECT_AI_KEY_ID||!env.NEO_CONNECT_AI_CLIENTS||!env.NEO_CONNECT_AI_SUPABASE_PUBLISHABLE_KEY)throw Error('TESTE_CONFIGURATION');
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
 const verify=createNeoSession({publishableKey:env.NEO_CONNECT_AI_SUPABASE_PUBLISHABLE_KEY,request});
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
  confirmNeoPepSession:async session=>session,
  store:{registerCode:data=>call('grant/register',data),rotate:data=>call('grant/rotate',data)}});
 const consent=createConsentHandler({issuer:oauth,clients,approvalOrigin,csrfKey,sessionFor:async(token,{clientId,proof})=>{
  if(await call('consent/claim',{proof})!==true)return null;
  const {ownerId,data}=await verify(token,'register',{clientId,label:'NeoPep Connect AI'});
  if(!data?.id)return null;
  await call('session/bind',{id:data.id,ownerId,token});
  return {connectionId:data.id,campaignAdmin:true};
 }});
 const authorize=createConnectionAuthorizer({key:verifyKey,issuer:issuerOrigin,resource,environment:'test',
  findConnection:id=>call('connection/read',{id}),
  isCampaignAdmin:async(ownerId,environment,id)=>Boolean(await activeSession(id,ownerId))});
 return createHandler({oauth,consent,authorize,readCampaign:createCampaignReader({
  publishableKey:env.NEO_CONNECT_AI_SUPABASE_PUBLISHABLE_KEY,sessionFor:activeSession,request
 })});
}

export default {async fetch(request,env){
 if(new URL(request.url).origin!==issuerOrigin)return new Response(null,{status:404});
 try{return await (await stagingHandler(env))(request);}
 catch{return Response.json({error:'TESTE_CONFIGURATION_UNAVAILABLE'},{status:503,headers:{'Cache-Control':'no-store'}});}
}};
