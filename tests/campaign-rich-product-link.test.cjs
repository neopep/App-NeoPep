'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const migration=fs.readFileSync(path.join(__dirname,'../release/campaign-rich/20261125083500_product_public_link.sql'),'utf8');

test('WhatsApp product caption contains canonical TEST shop link',()=>{
 assert.ok(migration.includes("E'\\nhttps://teste.app.neopep.com.br/?produto='||(bl->>'ref')||'#loja'"));
 assert.ok(migration.includes("p.id=(bl->>'ref')::uuid"));
 assert.ok(migration.includes("p.active and p.deleted_at is null and p.stock>0"));
 assert.ok(migration.includes("coalesce(vis.mode,'public')='public'"));
});

test('product caption keeps price and photo selection unchanged',()=>{
 assert.ok(migration.includes("(product_row.price_cents/100)::text||','||lpad((product_row.price_cents%100)::text,2,'0')"));
 assert.ok(migration.includes("image_bucket:='neo-shop-products';image_path:=product_row.photo_path;"));
 assert.ok(migration.includes("length(body)>2000"));
});

test('migration does not resend or mutate previously accepted campaigns',()=>{
 assert.match(migration,/CREATE OR REPLACE FUNCTION public\.neo_campaign_rich_admin_v1/);
 assert.doesNotMatch(migration,/\b(?:UPDATE|DELETE FROM|TRUNCATE)\s+neo_private\.campaign_wa_rich_messages\b/i);
 assert.doesNotMatch(migration,/http:\/\//);
});
