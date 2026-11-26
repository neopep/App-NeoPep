const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const src=fs.readFileSync('src/cloud.js','utf8');
const start=src.indexOf(' async deletePhoto(p){');
const end=src.indexOf(' async photoBlob(p)',start);
assert.ok(start>=0&&end>start,'deletePhoto contract must exist');

function fixture({missing=false,denied=false,changed=false}={}){
 const calls=[];
 const user={id:'owner'};
 const photo={id:'old',user_id:'owner',path:'owner/old.jpg'};
 const record={id:photo.id,path:photo.path};
 const chain=(op)=>({
  eq(key,value){calls.push([op,key,value]);return this},
  async maybeSingle(){return {data:record}},
  then(resolve){calls.push(['deleted']);resolve({data:[{id:photo.id}]})}
 });
 const bucket={async remove(paths){
  calls.push(['remove',...paths]);
  if(changed)user.id='other';
  if(denied)return {error:{statusCode:'403',message:'denied'}};
  if(missing&&paths.length>1)return {error:{statusCode:'404',message:'missing'}};
  if(missing&&paths[0].endsWith('.thumb.jpg'))return {error:{statusCode:'404',message:'missing'}};
  return {data:[]};
 }};
 const client={from(table){assert.equal(table,'neo_photos');return {
  select(){return chain('lookup')},
  delete(){return {eq(key,value){calls.push(['delete',key,value]);return {eq(k,v){calls.push(['delete',k,v]);return {select(){return chain('confirm')}}}}}}}
 }},storage:{from(name){assert.equal(name,'neo-private');return bucket}}};
 const ok=r=>{if(r.error)throw Error(r.error.message);return r.data};
 const api=new Function('client','user','need','ok','identityVersion','return ({'+src.slice(start,end)+'})')(client,user,()=>{},ok,1);
 return {api,photo,calls};
}

test('foto antiga sem miniatura pode ser excluída com recuperação de 404',async()=>{
 const {api,photo,calls}=fixture({missing:true});
 await api.deletePhoto(photo);
 assert.deepEqual(calls.filter(x=>x[0]==='remove'),[
  ['remove','owner/old.jpg','owner/old.jpg.thumb.jpg','owner/old.jpg.preview.jpg'],
  ['remove','owner/old.jpg'],['remove','owner/old.jpg.thumb.jpg'],['remove','owner/old.jpg.preview.jpg']
 ]);
 assert.ok(calls.some(x=>x[0]==='delete'&&x[1]==='user_id'&&x[2]==='owner'));
 assert.ok(calls.some(x=>x[0]==='deleted'));
});

test('foto de outra conta não consulta nem remove objetos',async()=>{
 const {api,photo,calls}=fixture();
 await assert.rejects(api.deletePhoto({...photo,user_id:'other',path:'other/old.jpg'}),/indisponível/);
 assert.deepEqual(calls,[]);
});

test('falha de autorização do Storage preserva registro para retentativa',async()=>{
 const {api,photo,calls}=fixture({denied:true});
 await assert.rejects(api.deletePhoto(photo),/denied/);
 assert.ok(!calls.some(x=>x[0]==='delete'));
});

test('mudança de conta durante exclusão impede remoção posterior do registro',async()=>{
 const {api,photo,calls}=fixture({changed:true});
 await assert.rejects(api.deletePhoto(photo),/conta mudou/);
 assert.ok(!calls.some(x=>x[0]==='delete'));
});
