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
  code_challenge:await challengeS256(verifier),code_challenge_method:'S256',resource,scope:'campaigns:read',state:'state-test',ui_locales:'pt-BR'});
 for(const [key,value] of [['client_id','unknown'],['redirect_uri','https://wrong.invalid/callback'],['resource','https://wrong.invalid/mcp'],['scope','campaigns:write'],['code_challenge_method','plain'],['code_challenge','short'],['state','']]){
  const invalid=new URL(url);invalid.searchParams.set(key,value);
  assert.equal((await handle(new Request(invalid))).status,400,key);
 }
 const duplicate=new URL(url);duplicate.searchParams.append('client_id','client');
 assert.equal((await handle(new Request(duplicate))).status,400);
 const extension=new URL(url);extension.searchParams.set('future_extension','ignored');
 assert.equal((await handle(new Request(extension))).status,303);
 const attach=await handle(new Request(url));
 assert.equal(attach.status,303);
 const ask=new URL(attach.headers.get('location'));
 assert.equal(ask.origin,approval);
 const approvedParams=new URLSearchParams(ask.searchParams.get('connectAiRequest'));
 assert.equal(approvedParams.has('ui_locales'),false);
 assert.equal(approvedParams.get('state'),'state-test');
 const consentUrl=new URL(url);consentUrl.search=approvedParams.toString();
 const headers={Origin:approval,Authorization:'Bearer '+token,'X-Neo-Consent':'approve',
  'X-Neo-Csrf':ask.searchParams.get('connectAiCsrf'),'X-Neo-Expires':ask.searchParams.get('connectAiExpires')};
 const post=(extra={})=>handle(new Request(consentUrl,{method:'POST',headers:{...headers,...extra}}));
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

test('database interlock gates advertised draft scope and fails closed',async()=>{
 const {publicKey,privateKey}=await generateKeyPair('ES256',{extractable:true});
 const env={NEO_CONNECT_AI_ENABLED:'1',NEO_CONNECT_AI_DRAFTS:'1',NEO_CONNECT_AI_CSRF_KEY:'11'.repeat(32),NEO_CONNECT_AI_KEY_ID:'fixture',
  NEO_CONNECT_AI_SUPABASE_PUBLISHABLE_KEY:'fixture',NEO_CONNECT_AI_CLIENTS:JSON.stringify({client:['https://client.invalid/callback']}),
  NEO_CONNECT_AI_SIGNING_JWK:JSON.stringify(await exportJWK(privateKey)),NEO_CONNECT_AI_PUBLIC_JWK:JSON.stringify(await exportJWK(publicKey))};
 let gate=false,calls=0;
 env.NEO_CONNECT_AI_BROKER={async fetch(req){assert.equal(new URL(req.url).pathname,'/environment/drafts');calls++;return Response.json(gate);}};
 const metadata=async(profile)=>{const handle=await environmentHandler(profile,env);return (await handle(new Request(profile.issuerOrigin+'/.well-known/oauth-authorization-server'))).json();};
 assert.deepEqual((await metadata(testProfile)).scopes_supported,['campaigns:read']);
 gate=true;
 assert.ok((await metadata(testProfile)).scopes_supported.includes('campaigns:drafts'));
 gate='true';
 assert.deepEqual((await metadata(testProfile)).scopes_supported,['campaigns:read']);
 assert.equal(calls,3);
 assert.deepEqual((await metadata(productionProfile)).scopes_supported,['campaigns:read']);
 assert.equal(calls,3);
 env.NEO_CONNECT_AI_BROKER={async fetch(){return new Response(null,{status:503});}};
 await assert.rejects(environmentHandler(testProfile,env),/BROKER_UNAVAILABLE/);
});
