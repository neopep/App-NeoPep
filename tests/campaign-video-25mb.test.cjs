const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const editor=fs.readFileSync('dist/admin/campaign-editor.js','utf8');
const source=fs.readFileSync('src/cloud.js','utf8');
const community=fs.readFileSync('dist/community.js','utf8');
test('seletor exclusivo MP4 e limites separados, incluindo originais da biblioteca',()=>{
 assert.match(editor,/tile\('video','Vídeo','video'\)/);
 assert.match(editor,/choose_video/);
 const limit=new Function(editor.match(/const originalLimit=.*?;/)[0]+'return originalLimit')();
 assert.equal(limit('video/mp4'),26214400);
 assert.equal(limit('application/pdf'),5242880);
 assert.match(editor,/short\?512000:originalLimit\(file\.mime\)/);
});
test('upload conserva 25 MiB sem recodificação e recusa excesso e PDF maior que 5 MiB',async()=>{
 const owner='00000000-0000-4000-8000-000000000001',base=owner+'/00000000-0000-4000-8000-000000000002',calls=[];
 const body=source.slice(source.indexOf(' async campaignOriginalUpload('),source.indexOf(' async campaignOriginalURL(')).trim().replace(/,$/,'');
 const api=vm.runInNewContext('({'+body+'})',{need:()=>({storage:{from:()=>({upload:async(path,bytes,opts)=>{calls.push({path,bytes,opts});return {data:{path}};}})}}),identityVersion:0,user:{id:owner},ok:r=>r.data});
 const bytes=new ArrayBuffer(26214400);await api.campaignOriginalUpload(base+'.mp4',{type:'video/mp4',size:bytes.byteLength,arrayBuffer:async()=>bytes});
 assert.equal(calls[0].bytes,bytes);
 await assert.rejects(api.campaignOriginalUpload(base+'.mp4',{type:'video/mp4',size:26214401,arrayBuffer:async()=>{throw Error('not read')}}),/inválido/);
 await assert.rejects(api.campaignOriginalUpload(base+'.pdf',{type:'application/pdf',size:5242881,arrayBuffer:async()=>{throw Error('not read')}}),/inválido/);
});
test('download somente quando autorizado e com URL assinada renovada',()=>{
 assert.match(community,/!draftFile&&!editorFile&&f.allow_download===true/);
 assert.match(community,/libraryMediaURL\(f,true\)/);
 assert.match(community,/f.allow_download!==true\|\|t.disabled/);
});
test('transporte valida 25 MiB MP4 e mantém PDF em 5 MiB',async()=>{
 const {validCampaignFile,CAMPAIGN_FILE_MAX}=await import('../connect/whatsapp-lab/whatsapp-provider.mjs');
 const mp4=Buffer.alloc(26214400);mp4.writeUInt32BE(16,0);mp4.write('ftyp',4);
 assert.equal(CAMPAIGN_FILE_MAX,26214400);
 assert.equal(validCampaignFile(mp4,'video/mp4','original.mp4'),true);
 assert.equal(validCampaignFile(Buffer.concat([mp4,Buffer.alloc(1)]),'video/mp4','original.mp4'),false);
 assert.equal(validCampaignFile(mp4,'application/pdf','original.pdf'),false);
});
