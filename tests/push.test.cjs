const {test}=require('node:test'),assert=require('node:assert/strict'),{PGlite}=require('@electric-sql/pglite'),fs=require('fs'),C=require('../dist/core.js');
async function setup(apply=true){const db=new PGlite();await db.exec(`create role service_role;create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,created_at timestamptz default now(),raw_user_meta_data jsonb default '{}');create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid,name text,bucket_id text);alter table storage.objects enable row level security;grant usage on schema storage to authenticated;grant select,insert,delete on storage.objects to authenticated;create function storage.foldername(text) returns text[] language sql immutable as $$ select string_to_array($1,'/') $$;`);if(apply)for(const f of fs.readdirSync('supabase/migrations').sort()){try{await db.exec(fs.readFileSync('supabase/migrations/'+f,'utf8'))}catch(e){delete e.query;throw e}}return db}
const A='00000000-0000-4000-8000-000000000001',B='00000000-0000-4000-8000-000000000002';
async function as(db,id){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role authenticated')}
const profile=()=>({...C.defaultProfile(),name:'Teste',height:174,initialWeight:80,goal:75,consent:true});
async function onboard(db){await db.query('select neo_complete_onboarding($1,$2,true,true)',[JSON.stringify(profile()),JSON.stringify(C.blank().settings)])}
test('Push: endpoint seguro, proprietário, função exclusiva do servidor, deduplicação e revogação',async()=>{const db=await setup();try{
 await db.query('insert into auth.users(id) values($1),($2)',[A,B]);await as(db,A);await onboard(db);
 const time=(await db.query("select to_char(now() at time zone 'UTC','HH24:MI') as t")).rows[0].t;
 await db.query("update neo_profiles set data=jsonb_set(jsonb_set(data,'{settings,weightTime}',to_jsonb($1::text)),'{profile,tracking,measures}','false')",[time]);
 const sub={endpoint:'https://web.push.apple.com/test-device',keys:{p256dh:'A'.repeat(87),auth:'B'.repeat(22)}};
 const register=async(s=sub,tz='UTC')=>db.query("select neo_push_device('register',$1,$2)",[JSON.stringify(s),tz]);
 for(const endpoint of ['https://127.0.0.1/private','https://web.push.apple.com.evil.test/path','https://web.push.apple.com:443/path','https://user@web.push.apple.com/path'])await assert.rejects(register({...sub,endpoint}),/endpoint/);
 await assert.rejects(register(sub,'Unknown\/Place'),/timezone/);await register();
 await assert.rejects(db.query('select neo_push_claim()'),/permission/);await assert.rejects(db.query('select * from neo_private.push_devices'),/permission/);
 await as(db,B);await onboard(db);await assert.rejects(register(),/another account/);await db.query("select neo_push_device('remove',$1,'UTC')",[JSON.stringify(sub)]);
 await db.exec('reset role;set role service_role');let jobs=(await db.query('select neo_push_claim() as d')).rows[0].d;assert.equal(jobs.length,1);const id=jobs[0].id;assert.equal(jobs[0].endpoint,sub.endpoint);assert.equal((await db.query('select neo_push_claim() as d')).rows[0].d.length,0);
 await db.query("select neo_push_finish($1,'sent')",[id]);assert.equal((await db.query('select neo_push_claim() as d')).rows[0].d.length,0);
 await db.exec('reset role');await db.query('delete from neo_private.push_jobs');await as(db,A);await db.exec("select neo_set_consent('health',false)");await db.exec('reset role;set role service_role');assert.equal((await db.query('select neo_push_claim() as d')).rows[0].d.length,0);
 await db.exec('reset role');await db.query('delete from auth.users where id=$1',[A]);assert.equal((await db.query('select * from neo_private.push_devices')).rows.length,0);
 }finally{await db.close()}});
