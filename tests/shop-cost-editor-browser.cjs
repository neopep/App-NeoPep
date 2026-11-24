// Requires Playwright and a local Chromium binary. All RPCs are mocked.
const assert = require('node:assert/strict');
const path = require('node:path');
const {chromium, devices} = require('playwright');
const dist = path.resolve(__dirname, '../dist');

async function scenario(browser, options) {
  const page = await browser.newPage(options);
  try {
    await page.route('https://shop.test/', route => route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><main></main>'
    }));
    await page.goto('https://shop.test/');
    await page.addStyleTag({path: path.join(dist, 'style.css')});
    await page.addScriptTag({path: path.join(dist, 'shop-core.js')});
    await page.addScriptTag({content:`
      window.admin = true;
      window.writes = [];
      window.stock = 3;
      window.items = [];
      window.replayed = false;
      const item = {id:'fixture', name:'Produto de teste', stock:3, price_cents:1000,
        description:'Descrição', category:'Teste', active:true};
      window.NeoCloud = {
        shop: async action => action === 'catalog'
          ? {products:[{...item, stock:window.stock}], cart:[], settings:{}, can_manage:window.admin,
            promotions_ready:true, shop_extensions:{gallery:true}}
          : [],
        shopFinancial: async () => ({
          from:'2026-01-01',to:'2026-01-31',page:1,detail_pages:0,
          sales:{orders:1,units:2,covered_units:0,gross_cents:'100',discount_cents:'0',
            commercial_cents:'100',shipping_cents:'0',known_cmv_cents:null,profit_cents:null,margin_percent:null},
          stock:{units:window.stock,alert_count:1,alerts:[{name:item.name,stock:window.stock}]},
          states:[],details:[]
        }),
        shopCosts: async (action,payload) => {
          if (action === 'register') {
            window.writes.push(payload);
            if (window.writes.length === 1) throw Error('offline');
            if (!window.replayed) {
              window.replayed = true;
              window.stock += Number(payload.quantity);
              window.items.push({...payload, brl_unit:'5.125',brl_total:'10.25',id:'record'});
            }
          }
          return {stock:window.stock,revision:window.items[0]?.id ?? null,history:window.items};
        }
      };
      window.openShop=async id=>{
        document.querySelector('main').innerHTML = NeoShop.view({cloud:true,user:{id}});
        await NeoShop.load(true);
      };`});
    await page.addScriptTag({path: path.join(dist, 'shop.js')});
    await page.evaluate(() => openShop('admin'));
    await page.getByRole('button', {name:'Gerenciar', exact:true}).click();
    await page.locator('[data-shop=edit]').click();
    const editor = page.locator('[data-shop-cost]');
    await editor.locator('summary').focus();
    await page.keyboard.press('Enter');
    await editor.getByText('Custo não informado.').waitFor();
    await editor.getByLabel('Tipo de lançamento').selectOption('acquisition');
    await editor.getByLabel('Moeda').selectOption('USD');
    await editor.getByLabel('Custo unitário').fill('1,00');
    await editor.getByLabel('Quantidade de referência ou adquirida').fill('2');
    await editor.getByLabel('Data de referência ou aquisição').fill('2026-01-01');
    await editor.getByLabel('Reais por dólar').fill('5,125');
    await editor.getByLabel('Fonte do câmbio').fill('Registro de teste');
    await editor.getByLabel('Data do câmbio').fill('2026-01-01');
    assert.match(await editor.locator('output').textContent(), /R\$ 5,125 por unidade · R\$ 10,25 total/);
    const stock = page.getByLabel('Estoque disponível');
    await stock.fill('2');
    await editor.getByRole('button',{name:'Registrar lançamento'}).click();
    await editor.getByText(/Resolva a alteração de estoque/).waitFor();
    assert.equal(await page.evaluate(() => writes.length), 0);
    await stock.fill('3');
    await editor.getByRole('button',{name:'Registrar lançamento'}).click();
    await editor.getByText(/Não foi possível confirmar/).waitFor();
    await editor.getByRole('button',{name:'Repetir envio'}).click();
    await editor.getByText('Lançamento registrado.').waitFor();
    assert.equal(await stock.inputValue(), '5');
    assert.match(await editor.locator('li').textContent(), /Registro de teste/);
    const writes = await page.evaluate(() => window.writes);
    assert.deepEqual(writes[0], writes[1]);
    assert.equal(writes[1].unit_cost, '1.00');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.locator('[data-shop="manage"]').first().click();
    const panel=page.locator('[data-shop-financial]');
    await panel.locator('summary').click();
    await panel.getByText('Indicadores atualizados.').waitFor();
    assert.match(await panel.textContent(),/Estoque disponível hoje5/);
    assert.match(await panel.textContent(),/Lucro bruto estimadoIndisponível/);
    await page.evaluate(async () => {window.admin = false; await openShop('member');});
    assert.equal(await page.locator('[data-shop-cost]').count(), 0);
    assert.equal(await page.getByRole('button',{name:'Gerenciar',exact:true}).count(), 0);
    assert.doesNotMatch(await page.locator('main').textContent(), /Registro de teste/);
  } finally {
    await page.close();
  }
}

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox']
  });
  try {
    for (const options of [{viewport:{width:1280,height:800}},devices['iPhone 13'],devices['Pixel 7']]) {
      await scenario(browser, options);
    }
    console.log('OK: desktop, iPhone 13 and Pixel 7 emulation');
  } finally {
    await browser.close();
  }
})().catch(err => { console.error(err); process.exitCode = 1; });
