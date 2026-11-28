// Run with Playwright and Chromium. Every browser request is fulfilled from local files.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium,devices}=require('playwright');

const root=path.resolve(__dirname,'..');
const fixture='/tests/fixtures/shop-public/';
const origin='http://localhost:4173';
const product='11111111-0000-4000-8000-000000000001';
const catalog=[
 {id:product,name:'Caderno pautado',category:'Papelaria',description:'Caderno de 80 folhas usado apenas para testes.',price_cents:1800,active:true,stock:1},
 {id:'11111111-0000-4000-8000-000000000002',name:'Caneca de cerâmica',category:'Casa',description:'Caneca fictícia de 300 ml.',price_cents:3900,active:true,stock:0}
];
const files=new Set([fixture,fixture+'preview.js','/tests/fixtures/shop-public/assets/brands/mercadopago.svg',...['appearance.js','style.css','core.js','shop-core.js','shop.js','shop-public.js','install.js'].map(name=>'/dist/'+name)]);
const type={'.html':'text/html','.css':'text/css','.js':'application/javascript','.svg':'image/svg+xml'};

async function load(page,query){
 await page.route('**/*',route=>{
  const url=new URL(route.request().url());
  if(url.origin!==origin||!files.has(url.pathname))return route.abort();
  const resource=url.pathname===fixture?fixture+'index.html':url.pathname;
  const asset=resource.startsWith(fixture+'assets/')?resource.replace(fixture,'/dist/'):resource;
  const file=path.join(root,asset);
  return route.fulfill({contentType:type[path.extname(file)],body:fs.readFileSync(file)});
 });
 await page.goto(origin+fixture+query);
}

async function styleOf(page,selector){
 return page.locator(selector).first().evaluate(node=>{
  const css=getComputedStyle(node);
  return {width:Math.round(node.getBoundingClientRect().width),display:css.display,background:css.backgroundColor,
   color:css.color,font:css.fontSize,radius:css.borderRadius,gap:css.gap,columns:css.gridTemplateColumns};
 });
}

async function scenario(browser,options,label){
 const context=await browser.newContext(options);
 try{
  const outside=await context.newPage();
  const inside=await context.newPage();
  await load(outside,'?loja=1#loja');
  await load(inside,'');
  await inside.evaluate(async catalog=>{
   const ctx={cloud:true,user:{id:'conta-ficticia'}};
   window.NeoCloud={shop:async(action)=>{
    if(action==='catalog')return {products:catalog,cart:[],settings:{},can_manage:false};
    if(action==='product_detail')return {product:catalog[0]};
    throw Error('RPC inesperada '+action);
   }};
   const mount=document.querySelector('main');
   mount.innerHTML=NeoShop.view(ctx);
   await NeoShop.load(true);
   mount.innerHTML=NeoShop.view(ctx);
  },catalog);
  const compare=async selectors=>{
   for(const selector of selectors)assert.deepEqual(await styleOf(outside,selector),await styleOf(inside,selector),selector);
   for(const page of [outside,inside]){
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true,'horizontal overflow');
   }
  };
  await outside.locator('.shop-product').first().waitFor();
  assert.equal(await outside.locator('.shop-product').count(),2);
  assert.equal(await outside.locator('[data-shop=manage]').count(),0);
  assert.equal(await inside.locator('[data-shop=manage]').count(),0);
  assert.equal(await outside.evaluate(()=>NeoInstall.blocking),false);
  assert.equal(await inside.evaluate(()=>NeoInstall.blocking),true);
  const selector=outside.locator('[data-commercial-theme]');
  for(const theme of ['light','dark','system']){
   await selector.selectOption(theme);
   if(theme==='system'){
    for(const colorScheme of ['dark','light']){
     for(const page of [outside,inside])await page.emulateMedia({colorScheme});
     await outside.waitForFunction(theme=>document.documentElement.dataset.theme===theme,colorScheme);
     await inside.waitForFunction(theme=>document.documentElement.dataset.theme===theme,colorScheme);
     await compare(['.shop-products','.shop-product','.shop-price']);
    }
   }else{
    await inside.evaluate(theme=>NeoAppearance.save(theme),theme);
    assert.equal(await outside.locator('html').getAttribute('data-theme'),theme);
    await compare(['.shop-products','.shop-product','.shop-price']);
   }
  }
  await outside.getByRole('button',{name:'Ver Caderno pautado'}).click();
  await inside.getByRole('button',{name:'Ver Caderno pautado'}).click();
  assert.equal(new URL(outside.url()).searchParams.get('produto'),product);
  for(const theme of ['dark','light']){
   await selector.selectOption(theme);
   await inside.evaluate(theme=>NeoAppearance.save(theme),theme);
   await compare(['.shop-detail','.shop-detail-photo','.shop-price']);
  }
  const captures=process.env.NEOPEP_SCREENSHOTS;
  if(captures){
   for(const [name,page] of [['vitrine',outside],['interna',inside]]){
    await page.screenshot({path:path.join(captures,label+'-'+name+'.png'),animations:'disabled',timeout:10000});
   }
  }
  await outside.getByRole('button',{name:'Simular cadastro comercial'}).click();
  await outside.getByRole('checkbox').check();
  await outside.getByRole('button',{name:'Concluir cadastro fictício'}).click();
  await outside.getByRole('button',{name:'Conhecer o aplicativo'}).click();
  await outside.getByRole('heading',{name:'Prévia da transição'}).waitFor();
  await outside.getByRole('button',{name:'Voltar à loja'}).click();
  await outside.getByRole('heading',{name:'Caderno pautado'}).waitFor();
  assert.equal(await outside.evaluate(()=>NeoInstall.blocking),false);
 }finally{await context.close();}
}

(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',
  args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-zygote']});
 try{
  for(const [label,options] of [['desktop',{viewport:{width:1280,height:800}}],['celular',devices['iPhone 13']]]){
   await scenario(browser,options,label);
   console.log(label+': catálogo, detalhe, temas e transição validados');
  }
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
