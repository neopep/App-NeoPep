const {test}=require('node:test'),assert=require('node:assert/strict'),{PGlite}=require('@electric-sql/pglite'),fs=require('fs'),C=require('../dist/core.js');
async function setup(apply=true){const db=new PGlite();await db.exec(`create role service_role;create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,created_at timestamptz default now(),raw_user_meta_data jsonb default '{}');create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid,name text,bucket_id text);alter table storage.objects enable row level security;grant usage on schema storage to authenticated;grant select,insert,delete on storage.objects to authenticated;create function storage.foldername(text) returns text[] language sql immutable as $$ select string_to_array($1,'/') $$;`);if(apply)for(const f of fs.readdirSync('supabase/migrations').sort()){try{await db.exec(fs.readFileSync('supabase/migrations/'+f,'utf8'))}catch(e){delete e.query;throw e}}return db}
const A='00000000-0000-4000-8000-000000000001',B='00000000-0000-4000-8000-000000000002';
async function as(db,id){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role authenticated')}
const profile=()=>({...C.defaultProfile(),name:'Teste',height:174,initialWeight:80,goal:75,consent:true});
async function onboard(db){await db.query('select neo_complete_onboarding($1,$2,true,true)',[JSON.stringify(profile()),JSON.stringify(C.blank().settings)])}
test('Comunidade: adesão explícita, moderação, autorização, exportação e exclusão',async()=>{const db=await setup();try{
 await db.query('insert into auth.users(id) values($1),($2)',[A,B]);await as(db,A);await onboard(db);
 const call=async(action,payload={})=>(await db.query('select neo_community($1,$2) as d',[action,JSON.stringify(payload)])).rows[0].d;
 assert.equal((await call('read')).member,false);
 await assert.rejects(call('join',{alias:'Pessoa A'}),/consent/);
 await call('join',{alias:'Pessoa A',agree:'on'});
 await assert.rejects(call('post',{body:'Experiência'}),/consent/);
 await call('post',{body:'Minha experiência',share:'on'});let d=await call('read');assert.equal(d.posts.length,1);assert.equal(d.posts[0].status,'pending');const id=d.posts[0].id;
 assert.equal(JSON.stringify(d).includes(A),false);
 await assert.rejects(call('approve',{id}),/administrator/);
 await assert.rejects(db.query('select * from neo_private.community_posts'),/permission/);
 await as(db,B);await onboard(db);await call('join',{alias:'Pessoa B',agree:'on'});assert.equal((await call('read')).posts.length,0);
 await call('delete_post',{id});await assert.rejects(call('material',{title:'X',body:'Texto'}),/administrator/);
 await db.exec('reset role');await db.query('insert into neo_private.admin_members(user_id) values($1)',[B]);await as(db,B);
 await call('approve',{id});d=await call('read');assert.equal(d.posts.length,1);assert.equal(d.posts[0].own,false);
 await call('report',{id});assert.equal((await call('read')).pending[0].reports,1);
 await assert.rejects(call('material',{title:'Vídeo',body:'Descrição',url:'javascript:alert(1)'}),/check constraint/);
 await call('material',{title:'Vídeo',body:'Descrição',url:'https://example.com/video'});assert.equal((await call('read')).materials.length,1);
 assert.equal((await call('export')).posts.length,0);
 await as(db,A);assert.equal((await call('export')).posts.length,1);await call('leave');assert.equal((await call('read')).member,false);
 await as(db,B);assert.equal((await call('read')).posts.length,0);
 await db.exec('reset role;set role anon');await assert.rejects(call('read'),/permission/);
 }finally{await db.close()}});
