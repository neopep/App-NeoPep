import {test} from 'node:test';
import assert from 'node:assert/strict';
import {exportJWK,generateKeyPair} from 'jose';
import staging from '../src/staging-entry.mjs';
import production from '../src/production-entry.mjs';
import {environmentHandler} from '../src/environment-worker.mjs';
import {testProfile,productionProfile} from '../src/environments.mjs';
import {challengeS256} from '../src/pkce.mjs';

for(const profile of [testProfile,productionProfile])test('consentimento e leitura isolados em '+profile.name,async()=>{
 const {issuerOrigin:issuer,resource,approvalOrigin:approval}=profile;
 const redirect='https://client.invalid/callback';
 const ownerId='11111111-1111-4111-8111-111111111111',id='22222222-2222-4222-8222-222222222222';
 const token='fixture.subject.signature';
 const {publicKey,privateKey}=await generateKeyPair('ES256',{extractable:true});
 const consumed=new Set();
 let bound,grant;
 const env={
  NEO_CONNECT_AI_ENABLED:'1',NEO_CONNECT_AI_CSRF_KEY:'11'.repeat(32),NEO_CONNECT_AI_KEY_ID:'fixture',
  NEO_CONNECT_AI_SUPABASE_PUBLISHABLE_KEY:'fixture',NEO_CONNECT_AI_CLIENTS:JSON.stringify({client:[redirect]}),
  NEO_CONNECT_AI_SIGNING_JWK:JSON.stringify(await exportJWK(privateKey)),
  NEO_CONNECT_AI_PUBLIC_JWK:JSON.stringify(await exportJWK(publicKey)),
  NEO_CONNECT_AI_BROKER:{async fetch(req){
   const p=new URL(req.url).pathname,data=await req.json();
   if(p==='/consent/claim'){
    if(consumed.has(data.proof))return Response.json(false);
    consumed.add(data.proof);return Response.json(true);
   }
   if(p==='/session/bind'){bound=data;return Response.json(true);}
   if(p==='/grant/register'){grant=data;return Response.json(true);}
   if(p==='/grant/rotate')return Response.json(grant?.digest===data.digest?{id,ownerId}:null);
   if(p==='/session/read')return Response.json(bound?.token||null);
   if(p==='/connection/read')return Response.json({id,ownerId,clientId:'client',environment:profile.name,resource,
    expiresAt:Date.now()+60000,scopes:['campaigns:read']});
   throw Error('Unexpected broker call');
  }}
 };
 const upstream=async(url,init)=>{
  assert.equal(new URL(url).origin,profile.supabaseOrigin);
  assert.equal(init.headers.Authorization,'Bearer '+token);
  if(url.endsWith('/auth/v1/user'))return Response.json({id:ownerId});
  if(url.endsWith('/neo_connect_ai_connections'))return Response.json({id,owner_id:ownerId});
  assert.equal(JSON.parse(init.body).p_action,'list');
  return Response.json([]);
 };
 const handle=async(request)=>(await environmentHandler(profile,env,upstream))(request);
 const verifier='a'.repeat(43),url=new URL('/oauth/authorize',issuer);
 url.search=new URLSearchParams({response_type:'code',client_id:'client',redirect_uri:redirect,
  code_challenge:await challengeS256(verifier),code_challenge_method:'S256',resource,scope:'campaigns:read',state:'state-test'});
 const attach=await handle(new Request(url));
 assert.equal(attach.status,303);
 const ask=new URL(attach.headers.get('location'));
 assert.equal(ask.origin,approval);
 const headers={Origin:approval,Authorization:'Bearer '+token,'X-Neo-Consent':'approve',
  'X-Neo-Csrf':ask.searchParams.get('connectAiCsrf'),'X-Neo-Expires':ask.searchParams.get('connectAiExpires')};
 const post=(extra={})=>handle(new Request(url,{method:'POST',headers:{...headers,...extra}}));
 assert.equal((await post({Origin:'https://wrong.invalid'})).status,403);
 assert.equal((await post({'X-Neo-Csrf':'A'.repeat(43)})).status,403);
 const issued=await (await post()).json();
 assert.equal((await post()).status,403);
 const callback=new URL(issued.redirect);
 assert.equal(callback.origin,'https://client.invalid');
 assert.equal(callback.searchParams.get('state'),'state-test');
 assert.equal(bound.ownerId,ownerId);
 const exchange=await handle(new Request(issuer+'/oauth/token',{method:'POST',body:new URLSearchParams({
  grant_type:'authorization_code',client_id:'client',resource,redirect_uri:redirect,code_verifier:verifier,code:callback.searchParams.get('code')
 })}));
 assert.equal(exchange.status,200);
 const access=(await exchange.json()).access_token;
 const response=await handle(new Request(resource,{method:'POST',headers:{Authorization:'Bearer '+access,'Content-Type':'application/json'},
  body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'list_campaigns',arguments:{channel:'whatsapp'}}})}));
 assert.deepEqual((await response.json()).result.structuredContent,{items:[],next_offset:null});
 assert.equal((await (await environmentHandler(profile,{}))(new Request(issuer+'/.well-known/jwks.json'))).status,404);
});

test('entry points reject the other environment before opening a broker',async()=>{
 for(const [worker,own,other] of [[staging,testProfile,productionProfile],[production,productionProfile,testProfile]]){
  assert.equal((await worker.fetch(new Request(other.resource),{})).status,404);
  assert.equal((await worker.fetch(new Request(own.resource,{method:'POST'}),{})).status,401);
 }
});
