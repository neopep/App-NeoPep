import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {PGlite} from '@electric-sql/pglite';
const migration=readFileSync(new URL('../../../release/connect-ai/012-media-recovery.candidate.sql',import.meta.url),'utf8');
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
test('persist original digest before upload and recover uncertain only from matching evidence',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create role neo_connect_ai_broker;create schema neo_private;create schema storage;
 create table neo_private.connect_ai_environment(project_ref text);insert into neo_private.connect_ai_environment values('qnuluspqfazdppciermw');
 create function neo_private.connect_ai_job_check(uuid,uuid) returns boolean language sql as $$select $1='${id(1)}'::uuid and $2='${id(2)}'::uuid$$;
 create table neo_private.connect_ai_media_tickets(id uuid primary key,connection_id uuid,owner_id uuid,state text,lease_id uuid,lease_until timestamptz,expires_at timestamptz,mime text,size_bytes int,sha256 text);
 create table storage.objects(bucket_id text,name text,metadata jsonb);`);
 await db.exec(migration);
 await db.query("insert into neo_private.connect_ai_media_tickets values($1,$2,$3,'uploading',$4,now()+interval '2 minutes',now()+interval '1 hour','image/jpeg',5,null)",[id(3),id(1),id(2),id(4)]);
 const call=async(action,digest,lease=null,owner=id(2))=>(await db.query('select neo_private.connect_ai_media_recovery($1,$2,$3,$4,$5,$6) as value',[id(1),owner,id(3),action,digest,lease])).rows[0].value;
 const digest='a'.repeat(64),bad='b'.repeat(64);
 assert.equal(await call('bind',digest,id(5)),false);assert.equal(await call('bind',digest,id(4)),true);assert.equal(await call('bind',bad,id(4)),false);
 assert.equal(await call('recover',digest),false);
 await db.exec("update neo_private.connect_ai_media_tickets set state='uncertain',lease_id=null,lease_until=null");
 assert.equal(await call('recover',digest),false);
 await db.query('insert into storage.objects values ($1,$2,$3)',['neo-campaign-images',id(2)+'/'+id(3)+'.jpg',JSON.stringify({size:5,mimetype:'image/jpeg'})]);
 assert.equal(await call('recover',bad),false);await assert.rejects(call('recover',digest,null,id(99)),/forbidden/);
 assert.equal(await call('recover',digest),true);assert.equal(await call('recover',digest),false);
 const row=(await db.query('select state,sha256,expected_sha256 from neo_private.connect_ai_media_tickets')).rows[0];assert.deepEqual(row,{state:'stored',sha256:digest,expected_sha256:digest});
 }finally{await db.close();}
});
