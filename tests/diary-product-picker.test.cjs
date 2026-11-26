'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const app=fs.readFileSync('src/app.js','utf8');
const snippet=app.slice(app.indexOf('const diaryProductNames='),app.indexOf('function diaryProductOptionMarkup('));
const {diaryProductOptions,diaryProductNotice}=new Function(snippet+';return {diaryProductOptions,diaryProductNotice};')();
test('diary reference list is searchable, accent-insensitive, and research names require explicit search',()=>{
 assert.ok(diaryProductOptions().length>=30);assert.ok(diaryProductOptions().every(x=>!x.research));
 assert.ok(diaryProductOptions('tirzep').some(x=>x.name==='Tirzepatida'));assert.ok(diaryProductOptions('OCITÓ').some(x=>x.name==='Ocitocina'));
 assert.deepEqual(diaryProductOptions('reta').map(x=>[x.name,x.research]),[['Retatrutida',true]]);
 assert.equal(diaryProductOptions('outro produto').length,0);assert.match(diaryProductNotice('Retratutida'),/sem aprovação/);
 assert.match(diaryProductNotice('GHK-Cu'),/não autoriza/);assert.equal(diaryProductNotice('Tirzepatida'),'');
});
test('empty vial shows guidance and product remains editable without a list selection',()=>{
 assert.match(app,/calcVial\('diary-empty'\)/);assert.match(app,/Nenhum frasco ativo/);
 assert.match(app,/Pesquisar ou escrever o nome/);assert.match(app,/Escolher da lista \(opcional\)/);
 assert.match(app,/diaryInvalidField\('diary-vial-product'/);assert.match(app,/const product=String\(\$\('#diary-vial-product'\)\.value/);
});
