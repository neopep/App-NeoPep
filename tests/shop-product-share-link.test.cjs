'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const shop=fs.readFileSync(require('node:path').join(__dirname,'../dist/shop.js'),'utf8'),app=fs.readFileSync(require('node:path').join(__dirname,'../src/app.js'),'utf8');
test('copy full canonical product link for each environment',()=>{
 const fn=shop.match(/function productShareURL\(id\)\{[^}]+\}/)[0];
 const id='12345678-1234-1234-1234-123456789abc';
 for(const hostname of ['app.neopep.com.br','teste.app.neopep.com.br']){
  const url=vm.runInNewContext(fn+'; productShareURL(id)',{id,encodeURIComponent,location:{hostname}});
  assert.equal(url,'https://'+hostname+'/?produto='+id+'#loja');
 }
 assert.ok(shop.includes('productLinkButton(p)'));
 assert.ok(shop.includes('productLinkButton(product)'));
 assert.ok(shop.includes('navigator.clipboard.writeText(url)'));
});
test('shared product destination persists through login and uses existing authorized detail flow',()=>{const code=app.match(/function pendingShopProduct\(\)\{[^\n]+\}/)[0],id='12345678-1234-1234-1234-123456789abc',store=new Map();const ctx={URL,location:{href:'https://app.neopep.com.br/?produto='+id+'#loja'},validSharedMaterial:v=>/^[a-f0-9-]{36}$/i.test(v||''),sessionStorage:{setItem:(k,v)=>store.set(k,v),getItem:k=>store.get(k)}};assert.equal(vm.runInNewContext(code+';pendingShopProduct()',ctx),id);ctx.location.href='https://app.neopep.com.br/';assert.equal(vm.runInNewContext(code+';pendingShopProduct()',ctx),id);assert.ok(app.includes("window.NeoShop?.openCampaignProduct?.(product,Cloud.user);await go('loja')"));assert.ok(app.includes("url.searchParams.delete('produto')"));});
