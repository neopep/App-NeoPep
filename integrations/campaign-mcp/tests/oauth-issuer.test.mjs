import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {exportJWK,generateKeyPair,jwtVerify,SignJWT} from 'jose';
import {productionProfile} from '../src/environments.mjs';
import {openSessionBroker} from '../src/session-broker.mjs';
import {createIssuer} from '../src/oauth-issuer.mjs';
import {challengeS256} from '../src/pkce.mjs';
import {createHandler} from '../src/worker.mjs';

test('OAuth usa transação SQL para troca única, rotação e revogação por reuso',async()=>{
 const ownerId='11111111-1111-4111-8111-111111111111',connectionId='22222222-2222-4222-8222-222222222222';
 const base='https://connect-teste.neopep.com.br',resource=base+'/mcp',redirectUri='https://client.invalid/callback';
 const {publicKey,privateKey}=await generateKeyPair('ES256');
 const db=new PGlite();
 try{
  await db.exec(`create role anon;create role authenticated;create schema auth;create schema neo_private;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql as $$select null::uuid$$;
    create function auth.jwt() returns jsonb language sql as $$select '{}'::jsonb$$;
    create function neo_private.campaign_admin_allowed() returns boolean language sql as $$select false$$;`);
  for(const migration of ['001-connections','002-oauth-grants','003-session-broker'])
   await db.exec(readFileSync(new URL('../../../release/connect-ai/'+migration+'.candidate.sql',import.meta.url),'utf8'));
  await db.query('insert into auth.users values($1)',[ownerId]);
  await db.query("insert into neo_private.connect_ai_connections(id,owner_id,client_id,label) values($1,$2,'client','fixture')",[connectionId,ownerId]);
  await db.exec('set role neo_connect_ai_broker');
  const claim="insert into neo_private.connect_ai_consent_claims values(repeat('a',64),now()+interval '2 minutes') on conflict do nothing returning proof";
  assert.equal((await db.query(claim)).rows.length,1);
  assert.equal((await db.query(claim)).rows.length,0);
  await db.query("insert into neo_private.connect_ai_sessions values($1,'iv','encrypted',now()+interval '1 minute')",[connectionId]);
  await assert.rejects(db.query('update neo_private.connect_ai_connections set revoked_at=now()'),{code:'42501'});
  await db.query('delete from neo_private.connect_ai_sessions');
  const env={NEO_CONNECT_AI_DB:{connectionString:'fixture'},NEO_CONNECT_AI_SESSION_KEY:'11'.repeat(32),
   NEO_CONNECT_AI_SUPABASE_PUBLISHABLE_KEY:'fixture'};
  const upstream=async()=>{throw Error('Unexpected external request');};
  const connect=()=>async(parts,...args)=>{
   const query=parts.reduce((sql,part,index)=>sql+(index?'$'+index:'')+part,'');
   return (await db.query(query,args)).rows;
  };
  const broker=await openSessionBroker(env,upstream,connect);
  await broker.verifyDatabase();
  const mismatched=await openSessionBroker(env,upstream,connect,productionProfile);
  await assert.rejects(mismatched.verifyDatabase(),/BROKER_ENVIRONMENT_MISMATCH/);
  const invoke=async(path,body)=>(await broker.fetch(new Request('https://broker.invalid'+path,{
   method:'POST',body:JSON.stringify(body)
  }))).json();
  const upstreamToken=await new SignJWT({}).setProtectedHeader({alg:'ES256'}).setExpirationTime('5m').sign(privateKey);
  const link={id:connectionId,ownerId};
  assert.equal(await invoke('/session/bind',{...link,token:upstreamToken}),true);
  const [sealed]=(await db.query('select ciphertext from neo_private.connect_ai_sessions')).rows;
  assert.match(sealed.ciphertext,/^[a-f0-9]+$/);
  assert.ok(!sealed.ciphertext.includes(upstreamToken));
  assert.equal(await invoke('/session/read',link),upstreamToken);
  assert.equal(await invoke('/session/read',{...link,ownerId:connectionId}),null);
  const store={
   registerCode:({digest,connectionId,redirectUri,challenge,expiresAt})=>db.query(
    "insert into neo_private.connect_ai_oauth_grants(digest,connection_id,kind,redirect_uri,challenge,expires_at) values($1,$2,'code',$3,$4,$5)",
    [digest,connectionId,redirectUri,challenge,new Date(expiresAt)]),
   rotate:async({digest,kind,clientId,redirectUri,challenge,nextDigest})=>(await db.query(
    'select neo_private.connect_ai_rotate_grant($1,$2,$3,$4,$5,$6) as value',
    [digest,kind,clientId,redirectUri,challenge,nextDigest])).rows[0].value
  };
  const oauth=createIssuer({issuer:base,resource,key:privateKey,keyId:'fixture',publicJwk:{...await exportJWK(publicKey),d:'never-serialize'},clients:new Map([['client',[redirectUri]]]),
   store,confirmNeoPepSession:async session=>session==='verified'?{connectionId,campaignAdmin:true}:null});
  const handler=createHandler({oauth});
  const verifier='a'.repeat(43);
  const approval={session:'verified',consent:true,clientId:'client',redirectUri,challenge:await challengeS256(verifier),
   method:'S256',requestedResource:resource,requestedScope:'campaigns:read'};
  await assert.rejects(oauth.issueCode({...approval,session:'invalid'}),/INVALID_GRANT/);
  const code=await oauth.issueCode(approval);
  assert.ok(!(await db.query('select digest from neo_private.connect_ai_oauth_grants')).rows.some(row=>row.digest===code));
  const metadata=await (await handler(new Request(base+'/.well-known/oauth-protected-resource/mcp'))).json();
  assert.equal(metadata.resource,resource);
  const jwks=await (await handler(new Request(base+'/.well-known/jwks.json'))).json();
  assert.equal(jwks.keys[0].kid,'fixture');
  assert.ok(!Object.hasOwn(jwks.keys[0],'d'));
  const exchange=fields=>handler(new Request(base+'/oauth/token',{method:'POST',
   body:new URLSearchParams({client_id:'client',resource,...fields})}));
  const codeFields={grant_type:'authorization_code',redirect_uri:redirectUri,code_verifier:verifier,code};
  assert.equal((await exchange({...codeFields,code_verifier:'b'.repeat(43)})).status,400);
  const contenders=await Promise.all([exchange(codeFields),exchange(codeFields)]);
  assert.deepEqual(contenders.map(r=>r.status).sort(),[200,400]);
  const first=await contenders.find(r=>r.ok).json();
  assert.equal((await jwtVerify(first.access_token,publicKey,{issuer:base,audience:resource})).payload.sub,ownerId);
  const refresh={grant_type:'refresh_token',refresh_token:first.refresh_token};
  const second=await (await exchange(refresh)).json();
  assert.ok(second.refresh_token&&second.refresh_token!==first.refresh_token);
  assert.equal((await exchange(refresh)).status,400);
  assert.equal((await exchange({...refresh,refresh_token:second.refresh_token})).status,400);
  assert.ok((await db.query('select revoked_at from neo_private.connect_ai_connections')).rows[0].revoked_at);
  assert.equal(await invoke('/session/read',link),null);
  await db.exec('set role authenticated');
  await assert.rejects(db.query("select neo_private.connect_ai_rotate_grant('x','code','x',null,null,'x')"),{code:'42501'});
  await assert.rejects(db.query('select ciphertext from neo_private.connect_ai_sessions'),{code:'42501'});
 }finally{await db.close();}
});
