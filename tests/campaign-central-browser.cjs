const assert=require('node:assert/strict');
const path=require('node:path');
const {chromium,devices}=require('playwright');

async function scenario(browser,profile){
 const page=await browser.newPage(profile);
 const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 try{
  await page.route('https://teste.app.neopep.com.br/',route=>route.fulfill({contentType:'text/html',
   body:'<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><section id="campaigns"></section>'}));
  await page.goto('https://teste.app.neopep.com.br/');
  for(const file of ['campaign-editor.js','campaign-central.js'])await page.addScriptTag({path:path.join(__dirname,'../dist/admin',file)});
  await page.addStyleTag({path:path.join(__dirname,'../dist/style.css')});
  await page.evaluate(()=>{
   window.NEO_CONFIG={supabaseUrl:'https://qnuluspqfazdppciermw.supabase.co',campaignTestEnabled:true,campaignPublicOrigin:'https://teste.app.neopep.com.br'};
   window.campaignCalls=[];
   const campaigns=new Map(),publications=new Map();
   const cloud={user:{id:'fixture-admin'},campaignWhatsAppSync:async()=>[{id:'connection:group',name:'Grupo homologado',state:'eligible'}],
    campaignDispatch:async()=>({whatsapp_test:{destination:'connection:group',ready:true}}),
    campaignRich:async(action)=>action==='status'?[]:{destination:'connection:group',ready:true},
    campaignCentral:async(action,data)=>{
     campaignCalls.push([action,structuredClone(data)]);
     const key=data.campaign_id;
     if(action==='list')return [...campaigns.values()].map(row=>({...row,publications:row.publications.length,drafts:row.publications.length}));
     if(action==='create'){
      campaigns.set('campaign-id',{campaign_id:'campaign-id',title:data.title,default_destination:data.destination,publications:[],events:[]});
      return {campaign_id:'campaign-id'};
     }
     if(action==='get')return campaigns.get(key);
     if(action==='load')return publications.get(data.publication_id)||null;
     if(action==='save'||action==='duplicate'){
      const id=action==='save'?data.publication_id:data.request_id;
      const draft=action==='save'?data.draft:{...publications.get(data.publication_id).draft,planned_local:data.planned_local};
      const snapshot={editor_id:id,campaign_id:id,revision:1,source_id:key,draft};
      publications.set(id,snapshot);
      campaigns.get(key).publications.push({id,title:draft.title,revision:1,planned_local:draft.planned_local,batches:[],kinds:['text']});
      return snapshot;
     }
     if(action==='schedule')return {batch_id:data.request_id};
     throw Error(action);
    }};
   window.NeoCampaignCentral.mount({root:document.querySelector('#campaigns'),cloud,legacy:()=>[]}).load();
  });
  await page.getByRole('button',{name:'+ Nova campanha'}).click();
  await page.getByLabel('Nome da campanha').fill('Campanha de teste');
  await page.getByLabel('Grupo padrão para novas publicações').selectOption('connection:group');
  await page.getByRole('button',{name:'Criar campanha'}).click();
  await page.getByRole('button',{name:'+ Adicionar publicação'}).click();
  const modal=page.locator('dialog[open]');
  await modal.getByLabel('Nome da publicação').fill('Abertura');
  await modal.getByRole('button',{name:'Salvar nome e continuar'}).click();
  await modal.getByLabel('Compor texto').fill('Primeira mensagem');
  await modal.locator('[data-editor=text]').click();
  await modal.getByRole('button',{name:'Registrar rascunho na Central'}).click();
  await modal.getByRole('status').filter({hasText:'Versão 1 registrada'}).waitFor();
  await modal.getByRole('button',{name:'Voltar',exact:true}).click();
  await page.getByRole('button',{name:'Editar publicação'}).click();
  await modal.getByText('Primeira mensagem',{exact:true}).waitFor();
  await modal.getByRole('button',{name:'Voltar',exact:true}).click();
  await page.getByRole('button',{name:'Duplicar / distribuir'}).click();
  await page.locator('[name=date]').fill('2027-01-11T10:00');
  await page.getByRole('button',{name:'+ Outro dia'}).click();
  await page.locator('[name=date]').nth(1).fill('2027-01-12T11:00');
  await page.getByRole('button',{name:'Criar rascunhos nas datas acima'}).click();
  await page.getByText('3 publicação(ões)',{exact:false}).waitFor();
  const calls=await page.evaluate(()=>campaignCalls);
  assert.equal(calls.filter(([action])=>action==='save').length,1);
  assert.equal(calls.filter(([action])=>action==='duplicate').length,2);
  assert.equal(calls.filter(([action])=>['schedule','publish'].includes(action)).length,0);
  await page.getByRole('checkbox',{name:'Selecionar para agendar'}).first().check();
  const confirmation=page.waitForEvent('dialog');
  const clicked=page.getByRole('button',{name:'Revisar e agendar selecionadas'}).click();
  const dialog=await confirmation;
  assert.match(dialog.message(),/Grupo homologado.*2027-01-11/s);
  await dialog.accept();
  await clicked;
  await page.getByRole('status').filter({hasText:'agendada'}).waitFor();
  assert.equal(await page.evaluate(()=>campaignCalls.filter(([action])=>action==='schedule').length),1);
  assert.deepEqual(errors,[]);
 }finally{await page.close();}
}
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  for(const profile of [{viewport:{width:1300,height:850}},devices['iPhone 13'],devices['Pixel 7']])await scenario(browser,profile);
  console.log('OK: campanha, criação e reabertura no editor aprovado, duplicação em datas sem despacho e agendamento simulado após confirmação');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
