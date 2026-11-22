const { PGlite }=require('@electric-sql/pglite');
const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{
 const db=new PGlite();
 try {
  await db.exec(`create role anon; create role authenticated; create role service_role;
   create schema neo_private; create schema storage;
   create table storage.buckets(id text primary key,name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
   create table neo_private.example (id int primary key, data text default 'value');
   alter table neo_private.example enable row level security;
   create policy read_example on neo_private.example for select to authenticated using(id>1);
   create function public.neo_example() returns text language sql security definer as 'select ''fixture secret''::text';`);
  const sql=fs.readFileSync('release/production/catalog.sql','utf8').split('select (to_regclass')[0].replace(/^\\set.*$/m,'');
  const results=await db.exec(sql);
  const rows=results.at(-1).rows.map(row=>Object.values(row)[0]);
  assert.ok(rows.some(r=>r.kind==='policy'&&r.id==='neo_private.example.read_example'));
  assert.ok(rows.some(r=>r.kind==='routine'&&r.id==='public.neo_example()'&&r.definition.definer));
  assert.ok(!JSON.stringify(rows).includes('fixture secret'));
  await db.exec('rollback');
  const bucketSql=fs.readFileSync('release/production/private-buckets.sql','utf8').split('begin;').at(-1);
  await db.exec('begin;'+bucketSql);
  await db.exec('begin;'+bucketSql);
  assert.equal((await db.query('select count(*)::int as n from storage.buckets where not public')).rows[0].n,2);
  await db.exec("update storage.buckets set public=true where id='neo-campaign-images'");
  await assert.rejects(db.exec('begin;'+bucketSql),/Configuração divergente/);
  await db.exec('rollback');
  console.log('Inventário protegido e provisionamento idempotente de buckets verificados em PGlite.');
 } finally {await db.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1});
