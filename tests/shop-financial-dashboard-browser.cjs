const assert = require('node:assert/strict');
const path = require('node:path');
const {chromium, devices} = require('playwright');
const dist = path.resolve(__dirname, '../dist');

async function run(browser, options, dark) {
  const page = await browser.newPage(options);
  try {
    await page.route('https://shop.test/', route => route.fulfill({
      contentType:'text/html', body:`<!doctype html><html data-theme="${dark?'dark':'light'}"><meta name="viewport" content="width=device-width,initial-scale=1"><main id="app"></main></html>`
    }));
    await page.goto('https://shop.test/');
    await page.addStyleTag({path:path.join(dist,'style.css')});
    await page.addScriptTag({path:path.join(dist,'shop-core.js')});
    await page.addScriptTag({content:`
      window.admin=true; window.denied=false; window.requests=[];
      window.NeoCloud={
        shop: async action=>action==='catalog'?{
          can_manage:window.admin, cart:[], settings:{}, products:[
            {id:'example',name:'Produto A',category:'Categoria A',price_cents:100,stock:3,active:true}
          ]
        }:[],
        shopFinancial: async filters=>{
          window.requests.push(filters);
          if(window.denied)throw Object.assign(new Error('denied'),{code:window.denied});
          return {
            from:'2026-01-01',to:'2026-01-25',page:filters.page,detail_pages:2,
            sales:{orders:25,units:26,covered_units:1,gross_cents:'2500',discount_cents:'103',
              commercial_cents:'2397',shipping_cents:'100',known_cmv_cents:'0',profit_cents:null,margin_percent:null},
            states:[{environment:'test',status:'test_paid',orders:1},{environment:'production',status:'partially_refunded',orders:1}],
            stock:{units:3,alert_count:1,alerts:[{name:'Produto A',stock:3}]},
            details:[{key:'g',label:filters.page===1?'Grupo inicial':'Último grupo',commercial_cents:'2397',orders:25,units:26}]
          };
        }
      };
      window.openShop=async id=>{
        document.querySelector('main').innerHTML=NeoShop.view({cloud:true,user:{id}});
        await NeoShop.load(true);
      };`});
    await page.addScriptTag({path:path.join(dist,'shop.js')});
    await page.evaluate(() => openShop('admin'));
    await page.getByRole('button',{name:'Gerenciar',exact:true}).click();
    const panel=page.locator('[data-shop-financial]');
    assert.equal(await page.evaluate(() => requests.length),0);
    await panel.locator('summary').focus();
    await page.keyboard.press('Enter');
    await panel.getByText('Indicadores atualizados.').waitFor();
    assert.match(await panel.textContent(),/R\$ 23,97/);
    assert.match(await panel.textContent(),/CMV conhecidoR\$ 0,00/);
    assert.match(await panel.textContent(),/Lucro bruto estimadoIndisponível/);
    await panel.getByText('Real · Reembolso parcial · 1').waitFor();
    await panel.getByRole('button',{name:'Próxima'}).click();
    await panel.getByText('Último grupo').waitFor();
    await panel.locator('[name=category]').selectOption('Categoria A');
    await panel.locator('[name=group_by]').selectOption('product');
    await panel.getByRole('button',{name:'Aplicar filtros'}).click();
    await panel.getByText('Grupo inicial').waitFor();
    assert.equal(await page.evaluate(() => requests.at(-1).category),'Categoria A');
    assert.equal(await page.evaluate(() => requests.at(-1).group_by),'product');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),true);
    await page.evaluate(async () => {window.denied='42501'; await openShop('moderator');});
    await page.getByRole('button',{name:'Gerenciar',exact:true}).click();
    await panel.locator('summary').click();
    await panel.waitFor({state:'hidden'});
    assert.doesNotMatch(await page.locator('main').textContent(),/R\$ 23,97/);
    await page.evaluate(async () => {window.admin=false; await openShop('member');});
    assert.equal(await panel.count(),0);
  } finally {
    await page.close();
  }
}
(async()=>{
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
  try{
    await run(browser,{viewport:{width:1280,height:800}},false);
    await run(browser,devices['iPhone 13'],true);
    await run(browser,devices['Pixel 7'],false);
    console.log('OK: dashboard desktop light, iPhone 13 dark, Pixel 7 light');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
