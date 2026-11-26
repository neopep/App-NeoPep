const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('src/cloud.js','utf8');
const body=source.slice(source.indexOf(' async campaignOriginalUpload('),source.indexOf(' async campaignOriginalURL(')).trim().replace(/,$/,'');
const owner='00000000-0000-4000-8000-000000000001',path=owner+'/00000000-0000-4000-8000-000000000002.pdf';
function harness(){
 const calls=[],user={id:owner};
 const sdk={storage:{from(bucket){assert.equal(bucket,'neo-campaign-originals');return {async upload(p,data,options){calls.push({p,data,options});return {data:{path:p}};}};}}};
 const context={need:()=>sdk,identityVersion:0,user,ok:r=>r.data};
 const api=vm.runInNewContext('({'+body+'})',context);return {api,context,calls};
}
test('original de campanha enviado como bytes binários com MIME, não multipart',async()=>{
 const {api,calls}=harness();const bytes=new Uint8Array([37,80,68,70,45,49,46,55]).buffer;
 const result=await api.campaignOriginalUpload(path,{type:'application/pdf',size:bytes.byteLength,arrayBuffer:async()=>bytes});
 assert.equal(result,path);assert.equal(calls.length,1);assert.equal(calls[0].data,bytes);assert.equal(calls[0].options.contentType,'application/pdf');assert.equal(calls[0].options.upsert,false);
});
test('upload original rejeita arquivo vazio, tamanho divergente e troca de conta',async()=>{
 const {api,calls,context}=harness();
 await assert.rejects(api.campaignOriginalUpload(path,{type:'application/pdf',size:10,arrayBuffer:async()=>new ArrayBuffer(0)}),/ler o arquivo completo/);
 await assert.rejects(api.campaignOriginalUpload(path,{type:'application/pdf',size:10,arrayBuffer:async()=>new ArrayBuffer(9)}),/ler o arquivo completo/);
 await assert.rejects(api.campaignOriginalUpload(path,{type:'application/pdf',size:10,arrayBuffer:async()=>{context.identityVersion++;return new ArrayBuffer(10)}}),/conta mudou/);
 assert.equal(calls.length,0);
});
test('editor preserva erro de armazenamento em vez de sobrescrever com erro de conexão',()=>{
 const js=fs.readFileSync('dist/admin/campaign-editor.js','utf8');
 assert.match(js,/lastSaveError\|\|'Não foi possível confirmar a versão salva/);
 assert.match(js,/no content provided/i);
 assert.match(js,/Seu rascunho foi preservado/);
});
