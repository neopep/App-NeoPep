import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

const migration=readFileSync(new URL('../../../release/connect-ai/009-image5.candidate.sql',import.meta.url),'utf8');

test('009 defaults to legacy limits and grants 5 MiB only to recent approved 0.2.16 devices with the capability',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`
   create role anon; create role authenticated;
   create schema neo_private; create schema storage;
   create table neo_private.campaign_wa_rich_control(singleton boolean);
   insert into neo_private.campaign_wa_rich_control values (true);
   create table neo_private.connect_wa_connections(id uuid, device_id uuid, owner_id uuid,status text);
   create table neo_private.connect_devices(id uuid, owner_id uuid,state text,version text,last_seen timestamptz);
   create table neo_private.campaign_wa_rich_messages(id uuid);
   create table storage.objects(bucket_id text,name text,metadata jsonb);
   create function public.neo_campaign_rich_admin_v1(text,jsonb) returns jsonb language plpgsql as $fn$
   declare actor uuid; t record; begin
   return jsonb_build_object('max_image_bytes',1048576,'a',4 between 4 and 1048576,'b',4 between 1 and 1048576);
   end $fn$;
   create function public.neo_campaign_rich_device_v1(text,uuid,text,p_data jsonb) returns jsonb language plpgsql as $fn$
   declare actor uuid; t record; m record; job record; begin
   perform 1 where true
    and not exists(select 1 from neo_private.campaign_wa_rich_messages preceding);
   if m.state<>'leased' or (m.kind='file' and false) then return null; end if;
   return null;
   end $fn$;
  `);
  await db.exec(migration);
  const owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const device='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const connection='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  await db.query("insert into neo_private.connect_devices values ($1,$2,'approved','0.2.16',now())",[device,owner]);
  await db.query("insert into neo_private.connect_wa_connections values ($1,$2,$3,'connected')",[connection,device,owner]);
  await db.exec(`insert into storage.objects values
   ('neo-campaign-images','boundary','{"size":5242880}'),
   ('neo-campaign-images','above','{"size":5242881}'),
   ('neo-campaign-images','invalid','{"size":"NaN"}');`);
  const limit=async()=>(await db.query('select neo_private.campaign_image_limit($1,$2) as bytes',[owner,connection])).rows[0].bytes;
  const supported=async(path,capability)=>(await db.query("select neo_private.campaign_image_job_supported($1,$2,'neo-campaign-images',$3,$4) as supported",[owner,connection,path,capability])).rows[0].supported;
  assert.equal(await limit(),1048576);
  assert.equal(await supported('boundary',true),false);
  await db.exec('update neo_private.campaign_wa_rich_control set image5_enabled=true where singleton');
  assert.equal(await limit(),5242880);
  assert.equal(await supported('boundary',true),true);
  assert.equal(await supported('boundary',false),false);
  assert.equal(await supported('above',true),false);
  assert.equal(await supported('invalid',true),false);
  await db.exec("update neo_private.connect_devices set version='0.2.15' where state='approved'");
  assert.equal(await limit(),1048576);
  await db.exec("update neo_private.connect_devices set version='0.2.16',last_seen=now()-interval '91 seconds' where state='approved'");
  assert.equal(await limit(),1048576);
 }finally{await db.close();}
});
