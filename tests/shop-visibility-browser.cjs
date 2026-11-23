// Optional Playwright browser test. The SQL contracts are covered separately by shop.test.cjs.
const assert=require('node:assert/strict');
const path=require('node:path');
const {chromium,devices}=require('playwright');
const dist=path.resolve(__dirname,'../dist');

async function scenario(browser,options){
 const page=await browser.newPage(options);
 try{
  await page.route('https://shop.test/',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><main></main>'}));
  await page.goto('https://shop.test/');
  await page.setContent('<meta name="viewport" content="width=device-width,initial-scale=1"><main></main>');
  await page.addStyleTag({path:path.join(dist,'style.css')});
  await page.addScriptTag({path:path.join(dist,'shop-core.js')});
  await page.addScriptTag({content:`
   window.shopCalls=[];
   const member={id:'member',display_name:'Beatriz',avatar_path:null};
   const products=[{id:'original',name:'Produto original',category:'Teste',description:'Descrição',price_cents:100,stock:8,active:true}];
   const lists={original:{mode:'public',blocklist:false,allowlist:false}};
   window.NeoCloud={watchShopVisibility:listener=>{window.signalVisibility=listener;return ()=>{};},shop:async(action,params={})=>{
    shopCalls.push([action,params]);
    if(action==='manage_orders')return [];
    if(action==='catalog')return {products:window.hideProduct?[]:[...products],cart:[],settings:{},can_manage:true,can_manage_orders:true,
     shop_extensions:{member_visibility:true,duplicate_product:true,delete_product:true}};
    if(action==='visibility_members'){
     const item=lists[params.product_id],selected=Boolean(item[item.mode]);
     return {mode:item.mode,selected_count:Number(selected),members:params.search&&!('beatriz@example.test'.includes(params.search))?[]:[{...member,selected}]};
    }
    if(action==='visibility_mode'){lists[params.product_id].mode=params.mode;return {mode:params.mode};}
    if(action==='visibility_set'){lists[params.product_id][params.list]=params.selected;return {selected:params.selected,selected_count:Number(params.selected)};}
    if(action==='duplicate_product'){
     const row={...products[0],id:'copy',active:false,name:'Produto original (Cópia)'};
     lists.copy={...lists.original};products.push(row);return row;
    }
   }};
  `});
  await page.addScriptTag({path:path.join(dist,'shop.js')});
  await page.evaluate(async()=>{
   document.querySelector('main').innerHTML=NeoShop.view({cloud:true,admin:true,user:{id:'operator'}});
   await NeoShop.load(true);
  });
  await page.getByRole('button',{name:'Gerenciar',exact:true}).click();
  const tools=page.locator('.shop-manage-tools');await tools.waitFor();
  assert.deepEqual(await tools.locator('button').evaluateAll(nodes=>nodes.map(node=>node.dataset.shop)),
   ['edit','duplicate_product','delete_product']);
  await page.getByRole('button',{name:'Editar',exact:true}).click();
  const details=page.locator('[data-shop-visibility]'),selector=details.locator('select');
  assert.equal(await details.evaluate(node=>node.open),false);
  assert.equal(await details.locator('summary').textContent(),'›');
  await page.locator('[name=name]').fill('Rascunho ainda não salvo');
  await details.locator('summary').click();
  await page.waitForFunction(()=>!document.querySelector('[data-visibility-mode]').disabled);
  assert.equal(await selector.inputValue(),'public');
  await selector.selectOption('blocklist');
  await details.getByRole('checkbox',{name:'Bloquear Beatriz'}).check();
  await details.getByText('Salvo.',{exact:true}).waitFor();
  await selector.selectOption('allowlist');
  await details.getByRole('checkbox',{name:'Autorizar Beatriz'}).check();
  await details.getByText('Salvo.',{exact:true}).waitFor();
  await selector.selectOption('blocklist');
  await details.getByRole('checkbox',{name:'Bloquear Beatriz'}).waitFor();
  assert.equal(await details.getByRole('checkbox',{name:'Bloquear Beatriz'}).isChecked(),true);
  await details.getByRole('searchbox').fill('beatriz@example.test');
  await details.getByRole('checkbox',{name:'Bloquear Beatriz'}).waitFor();
  assert.equal(await page.locator('[name=name]').inputValue(),'Rascunho ainda não salvo');
  await page.getByRole('button',{name:'Gerenciar',exact:true}).click();
  await page.getByRole('button',{name:'Duplicar produto'}).click();
  await page.locator('[name=name]').waitFor();
  assert.equal(await page.locator('[name=name]').inputValue(),'Produto original (Cópia)');
  assert.equal(await page.locator('[name=active]').isChecked(),false);
  assert.equal(await page.evaluate(()=>shopCalls.filter(([action])=>action==='duplicate_product').length),1);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.evaluate(async()=>{
   NeoShop.session(null);
   document.querySelector('main').innerHTML=NeoShop.view({cloud:true,admin:false,user:{id:'member'}});
   await NeoShop.load(true);
  });
  await page.getByText('Produto original',{exact:true}).first().waitFor();
  await page.evaluate(()=>{window.hideProduct=true;window.signalVisibility();});
  await page.getByText('Produto original',{exact:true}).first().waitFor({state:'hidden'});
 }finally{await page.close();}
}
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  await scenario(browser,{viewport:{width:1280,height:800}});
  await scenario(browser,devices['iPhone 13']);
  console.log('Controles da Loja aprovados no Chromium desktop e iPhone 13 emulado.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
