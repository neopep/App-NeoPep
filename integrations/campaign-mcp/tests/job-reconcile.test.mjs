import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {prepareDraftAddition} from '../src/draft-plan.mjs';
const migration=readFileSync(new URL('../../../release/connect-ai/010-job-reconcile.candidate.sql',import.meta.url),'utf8');
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
test('reconcile only exact historical receipts; no replay, no content disclosure, no cross-owner access',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`
   create role anon;create role authenticated;create role neo_connect_ai_broker;
   create schema neo_private;
   create table neo_private.connect_ai_environment(project_ref text,drafts_enabled boolean);
   insert into neo_private.connect_ai_environment values ('qnuluspqfazdppciermw',false);
   create table neo_private.connect_ai_draft_jobs(id uuid primary key,connection_id uuid,channel text,campaign_id uuid);
   create table neo_private.connect_ai_draft_job_items(job_id uuid,request_id uuid,publication_id uuid,state text,revision int,lease_id uuid,leased_until timestamptz,payload jsonb);
   create table neo_private.campaign_editor_versions(editor_id uuid,revision int,request_id uuid unique,source_id uuid,owner_id uuid,channel text,draft jsonb);
   create table neo_private.campaign_app_publications(id uuid,campaign_id uuid);
   create table neo_private.campaign_central_publications(id uuid,editor_id uuid,source_id uuid,campaign_id uuid);
   create table neo_private.connect_ai_audit_events(connection_id uuid,action text,outcome text,request_id uuid);
   create function neo_private.connect_ai_job_check(uuid,uuid) returns boolean language sql as $$select $1='${id(1)}'::uuid and $2='${id(2)}'::uuid and exists(select 1 from neo_private.connect_ai_environment where drafts_enabled)$$;
  `);
  await db.exec(migration);
  const call=async(req,owner=id(2))=>(await db.query('select neo_private.connect_ai_job_reconcile($1,$2,$3,$4) as value',[id(1),owner,id(3),req])).rows[0].value;
  await assert.rejects(call(id(100)),/forbidden/);
  await db.exec('update neo_private.connect_ai_environment set drafts_enabled=true');
  for(const channel of ['app','whatsapp']){
   const job=channel==='app'?id(3):id(4),campaign=channel==='app'?id(5):id(6);
   await db.query('insert into neo_private.connect_ai_draft_jobs values ($1,$2,$3,$4)',[job,id(1),channel,campaign]);
   for(let k=0;k<5;k++){
    const n=(channel==='app'?100:200)+k,req=id(n),pub=id(n+1000),item={publicationId:pub,requestId:req,title:'Fixture',blocks:[{id:id(n+2000),text:'Exact original'}]};
    const expected=prepareDraftAddition({channel,campaignId:campaign,...item}).p_data.draft;
    await db.query('insert into neo_private.connect_ai_draft_job_items values ($1,$2,$3,$4,null,null,null,$5)',[job,req,pub,k===4?'pending':'uncertain',JSON.stringify(item)]);
    if(k!==1)await db.query('insert into neo_private.campaign_editor_versions values ($1,1,$2,$3,$4,$5,$6)',[pub,req,campaign,k===2?id(99):id(2),channel,JSON.stringify(k===3?{...expected,title:'Different'}:expected)]);
    if(channel==='app')await db.query('insert into neo_private.campaign_app_publications values ($1,$2)',[pub,campaign]);
    else await db.query('insert into neo_private.campaign_central_publications values ($1,$1,$2,$2)',[pub,campaign]);
    const reconcile=async()=>(await db.query('select neo_private.connect_ai_job_reconcile($1,$2,$3,$4) as value',[id(1),id(2),job,req])).rows[0].value;
    const result=await reconcile();
    assert.equal(result.state,k===0?'saved':k===4?'pending':'uncertain');assert.equal(result.reconciled,k===0);
    assert.equal((await reconcile()).reconciled,false);assert.ok(!JSON.stringify(result).includes('Exact original'));
   }
  }
  await assert.rejects(call(id(100),id(99)),/forbidden/);
  const counts=(await db.query("select count(*)::int as n from neo_private.connect_ai_audit_events")).rows[0];assert.equal(counts.n,2);
  const acl=(await db.query("select has_function_privilege('anon','neo_private.connect_ai_job_reconcile(uuid,uuid,uuid,uuid)','EXECUTE') as anon,has_function_privilege('authenticated','neo_private.connect_ai_job_reconcile(uuid,uuid,uuid,uuid)','EXECUTE') as auth,has_function_privilege('neo_connect_ai_broker','neo_private.connect_ai_job_reconcile(uuid,uuid,uuid,uuid)','EXECUTE') as broker")).rows[0];
  assert.deepEqual(acl,{anon:false,auth:false,broker:true});
 }finally{await db.close();}
});
