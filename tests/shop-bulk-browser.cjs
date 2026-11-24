const assert=require('node:assert/strict');
const path=require('node:path');
const {chromium,devices}=require('playwright');
const dist=path.resolve(__dirname,'../dist');

async function scenario(browser,options,dark){
 const page=await browser.newPage(options);
 try{
  await page.route('https://shop.test/',route=>route.fulfill({
   contentType:'text/html',body:`<!doctype html><html data-theme="${dark?'dark':'light'}"><meta name="viewport" content="width=device-width,initial-scale=1"><main id="app"></main></html>`
  }));
  await page.goto('https://shop.test/');
  await page.addStyleTag({path:path.join(dist,'style.css')});
  await page.addScriptTag({path:path.join(dist,'shop-core.js')});
  await page.addScriptTag({content:`
   window.admin=true;window.calls=[];window.changed=false;
   const id=i=>'00000000-0000-0000-0000-'+String(i).padStart(12,'0');
   const item=i=>({id:id(i),name:'Produto '+i,category:'Acessórios',price_cents:window.changed?1200:1000,stock:window.changed?2:3,active:true,visibility:'allowlist'});
   window.confirm=()=>true;
   const result={id:'batch',status:'preview',rows:[{...item(21),next_price_cents:1200,next_stock:2,price_percent:20}]};
   window.NeoCloud={
    shop:async action=>action==='catalog'?{can_manage:window.admin,cart:[],settings:{},products:[item(1)]}:[],
    shopBulk:async (action,input)=>{
     window.calls.push([action,input]);
     if(action==='list'){
      const filtered=input.filters?.query?[21]:Array.from({length:21},(_,i)=>i+1);
      return {rows:filtered.slice((input.page-1)*20,input.page*20).map(item),
       page:input.page,total:filtered.length,categories:['Acessórios']};
     }
     if(action==='preview')return result;
     if(action==='apply'){window.changed=true;return {...result,status:'applied'};}
     if(action==='history')return [{id:'batch',reason:'Inventário sintético',applied_at:'2026-01-01',item_count:1}];
     if(action==='get')return {id:'batch',actor_id:'admin',lines:result.rows};
     throw Error('Unexpected RPC '+action);
    }
   };
   window.openShop=async uid=>{
    document.querySelector('main').innerHTML=NeoShop.view({cloud:true,user:{id:uid}});
    await NeoShop.load(true);
   };`});
  await page.addScriptTag({path:path.join(dist,'shop.js')});
  await page.evaluate(()=>openShop('admin'));
  await page.getByRole('button',{name:'Gerenciar',exact:true}).click();
  await page.getByRole('button',{name:'Gerenciamento em massa',exact:true}).click();
  const panel=page.locator('[data-bulk]');
  await panel.getByText('0 selecionado(s) de 21 resultado(s).').waitFor();
  await panel.getByRole('button',{name:'Selecionar página'}).click();
  await panel.getByText('20 selecionado(s) de 21 resultado(s).').waitFor();
  await panel.getByRole('button',{name:'Selecionar todos os resultados'}).click();
  await panel.getByText(/21 selecionado\(s\) de 21/).waitFor();
  await panel.getByRole('button',{name:'Próxima'}).click();
  await panel.getByText('Página 2 de 2').waitFor();
  await panel.getByRole('button',{name:'Ambos',exact:true}).click();
  await panel.getByLabel('Novo preço').fill('12,00');
  await panel.getByLabel('Novo estoque').fill('2');
  await panel.getByLabel('Motivo do lote').fill('Inventário sintético');
  await panel.getByRole('button',{name:'Gerar prévia'}).click();
  await panel.getByText('Prévia pronta para confirmação').waitFor();
  const input=await page.evaluate(()=>calls.find(([action])=>action==='preview')[1]);
  assert.equal(input.selection.kind,'all');assert.equal(input.selection.count,21);
  assert.deepEqual(Object.values(input.overrides),[{price_cents:1200,stock:'2'}]);
  await panel.getByRole('button',{name:'Confirmar lote'}).click();
  await panel.getByText('Lote aplicado').waitFor();
  await panel.getByText(/R\$.*12,00 · 2 un\./).waitFor();
  assert.equal(await panel.getByRole('button',{name:'Desfazer preços'}).count(),0);
  await panel.getByText('Histórico de lotes').click();
  await panel.getByRole('button',{name:/Inventário sintético/}).click();
  await panel.getByText('Lote aplicado').waitFor();
  await panel.getByLabel('Nome ou identificador').fill('Produto 21');
  await panel.getByRole('button',{name:'Buscar',exact:true}).click();
  await panel.getByText('0 selecionado(s) de 1 resultado(s).').waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.evaluate(async()=>{window.admin=false;await openShop('member');});
  assert.equal(await panel.count(),0);
  assert.equal(await page.getByRole('button',{name:'Gerenciamento em massa'}).count(),0);
 }finally{await page.close();}
}

(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  await scenario(browser,{viewport:{width:1280,height:800}},false);
  await scenario(browser,devices['iPhone 13'],true);
  await scenario(browser,devices['Pixel 7'],false);
  console.log('OK: edição em massa desktop, iPhone 13 e Pixel 7 emulados');
 }finally{await browser.close();}
})().catch(err=>{console.error(err);process.exitCode=1;});
