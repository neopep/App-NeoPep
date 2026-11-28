'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
const id='11111111-0000-4000-8000-000000000001',member='22222222-0000-4000-8000-000000000001';
const setup=`
create role anon; create role authenticated; create role service_role;
create schema neo_private; create schema auth; create schema storage;
revoke all on schema neo_private from public,anon,authenticated;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('fixture.uid',true),'')::uuid $$;
create function public.neo_admin_access() returns boolean language sql stable as $$ select coalesce(current_setting('fixture.admin',true)='yes',false) $$;
create table neo_private.shop_products(id uuid primary key,name text,description text,category text,price_cents integer,stock integer,active boolean,photo_path text,photo_paths text[],created_at timestamptz,updated_at timestamptz,featured boolean,payment_name text,deleted_at timestamptz);
create table neo_private.shop_product_visibility(product_id uuid primary key,mode text);
create table neo_private.shop_product_visibility_members(product_id uuid,user_id uuid,list text);
create table neo_private.shop_acquisitions(id uuid,product_id uuid,quantity integer,currency text,unit_cost_minor bigint,fx_rate_id uuid,acquired_at timestamptz,recorded_at timestamptz,entry_kind text);
create table neo_private.shop_acquisition_costs(id uuid,product_id uuid,quantity integer,currency text,unit_cost_minor bigint,fx_rate_id uuid,acquired_at timestamptz,recorded_at timestamptz,unit_cost_brl_cents bigint);
create table neo_private.shop_fx_rates(id uuid,brl_per_usd numeric,quoted_at timestamptz,source text,recorded_at timestamptz);
create table neo_private.shop_promotions(id uuid,name text,code text,active boolean,kind text,value numeric,min_quantity integer,min_subtotal_cents integer,product_ids uuid[],payment_method text,stackable boolean,max_discount_cents integer,starts_at timestamptz,ends_at timestamptz,max_uses integer,per_user_limit integer,source text,referrer_user_id uuid,restricted_user_id uuid,restricted_to_user boolean,created_at timestamptz,updated_at timestamptz,deleted_at timestamptz);
create table neo_private.shop_settings(singleton boolean,discount_mode text);
create table storage.objects(id uuid,bucket_id text,name text,version text,updated_at timestamptz,metadata jsonb);
insert into neo_private.shop_products values ('${id}','Caderno fictício','','Papelaria',1000,2,false,'fixture/image.jpg',array['fixture/image.jpg'],now(),now(),true,'Caderno',null);
insert into neo_private.shop_product_visibility values ('${id}','allowlist');
insert into neo_private.shop_product_visibility_members values ('${id}','${member}','blocklist'),('${id}','${member}','allowlist');
insert into neo_private.shop_settings values (true,'best');
insert into storage.objects values ('${member}','neo-shop-products','fixture/image.jpg','fixture-version',now(),'{"size":4}');
`;
test('catalog SQL snapshot is admin-only, reads complete rules and has no private-schema grant',async()=>{
 const db=new PGlite();
 try{
  await db.exec(setup);
  await db.exec(fs.readFileSync('release/private-catalog-backup-v2/candidate.sql','utf8'));
  const privilege=await db.query("select has_schema_privilege('authenticated','neo_private','USAGE') as schema_access,has_function_privilege('anon','public.neo_shop_catalog_backup_v2()','EXECUTE') as anon_execute");
  assert.deepEqual(privilege.rows,[{schema_access:false,anon_execute:false}]);
  await db.exec("set role authenticated; set fixture.admin='no'; set fixture.uid='"+member+"';");
  await assert.rejects(()=>db.query('select public.neo_shop_catalog_backup_v2()'),/Autorização administrativa/);
  await db.exec("set fixture.admin='yes';");
  const {rows:[{snapshot}]}=await db.query('select public.neo_shop_catalog_backup_v2() as snapshot');
  assert.equal(snapshot.records.length,1);
  assert.equal(snapshot.records[0].featured,true);
  assert.equal(snapshot.records[0].active,false);
  assert.equal(snapshot.visibility_rules[0].mode,'allowlist');
  assert.equal(snapshot.visibility_members.length,2);
  assert.equal(snapshot.files[0].exists,true);
  assert.equal(snapshot.files[0].size,'4');
  assert.equal(snapshot.discount_mode,'best');
  await db.exec("reset role; delete from storage.objects; set role authenticated;");
  const missing=await db.query('select public.neo_shop_catalog_backup_v2() as snapshot');
  assert.equal(missing.rows[0].snapshot.files[0].exists,false);
 }finally{await db.close();}
});
