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
 return {money,cents,address,paymentURL,inventorySnapshot,inspectInventorySnapshot,snapshotMaxBytes};
});
