(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.NeoShopCore=api})(typeof window!=='undefined'?window:this,()=>{
 const money=cents=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(cents)/100);
 function cents(value,zero=false){const input=String(value).trim().replace(/^R\$\s*/,'').replace(/\s/g,'');const normalized=input.includes(',')?input.replace(/\./g,'').replace(',','.'):input;if(!/^\d+(\.\d{1,2})?$/.test(normalized))throw Error('Informe um valor em reais, como 99,90.');const parts=normalized.split('.'),result=Number(parts[0])*100+Number((parts[1]||'').padEnd(2,'0'));if(!Number.isSafeInteger(result)||result<(zero?0:1)||result>100000000)throw Error('Valor fora do limite permitido.');return result}
 function validDocument(type,value){const digits=String(value||'').replace(/\D/g,'');if(type==='CPF'){if(!/^\d{11}$/.test(digits)||/^(\d)\1+$/.test(digits))return false;let sum=0;for(let i=0;i<9;i++)sum+=Number(digits[i])*(10-i);let check=(sum*10)%11;if(check===10)check=0;if(check!==Number(digits[9]))return false;sum=0;for(let i=0;i<10;i++)sum+=Number(digits[i])*(11-i);check=(sum*10)%11;if(check===10)check=0;return check===Number(digits[10])}if(type==='CNPJ'){if(!/^\d{14}$/.test(digits)||/^(\d)\1+$/.test(digits))return false;const calc=len=>{const weights=len===12?[5,4,3,2,9,8,7,6,5,4,3,2]:[6,5,4,3,2,9,8,7,6,5,4,3,2];const sum=weights.reduce((n,w,i)=>n+Number(digits[i])*w,0),rest=sum%11;return rest<2?0:11-rest};return calc(12)===Number(digits[12])&&calc(13)===Number(digits[13])}return false}
 function address(values){const keys=['name','email','phone','document_type','document_number','postal_code','street','number','complement','district','city','state'];const result=Object.fromEntries(keys.map(k=>[k,String(values[k]||'').trim()]));result.phone=result.phone.replace(/\D/g,'');result.document_type=result.document_type.toUpperCase();result.document_number=result.document_number.replace(/\D/g,'');result.postal_code=result.postal_code.replace(/\D/g,'');result.state=result.state.toUpperCase();if(result.name.length<2||result.name.length>100||!/^\S+@\S+\.\S+$/.test(result.email)||result.email.length>254||!/^\d{10,11}$/.test(result.phone)||!validDocument(result.document_type,result.document_number)||!/^\d{8}$/.test(result.postal_code)||result.street.length<2||!result.number||result.number.length>20||result.district.length<2||result.city.length<2||!['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].includes(result.state))throw Error('Confira os dados de contato, CPF ou CNPJ e o endereço de entrega.');return result}
 const paymentURL=url=>/^https:\/\/(www\.|sandbox\.)?mercadopago\.com(\.br)?\//.test(String(url));

 // Private inventory snapshot: no signed URLs, customer data, credentials or publication operations.
 const snapshotFormat='neopep.private-inventory.v1',snapshotMaxBytes=10*1024*1024;
 const snapshotText=(value,max)=>typeof value==='string'&&value.length<=max;
 function snapshotRow(row){
  if(!row||typeof row!=='object'||Array.isArray(row)||!snapshotText(row.id,100)||!row.id||!snapshotText(row.name,120)||!row.name.trim()||
   !snapshotText(row.category??'',120)||!snapshotText(row.description??'',10000)||
   !Number.isSafeInteger(row.price_cents)||row.price_cents<0||!Number.isSafeInteger(row.stock)||row.stock<0||typeof row.active!=='boolean')throw Error('Registro de inventário inválido.');
  return {id:row.id,name:row.name,category:row.category??'',description:row.description??'',price_cents:row.price_cents,stock:row.stock,active:row.active};
 }
 function inventorySnapshot(rows){
  if(!Array.isArray(rows)||rows.length>20000)throw Error('Inventário fora do limite de backup.');
  const records=rows.map(snapshotRow);
  if(new Set(records.map(row=>row.id)).size!==records.length)throw Error('IDs duplicados no inventário.');
  return {format:snapshotFormat,created_at:new Date().toISOString(),records};
 }
 function inspectInventorySnapshot(text){
  if(typeof text!=='string'||text.length>snapshotMaxBytes)throw Error('Arquivo acima do limite de 10 MB.');
  let value;try{value=JSON.parse(text)}catch{throw Error('Arquivo JSON inválido.');}
  if(!value||value.format!==snapshotFormat||!Array.isArray(value.records))throw Error('Formato de backup não reconhecido.');
  const validated=inventorySnapshot(value.records);
  return {count:validated.records.length};
 }

 // Complete private catalog archive. Metadata is supplied by the admin-only, read-only snapshot RPC.
 const archiveFormat='neopep.private-catalog.v2',archiveMaxBytes=150*1024*1024;
 const archiveArrays=['records','visibility_rules','visibility_members','promotions','acquisitions','costs','fx_rates','files'];
 const safePhotoPath=p=>typeof p==='string'&&p.length<=300&&/^[a-zA-Z0-9_.-]+(?:\/[a-zA-Z0-9_.-]+)*$/.test(p)&&!p.split('/').some(s=>s==='.'||s==='..');
 function checkArchiveMetadata(meta){
  if(!meta||archiveArrays.some(key=>!Array.isArray(meta[key]))||meta.records.length>20000)throw Error('Manifesto de catálogo inválido.');
  const products=new Set(),paths=new Set(),rules=new Set(),members=new Set(),files=new Set();
  for(const row of meta.records){
   snapshotRow(row);
   if(products.has(row.id)||typeof row.featured!=='boolean'||typeof row.payment_name!=='string'||!Array.isArray(row.photo_paths))throw Error('Registro completo de produto inválido.');
   products.add(row.id);
   for(const path of [...row.photo_paths,row.photo_path].filter(p=>p!=null&&p!=='')){if(!safePhotoPath(path))throw Error('Caminho de imagem inválido.');paths.add(path);}
  }
  for(const rule of meta.visibility_rules){
   if(!products.has(rule.product_id)||rules.has(rule.product_id)||!['public','blocklist','allowlist'].includes(rule.mode))throw Error('Regra de visibilidade inválida.');
   rules.add(rule.product_id);
  }
  if(rules.size!==products.size)throw Error('Regras de visibilidade incompletas.');
  for(const member of meta.visibility_members){
   const k=member.product_id+'|'+member.list+'|'+member.user_id;
   if(!products.has(member.product_id)||!['blocklist','allowlist'].includes(member.list)||typeof member.user_id!=='string'||!/^[a-f0-9-]{36}$/i.test(member.user_id)||members.has(k))throw Error('Lista de visibilidade inválida.');
   members.add(k);
  }
  for(const file of meta.files){
   if(!paths.has(file.path)||files.has(file.path)||file.exists!==true)throw Error('Uma imagem configurada está ausente. Backup cancelado.');
   files.add(file.path);
  }
  if(files.size!==paths.size)throw Error('Manifesto de imagens incompleto.');
  for(const group of ['acquisitions','costs'])for(const row of meta[group])if(!products.has(row.product_id))throw Error('Custo sem produto correspondente.');
  return meta;
 }
 const encodePhoto=bytes=>{let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(binary);};
 const hashPhoto=async bytes=>Array.from(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
 async function createCatalogArchive(readMeta,readPhoto,isCurrent,progress=()=>{}){
  const ensure=()=>{if(!isCurrent())throw Error('A sessão mudou. Backup cancelado.');};
  ensure();const metadata=checkArchiveMetadata(await readMeta());ensure();
  const images=[];let estimate=new Blob([JSON.stringify(metadata)]).size;
  for(const file of metadata.files){
   ensure();const blob=await readPhoto(file.path);ensure();
   if(!(blob instanceof Blob)||!blob.size||blob.size>5*1024*1024)throw Error('Imagem indisponível ou inválida. Backup cancelado.');
   if(file.size!=null&&/^\d+$/.test(String(file.size))&&Number(file.size)!==blob.size)throw Error('O tamanho de uma imagem mudou. Backup cancelado.');
   const bytes=new Uint8Array(await blob.arrayBuffer());ensure();
   estimate+=Math.ceil(bytes.length/3)*4+512;
   if(estimate>archiveMaxBytes)throw Error('Backup acima do limite de 150 MiB. Nenhum arquivo parcial foi gerado.');
   images.push({path:file.path,mime:blob.type||'application/octet-stream',size:bytes.length,sha256:await hashPhoto(bytes),base64:encodePhoto(bytes)});
   progress(images.length,metadata.files.length);
  }
  ensure();const after=checkArchiveMetadata(await readMeta());ensure();
  if(JSON.stringify(after)!==JSON.stringify(metadata))throw Error('O catálogo mudou durante a exportação. Tente novamente.');
  return {format:archiveFormat,created_at:new Date().toISOString(),metadata,images};
 }
 async function inspectCatalogArchive(text){
  if(typeof text!=='string'||text.length>archiveMaxBytes)throw Error('Arquivo acima do limite de 150 MiB.');
  let value;try{value=JSON.parse(text);}catch{throw Error('Arquivo JSON inválido.');}
  if(value?.format!==archiveFormat)return {...inspectInventorySnapshot(text),complete:false,images:0};
  const meta=checkArchiveMetadata(value.metadata),seen=new Set();
  if(!Array.isArray(value.images)||value.images.length!==meta.files.length)throw Error('Backup de imagens incompleto.');
  const files=new Map(meta.files.map(f=>[f.path,f]));
  for(const image of value.images){
   if(!files.has(image.path)||seen.has(image.path)||!Number.isSafeInteger(image.size)||image.size<1||image.size>5*1024*1024||typeof image.base64!=='string'||image.base64.length!==Math.ceil(image.size/3)*4)throw Error('Imagem inválida no backup.');
   const bytes=Uint8Array.from(atob(image.base64),c=>c.charCodeAt(0));
   if(bytes.length!==image.size||await hashPhoto(bytes)!==image.sha256)throw Error('Integridade de uma imagem não confere.');
   const expected=files.get(image.path).size;
   if(expected!=null&&/^\d+$/.test(String(expected))&&Number(expected)!==bytes.length)throw Error('Tamanho de uma imagem não confere.');
   seen.add(image.path);
  }
  return {count:meta.records.length,complete:true,images:seen.size};
 }
 return {money,cents,address,paymentURL,inventorySnapshot,inspectInventorySnapshot,snapshotMaxBytes,createCatalogArchive,inspectCatalogArchive,archiveMaxBytes};
});
