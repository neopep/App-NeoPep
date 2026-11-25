const assert=require('node:assert/strict');
const path=require('node:path');
const {chromium,devices}=require('playwright');
const dist=path.resolve(__dirname,'../dist');
async function scenario(browser,options){
 const page=await browser.newPage(options);
 try{
  await page.route('https://teste.app.neopep.com.br/',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><button id="start">Abrir</button>'}));
  await page.route('https://qnuluspqfazdppciermw.supabase.co/**',route=>route.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jR8sAAAAASUVORK5CYII=','base64')}));
  await page.goto('https://teste.app.neopep.com.br/');
  await page.addStyleTag({path:path.join(dist,'style.css')});
  await page.addScriptTag({path:path.join(dist,'admin/campaign-editor.js')});
  await page.evaluate(()=>{
   window.confirm=()=>true;window.calls=[];window.failed=false;window.failSave=true;
   window.cloud={
    user:{id:'admin'},
    campaignWhatsAppSync:async action=>{
     window.calls.push([action]);
     if(window.failed)throw Error('offline');
     return [{id:'connection:g1',state:'eligible',name:'Grupo um',connection:'Conta A'},
      {id:'connection:g2',state:'disconnected',name:'Grupo dois',connection:'Conta B'}];
    },
    campaignDispatch:async(action,input)=>{
     window.calls.push([action,input]);
     if(action==='diagnostics')return {whatsapp_enabled:false,app_enabled:true,devices:[]};
     if(action==='publish_app')return {batch_id:'batch-app'};
     if(action==='app_status')return [{id:'batch-app',title:'App',status:'active',starts_at:'2099-01-01',push_requested:false}];
     throw Error('Ação inesperada');
    },
    shop:async()=>({products:[{id:'produto-publico',active:true,photo_path:'teste.png'}]}),
    shopPhotoURL:async()=> 'https://qnuluspqfazdppciermw.supabase.co/storage/v1/object/sign/neo-shop-products/teste.png?token=fixture',
    campaignEditor:async(action,payload)=>{
     window.calls.push([action,payload]);
     if(action==='catalog')return payload.kind==='product'?[{id:'produto-publico',label:'Produto público',price_cents:2490}]:[{id:'catalog-1',label:'Material autorizado'}];
     if(action==='save'){
      if(window.failSave){window.failSave=false;throw Error('resposta perdida');}
      return {revision:payload.revision+1,campaign_id:'remote'};
     }
     throw Error('Operação inesperada '+action);
    }
   };
   document.querySelector('#start').onclick=()=>NeoCampaignEditor.open({cloud,trigger:document.querySelector('#start')});
  });
  await page.locator('#start').click();
  const dialog=page.locator('dialog');
  await dialog.getByLabel('Nome da campanha').fill('Campanha de revisão');
  await dialog.getByRole('button',{name:'Salvar nome e continuar'}).click();
  assert.equal(await dialog.locator('[data-campaign-name]').textContent(),'Campanha de revisão');
  await dialog.getByLabel('Compor texto').fill('Olá mundo');
  assert.match(await dialog.locator('[data-editor-live]').textContent(),/Olá mundo/);
  await dialog.getByRole('button',{name:'Expandir campo'}).click();
  assert.equal(await dialog.locator('textarea').getAttribute('rows'),'10');
  await dialog.getByRole('button',{name:'Expandir campo'}).click();
  assert.equal(await dialog.locator('textarea').getAttribute('rows'),'2');
  const full=page.viewportSize();
  await page.setViewportSize({width:full.width,height:Math.min(full.height,425)});
  await dialog.locator('textarea').focus();
  await page.waitForFunction(()=>{
   const bounds=document.querySelector('.neo-structured-editor footer').getBoundingClientRect();
   const field=document.querySelector('.neo-structured-editor textarea').getBoundingClientRect();
   const edge=visualViewport.offsetTop+visualViewport.height;
   return bounds.bottom<=edge+2&&field.bottom<=edge+2;
  });
  await page.setViewportSize(full);
  await dialog.locator('[name=message]').evaluate(el=>{el.focus();el.setSelectionRange(4,9);el.dispatchEvent(new Event('select'));});
  await dialog.getByRole('button',{name:'Adicionar conteúdo'}).click();
  await dialog.getByRole('button',{name:'Formatar seleção',exact:true}).click();
  await dialog.getByRole('button',{name:'Negrito'}).click();
  await dialog.getByRole('button',{name:'Adicionar texto'}).click();
  assert.equal(await dialog.locator('.neo-structured-text strong').textContent(),'mundo');
  await dialog.locator('.structured-bubble-actions summary').first().click();
  await dialog.getByRole('button',{name:'Duplicar'}).click();
  assert.equal(await dialog.locator('.neo-structured-bubble').count(),2);
  await dialog.locator('.structured-bubble-actions summary').last().click();
  await dialog.getByRole('button',{name:'Excluir'}).last().click();
  await dialog.getByRole('button',{name:'Desfazer exclusão'}).click();
  assert.equal(await dialog.locator('.neo-structured-bubble').count(),2);
  await dialog.getByRole('button',{name:'Adicionar conteúdo'}).click();
  await dialog.getByRole('button',{name:'Foto',exact:true}).click();
  await dialog.locator('[name=media]').setInputFiles({
   name:'imagem.png',mimeType:'image/png',
   buffer:Buffer.concat([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jR8sAAAAASUVORK5CYII=','base64'),Buffer.alloc(6*1024*1024)])
  });
  await dialog.locator('[data-editor-image]:not([hidden])').waitFor();
  assert.equal(await dialog.getByRole('button',{name:'Legenda da imagem'}).getAttribute('aria-pressed'),'true');
  await dialog.getByLabel('Compor texto').fill('Legenda da foto');
  assert.equal(await dialog.locator('[data-editor-image]').locator('..').locator('[data-block-text]').textContent(),'Legenda da foto');
  const l=dialog.getByRole('button',{name:'Legenda da imagem'});
  await l.click();
  assert.equal(await dialog.locator('[data-editor-live]').textContent(),'Legenda da foto');
  assert.equal(await dialog.locator('[data-editor-image]').locator('..').locator('[data-block-text]').textContent(),'');
  await l.click();
  assert.equal(await dialog.locator('[data-editor-image]').locator('..').locator('[data-block-text]').textContent(),'Legenda da foto');
  await dialog.getByRole('button',{name:'Atualizar bloco'}).click();
  await dialog.getByRole('button',{name:'Adicionar conteúdo'}).click();
  await dialog.getByRole('button',{name:'Biblioteca',exact:true}).click();
  await dialog.getByRole('button',{name:'Material autorizado'}).click();
  await dialog.getByRole('button',{name:'Adicionar conteúdo'}).click();
  await dialog.getByRole('button',{name:'Produto',exact:true}).click();
  await dialog.getByRole('button',{name:/Produto público/}).click();
  await dialog.locator('.structured-product img').waitFor();
  assert.match(await dialog.locator('.structured-product').textContent(),/24,90/);
  assert.equal(await dialog.locator('.structured-product a').getAttribute('href'),'https://teste.app.neopep.com.br/?produto=produto-publico#loja');
  await dialog.getByRole('button',{name:'Grupos',exact:true}).click();
  await dialog.getByLabel(/Grupo um/).check();
  assert.equal(await dialog.getByLabel(/Grupo dois/).isDisabled(),true);
  await dialog.getByRole('button',{name:'Voltar',exact:true}).click();
  await dialog.waitFor({state:'detached'});
  await page.locator('#start').click();
  await dialog.getByRole('button',{name:'Configurações',exact:true}).click();
  assert.equal(await dialog.getByLabel('Nome da campanha').inputValue(),'Campanha de revisão');
  await dialog.getByRole('button',{name:'Fechar painel'}).click();
  assert.equal(await dialog.locator('.neo-structured-bubble').count(),5);
  await dialog.locator('[data-editor-image]:not([hidden])').waitFor();
  await dialog.getByRole('button',{name:'Grupos',exact:true}).click();
  await dialog.getByLabel(/Grupo um/).waitFor();
  assert.equal(await dialog.getByLabel(/Grupo um/).isChecked(),true);
  await page.evaluate(()=>{window.failed=true;});
  await dialog.getByRole('button',{name:'Atualizar grupos e diagnóstico'}).click();
  await dialog.getByRole('button',{name:'Fechar painel'}).click();
  await dialog.getByRole('button',{name:'Configurações',exact:true}).click();
  await dialog.getByText('Diagnóstico indisponível. Despacho bloqueado.').waitFor();
  await dialog.getByRole('button',{name:'Fechar painel'}).click();
  await dialog.getByRole('button',{name:'Publicação e agendamento'}).click();
  assert.equal(await dialog.getByRole('button',{name:'Publicar agora'}).isDisabled(),true);
  assert.equal(await dialog.getByRole('button',{name:'Programar',exact:true}).isDisabled(),true);
  await dialog.getByRole('button',{name:'Simular publicação'}).click();
  assert.match(await dialog.locator('[data-editor-simulation]').textContent(),/Nenhuma campanha foi publicada/);
  assert.equal(await page.evaluate(()=>calls.some(([action])=>action==='schedule_whatsapp')),false);
  await dialog.getByRole('button',{name:'Fechar painel'}).click();
  await dialog.getByRole('button',{name:'Registrar rascunho na Central'}).click();
  await dialog.getByText(/Não foi possível confirmar o registro/).waitFor();
  await dialog.getByRole('button',{name:'Registrar rascunho na Central'}).click();
  await dialog.getByText(/Versão 1 registrada/).waitFor();
  const writes=await page.evaluate(()=>calls.filter(([action])=>action==='save').map(([,data])=>data));
  assert.equal(writes[0].request_id,writes[1].request_id);
  assert.deepEqual(writes[0].draft.groups,['connection:g1']);
  assert.equal(JSON.stringify(writes[0].draft).includes('token=fixture'),false);
  await dialog.getByRole('button',{name:'Configurações',exact:true}).click();
  await dialog.getByRole('button',{name:'Criar versão App'}).click();
  await dialog.getByRole('heading',{name:'Rascunho App'}).waitFor();
  await dialog.getByRole('button',{name:'Público',exact:true}).click();
  await dialog.locator('[name=audience]').selectOption('premium');
  await dialog.getByRole('button',{name:'Fechar painel'}).click();
  await dialog.getByRole('button',{name:'Registrar rascunho na Central'}).click();
  await dialog.getByText(/Versão 1 registrada/).waitFor();
  const app=await page.evaluate(()=>calls.filter(([action])=>action==='save').at(-1)[1]);
  assert.equal(app.channel,'app');assert.equal(app.draft.audience,'premium');assert.deepEqual(app.draft.groups,[]);
  await dialog.getByRole('button',{name:'Publicar agora'}).click();
  await dialog.getByText('Tem certeza de que deseja publicar esta campanha agora?').waitFor();
  assert.equal(await page.evaluate(()=>calls.some(([action])=>action==='publish_app')),false);
  await dialog.getByRole('button',{name:'Confirmar',exact:true}).click();
  // The mock must receive only the App dispatch and no external notification.
  await dialog.getByText('Campanha App registrada.').waitFor();
  assert.equal(await page.evaluate(()=>calls.find(([action])=>action==='publish_app')[1].push),false);
  await dialog.getByRole('button',{name:'Adicionar conteúdo'}).click();
  await dialog.getByRole('button',{name:'Destinos',exact:true}).click();
  await dialog.getByRole('button',{name:'Atualizar tentativas'}).click();
  await dialog.getByText('App · Programada').waitFor();

  await dialog.getByRole('button',{name:'Fechar painel'}).click();
  await dialog.getByRole('button',{name:'Voltar',exact:true}).click();
  await dialog.waitFor({state:'detached'});
  await page.evaluate(()=>NeoCampaignEditor.preview({cloud,row:{body:'Só para simulação'}}));
  await dialog.getByText('Só para simulação').waitFor();
  assert.equal(await dialog.locator('[name=message]').count(),0);
  assert.equal(await dialog.locator('.neo-structured-bubble').count(),1);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 }finally{await page.close();}
}
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  await scenario(browser,{viewport:{width:1280,height:800}});
  await scenario(browser,devices['iPhone 13']);
  await scenario(browser,devices['Pixel 7']);
  console.log('OK: editor desktop, iPhone 13 e Pixel 7 emulados');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
