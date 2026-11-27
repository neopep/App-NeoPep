import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

test('registro persistente restringe autoria, emissor, administração e revogação',async()=>{
 const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222';
 const db=new PGlite();
 try{
  await db.exec(`create schema auth; create schema neo_private; create role anon; create role authenticated;
   create table auth.users(id uuid primary key);insert into auth.users values ('${a}'),('${b}');
   create function auth.uid() returns uuid language sql stable as $$select current_setting('neo.actor')::uuid$$;
   create function auth.jwt() returns jsonb language sql stable as $$select jsonb_build_object('iss',current_setting('neo.issuer'))$$;
   create function neo_private.campaign_admin_allowed() returns boolean language sql stable as $$select current_setting('neo.admin')='yes'$$;`);
  await db.exec(readFileSync(new URL('../../../release/connect-ai/001-connections.candidate.sql',import.meta.url),'utf8'));
  const configure=async(id,admin='yes',issuer='https://qnuluspqfazdppciermw.supabase.co/auth/v1')=>{
   await db.exec('reset role');
   await db.query("select set_config('neo.actor',$1,false), set_config('neo.admin',$2,false), set_config('neo.issuer',$3,false)",[id,admin,issuer]);
   await db.exec('set role authenticated');
  };
  const call=async(action,id=null)=>(await db.query('select public.neo_connect_ai_connections($1,$2,$3,$4) as x',[action,id,'fixture','Conexão'])).rows[0].x;
  await configure(a);
  const one=await call('register'),two=await call('register');
  assert.notEqual(one.id,two.id);
  await assert.rejects(db.exec('select * from neo_private.connect_ai_connections'),{code:'42501'});
  await configure(b);
  assert.equal(await call('inspect',one.id),null);
  assert.equal(await call('revoke',one.id),null);
  await configure(a,'no');
  await assert.rejects(call('inspect',one.id),{code:'42501'});
  assert.ok((await call('revoke',one.id)).revoked_at);
  await configure(a);
  assert.equal((await call('inspect',two.id)).revoked_at,null);
  await configure(a,'yes','https://wrong.invalid/auth/v1');
  await assert.rejects(call('list'),{code:'42501'});
 }finally{await db.close();}
});
