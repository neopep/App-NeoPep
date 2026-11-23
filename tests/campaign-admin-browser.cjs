// Optional browser regression. Requires Playwright and Chromium.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');

const campaignId = '10000000-0000-4000-8000-000000000001';
const connectionId = '20000000-0000-4000-8000-000000000001';
const groupId = connectionId + ':123@g.us';
const base = path.resolve(__dirname, '../dist');
const mockCloud = `(() => {
 const rows=[], recipients=[];
 const online=new Date().toISOString();
 const group={id:${JSON.stringify(groupId)},name:'Equipe sincronizada',connection:'Conexão A',state:'eligible',participant_count:24,last_synced_at:online};
 const disabled={...group,id:group.id.replace('123','456'),name:'Grupo desconectado',state:'disconnected'};
 const connection={id:${JSON.stringify(connectionId)},label:'Conexão A',status:'connected',last_synced_at:online,group_count:2};
 const user={id:'operator'};
 window.NeoCloud={configured:true,user,connectTestEnabled:true,init:async()=>user,adminSummary:async()=>({}),
  campaignAdmin:async(action)=>action==='list'?rows:[],
  campaignWhatsApp:async(action)=>action==='prepare'?{title:'Campanha nova',message:'Exemplo'}:[],
  campaignWhatsAppSync:async(action,id,data)=>{
   if(action==='catalog')return [group,disabled];
   if(action==='recipients')return recipients.slice();
   if(action==='save'){
    const row={...data,id:${JSON.stringify(campaignId)},status:'draft'};
    rows.splice(0,rows.length,row);
    recipients.splice(0,recipients.length,...data.recipients.map(()=>group));
    return row;
   }
   if(action==='schedule'){window.scheduled=data.recipients;return {saved:true};}
  },
  connectWaConnections:async()=>[connection],
  connectWaGroups:async()=>[{display_name:group.name,participant_count:group.participant_count,updated_at:online}],
  connectAdmin:async()=>({paused:true,devices:[{id:'pc',label:'Computador A',state:'approved',version:'0.2.6',last_seen:online}],
   accounts:[{id:'sim',identity:'fixture-simulada',enabled:true}],sessions:[],groups:[],tasks:[],audit:[],releases:[]})
 };
})();`;
const formats = { '.css':'text/css', '.js':'text/javascript', '.html':'text/html' };

async function run(browser, viewport, theme) {
 const page = await browser.newPage({viewport,isMobile:viewport.width<600,hasTouch:viewport.width<600});
 const errors = [];
 page.on('pageerror', error => errors.push(error.message));
 await page.addInitScript(value => localStorage.setItem('neo_theme',value), theme);
 await page.route('**/*', async route => {
  const url = new URL(route.request().url());
  if(url.hostname!=='neopep.invalid')return route.abort();
  if(url.pathname==='/cloud.js')return route.fulfill({contentType:'text/javascript',body:mockCloud});
  const file = path.join(base, url.pathname.endsWith('/')?url.pathname+'index.html':url.pathname);
  try {return await route.fulfill({body:await fs.readFile(file),contentType:formats[path.extname(file)]});}
  catch {return route.fulfill({status:404,body:''});}
 });
 await page.goto('http://neopep.invalid/admin/?admin=campaigns');
 await page.evaluate(value=>document.documentElement.dataset.theme=value,theme);
 await page.getByRole('tab',{name:'Resultados'}).click();
 await page.getByRole('heading',{name:'Resultados do App'}).waitFor();
 await page.getByRole('tab',{name:'Públicos e planos'}).click();
 await page.getByRole('button',{name:'WhatsApp',exact:true}).first().click();
 await page.getByRole('tab',{name:'Grupos',exact:true}).click();
 await page.getByText('Equipe sincronizada',{exact:true}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Novo grupo'}).count(),0);
 await page.getByRole('tab',{name:'NeoPep Connect',exact:true}).click();
 await page.getByText('Computador A',{exact:false}).first().waitFor();
 await page.getByText('Equipe sincronizada',{exact:false}).first().waitFor();
 assert.equal(await page.getByText('fixture-simulada',{exact:false}).count() > 0,true);
 for(const name of ['Computadores','Atualizações','Contas','Vínculos','Simulação','Histórico','Ajuda','Visão geral']){
  const tab=page.getByRole('tab',{name,exact:true});
  await tab.click();
  assert.equal(await tab.getAttribute('aria-selected'),'true');
  const id=await tab.getAttribute('aria-controls');
  assert.equal(await page.locator('#'+id).isVisible(),true);
  assert.equal(await page.locator('[data-connect-pane]:visible').count(),1);
 }
 await page.getByRole('tab',{name:'Visão geral',exact:true}).press('End');
 assert.equal(await page.getByRole('tab',{name:'Ajuda',exact:true}).getAttribute('aria-selected'),'true');
 await page.getByRole('tab',{name:'Campanhas',exact:true}).click();
 await page.getByRole('button',{name:'Nova campanha',exact:true}).click();
 const editor=page.getByRole('dialog',{name:'Nova campanha'});
 await editor.locator('[name=title]').fill('Campanha nova');
 await editor.locator('[name=body]').fill('Texto do teste');
 page.once('dialog',dialog=>dialog.dismiss());
 await editor.getByRole('button',{name:'Fechar edição da campanha'}).click();
 assert.equal(await editor.locator('[name=title]').inputValue(),'Campanha nova');
 await editor.getByRole('button',{name:'Canais',exact:true}).click();
 await editor.getByLabel('Equipe sincronizada',{exact:false}).check();
 assert.equal(await editor.getByLabel('Grupo desconectado',{exact:false}).isDisabled(),true);
 const dimensions=await editor.boundingBox();
 assert.ok(dimensions.width<=viewport.width+1&&dimensions.height>viewport.height-4);
 await editor.locator('[type=submit]').click();
 await page.getByText('Alteração confirmada.',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Abrir',exact:true}).click();
 const edit=page.getByRole('dialog',{name:'Editar campanha'});
 await edit.getByRole('button',{name:'WhatsApp',exact:true}).click();
 assert.equal(await edit.getByLabel('Equipe sincronizada',{exact:false}).isChecked(),true);
 await edit.getByRole('button',{name:'Fechar edição da campanha'}).click();
 await page.getByRole('tab',{name:'Publicações',exact:true}).click();
 await page.getByRole('button',{name:'Nova divulgação',exact:true}).click();
 await page.locator('[data-wa-publication] [name=campaign_id]').selectOption(campaignId);
 await page.getByLabel('Equipe sincronizada',{exact:false}).waitFor();
 assert.equal(await page.getByLabel('Equipe sincronizada',{exact:false}).isChecked(),true);
 await page.getByRole('button',{name:'Salvar publicação',exact:true}).click();
 await page.getByText(/Publicação salva na fila/).waitFor();
 assert.deepEqual(await page.evaluate(()=>window.scheduled),[groupId]);
 assert.deepEqual(errors,[]);
 await page.close();
}

(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try {
  await run(browser,{width:390,height:844},'dark');
  await run(browser,{width:1440,height:900},'light');
  console.log('Central de Campanhas em Chromium 390×844 e 1440×900: aprovada com RPCs simuladas.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
