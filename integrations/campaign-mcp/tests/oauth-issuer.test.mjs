import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {generateKeyPair,jwtVerify} from 'jose';
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
  for(const migration of ['001-connections','002-oauth-grants'])
   await db.exec(readFileSync(new URL('../../../release/connect-ai/'+migration+'.candidate.sql',import.meta.url),'utf8'));
  await db.query('insert into auth.users values($1)',[ownerId]);
  await db.query("insert into neo_private.connect_ai_connections(id,owner_id,client_id,label) values($1,$2,'client','fixture')",[connectionId,ownerId]);
  const store={
   registerCode:({digest,connectionId,redirectUri,challenge,expiresAt})=>db.query(
    "insert into neo_private.connect_ai_oauth_grants(digest,connection_id,kind,redirect_uri,challenge,expires_at) values($1,$2,'code',$3,$4,$5)",
    [digest,connectionId,redirectUri,challenge,new Date(expiresAt)]),
   rotate:async({digest,kind,clientId,redirectUri,challenge,nextDigest})=>(await db.query(
    'select neo_private.connect_ai_rotate_grant($1,$2,$3,$4,$5,$6) as value',
    [digest,kind,clientId,redirectUri,challenge,nextDigest])).rows[0].value
  };
  const oauth=createIssuer({issuer:base,resource,key:privateKey,keyId:'fixture',clients:new Map([['client',[redirectUri]]]),
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
  await db.exec('set role authenticated');
  await assert.rejects(db.query("select neo_private.connect_ai_rotate_grant('x','code','x',null,null,'x')"),{code:'42501'});
 }finally{await db.close();}
});
