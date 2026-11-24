const {test}=require('node:test'),assert=require('node:assert/strict'),{PGlite}=require('@electric-sql/pglite'),fs=require('fs'),C=require('../dist/core.js');
async function setup(apply=true){const db=new PGlite();await db.exec(`create role service_role;create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,created_at timestamptz default now(),raw_user_meta_data jsonb default '{}');create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid,name text,bucket_id text);alter table storage.objects enable row level security;grant usage on schema storage to authenticated;grant select,insert,delete on storage.objects to authenticated;create function storage.foldername(text) returns text[] language sql immutable as $$ select string_to_array($1,'/') $$;`);if(apply)for(const f of fs.readdirSync('supabase/migrations').sort()){try{await db.exec(fs.readFileSync('supabase/migrations/'+f,'utf8'))}catch(e){delete e.query;throw e}}return db}
const A='00000000-0000-4000-8000-000000000001',B='00000000-0000-4000-8000-000000000002';
async function as(db,id){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role authenticated')}
const profile=()=>({...C.defaultProfile(),name:'Teste',height:174,initialWeight:80,goal:75,consent:true});
async function onboard(db){await db.query('select neo_complete_onboarding($1,$2,true,true)',[JSON.stringify(profile()),JSON.stringify(C.blank().settings)])}
test('Conversa: resumo escolhido e validado, foto privada até aprovação, retry e isolamento',async()=>{const db=await setup();try{
 await db.query('insert into auth.users(id) values($1),($2)',[A,B]);await as(db,A);await onboard(db);
 const old=async(action,payload={})=>(await db.query('select neo_community($1,$2) as d',[action,JSON.stringify(payload)])).rows[0].d;
 const chat=async(action,payload={})=>(await db.query('select neo_community_chat($1,$2) as d',[action,JSON.stringify(payload)])).rows[0].d;
 await old('join',{alias:'Pessoa A',agree:'on'});
 await db.query('insert into neo_records(user_id,kind,id,data) values($1,$2,$3,$4)',[A,'weights','today',JSON.stringify({id:'today',date:C.today(),value:78})]);
 const fields=['change','days'];const snapshot=await chat('preview',{fields});assert.equal(snapshot.change_kg,-2);assert.ok(!Object.hasOwn(snapshot,'current_kg'));assert.ok(!JSON.stringify(snapshot).includes('Teste'));
 await assert.rejects(chat('preview',{fields:['email']}),/field/);
 for(const [kind,row] of Object.entries({measures:{id:'m',date:C.today(),waist:90},journal:{id:'j',date:C.today(),energy:4,note:'Minha anotação'},doses:{id:'d',date:C.today(),product:'Registro pessoal',amount:1,unit:'mg'},protocols:{id:'p',date:C.today(),name:'Meu protocolo',status:'active'},reminders:{id:'r',date:C.today(),title:'Registrar',time:'08:00',repeat:'daily',weekday:1,enabled:true}}))await db.query('insert into neo_records(user_id,kind,id,data) values($1,$2,$3,$4)',[A,kind,row.id,JSON.stringify(row)]);
 const all=await chat('preview',{fields:['initial','height','weights','measures','journal','doses','protocols','reminders']});assert.equal(all.initial_kg,80);assert.equal(all.height_cm,174);for(const kind of ['weights','measures','journal','doses','protocols','reminders']){assert.equal(all[kind].length,1);assert.ok(!Object.hasOwn(all[kind][0],'id'))}assert.equal(all.journal[0].note,'Minha anotação');

 await assert.rejects(chat('reserve_photo'),/consent/);const {path}=await chat('reserve_photo',{photo_share:'on'});
 await db.query('insert into storage.objects(name,bucket_id) values($1,$2)',[path,'neo-community']);
 const payload={id:'10000000-0000-4000-8000-000000000001',body:'Minha evolução',share:'on',photo_share:'on',summary_share:'on',photo_path:path,snapshot,fields};
 await assert.rejects(chat('post',{...payload,snapshot:{...snapshot,change_kg:-99}}),/summary changed/);
 await assert.rejects(chat('post',{...payload,photo_share:null}),/consent/);
 await chat('post',payload);await chat('post',payload);let read=await chat('read');assert.equal(read.posts.length,1);assert.equal(read.posts[0].photo_path,path);assert.deepEqual(read.posts[0].snapshot,snapshot);assert.equal(read.chat_ready,true);
 await assert.rejects(chat('post',{...payload,body:'Outro texto'}),/conflict/);
 await as(db,B);await onboard(db);await old('join',{alias:'Pessoa B',agree:'on'});
 assert.equal((await chat('read')).posts.length,0);assert.equal((await db.query("select * from storage.objects where bucket_id='neo-community'")).rows.length,0);
 await assert.rejects(chat('post',{...payload,id:'10000000-0000-4000-8000-000000000002',snapshot:null}),/photo/);
 await assert.rejects(db.query('insert into storage.objects(name,bucket_id) values($1,$2)',[A+'/forged.jpg','neo-community']),/row-level/);
 await db.exec('reset role');await db.query('insert into neo_private.admin_members(user_id) values($1)',[B]);await as(db,B);
 assert.equal((await db.query("select * from storage.objects where bucket_id='neo-community'")).rows.length,1);
 await old('approve',{id:payload.id});assert.equal((await chat('read')).posts.length,1);
 await db.exec('reset role');await db.query('delete from neo_private.admin_members where user_id=$1',[B]);await as(db,B);assert.equal((await db.query("select * from storage.objects where bucket_id='neo-community'")).rows.length,1);
 await as(db,A);await old('delete_post',{id:payload.id});await as(db,B);assert.equal((await db.query("select * from storage.objects where bucket_id='neo-community'")).rows.length,0);
 await as(db,A);await old('leave');assert.deepEqual(await chat('attachments'),[]);assert.equal((await db.query("select * from storage.objects where bucket_id='neo-community'")).rows.length,1);
 await db.query("delete from storage.objects where bucket_id='neo-community'");
 await db.exec('reset role');await db.exec(fs.readFileSync('supabase/migrations/202611120005_community_chat.sql','utf8'));
 }finally{await db.close()}});
