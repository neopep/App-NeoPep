import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {PGlite} from '@electric-sql/pglite';
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const migration=readFileSync(new URL('../../../release/connect-ai/011-media-attachment-receipt.candidate.sql',import.meta.url),'utf8');
test('historical receipt requires exact native request, revision, linkage, owner and preserved draft',async()=>{
 const db=new PGlite();
 try{
 await db.exec(`create role anon;create role authenticated;create role neo_connect_ai_broker;create schema neo_private;
 create table neo_private.connect_ai_environment(project_ref text,drafts_enabled boolean);insert into neo_private.connect_ai_environment values('qnuluspqfazdppciermw',true);
 create function neo_private.connect_ai_job_check(uuid,uuid) returns boolean language sql as $$select $1='${id(1)}'::uuid and $2='${id(2)}'::uuid and exists(select 1 from neo_private.connect_ai_environment where drafts_enabled)$$;
 create table neo_private.connect_ai_media_tickets(id uuid,connection_id uuid,owner_id uuid,channel text,campaign_id uuid,publication_id uuid,block_id uuid,revision int,mime text,filename text,state text,sha256 text);
 create table neo_private.campaign_editor_versions(editor_id uuid,revision int,request_id uuid unique,source_id uuid,owner_id uuid,channel text,draft jsonb);
 create table neo_private.campaign_app_publications(id uuid,campaign_id uuid);
 create table neo_private.campaign_central_publications(id uuid,campaign_id uuid,editor_id uuid,source_id uuid);`);
 await db.exec(migration);
 const call=async(ticket,owner=id(2))=>(await db.query('select neo_private.connect_ai_media_attachment_receipt($1,$2,$3) as value',[id(1),owner,ticket])).rows[0].value;
 for(const channel of ['app','whatsapp']){
  const c=channel==='app'?10:20,campaign=id(c),pub=id(c+1),block=id(c+2),ticket=id(c+3);
  const original={title:'Original',blocks:[{id:id(c+4),type:'text',text:'keep'}],groups:[],audience:'all',timezone:'America/Sao_Paulo',planned_local:''};
  const next={...original,blocks:[...original.blocks,{id:block,type:'image',text:'',media_path:id(2)+'/'+ticket+'.jpg',name:'a.jpg'}]};
  await db.query("insert into neo_private.connect_ai_media_tickets values ($1,$2,$3,$4,$5,$6,$7,1,'image/jpeg','a.jpg','stored',$8)",[ticket,id(1),id(2),channel,campaign,pub,block,'a'.repeat(64)]);
  await db.query('insert into neo_private.campaign_editor_versions values($1,1,$2,$3,$4,$5,$6)',[pub,id(c+5),campaign,id(2),channel,JSON.stringify(original)]);
  if(channel==='app')await db.query('insert into neo_private.campaign_app_publications values($1,$2)',[pub,campaign]);
  else await db.query('insert into neo_private.campaign_central_publications values($1,$2,$1,$2)',[pub,campaign]);
  assert.equal((await call(ticket)).state,'unconfirmed');
  await db.query('insert into neo_private.campaign_editor_versions values($1,2,$2,$3,$4,$5,$6)',[pub,ticket,campaign,id(2),channel,JSON.stringify({...next,title:'different'})]);
  assert.equal((await call(ticket)).state,'unconfirmed');
  await db.query('update neo_private.campaign_editor_versions set draft=$1 where request_id=$2',[JSON.stringify(next),ticket]);
  assert.deepEqual(await call(ticket),{ticketId:ticket,publicationId:pub,state:'attached_historically',revision:2});
  await db.query("update neo_private.connect_ai_media_tickets set state='uncertain' where id=$1",[ticket]);assert.equal((await call(ticket)).state,'unconfirmed');
  await assert.rejects(call(ticket,id(99)),/forbidden/);
 }
 const acl=(await db.query("select has_function_privilege('authenticated','neo_private.connect_ai_media_attachment_receipt(uuid,uuid,uuid)','EXECUTE') as auth,has_function_privilege('neo_connect_ai_broker','neo_private.connect_ai_media_attachment_receipt(uuid,uuid,uuid)','EXECUTE') as broker")).rows[0];assert.deepEqual(acl,{auth:false,broker:true});
 }finally{await db.close();}
});
