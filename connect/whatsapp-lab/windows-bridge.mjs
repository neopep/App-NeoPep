// Protocolo privado por pipes herdados. Nenhuma porta HTTP é aberta.
import {createInterface} from 'node:readline';
import {fileURLToPath} from 'node:url';
import {createBaileysProvider,validCampaignFile,CAMPAIGN_FILE_MAX} from './whatsapp-provider.mjs';

export function createBridge({emit,providerFactory=createBaileysProvider,renderQr}){
 let current,generation=0,qrVersion=0,state='desconectado',checking=false,sending=false,diagnosing=false,closed=false;
 // Refuse replay of original-file request IDs during the runtime session, including uncertain sends.
 const fileAttempts=new Set(),tracked=new Map(),earlyReceipts=new Map();
 const output=(type,value)=>{if(!closed)emit({type,value});};
 function update(next){state=next;++qrVersion;output('state',next);}
 const receiptKey=r=>r.group_jid+':'+r.message_id;
 function remember(map,key,value){if(map.size>=4096&&!map.has(key))map.delete(map.keys().next().value);map.set(key,value);}
 function reportReceipt(r){
  if(!r||!['server_ack','delivery_ack','send_error'].includes(r.status)||typeof r.message_id!=='string'||!r.message_id||r.message_id.length>160||!/^[0-9-]{1,64}@g\.us$/.test(r.group_jid||''))return;
  const safe={group_jid:r.group_jid,message_id:r.message_id,status:r.status,...(r.status==='send_error'?{error_code:/^[0-9]{1,5}$/.test(r.error_code||'')?r.error_code:'unknown'}:{})},key=receiptKey(safe),entry=tracked.get(key);
  if(entry&&Date.now()-entry.at<86400000){
   if(entry.status==='delivery_ack'||entry.status===safe.status||(entry.status==='send_error'&&safe.status==='server_ack'))return;
   entry.status=safe.status;output('delivery_receipt',safe);
  }else if(sending){
   const old=earlyReceipts.get(key);if(old?.receipt.status==='delivery_ack'||(old?.receipt.status==='send_error'&&safe.status==='server_ack'))return;
   remember(earlyReceipts,key,{receipt:safe,at:Date.now()});
  }
 }
 return {
  async receive(message){
   if(closed)return;
   try{
    if(message.action==='connect'){
     const revision=++generation;tracked.clear();earlyReceipts.clear();
     await current?.close();current=null;update('conectando');
     const candidate=await providerFactory({
      serialized:typeof message.vault==='string'?message.vault:null,
      automaticMaintenance:message.automatic_maintenance===true,
      onMaintenance:value=>{
       if(revision!==generation||!value||!/^[0-9-]{1,64}@g\.us$/.test(value.group_jid||''))return;
       const codes=['preflight_unavailable','preflight_blocked','checked_no_change','pruned','maintenance_unverified','previous_421'];
       if(!codes.includes(value.code))return;
       const count=v=>Number.isSafeInteger(v)&&v>=0&&v<=100000?v:null;
       output('group_maintenance',{group_jid:value.group_jid,code:value.code,before:count(value.before),after:count(value.after),removed:count(value.removed),membership_changed:value.membership_changed===true});
      },
      onCredentials:value=>{if(revision===generation)output('vault',value);},
      onReceipt:value=>{if(revision===generation)reportReceipt(value);},
      onGroupCheck:value=>{
       if(revision!==generation||!value||!/^[0-9-]{1,64}@g\.us$/.test(value.group_jid||''))return;
       const codes=['ok','membership_refreshed','membership_changed_during_read','mode_mismatch','metadata_invalid','metadata_unavailable','permission_unverified'];
       if(!codes.includes(value.code))return;
       const mode=v=>['pn','lid'].includes(v)?v:'unknown';
       const count=v=>Number.isSafeInteger(v)&&v>=0&&v<=100000?v:0;
       output('group_check',{group_jid:value.group_jid,code:value.code,listed_mode:mode(value.listed_mode),fresh_mode:mode(value.fresh_mode),
        listed_count:count(value.listed_count),fresh_count:count(value.fresh_count),lid_count:count(value.lid_count),pn_count:count(value.pn_count),
        members_changed:value.members_changed===true});
      },
      onState:value=>{
       if(revision!==generation)return;
       update(value);
       if(value==='conectado'){
        const account=current?.account?.();
        output('account',{name:String(account?.name??'').slice(0,120),
         number:/^[0-9]{6,15}$/.test(account?.number??'')?account.number:''});
       }
      },
      onQr:async raw=>{
       const version=++qrVersion;
       const renderer=renderQr||(async value=>{
        const {default:qr}=await import('qrcode');
        return (await qr.toBuffer(value,{type:'png',width:264,margin:2})).toString('base64');
       });
       const image=await renderer(raw);
       if(revision===generation&&version===qrVersion&&state!=='conectado'){
        state='aguardando_qr';output('state',state);output('qr',image);
       }
      }
     });
     if(closed||revision!==generation){await candidate.close();return;}
     current=candidate;await current.start();
    }else if(message.action==='maintenance_settings'){
     if(typeof message.automatic_maintenance==='boolean')current?.setAutomaticMaintenance?.(message.automatic_maintenance);
    }else if(message.action==='groups'&&state==='conectado'&&!checking){
     checking=true;output('groups_loading',null);
     const revision=generation;
     try{
      const rows=await current.listGroups();
      if(revision===generation&&state==='conectado')output('groups',rows.filter(row=>/^[0-9-]+@g\.us$/.test(row?.id))
       .map(row=>({id:row.id,name:String(row.name||'Sem nome').slice(0,120),members:Number.isSafeInteger(row.members)&&row.members>=0?row.members:null,
        addressing_mode:['pn','lid'].includes(row.addressing_mode)?row.addressing_mode:'unknown',
        role:['admin','superadmin','member'].includes(row.role)?row.role:'unknown',
        posting:['admins','all'].includes(row.posting)?row.posting:'unknown',
        settings:['admins','all'].includes(row.settings)?row.settings:'unknown'})));
     }finally{checking=false;}
    }else if(message.action==='revalidate_group_availability'){
     const jid=message.group_jid;
     if(typeof jid!=='string'||!/^[0-9-]{1,64}@g\.us$/.test(jid))return;
     const report=(result={})=>output('group_revalidation',{group_jid:jid,code:['local_pause_cleared','checked_no_pause','rejected_again','metadata_or_permission','not_participating','unavailable'].includes(result.code)?result.code:'unavailable'});
     if(message.official_confirmed!==true||state!=='conectado'||!current||sending||checking||diagnosing||typeof current.revalidateGroupAvailability!=='function'){report();return;}
     diagnosing=true;const revision=generation,provider=current;
     try{const result=await provider.revalidateGroupAvailability(jid,true);if(revision===generation)report(result);}
     catch{if(revision===generation)report();}
     finally{diagnosing=false;}
    }else if(message.action==='recover_group_distribution'){
     const jid=message.group_jid;
     if(typeof jid!=='string'||!/^[0-9-]{1,64}@g\.us$/.test(jid))return;
     const report=(result={})=>{
      const codes=['recovered','already_recovered','already_empty','no_mismatch','metadata_or_permission','identity_unverified','not_participating','invalid_memory','verification_failed','unavailable'];
      const count=v=>Number.isSafeInteger(v)&&v>=0&&v<=100000?v:null;
      output('group_recovery',{group_jid:jid,code:codes.includes(result.code)?result.code:'unavailable',before:count(result.before),after:count(result.after),unmatched:count(result.unmatched)});
     };
     if(message.confirmed!==true||state!=='conectado'||!current||sending||checking||diagnosing||typeof current.recoverGroupDistribution!=='function'){report();return;}
     diagnosing=true;const revision=generation,provider=current;
     try{const result=await provider.recoverGroupDistribution(jid);if(revision===generation)report(result);}
     catch{if(revision===generation)report({code:'verification_failed'});}
     finally{diagnosing=false;}
    }else if(message.action==='diagnose_group'){
     const jid=message.group_jid;
     if(typeof jid!=='string'||!/^[0-9-]{1,64}@g\.us$/.test(jid))return;
     const report=(result={})=>{
      const codes=['ok','membership_refreshed','membership_changed_during_read','mode_mismatch','metadata_invalid','metadata_unavailable','permission_unverified','not_participating','diagnostic_unavailable'];
      const mode=v=>['pn','lid'].includes(v)?v:'unknown';
      const count=v=>Number.isSafeInteger(v)&&v>=0&&v<=100000?v:null;
      output('group_diagnostic',{group_jid:jid,code:codes.includes(result.code)?result.code:'diagnostic_unavailable',
       stage:['start','list','individual','complete'].includes(result.stage)?result.stage:'start',
       listed_mode:mode(result.listed_mode),fresh_mode:mode(result.fresh_mode),
       listed_count:count(result.listed_count),fresh_count:count(result.fresh_count),lid_count:count(result.lid_count),pn_count:count(result.pn_count),unknown_count:count(result.unknown_count),
       role:['admin','superadmin','member'].includes(result.role)?result.role:'unknown',
       posting:['admins','all'].includes(result.posting)?result.posting:'unknown',
       settings:['admins','all'].includes(result.settings)?result.settings:'unknown',
       members_changed:result.members_changed===true,crypto_status:'not_verified',
       store_status:['inspected','invalid_memory_shape'].includes(result.store_status)?result.store_status:'unavailable',
       memory_status:['absent','present','invalid'].includes(result.memory_status)?result.memory_status:'unknown',
       memory_entries:count(result.memory_entries),memory_lid:count(result.memory_lid),memory_pn:count(result.memory_pn),memory_other:count(result.memory_other),
       memory_unmatched:count(result.memory_unmatched),memory_unparseable:count(result.memory_unparseable),
       cached_members:count(result.cached_members),uncached_members:count(result.uncached_members),cached_devices:count(result.cached_devices),session_records:count(result.session_records),
       own_lid_available:typeof result.own_lid_available==='boolean'?result.own_lid_available:null,
       own_lid_key:['present','absent'].includes(result.own_lid_key)?result.own_lid_key:'unknown',
       own_pn_key:['present','absent'].includes(result.own_pn_key)?result.own_pn_key:'unknown'});
     };
     if(state!=='conectado'||!current||sending||checking||diagnosing||typeof current.diagnoseGroup!=='function'){report();return;}
     diagnosing=true;const revision=generation,provider=current;
     try{const result=await provider.diagnoseGroup(jid);if(revision===generation)report(result);}
     catch{if(revision===generation)report();}
     finally{diagnosing=false;}
    }else if((message.action==='send_text'||message.action==='send_image'||message.action==='send_file')){
     const requestId=typeof message.request_id==='string'&&/^[a-f0-9-]{36}$/i.test(message.request_id)?message.request_id:null;
     if(!requestId)return;
     if(sending||diagnosing||state!=='conectado'||!current){
      output('send_result',{request_id:requestId,status:'rejected',reason:'Envio indisponível ou em andamento.'});return;
     }
     const jid=message.group_jid,text=message.text;
     const isImage=message.action==='send_image';
     const isFile=message.action==='send_file';
     const base64=message.image;
     let image;
     if(isImage&&typeof base64==='string'&&base64.length<=1398104&&base64.length%4===0&&/^[A-Za-z0-9+/]+={0,2}$/.test(base64)){
      const bytes=Buffer.from(base64,'base64');
      if(bytes.length>=4&&bytes.length<=1024*1024&&bytes[0]===255&&bytes[1]===216&&bytes.at(-2)===255&&bytes.at(-1)===217)image=bytes;
     }
     let file;
     if(isFile&&typeof message.file==='string'&&message.file.length<=Math.ceil(CAMPAIGN_FILE_MAX/3)*4&&message.file.length%4===0&&/^[A-Za-z0-9+/]+={0,2}$/.test(message.file)){
      const bytes=Buffer.from(message.file,'base64');
      if(bytes.toString('base64')===message.file&&validCampaignFile(bytes,message.mime,message.name))file=bytes;
     }
     if(typeof jid!=='string'||!/^[0-9-]{1,64}@g\.us$/.test(jid)
       ||typeof text!=='string'||text.length>2000||(isImage?!image:isFile?(!file||text.length>1000||typeof current.sendFile!=='function'):!text.trim())){
      output('send_result',{request_id:requestId,status:'rejected',reason:'Grupo ou texto inválido.'});return;
     }
     if(isFile&&(fileAttempts.has(requestId)||fileAttempts.size>=4096)){
      output('send_result',{request_id:requestId,status:'uncertain',reason:'Solicitação já processada ou limite da sessão. Confira o histórico antes de continuar.'});return;
     }
     if(isFile)fileAttempts.add(requestId);
     sending=true;const revision=generation,provider=current;
     output('group_send_stage',{group_jid:jid,stage:'attempt_started'});
     try{
      const receipt=isImage?await provider.sendImage(jid,text,image):isFile?await provider.sendFile(jid,text,file,message.mime,message.name):await provider.sendText(jid,text);
      if(receipt?.blocked==='previous_421'){
       if(revision===generation)output('group_send_stage',{group_jid:jid,stage:'paused_previous_421'});
       output('send_result',{request_id:requestId,status:'rejected',reason_code:'previous_421',reason:'Envio pausado por rejeição anterior do WhatsApp. Nenhuma mensagem transmitida.'});return;
      }
      if(revision===generation)output('group_send_stage',{group_jid:jid,stage:receipt?.messageId&&state==='conectado'?'receipt_generated':'uncertain'});
      output('send_result',{request_id:requestId,status:revision===generation&&state==='conectado'?'accepted':'uncertain',
       message_id:String(receipt?.messageId??'').slice(0,160)});
      if(message.track_delivery===true&&revision===generation&&state==='conectado'&&receipt?.messageId){
       const key=receiptKey({group_jid:jid,message_id:receipt.messageId});
       remember(tracked,key,{at:Date.now(),status:null});
       const early=earlyReceipts.get(key);earlyReceipts.delete(key);
       if(early&&Date.now()-early.at<120000)reportReceipt(early.receipt);
      }
     }catch{
      if(revision===generation)output('group_send_stage',{group_jid:jid,stage:'uncertain'});
      output('send_result',{request_id:requestId,status:'uncertain',reason:'O envio não pôde ser confirmado. Confira no WhatsApp antes de tentar novamente.'});
     }finally{sending=false;}
    }else if(message.action==='disconnect'){
     ++generation;tracked.clear();earlyReceipts.clear();const previous=current;current=null;update('desconectando');output('vault',null);
     const revoked=previous?await previous.forget():false;
     update(revoked?'desconectado':'limpeza_local');
    }
   }catch{
    output('error',message.action==='groups'?'grupos_indisponiveis':'operacao_indisponivel');
    if(message.action!=='groups')update('erro');
   }
  },
  async close(){closed=true;++generation;await current?.close();}
 };
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
 const bridge=createBridge({emit:message=>process.stdout.write(JSON.stringify(message)+'\n')});
 const lines=createInterface({input:process.stdin,terminal:false});
 const stop=async()=>{try{await bridge.close()}finally{process.exit(0)}};
 lines.on('close',()=>{void stop()});
 process.on('uncaughtException',()=>{void stop()});
 process.on('unhandledRejection',()=>{void stop()});
 let pending=Promise.resolve();
 lines.on('line',line=>{
  if(line.length>40*1024*1024)return;
  pending=pending.then(async()=>{try{await bridge.receive(JSON.parse(line));}catch{}});
 });
}
