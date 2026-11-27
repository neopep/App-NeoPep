import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {createCampaignReader} from '../src/campaign-reader.mjs';
import {createDraftWriter} from '../src/draft-writer.mjs';
import {PGlite} from '@electric-sql/pglite';
const migration=readFileSync(new URL('../../../release/connect-ai/011-album-drafts.candidate.sql',import.meta.url),'utf8');
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');

test('album revision preserves four photos and revised order; both native queues reject dispatch',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`
   create role anon; create role authenticated; create role service_role;
   create schema neo_private; create schema storage;
   create table storage.objects(bucket_id text,name text,owner_id text,metadata jsonb,primary key(bucket_id,name));
   create table neo_private.campaign_editor_versions(editor_id uuid,revision int,owner_id uuid,channel text,draft jsonb,primary key(editor_id,revision));
   create table neo_private.campaign_wa_rich_batches(editor_id uuid,revision int);
   create table neo_private.campaign_dispatch_batch(editor_id uuid,revision int);
  `);
  const owner=id(10),editor=id(11),album=id(12);
  const body=`declare b jsonb; begin
   if p_action='catalog' then return '[]'::jsonb; end if;
   if p_action='load' then return (select draft from neo_private.campaign_editor_versions order by revision desc limit 1); end if;
   for b in select value from jsonb_array_elements(p_data->'blocks') loop
    if (b - array['id','type','text','label','ref','name','url','layout','media_path']) <> '{}' then raise exception 'unsupported field'; end if;
   end loop;
   insert into neo_private.campaign_editor_versions values('${editor}',(p_data->>'revision')::int,'${owner}','whatsapp',p_data-'revision');
   return p_data-'revision';
  end`;
  await db.exec(`create function public.neo_campaign_editor_v1(p_action text,p_data jsonb) returns jsonb language plpgsql as $fn$${body}$fn$`);
  await db.exec(migration.replace('b357fba27f6ff31dea211140847437e1',createHash('md5').update(body).digest('hex')));
  const rpc=async(action,draft={})=>(await db.query('select public.neo_campaign_editor_v1($1,$2) as data',[action,JSON.stringify(draft)])).rows[0].data;
  assert.equal((await rpc('album_draft_capabilities')).album_drafts,true);
  const blocks=[];
  for(let n=1;n<=4;n++){
   const media_path=owner+'/'+id(n)+'.jpg';
   await db.query("insert into storage.objects values ('neo-campaign-images',$1,$2,jsonb_build_object('size',1048576,'mimetype','image/jpeg'))",[media_path,owner]);
   blocks.push({id:id(n),album_id:album,type:'image',media_path,text:'*Foto* '+n});
  }
  assert.deepEqual(await rpc('save',{revision:1,blocks}),{blocks});
  assert.deepEqual(await rpc('load'),{blocks});
  const revised=blocks.slice().reverse();
  revised[0]={...revised[0],text:'_Revisada_ 🌿\nhttps://example.invalid'};
  assert.deepEqual(await rpc('save',{revision:2,blocks:revised}),{blocks:revised});
  assert.deepEqual(await rpc('load'),{blocks:revised});
  let currentRevision=2;
  const principal={id:id(13),ownerId:owner,environment:'test',campaignAdmin:true,scopes:['campaigns:read','campaigns:drafts']};
  const upstream={publishableKey:'fixture',sessionFor:async()=> 'fixture',request:async(url,options)=>{
   if(url.endsWith('/user'))return Response.json({id:owner});
   const {p_action,p_data}=JSON.parse(options.body);
   if(p_action==='get')return Response.json({campaign_id:editor,deleted_at:null,publications:[{id:editor,revision:currentRevision,batches:[]}]});
   if(p_action==='load')return Response.json({editor_id:editor,channel:'whatsapp',revision:currentRevision,draft:await rpc('load')});
   assert.equal(p_action,'save');
   assert.equal(p_data.revision,currentRevision);
   await rpc('save',{...p_data.draft,revision:currentRevision+1});
   return Response.json({revision:++currentRevision});
  }};
  const read=()=>createCampaignReader(upstream)(principal,'get_publication_content',{channel:'whatsapp',campaign_id:editor,publication_id:editor});
  assert.deepEqual((await read()).blocks.map(b=>b.album_id),Array(4).fill(album));
  const items=blocks.map((block,i)=>({id:block.id,text:i===1?'*nova* 🖼️\nLegenda':''}));
  const result=await createDraftWriter({...upstream,enabled:true})(principal,'update_publications',{
   channel:'whatsapp',campaignId:editor,items:[{publicationId:editor,requestId:id(99),revision:2,albumEdit:{albumId:album,items}}]
  });
  assert.equal(result.results[0].revision,3);
  assert.deepEqual((await read()).blocks.map(({id,text})=>({id,text})),items);
  assert.equal(JSON.stringify(await read()).includes(owner+'/'),false);
  const separate=[revised[0],{id:id(20),type:'text',text:'separador'},...revised.slice(1)];
  await assert.rejects(rpc('save',{revision:4,blocks:separate}),{code:'22023'});
  await db.query('update storage.objects set owner_id=$1 where name=$2',[id(100),revised[0].media_path]);
  await assert.rejects(rpc('save',{revision:4,blocks:revised}),{code:'22023'});
  for(const table of ['campaign_wa_rich_batches','campaign_dispatch_batch'])
   await assert.rejects(db.query('insert into neo_private.'+table+' values($1,2)',[editor]),{code:'55000'});
  await rpc('save',{revision:4,blocks:[{id:id(20),type:'text',text:'legado'}]});
  await db.query('insert into neo_private.campaign_wa_rich_batches values($1,4)',[editor]);
 }finally{await db.close();}
});
