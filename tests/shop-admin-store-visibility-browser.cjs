// Regression: administrator sees restricted products only in Gerenciar, never in the store.
// Run with: node tests/shop-admin-store-visibility-browser.cjs (Playwright + Chromium)
const assert=require('node:assert/strict');
const path=require('node:path');
const {chromium,devices}=require('playwright');
const dist=path.resolve(__dirname,'../dist');
async function scenario(browser,options){
 const page=await browser.newPage(options);
 try{
  await page.route('https://shop.test/',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><main></main>'}));
  await page.goto('https://shop.test/');
  await page.setContent('<meta name="viewport" content="width=device-width, initial-scale=1"><main></main>');
  await page.addScriptTag({path:path.join(dist,'shop-core.js')});
  await page.addScriptTag({content:`
   window.unhideAdmin=false;
   const hidden={id:'secret',name:'Exclusivo',description:'Produto só para selecionados',category:'Privado',price_cents:3000,stock:5,active:true};
   const normal={id:'public',name:'Visível',description:'Produto comum',category:'Público',price_cents:2000,stock:10,active:true};
   window.NeoCloud={shop:async(action)=>{
    if(action==='catalog')return {products:[{...hidden,shop_store_hidden:!window.unhideAdmin},{...normal,shop_store_hidden:false}],cart:[],settings:{},can_manage:true,can_manage_orders:true,shop_extensions:{member_visibility:true,duplicate_product:true}};
    if(action==='manage_orders')return [];
    if(action==='featured')return {products:[normal]};
    throw Error('Unexpected RPC: '+action);
   }};
  `});
  await page.addScriptTag({path:path.join(dist,'shop.js')});
  await page.evaluate(async()=>{
   document.querySelector('main').innerHTML=NeoShop.view({cloud:true,admin:true,user:{id:'admin'}});
   await NeoShop.load(true);
  });
  assert.equal(await page.locator('.shop-products').getByText('Exclusivo',{exact:true}).count(),0,'hidden admin item leaked into storefront');
  assert.equal(await page.locator('.shop-products').getByText('Visível',{exact:true}).count(),1);
  assert.equal(await page.locator('.shop-categories').getByText('Privado',{exact:true}).count(),0);
  await page.getByRole('button',{name:'Gerenciar',exact:true}).click();
  assert.equal(await page.locator('.shop-manage-list').getByText('Exclusivo',{exact:true}).count(),1,'hidden admin item absent from Gerenciar');
  await page.evaluate(async()=>{
   window.unhideAdmin=true;
   await NeoShop.load(true);
  });
  await page.getByRole('button',{name:'‹ Voltar'}).click();
  assert.equal(await page.locator('.shop-products').getByText('Exclusivo',{exact:true}).count(),1,'explicitly allowed admin cannot view item');
 }finally{await page.close();}
}
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try{await scenario(browser,{viewport:{width:1280,height:800}});await scenario(browser,devices['iPhone 13']);console.log('Admin storefront visibility passed for desktop and iPhone 13');}
 finally{await browser.close();}
})().catch(err=>{console.error(err);process.exitCode=1;});
