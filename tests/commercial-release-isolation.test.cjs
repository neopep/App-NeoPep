'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const crypto=require('node:crypto');
const read=path=>fs.readFileSync(path,'utf8');

test('dormant commercial enrollment keeps table private and RPC grants restricted',()=>{
 const sql=read('supabase/migrations/20261128174500_shop_commercial_accounts.sql');
 assert.match(sql,/alter table neo_private\.shop_commercial_accounts enable row level security;/i);
 assert.match(sql,/revoke all on table neo_private\.shop_commercial_accounts from public, anon, authenticated, service_role;/i);
 const grants=[...sql.matchAll(/^grant\s+(.+?);/gims)].map(m=>m[1].replace(/\s+/g,' ').trim());
 assert.deepEqual(grants,['execute on function public.neo_commercial_account(), public.neo_manage_commercial_account(uuid, boolean) to authenticated']);
 assert.match(sql,/revoke all on function public\.neo_commercial_account\(\),\s*public\.neo_manage_commercial_account\(uuid, boolean\) from public, anon, authenticated, service_role;/i);
 assert.match(sql,/where user_id = actor/);
 assert.match(sql,/if actor is null then\s+raise exception/);
 assert.match(sql,/if auth\.uid\(\) is null or public\.neo_admin_access\(\) is not true then\s+raise exception/);
 assert.equal((sql.match(/security definer set search_path = pg_catalog/gi)||[]).length,2);
 assert.doesNotMatch(sql,/\b(?:neo_shop\s*\(|mercadopago|storage\.objects|raw_user_meta_data|user_metadata)\b/i);
});

test('dormant commercial marker rollback refuses to delete registered accounts',()=>{
 const sql=read('release/production/rollback/20261128174500_shop_commercial_accounts.sql');
 const guard=sql.indexOf('if exists (select 1 from neo_private.shop_commercial_accounts)');
 const drop=sql.indexOf('drop function');
 assert.ok(guard>=0&&drop>guard);
 assert.match(sql,/lock table neo_private\.shop_commercial_accounts in access exclusive mode;/);
 assert.match(sql,/if exists \(select 1 from neo_private\.shop_commercial_accounts\) then\s+raise exception/);
 assert.deepEqual([...sql.matchAll(/^drop (?:function|table) (.+?);/gm)].map(m=>m[1]),[
  'public.neo_manage_commercial_account(uuid, boolean)',
  'public.neo_commercial_account()',
  'neo_private.shop_commercial_accounts'
 ]);
});

test('local preview stays disconnected from production and cannot call checkout',()=>{
 const preview=read('dist/shop-public.js');
 const index=read('dist/index.html');
 assert.doesNotMatch(index,/<script[^>]+src=[^>]*shop-public\.js/i);
 assert.match(preview,/const previewHosts=new Set\(\['localhost','127\.0\.0\.1','\[::1\]'\]\)/);
 assert.match(preview,/if\(action==='buy'\|\|action==='add'\)\{\s*message='Compras e alterações de carrinho estão desativadas nesta prévia\.'/);
 assert.doesNotMatch(preview,/\b(?:shopPayment|mercadopago-create|mercadopago-webhook|fetch)\b|\.rpc\s*\(/i);
});

test('payment creation and webhook remain byte-identical to production reference bb92fa8',()=>{
 const expected={
  'supabase/functions/mercadopago-create/index.ts':'5e9fc48cc1f84cb1074ec159ac8d64e7b73bc3f6',
  'supabase/functions/mercadopago-webhook/index.ts':'9886398a06a76d414ad12ff745dc8eef5f1eaea4'
 };
 for(const [path,hash] of Object.entries(expected)){
  const bytes=fs.readFileSync(path);
  const blob=crypto.createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
  assert.equal(blob,hash,path);
 }
});
