const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
test('publicação mantém a marca atual NeoPep e mantém o endereço anterior com arquivos idênticos',()=>{
 const target='artifacts/hosting-preview';fs.mkdirSync(target+'/dist/elo',{recursive:true});fs.writeFileSync(target+'/dist/elo/obsolete.txt','old');
 require('../scripts/stage-preview.cjs');
 assert.equal(fs.existsSync(target+'/dist/elo'),false);
 function compare(dir=''){for(const item of fs.readdirSync(path.join('dist',dir),{withFileTypes:true})){
  const relative=path.join(dir,item.name);if(item.isDirectory())compare(relative);else for(const prefix of ['/dist/','/dist/neo/'])assert.deepEqual(fs.readFileSync(target+prefix+relative),fs.readFileSync(path.join('dist',relative)),relative);
 }}compare();
 assert.match(fs.readFileSync(target+'/dist/index.html','utf8'),/<title>NeoPep/);
 assert.equal(JSON.parse(fs.readFileSync(target+'/.openai/hosting.json')).project_id,'appgprj_6af52b680b0081919ba5de6dcb939a32');
});
