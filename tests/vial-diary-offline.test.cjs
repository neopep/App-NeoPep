// Offline regression for the diary contract, using ONLY synthetic identities and records.
// The fixture is intentionally minimal; this is not a live Supabase integration test.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
const sql=fs.readFileSync('release/pacote-final-20261125/vial_diary_cloud_candidate.sql','utf8');
const A='00000000-0000-4000-8000-000000000001';
const B='00000000-0000-4000-8000-000000000002';
const C='00000000-0000-4000-8000-000000000003';
test('diário SQL: isolamento, consentimento, repetição, saldo e revisão (fixture offline)',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`
   create role anon; create role authenticated;
   create schema auth; create schema neo_private;
   create table auth.users(id uuid primary key);
   create function auth.uid() returns uuid language sql stable as
     $$select nullif(current_setting('fixture.actor',true),'')::uuid$$;
   create table public.neo_profiles(user_id uuid primary key references auth.users);
   create table public.neo_records(user_id uuid not null references auth.users,kind text not null,id text not null,
     data jsonb not null,revision integer not null default 1,primary key(user_id,kind,id));
   create function public.fixture_revision() returns trigger language plpgsql as
     $$begin new.revision:=old.revision+1;return new;end;$$;
   create trigger fixture_revision before update on public.neo_records for each row execute function public.fixture_revision();
   create function public.neo_has_consent(p_purpose text) returns boolean language sql stable as
     $$select auth.uid() in ('${A}'::uuid,'${B}'::uuid) and p_purpose in ('health','terms')$$;
   create function public.neo_number(d jsonb,k text,lo numeric,hi numeric,optional boolean default false) returns boolean
     language sql immutable as $$select case when jsonb_typeof(d->k)='number' then (d->>k)::numeric between lo and hi else optional end$$;
   create function public.neo_valid_record(k text,rid text,d jsonb) returns boolean language sql immutable as
     $$select coalesce(k='doses' and rid=d->>'id' and jsonb_typeof(d->'product')='string'
       and d->>'unit' in ('mg','mcg','mL') and public.neo_number(d,'amount',0.000001,1000000),false)$$;
   insert into auth.users values ('${A}'),('${B}'),('${C}');
   insert into public.neo_profiles values ('${A}'),('${B}'),('${C}');
  `);
  await db.exec(sql);
  const actor=async id=>{await db.exec('reset role');await db.query("select set_config('fixture.actor',$1,false)",[id]);await db.exec('set role authenticated');};
  const rpc=async(action,data={})=>(await db.query('select public.neo_vial_diary($1,$2::jsonb) as result',[action,JSON.stringify(data)])).rows[0].result;
  const vial={id:'v1',product:'Fixture A',mass:10,volume:2,dose:null,unit:null};
  const add={vial,expected_active:null};
  await actor(A);
  assert.deepEqual(await rpc('read'),{items:[],links:{},active:null});
  const first=await rpc('add',add);assert.equal(first.active,'v1');
  assert.deepEqual(await rpc('add',add),first);
  await assert.rejects(rpc('add',{vial:{...vial,mass:11},expected_active:null}),/vial_request_conflict/);
  await assert.rejects(rpc('add',{vial:{...vial,id:'v2'},expected_active:null}),/vial_active_changed/);
  const record={id:'r1',product:'Fixture A',unit:'mg',amount:2};
  const request={record,revision:null,vial_id:'v1'};
  const saved=await rpc('put_dose',request);assert.equal(saved.revision,1);assert.equal(saved.diary.links.r1,'v1');
  assert.deepEqual(await rpc('put_dose',request),saved);
  await assert.rejects(rpc('put_dose',{...request,record:{...record,amount:3},revision:99}),/vial_dose_revision_changed/);
  await assert.rejects(rpc('put_dose',{...request,record:{...record,id:'r2',amount:9}}),/vial_balance_insufficient/);
  await assert.rejects(rpc('put_dose',{...request,record:{...record,id:'r2',product:'Fixture B'}}),/vial_product_mismatch/);
  const updated=await rpc('put_dose',{...request,record:{...record,amount:3},revision:1});assert.equal(updated.revision,2);
  await actor(B);assert.deepEqual(await rpc('read'),{items:[],links:{},active:null});
  await assert.rejects(rpc('put_dose',request),/vial_active_changed/);
  await actor(C);await assert.rejects(rpc('add',add),/vial_consent_required/);
  await db.exec('reset role');
  const grants=(await db.query("select has_function_privilege('anon','public.neo_vial_diary(text,jsonb)','execute') anon_rpc,has_table_privilege('authenticated','neo_private.vial_diary','select') direct_read,has_table_privilege('authenticated','neo_private.vial_diary_links','insert') direct_write")).rows[0];
  assert.deepEqual(grants,{anon_rpc:false,direct_read:false,direct_write:false});
  await db.exec("delete from public.neo_records where user_id='"+A+"' and id='r1'");
  await actor(A);assert.deepEqual((await rpc('read')).links,{});
 }finally{await db.close();}
});
