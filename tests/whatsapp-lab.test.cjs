const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');

const importLab=()=>import(pathToFileURL(path.resolve('connect/whatsapp-lab/server.mjs')).href);

test('Laboratório QR restringe HTTP ao localhost e não tem rota de envio',async()=>{
 const {createLab}=await importLab();
 const event=[];
 const lab=await createLab({
  providerFactory:async({onState})=>({
   async start(){onState('conectado');event.push('started');},
   async listGroups(){return [
    {id:'12345@g.us',name:'Grupo permitido',members:3,participants:[{id:'nao-revelar'}]},
    {id:'555@s.whatsapp.net',name:'Contato',members:1},
    {id:'222@g.us',name:'Grupo B',members:5}
   ];},
   async forget(){event.push('forgotten');},
   async close(){}
  })
 });
 const fetchApi=(route,method='GET',auth=true,origin=true)=>fetch(lab.origin+route,{
  method,headers:{
   ...(auth?{Authorization:'Bearer '+lab.token}:{}),
   ...(origin?{Origin:lab.origin}:{})
  }
 });
 try{
  assert.match(lab.origin,/^http:\/\/127\.0\.0\.1:\d+$/);
  assert.ok(lab.token.length>=30);
  const html=await fetch(lab.origin+'/');
  assert.equal(html.status,200);
  assert.match(html.headers.get('content-security-policy'),/default-src 'none'/);
  assert.match(html.headers.get('cache-control'),/no-store/);
  assert.equal((await fetchApi('/api/status','GET',false)).status,401);
  assert.equal((await fetchApi('/api/connect','POST',true,false)).status,403);
  const started=await fetchApi('/api/connect','POST');
  assert.equal(started.status,202);
  for(let tries=0;tries<30&&!event.includes('started');tries++)await new Promise(resolve=>setTimeout(resolve,10));
  assert.ok(event.includes('started'));
  const snapshot=await (await fetchApi('/api/status')).json();
  assert.equal(snapshot.connection,'conectado');
  assert.equal((await fetchApi('/api/connect','POST')).status,409);
  assert.equal((await fetchApi('/api/groups','GET')).status,403);
  const result=await (await fetchApi('/api/groups','POST')).json();
  assert.deepEqual(result.groups.map(row=>row.name),['Grupo B','Grupo permitido']);
  assert.equal(JSON.stringify(result).includes('nao-revelar'),false);
  assert.equal((await fetchApi('/api/send','POST')).status,404);
  assert.equal((await fetchApi('/api/forget','POST')).status,200);
  assert.ok(event.includes('forgotten'));
  assert.equal((await (await fetchApi('/api/status')).json()).connection,'desconectado');
 }finally{await lab.close();}
});

test('A etapa não tem API de envio, impressão de QR nem sincronização de conversas',()=>{
 const dir='connect/whatsapp-lab';
 const server=fs.readFileSync(dir+'/server.mjs','utf8');
 const provider=fs.readFileSync(dir+'/whatsapp-provider.mjs','utf8');
 const html=fs.readFileSync(dir+'/ui/index.html','utf8');
 const pkg=JSON.parse(fs.readFileSync(dir+'/package.json','utf8'));
 assert.doesNotMatch(server+provider,/\bsendMessage\s*\(|messages\.upsert|api\/sendMessage/);
 assert.match(html,/Nenhuma mensagem será enviada/);
 assert.match(provider,/markOnlineOnConnect:false/);
 assert.match(provider,/syncFullHistory:false/);
 assert.match(server,/NEOPEP_WHATSAPP_LAB_ENABLE/);
 for(const version of Object.values(pkg.dependencies))assert.match(version,/^\d+\.\d+\.\d+(?:-rc\d+)?$/);
});
