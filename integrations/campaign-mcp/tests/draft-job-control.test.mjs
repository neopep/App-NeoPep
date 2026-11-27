import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const migration=readFileSync(new URL('../../../release/connect-ai/008-draft-jobs-audit.test.candidate.sql',import.meta.url),'utf8');

test('60 drafts: only one chunk at a time, paused claims, expired leases and irreversible cancellation',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`
   create role anon; create role authenticated; create role neo_connect_ai_broker;
   create schema neo_private; grant usage on schema neo_private to neo_connect_ai_broker, authenticated;
   create table neo_private.connect_ai_environment(project_ref text);
   insert into neo_private.connect_ai_environment values('qnuluspqfazdppciermw');
   create table neo_private.connect_ai_connections(id uuid primary key,owner_id uuid,revoked_at timestamptz,expires_at timestamptz,scopes text[]);
   insert into neo_private.connect_ai_connections values('${id(1)}','${id(2)}',null,now()+interval '1 hour',array['campaigns:read','campaigns:drafts']);
   create table neo_private.campaign_app_groups(campaign_id uuid,owner_id uuid,deleted_at timestamptz,archived_at timestamptz);
   create table neo_private.campaign_central_groups(like neo_private.campaign_app_groups);
   insert into neo_private.campaign_app_groups values('${id(3)}','${id(2)}',null,null);
  `);
  await db.exec(migration);
  const items=Array.from({length:60},(_,i)=>({publicationId:id(i+10),requestId:id(i+100)}));
  const query=async(name,params)=>(await db.query(`select neo_private.connect_ai_job_${name}(${params.map((_,i)=>'$'+(i+1)).join(',')}) as result`,params)).rows[0].result;
  const context=[id(1),id(2),id(4)];
  const control=action=>query('control',[...context,action]);
  const claim=()=>query('claim',context);
  await db.exec('set role authenticated');
  await assert.rejects(control('status'),{code:'42501'});
  await db.exec('set role neo_connect_ai_broker');
  assert.equal((await query('create',[...context,'app',id(3),JSON.stringify(items)])).reused,false);
  assert.equal((await query('create',[...context,'app',id(3),JSON.stringify(items)])).reused,true);
  await assert.rejects(query('control',[id(1),id(999),id(4),'status']),{code:'42501'});
  const chunk=await claim();
  assert.equal(chunk.length,6);
  assert.deepEqual(await claim(),[]);
  assert.equal((await control('pause')).state,'paused');
  assert.deepEqual(await claim(),[]);
  const first=chunk[0];
  assert.equal(await query('result',[...context,first.requestId,first.leaseId,'saved',1]),true);
  await db.exec("reset role; update neo_private.connect_ai_draft_job_items set leased_until=now()-interval '1 second' where state='leased'; set role neo_connect_ai_broker");
  const resumed=await control('resume');
  assert.equal(resumed.items.filter(item=>item.state==='uncertain').length,5);
  assert.equal((await claim())[0].ordinal,6);
  const cancelled=await control('cancel');
  assert.equal(cancelled.items.filter(item=>item.state==='cancelled').length,48);
  assert.equal(cancelled.items[0].state,'saved');
  assert.deepEqual(await claim(),[]);
  await assert.rejects(control('resume'),{code:'55000'});
 }finally{await db.close();}
});
