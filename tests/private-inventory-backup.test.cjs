'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const C=require('../dist/shop-core.js');
const example={id:'fixture-1',name:'Caderno fictício',category:'Papelaria',description:'Exemplo',price_cents:2000,stock:2,active:false,photo_url:'https://private.invalid/sign',secret:'fixture-secret',customer_email:'x@example.test'};
test('private backup includes inactive rows, keeps integer values and excludes unrelated private fields',()=>{
 const s=C.inventorySnapshot([example,{...example,id:'fixture-2',active:true}]);
 assert.equal(s.records.length,2);
 assert.equal(s.records[0].active,false);
 assert.equal(s.records[0].stock,2);
 assert.equal(s.records[0].price_cents,2000);
 assert.deepEqual(Object.keys(s.records[0]),['id','name','category','description','price_cents','stock','active']);
 assert.deepEqual(C.inspectInventorySnapshot(JSON.stringify(s)),{count:2});
});
test('backup validation rejects malformed documents, duplicate IDs and invalid inventory values',()=>{
 for(const value of ['not json','{}',JSON.stringify({format:'neopep.private-inventory.v1',records:[{...example,stock:-1}]}),JSON.stringify({format:'neopep.private-inventory.v1',records:[example,example]})])assert.throws(()=>C.inspectInventorySnapshot(value));
 assert.throws(()=>C.inspectInventorySnapshot(' '.repeat(C.snapshotMaxBytes+1)));
 assert.deepEqual(C.inspectInventorySnapshot(JSON.stringify(C.inventorySnapshot([]))),{count:0});
});
test('manager backup is read only, limited to a current admin session and does not import records',()=>{
 const shop=fs.readFileSync('dist/shop.js','utf8');
 const section=shop.slice(shop.indexOf(' function inventoryBackupAllowed()'),shop.indexOf(' function manager()'));
 assert.match(section,/window\.NeoCloud\?\.admin===true&&window\.NeoCloud\?\.user\?\.id===owner/);
 assert.match(section,/token===generation&&inventoryBackupAllowed\(\)/);
 assert.match(section,/Nenhum produto foi importado ou alterado/);
 assert.doesNotMatch(section,/\brpc\(|\.shop\(|\.fetch\(|localStorage|sessionStorage|\.upload\(/);
});
